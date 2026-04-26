import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { getBootstrapStatePath } from "../config/paths.js";
function sha256(text) {
    return createHash("sha256").update(text).digest("hex");
}
function readBootstrapState(path) {
    if (!existsSync(path)) {
        return { version: 1, files: {} };
    }
    try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        return {
            version: 1,
            files: parsed.files && typeof parsed.files === "object" ? parsed.files : {},
        };
    }
    catch {
        return { version: 1, files: {} };
    }
}
function writeBootstrapState(path, state) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(state, null, 2) + "\n", "utf8");
}
function listFiles(root) {
    if (!existsSync(root)) {
        return [];
    }
    const files = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        const path = resolve(root, entry.name);
        if (entry.isDirectory()) {
            files.push(...listFiles(path));
            continue;
        }
        if (entry.isFile()) {
            files.push(path);
        }
    }
    return files.sort();
}
function removeEmptyParentDirectories(path, stopAt) {
    let current = dirname(path);
    while (current.startsWith(stopAt) && current !== stopAt) {
        if (!existsSync(current)) {
            current = dirname(current);
            continue;
        }
        if (readdirSync(current).length > 0) {
            return;
        }
        rmSync(current, { recursive: true, force: true });
        current = dirname(current);
    }
}
function syncManagedFiles(sourceRoot, targetRoot, scope, state, result) {
    const sourcePaths = new Set(listFiles(sourceRoot).map((sourcePath) => relative(sourceRoot, sourcePath)));
    for (const targetPath of listFiles(targetRoot)) {
        const key = relative(targetRoot, targetPath);
        if (sourcePaths.has(key))
            continue;
        const scopedKey = `${scope}:${key}`;
        const previous = state.files[scopedKey] ?? state.files[key];
        if (!previous) {
            continue;
        }
        if (!existsSync(targetPath)) {
            delete state.files[scopedKey];
            delete state.files[key];
            continue;
        }
        const currentTargetText = readFileSync(targetPath, "utf8");
        const currentTargetHash = sha256(currentTargetText);
        if (currentTargetHash !== previous.lastAppliedTargetHash) {
            result.skipped.push(key);
            continue;
        }
        rmSync(targetPath, { force: true });
        removeEmptyParentDirectories(targetPath, targetRoot);
        delete state.files[scopedKey];
        delete state.files[key];
    }
    for (const sourcePath of listFiles(sourceRoot)) {
        const key = relative(sourceRoot, sourcePath);
        const targetPath = resolve(targetRoot, key);
        const sourceText = readFileSync(sourcePath, "utf8");
        const sourceHash = sha256(sourceText);
        const scopedKey = `${scope}:${key}`;
        const previous = state.files[scopedKey] ?? state.files[key];
        mkdirSync(dirname(targetPath), { recursive: true });
        if (!existsSync(targetPath)) {
            writeFileSync(targetPath, sourceText, "utf8");
            state.files[scopedKey] = {
                lastAppliedSourceHash: sourceHash,
                lastAppliedTargetHash: sourceHash,
            };
            delete state.files[key];
            result.copied.push(key);
            continue;
        }
        const currentTargetText = readFileSync(targetPath, "utf8");
        const currentTargetHash = sha256(currentTargetText);
        if (currentTargetHash === sourceHash) {
            state.files[scopedKey] = {
                lastAppliedSourceHash: sourceHash,
                lastAppliedTargetHash: currentTargetHash,
            };
            delete state.files[key];
            continue;
        }
        if (!previous) {
            result.skipped.push(key);
            continue;
        }
        if (currentTargetHash !== previous.lastAppliedTargetHash) {
            result.skipped.push(key);
            continue;
        }
        writeFileSync(targetPath, sourceText, "utf8");
        state.files[scopedKey] = {
            lastAppliedSourceHash: sourceHash,
            lastAppliedTargetHash: sourceHash,
        };
        delete state.files[key];
        result.updated.push(key);
    }
}
export function syncBundledAssets(appRoot, agentDir) {
    const statePath = getBootstrapStatePath();
    const state = readBootstrapState(statePath);
    const result = {
        copied: [],
        updated: [],
        skipped: [],
    };
    syncManagedFiles(resolve(appRoot, ".lex", "themes"), resolve(agentDir, "themes"), "themes", state, result);
    syncManagedFiles(resolve(appRoot, ".lex", "agents"), resolve(agentDir, "agents"), "agents", state, result);
    syncManagedFiles(resolve(appRoot, "skills"), resolve(agentDir, "skills"), "skills", state, result);
    writeBootstrapState(statePath, state);
    return result;
}
export function syncBundledWorkspaceAssets(appRoot, workingDir) {
    const statePath = getBootstrapStatePath();
    const state = readBootstrapState(statePath);
    const result = {
        copied: [],
        updated: [],
        skipped: [],
    };
    syncManagedFiles(resolve(appRoot, "knowledge-base"), resolve(workingDir, "knowledge-base"), `workspace:${workingDir}:knowledge-base`, state, result);
    writeBootstrapState(statePath, state);
    return result;
}
