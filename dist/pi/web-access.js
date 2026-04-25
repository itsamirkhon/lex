import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getLexHome } from "../config/paths.js";
export function getPiWebSearchConfigPath(home) {
    const lexHome = home ? resolve(home, ".lex") : getLexHome();
    return resolve(lexHome, "web-search.json");
}
function normalizeProvider(value) {
    return value === "auto" || value === "perplexity" || value === "exa" || value === "gemini" ? value : undefined;
}
function normalizeWorkflow(value) {
    return value === "none" || value === "summary-review" ? value : undefined;
}
function normalizeNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
export function loadPiWebAccessConfig(configPath = getPiWebSearchConfigPath()) {
    if (!existsSync(configPath)) {
        return {};
    }
    try {
        const parsed = JSON.parse(readFileSync(configPath, "utf8"));
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
export function savePiWebAccessConfig(updates, configPath = getPiWebSearchConfigPath()) {
    const merged = { ...loadPiWebAccessConfig(configPath) };
    for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) {
            delete merged[key];
        }
        else {
            merged[key] = value;
        }
    }
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
}
function formatRouteLabel(provider) {
    switch (provider) {
        case "perplexity":
            return "Perplexity";
        case "exa":
            return "Exa";
        case "gemini":
            return "Gemini";
        default:
            return "Auto";
    }
}
function formatRouteNote(provider) {
    switch (provider) {
        case "perplexity":
            return "Pi web-access will use Perplexity for search.";
        case "exa":
            return "Pi web-access will use Exa for search.";
        case "gemini":
            return "Pi web-access will use Gemini API or Gemini Browser.";
        default:
            return "Pi web-access will try Perplexity, then Exa, then Gemini API, then Gemini Browser.";
    }
}
export function getPiWebAccessStatus(config = loadPiWebAccessConfig(), configPath = getPiWebSearchConfigPath()) {
    const searchProvider = normalizeProvider(config.searchProvider) ?? normalizeProvider(config.route) ?? normalizeProvider(config.provider) ?? "auto";
    const requestProvider = normalizeProvider(config.provider) ?? normalizeProvider(config.route) ?? searchProvider;
    const workflow = normalizeWorkflow(config.workflow) ?? "none";
    const perplexityConfigured = Boolean(normalizeNonEmptyString(config.perplexityApiKey));
    const exaConfigured = Boolean(normalizeNonEmptyString(config.exaApiKey));
    const geminiApiConfigured = Boolean(normalizeNonEmptyString(config.geminiApiKey));
    const chromeProfile = normalizeNonEmptyString(config.chromeProfile);
    const effectiveProvider = searchProvider;
    return {
        configPath,
        configExists: existsSync(configPath),
        searchProvider,
        requestProvider,
        workflow,
        perplexityConfigured,
        exaConfigured,
        geminiApiConfigured,
        chromeProfile,
        routeLabel: formatRouteLabel(effectiveProvider),
        note: formatRouteNote(effectiveProvider),
    };
}
export function formatPiWebAccessDoctorLines(status = getPiWebAccessStatus()) {
    const configPathSuffix = status.configExists ? "" : " (not created yet)";
    const lines = [
        "web access: pi-web-access",
        `  search route: ${status.routeLabel}`,
        `  request route: ${status.requestProvider}`,
        `  search workflow: ${status.workflow}`,
        `  perplexity api: ${status.perplexityConfigured ? "configured" : "not configured"}`,
        `  exa api: ${status.exaConfigured ? "configured" : "not configured"}`,
        `  gemini api: ${status.geminiApiConfigured ? "configured" : "not configured"}`,
        `  browser profile: ${status.chromeProfile ?? "default Chromium profile"}`,
        `  config path: ${status.configPath}${configPathSuffix}`,
        `  note: ${status.note}`,
    ];
    if (!status.configExists) {
        lines.push("  hint: run `lex search set <auto|perplexity|exa|gemini> [api-key]` to configure web search");
    }
    return lines;
}
