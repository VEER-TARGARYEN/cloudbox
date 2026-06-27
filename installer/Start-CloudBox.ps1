# CloudBox launcher.
# Starts the local CloudBox server AND a secure public tunnel, then prints the
# URL to enter in the CloudBox mobile app. Keep the window open while using it.

$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Definition

$serverExe = Join-Path $dir 'cloudbox.exe'
$tunnelExe = Join-Path $dir 'cloudflared.exe'

# All writable state lives under %LOCALAPPDATA%\CloudBox (Program Files is
# read-only). Files, the database, and the signing secret persist here.
$dataDir = Join-Path $env:LOCALAPPDATA 'CloudBox'
New-Item -ItemType Directory -Force -Path (Join-Path $dataDir 'storage') | Out-Null
$tunnelLog = Join-Path $dataDir 'tunnel.log'

# Stable JWT secret, generated once and reused so logins survive restarts.
$secretFile = Join-Path $dataDir 'jwt.secret'
if (-not (Test-Path $secretFile)) {
  $bytes = New-Object 'System.Byte[]' 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  Set-Content -Path $secretFile -Value ([Convert]::ToBase64String($bytes)) -Encoding ascii
}

$env:JWT_SECRET   = (Get-Content -Path $secretFile -Raw).Trim()
$env:DATABASE_URL = Join-Path $dataDir 'cloudbox.db'
$env:STORAGE_DIR  = Join-Path $dataDir 'storage'
$env:PORT         = '8080'

Write-Host "Starting CloudBox server..." -ForegroundColor Cyan
$server = Start-Process -FilePath $serverExe -PassThru -WindowStyle Hidden

Write-Host "Opening a secure public tunnel (~10 seconds)..." -ForegroundColor Cyan
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }
$tunnel = Start-Process -FilePath $tunnelExe `
  -ArgumentList @('tunnel', '--url', 'http://localhost:8080') `
  -PassThru -WindowStyle Hidden -RedirectStandardError $tunnelLog

# Wait for the public URL to appear in the tunnel log.
$url = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-Path $tunnelLog) {
    $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value; break }
  }
}

Clear-Host
Write-Host ""
Write-Host "  ==================================================" -ForegroundColor Green
Write-Host "     CloudBox is running" -ForegroundColor Green
Write-Host "  ==================================================" -ForegroundColor Green
Write-Host ""
if ($url) {
  Write-Host "  Open the CloudBox app and enter this Server URL:" -ForegroundColor White
  Write-Host ""
  Write-Host "      $url" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  Note: this address changes each time you start CloudBox." -ForegroundColor Gray
  Write-Host "  For a permanent address, see the named-tunnel guide in the" -ForegroundColor Gray
  Write-Host "  project README." -ForegroundColor Gray
} else {
  Write-Host "  Could not open the public tunnel. Check your internet" -ForegroundColor Red
  Write-Host "  connection, then close and reopen CloudBox." -ForegroundColor Red
  Write-Host "  Details: $tunnelLog" -ForegroundColor Red
}
Write-Host ""
Write-Host "  Your files are stored in:" -ForegroundColor Gray
Write-Host "    $($env:STORAGE_DIR)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Keep this window OPEN while using the app." -ForegroundColor Gray
Write-Host "  Close it to stop CloudBox." -ForegroundColor Gray
Write-Host ""

# Run until the user closes the window; then stop both processes.
try {
  Wait-Process -Id $server.Id
} finally {
  Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
}
