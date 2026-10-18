# ADR 0001 — Desktop shell: Tauri 2

Status: accepted (M1) · Date: 2026-10-18

**Decision.** Wrap the existing React/TypeScript UI in Tauri 2. Rust owns storage, loopback HTTP, file scanning, and the llama-server process. The webview only calls typed commands (`src/ai/types.ts` lists the contract).

**Why.** Small installers (the system webview, not a bundled Chromium), a permissive license (MIT/Apache-2.0), a strict CSP, and native process control for the model runtime.

**Consequences.**
- macOS 13+ (Apple Silicon) and Windows 10/11 x64.
- Windows needs WebView2. It ships with Windows 11; the offline installer must bundle it before public release (FR-12).
- The web build (`dist/index.html`) stays as a preview and test target, using the same UI and domain code.
