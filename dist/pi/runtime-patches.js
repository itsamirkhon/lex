import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { patchPiAgentCoreSource } from "../../scripts/lib/pi-agent-core-patch.mjs";
function patchFileIfPresent(path) {
    if (!existsSync(path)) {
        return false;
    }
    const source = readFileSync(path, "utf8");
    const patched = patchPiAgentCoreSource(source);
    if (patched === source) {
        return false;
    }
    writeFileSync(path, patched, "utf8");
    return true;
}
export function patchPiRuntimeNodeModules(appRoot) {
    return patchFileIfPresent(resolve(appRoot, "node_modules", "@mariozechner", "pi-agent-core", "dist", "agent-loop.js"));
}
