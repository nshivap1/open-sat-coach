//! Downloads GGUF models from Hugging Face into `<app data>/models` and manages that folder.
//!
//! This is the only place the app talks to the internet, and only when the user asks for a
//! model: the start URL must be `https://huggingface.co/...` (its CDN redirects are followed),
//! and every file is checked against the expected size and SHA-256 before it is used.

use crate::scan::GgufFile;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::io::{ErrorKind, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

const EVENT: &str = "model-download";
const MODELS_DIR: &str = "models";
const PART_SUFFIX: &str = ".part";
const ALLOWED_HOST: &str = "huggingface.co";
const USER_AGENT: &str = "OpenSATCoach/0.1";
const CHUNK_BYTES: usize = 1024 * 1024;
const NET_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_REDIRECTS: u32 = 5;
const PROGRESS_INTERVAL: Duration = Duration::from_millis(500);

const CANCELLED: &str = "Download cancelled";
const CORRUPTED: &str = "The download was corrupted — please try again.";
const INTERRUPTED: &str = "The download was interrupted — press Download again to resume.";
const BUSY: &str = "Another model is already downloading.";
const BAD_URL: &str = "Only https://huggingface.co/ download links are allowed";
const BAD_NAME: &str = "Invalid model file name (expected a plain name ending in .gguf)";

/// Managed state: at most one download, with a cancel flag checked every chunk.
#[derive(Default)]
pub struct DownloadState {
    cancel: AtomicBool,
    /// File name of the download in progress, if any.
    current: Mutex<Option<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub path: String,
}

/// Payload of the `model-download` event (matches `DownloadProgress` in src/ai/types.ts).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    file_name: String,
    received_bytes: u64,
    total_bytes: u64,
    bytes_per_sec: u64,
    stage: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn lock_current(state: &DownloadState) -> MutexGuard<'_, Option<String>> {
    state.current.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Clears the "download in progress" marker however the download ends.
struct ActiveGuard<'a> {
    state: &'a DownloadState,
}

impl Drop for ActiveGuard<'_> {
    fn drop(&mut self) {
        *lock_current(self.state) = None;
    }
}

/// A plain file name: ASCII letters, digits, `-`, `_`, `.`, `+`; ends in `.gguf`; no `..`.
pub fn validate_file_name(name: &str) -> Result<(), String> {
    let plain = !name.is_empty()
        && name.len() <= 200
        && !name.starts_with('.')
        && !name.contains("..")
        && !name.contains('/')
        && !name.contains('\\')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '+'));
    if plain && name.to_ascii_lowercase().ends_with(".gguf") {
        Ok(())
    } else {
        Err(BAD_NAME.to_string())
    }
}

/// Accepts only `https://huggingface.co/...` (default port, no credentials).
pub fn validate_url(raw: &str) -> Result<url::Url, String> {
    let parsed = url::Url::parse(raw).map_err(|_| BAD_URL.to_string())?;
    let host_ok = match parsed.host() {
        Some(url::Host::Domain(domain)) => domain.eq_ignore_ascii_case(ALLOWED_HOST),
        _ => false,
    };
    if parsed.scheme() != "https"
        || !host_ok
        || parsed.port().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err(BAD_URL.to_string());
    }
    Ok(parsed)
}

fn validate_sha256(raw: &str) -> Result<String, String> {
    let hex = raw.trim().to_ascii_lowercase();
    if hex.len() == 64 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
        Ok(hex)
    } else {
        Err("Invalid SHA-256 checksum (expected 64 hex characters)".to_string())
    }
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not locate the app data folder: {e}"))?
        .join(MODELS_DIR);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Could not create models folder {}: {e}", dir.display()))?;
    Ok(dir)
}

fn part_path(dir: &Path, file_name: &str) -> PathBuf {
    dir.join(format!("{file_name}{PART_SUFFIX}"))
}

fn file_len(path: &Path) -> Option<u64> {
    fs::metadata(path).ok().filter(|m| m.is_file()).map(|m| m.len())
}

fn remove_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!(
            "Could not delete {} (is the AI coach still using it?): {e}",
            path.display()
        )),
    }
}

/// Emits progress events, at most every `PROGRESS_INTERVAL` while downloading.
struct Reporter<'a> {
    app: &'a AppHandle,
    file_name: String,
    total: u64,
    last_emit: Instant,
    last_bytes: u64,
}

impl Reporter<'_> {
    fn emit(&self, stage: &'static str, received: u64, bytes_per_sec: u64, error: Option<String>) {
        let payload = Progress {
            file_name: self.file_name.clone(),
            received_bytes: received,
            total_bytes: self.total,
            bytes_per_sec,
            stage,
            error,
        };
        let _ = self.app.emit(EVENT, payload);
    }

    /// Restarts the speed measurement (e.g. after hashing a resumed .part).
    fn reset(&mut self, received: u64) {
        self.last_emit = Instant::now();
        self.last_bytes = received;
    }

    fn downloading(&mut self, received: u64, force: bool) {
        let elapsed = self.last_emit.elapsed();
        if !force && elapsed < PROGRESS_INTERVAL {
            return;
        }
        let secs = elapsed.as_secs_f64();
        let rate = if secs > 0.0 {
            (received.saturating_sub(self.last_bytes) as f64 / secs) as u64
        } else {
            0
        };
        self.emit("downloading", received, rate, None);
        self.reset(received);
    }
}

