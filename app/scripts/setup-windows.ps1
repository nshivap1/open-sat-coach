# Open SAT Coach — setup and build on Windows 10/11 x64.
# Prerequisites (install once): Microsoft C++ Build Tools ("Desktop development with C++") and the WebView2 runtime (built into Windows 11).
# Also bundles llama.cpp's llama-server.exe (latest GitHub release, Vulkan or CPU build) into src-tauri\binaries\.
# Usage (PowerShell):  cd path\to\test-coach\app ; powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1 [--refresh-runtime]
$ErrorActionPreference = "Stop"
$RefreshRuntime = ($args -contains '--refresh-runtime') -or ($args -contains '-RefreshRuntime')
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

Say "llama.cpp runtime (bundled llama-server.exe)"
$BinDir = Join-Path (Get-Location) "src-tauri\binaries"
$ServerExe = Join-Path $BinDir "llama-server.exe"
if ((Test-Path $ServerExe) -and -not $RefreshRuntime) {
  Write-Host "ok: $ServerExe already present (pass --refresh-runtime to update it)"
} else {
  $Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("llama-runtime-" + [guid]::NewGuid().ToString("N"))
  try {
    # Windows PowerShell 5.1 may default to TLS 1.0; GitHub needs TLS 1.2.
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $OldProgress = $ProgressPreference
    $ProgressPreference = "SilentlyContinue"   # Invoke-WebRequest is very slow with the progress bar
    $Release = Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest" -Headers @{ "User-Agent" = "OpenSATCoach-setup"; "Accept" = "application/vnd.github+json" }
    $Asset = $Release.assets | Where-Object { $_.name -like "*bin-win-vulkan-x64.zip" } | Select-Object -First 1
    if (-not $Asset) { $Asset = $Release.assets | Where-Object { $_.name -like "*bin-win-cpu-x64.zip" } | Select-Object -First 1 }
    if (-not $Asset) { throw "No bin-win-vulkan-x64.zip or bin-win-cpu-x64.zip asset in release $($Release.tag_name)." }
    New-Item -ItemType Directory -Force -Path $Tmp | Out-Null
    $Zip = Join-Path $Tmp "llama.zip"
    Write-Host "Downloading $($Asset.browser_download_url)"
    Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $Zip -UseBasicParsing
    $Extract = Join-Path $Tmp "x"
    Expand-Archive -Path $Zip -DestinationPath $Extract -Force
    $Server = Get-ChildItem -Path $Extract -Recurse -File -Filter "llama-server.exe" | Select-Object -First 1
    if (-not $Server) { throw "llama-server.exe not found in $($Asset.name)." }
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
    # Replace any previous runtime, keeping the README placeholder.
    Get-ChildItem -Path $BinDir -Force | Where-Object { $_.Name -ne "README.md" } | Remove-Item -Recurse -Force
    Copy-Item -Path $Server.FullName -Destination $ServerExe -Force
    Get-ChildItem -Path $Server.DirectoryName -File -Filter "*.dll" | ForEach-Object { Copy-Item -Path $_.FullName -Destination $BinDir -Force }
    Write-Host "ok: $ServerExe ($($Asset.name))"
  } catch {
    Write-Warning "Could not download the llama.cpp runtime: $($_.Exception.Message)"
    Write-Warning "The app will still build and work with Ollama, LM Studio or a llama.cpp you install yourself."
  } finally {
    if ($OldProgress) { $ProgressPreference = $OldProgress }
    if (Test-Path $Tmp) { Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue }
  }
}

Say "Building the desktop app (first build takes several minutes)"
npm run desktop:build -- --bundles nsis
Get-ChildItem src-tauri\target\release\bundle\nsis\*.exe | ForEach-Object { Write-Host "Installer: $($_.FullName)" }
Write-Host "`nOptional AI coach: the app can download Gemma itself and run it with the bundled llama-server.exe."
Write-Host "Alternatively install Ollama (https://ollama.com/download) and run 'ollama pull gemma4:e4b', or use LM Studio."
