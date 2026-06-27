import * as LegacyFileSystem from 'expo-file-system/legacy';

import { DEFAULT_API_BASE_URL } from '../config';

// Runtime-configurable base URL: set from the saved server URL at startup and
// whenever the user signs in. This is what lets a single APK work against any
// CloudBox server.
let baseUrl = DEFAULT_API_BASE_URL;

export function setApiBaseUrl(url: string) {
  baseUrl = url.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  return baseUrl;
}

// ── Types that mirror the Go API's JSON shapes ──────────────────────────────
export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface FileItem {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

interface ListFilesResponse {
  count: number;
  files: FileItem[];
}

// What the upload flow needs from a picked document.
export interface UploadAsset {
  uri: string;
  name: string;
  mimeType?: string | null;
}

// A single error type the UI can switch on. `status === 0` means the request
// never reached the server (network/DNS/offline).
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

// One small wrapper around fetch that JSON calls go through: sets headers,
// attaches the Bearer token, parses JSON, and turns non-2xx responses into a
// typed ApiError carrying the server's {"error": "..."} message.
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    // Tell ngrok's free tier to skip its browser-warning interstitial so the
    // app always gets the real JSON response (harmless on other hosts).
    'ngrok-skip-browser-warning': 'true',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Network error — is the server reachable?');
  }

  const raw = await res.text();
  let data: any = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  register: (email: string, password: string) =>
    request<AuthResponse>('/register', { method: 'POST', body: { email, password } }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/login', { method: 'POST', body: { email, password } }),

  me: (token: string) => request<User>('/me', { token }),

  // ── Files ─────────────────────────────────────────────────────────────────
  listFiles: (token: string) => request<ListFilesResponse>('/files', { token }),

  deleteFile: (token: string, id: string) =>
    request<null>(`/files/${id}`, { method: 'DELETE', token }),

  // Upload with expo-file-system's native multipart uploader. Unlike the RN
  // XHR + FormData path (which can silently send an empty file on Android), this
  // reads the bytes straight from disk in native code — reliable, with progress
  // and cancel support.
  uploadFile: async (
    token: string,
    asset: UploadAsset,
    onProgress?: (fraction: number) => void,
    onCancelReady?: (cancel: () => void) => void,
  ): Promise<FileItem> => {
    // Copy the picked file to a path named after the original file, so the
    // multipart filename (the last path segment) is the real name.
    const cacheDir = LegacyFileSystem.cacheDirectory ?? '';
    const safeName = asset.name.replace(/[\\/:*?"<>|]/g, '_');
    const dest = `${cacheDir}cb-upload-${Date.now()}-${safeName}`;
    await LegacyFileSystem.copyAsync({ from: asset.uri, to: dest });

    const task = LegacyFileSystem.createUploadTask(
      `${baseUrl}/upload`,
      dest,
      {
        uploadType: LegacyFileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file', // MUST be "file" — that's what the Go handler reads
        mimeType: asset.mimeType ?? 'application/octet-stream',
        headers: {
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      },
      (p) => {
        if (onProgress && p.totalBytesExpectedToSend > 0) {
          onProgress(p.totalBytesSent / p.totalBytesExpectedToSend);
        }
      },
    );

    // Expose a cancel function to the caller (the upload progress sheet).
    onCancelReady?.(() => {
      task.cancelAsync().catch(() => {});
    });

    let res;
    try {
      res = await task.uploadAsync();
    } finally {
      LegacyFileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
    }

    if (!res) throw new ApiError(0, 'Upload canceled');
    if (res.status < 200 || res.status >= 300) {
      let message = `Upload failed (${res.status})`;
      try {
        message = JSON.parse(res.body).error ?? message;
      } catch {
        /* keep default */
      }
      throw new ApiError(res.status, message);
    }
    try {
      return JSON.parse(res.body) as FileItem;
    } catch {
      throw new ApiError(res.status, 'Malformed server response');
    }
  },

  // Download an owned file to the device cache (authenticated) and return its
  // local file:// URI, ready to hand to the OS share/preview sheet. We use the
  // legacy FileSystem API because its downloadAsync accepts custom headers,
  // which we need to send the Bearer token.
  downloadToCache: async (token: string, file: FileItem): Promise<string> => {
    const safeName = file.name.replace(/[\\/:*?"<>|]/g, '_');
    const target = `${LegacyFileSystem.cacheDirectory ?? ''}${file.id}-${safeName}`;

    const res = await LegacyFileSystem.downloadAsync(
      `${baseUrl}/files/${file.id}/download`,
      target,
      { headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } },
    );

    if (res.status >= 400) {
      throw new ApiError(res.status, `Download failed (${res.status})`);
    }
    return res.uri;
  },
};
