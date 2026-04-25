import { dirname, resolve } from "node:path";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { getModels } from "@mariozechner/pi-ai";
import { anthropicOAuthProvider } from "@mariozechner/pi-ai/oauth";
export function getModelsJsonPath(authPath) {
    return resolve(dirname(authPath), "models.json");
}
function registerFeynmanModelOverlays(modelRegistry) {
    const anthropicModels = getModels("anthropic");
    if (anthropicModels.some((model) => model.id === "claude-opus-4-7")) {
        return;
    }
    const opus46 = anthropicModels.find((model) => model.id === "claude-opus-4-6");
    if (!opus46) {
        return;
    }
    modelRegistry.registerProvider("anthropic", {
        baseUrl: "https://api.anthropic.com",
        api: "anthropic-messages",
        oauth: anthropicOAuthProvider,
        models: [
            ...anthropicModels,
            {
                ...opus46,
                id: "claude-opus-4-7",
                name: "Claude Opus 4.7",
            },
        ],
    });
}
export function createModelRegistry(authPath) {
    const registry = ModelRegistry.create(AuthStorage.create(authPath), getModelsJsonPath(authPath));
    registerFeynmanModelOverlays(registry);
    return registry;
}
