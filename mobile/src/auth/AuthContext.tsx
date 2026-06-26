import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { api, type User } from '../api/client';
import { deleteToken, getToken, saveToken } from '../storage/secureStore';

// The shape every screen can consume via useAuth().
interface AuthState {
  user: User | null;
  token: string | null;
  initializing: boolean; // true while we restore a saved session at startup
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  // On startup: restore a token from secure storage and validate it by calling
  // /me. If it's missing or rejected (expired/tampered), we stay logged out.
  useEffect(() => {
    (async () => {
      try {
        const saved = await getToken();
        if (saved) {
          const me = await api.me(saved); // throws ApiError(401) if invalid
          setToken(saved);
          setUser(me);
        }
      } catch {
        await deleteToken(); // clear a stale/invalid token
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  // Shared "we now have a valid session" path for both sign-in and sign-up.
  const persistSession = useCallback(async (newToken: string, newUser: User) => {
    await saveToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      await persistSession(res.token, res.user);
    },
    [persistSession],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const res = await api.register(email, password);
      await persistSession(res.token, res.user);
    },
    [persistSession],
  );

  const signOut = useCallback(async () => {
    await deleteToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, initializing, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Typed hook with a guard: using it outside <AuthProvider> is a programming
// error, so we fail loudly instead of returning undefined.
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
