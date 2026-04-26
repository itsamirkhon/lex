"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

const WORKFLOWS = [
  { id: "contract-review", label: "Contract Review", command: "/contract-review", description: "Review clauses, risk, redlines, and BMW policy deviations.", placeholder: "Review the uploaded NDA for supplier-side risk and unusual liability language." },
  { id: "compliance-check", label: "Compliance Check", command: "/compliance-check", description: "Screen sanctions, ESG, GDPR, and supply-chain obligations.", placeholder: "Check Acme GmbH for sanctions and supply-chain compliance concerns." },
  { id: "legal-research", label: "Legal Research", command: "/legal-research", description: "Produce a source-grounded memo with jurisdiction notes.", placeholder: "Research enforceability of force majeure clauses in German supplier contracts." },
  { id: "risk-assessment", label: "Risk Assessment", command: "/risk-assessment", description: "Summarize severity, impact, mitigations, and next actions.", placeholder: "Assess legal and operational risk in the uploaded supplier agreement." },
  { id: "contract-draft", label: "Contract Draft", command: "/contract-draft", description: "Draft from BMW templates and business context.", placeholder: "Draft a supplier NDA for Acme GmbH with German jurisdiction." },
];

const JURISDICTIONS = ["de", "uk", "us", "fr", "all"];

type TaskStatus = "queued" | "running" | "waiting_for_user" | "done" | "error" | "stopped";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

type PendingPrompt = {
  id: string;
  method: "input" | "confirm" | "select" | "editor";
  title?: string;
  message?: string;
  placeholder?: string;
  prefill?: string;
  options?: string[];
};

