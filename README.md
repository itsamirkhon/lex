# Lex

Lex is a BMW legal AI agent platform built on Pi for contract review, compliance checks, legal research, and matter-oriented drafting.

## Quick Start

```sh
npm install
lex auth
lex
```

## Common Commands

```sh
lex contract-review samples/acme-supplier-nda-draft.md --jurisdiction de
lex compliance-check "Acme GmbH" --check-type sanctions
lex legal-research "force majeure" --jurisdiction de,uk
lex doctor
```

Runtime state is stored under `~/.lex`. Project-bundled agent assets live under `.lex/`.
