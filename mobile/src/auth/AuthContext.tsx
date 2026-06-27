import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { api, setApiBaseUrl, type User } from '../api/client';
import { DEFAULT_API_BASE_URL } from '../config';
import {
  deleteToken,
  getServerUrl,
  getToken,
  saveServerUrl,
  saveToken,
} from '../storage/secureStore';

interface AuthState {
  user: User | null;
  token: string | null;
  serverUrl: string; // the CloudBox server this device is connected to
  initializing: boolean;
  signIn: (serverUrl: string, email: string, password: string) => Promise<void>;
  signUp: (serverUrl: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

// Normalize a user-entered server URL: trim, default to https, strip trailing /.
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

  // On startup: restore the saved server URL + token and validate the session.
  useEffect(() => {
    (async () => {
      try {
        const savedServer = (await getServerUrl()) || DEFAULT_API_BASE_URL;
        if (savedServer) {
          setServerUrl(savedServer);
          setApiBaseUrl(savedServer);
        }

        const saved = await getToken();
        if (saved && savedServer) {
          const me = await api.me(saved); // throws if invalid/unreachable
          setToken(saved);
          setUser(me);
        }
      } catch {
        await deleteToken(); // stale/invalid token, or server unreachable
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  // Point the client at the given server, persist it, then run an auth call.
  const connectAndAuth = useCallback(
    async (rawServer: string, run: () => Promise<{ token: string; user: User }>) => {
      const url = normalizeUrl(rawServer);
      if (!url) throw new Error('Enter your server URL');

      setApiBaseUrl(url);
      const res = await run();

      await saveServerUrl(url);
      await saveToken(res.token);
      setServerUrl(url);
      setToken(res.token);
      setUser(res.user);
    },
    [],
  );

  const signIn = useCallback(
    (server: string, email: string, password: string) =>
      connectAndAuth(server, () => api.login(email, password)),
    [connectAndAuth],
  );

  const signUp = useCallback(
    (server: string, email: string, password: string) =>
      connectAndAuth(server, () => api.register(email, password)),
    [connectAndAuth],
  );

  const signOut = useCallback(async () => {
    await deleteToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, serverUrl, initializing, signIn, signUp, signOut }}
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
