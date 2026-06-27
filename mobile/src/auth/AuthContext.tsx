import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { api, broker, setApiBaseUrl, type BrokerDevice, type User } from '../api/client';
import { DEFAULT_API_BASE_URL } from '../config';
import { deleteSession, getSession, saveSession } from '../storage/secureStore';

// A connection is either "direct" (you typed a server URL) or "broker" (paired
// via the cloud directory, which re-resolves the laptop's current URL on every
// launch — so the link survives changing tunnel URLs).
type Session =
  | { mode: 'direct'; serverUrl: string; token: string; email: string }
  | { mode: 'broker'; brokerUrl: string; brokerToken: string; deviceId: string; email: string };

interface AuthState {
  user: User | null;
  token: string | null;
  serverUrl: string;
  initializing: boolean;
  signIn: (serverUrl: string, email: string, password: string) => Promise<void>;
  signUp: (serverUrl: string, email: string, password: string) => Promise<void>;
  connectWithBroker: (
    brokerUrl: string,
    brokerToken: string,
    device: BrokerDevice,
    email: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, '');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string>(DEFAULT_API_BASE_URL);
  const [initializing, setInitializing] = useState(true);

  // Apply a resolved session to state.
  const apply = useCallback((laptopUrl: string, laptopToken: string, u: User) => {
    setApiBaseUrl(laptopUrl);
    setServerUrl(laptopUrl);
    setToken(laptopToken);
    setUser(u);
  }, []);

  // Restore + revalidate a saved session on startup.
  useEffect(() => {
    (async () => {
      try {
        const raw = await getSession();
        if (!raw) return;
        const s: Session = JSON.parse(raw);

        if (s.mode === 'direct') {
          setApiBaseUrl(s.serverUrl);
          const me = await api.me(s.token); // throws if token invalid
          apply(s.serverUrl, s.token, me);
        } else {
          // Broker: ask the broker where the laptop is right now, then exchange.
          const { devices } = await broker.devices(s.brokerUrl, s.brokerToken);
          const dev = devices.find((d) => d.id === s.deviceId);
          if (!dev || !dev.url) throw new Error('laptop offline');
          const { token: laptopToken } = await broker.exchange(dev.url, s.brokerToken);
          apply(dev.url, laptopToken, { id: '', email: s.email, created_at: '' });
        }
      } catch {
        await deleteSession();
      } finally {
        setInitializing(false);
      }
    })();
  }, [apply]);

  // ── Direct mode (manual server URL) ──────────────────────────────────────
  const directAuth = useCallback(
    async (rawServer: string, run: () => Promise<{ token: string; user: User }>) => {
      const url = normalizeUrl(rawServer);
      if (!url) throw new Error('Enter your server URL');
      setApiBaseUrl(url);
      const res = await run();
      const session: Session = { mode: 'direct', serverUrl: url, token: res.token, email: res.user.email };
      await saveSession(JSON.stringify(session));
      apply(url, res.token, res.user);
    },
    [apply],
  );

  const signIn = useCallback(
    (server: string, email: string, password: string) =>
      directAuth(server, () => api.login(email, password)),
    [directAuth],
  );

  const signUp = useCallback(
    (server: string, email: string, password: string) =>
      directAuth(server, () => api.register(email, password)),
    [directAuth],
  );

  // ── Broker mode (QR or broker email login) ───────────────────────────────
  const connectWithBroker = useCallback(
    async (brokerUrl: string, brokerToken: string, device: BrokerDevice, email: string) => {
      if (!device.url) throw new Error('That laptop is offline — start CloudBox on it first.');
      setApiBaseUrl(device.url);
      const { token: laptopToken } = await broker.exchange(device.url, brokerToken);
      const session: Session = {
        mode: 'broker',
        brokerUrl,
        brokerToken,
        deviceId: device.id,
        email,
      };
      await saveSession(JSON.stringify(session));
      apply(device.url, laptopToken, { id: '', email, created_at: '' });
    },
    [apply],
  );

  const signOut = useCallback(async () => {
    await deleteSession();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, serverUrl, initializing, signIn, signUp, connectWithBroker, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
