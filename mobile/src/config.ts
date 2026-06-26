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
const FALLBACK = 'http://localhost:8080';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') || FALLBACK
);
