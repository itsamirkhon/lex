import { mkdir, writeFile } from "node:fs/promises";
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
  await mkdir(matterDir, { recursive: true });

  // Write a task spec file for traceability
  await writeFile(
    resolve(matterDir, "task.json"),
    JSON.stringify({ prompt, matterId, startedAt: new Date().toISOString(), status: "running" }),
    "utf8",
  );

  // Spawn lex CLI as a background process
  const child = spawn("node", [LEX_BIN, "--prompt", prompt, "--cwd", PROJECT_ROOT], {
    detached: true,
    stdio: "ignore",
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      LEX_MATTER_ID: matterId,
      LEX_WORKSPACE_ROOT: PROJECT_ROOT,
    },
  });
  child.unref();

  return NextResponse.json({ matterId, status: "running" });
}
