#!/bin/sh
# Lex installer
# Usage: curl -fsSL https://raw.githubusercontent.com/itsamirkhon/lex/main/install.sh | bash

set -eu

REPO_URL="${LEX_REPO_URL:-https://github.com/itsamirkhon/lex}"
INSTALL_DIR="${LEX_INSTALL_DIR:-$HOME/.local/share/lex}"

step() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
ok()   { printf '\033[1;32m ok\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31mERR\033[0m %s\n' "$1" >&2; exit 1; }

check_node() {
  if ! command -v node >/dev/null 2>&1; then
    fail "Node.js is required. Install from https://nodejs.org (v20+)"
  fi
  node_major="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
  if [ "$node_major" -lt 20 ]; then
    fail "Node.js v20+ required (detected v$(node --version)). Upgrade at https://nodejs.org"
  fi
  ok "Node.js $(node --version)"
}

check_git() {
  if ! command -v git >/dev/null 2>&1; then
    fail "git is required."
  fi
  ok "git $(git --version | head -c 30)"
}

step "Installing Lex"

check_node
check_git

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  step "Updating existing install in $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only --quiet
else
  step "Cloning into $INSTALL_DIR"
  git clone --depth 1 --quiet "$REPO_URL" "$INSTALL_DIR"
fi

ok "Repository ready"

step "Running npm install"
cd "$INSTALL_DIR"
npm install
ok "npm install completed"

printf '\n'
printf '\033[1;32m✓ Lex installed successfully!\033[0m\n'
printf '\n'
printf 'Run these commands now:\n'
printf '\n'
printf '  \033[1mlex auth\033[0m                  # enter your OpenRouter API key\n'
printf '  \033[1mlex contract-review %s/samples/acme-supplier-nda-draft.md --jurisdiction de\033[0m\n' "$INSTALL_DIR"
printf '\n'
printf 'Docs: https://github.com/itsamirkhon/lex\n'
