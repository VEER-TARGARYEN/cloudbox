import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Keys, namespaced to avoid clashes.
const TOKEN_KEY = 'cloudbox.jwt';
const SERVER_KEY = 'cloudbox.serverUrl';
const SESSION_KEY = 'cloudbox.session';

// On native (iOS/Android), expo-secure-store writes to the hardware-backed
// Keychain / Keystore. SecureStore doesn't exist on web, so there we fall back
// to localStorage (web is only for quick previews).
const webLS: any =
  typeof globalThis !== 'undefined' ? (globalThis as any).localStorage : undefined;

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webLS?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webLS?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webLS?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

// ── JWT ─────────────────────────────────────────────────────────────────────
export const saveToken = (token: string) => setItem(TOKEN_KEY, token);
export const getToken = () => getItem(TOKEN_KEY);
export const deleteToken = () => deleteItem(TOKEN_KEY);

// ── Server URL (which CloudBox server this device talks to) ──────────────────
export const saveServerUrl = (url: string) => setItem(SERVER_KEY, url);
export const getServerUrl = () => getItem(SERVER_KEY);
export const deleteServerUrl = () => deleteItem(SERVER_KEY);

// ── Session (the whole connection: direct OR broker, as JSON) ────────────────
export const saveSession = (json: string) => setItem(SESSION_KEY, json);
export const getSession = () => getItem(SESSION_KEY);
export const deleteSession = () => deleteItem(SESSION_KEY);
