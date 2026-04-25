import { confirm as clackConfirm, intro as clackIntro, isCancel, multiselect as clackMultiselect, outro as clackOutro, select as clackSelect, text as clackText, } from "@clack/prompts";
export class SetupCancelledError extends Error {
    constructor(message = "setup cancelled") {
        super(message);
        this.name = "SetupCancelledError";
    }
}
function ensureInteractiveTerminal() {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error("feynman setup requires an interactive terminal.");
    }
}
function guardCancelled(value) {
    if (isCancel(value)) {
        throw new SetupCancelledError();
    }
    return value;
}
export function isInteractiveTerminal() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
export async function promptIntro(title) {
    ensureInteractiveTerminal();
    clackIntro(title);
}
export async function promptOutro(message) {
    ensureInteractiveTerminal();
    clackOutro(message);
}
export async function promptText(question, defaultValue = "", placeholder) {
    ensureInteractiveTerminal();
    const value = guardCancelled(await clackText({
        message: question,
        initialValue: defaultValue || undefined,
        placeholder: placeholder ?? (defaultValue || undefined),
    }));
    const normalized = String(value ?? "").trim();
    return normalized || defaultValue;
}
export async function promptSelect(question, options, initialValue) {
    ensureInteractiveTerminal();
    const selection = guardCancelled(await clackSelect({
        message: question,
        options: options.map((option) => ({
            value: option.value,
            label: option.label,
            hint: option.hint,
        })),
        initialValue,
    }));
    return selection;
}
export async function promptChoice(question, choices, defaultIndex = 0) {
    const options = choices.map((choice, index) => ({
        value: index,
        label: choice,
    }));
    return promptSelect(question, options, Math.max(0, Math.min(defaultIndex, choices.length - 1)));
}
export async function promptConfirm(question, initialValue = true) {
    ensureInteractiveTerminal();
    return guardCancelled(await clackConfirm({
        message: question,
        initialValue,
    }));
}
export async function promptMultiSelect(question, options, initialValues = []) {
    ensureInteractiveTerminal();
    const selection = guardCancelled(await clackMultiselect({
        message: question,
        options: options.map((option) => ({
            value: option.value,
            label: option.label,
            hint: option.hint,
        })),
        initialValues,
        required: false,
    }));
    return selection;
}
