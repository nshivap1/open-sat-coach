# Open SAT Coach — desktop shell (Tauri 2)

Build: `npm run tauri build` (runs `npm run build:desktop` first, which must write `../dist-desktop`).
The frontend calls these commands with `invoke` (contract: `src/ai/types.ts`).

## Commands

| Command | What it does |
|---|---|
| `load_state` | Returns the saved app state JSON, or `null` on first run. |
| `save_state { json }` | Validates the JSON and upserts it in one transaction. At most one backup per hour goes into `state_backups`; the newest 20 are kept. |
| `http_local { req }` | GET/POST to a local model server. The response comes back as `{ status, body }`, including 4xx/5xx statuses. Network failures reject with a readable message. Redirects are not followed. |
| `scan_models` | Lists `*.gguf` files of 100 MB or more (skipping `mmproj` and extra split shards) and the `llama-server` path if one is found. |
| `start_llama { modelPath, ctxSize? }` | Stops any running instance, then starts `llama-server` on a free 127.0.0.1 port with a random API key and `-c ctx` (default 8192) `-ngl 99`. Waits for `/health` (up to 180 s) and returns `{ port, token, pid }`. |
| `stop_llama` / `llama_status` | Kills the server, or reports `{ running, port, modelPath }`. The server is also killed when the app exits. |
| `device_info` | Returns `{ os, arch, totalMemoryBytes, cpu }` (sysctl on macOS, CIM via PowerShell on Windows, /proc on Linux). |
| `open_external { url }` | Opens an `https://` link in the default browser. Other schemes are rejected. |

## Where data lives

Everything is stored in the OS app-data folder for `org.opensatcoach.desktop`:
- macOS: `~/Library/Application Support/org.opensatcoach.desktop/`
- Windows: `%APPDATA%\org.opensatcoach.desktop\`

That folder holds `coach.sqlite` (WAL mode, schema version in `PRAGMA user_version`), `llama-server.log` (output of the last start), and `models/` (also scanned for GGUF files).

## Where models and llama-server are found

GGUF search folders (max depth 6, symlinked files followed, max 200 results): `~/.lmstudio/models`, `~/.cache/lm-studio/models`, `~/.cache/huggingface/hub`, `~/Library/Caches/llama.cpp`, `~/AppData/Local/llama.cpp`, `~/Downloads`, `~/models`, `~/Models`, `~/.ollama-gguf`, and `<app data>/models`.

`llama-server` (`.exe` on Windows) is looked up in this order:
1. `<resources>/binaries/`
2. next to the app executable (Tauri `externalBin`)
3. each `PATH` entry
4. `/opt/homebrew/bin`, `/usr/local/bin`
5. `~/.local/bin`, `~/llama.cpp/build/bin`

On macOS, `brew install llama.cpp` is enough.

## Loopback-only rule

`http_local` accepts only `http://` URLs whose host is exactly `localhost`, `127.0.0.1` or `[::1]` (no credentials in the URL). Anything else is rejected with `Only local addresses are allowed`. The app never contacts the internet itself, and `llama-server` is always bound to `127.0.0.1` behind a per-launch API key.
