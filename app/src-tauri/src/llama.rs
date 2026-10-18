//! Starts and stops a private `llama-server` (llama.cpp) bound to 127.0.0.1.

use crate::{device, scan};
use serde::Serialize;
use std::fs::{self, File};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

const DEFAULT_CTX: u32 = 8192;
const HEALTH_TIMEOUT: Duration = Duration::from_secs(180);
const POLL_INTERVAL: Duration = Duration::from_millis(500);
const LOG_FILE: &str = "llama-server.log";
const LOG_TAIL_LINES: usize = 15;
const NOT_FOUND: &str = "llama-server was not found. Install llama.cpp (macOS: brew install llama.cpp) or use Ollama / LM Studio.";
const STOPPED_DURING_START: &str = "llama-server was stopped before it finished loading.";

struct Running {
    child: Child,
    port: u16,
    /// Also identifies this launch, so a newer start or a stop can be detected.
    token: String,
    model_path: String,
    ready: bool,
}

impl Drop for Running {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Default)]
pub struct LlamaState {
    slot: Mutex<Option<Running>>,
    /// Serializes start_llama calls; stop_llama does not take it, so it can cancel a start.
    start_lock: Mutex<()>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartResult {
    pub port: u16,
    pub token: String,
    pub pid: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlamaStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub model_path: Option<String>,
}

fn lock_slot(state: &LlamaState) -> MutexGuard<'_, Option<Running>> {
    state.slot.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Takes the running instance out of the slot only if it is the launch identified by `token`.
fn take_if_mine(state: &LlamaState, token: &str) -> Option<Running> {
    let mut slot = lock_slot(state);
    let mine = slot.as_ref().map(|r| r.token == token).unwrap_or(false);
    if mine {
        slot.take()
    } else {
        None
    }
}

fn free_port() -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|e| format!("Could not find a free local port: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Could not find a free local port: {e}"))?
        .port();
    drop(listener);
    Ok(port)
}

fn log_tail(path: &Path) -> String {
    let bytes = fs::read(path).unwrap_or_default();
    let text = String::from_utf8_lossy(&bytes);
    let lines: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
    if lines.is_empty() {
        return String::new();
    }
    let start = lines.len().saturating_sub(LOG_TAIL_LINES);
    format!("\n\nLast lines of {}:\n{}", path.display(), lines[start..].join("\n"))
}

