import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

const PROJECT_ROOT = resolve(process.env.LEX_WORKSPACE_ROOT ?? resolve(process.cwd(), ".."));
const LEX_BIN = resolve(process.env.LEX_APP_ROOT ?? resolve(process.cwd(), ".."), "bin", "lex.js");
const TASKS_ROOT = resolve(PROJECT_ROOT, "outputs", "tasks");
const OUTPUTS_ROOT = resolve(PROJECT_ROOT, "outputs");
const ARTIFACT_INDEX_PATH = resolve(OUTPUTS_ROOT, "artifacts", "index.json");

export type TaskStatus = "queued" | "running" | "waiting_for_user" | "done" | "error" | "stopped";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type PendingPrompt = {
  id: string;
  method: "input" | "confirm" | "select" | "editor";
  title?: string;
  message?: string;
  placeholder?: string;
  prefill?: string;
  options?: string[];
};

export type TaskRecord = {
  id: string;
  title: string;
  workflow?: string;
  prompt: string;
  status: TaskStatus;
  statusText: string;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  archivedAt?: string;
  deletedAt?: string;
  pendingPrompt?: PendingPrompt;
  exitCode?: number | null;
  signal?: string | null;
};

export type ArtifactRecord = {
  id: string;
  name: string;
  path: string;
  taskId?: string;
  taskTitle?: string;
  folder: string;
  kind: "result" | "draft" | "provenance" | "upload" | "other";
  content: string;
  mtime: number;
  size: number;
  isProvenance: boolean;
};

type ArtifactIndex = {
  folders: string[];
  artifacts: Record<string, { folder?: string; name?: string; deletedAt?: string }>;
};

type RuntimeTask = {
  record: TaskRecord;
  process?: ChildProcessWithoutNullStreams;
  lineBuffer: string;
  currentAssistantId?: string;
};

type CreateTaskInput = {
  title?: string;
  workflow?: string;
  prompt: string;
};

type SendMessageInput = {
  message?: string;
  pendingResponse?: string | boolean;
  cancelled?: boolean;
};

function now() {
  return new Date().toISOString();
}

function makeId(prefix = "task") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function taskDir(taskId: string) {
  return resolve(TASKS_ROOT, taskId);
}

