#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.LEX_SKIP_POSTINSTALL === "1") {
	process.exit(0);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const binPath = resolve(repoRoot, "bin", "lex.js");
const isWindows = platform() === "win32";
const binDir = process.env.LEX_BIN_DIR || (isWindows ? resolve(homedir(), "AppData", "Local", "Microsoft", "WindowsApps") : resolve(homedir(), ".local", "bin"));
const wrapperPath = resolve(binDir, isWindows ? "lex.cmd" : "lex");
const oldWrapperPath = resolve(binDir, isWindows ? "bmwlex.cmd" : "bmwlex");

function log(message) {
	process.stdout.write(`[lex] ${message}\n`);
}

function shellQuote(value) {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

function writeWrapper() {
	mkdirSync(binDir, { recursive: true });
	if (isWindows) {
		writeFileSync(wrapperPath, `@echo off\r\nnode "${binPath}" %*\r\n`, "utf8");
		return;
	}
	writeFileSync(wrapperPath, `#!/bin/sh\nexec node ${shellQuote(binPath)} "$@"\n`, "utf8");
	chmodSync(wrapperPath, 0o755);
}

function maybeRemoveOldWrapper() {
	if (!existsSync(oldWrapperPath)) return;
	try {
		const content = readFileSync(oldWrapperPath, "utf8");
		if (content.includes(binPath) || content.includes(resolve(repoRoot, "bin", "lex.js")) || content.includes("/bin/lex.js") || content.includes("\\bin\\lex.js")) {
			rmSync(oldWrapperPath, { force: true });
			log(`removed old ${oldWrapperPath}`);
		}
	} catch {
		// Ignore unreadable stale wrappers; installing lex should still succeed.
	}
}

function detectProfile() {
	if (isWindows) return undefined;
	const shell = process.env.SHELL || "";
	if (shell.endsWith("/zsh")) return resolve(homedir(), ".zshrc");
	if (shell.endsWith("/bash")) return resolve(homedir(), ".bashrc");
	return resolve(homedir(), ".profile");
}

function ensurePathInProfile() {
	if (isWindows) return;
	const pathParts = (process.env.PATH || "").split(":");
	if (pathParts.includes(binDir)) return;

	const profile = detectProfile();
	if (!profile) return;
	const line = `export PATH="${binDir}:$PATH"`;
	let existing = "";
	try {
		existing = readFileSync(profile, "utf8");
	} catch {
		// The profile may not exist yet.
	}
	if (!existing.includes(line)) {
		writeFileSync(profile, `${existing}${existing.endsWith("\n") || existing.length === 0 ? "" : "\n"}\n# Added by Lex installer\n${line}\n`, "utf8");
		log(`added ${binDir} to ${profile}`);
	}
}

writeWrapper();
maybeRemoveOldWrapper();
ensurePathInProfile();

log(`installed command: ${wrapperPath}`);
if (!isWindows && !(process.env.PATH || "").split(":").includes(binDir)) {
	log(`for this terminal, run: export PATH="${binDir}:$PATH"`);
}
log("next: lex auth");
