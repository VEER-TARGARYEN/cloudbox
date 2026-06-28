# CloudBox launcher.
# Picks a per-user data folder (Program Files is read-only), then runs the
# server. The server itself opens a secure tunnel, opens the setup page in your
# browser, and shows the pairing QR. Keep this window open while using CloudBox.

$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Definition

$dataDir = Join-Path $env:LOCALAPPDATA 'CloudBox'
New-Item -ItemType Directory -Force -Path (Join-Path $dataDir 'storage') | Out-Null

# Stable signing secret (generated once so logins survive restarts).
$secretFile = Join-Path $dataDir 'jwt.secret'
if (-not (Test-Path $secretFile)) {
  $bytes = New-Object 'System.Byte[]' 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  Set-Content -Path $secretFile -Value ([Convert]::ToBase64String($bytes)) -Encoding ascii
}
$env:JWT_SECRET   = (Get-Content -Path $secretFile -Raw).Trim()
$env:DATABASE_URL = Join-Path $dataDir 'cloudbox.db'
$env:STORAGE_DIR  = Join-Path $dataDir 'storage'

Write-Host ""
Write-Host "  Starting CloudBox..." -ForegroundColor Cyan
Write-Host "  A setup page will open in your browser — sign in there, then scan" -ForegroundColor Gray
Write-Host "  the QR code with the CloudBox app on your phone." -ForegroundColor Gray
Write-Host ""
Write-Host "  Keep this window open while you use the app. Close it to stop." -ForegroundColor Gray
Write-Host ""

# The server opens the tunnel + the setup UI (http://127.0.0.1:8765) itself.
& (Join-Path $dir 'cloudbox.exe')

# Best-effort cleanup if the server exits normally.
taskkill /F /IM cloudflared.exe 2>$null | Out-Null
