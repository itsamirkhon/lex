export const CORE_PACKAGE_SOURCES = [
    "npm:pi-subagents",
    "npm:pi-docparser",
    "npm:pi-web-access",
    "npm:pi-markdown-preview",
    "npm:pi-mermaid",
    "npm:@aliou/pi-processes",
    "npm:@kaiserlich-dev/pi-session-search",
    "npm:@samfp/pi-memory",
];
export const NATIVE_PACKAGE_SOURCES = [
    "npm:@kaiserlich-dev/pi-session-search",
    "npm:@samfp/pi-memory",
];
const CORE_PACKAGE_UPDATE_ALIASES = {
    memory: "npm:@samfp/pi-memory",
    "pi-memory": "npm:@samfp/pi-memory",
    "session-search": "npm:@kaiserlich-dev/pi-session-search",
    "pi-session-search": "npm:@kaiserlich-dev/pi-session-search",
};
export const MAX_NATIVE_PACKAGE_NODE_MAJOR = 24;
export const OPTIONAL_PACKAGE_PRESETS = {
    "generative-ui": {
        description: "Interactive Glimpse UI widgets.",
        sources: ["npm:pi-generative-ui"],
        platforms: ["darwin"],
    },
};
const LEGACY_DEFAULT_PACKAGE_SOURCES = [
    ...CORE_PACKAGE_SOURCES,
    "npm:pi-generative-ui",
];
function arraysMatchAsSets(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    const rightSet = new Set(right);
    return left.every((entry) => rightSet.has(entry));
}
export function shouldPruneLegacyDefaultPackages(packages) {
    if (!Array.isArray(packages)) {
        return false;
    }
    if (packages.some((entry) => typeof entry !== "string")) {
        return false;
    }
    return arraysMatchAsSets(packages, LEGACY_DEFAULT_PACKAGE_SOURCES);
}
function parseNodeMajor(version) {
    const [major = "0"] = version.replace(/^v/, "").split(".");
    return Number.parseInt(major, 10) || 0;
}
export function supportsNativePackageSources(version = process.versions.node) {
    return parseNodeMajor(version) <= MAX_NATIVE_PACKAGE_NODE_MAJOR;
}
export function filterPackageSourcesForCurrentNode(sources, version = process.versions.node) {
    if (supportsNativePackageSources(version)) {
        return [...sources];
    }
    const blocked = new Set(NATIVE_PACKAGE_SOURCES);
    return sources.filter((source) => !blocked.has(source));
}
export function normalizeOptionalPackagePresetName(name) {
    const normalized = name.trim().toLowerCase();
    if (normalized === "ui") {
        return "generative-ui";
    }
    if (normalized === "all-extras") {
        return "all-extras";
    }
    return normalized in OPTIONAL_PACKAGE_PRESETS ? normalized : undefined;
}
export function isOptionalPackagePresetSupported(name, platform = process.platform) {
    const platforms = OPTIONAL_PACKAGE_PRESETS[name].platforms;
    return !platforms || platforms.includes(platform);
}
export function getOptionalPackagePresetSources(name, platform = process.platform) {
    const normalized = normalizeOptionalPackagePresetName(name);
    if (!normalized)
        return undefined;
    if (normalized === "all-extras") {
        const sources = listOptionalPackagePresets(platform).flatMap((preset) => preset.sources);
        return sources.length > 0 ? sources : undefined;
    }
    if (!isOptionalPackagePresetSupported(normalized, platform))
        return undefined;
    return [...OPTIONAL_PACKAGE_PRESETS[normalized].sources];
}
export function listOptionalPackagePresets(platform) {
    const currentPlatform = platform ?? process.platform;
    return Object.entries(OPTIONAL_PACKAGE_PRESETS).filter(([name]) => isOptionalPackagePresetSupported(name, currentPlatform)).map(([name, preset]) => ({
        name: name,
        description: preset.description,
        sources: [...preset.sources],
    }));
}
export function listOptionalPackagePresetInstallTargets(platform) {
    const names = listOptionalPackagePresets(platform).map((preset) => preset.name);
    return names.length > 0 ? [...names, "all-extras"] : [];
}
export function resolvePackageUpdateSources(name, platform = process.platform) {
    const trimmed = name.trim();
    if (!trimmed)
        return [];
    if (trimmed.startsWith("npm:") || trimmed.startsWith("github:") || trimmed.startsWith("file:")) {
        return [trimmed];
    }
    const normalized = trimmed.toLowerCase();
    const coreSource = CORE_PACKAGE_UPDATE_ALIASES[normalized];
    if (coreSource)
        return [coreSource];
    const optionalSources = getOptionalPackagePresetSources(normalized, platform);
    return optionalSources ?? [trimmed];
}
