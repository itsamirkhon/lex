# Agents

`AGENTS.md` is the repo-level contract for agents working in this repository.

## Project Conventions

- Lex agent definitions live in `.lex/agents/`.
- Runtime settings and bundled package state live in `.lex/`.
- Legal workflow outputs go in `outputs/`.
- Matter-specific work should use `matters/` when present.
- Do not commit generated build output unless explicitly requested.

## Verification

- Prefer source-grounded legal outputs with clear assumptions and jurisdiction notes.
- For code changes, run the narrowest relevant checks first, then broader checks when practical.
- Mark unverified claims honestly instead of smoothing over missing checks.
