import { getPiWebAccessStatus, savePiWebAccessConfig, } from "../pi/web-access.js";
import { printInfo } from "../ui/terminal.js";
const SEARCH_PROVIDERS = ["auto", "perplexity", "exa", "gemini"];
const PROVIDER_API_KEY_FIELDS = {
    perplexity: "perplexityApiKey",
    exa: "exaApiKey",
    gemini: "geminiApiKey",
};
export function printSearchStatus(status = getPiWebAccessStatus()) {
    const configPathSuffix = status.configExists ? "" : " (not created yet)";
    printInfo("Managed by: pi-web-access");
    printInfo(`Search route: ${status.routeLabel}`);
    printInfo(`Request route: ${status.requestProvider}`);
    printInfo(`Search workflow: ${status.workflow}`);
    printInfo(`Perplexity API configured: ${status.perplexityConfigured ? "yes" : "no"}`);
    printInfo(`Exa API configured: ${status.exaConfigured ? "yes" : "no"}`);
    printInfo(`Gemini API configured: ${status.geminiApiConfigured ? "yes" : "no"}`);
    printInfo(`Browser profile: ${status.chromeProfile ?? "default Chromium profile"}`);
    printInfo(`Config path: ${status.configPath}${configPathSuffix}`);
    if (!status.configExists) {
        printInfo("Not configured yet. Run one of:");
        printInfo("  lex search set auto");
        printInfo("  lex search set perplexity <api-key>");
        printInfo("  lex search set exa <api-key>");
        printInfo("  lex search set gemini <api-key>");
    }
}
export function setSearchProvider(provider, apiKey) {
    if (!SEARCH_PROVIDERS.includes(provider)) {
        throw new Error(`Usage: lex search set <${SEARCH_PROVIDERS.join("|")}> [api-key]`);
    }
    if (apiKey !== undefined && provider === "auto") {
        throw new Error("The auto provider does not use an API key. Usage: lex search set auto");
    }
    const updates = {
        provider,
        searchProvider: provider,
        workflow: "none",
        route: undefined,
    };
    const apiKeyField = PROVIDER_API_KEY_FIELDS[provider];
    if (apiKeyField && apiKey !== undefined) {
        updates[apiKeyField] = apiKey;
    }
    savePiWebAccessConfig(updates);
    const status = getPiWebAccessStatus();
    console.log(`Web search provider set to ${status.routeLabel}.`);
    console.log(`Config path: ${status.configPath}`);
}
export function clearSearchConfig() {
    savePiWebAccessConfig({ provider: undefined, searchProvider: undefined, route: undefined, workflow: "none" });
    const status = getPiWebAccessStatus();
    console.log(`Web search provider reset to ${status.routeLabel}.`);
    console.log(`Config path: ${status.configPath}`);
}
