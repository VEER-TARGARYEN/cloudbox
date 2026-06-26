import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// The single key under which we store the JWT. Namespaced to avoid clashes.
const TOKEN_KEY = 'cloudbox.jwt';

// On native (iOS/Android), expo-secure-store writes to the hardware-backed
// Keychain / Keystore — encrypted at rest and inaccessible to other apps.
// SecureStore doesn't exist on web, so there we fall back to localStorage
// (web is only for quick previews; real device security is the point here).
const webLS: any =
  typeof globalThis !== 'undefined' ? (globalThis as any).localStorage : undefined;

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    webLS?.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webLS?.getItem(TOKEN_KEY) ?? null;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken(): Promise<void> {
  if (Platform.OS === 'web') {
    webLS?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
