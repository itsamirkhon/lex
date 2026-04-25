import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
export function getLexHome() {
    return resolve(process.env.LEX_HOME ?? homedir(), ".lex");
}
export function getLexAgentDir(home = getLexHome()) {
    return resolve(home, "agent");
}
export function getLexMemoryDir(home = getLexHome()) {
    return resolve(home, "memory");
}
export function getLexStateDir(home = getLexHome()) {
    return resolve(home, ".state");
}
export function getDefaultSessionDir(home = getLexHome()) {
    return resolve(home, "sessions");
}
export function getBootstrapStatePath(home = getLexHome()) {
    return resolve(getLexStateDir(home), "bootstrap.json");
}
export function ensureLexHome(home = getLexHome()) {
    for (const dir of [
        home,
        getLexAgentDir(home),
        getLexMemoryDir(home),
        getLexStateDir(home),
        getDefaultSessionDir(home),
    ]) {
        mkdirSync(dir, { recursive: true });
    }
}
