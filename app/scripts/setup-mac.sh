#!/usr/bin/env bash
# Open SAT Coach — one-time setup and build of the desktop app on macOS (Apple Silicon).
# Installs only into your user account (no sudo):
#   • Rust via rustup (~/.cargo, ~/.rustup)        • Node.js 22 into ~/.local/node, only if Node 20.6+ is missing
# Needs Xcode Command Line Tools (macOS shows an install dialog if they're missing).
# Usage:  cd path/to/test-coach/app && bash scripts/setup-mac.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
say() { printf "\n\033[1m==> %s\033[0m\n" "$*"; }
ARCH="$(uname -m)"
[ "$ARCH" = "arm64" ] || echo "Note: this build targets Apple Silicon; this Mac reports $ARCH."

say "Xcode Command Line Tools"
if ! xcode-select -p >/dev/null 2>&1; then
  xcode-select --install || true
  echo "Finish the Command Line Tools install in the macOS dialog, then run this script again."
  exit 1
fi
echo "ok: $(xcode-select -p)"

say "Rust"
export PATH="$HOME/.cargo/bin:$PATH"
if ! command -v cargo >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
fi
cargo --version

say "Node.js 20.6+"
NODE_OK=0
if command -v node >/dev/null 2>&1; then
  node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=6)?0:1)' && NODE_OK=1 || true
fi
if [ "$NODE_OK" = "0" ]; then
  if [ ! -x "$HOME/.local/node/bin/node" ]; then
    V=v22.12.0; case "$ARCH" in arm64) A=darwin-arm64;; *) A=darwin-x64;; esac
    mkdir -p "$HOME/.local"
    curl -fsSL "https://nodejs.org/dist/$V/node-$V-$A.tar.gz" | tar xz -C "$HOME/.local"
    rm -rf "$HOME/.local/node" && mv "$HOME/.local/node-$V-$A" "$HOME/.local/node"
  fi
  export PATH="$HOME/.local/node/bin:$PATH"
fi
node --version

say "JavaScript dependencies"
npm install --no-audit --no-fund

say "Checks"
npm run typecheck
npm test
npm run check:private

say "Building the desktop app (the first build compiles Rust crates and can take 5–10 minutes)"
npm run desktop:build -- --bundles app

APP="$(ls -d src-tauri/target/release/bundle/macos/*.app 2>/dev/null | head -1)"
say "Done"
echo "App: $ROOT/$APP"
echo "This is an unsigned development build. First launch: right-click the app → Open → Open."
echo
echo "Optional AI coach — any one of these, then press “Check again” in the app:"
echo "  • Ollama: https://ollama.com/download   then run:  ollama pull gemma4:e4b"
echo "  • LM Studio: https://lmstudio.ai   download “gemma-4-E4B” and start its local server"
echo "  • A .gguf file (e.g. https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF) plus llama.cpp:  brew install llama.cpp"
[ -n "$APP" ] && open -R "$APP" || true
