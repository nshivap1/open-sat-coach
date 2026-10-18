# Bundled llama.cpp runtime

`tauri.conf.json` bundles everything in this folder (`"resources": ["binaries/*"]`) into the app's
resource folder, where the app looks for `binaries/llama-server` (`llama-server.exe` on Windows) before
anything installed on the computer.

The setup scripts fill this folder from the latest llama.cpp release on GitHub:

- `scripts/setup-mac.sh` copies `llama-server` plus its `.dylib` and `.metal` files (`bin-macos-arm64.zip`).
- `scripts/setup-windows.ps1` copies `llama-server.exe` plus its `.dll` files (`bin-win-vulkan-x64.zip`,
  or `bin-win-cpu-x64.zip` when there is no Vulkan build).

Pass `--refresh-runtime` to either script to replace binaries that are already here.

These binaries are not committed (`src-tauri/.gitignore` ignores everything here except this file).
This README stays so the `binaries/*` resource glob always matches something: without the runtime the app
still builds and works with Ollama, LM Studio or a llama.cpp you installed yourself.
