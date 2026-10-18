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
| `download_model { url, fileName, sha256, sizeBytes }` | Downloads a GGUF model to `<app data>/models/<fileName>` and returns `{ path }`. Only `https://huggingface.co/...` start URLs (up to 5 redirects to the Hugging Face CDN are followed); `fileName` must be a plain name ending in `.gguf`. Returns at once if the file already exists with the expected size. Downloads into `<fileName>.part` and resumes it with a `Range` request (starts over if the server ignores the range). Checks size and SHA-256 at the end; a mismatch deletes the `.part` and rejects with `The download was corrupted — please try again.` One download at a time. |
| `cancel_download` | Stops the running download within one 1 MiB chunk. The `.part` file is kept, so the next `download_model` resumes; the cancelled call rejects with `Download cancelled`. |
| `list_app_models` | Lists the `*.gguf` files in `<app data>/models` (not `.part` files) as `{ path, name, sizeBytes }`. |
| `delete_model { fileName }` | Deletes `<app data>/models/<fileName>` and its `.part` (same name rules as `download_model`). Refuses while that file is downloading. |
| `device_info` | Returns `{ os, arch, totalMemoryBytes, cpu }` (sysctl on macOS, CIM via PowerShell on Windows, /proc on Linux). |
| `open_external { url }` | Opens an `https://` link in the default browser. Other schemes are rejected. |

### `model-download` event

While `download_model` runs, the app emits `model-download` with `{ fileName, receivedBytes, totalBytes, bytesPerSec, stage, error? }` (`DownloadProgress` in `src/ai/types.ts`): `stage: "downloading"` about twice a second, then `"verifying"`, then `"done"`, or `"error"` (with `error`) or `"cancelled"`. Network timeouts are 30 s for connecting and for each read; the User-Agent is `OpenSATCoach/0.1`.

## Where data lives

Everything is stored in the OS app-data folder for `org.opensatcoach.desktop`:
- macOS: `~/Library/Application Support/org.opensatcoach.desktop/`
- Windows: `%APPDATA%\org.opensatcoach.desktop\`

That folder holds `coach.sqlite` (WAL mode, schema version in `PRAGMA user_version`), `llama-server.log` (output of the last start), and `models/`: models downloaded by `download_model` (plus `*.part` files of unfinished downloads). `scan_models` also searches this folder.

## Where models and llama-server are found

GGUF search folders (max depth 6, symlinked files followed, max 200 results): `~/.lmstudio/models`, `~/.cache/lm-studio/models`, `~/.cache/huggingface/hub`, `~/Library/Caches/llama.cpp`, `~/AppData/Local/llama.cpp`, `~/Downloads`, `~/models`, `~/Models`, `~/.ollama-gguf`, and `<app data>/models`.

`llama-server` (`.exe` on Windows) is looked up in this order:
1. `<resources>/binaries/` (the runtime bundled with the app, see below)
2. next to the app executable (Tauri `externalBin`)
3. each `PATH` entry
4. `/opt/homebrew/bin`, `/usr/local/bin`
5. `~/.local/bin`, `~/llama.cpp/build/bin`

On macOS, `brew install llama.cpp` is enough.

When the app starts `llama-server`, the child runs with its working directory set to the binary's folder, and that folder is prepended to `DYLD_LIBRARY_PATH` (macOS), `LD_LIBRARY_PATH` (Linux) or `PATH` (Windows), so the libraries shipped next to it are found.

## Bundled llama.cpp runtime

`tauri.conf.json` has `"bundle": { "resources": ["binaries/*"] }`, so everything in `src-tauri/binaries/` ships inside the app (macOS: `Open SAT Coach.app/Contents/Resources/binaries/`; Windows: `binaries\` in the install folder). With it, the app can download Gemma (`download_model`) and run it (`start_llama`) without Ollama or LM Studio.

`scripts/setup-mac.sh` and `scripts/setup-windows.ps1` fill that folder before building: they read the latest release from `https://api.github.com/repos/ggml-org/llama.cpp/releases/latest`, download `*bin-macos-arm64.zip` (Windows: `*bin-win-vulkan-x64.zip`, else `*bin-win-cpu-x64.zip`), and copy `llama-server` with the `.dylib`/`.metal` files (Windows: `.dll` files) from its folder. On macOS they also `chmod +x` it and remove the quarantine attribute. An existing runtime is kept unless you pass `--refresh-runtime`. If the download fails, the scripts print a warning and build anyway.

The binaries are not committed: `src-tauri/.gitignore` ignores `binaries/*` except `binaries/README.md`, which stays so the resource glob always matches.

## Network rules

`http_local` accepts only `http://` URLs whose host is exactly `localhost`, `127.0.0.1` or `[::1]` (no credentials in the URL) and never follows redirects. Anything else is rejected with `Only local addresses are allowed`. `llama-server` is always bound to `127.0.0.1` behind a per-launch API key.

The only internet access is `download_model`, and only when the user asks for a model: HTTPS to `huggingface.co` (TLS via rustls with bundled root certificates), with every file checked against its expected size and SHA-256 before it is used.
