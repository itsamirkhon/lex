#!/bin/sh
# Lex — BMW Legal AI Platform installer
# Usage: curl -fsSL https://raw.githubusercontent.com/itsamirkhon/lex/main/install.sh | bash

set -eu

REPO_URL="${LEX_REPO_URL:-https://github.com/itsamirkhon/lex}"
INSTALL_DIR="${LEX_INSTALL_DIR:-$HOME/.local/share/lex}"
BIN_DIR="${LEX_BIN_DIR:-$HOME/.local/bin}"

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

step "Installing dependencies"
cd "$INSTALL_DIR"
npm install --omit=dev --silent 2>/dev/null || npm install --production --silent 2>/dev/null || true
ok "Dependencies installed"

# Create lex binary in BIN_DIR
# ~/.local/bin must come before /usr/bin in PATH to override system lex
mkdir -p "$BIN_DIR"
cat >"$BIN_DIR/lex" <<EOF
#!/bin/sh
set -eu
exec node "$INSTALL_DIR/bin/lex.js" "\$@"
EOF
chmod 0755 "$BIN_DIR/lex"
ok "Created $BIN_DIR/lex"

# Ensure ~/.local/bin is FIRST in PATH (before /usr/bin)
add_to_path() {
  profile="$HOME/.profile"
  case "${SHELL:-}" in
    */zsh)  profile="$HOME/.zshrc" ;;
    */bash) profile="$HOME/.bashrc" ;;
  esac

  line="export PATH=\"$BIN_DIR:\$PATH\""
  if ! grep -qF "$line" "$profile" 2>/dev/null; then
    printf '\n# Added by Lex installer\n%s\n' "$line" >>"$profile"
    printf '\033[1;33m  PATH updated in %s\033[0m\n' "$profile"
  fi
  export PATH="$BIN_DIR:$PATH"
}
add_to_path

printf '\n'
printf '\033[1;32m✓ Lex installed successfully!\033[0m\n'
printf '\n'
printf 'Next steps:\n'
printf '  \033[1mexport PATH="%s:$PATH"\033[0m   # activate in current shell\n' "$BIN_DIR"
printf '  \033[1mlex auth\033[0m                        # enter your OpenRouter API key\n'
printf '  \033[1mlex\033[0m                             # start the agent\n'
printf '\n'
printf 'Docs: https://github.com/itsamirkhon/lex\n'