function jsonLine(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

function safeText(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try { return JSON.stringify(value); } catch { return String(value); }
}

function artifactId(relativePath: string) {
  return Buffer.from(relativePath).toString("base64url");
}

function artifactPathFromId(id: string) {
  return Buffer.from(id, "base64url").toString("utf8");
}

function assertInsideOutputs(relativePath: string) {
  const full = resolve(PROJECT_ROOT, relativePath);
  const rel = relative(OUTPUTS_ROOT, full);
  if (rel.startsWith("..") || rel === "" || rel.includes("..")) {
    throw new Error("Artifact path is outside outputs.");
  }
  return full;
}

async function readArtifactIndex(): Promise<ArtifactIndex> {
  const existing = await readJson<ArtifactIndex>(ARTIFACT_INDEX_PATH);
  return {
    folders: existing?.folders?.length ? existing.folders : ["Inbox", "Contracts", "Research", "Compliance"],
    artifacts: existing?.artifacts ?? {},
  };
}

async function writeArtifactIndex(index: ArtifactIndex) {
  await mkdir(resolve(OUTPUTS_ROOT, "artifacts"), { recursive: true });
  await writeFile(ARTIFACT_INDEX_PATH, JSON.stringify(index, null, 2) + "\n", "utf8");
}

function inferArtifactKind(relativePath: string, name: string): ArtifactRecord["kind"] {
  if (name.includes(".provenance.")) return "provenance";
  if (relativePath.includes("/.drafts/")) return "draft";
  if (relativePath.includes("outputs/.plans/")) return "other";
  if (relativePath.includes("outputs/tasks/")) return "other";
  if (relativePath.includes("uploads/")) return "upload";
  if (name.endsWith(".md") || name.endsWith(".txt")) return "result";
  return "other";
}

function summarizeRpcEvent(event: any): string | undefined {
  if (event.type === "agent_start") return "Agent started";
  if (event.type === "agent_end") return "Agent finished";
  if (event.type === "turn_start") return "New reasoning turn";
  if (event.type === "turn_end") return "Turn completed";
  if (event.type === "tool_execution_start") return `Tool started: ${event.toolName ?? "unknown"}`;
  if (event.type === "tool_execution_end") return `Tool finished: ${event.toolName ?? "unknown"}`;
  if (event.type === "tool_execution_update") return `Tool running: ${event.toolName ?? "unknown"}`;
  if (event.type === "auto_retry_start") return `Retrying after error: ${event.errorMessage ?? "transient error"}`;
  if (event.type === "auto_retry_end") return event.success ? "Retry succeeded" : `Retry failed: ${event.finalError ?? "unknown error"}`;
  if (event.type === "extension_error") return `Extension error: ${event.error ?? "unknown"}`;
  if (event.type === "response" && event.success === false) return event.error ?? "Command failed";
  return undefined;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

async function readJsonl<T>(path: string): Promise<T[]> {
  try {
    const content = await readFile(path, "utf8");
    return content.split("\n").filter(Boolean).map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

class TaskManager {
  private tasks = new Map<string, RuntimeTask>();
  private emitter = new EventEmitter();

  async listTasks(): Promise<TaskRecord[]> {
    await mkdir(TASKS_ROOT, { recursive: true });
    const records: TaskRecord[] = [];
    const entries = await readdir(TASKS_ROOT, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const record = await this.getRecord(entry.name);
      if (record && !record.deletedAt && !record.archivedAt) records.push(record);
    }
    records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return records;
  }

  async getTask(taskId: string) {
    const record = await this.getRecord(taskId);
    if (!record) return null;
    const messages = await readJsonl<ChatMessage>(resolve(taskDir(taskId), "messages.jsonl"));
    const events = await readJsonl<any>(resolve(taskDir(taskId), "events.jsonl"));
    const liveLog = await this.readLiveLog(taskId);
    const artifacts = await this.collectTaskArtifacts(taskId);
    return { ...record, messages, events: events.slice(-200), liveLog, artifacts };
  }

  async listArtifacts(folder?: string): Promise<ArtifactRecord[]> {
    const index = await readArtifactIndex();
    const all = (await this.collectAllArtifacts(index)).filter((artifact) => artifact.kind === "result" && !artifact.isProvenance);
    return folder ? all.filter((artifact) => artifact.folder === folder) : all;
  }

  async listArtifactFolders(): Promise<string[]> {
    return (await readArtifactIndex()).folders;
  }

  async createArtifactFolder(name: string) {
    const folder = name.trim();
    if (!folder) throw new Error("Folder name is required.");
    const index = await readArtifactIndex();
    if (!index.folders.includes(folder)) index.folders.push(folder);
    await writeArtifactIndex(index);
    return index.folders;
  }

  async updateArtifact(id: string, update: { folder?: string; name?: string }) {
    const index = await readArtifactIndex();
    const relativePath = artifactPathFromId(id);
    assertInsideOutputs(relativePath);
    index.artifacts[id] = { ...index.artifacts[id] };
    if (update.folder !== undefined) {
      const folder = update.folder.trim() || "Inbox";
      if (!index.folders.includes(folder)) index.folders.push(folder);
      index.artifacts[id].folder = folder;
    }
    if (update.name !== undefined) index.artifacts[id].name = update.name.trim() || undefined;
    await writeArtifactIndex(index);
  }

  async deleteArtifact(id: string) {
    const index = await readArtifactIndex();
    const relativePath = artifactPathFromId(id);
    const full = assertInsideOutputs(relativePath);
    await rm(full, { force: true });
    index.artifacts[id] = { ...index.artifacts[id], deletedAt: now() };
    await writeArtifactIndex(index);
  }

  async createTask(input: CreateTaskInput) {
    if (!input.prompt?.trim()) throw new Error("Task prompt is required.");
    await mkdir(TASKS_ROOT, { recursive: true });
    const id = makeId();
    const createdAt = now();
    const record: TaskRecord = {
      id,
      title: input.title?.trim() || input.workflow || "Lex task",
      workflow: input.workflow,
      prompt: input.prompt,
      status: "queued",
      statusText: "Starting task...",
      createdAt,
      updatedAt: createdAt,
      unreadCount: 0,
    };
    await mkdir(taskDir(id), { recursive: true });
    const runtime: RuntimeTask = { record, lineBuffer: "" };
    this.tasks.set(id, runtime);
    await this.persistRecord(runtime);
    await this.addMessage(id, { id: makeId("msg"), role: "user", content: input.prompt, createdAt });
    await this.appendLog(id, `[${createdAt}] Created task\n$ ${input.prompt}\n`);
    this.startRuntime(runtime);
    return record;
  }

  async sendMessage(taskId: string, input: SendMessageInput) {
    const runtime = await this.ensureRuntime(taskId);
    const record = runtime.record;
    if (record.pendingPrompt) {
      const pending = record.pendingPrompt;
      const response: Record<string, unknown> = { type: "extension_ui_response", id: pending.id };
      if (input.cancelled) response.cancelled = true;
      else if (pending.method === "confirm") response.confirmed = Boolean(input.pendingResponse);
      else response.value = safeText(input.pendingResponse ?? input.message);
      this.writeRpc(runtime, response);
      await this.addMessage(taskId, {
        id: makeId("msg"),
        role: "user",
        content: input.cancelled ? "Cancelled prompt." : safeText(input.pendingResponse ?? input.message),
        createdAt: now(),
      });
      record.pendingPrompt = undefined;
      record.status = "running";
      record.statusText = "Continuing after your response...";
      record.unreadCount = 0;
      await this.persistRecord(runtime);
      return record;
    }

    const message = input.message?.trim();
    if (!message) throw new Error("Message is required.");
    await this.addMessage(taskId, { id: makeId("msg"), role: "user", content: message, createdAt: now() });
    this.writeRpc(runtime, { type: "prompt", message, streamingBehavior: record.status === "running" ? "steer" : undefined });
    record.status = "running";
    record.statusText = "Message sent to agent...";
    await this.persistRecord(runtime);
    return record;
  }

  async stopTask(taskId: string) {
    const runtime = this.tasks.get(taskId);
    if (runtime?.process) {
      runtime.process.kill("SIGTERM");
      runtime.record.status = "stopped";
      runtime.record.statusText = "Stopped by user.";
      await this.persistRecord(runtime);
    }
  }

  async archiveTask(taskId: string) {
    const runtime = this.tasks.get(taskId);
    const record = runtime?.record ?? await this.getRecord(taskId);
    if (!record) throw new Error("Task not found.");
    if (runtime?.process && !runtime.process.killed) runtime.process.kill("SIGTERM");
    record.archivedAt = now();
    record.status = record.status === "running" || record.status === "waiting_for_user" ? "stopped" : record.status;
    record.statusText = "Archived.";
    const targetRuntime = runtime ?? { record, lineBuffer: "" };
    await this.persistRecord(targetRuntime);
  }

  async deleteTask(taskId: string) {
    const runtime = this.tasks.get(taskId);
    if (runtime?.process && !runtime.process.killed) runtime.process.kill("SIGTERM");
    this.tasks.delete(taskId);
    await rm(taskDir(taskId), { recursive: true, force: true });
    this.emitter.emit("change");
  }

  subscribe(listener: () => void) {
    this.emitter.on("change", listener);
    return () => this.emitter.off("change", listener);
  }

  private async getRecord(taskId: string): Promise<TaskRecord | null> {
    const runtime = this.tasks.get(taskId);
    if (runtime) return runtime.record;
    return readJson<TaskRecord>(resolve(taskDir(taskId), "task.json"));
  }

  private async ensureRuntime(taskId: string): Promise<RuntimeTask> {
    const runtime = this.tasks.get(taskId);
    if (runtime?.process && !runtime.process.killed) return runtime;
    const record = await this.getRecord(taskId);
    if (!record) throw new Error("Task not found.");
    if (record.status === "done" || record.status === "error" || record.status === "stopped") {
      throw new Error("Task is not running.");
    }
    throw new Error("Task process is not available after server restart. Create a new task or resume support can be added next.");
  }

  private startRuntime(runtime: RuntimeTask) {
    const dir = taskDir(runtime.record.id);
    const args = [
      LEX_BIN,
      "--mode",
      "rpc",
      "--cwd",
      PROJECT_ROOT,
      "--session-dir",
      resolve(dir, "sessions"),
    ];
    runtime.process = spawn("node", args, {
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        LEX_MATTER_ID: runtime.record.id,
        LEX_WORKSPACE_ROOT: PROJECT_ROOT,
      },
    });

    runtime.record.status = "running";
    runtime.record.statusText = "RPC agent starting...";
    void this.persistRecord(runtime);

    runtime.process.stdout.on("data", (chunk) => this.handleStdout(runtime, chunk.toString()));
    runtime.process.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      void this.appendLog(runtime.record.id, text);
      runtime.record.statusText = text.trim().slice(-300) || runtime.record.statusText;
      void this.persistRecord(runtime);
    });
    runtime.process.on("error", (error) => {
      runtime.record.status = "error";
      runtime.record.statusText = error.message;
      void this.appendLog(runtime.record.id, `\n[${now()}] Process error: ${error.message}\n`);
      void this.persistRecord(runtime);
    });
    runtime.process.on("exit", (code, signal) => {
      if (runtime.record.status !== "stopped") {
        runtime.record.status = code === 0 ? "done" : "error";
      }
      runtime.record.exitCode = code;
      runtime.record.signal = signal;
      runtime.record.statusText = signal ? `Agent exited with ${signal}` : `Agent exited with code ${code ?? "unknown"}`;
      void this.appendLog(runtime.record.id, `\n[${now()}] ${runtime.record.statusText}\n`);
      void this.persistRecord(runtime);
    });

    setTimeout(() => {
      this.writeRpc(runtime, { type: "prompt", message: runtime.record.prompt });
    }, 250);
  }

  private handleStdout(runtime: RuntimeTask, chunk: string) {
    runtime.lineBuffer += chunk;
    let newlineIndex = runtime.lineBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = runtime.lineBuffer.slice(0, newlineIndex).replace(/\r$/, "");
      runtime.lineBuffer = runtime.lineBuffer.slice(newlineIndex + 1);
      if (line.trim()) void this.handleRpcLine(runtime, line);
      newlineIndex = runtime.lineBuffer.indexOf("\n");
    }
  }

  private async handleRpcLine(runtime: RuntimeTask, line: string) {
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      await this.appendLog(runtime.record.id, `${line}\n`);
      return;
    }
    await appendFile(resolve(taskDir(runtime.record.id), "events.jsonl"), jsonLine(event), "utf8");
    await this.appendLog(runtime.record.id, `[event] ${event.type}\n`);

    if (event.type === "message_update") {
      const delta = event.assistantMessageEvent?.delta;
      if (typeof delta === "string") await this.appendAssistantDelta(runtime, delta);
    } else if (event.type === "message_end") {
      runtime.currentAssistantId = undefined;
    } else if (event.type === "extension_ui_request") {
      await this.handleUiRequest(runtime, event);
    } else if (event.type === "agent_start") {
      runtime.record.status = "running";
      runtime.record.statusText = "Agent is working...";
    } else if (event.type === "agent_end") {
      runtime.record.status = "done";
      runtime.record.statusText = "Agent finished.";
    }

    const summary = summarizeRpcEvent(event);
    if (summary && runtime.record.status !== "waiting_for_user") runtime.record.statusText = summary;
    await this.persistRecord(runtime);
  }

  private async handleUiRequest(runtime: RuntimeTask, event: any) {
    if (["input", "confirm", "select", "editor"].includes(event.method)) {
      runtime.record.status = "waiting_for_user";
      runtime.record.statusText = event.title || event.message || "Agent needs your response.";
      runtime.record.pendingPrompt = {
        id: event.id,
        method: event.method,
        title: event.title,
        message: event.message,
        placeholder: event.placeholder,
        prefill: event.prefill,
        options: event.options,
      };
      runtime.record.unreadCount += 1;
      await this.addMessage(runtime.record.id, {
        id: makeId("msg"),
        role: "assistant",
        content: `Needs your response: ${runtime.record.statusText}`,
        createdAt: now(),
      });
    } else if (event.method === "notify") {
      await this.addMessage(runtime.record.id, {
        id: makeId("msg"),
        role: "system",
        content: event.message ?? "Notification",
        createdAt: now(),
      });
    } else if (event.method === "setStatus") {
      runtime.record.statusText = event.statusText ?? runtime.record.statusText;
    }
  }

  private writeRpc(runtime: RuntimeTask, command: Record<string, unknown>) {
    if (!runtime.process?.stdin.writable) throw new Error("Task process is not writable.");
    runtime.process.stdin.write(jsonLine({ id: makeId("req"), ...command }));
  }

  private async addMessage(taskId: string, message: ChatMessage) {
    await appendFile(resolve(taskDir(taskId), "messages.jsonl"), jsonLine(message), "utf8");
    this.emitter.emit("change");
  }

  private async appendAssistantDelta(runtime: RuntimeTask, delta: string) {
    const messagesPath = resolve(taskDir(runtime.record.id), "messages.jsonl");
    const messages = await readJsonl<ChatMessage>(messagesPath);
    let current = runtime.currentAssistantId ? messages.find((message) => message.id === runtime.currentAssistantId) : undefined;
    if (!current) {
      current = { id: makeId("msg"), role: "assistant", content: "", createdAt: now() };
      messages.push(current);
      runtime.currentAssistantId = current.id;
    }
    current.content += delta;
    await writeFile(messagesPath, messages.map(jsonLine).join(""), "utf8");
    runtime.record.statusText = "Assistant is responding...";
    this.emitter.emit("change");
  }

  private async persistRecord(runtime: RuntimeTask) {
    runtime.record.updatedAt = now();
    await mkdir(taskDir(runtime.record.id), { recursive: true });
    await writeFile(resolve(taskDir(runtime.record.id), "task.json"), JSON.stringify(runtime.record, null, 2) + "\n", "utf8");
    this.emitter.emit("change");
  }

  private async appendLog(taskId: string, text: string) {
    await appendFile(resolve(taskDir(taskId), "live.log"), text, "utf8").catch(() => undefined);
    this.emitter.emit("change");
  }

  private async readLiveLog(taskId: string) {
    try {
      const content = await readFile(resolve(taskDir(taskId), "live.log"), "utf8");
      return content.slice(-24000);
    } catch {
      return "";
    }
  }

  private async collectTaskArtifacts(taskId: string) {
    const all = await this.collectAllArtifacts(await readArtifactIndex());
    const record = await this.getRecord(taskId);
    const startedAt = record ? Date.parse(record.createdAt) : 0;
    return all
      .filter((artifact) => artifact.taskId === taskId || (startedAt > 0 && artifact.mtime >= startedAt))
      .filter((artifact) => artifact.kind === "result" && !artifact.isProvenance)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 30);
  }

  private async collectAllArtifacts(index: ArtifactIndex) {
    const artifacts: ArtifactRecord[] = [];
    const records = await this.loadTaskRecordsForArtifacts();
    if (!existsSync(OUTPUTS_ROOT)) return artifacts;
    const walk = async (dir: string) => {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { await walk(full); continue; }
        if (!entry.name.endsWith(".md") && !entry.name.endsWith(".txt")) continue;
        const relativePath = full.replace(`${PROJECT_ROOT}/`, "");
        const id = artifactId(relativePath);
        if (index.artifacts[id]?.deletedAt) continue;
        const info = await stat(full).catch(() => null);
        const content = await readFile(full, "utf8").catch(() => "");
        const taskId = this.inferTaskId(relativePath);
        artifacts.push({
          id,
          name: index.artifacts[id]?.name ?? entry.name,
          path: relativePath,
          taskId,
          taskTitle: taskId ? records.get(taskId)?.title : undefined,
          folder: index.artifacts[id]?.folder ?? "Inbox",
          kind: inferArtifactKind(relativePath, entry.name),
          content,
          mtime: info?.mtimeMs ?? 0,
          size: info?.size ?? 0,
          isProvenance: entry.name.includes(".provenance."),
        });
      }
    };
    await walk(OUTPUTS_ROOT);
    return artifacts.sort((a, b) => b.mtime - a.mtime);
  }

  private inferTaskId(relativePath: string) {
    const matterMatch = relativePath.match(/^outputs\/matters\/([^/]+)/);
    if (matterMatch) return matterMatch[1];
    const taskMatch = relativePath.match(/^outputs\/tasks\/([^/]+)/);
    if (taskMatch) return taskMatch[1];
    for (const taskId of this.tasks.keys()) {
      if (relativePath.includes(taskId)) return taskId;
    }
    return undefined;
  }

  private async loadTaskRecordsForArtifacts() {
    const records = new Map<string, TaskRecord>();
    const entries = await readdir(TASKS_ROOT, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const record = await this.getRecord(entry.name);
      if (record) records.set(record.id, record);
    }
    return records;
  }
}

const globalForTasks = globalThis as typeof globalThis & { __lexTaskManager?: TaskManager };

export function getTaskManager() {
  globalForTasks.__lexTaskManager ??= new TaskManager();
  return globalForTasks.__lexTaskManager;
}
