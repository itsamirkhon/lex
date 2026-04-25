import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const PROJECT_ROOT = resolve(process.env.LEX_WORKSPACE_ROOT ?? resolve(process.cwd(), ".."));

async function pathExists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

async function collectArtifacts(matterDir: string) {
  const artifacts: { name: string; path: string; content: string; mtime: number; isProvenance: boolean }[] = [];
  if (!(await pathExists(matterDir))) return artifacts;

  const walk = async (dir: string) => {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isDirectory()) { await walk(join(dir, entry.name)); continue; }
      if (!entry.name.endsWith(".md") && !entry.name.endsWith(".txt")) continue;
      if (entry.name === "task.json") continue;
      const full = join(dir, entry.name);
      const info = await stat(full).catch(() => null);
      const content = await readFile(full, "utf8").catch(() => "");
      artifacts.push({
        name: entry.name,
        path: full.replace(PROJECT_ROOT + "/", ""),
        content,
        mtime: info?.mtimeMs ?? 0,
        isProvenance: entry.name.includes(".provenance."),
      });
    }
  };

  await walk(matterDir);
  artifacts.sort((a, b) => b.mtime - a.mtime);
  return artifacts;
}

export async function GET(req: NextRequest) {
  const matterId = req.nextUrl.searchParams.get("matterId");
  if (!matterId) return NextResponse.json({ error: "Missing matterId" }, { status: 400 });

  const matterDir = resolve(PROJECT_ROOT, "outputs", "matters", matterId);
  const artifacts = await collectArtifacts(matterDir);

  // Check task spec to determine status
  let taskStatus = "running";
  let statusText = "Agents are processing your request...";
  try {
    const taskSpec = JSON.parse(
      await readFile(resolve(matterDir, "task.json"), "utf8"),
    ) as { status?: string };
    if (taskSpec.status) taskStatus = taskSpec.status;
  } catch {}

  const mainArtifacts = artifacts.filter((a) => !a.isProvenance && !a.path.includes("/.plans/") && !a.path.includes("/.drafts/"));
  const draftArtifacts = artifacts.filter((a) => !a.isProvenance && a.path.includes("/.drafts/"));

  if (mainArtifacts.length > 0) {
    taskStatus = "done";
    statusText = `Completed — ${mainArtifacts.length} artifact${mainArtifacts.length !== 1 ? "s" : ""} ready`;
  } else if (draftArtifacts.length > 0) {
    taskStatus = "running";
    statusText = `Agents working — ${draftArtifacts.length} draft artifact${draftArtifacts.length !== 1 ? "s" : ""} in progress`;
  }

  const allVisible = [...mainArtifacts, ...draftArtifacts, ...artifacts.filter((a) => a.isProvenance)];

  return NextResponse.json({ status: taskStatus, statusText, artifacts: allVisible });
}
