# Builds CloudBox-Setup.exe.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File installer\build.ps1
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition)
$installer = Join-Path $repo 'installer'
$dist = Join-Path $installer 'dist'

New-Item -ItemType Directory -Force -Path $dist | Out-Null

Write-Host "[1/4] Building cloudbox.exe (static, windows/amd64)..." -ForegroundColor Cyan
Push-Location (Join-Path $repo 'backend')
$env:CGO_ENABLED = '0'; $env:GOOS = 'windows'; $env:GOARCH = 'amd64'
go build -ldflags "-s -w" -o (Join-Path $dist 'cloudbox.exe') ./cmd/server
Pop-Location

Write-Host "[2/4] Bundling cloudflared.exe..." -ForegroundColor Cyan
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) { $cf = "C:\Program Files (x86)\cloudflared\cloudflared.exe" }
if (-not (Test-Path $cf)) { throw "cloudflared.exe not found. Install with: winget install Cloudflare.cloudflared" }
Copy-Item $cf (Join-Path $dist 'cloudflared.exe') -Force

Write-Host "[3/4] Staging launcher + readme..." -ForegroundColor Cyan
Copy-Item (Join-Path $installer 'Start-CloudBox.ps1') (Join-Path $dist 'Start-CloudBox.ps1') -Force
@"
CloudBox
========
Click "Start CloudBox" (Start Menu or Desktop). A setup page opens in your
browser: sign in or create an account, and a QR code appears. On your phone,
open the CloudBox app, tap "Scan QR code", and point it at the screen.

Keep the window open while using the app. Close it to stop.
Your files stay on this PC under %LOCALAPPDATA%\CloudBox\storage
"@ | Out-File -FilePath (Join-Path $dist 'README.txt') -Encoding ascii

Write-Host "[4/4] Compiling installer with Inno Setup..." -ForegroundColor Cyan
$iscc = (Get-Command iscc -ErrorAction SilentlyContinue).Source
foreach ($cand in @("$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe", "C:\Program Files (x86)\Inno Setup 6\ISCC.exe")) {
  if (-not $iscc -and (Test-Path $cand)) { $iscc = $cand }
}
if (-not $iscc -or -not (Test-Path $iscc)) { throw "ISCC.exe not found. Install with: winget install JRSoftware.InnoSetup" }
& $iscc (Join-Path $installer 'cloudbox.iss')

Write-Host "`nDone -> installer\Output\CloudBox-Setup.exe" -ForegroundColor Green
