import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const PROJECT_ROOT = resolve(process.env.LEX_WORKSPACE_ROOT ?? resolve(process.cwd(), ".."));
const LEX_BIN = resolve(process.env.LEX_APP_ROOT ?? resolve(process.cwd(), ".."), "bin", "lex.js");

export async function POST(req: NextRequest) {
  const { prompt, matterId } = await req.json() as { prompt: string; matterId: string };

  if (!prompt || !matterId) {
    return NextResponse.json({ error: "Missing prompt or matterId" }, { status: 400 });
  }

  // Create matter output directory
  const matterDir = resolve(PROJECT_ROOT, "outputs", "matters", matterId);
  const taskPath = resolve(matterDir, "task.json");
  const logPath = resolve(matterDir, "live.log");
  const startedAt = new Date().toISOString();
  await mkdir(matterDir, { recursive: true });

  // Write a task spec file for traceability
  await writeFile(
    taskPath,
    JSON.stringify({ prompt, matterId, startedAt, status: "running" }, null, 2) + "\n",
    "utf8",
  );
  await writeFile(logPath, `[${startedAt}] Starting Lex workflow\n$ ${prompt}\n\n`, "utf8");

  // Keep stdout/stderr so the web UI can show real-time agent activity.
  const child = spawn("node", [LEX_BIN, "--prompt", prompt, "--cwd", PROJECT_ROOT], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      LEX_MATTER_ID: matterId,
      LEX_WORKSPACE_ROOT: PROJECT_ROOT,
    },
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    void appendFile(logPath, chunk.toString(), "utf8");
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    void appendFile(logPath, chunk.toString(), "utf8");
  });
  child.on("error", (error) => {
    void appendFile(logPath, `\n[${new Date().toISOString()}] Failed to start: ${error.message}\n`, "utf8");
    void writeFile(taskPath, JSON.stringify({ prompt, matterId, startedAt, finishedAt: new Date().toISOString(), status: "error", error: error.message }, null, 2) + "\n", "utf8");
  });
  child.on("exit", (code, signal) => {
    const status = code === 0 ? "done" : "error";
    const finishedAt = new Date().toISOString();
    const suffix = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
    void appendFile(logPath, `\n[${finishedAt}] Lex workflow finished: ${suffix}\n`, "utf8");
    void writeFile(taskPath, JSON.stringify({ prompt, matterId, startedAt, finishedAt, status, exitCode: code, signal }, null, 2) + "\n", "utf8");
  });

  return NextResponse.json({ matterId, status: "running" });
}
