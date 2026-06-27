# CloudBox — Windows installer

This folder builds **`CloudBox-Setup.exe`**, a one-click installer that lets
anyone run a CloudBox server on their Windows laptop. After installing, the user
just clicks **Start CloudBox**: it launches the server, opens a secure public
tunnel, and prints the URL to type into the CloudBox mobile app.

## What gets installed
- `cloudbox.exe` — the Go server (static, no dependencies)
- `cloudflared.exe` — Cloudflare Tunnel client (gives a public HTTPS URL)
- `Start-CloudBox.ps1` — the launcher (server + tunnel + shows the URL)

Files, the database, and the JWT secret are stored per-user under
`%LOCALAPPDATA%\CloudBox` (so they persist and don't need admin rights).

## Build it
Prereqs: [Go](https://go.dev/dl/), [Inno Setup 6](https://jrsoftware.org/isdl.php)
(`winget install JRSoftware.InnoSetup`), and `cloudflared`
(`winget install Cloudflare.cloudflared`).

```powershell
# from the repo root
powershell -ExecutionPolicy Bypass -File installer\build.ps1
```

This stages everything into `installer\dist\` and produces
`installer\Output\CloudBox-Setup.exe`. Attach that file to a GitHub Release.

> The quick tunnel gives a **fresh URL each launch**. For a permanent address,
> set up a named Cloudflare tunnel (see the main README) — the launcher can be
> pointed at it instead.
