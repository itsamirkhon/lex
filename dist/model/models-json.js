import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
function readModelsJson(modelsJsonPath) {
    if (!existsSync(modelsJsonPath)) {
        return { ok: true, value: { providers: {} } };
    }
    try {
        const raw = readFileSync(modelsJsonPath, "utf8").trim();
        if (!raw) {
            return { ok: true, value: { providers: {} } };
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return { ok: false, error: `Invalid models.json (expected an object): ${modelsJsonPath}` };
        }
        return { ok: true, value: parsed };
    }
    catch (error) {
        return {
            ok: false,
            error: `Failed to read models.json: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
export function upsertProviderBaseUrl(modelsJsonPath, providerId, baseUrl) {
    return upsertProviderConfig(modelsJsonPath, providerId, { baseUrl });
}
export function upsertProviderConfig(modelsJsonPath, providerId, patch) {
    const loaded = readModelsJson(modelsJsonPath);
    if (!loaded.ok) {
        return loaded;
    }
    const value = loaded.value;
    const providers = {
        ...(value.providers && typeof value.providers === "object" ? value.providers : {}),
    };
    const currentProvider = providers[providerId] && typeof providers[providerId] === "object" ? providers[providerId] : {};
    const nextProvider = { ...currentProvider };
    if (patch.baseUrl !== undefined)
        nextProvider.baseUrl = patch.baseUrl;
    if (patch.apiKey !== undefined)
        nextProvider.apiKey = patch.apiKey;
    if (patch.api !== undefined)
        nextProvider.api = patch.api;
    if (patch.authHeader !== undefined)
        nextProvider.authHeader = patch.authHeader;
    if (patch.headers !== undefined)
        nextProvider.headers = patch.headers;
    if (patch.models !== undefined)
        nextProvider.models = patch.models;
    providers[providerId] = nextProvider;
    const next = { ...value, providers };
    try {
        mkdirSync(dirname(modelsJsonPath), { recursive: true });
        writeFileSync(modelsJsonPath, JSON.stringify(next, null, 2) + "\n", "utf8");
        // models.json can contain API keys/headers; default to user-only permissions.
        try {
            chmodSync(modelsJsonPath, 0o600);
        }
        catch {
            // ignore permission errors (best-effort)
        }
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: `Failed to write models.json: ${error instanceof Error ? error.message : String(error)}` };
    }
}
