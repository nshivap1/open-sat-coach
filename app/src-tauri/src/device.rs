//! `device_info` and `open_external`.

use serde::Serialize;
use std::process::{Command, Stdio};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub os: String,
    pub arch: String,
    pub total_memory_bytes: Option<u64>,
    pub cpu: Option<String>,
}

/// Keeps child processes from flashing a console window on Windows.
#[cfg(windows)]
pub fn hide_console(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
pub fn hide_console(_cmd: &mut Command) {}

/// Runs a short command and returns trimmed stdout, or None on any failure.
fn capture(program: &str, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new(program);
    cmd.args(args).stdin(Stdio::null()).stderr(Stdio::null());
    hide_console(&mut cmd);
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn powershell(script: &str) -> Option<String> {
    capture("powershell", &["-NoProfile", "-NonInteractive", "-Command", script])
}

fn linux_memory() -> Option<u64> {
    let text = std::fs::read_to_string("/proc/meminfo").ok()?;
    let line = text.lines().find(|l| l.starts_with("MemTotal:"))?;
    let kib: u64 = line.split_whitespace().nth(1)?.parse().ok()?;
    Some(kib * 1024)
}

fn linux_cpu() -> Option<String> {
    let text = std::fs::read_to_string("/proc/cpuinfo").ok()?;
    let line = text.lines().find(|l| l.starts_with("model name"))?;
    let name = line.split_once(':')?.1.trim().to_string();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

fn collect() -> DeviceInfo {
    let os = std::env::consts::OS;
    let (total_memory_bytes, cpu) = match os {
        "macos" => (
            capture("/usr/sbin/sysctl", &["-n", "hw.memsize"]).and_then(|s| s.parse::<u64>().ok()),
            capture("/usr/sbin/sysctl", &["-n", "machdep.cpu.brand_string"]),
        ),
        "windows" => (
            powershell("(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory")
                .and_then(|s| s.parse::<u64>().ok()),
            powershell("(Get-CimInstance Win32_Processor | Select-Object -First 1).Name"),
        ),
        "linux" => (linux_memory(), linux_cpu()),
        _ => (None, None),
    };
    DeviceInfo {
        os: os.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        total_memory_bytes,
        cpu,
    }
}

#[tauri::command]
pub async fn device_info() -> Result<DeviceInfo, String> {
    crate::blocking(|| Ok(collect())).await
}

fn open_https(raw: &str) -> Result<(), String> {
    let parsed = url::Url::parse(raw).map_err(|_| "Only https:// links can be opened".to_string())?;
    if !raw.starts_with("https://") || parsed.scheme() != "https" || parsed.host().is_none() {
        return Err("Only https:// links can be opened".to_string());
    }
    // Use the normalized form: no spaces or quotes survive URL serialization.
    let link = parsed.as_str().to_string();

    let mut cmd = match std::env::consts::OS {
        "macos" => {
            let mut c = Command::new("/usr/bin/open");
            c.arg(&link);
            c
        }
        "windows" => {
            // `cmd /C start` would re-parse `&`, `|`, `^` in query strings as shell syntax;
            // the URL protocol handler opens the default browser with no shell involved.
            let mut c = Command::new("rundll32.exe");
            c.arg("url.dll,FileProtocolHandler").arg(&link);
            c
        }
        _ => {
            let mut c = Command::new("xdg-open");
            c.arg(&link);
            c
        }
    };
    cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    hide_console(&mut cmd);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Could not open the browser: {e}"))?;
    // Reap the helper process in the background so it never lingers as a zombie.
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

#[tauri::command]
pub async fn open_external(url: String) -> Result<(), String> {
    crate::blocking(move || open_https(&url)).await
}
