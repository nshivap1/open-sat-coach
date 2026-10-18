//! Finds GGUF model files and a `llama-server` binary on this computer.

use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const MIN_SIZE_BYTES: u64 = 100 * 1024 * 1024;
const MAX_DEPTH: usize = 6;
const MAX_RESULTS: usize = 200;
/// Upper bound on directory entries inspected, so a huge Downloads folder cannot stall the scan.
const MAX_ENTRIES_VISITED: usize = 200_000;
const SKIP_DIRS: [&str; 4] = ["node_modules", ".git", ".Trash", "$RECYCLE.BIN"];

/// Relative to the home folder; `/` separated, joined component by component.
const HOME_ROOTS: [&str; 9] = [
    ".lmstudio/models",
    ".cache/lm-studio/models",
    ".cache/huggingface/hub",
    "Library/Caches/llama.cpp",
    "AppData/Local/llama.cpp",
    "Downloads",
    "models",
    "Models",
    ".ollama-gguf",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GgufFile {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub gguf_files: Vec<GgufFile>,
    pub llama_server_path: Option<String>,
}

pub fn home_dir() -> Option<PathBuf> {
    let primary = if cfg!(windows) { "USERPROFILE" } else { "HOME" };
    [primary, "HOME"]
        .iter()
        .filter_map(|var| std::env::var_os(var))
        .find(|v| !v.is_empty())
        .map(PathBuf::from)
}

fn join_rel(base: &Path, rel: &str) -> PathBuf {
    rel.split('/').fold(base.to_path_buf(), |acc, part| acc.join(part))
}

fn search_roots(app: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(home) = home_dir() {
        for rel in HOME_ROOTS.iter() {
            roots.push(join_rel(&home, rel));
        }
    }
    if let Ok(dir) = app.path().app_data_dir() {
        roots.push(dir.join("models"));
    }
    roots
}

struct Walker {
    seen_files: HashSet<PathBuf>,
    out: Vec<GgufFile>,
    visited: usize,
}

impl Walker {
    fn full(&self) -> bool {
        self.out.len() >= MAX_RESULTS || self.visited >= MAX_ENTRIES_VISITED
    }

    fn walk(&mut self, dir: &Path, depth: usize) {
        if depth > MAX_DEPTH || self.full() {
            return;
        }
        let entries = match fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => return, // unreadable: skip silently
        };
        for entry in entries.flatten() {
            if self.full() {
                return;
            }
            self.visited += 1;
            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(t) => t,
                Err(_) => continue,
            };
            if file_type.is_dir() {
                let skip = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| SKIP_DIRS.contains(&n))
                    .unwrap_or(false);
                if !skip {
                    self.walk(&path, depth + 1);
                }
            } else if file_type.is_file() || file_type.is_symlink() {
                // Symlinked directories are not followed (no cycles); symlinked files are
                // (Hugging Face hub snapshots point into blobs/).
                self.consider_file(&path);
            }
        }
    }

    fn consider_file(&mut self, path: &Path) {
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => return,
        };
        let lower = name.to_ascii_lowercase();
        if !lower.ends_with(".gguf") || lower.contains("mmproj") {
            return;
        }
        // Split models: list only the first shard (llama.cpp loads the rest itself).
        if lower.contains("-of-0") && !lower.contains("-00001-of-") {
            return;
        }
        let meta = match fs::metadata(path) {
            Ok(m) => m,
            Err(_) => return,
        };
        if !meta.is_file() || meta.len() < MIN_SIZE_BYTES {
            return;
        }
        let canonical = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        if !self.seen_files.insert(canonical) {
            return;
        }
        self.out.push(GgufFile {
            path: path.to_string_lossy().into_owned(),
            name,
            size_bytes: meta.len(),
        });
    }
}

pub fn find_gguf_files(app: &AppHandle) -> Vec<GgufFile> {
    let mut walker = Walker { seen_files: HashSet::new(), out: Vec::new(), visited: 0 };
    let mut seen_roots: HashSet<PathBuf> = HashSet::new();
    for root in search_roots(app) {
        // `models` and `Models` are the same folder on case-insensitive file systems.
        let canonical = match fs::canonicalize(&root) {
            Ok(c) => c,
            Err(_) => continue, // missing root
        };
        if !seen_roots.insert(canonical) {
            continue;
        }
        walker.walk(&root, 0);
        if walker.full() {
            break;
        }
    }
    let mut files = walker.out;
    files.sort_by(|a, b| {
        a.name
            .to_lowercase()
            .cmp(&b.name.to_lowercase())
            .then_with(|| a.path.cmp(&b.path))
    });
    files
}

#[cfg(unix)]
fn has_exec_bit(meta: &fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    meta.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn has_exec_bit(_meta: &fs::Metadata) -> bool {
    true
}

fn is_executable(path: &Path) -> bool {
    match fs::metadata(path) {
        Ok(meta) => meta.is_file() && has_exec_bit(&meta),
        Err(_) => false,
    }
}

/// Bundled binary first, then PATH, then common install folders.
pub fn find_llama_server(app: &AppHandle) -> Option<PathBuf> {
    let exe = if cfg!(windows) { "llama-server.exe" } else { "llama-server" };
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(resources) = app.path().resource_dir() {
        candidates.push(resources.join("binaries").join(exe));
    }
    // Tauri `externalBin` sidecars are installed next to the app executable.
    if let Ok(current) = std::env::current_exe() {
        if let Some(dir) = current.parent() {
            candidates.push(dir.join(exe));
        }
    }
    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            if !dir.as_os_str().is_empty() {
                candidates.push(dir.join(exe));
            }
        }
    }
    // GUI apps on macOS start with a minimal PATH, so list Homebrew explicitly.
    for dir in ["/opt/homebrew/bin", "/usr/local/bin"] {
        candidates.push(Path::new(dir).join(exe));
    }
    if let Some(home) = home_dir() {
        for rel in [".local/bin", "llama.cpp/build/bin", "llama.cpp/build/bin/Release"] {
            candidates.push(join_rel(&home, rel).join(exe));
        }
    }
    candidates.into_iter().find(|p| is_executable(p))
}

#[tauri::command]
pub async fn scan_models(app: AppHandle) -> Result<ScanResult, String> {
    crate::blocking(move || -> Result<ScanResult, String> {
        let gguf_files = find_gguf_files(&app);
        let llama_server_path = find_llama_server(&app).map(|p| p.to_string_lossy().into_owned());
        Ok(ScanResult { gguf_files, llama_server_path })
    })
    .await
}
