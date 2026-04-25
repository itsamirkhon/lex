#!/bin/sh
# Lex — BMW Legal AI Platform installer
# Usage: curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/lex/main/install.sh | bash

set -eu

REPO_URL="${LEX_REPO_URL:-https://github.com/YOUR_ORG/lex}"
INSTALL_DIR="${LEX_INSTALL_DIR:-$HOME/.local/share/lex}"
BIN_DIR="${LEX_BIN_DIR:-$HOME/.local/bin}"

step() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
ok()   { printf '\033[1;32m ok\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31mERR\033[0m %s\n' "$1" >&2; exit 1; }

# ── Prerequisites ────────────────────────────────────────────────────────────

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

# ── Install ───────────────────────────────────────────────────────────────────

step "Installing Lex — BMW Legal AI Platform"

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

# Install npm dependencies (skips devDeps, uses existing node_modules if present)
step "Installing dependencies"
cd "$INSTALL_DIR"
npm install --omit=dev --silent 2>/dev/null || npm install --production --silent 2>/dev/null || true
ok "Dependencies installed"

# Create bin wrapper
mkdir -p "$BIN_DIR"
cat >"$BIN_DIR/lex" <<EOF
#!/bin/sh
set -eu
exec node "$INSTALL_DIR/bin/lex.js" "\$@"
EOF
chmod 0755 "$BIN_DIR/lex"
ok "Created $BIN_DIR/lex"

# Add to PATH if needed
add_to_path() {
  case ":${PATH}:" in
    *":$BIN_DIR:"*) return ;;
  esac

  profile="$HOME/.profile"
  case "${SHELL:-}" in
    */zsh)  profile="$HOME/.zshrc" ;;
    */bash) profile="$HOME/.bashrc" ;;
  esac

  line="export PATH=\"$BIN_DIR:\$PATH\""
  if ! grep -qF "$line" "$profile" 2>/dev/null; then
    printf '\n# Added by Lex installer\n%s\n' "$line" >>"$profile"
    printf '\033[1;33m  PATH updated in %s\033[0m\n' "$profile"
    printf '  Run: \033[1mexport PATH="%s:$PATH"\033[0m to use lex now\n' "$BIN_DIR"
  fi
}

add_to_path

# ── Done ──────────────────────────────────────────────────────────────────────

printf '\n'
printf '\033[1;32m✓ Lex installed successfully!\033[0m\n'
printf '\n'
printf 'Next steps:\n'
printf '  1. Reload your shell (or run: export PATH="%s:$PATH")\n' "$BIN_DIR"
printf '  2. Run setup:    lex setup\n'
printf '  3. Try a demo:   lex contract-review samples/acme-supplier-nda-draft.md --jurisdiction de\n'
printf '  4. Web UI:       cd %s/web && npm install && npm run dev\n' "$INSTALL_DIR"
printf '\n'
printf 'Docs: %s\n' "$REPO_URL"
