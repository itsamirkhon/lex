import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
// alpha-hub removed — Lex uses legal-tools extension instead
const getAlphaUserName = () => null;
const isAlphaLoggedIn = () => false;
const loginAlpha = async () => ({});
const logoutAlpha = () => {};
import { SettingsManager } from "@mariozechner/pi-coding-agent";
import { syncBundledAssets } from "./bootstrap/sync.js";
import { ensureLexHome, getDefaultSessionDir, getLexAgentDir, getLexHome } from "./config/paths.js";
import { launchPiChat } from "./pi/launch.js";
import { installPackageSources, updateConfiguredPackages } from "./pi/package-ops.js";
import { MAX_NATIVE_PACKAGE_NODE_MAJOR } from "./pi/package-presets.js";
import { CORE_PACKAGE_SOURCES, getOptionalPackagePresetSources, isOptionalPackagePresetSupported, listOptionalPackagePresetInstallTargets, listOptionalPackagePresets, normalizeOptionalPackagePresetName, resolvePackageUpdateSources, } from "./pi/package-presets.js";
import { normalizeLexSettings, normalizeThinkingLevel, parseModelSpec } from "./pi/settings.js";
import { applyLexPackageManagerEnv } from "./pi/runtime.js";
import { getConfiguredServiceTier, normalizeServiceTier, setConfiguredServiceTier } from "./model/service-tier.js";
import { authenticateModelProvider, getCurrentModelSpec, loginModelProvider, logoutModelProvider, printModelList, setDefaultModelSpec, } from "./model/commands.js";
import { buildModelStatusSnapshotFromRecords, getAvailableModelRecords, getSupportedModelRecords } from "./model/catalog.js";
import { clearSearchConfig, printSearchStatus, setSearchProvider } from "./search/commands.js";
import { runDoctor, runStatus } from "./setup/doctor.js";
import { setupPreviewDependencies } from "./setup/preview.js";
import { runSetup } from "./setup/setup.js";
import { ASH, printAsciiHeader, printInfo, printPanel, printSection, RESET, SAGE } from "./ui/terminal.js";
import { createModelRegistry } from "./model/registry.js";
import { cliCommandSections, formatCliWorkflowUsage, legacyFlags, readPromptSpecs, topLevelCommandNames, } from "../metadata/commands.mjs";
const TOP_LEVEL_COMMANDS = new Set([...topLevelCommandNames, "auth"]);
async function handleAuthCommand(appRoot, agentDir) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise((res) => rl.question(q, res));
    console.log("\n⚖  Lex — BMW Legal AI Platform\n");
    console.log("Paste your OpenRouter API key (starts with sk-or-v1-...)");
    console.log("Get one at: https://openrouter.ai/keys\n");
    const key = (await ask("OpenRouter API key: ")).trim();
    rl.close();
    if (!key.startsWith("sk-or-v1-") && !key.startsWith("sk-")) {
        console.error("\nInvalid key format. Expected sk-or-v1-... from openrouter.ai");
        process.exit(1);
    }
    // Save to ~/.lex/agent/auth.json
    mkdirSync(agentDir, { recursive: true });
    const authPath = resolve(agentDir, "auth.json");
    const existing = existsSync(authPath) ? JSON.parse(readFileSync(authPath, "utf8")) : {};
    existing.openrouter = { type: "api_key", key };
    writeFileSync(authPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
    // Also save to .env in project root
    const envPath = resolve(appRoot, ".env");
    const envLine = `OPENROUTER_API_KEY=${key}`;
    if (existsSync(envPath)) {
        let env = readFileSync(envPath, "utf8");
        if (env.includes("OPENROUTER_API_KEY=")) {
            env = env.replace(/^OPENROUTER_API_KEY=.*/m, envLine);
        } else {
            env += `\n${envLine}\n`;
        }
        writeFileSync(envPath, env, "utf8");
    } else {
        writeFileSync(envPath, `${envLine}\n`, "utf8");
    }
    // Set default model to OpenRouter Claude directly in settings.json
    try {
        const settingsPath = resolve(agentDir, "settings.json");
        const existing2 = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {};
        existing2.defaultModel = "openrouter/anthropic/claude-sonnet-4-5";
        writeFileSync(settingsPath, JSON.stringify(existing2, null, 2) + "\n", "utf8");
    } catch {}
    console.log("\n✓ API key saved to ~/.lex/agent/auth.json");
    console.log("\nYou're ready! Try:");
    console.log("  bmwlex contract-review samples/acme-supplier-nda-draft.md --jurisdiction de");
    console.log("  bmwlex compliance-check \"Acme GmbH\" --check-type sanctions");
    console.log("  bmwlex legal-research \"force majeure\" --jurisdiction de,uk\n");
}
function printHelpLine(usage, description) {
    const width = 30;
    const padding = Math.max(1, width - usage.length);
    console.log(`  ${SAGE}${usage}${RESET}${" ".repeat(padding)}${ASH}${description}${RESET}`);
}
function printHelp(appRoot) {
    const workflowCommands = readPromptSpecs(appRoot).filter((command) => command.section === "Legal Workflows" && command.topLevelCli);
    printAsciiHeader([
        "Lex — BMW Legal AI Agent Platform.",
        "Use `lex setup` first if this is a new machine.",
    ]);
    printSection("Getting Started");
    printInfo("lex");
    printInfo("lex setup");
    printInfo("lex doctor");
    printInfo("lex model");
    printInfo("lex search status");
    printSection("Commands");
    for (const section of cliCommandSections) {
        for (const command of section.commands) {
            printHelpLine(command.usage, command.description);
        }
    }
    printSection("Legal Workflows");
    for (const command of workflowCommands) {
        printHelpLine(formatCliWorkflowUsage(command), command.description);
    }
    printSection("Legacy Flags");
    for (const flag of legacyFlags) {
        printHelpLine(flag.usage, flag.description);
    }
    printSection("REPL");
    printInfo("Inside the REPL, slash workflows come from the live prompt-template and extension command set.");
}
async function handleAlphaCommand(action) {
    if (action === "login") {
        const result = await loginAlpha();
        const name = result.userInfo &&
            typeof result.userInfo === "object" &&
            "name" in result.userInfo &&
            typeof result.userInfo.name === "string"
            ? result.userInfo.name
            : getAlphaUserName();
        console.log(name ? `alphaXiv login complete: ${name}` : "alphaXiv login complete");
        return;
    }
    if (action === "logout") {
        logoutAlpha();
        console.log("alphaXiv auth cleared");
        return;
    }
    if (!action || action === "status") {
        if (isAlphaLoggedIn()) {
            const name = getAlphaUserName();
            console.log(name ? `alphaXiv logged in as ${name}` : "alphaXiv logged in");
        }
        else {
            console.log("alphaXiv not logged in");
        }
        return;
    }
    throw new Error(`Unknown alpha command: ${action}`);
}
async function handleModelCommand(subcommand, args, lexSettingsPath, lexAuthPath) {
    if (!subcommand || subcommand === "list") {
        printModelList(lexSettingsPath, lexAuthPath);
        return;
    }
    if (subcommand === "login") {
        if (args[0]) {
            // Specific provider given - resolve OAuth vs API-key setup automatically
            await loginModelProvider(lexAuthPath, args[0], lexSettingsPath);
        }
        else {
            // No provider specified - show auth method choice
            await authenticateModelProvider(lexAuthPath, lexSettingsPath);
        }
        return;
    }
    if (subcommand === "logout") {
        await logoutModelProvider(lexAuthPath, args[0]);
        return;
    }
    if (subcommand === "set") {
        const spec = args[0];
        if (!spec) {
            throw new Error("Usage: lex model set <provider/model|provider:model>");
        }
        setDefaultModelSpec(lexSettingsPath, lexAuthPath, spec);
        return;
    }
    if (subcommand === "tier") {
        const requested = args[0];
        if (!requested) {
            console.log(getConfiguredServiceTier(lexSettingsPath) ?? "not set");
            return;
        }
        if (requested === "unset" || requested === "clear" || requested === "off") {
            setConfiguredServiceTier(lexSettingsPath, undefined);
            console.log("Cleared service tier override");
            return;
        }
        const tier = normalizeServiceTier(requested);
        if (!tier) {
            throw new Error("Usage: lex model tier <auto|default|flex|priority|standard_only|unset>");
        }
        setConfiguredServiceTier(lexSettingsPath, tier);
        console.log(`Service tier set to ${tier}`);
        return;
    }
    throw new Error(`Unknown model command: ${subcommand}`);
}
async function handleUpdateCommand(workingDir, lexAgentDir, source) {
    try {
        const updateSources = source ? resolvePackageUpdateSources(source) : [undefined];
        const results = [];
        for (const updateSource of updateSources) {
            results.push(await updateConfiguredPackages(workingDir, lexAgentDir, updateSource));
        }
        const updated = results.flatMap((result) => result.updated);
        const skipped = results.flatMap((result) => result.skipped);
        if (updated.length === 0) {
            console.log("All packages up to date.");
            return;
        }
        for (const updatedSource of updated) {
            console.log(`Updated ${updatedSource}`);
        }
        for (const skippedSource of skipped) {
            console.log(`Skipped ${skippedSource} on Node ${process.versions.node} (native packages are only supported through Node ${MAX_NATIVE_PACKAGE_NODE_MAJOR}.x).`);
        }
        console.log("All packages up to date.");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("No supported package manager found")) {
            console.log("No package manager is available for live package updates.");
            console.log("If you installed the standalone app, rerun the installer to get newer bundled packages.");
            return;
        }
        if (message.includes("Installing pi-generative-ui failed")) {
            console.log(message);
            console.log("Skipped optional generative-ui update.");
            return;
        }
        throw error;
    }
}
async function handlePackagesCommand(subcommand, args, workingDir, lexAgentDir) {
    applyLexPackageManagerEnv(lexAgentDir);
    const settingsManager = SettingsManager.create(workingDir, lexAgentDir);
    const configuredSources = new Set(settingsManager
        .getPackages()
        .map((entry) => (typeof entry === "string" ? entry : entry.source))
        .filter((entry) => typeof entry === "string"));
    if (!subcommand || subcommand === "list") {
        printPanel("Lex Packages", [
            "Core packages are installed by default to keep first-run setup fast.",
        ]);
        printSection("Core");
        for (const source of CORE_PACKAGE_SOURCES) {
            printInfo(source);
        }
        printSection("Optional");
        const optionalPresets = listOptionalPackagePresets();
        if (optionalPresets.length === 0) {
            printInfo(`No optional package presets are available on ${process.platform}.`);
            printInfo("Core packages already include memory and session search.");
            return;
        }
        for (const preset of optionalPresets) {
            const installed = preset.sources.every((source) => configuredSources.has(source));
            printInfo(`${preset.name}${installed ? " (installed)" : ""}  ${preset.description}`);
        }
        printInfo(`Install with: lex packages install <${listOptionalPackagePresetInstallTargets().join("|")}>`);
        return;
    }
    if (subcommand !== "install") {
        throw new Error(`Unknown packages command: ${subcommand}`);
    }
    const target = args[0];
    if (!target) {
        const installTargets = listOptionalPackagePresetInstallTargets();
        if (installTargets.length === 0) {
            throw new Error(`No optional package presets are available on ${process.platform}. Core packages already include memory and session search.`);
        }
        throw new Error(`Usage: lex packages install <${installTargets.join("|")}>`);
    }
    const sources = getOptionalPackagePresetSources(target);
    if (!sources) {
        const normalizedPreset = normalizeOptionalPackagePresetName(target);
        if (normalizedPreset === "all-extras") {
            console.log(`No optional package presets are available on ${process.platform}.`);
            console.log("Core packages already include memory and session search.");
            return;
        }
        if (normalizedPreset && !isOptionalPackagePresetSupported(normalizedPreset)) {
            console.log(`${normalizedPreset} is not available on ${process.platform}.`);
            if (normalizedPreset === "generative-ui") {
                console.log("The upstream pi-generative-ui package currently supports macOS only.");
            }
            return;
        }
        if (target === "memory" || target === "session-search") {
            console.log(`${target} is installed by default as a core package.`);
            return;
        }
        throw new Error(`Unknown package preset: ${target}`);
    }
    const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const isStandaloneBundle = !existsSync(resolve(appRoot, ".lex", "runtime-workspace.tgz")) && existsSync(resolve(appRoot, ".lex", "npm"));
    if (target === "generative-ui" && process.platform === "darwin" && isStandaloneBundle) {
        console.log("The generative-ui preset is currently unavailable in the standalone macOS bundle.");
        console.log("Its native glimpseui dependency fails to compile reliably in that environment.");
        console.log("If you need generative-ui, install Lex through npm instead of the standalone bundle.");
        return;
    }
    const pendingSources = sources.filter((source) => !configuredSources.has(source));
    for (const source of sources) {
        if (configuredSources.has(source)) {
            console.log(`${source} already installed`);
        }
    }
    if (pendingSources.length === 0) {
        console.log("Optional packages installed.");
        return;
    }
    try {
        const result = await installPackageSources(workingDir, lexAgentDir, pendingSources, { persist: true });
        for (const skippedSource of result.skipped) {
            console.log(`Skipped ${skippedSource} on Node ${process.versions.node} (native packages are only supported through Node ${MAX_NATIVE_PACKAGE_NODE_MAJOR}.x).`);
        }
        await settingsManager.flush();
        console.log("Optional packages installed.");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("No supported package manager found")) {
            console.log("No package manager is available for optional package installs.");
            console.log("Install npm, pnpm, or bun, or rerun the standalone installer for bundled package updates.");
            return;
        }
        if (message.includes("Installing pi-generative-ui failed")) {
            console.log(message);
            console.log("Skipped optional generative-ui install.");
            return;
        }
        throw error;
    }
}
function handleSearchCommand(subcommand, args) {
    if (!subcommand || subcommand === "status") {
        printSearchStatus();
        return;
    }
    if (subcommand === "set") {
        const provider = args[0];
        const validProviders = ["auto", "perplexity", "exa", "gemini"];
        if (!provider || !validProviders.includes(provider)) {
            throw new Error("Usage: lex search set <auto|perplexity|exa|gemini> [api-key]");
        }
        setSearchProvider(provider, args[1]);
        return;
    }
    if (subcommand === "clear") {
        clearSearchConfig();
        return;
    }
    throw new Error(`Unknown search command: ${subcommand}`);
}
function loadPackageVersion(appRoot) {
    try {
        return JSON.parse(readFileSync(resolve(appRoot, "package.json"), "utf8"));
    }
    catch {
        return {};
    }
}
export function resolveInitialPrompt(command, rest, oneShotPrompt, workflowCommands) {
    if (oneShotPrompt) {
        return oneShotPrompt;
    }
    if (!command) {
        return undefined;
    }
    if (command === "chat") {
        return rest.length > 0 ? rest.join(" ") : undefined;
    }
    if (workflowCommands.has(command)) {
        return [`/${command}`, ...rest].join(" ").trim();
    }
    if (!TOP_LEVEL_COMMANDS.has(command)) {
        return [command, ...rest].join(" ");
    }
    return undefined;
}
export function resolvePiPromptOptions(command, rest, oneShotPrompt, workflowCommands) {
    const resolvedPrompt = resolveInitialPrompt(command, rest, oneShotPrompt, workflowCommands);
    if (!resolvedPrompt) {
        return {};
    }
    if (oneShotPrompt) {
        return { oneShotPrompt: resolvedPrompt };
    }
    return { initialPrompt: resolvedPrompt };
}
export function appendWorkflowFlagPositionals(command, rest, values) {
    const appended = [...rest];
    // Legacy summarize flags
    if (command === "summarize") {
        for (const flag of ["window-size", "overlap", "tier1-threshold", "tier2-threshold"]) {
            const value = values[flag];
            if (typeof value === "string") {
                appended.push(`--${flag}`, value);
            }
        }
    }
    // Lex legal workflow flags — always pass through if present
    for (const flag of ["jurisdiction", "check-type", "contract-type", "parties", "topic"]) {
        const value = values[flag];
        if (typeof value === "string") {
            appended.push(`--${flag}`, value);
        }
    }
    return appended;
}
export function resolveThinkingConfig(rawValue) {
    const explicitThinkingLevel = normalizeThinkingLevel(rawValue);
    return {
        defaultThinkingLevel: explicitThinkingLevel ?? "medium",
        launchThinkingLevel: explicitThinkingLevel,
    };
}
export function shouldRunInteractiveSetup(explicitModelSpec, currentModelSpec, isInteractiveTerminal, authPath) {
    if (explicitModelSpec || !isInteractiveTerminal) {
        return false;
    }
    const status = buildModelStatusSnapshotFromRecords(getSupportedModelRecords(authPath), getAvailableModelRecords(authPath), currentModelSpec);
    return !status.currentValid;
}
export async function main() {
    const here = dirname(fileURLToPath(import.meta.url));
    const appRoot = resolve(here, "..");
    const lexVersion = loadPackageVersion(appRoot).version;
    const bundledSettingsPath = resolve(appRoot, ".lex", "settings.json");
    const lexHome = getLexHome();
    const lexAgentDir = getLexAgentDir(lexHome);
    ensureLexHome(lexHome);
    syncBundledAssets(appRoot, lexAgentDir);
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        allowPositionals: true,
        options: {
            cwd: { type: "string" },
            doctor: { type: "boolean" },
            help: { type: "boolean" },
            version: { type: "boolean" },
            "alpha-login": { type: "boolean" },
            "alpha-logout": { type: "boolean" },
            "alpha-status": { type: "boolean" },
            mode: { type: "string" },
            model: { type: "string" },
            "new-session": { type: "boolean" },
            prompt: { type: "string" },
            "service-tier": { type: "string" },
            "session-dir": { type: "string" },
            "setup-preview": { type: "boolean" },
            "tier1-threshold": { type: "string" },
            "tier2-threshold": { type: "string" },
            thinking: { type: "string" },
            overlap: { type: "string" },
            "window-size": { type: "string" },
            // Lex legal workflow flags — passed through to the prompt as positionals
            "jurisdiction": { type: "string" },
            "check-type": { type: "string" },
            "contract-type": { type: "string" },
            "parties": { type: "string" },
            "topic": { type: "string" },
        },
    });
    if (values.help) {
        printHelp(appRoot);
        return;
    }
    if (values.version) {
        if (lexVersion) {
            console.log(lexVersion);
            return;
        }
        throw new Error("Unable to determine the installed Lex version.");
    }
    const workingDir = resolve(values.cwd ?? process.cwd());
    const sessionDir = resolve(values["session-dir"] ?? getDefaultSessionDir(lexHome));
    const lexSettingsPath = resolve(lexAgentDir, "settings.json");
    const lexAuthPath = resolve(lexAgentDir, "auth.json");
    const { defaultThinkingLevel, launchThinkingLevel } = resolveThinkingConfig(values.thinking ?? process.env.LEX_THINKING);
    normalizeLexSettings(lexSettingsPath, bundledSettingsPath, defaultThinkingLevel, lexAuthPath);
    if (values.doctor) {
        runDoctor({
            settingsPath: lexSettingsPath,
            authPath: lexAuthPath,
            sessionDir,
            workingDir,
            appRoot,
        });
        return;
    }
    if (values["setup-preview"]) {
        const result = setupPreviewDependencies();
        console.log(result.message);
        return;
    }
    if (values["alpha-login"]) {
        await handleAlphaCommand("login");
        return;
    }
    if (values["alpha-logout"]) {
        await handleAlphaCommand("logout");
        return;
    }
    if (values["alpha-status"]) {
        await handleAlphaCommand("status");
        return;
    }
    const [command, ...rest] = positionals;
    if (command === "auth") {
        await handleAuthCommand(appRoot, lexAgentDir);
        return;
    }
    if (command === "help") {
        printHelp(appRoot);
        return;
    }
    if (command === "setup") {
        if (rest[0] === "preview") {
            const result = setupPreviewDependencies();
            console.log(result.message);
            return;
        }
        if (rest[0]) {
            throw new Error(`Unknown setup command: ${rest[0]}`);
        }
        await runSetup({
            settingsPath: lexSettingsPath,
            bundledSettingsPath,
            authPath: lexAuthPath,
            workingDir,
            sessionDir,
            appRoot,
            defaultThinkingLevel,
        });
        return;
    }
    if (command === "doctor") {
        runDoctor({
            settingsPath: lexSettingsPath,
            authPath: lexAuthPath,
            sessionDir,
            workingDir,
            appRoot,
        });
        return;
    }
    if (command === "status") {
        runStatus({
            settingsPath: lexSettingsPath,
            authPath: lexAuthPath,
            sessionDir,
            workingDir,
            appRoot,
        });
        return;
    }
    if (command === "model") {
        await handleModelCommand(rest[0], rest.slice(1), lexSettingsPath, lexAuthPath);
        return;
    }
    if (command === "search") {
        handleSearchCommand(rest[0], rest.slice(1));
        return;
    }
    if (command === "packages") {
        await handlePackagesCommand(rest[0], rest.slice(1), workingDir, lexAgentDir);
        return;
    }
    if (command === "update") {
        await handleUpdateCommand(workingDir, lexAgentDir, rest[0]);
        return;
    }
    if (command === "alpha") {
        await handleAlphaCommand(rest[0]);
        return;
    }
    const explicitModelSpec = values.model ?? process.env.LEX_MODEL;
    const explicitServiceTier = normalizeServiceTier(values["service-tier"] ?? process.env.LEX_SERVICE_TIER);
    const mode = values.mode;
    if (mode !== undefined && mode !== "text" && mode !== "json" && mode !== "rpc") {
        throw new Error("Unknown mode. Use text, json, or rpc.");
    }
    if ((values["service-tier"] ?? process.env.LEX_SERVICE_TIER) && !explicitServiceTier) {
        throw new Error("Unknown service tier. Use auto, default, flex, priority, or standard_only.");
    }
    if (explicitServiceTier) {
        process.env.LEX_SERVICE_TIER = explicitServiceTier;
    }
    if (explicitModelSpec) {
        const modelRegistry = createModelRegistry(lexAuthPath);
        const explicitModel = parseModelSpec(explicitModelSpec, modelRegistry);
        if (!explicitModel) {
            throw new Error(`Unknown model: ${explicitModelSpec}`);
        }
    }
    const currentModelSpec = getCurrentModelSpec(lexSettingsPath);
    if (shouldRunInteractiveSetup(explicitModelSpec, currentModelSpec, Boolean(process.stdin.isTTY && process.stdout.isTTY), lexAuthPath)) {
        await runSetup({
            settingsPath: lexSettingsPath,
            bundledSettingsPath,
            authPath: lexAuthPath,
            workingDir,
            sessionDir,
            appRoot,
            defaultThinkingLevel,
        });
        if (!getCurrentModelSpec(lexSettingsPath)) {
            return;
        }
        normalizeLexSettings(lexSettingsPath, bundledSettingsPath, defaultThinkingLevel, lexAuthPath);
    }
    const workflowCommandNames = new Set(readPromptSpecs(appRoot).filter((s) => s.topLevelCli).map((s) => s.name));
    const workflowRest = appendWorkflowFlagPositionals(command, rest, values);
    const promptOptions = resolvePiPromptOptions(command, workflowRest, values.prompt, workflowCommandNames);
    await launchPiChat({
        appRoot,
        workingDir,
        sessionDir,
        lexAgentDir,
        lexVersion,
        mode,
        thinkingLevel: launchThinkingLevel,
        explicitModelSpec,
        ...promptOptions,
    });
}