fn health_ok(agent: &ureq::Agent, port: u16, token: &str) -> bool {
    let url = format!("http://127.0.0.1:{port}/health");
    match agent
        .get(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .call()
    {
        Ok(resp) => resp.status() == 200,
        Err(_) => false, // 503 while loading, or not listening yet
    }
}

fn start_blocking(
    app: &AppHandle,
    model_path: String,
    ctx_size: Option<u32>,
) -> Result<StartResult, String> {
    let state = app.state::<LlamaState>();
    let _serial = state.start_lock.lock().unwrap_or_else(|p| p.into_inner());

    // Stop any running instance first (Drop kills and reaps it, outside the lock).
    let previous = lock_slot(&state).take();
    drop(previous);

    let model = PathBuf::from(&model_path);
    if !model.is_file() {
        return Err(format!("Model file not found: {model_path}"));
    }
    let binary = scan::find_llama_server(app).ok_or_else(|| NOT_FOUND.to_string())?;

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not locate the app data folder: {e}"))?;
    fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Could not create data folder {}: {e}", data_dir.display()))?;
    let log_path = data_dir.join(LOG_FILE);
    let log_out = File::create(&log_path)
        .map_err(|e| format!("Could not create {}: {e}", log_path.display()))?;
    let log_err = log_out
        .try_clone()
        .map_err(|e| format!("Could not open {}: {e}", log_path.display()))?;

    let port = free_port()?;
    let token = uuid::Uuid::new_v4().simple().to_string();
    let ctx = ctx_size.unwrap_or(DEFAULT_CTX).clamp(512, 262_144);

    let mut cmd = Command::new(&binary);
    cmd.arg("-m")
        .arg(&model)
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(port.to_string())
        .arg("--api-key")
        .arg(&token)
        .arg("-c")
        .arg(ctx.to_string())
        .arg("-ngl")
        .arg("99")
        .stdin(Stdio::null())
        .stdout(Stdio::from(log_out))
        .stderr(Stdio::from(log_err));
    if let Some(dir) = binary.parent() {
        // Lets a bundled llama-server find its shared libraries next to it.
        cmd.current_dir(dir);
    }
    device::hide_console(&mut cmd);

    let child = cmd
        .spawn()
        .map_err(|e| format!("Could not start {}: {e}", binary.display()))?;
    let pid = child.id();
    *lock_slot(&state) = Some(Running {
        child,
        port,
        token: token.clone(),
        model_path: model_path.clone(),
        ready: false,
    });

    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(2))
        .redirects(0)
        .build();
    let started = Instant::now();
    loop {
        // Has the process exited, or was it stopped / replaced?
        let exited: Option<String> = {
            let mut slot = lock_slot(&state);
            let mine = slot.as_ref().map(|r| r.token == token).unwrap_or(false);
            if !mine {
                return Err(STOPPED_DURING_START.to_string());
            }
            let wait = slot.as_mut().map(|r| r.child.try_wait());
            match wait {
                Some(Ok(Some(status))) => {
                    slot.take();
                    Some(format!("llama-server exited during startup ({status})."))
                }
                Some(Err(e)) => {
                    slot.take();
                    Some(format!("Lost track of llama-server: {e}"))
                }
                _ => None,
            }
        };
        if let Some(message) = exited {
            return Err(format!("{message}{}", log_tail(&log_path)));
        }

        if health_ok(&agent, port, &token) {
            let mut slot = lock_slot(&state);
            return match slot.as_mut() {
                Some(r) if r.token == token => {
                    r.ready = true;
                    Ok(StartResult { port, token: token.clone(), pid })
                }
                _ => Err(STOPPED_DURING_START.to_string()),
            };
        }

        if started.elapsed() >= HEALTH_TIMEOUT {
            let dead = take_if_mine(&state, &token);
            drop(dead);
            return Err(format!(
                "llama-server did not become ready within {} s.{}",
                HEALTH_TIMEOUT.as_secs(),
                log_tail(&log_path)
            ));
        }
        std::thread::sleep(POLL_INTERVAL);
    }
}

fn status_blocking(app: &AppHandle) -> LlamaStatus {
    let state = app.state::<LlamaState>();
    let mut slot = lock_slot(&state);
    let (alive, ready) = match slot.as_mut() {
        Some(r) => (matches!(r.child.try_wait(), Ok(None)), r.ready),
        None => (false, false),
    };
    if !alive && ready {
        // Crashed after it was ready: forget it. (A still-loading instance is
        // cleaned up by start_llama itself.)
        slot.take();
    }
    match slot.as_ref() {
        Some(r) if alive && ready => LlamaStatus {
            running: true,
            port: Some(r.port),
            model_path: Some(r.model_path.clone()),
        },
        _ => LlamaStatus { running: false, port: None, model_path: None },
    }
}

/// Kills llama-server if it is running. Called on app exit.
pub fn shutdown(app: &AppHandle) {
    if let Some(state) = app.try_state::<LlamaState>() {
        let running = lock_slot(&state).take();
        drop(running);
    }
}

#[tauri::command]
pub async fn start_llama(
    app: AppHandle,
    model_path: String,
    ctx_size: Option<u32>,
) -> Result<StartResult, String> {
    crate::blocking(move || start_blocking(&app, model_path, ctx_size)).await
}

#[tauri::command]
pub async fn stop_llama(app: AppHandle) -> Result<(), String> {
    crate::blocking(move || {
        shutdown(&app);
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn llama_status(app: AppHandle) -> Result<LlamaStatus, String> {
    crate::blocking(move || Ok(status_blocking(&app))).await
}
