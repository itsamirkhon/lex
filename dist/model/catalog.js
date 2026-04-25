import { readFileSync } from "node:fs";
import { getEnvApiKey } from "@mariozechner/pi-ai";
import { createModelRegistry } from "./registry.js";
const PROVIDER_LABELS = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    "openai-codex": "OpenAI Codex",
    openrouter: "OpenRouter",
    google: "Google",
    "google-gemini-cli": "Google Gemini CLI",
    zai: "Z.AI / GLM",
    minimax: "MiniMax",
    "minimax-cn": "MiniMax (China)",
    "github-copilot": "GitHub Copilot",
    "vercel-ai-gateway": "Vercel AI Gateway",
    opencode: "OpenCode",
    "opencode-go": "OpenCode Go",
    "kimi-coding": "Kimi / Moonshot",
    xai: "xAI",
    groq: "Groq",
    mistral: "Mistral",
    cerebras: "Cerebras",
    huggingface: "Hugging Face",
    "amazon-bedrock": "Amazon Bedrock",
    "azure-openai-responses": "Azure OpenAI Responses",
    litellm: "LiteLLM Proxy",
};
const RESEARCH_MODEL_PREFERENCES = [
    {
        spec: "anthropic/claude-opus-4-6",
        reason: "strong long-context reasoning for source-heavy research work",
    },
    {
        spec: "anthropic/claude-opus-4-5",
        reason: "strong long-context reasoning for source-heavy research work",
    },
    {
        spec: "anthropic/claude-sonnet-4-6",
        reason: "balanced reasoning and speed for iterative research sessions",
    },
    {
        spec: "anthropic/claude-sonnet-4-5",
        reason: "balanced reasoning and speed for iterative research sessions",
    },
    {
        spec: "openai/gpt-5.4",
        reason: "strong general reasoning and drafting quality for research tasks",
    },
    {
        spec: "openai/gpt-5",
        reason: "strong general reasoning and drafting quality for research tasks",
    },
    {
        spec: "openai-codex/gpt-5.4",
        reason: "strong research + coding balance when Pi exposes Codex directly",
    },
    {
        spec: "google/gemini-3-pro-preview",
        reason: "good fallback for broad web-and-doc research work",
    },
    {
        spec: "google/gemini-2.5-pro",
        reason: "good fallback for broad web-and-doc research work",
    },
    {
        spec: "openrouter/openai/gpt-5.1-codex",
        reason: "good routed fallback when only OpenRouter is configured",
    },
    {
        spec: "zai/glm-5",
        reason: "good fallback when GLM is the available research model",
    },
    {
        spec: "minimax/MiniMax-M2.7",
        reason: "good fallback when MiniMax is the available research model",
    },
    {
        spec: "minimax/MiniMax-M2.7-highspeed",
        reason: "good fallback when MiniMax is the available research model",
    },
    {
        spec: "kimi-coding/kimi-k2-thinking",
        reason: "good fallback when Kimi is the available research model",
    },
];
const PROVIDER_SORT_ORDER = [
    "anthropic",
    "openai",
    "openai-codex",
    "google",
    "openrouter",
    "zai",
    "kimi-coding",
    "minimax",
    "minimax-cn",
    "github-copilot",
    "vercel-ai-gateway",
];
function formatProviderLabel(provider) {
    return PROVIDER_LABELS[provider] ?? provider;
}
function modelSpec(model) {
    return `${model.provider}/${model.id}`;
}
function compareByResearchPreference(left, right) {
    const leftSpec = modelSpec(left);
    const rightSpec = modelSpec(right);
    const leftIndex = RESEARCH_MODEL_PREFERENCES.findIndex((entry) => entry.spec === leftSpec);
    const rightIndex = RESEARCH_MODEL_PREFERENCES.findIndex((entry) => entry.spec === rightSpec);
    if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1)
            return 1;
        if (rightIndex === -1)
            return -1;
        return leftIndex - rightIndex;
    }
    const leftProviderIndex = PROVIDER_SORT_ORDER.indexOf(left.provider);
    const rightProviderIndex = PROVIDER_SORT_ORDER.indexOf(right.provider);
    if (leftProviderIndex !== -1 || rightProviderIndex !== -1) {
        if (leftProviderIndex === -1)
            return 1;
        if (rightProviderIndex === -1)
            return -1;
        return leftProviderIndex - rightProviderIndex;
    }
    return modelSpec(left).localeCompare(modelSpec(right));
}
function sortProviders(left, right) {
    if (left.configured !== right.configured) {
        return left.configured ? -1 : 1;
    }
    if (left.current !== right.current) {
        return left.current ? -1 : 1;
    }
    if (left.recommended !== right.recommended) {
        return left.recommended ? -1 : 1;
    }
    const leftIndex = PROVIDER_SORT_ORDER.indexOf(left.id);
    const rightIndex = PROVIDER_SORT_ORDER.indexOf(right.id);
    if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1)
            return 1;
        if (rightIndex === -1)
            return -1;
        return leftIndex - rightIndex;
    }
    return left.label.localeCompare(right.label);
}
export function getAvailableModelRecords(authPath) {
    const expiredOAuthProviders = readExpiredOAuthProviders(authPath);
    return createModelRegistry(authPath)
        .getAvailable()
        .filter((model) => !expiredOAuthProviders.has(model.provider))
        .map((model) => ({ provider: model.provider, id: model.id, name: model.name }));
}
export function getSupportedModelRecords(authPath) {
    return createModelRegistry(authPath)
        .getAll()
        .map((model) => ({ provider: model.provider, id: model.id, name: model.name }));
}
function readExpiredOAuthProviders(authPath) {
    const expired = new Set();
    try {
        const parsed = JSON.parse(readFileSync(authPath, "utf8"));
        for (const [provider, credential] of Object.entries(parsed)) {
            if (!credential || typeof credential !== "object")
                continue;
            const typedCredential = credential;
            if (typedCredential.type !== "oauth" || typeof typedCredential.expires !== "number")
                continue;
            if (typedCredential.expires > Date.now())
                continue;
            if (getEnvApiKey(provider))
                continue;
            expired.add(provider);
        }
    }
    catch { }
    return expired;
}
export function chooseRecommendedModel(authPath) {
    const available = getAvailableModelRecords(authPath).sort(compareByResearchPreference);
    if (available.length === 0) {
        return undefined;
    }
    const matchedPreference = RESEARCH_MODEL_PREFERENCES.find((entry) => entry.spec === modelSpec(available[0]));
    if (matchedPreference) {
        return matchedPreference;
    }
    return {
        spec: modelSpec(available[0]),
        reason: "best currently authenticated fallback for research work",
    };
}
export function buildModelStatusSnapshotFromRecords(supported, available, current) {
    const availableSpecs = available
        .slice()
        .sort(compareByResearchPreference)
        .map((model) => modelSpec(model));
    const recommended = available.length > 0
        ? (() => {
            const preferred = available.slice().sort(compareByResearchPreference)[0];
            const matched = RESEARCH_MODEL_PREFERENCES.find((entry) => entry.spec === modelSpec(preferred));
            return {
                spec: modelSpec(preferred),
                reason: matched?.reason ?? "best currently authenticated fallback for research work",
            };
        })()
        : undefined;
    const currentValid = current ? availableSpecs.includes(current) : false;
    const providerMap = new Map();
    for (const model of supported) {
        const provider = providerMap.get(model.provider) ?? {
            id: model.provider,
            label: formatProviderLabel(model.provider),
            supportedModels: 0,
            availableModels: 0,
            configured: false,
            current: false,
            recommended: false,
        };
        provider.supportedModels += 1;
        provider.current ||= current?.startsWith(`${model.provider}/`) ?? false;
        provider.recommended ||= recommended?.spec.startsWith(`${model.provider}/`) ?? false;
        providerMap.set(model.provider, provider);
    }
    for (const model of available) {
        const provider = providerMap.get(model.provider) ?? {
            id: model.provider,
            label: formatProviderLabel(model.provider),
            supportedModels: 0,
            availableModels: 0,
            configured: false,
            current: false,
            recommended: false,
        };
        provider.availableModels += 1;
        provider.configured = true;
        provider.current ||= current?.startsWith(`${model.provider}/`) ?? false;
        provider.recommended ||= recommended?.spec.startsWith(`${model.provider}/`) ?? false;
        providerMap.set(model.provider, provider);
    }
    const guidance = [];
    if (available.length === 0) {
        guidance.push("No authenticated Pi models are available yet.");
        guidance.push("Run `feynman model login <provider>` (OAuth) or configure an API key (env var, auth.json, or models.json for custom providers).");
        guidance.push("After auth is in place, rerun `feynman model list` or `feynman setup model`.");
    }
    else if (!current) {
        guidance.push(`No default research model is set. Recommended: ${recommended?.spec}.`);
        guidance.push("Run `feynman model set <provider/model>` or `feynman setup model`.");
    }
    else if (!currentValid) {
        guidance.push(`Configured default model is unavailable: ${current}.`);
        if (recommended) {
            guidance.push(`Switch to the current research recommendation: ${recommended.spec}.`);
        }
    }
    return {
        current,
        currentValid,
        recommended: recommended?.spec,
        recommendationReason: recommended?.reason,
        availableModels: availableSpecs,
        providers: Array.from(providerMap.values()).sort(sortProviders),
        guidance,
    };
}
