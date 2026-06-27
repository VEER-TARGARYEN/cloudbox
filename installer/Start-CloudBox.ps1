# CloudBox launcher.
# Starts a secure public tunnel and the CloudBox server. In STANDALONE mode it
# prints the Server URL to type into the app. If a broker is configured
# (see %LOCALAPPDATA%\CloudBox\broker.env), it runs in PAIRED mode: the server
# registers with the broker and shows a QR code to scan from the app.

$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Definition

$serverExe = Join-Path $dir 'cloudbox.exe'
$tunnelExe = Join-Path $dir 'cloudflared.exe'

# Per-user writable state (Program Files is read-only).
$dataDir = Join-Path $env:LOCALAPPDATA 'CloudBox'
New-Item -ItemType Directory -Force -Path (Join-Path $dataDir 'storage') | Out-Null
$tunnelLog = Join-Path $dataDir 'tunnel.log'
$qrPath = Join-Path $dataDir 'pair-qr.png'

# Stable JWT secret (generated once).
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

# 1. Open the tunnel FIRST so we know the public URL before starting the server
#    (the server needs it for broker pairing).
Write-Host "Opening a secure public tunnel (~10 seconds)..." -ForegroundColor Cyan
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }
if (Test-Path $qrPath) { Remove-Item $qrPath -Force }
$tunnel = Start-Process -FilePath $tunnelExe `
  -ArgumentList @('tunnel', '--url', 'http://localhost:8080') `
  -PassThru -WindowStyle Hidden -RedirectStandardError $tunnelLog

$url = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-Path $tunnelLog) {
    $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value; break }
  }
}

# 2. If broker.env exists, enable PAIRED mode.
$brokerEnv = Join-Path $dataDir 'broker.env'
$paired = $false
if ((Test-Path $brokerEnv) -and $url) {
  foreach ($line in Get-Content $brokerEnv) {
    $line = $line.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { continue }
    $kv = $line -split '=', 2
    if ($kv.Count -eq 2) { Set-Item -Path ("Env:" + $kv[0].Trim()) -Value $kv[1].Trim() }
  }
  $env:PUBLIC_URL = $url
  if (-not $env:DEVICE_NAME) { $env:DEVICE_NAME = $env:COMPUTERNAME }
  $paired = $true
}

# 3. Start the server.
Write-Host "Starting CloudBox server..." -ForegroundColor Cyan
$server = Start-Process -FilePath $serverExe -PassThru -WindowStyle Hidden

Clear-Host
Write-Host ""
Write-Host "  ==================================================" -ForegroundColor Green
Write-Host "     CloudBox is running" -ForegroundColor Green
Write-Host "  ==================================================" -ForegroundColor Green
Write-Host ""
if (-not $url) {
  Write-Host "  Could not open the public tunnel. Check your internet" -ForegroundColor Red
  Write-Host "  and try again. Details: $tunnelLog" -ForegroundColor Red
} elseif ($paired) {
  Write-Host "  PAIRED MODE — scan the QR code in the CloudBox app." -ForegroundColor White
  # Wait briefly for the server to write the QR, then open it.
  for ($i = 0; $i -lt 20; $i++) { if (Test-Path $qrPath) { break }; Start-Sleep -Milliseconds 500 }
  if (Test-Path $qrPath) {
    Start-Process $qrPath   # open the QR image
    Write-Host "  (A QR image just opened. Scan it from the app's Connect screen.)" -ForegroundColor Gray
  } else {
    Write-Host "  Waiting for the broker... see logs if the QR doesn't appear." -ForegroundColor Gray
  }
} else {
  Write-Host "  Open the CloudBox app and enter this Server URL:" -ForegroundColor White
  Write-Host ""
  Write-Host "      $url" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  (This address changes each launch. To make it permanent and use" -ForegroundColor Gray
  Write-Host "   QR pairing instead, set up broker.env — see the README.)" -ForegroundColor Gray
}
Write-Host ""
Write-Host "  Your files are stored on this PC. Keep this window OPEN while" -ForegroundColor Gray
Write-Host "  using the app; close it to stop CloudBox." -ForegroundColor Gray
Write-Host ""

try {
  Wait-Process -Id $server.Id
} finally {
  Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
}
