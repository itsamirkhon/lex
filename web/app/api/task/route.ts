import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const PROJECT_ROOT = resolve(process.cwd(), "..");

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
  const lexBin = resolve(PROJECT_ROOT, "bin", "lex.js");
  const child = spawn("node", [lexBin, "--prompt", prompt, "--cwd", PROJECT_ROOT], {
    detached: true,
    stdio: "ignore",
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      LEX_MATTER_ID: matterId,
    },
  });
  child.unref();

  return NextResponse.json({ matterId, status: "running" });
}
