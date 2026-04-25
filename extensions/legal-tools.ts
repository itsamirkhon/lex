import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { registerDiscoveryCommands } from "./legal-tools/discovery.js";
import { registerDocumentTools } from "./legal-tools/document-tools.js";
import { installLexHeader } from "./legal-tools/header.js";
import { registerLegalSearchTools } from "./legal-tools/legal-search-tools.js";
import { registerMatterCommand } from "./legal-tools/matter.js";
import { registerInitCommand, registerOutputsCommand } from "./legal-tools/project.js";

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
