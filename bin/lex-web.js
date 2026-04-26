#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createServer } from "node:net";
import { homedir } from "node:os";

const here = import.meta.dirname;
const appRoot = resolve(here, "..");
const webDir = resolve(appRoot, "web");
const nextBinCandidates = [
	resolve(appRoot, "node_modules", "next", "dist", "bin", "next"),
	resolve(webDir, "node_modules", "next", "dist", "bin", "next"),
];
const nextBin = nextBinCandidates.find((candidate) => existsSync(candidate));

function printHelp() {
	console.log(`Usage: lex-web [options]

Start the Lex web interface.

Options:
  --port, -p <port>       Port to listen on (default: 3000)
  --host, -H <host>       Hostname to bind (default: localhost)
  --cwd <path>            Workspace for outputs/uploads (default: current directory)
  --no-open               Do not open the browser automatically
  --help, -h              Show this help
`);
}

function takeValue(args, index, name) {
	const value = args[index + 1];
	if (!value || value.startsWith("-")) {
		throw new Error(`Missing value for ${name}`);
	}
	return value;
}

function parseArgs(argv) {
	const options = {
		port: process.env.LEX_WEB_PORT || "3000",
		host: process.env.LEX_WEB_HOST || "localhost",
		workspaceRoot: process.cwd(),
		open: process.env.LEX_WEB_OPEN !== "0",
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") {
			options.help = true;
		} else if (arg === "--port" || arg === "-p") {
			options.port = takeValue(argv, i, arg);
			i += 1;
		} else if (arg?.startsWith("--port=")) {
			options.port = arg.slice("--port=".length);
		} else if (arg === "--host" || arg === "-H") {
			options.host = takeValue(argv, i, arg);
			i += 1;
		} else if (arg?.startsWith("--host=")) {
			options.host = arg.slice("--host=".length);
		} else if (arg === "--cwd") {
			options.workspaceRoot = resolve(takeValue(argv, i, arg));
			i += 1;
		} else if (arg?.startsWith("--cwd=")) {
			options.workspaceRoot = resolve(arg.slice("--cwd=".length));
		} else if (arg === "--no-open") {
			options.open = false;
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}
	return options;
}

function openBrowser(url) {
	const platform = process.platform;
	const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
	const args = platform === "win32" ? ["/c", "start", "", url] : [url];
	const child = spawn(command, args, { detached: true, stdio: "ignore" });
	child.unref();
}

function appendNodeOption(current, option) {
	return current?.trim() ? `${current.trim()} ${option}` : option;
}

function isPortAvailable(host, port) {
	return new Promise((resolveAvailability) => {
		const server = createServer();
		server.once("error", () => resolveAvailability(false));
		server.once("listening", () => {
			server.close(() => resolveAvailability(true));
		});
		server.listen(port, host);
	});
}

async function findAvailablePort(host, preferredPort) {
	const parsed = Number.parseInt(String(preferredPort), 10);
	if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
		throw new Error(`Invalid port: ${preferredPort}`);
	}
	for (let port = parsed; port < parsed + 50 && port <= 65535; port += 1) {
		if (await isPortAvailable(host, port)) return String(port);
	}
	throw new Error(`No available port found between ${parsed} and ${Math.min(parsed + 49, 65535)}.`);
}

function copyWebApp(sourceDir, targetDir) {
	rmSync(targetDir, { recursive: true, force: true });
	cpSync(sourceDir, targetDir, {
		recursive: true,
		filter(source) {
			const parts = relative(sourceDir, source).split(sep);
			return !parts.includes(".next") && !parts.includes("node_modules");
		},
	});
}

function linkNodeModules(targetDir) {
	const source = existsSync(resolve(appRoot, "node_modules"))
		? resolve(appRoot, "node_modules")
		: resolve(webDir, "node_modules");
	const link = resolve(targetDir, "node_modules");
	rmSync(link, { recursive: true, force: true });
	symlinkSync(source, link, process.platform === "win32" ? "junction" : "dir");
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
	printHelp();
	process.exit(0);
}

if (!existsSync(resolve(webDir, "package.json"))) {
	throw new Error(`Lex web app is missing from the package: ${webDir}`);
}
if (!nextBin) {
	throw new Error("Next.js is not installed. Reinstall with `npm install -g bmw-lex@latest`.");
}

await import(pathToFileURL(resolve(appRoot, "scripts", "patch-embedded-pi.mjs")).href);

const requestedPort = options.port;
options.port = await findAvailablePort(options.host, options.port);
const url = `http://${options.host}:${options.port}`;
const lexStateDir = resolve(options.workspaceRoot, ".lex");
mkdirSync(lexStateDir, { recursive: true });
const runtimeWebRoot = resolve(process.env.LEX_WEB_RUNTIME_DIR ?? resolve(homedir(), ".lex", "web-runtime"));
mkdirSync(runtimeWebRoot, { recursive: true });
const runtimeWebDir = resolve(runtimeWebRoot, "app");
copyWebApp(webDir, runtimeWebDir);
linkNodeModules(runtimeWebDir);
const nodeOptions = appendNodeOption(process.env.NODE_OPTIONS, `--localstorage-file=${resolve(lexStateDir, "web-localstorage")}`);
if (options.port !== requestedPort) {
	console.log(`Port ${requestedPort} is busy; using ${options.port} instead.`);
}
console.log(`Lex web starting at ${url}`);
console.log(`Workspace: ${options.workspaceRoot}`);
console.log("Press Ctrl+C to stop.");

const child = spawn(process.execPath, [nextBin, "dev", "--port", options.port, "--hostname", options.host], {
	cwd: runtimeWebDir,
	stdio: "inherit",
	env: {
		...process.env,
		LEX_APP_ROOT: appRoot,
		LEX_WORKSPACE_ROOT: options.workspaceRoot,
		NODE_OPTIONS: nodeOptions,
	},
});

if (options.open) {
	setTimeout(() => openBrowser(url), 1500).unref();
}

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, () => {
		shuttingDown = true;
		child.kill(signal);
		setTimeout(() => process.exit(0), 1000).unref();
	});
}

child.on("exit", (code, signal) => {
	if (signal && !shuttingDown) process.exit(128);
	process.exit(code ?? 0);
});