type Artifact = {
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

type TaskSummary = {
  id: string;
  title: string;
  workflow?: string;
  prompt: string;
  status: TaskStatus;
  statusText: string;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  pendingPrompt?: PendingPrompt;
};

type TaskDetails = TaskSummary & {
  messages: ChatMessage[];
  liveLog: string;
  artifacts: Artifact[];
};

function makePrompt(workflow: (typeof WORKFLOWS)[number], details: string, jurisdiction: string) {
  const question = details.trim();
  return [
    `Run the ${workflow.label} legal workflow (${workflow.command}).`,
    question ? `User request: ${question}` : "User request: not provided.",
    `Jurisdiction: ${jurisdiction}.`,
    "Use the available Lex legal agents, write outputs under outputs/, and ask a clarifying question only if required information is genuinely missing.",
  ].join("\n");
}

function statusLabel(status: TaskStatus) {
  if (status === "waiting_for_user") return "needs response";
  return status.replaceAll("_", " ");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error ?? `Request failed: ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data as T;
}

function getErrorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error ? (error as { status?: number }).status : undefined;
}

export default function Home() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskDetails | null>(null);
  const [workflowId, setWorkflowId] = useState(WORKFLOWS[0].id);
  const [jurisdiction, setJurisdiction] = useState("de");
  const [details, setDetails] = useState(WORKFLOWS[0].placeholder);
  const [message, setMessage] = useState("");
  const [pendingResponse, setPendingResponse] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("All");
  const [artifactSearch, setArtifactSearch] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ path: string; filename: string } | null>(null);
  const [chatUpload, setChatUpload] = useState<{ path: string; filename: string } | null>(null);
  const [viewMode, setViewMode] = useState<"tasks" | "artifacts">("tasks");
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const workflow = WORKFLOWS.find((item) => item.id === workflowId) ?? WORKFLOWS[0];
  const generatedPrompt = makePrompt(workflow, details, jurisdiction);
  const taskPrompt = uploadedFile ? `${generatedPrompt}\nAttached file: ${uploadedFile.path}. Read this file before analysis.` : generatedPrompt;
  const needsResponse = tasks.filter((task) => task.status === "waiting_for_user");
  const runningCount = tasks.filter((task) => task.status === "running" || task.status === "queued").length;
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const visibleArtifacts = useMemo(() => selectedTask?.artifacts?.filter((artifact) => !artifact.isProvenance) ?? [], [selectedTask]);
  const taskResultArtifact = useMemo(() => visibleArtifacts.find((artifact) => artifact.kind === "result") ?? visibleArtifacts[0] ?? null, [visibleArtifacts]);
  const filteredArtifacts = useMemo(() => {
    const query = artifactSearch.trim().toLowerCase();
    return artifacts.filter((artifact) => {
      const folderMatch = selectedFolder === "All" || artifact.folder === selectedFolder;
      const queryMatch = !query || artifact.name.toLowerCase().includes(query) || artifact.path.toLowerCase().includes(query) || artifact.taskTitle?.toLowerCase().includes(query);
      return folderMatch && queryMatch;
    });
  }, [artifacts, artifactSearch, selectedFolder]);
  const selectedArtifact = useMemo(() => artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? filteredArtifacts[0] ?? null, [artifacts, filteredArtifacts, selectedArtifactId]);
  const liveLog = selectedTask?.liveLog?.trim() ?? "";

  async function refreshTasks() {
    try {
      const data = await fetchJson<{ tasks: TaskSummary[] }>("/api/tasks");
      setTasks(data.tasks);
      if (!selectedTaskId && data.tasks[0]) setSelectedTaskId(data.tasks[0].id);
      if (selectedTaskId && !data.tasks.some((task) => task.id === selectedTaskId) && !selectedTask) {
        setSelectedTaskId(data.tasks[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshTask(taskId: string) {
    try {
      const data = await fetchJson<{ task: TaskDetails }>(`/api/tasks/${taskId}`);
      setSelectedTask(data.task);
      void refreshArtifacts();
    } catch (err) {
      if (getErrorStatus(err) === 404) {
        setSelectedTask(null);
        setSelectedTaskId(null);
        await refreshTasks();
        return;
      }
      throw err;
    }
  }

  async function refreshArtifacts() {
    const [artifactData, folderData] = await Promise.all([
      fetchJson<{ artifacts: Artifact[] }>("/api/artifacts"),
      fetchJson<{ folders: string[] }>("/api/artifact-folders"),
    ]);
    setArtifacts(artifactData.artifacts);
    setFolders(folderData.folders);
  }

  async function createTask() {
    setError(null);
    try {
      const data = await fetchJson<{ task: TaskSummary }>("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: workflow.label, workflow: workflow.id, prompt: taskPrompt }),
      });
      setSelectedTaskId(data.task.id);
      await refreshTasks();
      await refreshTask(data.task.id);
      await refreshArtifacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function sendMessage(responseOverride?: string | boolean) {
    if (!selectedTask) return;
    const pending = selectedTask.pendingPrompt;
    const rawText = pending ? String(responseOverride ?? pendingResponse).trim() : message.trim();
    const text = !pending && chatUpload ? `${rawText}\nAttached file: ${chatUpload.path}. Read this file before responding.` : rawText;
    if (!text && pending?.method !== "confirm") return;
    setError(null);
    try {
      await fetchJson(`/api/tasks/${selectedTask.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending ? { pendingResponse: pending.method === "confirm" ? Boolean(responseOverride) : text } : { message: text }),
      });
      setMessage("");
      setPendingResponse("");
      setChatUpload(null);
      await refreshTask(selectedTask.id);
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function uploadFile(file: File, target: "task" | "chat") {
    const form = new FormData();
    form.append("file", file);
    const data = await fetchJson<{ path: string; filename: string }>("/api/upload", { method: "POST", body: form });
    if (target === "task") setUploadedFile(data);
    else setChatUpload(data);
    await refreshArtifacts();
  }

  async function stopTask(taskId: string) {
    await fetchJson(`/api/tasks/${taskId}/stop`, { method: "POST" });
    await refreshTask(taskId).catch(() => undefined);
    await refreshTasks();
  }

  async function archiveTask(taskId: string) {
    await fetchJson(`/api/tasks/${taskId}/archive`, { method: "POST" });
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
      setSelectedTask(null);
    }
    await refreshTasks();
    await refreshArtifacts();
  }

  async function deleteTask(taskId: string) {
    if (!confirm("Delete this task chat? Artifacts already saved elsewhere in outputs are kept.")) return;
    await fetchJson(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
      setSelectedTask(null);
    }
    await refreshTasks();
    await refreshArtifacts();
  }

  async function moveArtifact(artifactId: string, folder: string) {
    await fetchJson(`/api/artifacts/${artifactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
    });
    await refreshArtifacts();
  }

  async function deleteArtifact(artifactId: string) {
    if (!confirm("Delete this artifact file from outputs?")) return;
    await fetchJson(`/api/artifacts/${artifactId}`, { method: "DELETE" });
    if (selectedArtifactId === artifactId) setSelectedArtifactId(null);
    await refreshArtifacts();
    if (selectedTaskId) await refreshTask(selectedTaskId).catch(() => undefined);
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    await fetchJson("/api/artifact-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewFolderName("");
    setSelectedFolder(name);
    await refreshArtifacts();
  }

  useEffect(() => {
    void refreshTasks();
    void refreshArtifacts();
    const timer = setInterval(() => { void refreshTasks(); }, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedTaskId) return;
    void refreshTask(selectedTaskId).catch((err) => setError(err instanceof Error ? err.message : String(err)));
    const events = new EventSource(`/api/tasks/${selectedTaskId}/events`);
    events.onmessage = (event) => {
      const data = JSON.parse(event.data) as { task: TaskDetails | null };
      if (data.task) setSelectedTask(data.task);
      void refreshTasks();
    };
    events.onerror = () => {
      events.close();
      void refreshTask(selectedTaskId).catch((err) => {
        if (getErrorStatus(err) !== 404) setError(err instanceof Error ? err.message : String(err));
      });
    };
    return () => events.close();
  }, [selectedTaskId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [selectedTask?.messages.length, selectedTask?.statusText]);

  useEffect(() => {
    if (needsResponse.length > 0 && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    if (needsResponse.length > 0 && "Notification" in window && Notification.permission === "granted") {
      const task = needsResponse[0];
      new Notification("Lex needs your response", { body: `${task.title}: ${task.statusText}` });
    }
  }, [needsResponse.length]);

  return (
    <main className="task-dashboard">
      <aside className="task-sidebar">
        <div className="brand-block">
          <span className="mark-symbol">L</span>
          <div><strong>Lex</strong><small>Legal task workspace</small></div>
        </div>

        <div className="metric-grid">
          <div><strong>{runningCount}</strong><span>running</span></div>
          <div><strong>{needsResponse.length}</strong><span>need you</span></div>
          <div><strong>{doneCount}</strong><span>done</span></div>
        </div>

        <button className={`artifact-nav-button ${viewMode === "artifacts" ? "active" : ""}`} onClick={() => setViewMode("artifacts")}>
          <strong>Artifacts</strong>
          <span>{artifacts.length} files across {folders.length} folders</span>
        </button>

        {needsResponse.length > 0 && (
          <section className="needs-panel">
            <span className="sidebar-title">Needs Your Response</span>
            {needsResponse.map((task) => (
              <button key={task.id} className="needs-button" onClick={() => setSelectedTaskId(task.id)}>
                <strong>{task.title}</strong>
                <span>{task.statusText}</span>
              </button>
            ))}
          </section>
        )}

        <section className="task-list-panel">
          <span className="sidebar-title">Tasks</span>
          {tasks.map((task) => (
            <div key={task.id} className={`task-list-item ${selectedTaskId === task.id ? "active" : ""}`}>
              <button className="task-list-main" onClick={() => { setSelectedTaskId(task.id); setViewMode("tasks"); }}>
                <strong>{task.title}</strong>
                <span>{task.statusText}</span>
                <em className={`status-pill ${task.status}`}>{statusLabel(task.status)}</em>
              </button>
              <div className="task-list-actions">
                <button onClick={() => void archiveTask(task.id)}>Archive</button>
                <button className="danger" onClick={() => void deleteTask(task.id)}>Delete</button>
              </div>
            </div>
          ))}
          {tasks.length === 0 && <p className="muted-copy">No tasks yet. Create one from a workflow template.</p>}
        </section>
      </aside>

      <section className="task-main">
        {viewMode === "artifacts" ? (
          <div className="artifact-workspace">
            <header className="artifact-workspace-header">
              <div>
                <span className="eyebrow">Artifact Library</span>
                <h1>Folders and artifacts</h1>
                <p>Open, organize, move, and delete legal outputs across all tasks.</p>
              </div>
              <button className="secondary-action small" onClick={() => setViewMode("tasks")}>Back to tasks</button>
            </header>

            <div className="artifact-browser">
              <aside className="folder-column">
                <button className={selectedFolder === "All" ? "active" : ""} onClick={() => setSelectedFolder("All")}>All artifacts <span>{artifacts.length}</span></button>
                {folders.map((folder) => (
                  <button key={folder} className={selectedFolder === folder ? "active" : ""} onClick={() => setSelectedFolder(folder)}>
                    {folder} <span>{artifacts.filter((artifact) => artifact.folder === folder).length}</span>
                  </button>
                ))}
                <div className="folder-create-inline">
                  <input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="New folder" />
                  <button onClick={() => void createFolder()}>Add</button>
                </div>
              </aside>

              <section className="artifact-table-panel">
                <div className="artifact-table-toolbar">
                  <input value={artifactSearch} onChange={(event) => setArtifactSearch(event.target.value)} placeholder="Search by file, task, or path" />
                  <span>{filteredArtifacts.length} shown</span>
                </div>
                <div className="artifact-table">
                  <div className="artifact-row artifact-row-head">
                    <span>Name</span>
                    <span>Folder</span>
                    <span>Task</span>
                    <span>Updated</span>
                  </div>
                  {filteredArtifacts.map((artifact) => (
                    <button key={artifact.id} className={`artifact-row ${selectedArtifact?.id === artifact.id ? "active" : ""}`} onClick={() => setSelectedArtifactId(artifact.id)}>
                      <span><strong>{artifact.name}</strong><small>{artifact.path}</small></span>
                      <span>{artifact.folder}</span>
                      <span>{artifact.taskTitle ?? artifact.taskId ?? "General"}</span>
                      <span>{new Date(artifact.mtime).toLocaleDateString()}</span>
                    </button>
                  ))}
                  {filteredArtifacts.length === 0 && <p className="muted-copy">No artifacts match this folder/search.</p>}
                </div>
              </section>

              <aside className="artifact-preview-panel">
                {selectedArtifact ? (
                  <>
                    <div className="section-heading compact"><span>{selectedArtifact.name}</span><small>{selectedArtifact.kind}</small></div>
                    <div className="artifact-meta-grid">
                      <div><span>Folder</span><strong>{selectedArtifact.folder}</strong></div>
                      <div><span>Task</span><strong>{selectedArtifact.taskTitle ?? selectedArtifact.taskId ?? "General"}</strong></div>
                      <div><span>Path</span><strong>{selectedArtifact.path}</strong></div>
                    </div>
                    <div className="artifact-preview-actions">
                      <select value={selectedArtifact.folder} onChange={(event) => void moveArtifact(selectedArtifact.id, event.target.value)}>
                        {folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
                      </select>
                      <button className="secondary-action small danger" onClick={() => void deleteArtifact(selectedArtifact.id)}>Delete</button>
                    </div>
                    <div className="markdown-body compact artifact-preview-body">
                      <ReactMarkdown>{selectedArtifact.content}</ReactMarkdown>
                    </div>
                  </>
                ) : <p className="muted-copy">Select an artifact to preview it.</p>}
              </aside>
            </div>
          </div>
        ) : (
        <>
        <div className="task-creator">
          <div className="section-heading">
            <span>Create Task</span>
            <small>Each task is a separate AI chat with shared Lex memory</small>
          </div>
          <div className="workflow-tabs">
            {WORKFLOWS.map((item) => (
              <button key={item.id} className={item.id === workflow.id ? "active" : ""} onClick={() => { setWorkflowId(item.id); setDetails(item.placeholder); }}>
                {item.label}
              </button>
            ))}
          </div>
          <textarea className="matter-textarea compact" value={details} onChange={(event) => setDetails(event.target.value)} />
          <div className="creator-row">
            <select value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)}>
              {JURISDICTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <code>{taskPrompt}</code>
            <button className="primary-action" onClick={createTask}>Create task</button>
          </div>
          <label className="task-file-upload">
            <input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file, "task"); }} />
            <span>{uploadedFile ? `Attached: ${uploadedFile.filename}` : "Attach file to new task"}</span>
          </label>
          {error && <div className="error-banner">{error}</div>}
        </div>

        <div className="chat-panel">
          {selectedTask ? (
            <>
              <header className="chat-header">
                <div>
                  <span className="eyebrow">{selectedTask.workflow ?? "task"}</span>
                  <h1>{selectedTask.title}</h1>
                  <p>{selectedTask.statusText}</p>
                </div>
                <div className="chat-actions">
                  <span className={`status-pill ${selectedTask.status}`}>{statusLabel(selectedTask.status)}</span>
                  {(selectedTask.status === "running" || selectedTask.status === "waiting_for_user") && <button className="secondary-action small" onClick={() => stopTask(selectedTask.id)}>Stop</button>}
                  <button className="secondary-action small" onClick={() => void archiveTask(selectedTask.id)}>Archive</button>
                  <button className="secondary-action small danger" onClick={() => void deleteTask(selectedTask.id)}>Delete</button>
                </div>
              </header>

              <div className="message-list">
                {selectedTask.messages.map((chatMessage) => (
                  <article key={chatMessage.id} className={`chat-message ${chatMessage.role}`}>
                    <span>{chatMessage.role}</span>
                    <ReactMarkdown>{chatMessage.content}</ReactMarkdown>
                  </article>
                ))}
                {selectedTask.pendingPrompt && (
                  <article className="chat-message pending">
                    <span>agent needs input</span>
                    <h3>{selectedTask.pendingPrompt.title ?? "Response needed"}</h3>
                    <p>{selectedTask.pendingPrompt.message ?? selectedTask.pendingPrompt.placeholder ?? "Provide a response to continue."}</p>
                  </article>
                )}
                {liveLog && (
                  <article className="chat-message activity">
                    <span>live activity</span>
                    <pre>{liveLog}</pre>
                  </article>
                )}
                {taskResultArtifact && (
                  <article className="chat-message artifact-summary">
                    <span>task result</span>
                    <h3>{taskResultArtifact.name}</h3>
                    <div className="inline-artifacts">
                      <details className="inline-artifact" open>
                        <summary>
                          <strong>{taskResultArtifact.path}</strong>
                          <small>{new Date(taskResultArtifact.mtime).toLocaleString()}</small>
                        </summary>
                        <div className="markdown-body compact inline">
                          <ReactMarkdown>{taskResultArtifact.content}</ReactMarkdown>
                        </div>
                      </details>
                    </div>
                  </article>
                )}
                <div ref={messageEndRef} />
              </div>

              <footer className="chat-composer">
                {selectedTask.pendingPrompt?.method === "confirm" ? (
                  <div className="confirm-row">
                    <button className="primary-action" onClick={() => void sendMessage(true)}>Yes</button>
                    <button className="secondary-action" onClick={() => void sendMessage(false)}>No</button>
                  </div>
                ) : selectedTask.pendingPrompt?.method === "select" ? (
                  <div className="creator-row">
                    <select value={pendingResponse} onChange={(event) => setPendingResponse(event.target.value)}>
                      <option value="">Choose...</option>
                      {selectedTask.pendingPrompt.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <button className="primary-action" onClick={() => void sendMessage()}>Send response</button>
                  </div>
                ) : selectedTask.pendingPrompt ? (
                  <>
                    <textarea value={pendingResponse} onChange={(event) => setPendingResponse(event.target.value)} placeholder={selectedTask.pendingPrompt.placeholder ?? "Answer the agent..."} />
                    <button className="primary-action" onClick={() => void sendMessage()}>Send response</button>
                  </>
                ) : (
                  <>
                    <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message this task..." />
                    <div className="chat-send-stack">
                      <label className="chat-file-button">
                        <input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file, "chat"); }} />
                        {chatUpload ? chatUpload.filename : "Attach"}
                      </label>
                      <button className="primary-action" onClick={() => void sendMessage()}>Send</button>
                    </div>
                  </>
                )}
              </footer>
            </>
          ) : (
            <div className="welcome-results"><h3>No task selected</h3><p>Create a task to start a dedicated AI chat.</p></div>
          )}
        </div>
        </>
        )}
      </section>

      <aside className="task-inspector">
        <section className="artifact-panel">
          <div className="section-heading compact"><span>Task Overview</span><small>{selectedTask?.status ? statusLabel(selectedTask.status) : "idle"}</small></div>
          {selectedTask ? (
            <div className="task-overview-list">
              <div><span>Status</span><strong>{statusLabel(selectedTask.status)}</strong></div>
              <div><span>Updated</span><strong>{new Date(selectedTask.updatedAt).toLocaleString()}</strong></div>
              <div><span>Messages</span><strong>{selectedTask.messages.length}</strong></div>
              <div><span>Artifacts</span><strong>{visibleArtifacts.length}</strong></div>
              <div><span>Memory</span><strong>Shared Lex memory</strong></div>
            </div>
          ) : <p className="muted-copy">Select a task to see status and metadata.</p>}
        </section>
        <section className="artifact-panel artifact-library">
          <div className="section-heading compact"><span>Artifacts</span><small>{filteredArtifacts.length}</small></div>
          <div className="artifact-controls">
            <select value={selectedFolder} onChange={(event) => setSelectedFolder(event.target.value)}>
              <option value="All">All folders</option>
              {folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
            </select>
            <input value={artifactSearch} onChange={(event) => setArtifactSearch(event.target.value)} placeholder="Search artifacts" />
          </div>
          <div className="artifact-controls">
            <input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="New folder" />
            <button className="secondary-action small" onClick={() => void createFolder()}>Add</button>
          </div>
          <div className="artifact-library-list">
            {filteredArtifacts.map((artifact) => (
              <article key={artifact.id} className="artifact-library-item">
                <div>
                  <strong>{artifact.name}</strong>
                  <span>{artifact.taskTitle ?? artifact.taskId ?? "General output"}</span>
                  <small>{artifact.folder} / {artifact.kind}</small>
                </div>
                <select value={artifact.folder} onChange={(event) => void moveArtifact(artifact.id, event.target.value)}>
                  {folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
                </select>
                <button className="secondary-action small danger" onClick={() => void deleteArtifact(artifact.id)}>Delete</button>
              </article>
            ))}
            {filteredArtifacts.length === 0 && <p className="muted-copy">No artifacts in this folder yet.</p>}
          </div>
        </section>
      </aside>
    </main>
  );
}
