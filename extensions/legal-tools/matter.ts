import { mkdir, readdir, stat } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

async function listMatters(cwd: string): Promise<{ label: string; path: string }[]> {
	const mattersDir = resolvePath(cwd, "outputs", "matters");
	if (!(await pathExists(mattersDir))) return [];

	const entries = await readdir(mattersDir, { withFileTypes: true });
	const items: { label: string; path: string; mtime: number }[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const fullPath = resolvePath(mattersDir, entry.name);
		const info = await stat(fullPath).catch(() => null);
		const mtime = info?.mtimeMs ?? 0;
		const files = await readdir(fullPath).catch(() => [] as string[]);
		const artifactCount = files.filter((f) => f.endsWith(".md") && !f.endsWith(".provenance.md")).length;
		items.push({
			label: `${entry.name}  (${artifactCount} artifact${artifactCount !== 1 ? "s" : ""})`,
			path: `outputs/matters/${entry.name}`,
			mtime,
		});
	}

	items.sort((a, b) => b.mtime - a.mtime);
	return items;
}

export function registerMatterCommand(pi: ExtensionAPI): void {
	pi.registerCommand("matters", {
		description: "Browse open legal matters or create a new matter workspace.",
		handler: async (_args, ctx) => {
			const matters = await listMatters(ctx.cwd);
			const options = [
				"+ New matter",
				...matters.map((m) => m.label),
			];

			const selected = await ctx.ui.select(`Legal Matters (${matters.length} open)`, options);
			if (!selected) return;

			if (selected === "+ New matter") {
				ctx.ui.setEditorText("Create a new legal matter. What is the matter name or slug?");
				ctx.ui.notify("Type the matter name to create a new workspace", "info");
				return;
			}

			const match = matters.find((m) => m.label === selected);
			if (match) {
				ctx.ui.setEditorText(`read ${match.path}`);
				ctx.ui.notify(`Opened matter: ${match.path}`, "info");
			}
		},
	});
}

export async function createMatterWorkspace(cwd: string, matterId: string): Promise<string> {
	const matterPath = resolvePath(cwd, "outputs", "matters", matterId);
	const uploadsPath = resolvePath(matterPath, "uploads");
	await mkdir(uploadsPath, { recursive: true });
	return matterPath;
}
