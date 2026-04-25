import { existsSync, readFileSync } from "node:fs";
import { delimiter, dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BROWSER_FALLBACK_PATHS, MERMAID_FALLBACK_PATHS, PANDOC_FALLBACK_PATHS, resolveExecutable, } from "../system/executables.js";
export function getFeynmanNpmPrefixPath(lexAgentDir) {
    return resolve(dirname(lexAgentDir), "npm-global");
}
export function applyFeynmanPackageManagerEnv(lexAgentDir) {
    const lexNpmPrefixPath = getFeynmanNpmPrefixPath(lexAgentDir);
    process.env.LEX_NPM_PREFIX = lexNpmPrefixPath;
    process.env.NPM_CONFIG_PREFIX = lexNpmPrefixPath;
    process.env.npm_config_prefix = lexNpmPrefixPath;
    return lexNpmPrefixPath;
}
export function resolvePiPaths(appRoot) {
    return {
        piPackageRoot: resolve(appRoot, "node_modules", "@mariozechner", "pi-coding-agent"),
        piCliPath: resolve(appRoot, "node_modules", "@mariozechner", "pi-coding-agent", "dist", "cli.js"),
        piMainPath: resolve(appRoot, "node_modules", "@mariozechner", "pi-coding-agent", "dist", "main.js"),
        piCliWrapperPath: resolve(appRoot, "dist", "pi", "pi-cli-wrapper.js"),
        piCliWrapperSourcePath: resolve(appRoot, "src", "pi", "pi-cli-wrapper.ts"),
        promisePolyfillPath: resolve(appRoot, "dist", "system", "promise-polyfill.js"),
        promisePolyfillSourcePath: resolve(appRoot, "src", "system", "promise-polyfill.ts"),
        tsxLoaderPath: resolve(appRoot, "node_modules", "tsx", "dist", "loader.mjs"),
        researchToolsPath: resolve(appRoot, "extensions", "legal-tools.ts"),
        promptTemplatePath: resolve(appRoot, "prompts"),
        systemPromptPath: resolve(appRoot, ".lex", "SYSTEM.md"),
        piWorkspaceNodeModulesPath: resolve(appRoot, ".lex", "npm", "node_modules"),
        nodeModulesBinPath: resolve(appRoot, "node_modules", ".bin"),
    };
}
export function toNodeImportSpecifier(modulePath) {
    return isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath;
}
export function validatePiInstallation(appRoot) {
    const paths = resolvePiPaths(appRoot);
    const missing = [];
    if (!existsSync(paths.piCliPath))
        missing.push(paths.piCliPath);
    if (!existsSync(paths.piMainPath))
        missing.push(paths.piMainPath);
    if (!existsSync(paths.piCliWrapperPath)) {
        const hasDevWrapper = existsSync(paths.piCliWrapperSourcePath) && existsSync(paths.tsxLoaderPath);
        if (!hasDevWrapper)
            missing.push(paths.piCliWrapperPath);
    }
    if (!existsSync(paths.promisePolyfillPath)) {
        // Dev fallback: allow running from source without `dist/` build artifacts.
        const hasDevPolyfill = existsSync(paths.promisePolyfillSourcePath) && existsSync(paths.tsxLoaderPath);
        if (!hasDevPolyfill)
            missing.push(paths.promisePolyfillPath);
    }
    if (!existsSync(paths.researchToolsPath))
        missing.push(paths.researchToolsPath);
    if (!existsSync(paths.promptTemplatePath))
        missing.push(paths.promptTemplatePath);
    return missing;
}
export function buildPiArgs(options, paths = resolvePiPaths(options.appRoot)) {
    const args = [
        "--session-dir",
        options.sessionDir,
        "--extension",
        paths.researchToolsPath,
        "--prompt-template",
        paths.promptTemplatePath,
    ];
    if (existsSync(paths.systemPromptPath)) {
        args.push("--system-prompt", readFileSync(paths.systemPromptPath, "utf8"));
    }
    if (options.mode) {
        args.push("--mode", options.mode);
    }
    if (options.explicitModelSpec) {
        args.push("--model", options.explicitModelSpec);
    }
    if (options.thinkingLevel) {
        args.push("--thinking", options.thinkingLevel);
    }
    if (options.oneShotPrompt) {
        args.push("-p", options.oneShotPrompt);
    }
    else if (options.initialPrompt) {
        args.push(options.initialPrompt);
    }
    return args;
}
export function buildPiEnv(options, paths = resolvePiPaths(options.appRoot), executables) {
    const lexNpmPrefixPath = getFeynmanNpmPrefixPath(options.feynmanAgentDir);
    const lexNpmBinPath = resolve(lexNpmPrefixPath, "bin");
    const lexWebSearchConfigPath = resolve(dirname(options.feynmanAgentDir), "web-search.json");
    const currentPath = process.env.PATH ?? "";
    const binEntries = [paths.nodeModulesBinPath, resolve(paths.piWorkspaceNodeModulesPath, ".bin"), lexNpmBinPath];
    const binPath = binEntries.join(delimiter);
    const pandocPath = process.env.PANDOC_PATH ?? executables?.pandoc ?? resolveExecutable("pandoc", PANDOC_FALLBACK_PATHS);
    const mermaidPath = process.env.MERMAID_CLI_PATH ?? executables?.mermaid ?? resolveExecutable("mmdc", MERMAID_FALLBACK_PATHS);
    const browserPath = process.env.PUPPETEER_EXECUTABLE_PATH ?? executables?.browser ?? resolveExecutable("google-chrome", BROWSER_FALLBACK_PATHS);
    return {
        ...process.env,
        PATH: `${binPath}${delimiter}${currentPath}`,
        LEX_VERSION: options.feynmanVersion,
        LEX_SESSION_DIR: options.sessionDir,
        LEX_MEMORY_DIR: resolve(dirname(options.feynmanAgentDir), "memory"),
        LEX_WEB_SEARCH_CONFIG: lexWebSearchConfigPath,
        LEX_NODE_EXECUTABLE: process.execPath,
        LEX_BIN_PATH: resolve(options.appRoot, "bin", "lex.js"),
        LEX_PI_CLI_PATH: paths.piCliPath,
        LEX_NPM_PREFIX: lexNpmPrefixPath,
        // Ensure the Pi child process uses Lex's agent dir for auth/models/settings.
        FEYNMAN_CODING_AGENT_DIR: options.feynmanAgentDir,
        PI_CODING_AGENT_DIR: options.feynmanAgentDir,
        PANDOC_PATH: pandocPath,
        PI_HARDWARE_CURSOR: process.env.PI_HARDWARE_CURSOR ?? "1",
        PI_SKIP_VERSION_CHECK: process.env.PI_SKIP_VERSION_CHECK ?? "1",
        MERMAID_CLI_PATH: mermaidPath,
        PUPPETEER_EXECUTABLE_PATH: browserPath,
        // Always pin npm's global prefix to the Feynman workspace. npm injects
        // lowercase config vars into child processes, which would otherwise leak
        // the caller's global prefix into Pi.
        NPM_CONFIG_PREFIX: lexNpmPrefixPath,
        npm_config_prefix: lexNpmPrefixPath,
    };
}
