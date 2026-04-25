import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { registerDiscoveryCommands } from "./legal-tools/discovery.ts";
import { registerDocumentTools } from "./legal-tools/document-tools.ts";
import { installLexHeader } from "./legal-tools/header.ts";
import { registerLegalSearchTools } from "./legal-tools/legal-search-tools.ts";
import { registerMatterCommand } from "./legal-tools/matter.ts";
import { registerInitCommand, registerOutputsCommand } from "./legal-tools/project.ts";

export default function legalTools(pi: ExtensionAPI): void {
	const cache: { agentSummaryPromise?: Promise<{ agents: string[]; chains: string[] }> } = {};

	pi.on("session_start", async (_event, ctx) => {
		await installLexHeader(pi, ctx, cache);
	});

	registerDocumentTools(pi);
	registerLegalSearchTools(pi);
	registerDiscoveryCommands(pi);
	registerMatterCommand(pi);
	registerInitCommand(pi);
	registerOutputsCommand(pi);
}
