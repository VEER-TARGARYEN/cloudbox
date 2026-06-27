// Where the Go backend lives.
//
// IMPORTANT: a phone cannot reach your laptop via "localhost" — that means the
// phone itself. During local development on a real device, point this at your
// laptop's LAN IP (e.g. http://192.168.1.20:8080). In Phase 6 you'll switch it
// to your public Cloudflare/Ngrok HTTPS URL so it works from anywhere.
//
// Expo inlines any variable prefixed with EXPO_PUBLIC_ at build time, so you can
// override this without touching code:
//   EXPO_PUBLIC_API_URL=https://your-tunnel.trycloudflare.com  (see .env.example)
// The server URL is now entered IN THE APP (see the Server field on the login
// screen) and stored on the device, so one APK works against any CloudBox
// server. EXPO_PUBLIC_API_URL is only an optional default to prefill that field
// (handy for your own build); leave it unset for a generic, shareable APK.
export const DEFAULT_API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') || ''
);

// The default cloud broker URL (one shared broker for everyone). Used to
// prefill the broker fields on the Connect screens; QR pairing can override it.
export const DEFAULT_BROKER_URL = (
  process.env.EXPO_PUBLIC_BROKER_URL?.replace(/\/+$/, '') || ''
);
