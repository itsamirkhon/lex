# Contributing to Lex

Lex is a BMW legal AI agent platform built on Pi. Keep changes focused on legal workflows, runtime reliability, and clear operator-facing behavior.

## Guidelines

- Use `lex` in commands, docs, env vars, and user-facing messages.
- Store Lex runtime state under `.lex` or `~/.lex`.
- Keep generated artifacts such as `web/.next` and `.lex/npm` out of source changes unless a task explicitly requires refreshing runtime bundles.
- Prefer small, verifiable changes and run the relevant checks before delivery.