fn build_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(NET_TIMEOUT)
        .timeout_read(NET_TIMEOUT)
        .redirects(MAX_REDIRECTS)
        .build()
}

/// Starts the HTTP request, from byte `offset` when it is above zero.
fn request(agent: &ureq::Agent, url: &str, offset: u64) -> Result<ureq::Response, ureq::Error> {
    let mut req = agent.get(url).set("User-Agent", USER_AGENT);
    if offset > 0 {
        req = req.set("Range", &format!("bytes={offset}-"));
    }
    req.call()
}

fn http_error(e: ureq::Error) -> String {
    #[allow(unreachable_patterns)]
    match e {
        ureq::Error::Status(code, _) => format!("The download failed (HTTP {code})."),
        ureq::Error::Transport(t) => format!("Could not download the model: {t}"),
        other => format!("Could not download the model: {other}"),
    }
}

/// Hashes the bytes already in a `.part` file, checking for cancellation as it goes.
fn hash_existing(path: &Path, hasher: &mut Sha256, cancel: &AtomicBool) -> Result<u64, String> {
    let mut file =
        File::open(path).map_err(|e| format!("Could not read {}: {e}", path.display()))?;
    let mut buf = vec![0u8; CHUNK_BYTES];
    let mut total: u64 = 0;
    loop {
        if cancel.load(Ordering::SeqCst) {
            return Err(CANCELLED.to_string());
        }
        let n = match file.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => n,
            Err(e) if e.kind() == ErrorKind::Interrupted => continue,
            Err(e) => return Err(format!("Could not read {}: {e}", path.display())),
        };
        hasher.update(&buf[..n]);
        total += n as u64;
    }
    Ok(total)
}

/// Does `Content-Range` (if present) confirm the server resumed at `offset`?
fn resumed_at(resp: &ureq::Response, offset: u64) -> bool {
    match resp.header("Content-Range") {
        Some(range) => range
            .trim()
            .to_ascii_lowercase()
            .starts_with(&format!("bytes {offset}-")),
        None => true,
    }
}

fn download_blocking(
    app: &AppHandle,
    url: String,
    file_name: String,
    sha256: String,
    size_bytes: u64,
) -> Result<DownloadResult, String> {
    validate_file_name(&file_name)?;
    let target = validate_url(&url)?;
    let expected_hash = validate_sha256(&sha256)?;
    if size_bytes == 0 {
        return Err("Invalid model size".to_string());
    }

    let state = app.state::<DownloadState>();
    {
        let mut current = lock_current(&state);
        if current.is_some() {
            return Err(BUSY.to_string());
        }
        *current = Some(file_name.clone());
    }
    let _active = ActiveGuard { state: &*state };
    state.cancel.store(false, Ordering::SeqCst);

    let mut reporter = Reporter {
        app,
        file_name: file_name.clone(),
        total: size_bytes,
        last_emit: Instant::now(),
        last_bytes: 0,
    };
    let result = run_download(
        app,
        &state.cancel,
        &mut reporter,
        target.as_str(),
        &file_name,
        &expected_hash,
        size_bytes,
    );
    match &result {
        Ok(_) => reporter.emit("done", size_bytes, 0, None),
        Err(e) if e.as_str() == CANCELLED => reporter.emit("cancelled", reporter.last_bytes, 0, None),
        Err(e) => reporter.emit("error", reporter.last_bytes, 0, Some(e.clone())),
    }
    result
}

