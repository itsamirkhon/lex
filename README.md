# Lex

Lex is a BMW legal AI agent platform built on Pi for contract review, compliance checks, legal research, and matter-oriented drafting.

## Quick Start

```sh
npm install -g bmw-lex
lex auth
lex
```

The npm package is `bmw-lex`; the installed command is `lex`.

For local development from a clone:

```sh
git clone https://github.com/itsamirkhon/lex.git
cd lex
npm install
lex --version
```

Local `npm install` creates the `lex` command in `~/.local/bin` and adds that directory to your shell profile when needed. If the current terminal still cannot find `lex`, run:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

## Common Commands

```sh
lex contract-review samples/acme-supplier-nda-draft.md --jurisdiction de
lex compliance-check "Acme GmbH" --check-type sanctions
lex legal-research "force majeure" --jurisdiction de,uk
lex doctor
```

Runtime state is stored under `~/.lex`. Project-bundled agent assets live under `.lex/`.
