import { spawn } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { DefaultPackageManager, SettingsManager } from "@mariozechner/pi-coding-agent";
import { NATIVE_PACKAGE_SOURCES, supportsNativePackageSources } from "./package-presets.js";
import { applyLexPackageManagerEnv, getLexNpmPrefixPath } from "./runtime.js";
import { getPathWithCurrentNode, resolveExecutable } from "../system/executables.js";
const FILTERED_INSTALL_OUTPUT_PATTERNS = [
    /npm warn deprecated node-domexception@1\.0\.0/i,
    /npm notice/i,
    /^(added|removed|changed) \d+ packages?( in .+)?$/i,
    /^(\d+ )?packages are looking for funding$/i,
    /^run `npm fund` for details$/i,
];
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
function createPackageContext(workingDir, agentDir) {
    applyLexPackageManagerEnv(agentDir);
    process.env.PATH = getPathWithCurrentNode(process.env.PATH);
    const settingsManager = SettingsManager.create(workingDir, agentDir);
    const packageManager = new DefaultPackageManager({
        cwd: workingDir,
        agentDir,
        settingsManager,
    });
    return {
        settingsManager,
        packageManager,
    };
}
function shouldSkipNativeSource(source, version = process.versions.node) {
    return !supportsNativePackageSources(version) && NATIVE_PACKAGE_SOURCES.includes(source);
}
function filterUnsupportedSources(sources, version = process.versions.node) {
    const supported = [];
    const skipped = [];
    for (const source of sources) {
        if (shouldSkipNativeSource(source, version)) {
            skipped.push(source);
            continue;
        }
        supported.push(source);
    }
    return { supported, skipped };
}
function relayFilteredOutput(chunk, writer) {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
        if (!line.trim())
            continue;
        if (FILTERED_INSTALL_OUTPUT_PATTERNS.some((pattern) => pattern.test(line.trim()))) {
            continue;
        }
        writer.write(`${line}\n`);
    }
}
function parseNpmSource(source) {
    if (!source.startsWith("npm:")) {
        return undefined;
    }
    const spec = source.slice("npm:".length).trim();
    const match = spec.match(/^(@?[^@]+(?:\/[^@]+)?)(?:@(.+))?$/);
    const name = match?.[1] ?? spec;
    const version = match?.[2];
    return {
        name,
        source,
        spec,
        pinned: Boolean(version),
    };
}
function dedupeNpmSources(sources, updateToLatest) {
    const specs = new Map();
    for (const source of sources) {
        const parsed = parseNpmSource(source);
        if (!parsed)
            continue;
        specs.set(parsed.name, updateToLatest && !parsed.pinned ? `${parsed.name}@latest` : parsed.spec);
    }
    return [...specs.values()];
}
function ensureProjectInstallRoot(workingDir) {
    const installRoot = resolve(workingDir, ".lex", "npm");
    mkdirSync(installRoot, { recursive: true });
    const ignorePath = join(installRoot, ".gitignore");
    if (!existsSync(ignorePath)) {
        writeFileSync(ignorePath, "*\n!.gitignore\n", "utf8");
    }
    const packageJsonPath = join(installRoot, "package.json");
    if (!existsSync(packageJsonPath)) {
        writeFileSync(packageJsonPath, JSON.stringify({ name: "lex-packages", private: true }, null, 2) + "\n", "utf8");
    }
    return installRoot;
}
function resolveAdjacentNpmExecutable() {
    const executableName = process.platform === "win32" ? "npm.cmd" : "npm";
    const candidate = resolve(dirname(process.execPath), executableName);
    return existsSync(candidate) ? candidate : undefined;
}
function resolvePackageManagerCommand(settingsManager) {
    const configured = settingsManager.getNpmCommand();
    if (!configured || configured.length === 0) {
        const adjacentNpm = resolveAdjacentNpmExecutable() ?? resolveExecutable("npm");
        return adjacentNpm ? { command: adjacentNpm, args: [] } : undefined;
    }
    const [command = "npm", ...args] = configured;
    if (!command) {
        return undefined;
    }
    const executable = resolveExecutable(command);
    if (!executable) {
        return undefined;
    }
    return { command: executable, args };
}
function childPackageManagerEnv() {
    return {
        ...process.env,
        PATH: getPathWithCurrentNode(process.env.PATH),
        npm_config_dry_run: "false",
        NPM_CONFIG_DRY_RUN: "false",
    };
}
async function runPackageManagerInstall(settingsManager, workingDir, agentDir, scope, specs) {
    if (specs.length === 0) {
        return;
    }
    const packageManagerCommand = resolvePackageManagerCommand(settingsManager);
    if (!packageManagerCommand) {
        throw new Error("No supported package manager found. Install npm, pnpm, or bun, or configure `npmCommand`.");
    }
    const args = [
        ...packageManagerCommand.args,
        "install",
        "--no-audit",
        "--no-fund",
        "--legacy-peer-deps",
        "--loglevel",
        "error",
    ];
    if (scope === "user") {
        args.push("-g", "--prefix", getLexNpmPrefixPath(agentDir));
    }
    else {
        args.push("--prefix", ensureProjectInstallRoot(workingDir));
    }
    args.push(...specs);
    const suppressKnownNativeFailureOutput = process.platform === "darwin" && specs.some((spec) => spec.startsWith("pi-generative-ui"));
    await new Promise((resolvePromise, reject) => {
        const child = spawn(packageManagerCommand.command, args, {
            cwd: scope === "user" ? agentDir : workingDir,
            stdio: ["ignore", "pipe", "pipe"],
            env: childPackageManagerEnv(),
        });
        child.stdout?.on("data", (chunk) => {
            if (!suppressKnownNativeFailureOutput) {
                relayFilteredOutput(chunk, process.stdout);
            }
        });
        child.stderr?.on("data", (chunk) => {
            if (!suppressKnownNativeFailureOutput) {
                relayFilteredOutput(chunk, process.stderr);
            }
        });
        child.on("error", reject);
        child.on("exit", (code) => {
            if ((code ?? 1) !== 0) {
                if (suppressKnownNativeFailureOutput) {
                    reject(new Error("Installing pi-generative-ui failed. Its native glimpseui dependency did not compile against the current macOS/Xcode toolchain. Try the npm-installed Lex path with your local Node toolchain or skip this optional preset for now."));
                    return;
                }
                reject(new Error(`${packageManagerCommand.command} install failed with code ${code ?? 1}`));
                return;
            }
            resolvePromise();
        });
    });
}
function groupConfiguredNpmSources(packages) {
    return {
        user: packages.filter((entry) => entry.scope === "user").map((entry) => entry.source),
        project: packages.filter((entry) => entry.scope === "project").map((entry) => entry.source),
    };
}
function isBundledWorkspacePackagePath(installedPath, appRoot) {
    if (!installedPath) {
        return false;
    }
    const bundledRoot = resolve(appRoot, ".lex", "npm", "node_modules");
    return installedPath.startsWith(bundledRoot);
}
export function getMissingConfiguredPackages(workingDir, agentDir, appRoot) {
    const { packageManager } = createPackageContext(workingDir, agentDir);
    const configured = packageManager.listConfiguredPackages();
    return configured.reduce((summary, entry) => {
        if (entry.installedPath) {
            if (isBundledWorkspacePackagePath(entry.installedPath, appRoot)) {
                summary.bundled.push(entry);
            }
            return summary;
        }
        summary.missing.push(entry);
        return summary;
    }, { missing: [], bundled: [] });
}
export async function installPackageSources(workingDir, agentDir, sources, options) {
    const { settingsManager, packageManager } = createPackageContext(workingDir, agentDir);
    const scope = options?.local ? "project" : "user";
    const installed = [];
    const bundledSeeded = scope === "user" ? seedBundledWorkspacePackages(agentDir, APP_ROOT, sources) : [];
    installed.push(...bundledSeeded);
    const remainingSources = sources.filter((source) => !bundledSeeded.includes(source));
    const grouped = groupConfiguredNpmSources(remainingSources.map((source) => ({
        source,
        scope,
        filtered: false,
    })));
    const { supported: supportedUserSources, skipped } = filterUnsupportedSources(grouped.user);
    const { supported: supportedProjectSources, skipped: skippedProject } = filterUnsupportedSources(grouped.project);
    skipped.push(...skippedProject);
    const supportedNpmSources = scope === "user" ? supportedUserSources : supportedProjectSources;
    if (supportedNpmSources.length > 0) {
        await runPackageManagerInstall(settingsManager, workingDir, agentDir, scope, dedupeNpmSources(supportedNpmSources, false));
        installed.push(...supportedNpmSources);
    }
    for (const source of sources) {
        if (parseNpmSource(source)) {
            continue;
        }
        await packageManager.install(source, { local: options?.local });
        installed.push(source);
    }
    if (options?.persist) {
        for (const source of installed) {
            if (packageManager.addSourceToSettings(source, { local: options?.local })) {
                continue;
            }
            skipped.push(source);
        }
        await settingsManager.flush();
    }
    return { installed, skipped };
}
export async function updateConfiguredPackages(workingDir, agentDir, source) {
    const { settingsManager, packageManager } = createPackageContext(workingDir, agentDir);
    if (source) {
        const parsed = parseNpmSource(source);
        if (parsed) {
            if (shouldSkipNativeSource(source)) {
                return { updated: [], skipped: [source] };
            }
            const configured = packageManager.listConfiguredPackages();
            const match = configured.find((entry) => entry.source === source);
            if (!match) {
                throw new Error(`No matching package found for ${source}`);
            }
            await runPackageManagerInstall(settingsManager, workingDir, agentDir, match.scope, dedupeNpmSources([source], true));
            return { updated: [source], skipped: [] };
        }
        await packageManager.update(source);
        return { updated: [source], skipped: [] };
    }
    const availableUpdates = await packageManager.checkForAvailableUpdates();
    if (availableUpdates.length === 0) {
        return { updated: [], skipped: [] };
    }
    const npmUpdatesByScope = { user: [], project: [] };
    const gitUpdates = [];
    const skipped = [];
    for (const entry of availableUpdates) {
        if (entry.type === "npm") {
            if (shouldSkipNativeSource(entry.source)) {
                skipped.push(entry.source);
                continue;
            }
            npmUpdatesByScope[entry.scope].push(entry.source);
            continue;
        }
        gitUpdates.push(entry.source);
    }
    for (const scope of ["user", "project"]) {
        const sources = npmUpdatesByScope[scope];
        if (sources.length === 0)
            continue;
        await runPackageManagerInstall(settingsManager, workingDir, agentDir, scope, dedupeNpmSources(sources, true));
    }
    for (const gitSource of gitUpdates) {
        await packageManager.update(gitSource);
    }
    return {
        updated: availableUpdates
            .map((entry) => entry.source)
            .filter((source) => !skipped.includes(source)),
        skipped,
    };
}
function ensureParentDir(path) {
    mkdirSync(dirname(path), { recursive: true });
}
function pathsMatchSymlinkTarget(linkPath, targetPath) {
    try {
        if (!lstatSync(linkPath).isSymbolicLink()) {
            return false;
        }
        return resolve(dirname(linkPath), readlinkSync(linkPath)) === targetPath;
    }
    catch {
        return false;
    }
}
function linkDirectory(linkPath, targetPath) {
    if (pathsMatchSymlinkTarget(linkPath, targetPath)) {
        return;
    }
    try {
        if (existsSync(linkPath) && lstatSync(linkPath).isSymbolicLink()) {
            rmSync(linkPath, { force: true });
        }
    }
    catch { }
    if (existsSync(linkPath)) {
        return;
    }
    ensureParentDir(linkPath);
    try {
        symlinkSync(targetPath, linkPath, process.platform === "win32" ? "junction" : "dir");
    }
    catch {
        // Fallback for filesystems that do not allow symlinks.
        if (!existsSync(linkPath)) {
            cpSync(targetPath, linkPath, { recursive: true });
        }
    }
}
function packageNameToPath(root, packageName) {
    return resolve(root, packageName);
}
function listBundledWorkspacePackageNames(root) {
    if (!existsSync(root)) {
        return [];
    }
    const names = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory() && !entry.isSymbolicLink())
            continue;
        if (entry.name.startsWith("."))
            continue;
        if (entry.name.startsWith("@")) {
            const scopeRoot = resolve(root, entry.name);
            for (const scopedEntry of readdirSync(scopeRoot, { withFileTypes: true })) {
                if (!scopedEntry.isDirectory() && !scopedEntry.isSymbolicLink())
                    continue;
                names.push(`${entry.name}/${scopedEntry.name}`);
            }
            continue;
        }
        names.push(entry.name);
    }
    return names;
}
function packageDependencyExists(packagePath, globalNodeModulesRoot, dependency) {
    return existsSync(packageNameToPath(resolve(packagePath, "node_modules"), dependency)) ||
        existsSync(packageNameToPath(globalNodeModulesRoot, dependency));
}
function installedPackageLooksUsable(packagePath, globalNodeModulesRoot) {
    if (!existsSync(resolve(packagePath, "package.json"))) {
        return false;
    }
    try {
        const pkg = JSON.parse(readFileSync(resolve(packagePath, "package.json"), "utf8"));
        const dependencies = Object.keys(pkg.dependencies ?? {});
        return dependencies.every((dependency) => packageDependencyExists(packagePath, globalNodeModulesRoot, dependency));
    }
    catch {
        return false;
    }
}
function replaceBrokenPackageWithBundledCopy(targetPath, bundledPackagePath, globalNodeModulesRoot) {
    if (!existsSync(targetPath)) {
        return false;
    }
    if (pathsMatchSymlinkTarget(targetPath, bundledPackagePath)) {
        return false;
    }
    if (installedPackageLooksUsable(targetPath, globalNodeModulesRoot)) {
        return false;
    }
    rmSync(targetPath, { recursive: true, force: true });
    linkDirectory(targetPath, bundledPackagePath);
    return true;
}
function seedBundledPackage(globalNodeModulesRoot, bundledNodeModulesRoot, packageName) {
    const bundledPackagePath = resolve(bundledNodeModulesRoot, packageName);
    if (!existsSync(bundledPackagePath)) {
        return false;
    }
    const targetPath = resolve(globalNodeModulesRoot, packageName);
    if (replaceBrokenPackageWithBundledCopy(targetPath, bundledPackagePath, globalNodeModulesRoot)) {
        return true;
    }
    if (!existsSync(targetPath)) {
        linkDirectory(targetPath, bundledPackagePath);
        return true;
    }
    return false;
}
export function seedBundledWorkspacePackages(agentDir, appRoot, sources) {
    const bundledNodeModulesRoot = resolve(appRoot, ".lex", "npm", "node_modules");
    if (!existsSync(bundledNodeModulesRoot)) {
        return [];
    }
    const globalNodeModulesRoot = resolve(getLexNpmPrefixPath(agentDir), "lib", "node_modules");
    const seeded = [];
    const bundledPackageNames = listBundledWorkspacePackageNames(bundledNodeModulesRoot);
    for (const packageName of bundledPackageNames) {
        seedBundledPackage(globalNodeModulesRoot, bundledNodeModulesRoot, packageName);
    }
    for (const source of sources) {
        if (shouldSkipNativeSource(source))
            continue;
        const parsed = parseNpmSource(source);
        if (!parsed)
            continue;
        const targetPath = resolve(globalNodeModulesRoot, parsed.name);
        if (pathsMatchSymlinkTarget(targetPath, resolve(bundledNodeModulesRoot, parsed.name))) {
            seeded.push(source);
        }
    }
    return seeded;
}