fn run_download(
    app: &AppHandle,
    cancel: &AtomicBool,
    reporter: &mut Reporter<'_>,
    url: &str,
    file_name: &str,
    expected_hash: &str,
    size_bytes: u64,
) -> Result<DownloadResult, String> {
    let dir = models_dir(app)?;
    let dest = dir.join(file_name);
    let part = part_path(&dir, file_name);

    // Already downloaded.
    if file_len(&dest) == Some(size_bytes) {
        return Ok(DownloadResult { path: dest.to_string_lossy().into_owned() });
    }

    let mut hasher = Sha256::new();
    let mut offset: u64 = 0;
    match file_len(&part) {
        Some(len) if len > 0 && len <= size_bytes => {
            reporter.emit("downloading", len, 0, None);
            offset = hash_existing(&part, &mut hasher, cancel)?;
        }
        Some(_) => remove_if_exists(&part)?, // empty or larger than expected: start over
        None => {}
    }
    reporter.reset(offset);

    if offset < size_bytes {
        let agent = build_agent();
        let response = match request(&agent, url, offset) {
            Ok(resp) => resp,
            // The server cannot serve the rest of this .part: start over.
            Err(ureq::Error::Status(416, _)) if offset > 0 => {
                offset = 0;
                hasher = Sha256::new();
                request(&agent, url, 0).map_err(http_error)?
            }
            Err(e) => return Err(http_error(e)),
        };
        if !response.get_url().starts_with("https://") {
            return Err(BAD_URL.to_string());
        }

        let resumed = offset > 0 && response.status() == 206 && resumed_at(&response, offset);
        let response = if offset > 0 && !resumed {
            if response.status() == 200 {
                // Server sent the whole file instead of the rest: restart from zero with it.
                offset = 0;
                hasher = Sha256::new();
                response
            } else {
                // Unexpected partial range: ask again for the whole file.
                drop(response);
                offset = 0;
                hasher = Sha256::new();
                request(&agent, url, 0).map_err(http_error)?
            }
        } else {
            response
        };
        if offset == 0 && response.status() != 200 {
            return Err(format!("The download failed (HTTP {}).", response.status()));
        }

        let opened = if offset > 0 {
            OpenOptions::new().append(true).open(&part)
        } else {
            File::create(&part)
        };
        let mut file =
            opened.map_err(|e| format!("Could not write {}: {e}", part.display()))?;

        let mut reader = response.into_reader();
        let mut buf = vec![0u8; CHUNK_BYTES];
        let mut received = offset;
        reporter.reset(received);
        reporter.downloading(received, true);
        loop {
            if cancel.load(Ordering::SeqCst) {
                let _ = file.flush();
                return Err(CANCELLED.to_string());
            }
            let n = match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => n,
                Err(e) if e.kind() == ErrorKind::Interrupted => continue,
                Err(e) => {
                    let _ = file.flush();
                    return Err(format!("{INTERRUPTED} ({e})"));
                }
            };
            if received + n as u64 > size_bytes {
                drop(file);
                let _ = fs::remove_file(&part);
                return Err(CORRUPTED.to_string());
            }
            file.write_all(&buf[..n])
                .map_err(|e| format!("Could not write {}: {e}", part.display()))?;
            hasher.update(&buf[..n]);
            received += n as u64;
            reporter.downloading(received, false);
        }
        file.flush()
            .map_err(|e| format!("Could not write {}: {e}", part.display()))?;
        file.sync_all()
            .map_err(|e| format!("Could not write {}: {e}", part.display()))?;
        drop(file);
        reporter.downloading(received, true);
        offset = received;
        if offset < size_bytes {
            // The connection ended early; keep the .part so the next attempt resumes.
            return Err(INTERRUPTED.to_string());
        }
    }

    reporter.emit("verifying", offset, 0, None);
    let actual_hash = to_hex(hasher.finalize().as_slice());
    let size_ok = file_len(&part) == Some(size_bytes);
    if !size_ok || !actual_hash.eq_ignore_ascii_case(expected_hash) {
        let _ = fs::remove_file(&part);
        return Err(CORRUPTED.to_string());
    }

    remove_if_exists(&dest)?;
    fs::rename(&part, &dest)
        .map_err(|e| format!("Could not move {} into place: {e}", dest.display()))?;
    Ok(DownloadResult { path: dest.to_string_lossy().into_owned() })
}

fn list_blocking(app: &AppHandle) -> Result<Vec<GgufFile>, String> {
    let dir = models_dir(app)?;
    let entries = match fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("Could not read {}: {e}", dir.display())),
    };
    let mut files: Vec<GgufFile> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        // `.gguf.part` files do not end in `.gguf`, so partial downloads are skipped.
        if !name.to_ascii_lowercase().ends_with(".gguf") {
            continue;
        }
        let meta = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if !meta.is_file() {
            continue;
        }
        files.push(GgufFile {
            path: path.to_string_lossy().into_owned(),
            name,
            size_bytes: meta.len(),
        });
    }
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(files)
}

fn delete_blocking(app: &AppHandle, file_name: String) -> Result<(), String> {
    validate_file_name(&file_name)?;
    let state = app.state::<DownloadState>();
    let downloading = lock_current(&state).as_deref() == Some(file_name.as_str());
    if downloading {
        return Err("This model is still downloading. Cancel the download first.".to_string());
    }
    let dir = models_dir(app)?;
    remove_if_exists(&dir.join(&file_name))?;
    remove_if_exists(&part_path(&dir, &file_name))?;
    Ok(())
}

#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    url: String,
    file_name: String,
    sha256: String,
    size_bytes: u64,
) -> Result<DownloadResult, String> {
    crate::blocking(move || download_blocking(&app, url, file_name, sha256, size_bytes)).await
}

#[tauri::command]
pub async fn cancel_download(app: AppHandle) -> Result<(), String> {
    let state = app.state::<DownloadState>();
    state.cancel.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn list_app_models(app: AppHandle) -> Result<Vec<GgufFile>, String> {
    crate::blocking(move || list_blocking(&app)).await
}

#[tauri::command]
pub async fn delete_model(app: AppHandle, file_name: String) -> Result<(), String> {
    crate::blocking(move || delete_blocking(&app, file_name)).await
}
