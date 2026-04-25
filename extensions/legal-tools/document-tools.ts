import { copyFile, mkdir } from "node:fs/promises";
import { basename, extname, resolve as resolvePath } from "node:path";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export function registerDocumentTools(pi: ExtensionAPI): void {
	pi.registerTool("document_upload", {
		description: "Copy a document (PDF, DOCX, or text) into the current legal matter's uploads folder for analysis.",
		parameters: Type.Object({
			sourcePath: Type.String({ description: "Absolute or relative path to the source file" }),
			matterId: Type.Optional(Type.String({ description: "Matter slug/ID. Creates outputs/matters/<matterId>/uploads/ if not exists." })),
		}),
		handler: async ({ sourcePath, matterId }, ctx) => {
			const resolvedSource = resolvePath(ctx.cwd, sourcePath);
			const matterDir = matterId
				? resolvePath(ctx.cwd, "outputs", "matters", matterId, "uploads")
				: resolvePath(ctx.cwd, "outputs", "uploads");
			await mkdir(matterDir, { recursive: true });
			const dest = resolvePath(matterDir, basename(resolvedSource));
			await copyFile(resolvedSource, dest);
			const relDest = dest.replace(ctx.cwd + "/", "");
			return {
				content: [{ type: "text" as const, text: `Uploaded to ${relDest}` }],
				details: { sourcePath: resolvedSource, destination: dest, matterId: matterId ?? "default" },
			};
		},
	});

	pi.registerTool("document_parse", {
		description: "Extract text content from a PDF or DOCX file and save as plaintext for agent analysis.",
		parameters: Type.Object({
			filePath: Type.String({ description: "Path to the PDF or DOCX file to parse" }),
			outputPath: Type.Optional(Type.String({ description: "Where to write the extracted text. Defaults to <filePath>-parsed.txt" })),
		}),
		handler: async ({ filePath, outputPath }, ctx) => {
			const resolved = resolvePath(ctx.cwd, filePath);
			const ext = extname(resolved).toLowerCase();
			const out = outputPath
				? resolvePath(ctx.cwd, outputPath)
				: resolved.replace(/\.(pdf|docx|doc)$/i, "-parsed.txt");

			if (ext === ".txt" || ext === ".md") {
				// Already plaintext — just confirm the path
				return {
					content: [{ type: "text" as const, text: `File is already plaintext: ${filePath}. Read it directly.` }],
					details: { filePath: resolved, outputPath: resolved, format: "plaintext" },
				};
			}

			// For PDF/DOCX: instruct agent to use pi-docparser if available,
			// otherwise fall back to bash pdftotext / python-docx
			const instructions = ext === ".pdf"
				? `To parse this PDF, run: pdftotext "${resolved}" "${out}" 2>/dev/null || python3 -c "import subprocess; subprocess.run(['pdftotext', '${resolved}', '${out}'])" . The parsed text will be at: ${out}`
				: `To parse this DOCX, run: python3 -c "from docx import Document; d=Document('${resolved}'); open('${out}','w').write('\\n'.join([p.text for p in d.paragraphs]))" . The parsed text will be at: ${out}`;

			return {
				content: [{ type: "text" as const, text: instructions }],
				details: { filePath: resolved, outputPath: out, format: ext === ".pdf" ? "pdf" : "docx" },
			};
		},
	});
}
