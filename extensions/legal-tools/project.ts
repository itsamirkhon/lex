import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve as resolvePath } from "node:path";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const LEGAL_ARTIFACT_DIRS = ["outputs/matters", "outputs", "knowledge-base"];
const ARTIFACT_EXTS = new Set([".md", ".txt", ".pdf", ".docx", ".json"]);

async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function collectLegalArtifacts(cwd: string): Promise<{ label: string; path: string }[]> {
	const items: { label: string; path: string; mtime: number }[] = [];

	for (const dir of LEGAL_ARTIFACT_DIRS) {
		const dirPath = resolvePath(cwd, dir);
		if (!(await pathExists(dirPath))) continue;

		const walk = async (current: string): Promise<void> => {
			let entries;
			try {
				entries = await readdir(current, { withFileTypes: true });
			} catch {
				return;
			}
			for (const entry of entries) {
				const full = join(current, entry.name);
				if (entry.isDirectory()) {
					await walk(full);
				} else {
					const ext = entry.name.slice(entry.name.lastIndexOf("."));
					if (!ARTIFACT_EXTS.has(ext)) continue;
					if (entry.name.includes(".provenance.")) continue;
					if (full.includes("/.plans/") || full.includes("/.drafts/")) continue;
					const rel = relative(cwd, full);
					const info = await stat(full).catch(() => null);
					const mtime = info?.mtimeMs ?? 0;
					const size = info ? formatSize(info.size) : "";
					items.push({ label: `${rel}  (${size})`, path: rel, mtime });
				}
			}
		};

		await walk(dirPath);
	}

	items.sort((a, b) => b.mtime - a.mtime);
	return items;
}

const AGENTS_MD_TEMPLATE = `# Legal Matter Conventions

## Directory structure

\`\`\`
outputs/.plans/<slug>.md            — matter plan + task ledger
outputs/.drafts/<slug>-*.md         — intermediate agent artifacts
outputs/matters/<matter-id>/        — final deliverables
knowledge-base/templates/           — BMW standard contract templates
knowledge-base/precedents/          — approved legal precedents
knowledge-base/memos/               — internal legal memos
samples/                            — demo contracts for testing
\`\`\`

## Slug convention

Lowercase, hyphens, ≤5 words. Examples:
- \`bmw-xyz-nda-review\`
- \`xyz-corp-compliance\`
- \`force-majeure-research\`

## Provenance sidecar

Every final deliverable in \`outputs/matters/<id>/\` must have a \`.provenance.md\` sidecar with:
- Matter ID, Date, Jurisdiction(s), Governing Law
- Agents used, Sources consulted/verified
- QA result, Human review gate status
- Privilege status

## Agent roster

- **contract-agent**: clause-by-clause contract analysis and redlines
- **compliance-agent**: sanctions, LkSG, ESG, GDPR checks
- **research-agent**: jurisdiction-specific statute and case law
- **risk-agent**: risk register with CRITICAL/HIGH/MEDIUM/LOW grading
- **negotiation-agent**: negotiation positions and BATNA
- **knowledge-agent**: internal KB search (templates, precedents, memos)
- **qa-agent**: citation verification and consistency check (mandatory before delivery)
`;

export function registerInitCommand(pi: ExtensionAPI): void {
	pi.registerCommand("init", {
		description: "Initialize AGENTS.md and matter folders for a legal project.",
		handler: async (_args, ctx) => {
			const agentsPath = resolvePath(ctx.cwd, "AGENTS.md");
			const outputsDir = resolvePath(ctx.cwd, "outputs");
			const mattersDir = resolvePath(outputsDir, "matters");
			const plansDir = resolvePath(outputsDir, ".plans");
			const draftsDir = resolvePath(outputsDir, ".drafts");
			const kbDir = resolvePath(ctx.cwd, "knowledge-base");

			const created: string[] = [];
			const skipped: string[] = [];

			await mkdir(mattersDir, { recursive: true });
			await mkdir(plansDir, { recursive: true });
			await mkdir(draftsDir, { recursive: true });
			await mkdir(kbDir, { recursive: true });

			if (!(await pathExists(agentsPath))) {
				await writeFile(agentsPath, AGENTS_MD_TEMPLATE, "utf8");
				created.push("AGENTS.md");
			} else {
				skipped.push("AGENTS.md");
			}

			const summary = [
				created.length > 0 ? `Created: ${created.join(", ")}` : null,
				skipped.length > 0 ? `Kept existing: ${skipped.join(", ")}` : null,
				"Directories ready: outputs/matters/, outputs/.plans/, outputs/.drafts/, knowledge-base/",
			].filter(Boolean).join(" | ");

			ctx.ui.notify(summary, "info");
		},
	});
}

export function registerOutputsCommand(pi: ExtensionAPI): void {
	pi.registerCommand("outputs", {
		description: "Browse all legal artifacts (contracts, compliance reports, research, matters).",
		handler: async (_args, ctx) => {
			const items = await collectLegalArtifacts(ctx.cwd);
			if (items.length === 0) {
				ctx.ui.notify(
					"No artifacts found. Use /contract-review, /compliance-check, /legal-research, or /risk-assessment to create some.",
					"info",
				);
				return;
			}

			const selected = await ctx.ui.select(`Legal Artifacts (${items.length})`, items.map((i) => i.label));
			if (!selected) return;

			const match = items.find((i) => i.label === selected);
			if (match) {
				ctx.ui.setEditorText(`read ${match.path}`);
			}
		},
	});
}
