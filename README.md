# Lex

Lex is a BMW legal AI agent platform built on Pi for contract review, compliance checks, legal research, and matter-oriented drafting.

## Quick Start

```sh
npm install -g bmw-lex
lex auth
lex
```

The npm package is `bmw-lex`; the installed command is `lex`.

If `lex auth` prints `flex: can't open auth`, your shell is running the system lexer at `/usr/bin/lex` instead of Lex. Use the fallback command or fix `PATH`:

```sh
bmw-lex auth
bmw-lex
# or
export PATH="$HOME/.local/bin:$PATH"
```

To start the web interface:

```sh
lex-web
```

By default it opens `http://localhost:3000` and writes uploads/results under the directory where you ran `lex-web`.

For local development from a clone:

```sh
git clone https://github.com/itsamirkhon/lex.git
cd lex
npm install
lex --version
lex-web --help
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
