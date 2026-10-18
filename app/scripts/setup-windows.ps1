# Open SAT Coach — setup and build on Windows 10/11 x64.
# Prerequisites (install once): Microsoft C++ Build Tools ("Desktop development with C++") and the WebView2 runtime (built into Windows 11).
# Usage (PowerShell):  cd path\to\test-coach\app ; powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
function Say($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }

Say "Rust"
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  if (Get-Command winget -ErrorAction SilentlyContinue) { winget install --id Rustlang.Rustup -e --accept-source-agreements --accept-package-agreements }
  else { throw "Install Rust from https://rustup.rs, then run this script again." }
  $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
}
cargo --version

Say "Node.js 20.6+"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  if (Get-Command winget -ErrorAction SilentlyContinue) { winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements }
  else { throw "Install Node.js LTS from https://nodejs.org, then run this script again." }
  $env:Path = "$env:ProgramFiles\nodejs;$env:Path"
}
node --version

Say "Dependencies and checks"
npm install --no-audit --no-fund
npm run typecheck
npm test

Say "Building the desktop app (first build takes several minutes)"
npm run desktop:build -- --bundles nsis
Get-ChildItem src-tauri\target\release\bundle\nsis\*.exe | ForEach-Object { Write-Host "Installer: $($_.FullName)" }
Write-Host "`nOptional AI coach: install Ollama (https://ollama.com/download) and run 'ollama pull gemma4:e4b', or use LM Studio."
