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
const webBinPath = resolve(repoRoot, "bin", "lex-web.js");
const isWindows = platform() === "win32";
const binDir = process.env.LEX_BIN_DIR || (isWindows ? resolve(homedir(), "AppData", "Local", "Microsoft", "WindowsApps") : resolve(homedir(), ".local", "bin"));
const wrapperPath = resolve(binDir, isWindows ? "lex.cmd" : "lex");
const webWrapperPath = resolve(binDir, isWindows ? "lex-web.cmd" : "lex-web");
const fallbackWrapperPath = resolve(binDir, isWindows ? "bmw-lex.cmd" : "bmw-lex");
const fallbackWebWrapperPath = resolve(binDir, isWindows ? "bmw-lex-web.cmd" : "bmw-lex-web");
const legacyCommand = "bmw" + "lex";
const oldWrapperPath = resolve(binDir, isWindows ? `${legacyCommand}.cmd` : legacyCommand);

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
		writeFileSync(webWrapperPath, `@echo off\r\nnode "${webBinPath}" %*\r\n`, "utf8");
		writeFileSync(fallbackWrapperPath, `@echo off\r\nnode "${binPath}" %*\r\n`, "utf8");
		writeFileSync(fallbackWebWrapperPath, `@echo off\r\nnode "${webBinPath}" %*\r\n`, "utf8");
		return;
	}
	writeFileSync(wrapperPath, `#!/bin/sh\nexec node ${shellQuote(binPath)} "$@"\n`, "utf8");
	writeFileSync(webWrapperPath, `#!/bin/sh\nexec node ${shellQuote(webBinPath)} "$@"\n`, "utf8");
	writeFileSync(fallbackWrapperPath, `#!/bin/sh\nexec node ${shellQuote(binPath)} "$@"\n`, "utf8");
	writeFileSync(fallbackWebWrapperPath, `#!/bin/sh\nexec node ${shellQuote(webBinPath)} "$@"\n`, "utf8");
	chmodSync(wrapperPath, 0o755);
	chmodSync(webWrapperPath, 0o755);
	chmodSync(fallbackWrapperPath, 0o755);
	chmodSync(fallbackWebWrapperPath, 0o755);
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

function detectProfiles() {
	if (isWindows) return undefined;
	const shell = process.env.SHELL || "";
	const profiles = [];
	if (shell.endsWith("/zsh")) profiles.push(resolve(homedir(), ".zshrc"));
	if (shell.endsWith("/bash")) profiles.push(resolve(homedir(), ".bashrc"));
	profiles.push(resolve(homedir(), ".profile"));
	profiles.push(resolve(homedir(), ".bashrc"));
	profiles.push(resolve(homedir(), ".zshrc"));
	return [...new Set(profiles)];
}

function pathNeedsPrepend() {
	const pathParts = (process.env.PATH || "").split(":");
	const binIndex = pathParts.indexOf(binDir);
	const systemIndex = pathParts.indexOf("/usr/bin");
	return binIndex === -1 || (systemIndex !== -1 && binIndex > systemIndex);
}

function ensurePathInProfile() {
	if (process.env.LEX_SKIP_PROFILE === "1") return;
	if (isWindows) return;
	if (!pathNeedsPrepend()) return;

	const profiles = detectProfiles();
	if (!profiles) return;
	const line = `export PATH="${binDir}:$PATH"`;
	const aliasLine = `alias lex="${wrapperPath}"`;
	const webAliasLine = `alias lex-web="${webWrapperPath}"`;
	for (const profile of profiles) {
		let existing = "";
		try {
			existing = readFileSync(profile, "utf8");
		} catch {
			// The profile may not exist yet.
		}
		if (!existing.includes(line)) {
			const block = `# Added by Lex installer\n${line}\n${aliasLine}\n${webAliasLine}\n`;
			writeFileSync(profile, `${existing}${existing.endsWith("\n") || existing.length === 0 ? "" : "\n"}\n${block}`, "utf8");
			log(`added ${binDir} to ${profile}`);
		}
	}
}

writeWrapper();
maybeRemoveOldWrapper();
ensurePathInProfile();

log(`installed command: ${wrapperPath}`);
log(`installed command: ${webWrapperPath}`);
log(`fallback command: ${fallbackWrapperPath}`);
log(`fallback command: ${fallbackWebWrapperPath}`);
if (!isWindows && !(process.env.PATH || "").split(":").includes(binDir)) {
	log(`for this terminal, run: export PATH="${binDir}:$PATH"`);
}
log("next: lex auth");
log("if `lex auth` prints `flex: can't open auth`, run `bmw-lex auth` or move ~/.local/bin before /usr/bin in PATH.");
log("web: lex-web");
