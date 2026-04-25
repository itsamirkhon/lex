import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const JURISDICTION_FILTERS: Record<string, string> = {
	de: "site:gesetze-im-internet.de OR site:bundesgerichtshof.de OR site:eur-lex.europa.eu",
	us: "site:law.cornell.edu OR site:courtlistener.com OR site:federalregister.gov",
	uk: "site:legislation.gov.uk OR site:bailii.org OR site:supremecourt.uk",
	fr: "site:legifrance.gouv.fr OR site:courdecassation.fr OR site:conseil-etat.fr",
	eu: "site:eur-lex.europa.eu OR site:curia.europa.eu",
};

const SOURCE_TYPE_FILTERS: Record<string, string> = {
	statute: "statute OR law OR act OR regulation OR directive OR Gesetz OR Verordnung",
	case: "judgment OR ruling OR decision OR Urteil OR Beschluss",
	regulation: "regulation OR directive OR ordinance OR Verordnung OR Richtlinie",
};

export function registerLegalSearchTools(pi: ExtensionAPI): void {
	pi.registerTool("legal_web_search", {
		description: "Web search pre-filtered for authoritative legal sources by jurisdiction. Returns statutes, regulations, and case law from official databases.",
		parameters: Type.Object({
			query: Type.String({ description: "The legal question or search terms" }),
			jurisdiction: Type.Optional(Type.Union([
				Type.Literal("de"),
				Type.Literal("us"),
				Type.Literal("uk"),
				Type.Literal("fr"),
				Type.Literal("eu"),
			], { description: "Jurisdiction to filter results for" })),
			sourceType: Type.Optional(Type.Union([
				Type.Literal("statute"),
				Type.Literal("case"),
				Type.Literal("regulation"),
			], { description: "Type of legal source to prioritize" })),
		}),
		handler: async ({ query, jurisdiction, sourceType }) => {
			const parts = [query];
			if (jurisdiction && JURISDICTION_FILTERS[jurisdiction]) {
				parts.push(`(${JURISDICTION_FILTERS[jurisdiction]})`);
			}
			if (sourceType && SOURCE_TYPE_FILTERS[sourceType]) {
				parts.push(SOURCE_TYPE_FILTERS[sourceType]);
			}
			const constructedQuery = parts.join(" ");

			return {
				content: [{
					type: "text" as const,
					text: `Use the web_search tool with this query: "${constructedQuery}"\n\nThis targets authoritative legal databases for ${jurisdiction?.toUpperCase() ?? "all jurisdictions"}. Verify any statute or case you find by fetching the primary source URL.`,
				}],
				details: { constructedQuery, jurisdiction, sourceType },
			};
		},
	});

	pi.registerTool("sanctions_check", {
		description: "Search public sanctions lists (OFAC SDN, EU Consolidated, UN Security Council) for an entity.",
		parameters: Type.Object({
			entity: Type.String({ description: "Name of the person, company, or country to check" }),
			entityType: Type.Optional(Type.Union([
				Type.Literal("person"),
				Type.Literal("company"),
				Type.Literal("country"),
			], { description: "Type of entity" })),
		}),
		handler: async ({ entity, entityType }) => {
			const today = new Date().toISOString().split("T")[0];
			const searchTargets = [
				{
					list: "OFAC SDN (USA)",
					query: `"${entity}" site:sanctionssearch.ofac.treas.gov OR "${entity}" OFAC SDN list site:home.treasury.gov`,
					url: "https://sanctionssearch.ofac.treas.gov/",
				},
				{
					list: "EU Consolidated Sanctions",
					query: `"${entity}" EU sanctions site:eeas.europa.eu`,
					url: "https://www.eeas.europa.eu/eeas/consolidated-list-sanctions_en",
				},
				{
					list: "UN Security Council",
					query: `"${entity}" UN sanctions site:scsanctions.un.org`,
					url: "https://scsanctions.un.org/search/",
				},
			];

			const instructions = searchTargets.map((t) =>
				`**${t.list}:** Use web_search with query: ${t.query}\nOfficial list: ${t.url}`
			).join("\n\n");

			return {
				content: [{
					type: "text" as const,
					text: `Sanctions check for "${entity}" (${entityType ?? "entity"}) — Date: ${today}\n\nSearch each list using web_search:\n\n${instructions}\n\nFor each list: record the search query used, the date, and the result (MATCH / NO_MATCH / POSSIBLE_MATCH). A POSSIBLE_MATCH occurs when a similar name exists but details differ — flag for lawyer review.\n\nIMPORTANT: Sanctions lists change daily. This check is only valid for today's date (${today}).`,
				}],
				details: { entity, entityType, checkDate: today, listsToCheck: searchTargets.map((t) => t.list) },
			};
		},
	});

	pi.registerTool("eurlex_search", {
		description: "Search EUR-Lex for EU regulations, directives, and decisions.",
		parameters: Type.Object({
			query: Type.String({ description: "Topic, regulation name, or directive number" }),
			documentType: Type.Optional(Type.Union([
				Type.Literal("regulation"),
				Type.Literal("directive"),
				Type.Literal("decision"),
			], { description: "Type of EU legal document" })),
		}),
		handler: async ({ query, documentType }) => {
			const typeFilter = documentType ? ` ${documentType}` : "";
			const searchQuery = `${query}${typeFilter} site:eur-lex.europa.eu`;

			return {
				content: [{
					type: "text" as const,
					text: `Search EUR-Lex using web_search with: "${searchQuery}"\n\nDirect EUR-Lex search: https://eur-lex.europa.eu/search.html?query=${encodeURIComponent(query)}&scope=EURLEX\n\nFor any result found:\n1. Note the document number (e.g., "Regulation (EU) 2016/679")\n2. Fetch the full text URL from EUR-Lex\n3. Verify the document type matches: ${documentType ?? "any"}\n4. Check the document is currently in force (not repealed)`,
				}],
				details: { query, documentType, searchQuery },
			};
		},
	});
}
