#!/usr/bin/env bash
# Open SAT Coach — one-time setup and build of the desktop app on macOS (Apple Silicon).
# Installs only into your user account (no sudo):
#   • Rust via rustup (~/.cargo, ~/.rustup)        • Node.js 22 into ~/.local/node, only if Node 20.6+ is missing
# Needs Xcode Command Line Tools (macOS shows an install dialog if they're missing).
# Also bundles llama.cpp's llama-server (latest GitHub release, macOS arm64) into src-tauri/binaries/.
# Usage:  cd path/to/test-coach/app && bash scripts/setup-mac.sh [--refresh-runtime]
set -euo pipefail
REFRESH_RUNTIME=0
for arg in "$@"; do
  case "$arg" in
    --refresh-runtime) REFRESH_RUNTIME=1 ;;
  esac
done
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

say "llama.cpp runtime (bundled llama-server)"
BIN_DIR="$ROOT/src-tauri/binaries"
# Downloads the latest llama.cpp macOS arm64 release and copies llama-server + its libraries
# into src-tauri/binaries. Returns non-zero on any failure (the caller only warns).
fetch_runtime() {
  local api="https://api.github.com/repos/ggml-org/llama.cpp/releases/latest"
  local tmp zip_url server src_dir f
  zip_url="$(curl -fsSL -H "Accept: application/vnd.github+json" "$api" \
    | grep -o '"browser_download_url": *"[^"]*bin-macos-arm64.zip"' \
    | head -1 | sed -E 's/.*"(https:[^"]*)"$/\1/')" || return 1
  [ -n "$zip_url" ] || { echo "No bin-macos-arm64.zip asset in the latest release."; return 1; }
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/llama-runtime.XXXXXX")" || return 1
  echo "Downloading $zip_url"
  curl -fL --retry 2 -o "$tmp/llama.zip" "$zip_url" || { rm -rf "$tmp"; return 1; }
  unzip -q "$tmp/llama.zip" -d "$tmp/x" || { rm -rf "$tmp"; return 1; }
  server="$(find "$tmp/x" -name llama-server \( -type f -o -type l \) | head -1)"
  [ -n "$server" ] || { echo "llama-server not found in the archive."; rm -rf "$tmp"; return 1; }
  src_dir="$(dirname "$server")"
  mkdir -p "$BIN_DIR" || { rm -rf "$tmp"; return 1; }
  # Replace any previous runtime, keeping the README placeholder.
  find "$BIN_DIR" -mindepth 1 -maxdepth 1 ! -name README.md -exec rm -rf {} + || true
  cp -f "$server" "$BIN_DIR/llama-server" || { rm -rf "$tmp"; return 1; }
  for f in "$src_dir"/*.dylib "$src_dir"/*.metal; do
    if [ -e "$f" ]; then
      cp -f "$f" "$BIN_DIR/" || { rm -rf "$tmp"; return 1; }
    fi
  done
  rm -rf "$tmp"
  chmod +x "$BIN_DIR/llama-server" || return 1
  xattr -dr com.apple.quarantine "$BIN_DIR" 2>/dev/null || true
  echo "ok: $BIN_DIR/llama-server ($(ls "$BIN_DIR" | grep -c -v '^README.md$') files)"
}
if [ -x "$BIN_DIR/llama-server" ] && [ "$REFRESH_RUNTIME" = "0" ]; then
  echo "ok: $BIN_DIR/llama-server already present (pass --refresh-runtime to update it)"
else
  if ! fetch_runtime; then
    echo "WARNING: could not download the llama.cpp runtime. The app will still build and work with"
    echo "         Ollama, LM Studio or a llama.cpp you install yourself (brew install llama.cpp)."
  fi
fi

say "Building the desktop app (the first build compiles Rust crates and can take 5–10 minutes)"
npm run desktop:build -- --bundles app

APP="$(ls -d src-tauri/target/release/bundle/macos/*.app 2>/dev/null | head -1)"
say "Done"
echo "App: $ROOT/$APP"
echo "This is an unsigned development build. First launch: right-click the app → Open → Open."
echo
echo "Optional AI coach: the app can download Gemma itself and run it with the bundled llama-server."
echo "Or use any one of these, then press “Check again” in the app:"
echo "  • Ollama: https://ollama.com/download   then run:  ollama pull gemma4:e4b"
echo "  • LM Studio: https://lmstudio.ai   download “gemma-4-E4B” and start its local server"
echo "  • A .gguf file (e.g. https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF) plus llama.cpp:  brew install llama.cpp"
[ -n "$APP" ] && open -R "$APP" || true
