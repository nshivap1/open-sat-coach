//! `http_local`: plain HTTP requests to loopback addresses only (local model servers).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use std::net::{Ipv4Addr, Ipv6Addr};
use std::time::Duration;

const DEFAULT_TIMEOUT_MS: f64 = 60_000.0;
const MAX_TIMEOUT_MS: f64 = 600_000.0;
const MAX_BODY_BYTES: u64 = 64 * 1024 * 1024;
const NOT_LOCAL: &str = "Only local addresses are allowed";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub status: u16,
    pub body: String,
}

/// Parses `raw` and accepts only `http://localhost`, `http://127.0.0.1` or `http://[::1]`.
pub fn check_loopback(raw: &str) -> Result<url::Url, String> {
    let parsed = url::Url::parse(raw).map_err(|_| NOT_LOCAL.to_string())?;
    if parsed.scheme() != "http" || !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(NOT_LOCAL.to_string());
    }
    let allowed = match parsed.host() {
        Some(url::Host::Domain(domain)) => domain.eq_ignore_ascii_case("localhost"),
        Some(url::Host::Ipv4(ip)) => ip == Ipv4Addr::LOCALHOST,
        Some(url::Host::Ipv6(ip)) => ip == Ipv6Addr::LOCALHOST,
        None => false,
    };
    if allowed {
        Ok(parsed)
    } else {
        Err(NOT_LOCAL.to_string())
    }
}

fn read_body(resp: ureq::Response) -> Result<String, String> {
    let mut buf = Vec::new();
    resp.into_reader()
        .take(MAX_BODY_BYTES)
        .read_to_end(&mut buf)
        .map_err(|e| format!("Could not read the response: {e}"))?;
    Ok(String::from_utf8_lossy(&buf).into_owned())
}

fn perform(req: HttpRequest) -> Result<HttpResponse, String> {
    let target = check_loopback(&req.url)?;
    let method = req.method.trim().to_ascii_uppercase();
    if method != "GET" && method != "POST" {
        return Err(format!("Unsupported HTTP method: {}", req.method));
    }
    let timeout_ms = req
        .timeout_ms
        .filter(|v| v.is_finite() && *v > 0.0)
        .unwrap_or(DEFAULT_TIMEOUT_MS)
        .min(MAX_TIMEOUT_MS);
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_millis(timeout_ms as u64))
        .redirects(0) // a redirect could leave loopback
        .build();

    let mut request = agent.request(&method, target.as_str());
    for (name, value) in &req.headers {
        let lower = name.to_ascii_lowercase();
        // ureq manages these itself.
        if matches!(
            lower.as_str(),
            "host" | "content-length" | "connection" | "transfer-encoding"
        ) {
            continue;
        }
        request = request.set(name, value);
    }

    let result = if method == "POST" {
        request.send_string(req.body.as_deref().unwrap_or(""))
    } else {
        request.call()
    };

    match result {
        Ok(resp) => {
            let status = resp.status();
            Ok(HttpResponse { status, body: read_body(resp)? })
        }
        Err(ureq::Error::Status(code, resp)) => Ok(HttpResponse { status: code, body: read_body(resp)? }),
        Err(e) => Err(format!("Could not reach {}: {e}", target.as_str())),
    }
}

#[tauri::command]
pub async fn http_local(req: HttpRequest) -> Result<HttpResponse, String> {
    crate::blocking(move || perform(req)).await
}
