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

// A real filesystem starting point (a drive or a shortcut folder).
export interface FsRoot {
  name: string;
  path: string;
}

// One item in a directory listing.
export interface FsEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  mod_time: string;
}

interface FsRootsResponse {
  roots: FsRoot[];
  read_only: boolean;
}

interface FsListResponse {
  path: string;
  entries: FsEntry[];
}

// What an upload needs from a picked document.
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

// One small wrapper around fetch that JSON calls go through.
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
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

// Shared native multipart upload: copies the picked file to a path named after
// the original (so the server records the real filename), then streams it from
// disk with progress + cancel. Returns the parsed JSON response body.
async function uploadMultipart(
  url: string,
  token: string,
  asset: UploadAsset,
  onProgress?: (fraction: number) => void,
  onCancelReady?: (cancel: () => void) => void,
): Promise<any> {
  const cacheDir = LegacyFileSystem.cacheDirectory ?? '';
  const safeName = asset.name.replace(/[\\/:*?"<>|]/g, '_');
  const dest = `${cacheDir}cb-upload-${Date.now()}-${safeName}`;
  await LegacyFileSystem.copyAsync({ from: asset.uri, to: dest });

  const task = LegacyFileSystem.createUploadTask(
    url,
    dest,
    {
      uploadType: LegacyFileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file', // MUST be "file"
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
    return JSON.parse(res.body);
  } catch {
    throw new ApiError(res.status, 'Malformed server response');
  }
}

// Shared authenticated download to the device cache; returns the local URI.
async function downloadToCacheUrl(url: string, token: string, fileName: string): Promise<string> {
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, '_');
  const target = `${LegacyFileSystem.cacheDirectory ?? ''}cb-dl-${Date.now()}-${safeName}`;
  const res = await LegacyFileSystem.downloadAsync(url, target, {
    headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
  });
  if (res.status >= 400) {
    throw new ApiError(res.status, `Download failed (${res.status})`);
  }
  return res.uri;
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  register: (email: string, password: string) =>
    request<AuthResponse>('/register', { method: 'POST', body: { email, password } }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/login', { method: 'POST', body: { email, password } }),

  me: (token: string) => request<User>('/me', { token }),

  // ── Real filesystem browser ─────────────────────────────────────────────────
  fsRoots: (token: string) => request<FsRootsResponse>('/fs/roots', { token }),

  fsList: (token: string, path: string) =>
    request<FsListResponse>(`/fs/list?path=${encodeURIComponent(path)}`, { token }),

  fsDownloadToCache: (token: string, entry: FsEntry): Promise<string> =>
    downloadToCacheUrl(
      `${baseUrl}/fs/download?path=${encodeURIComponent(entry.path)}`,
      token,
      entry.name,
    ),

  fsUpload: (
    token: string,
    dirPath: string,
    asset: UploadAsset,
    onProgress?: (fraction: number) => void,
    onCancelReady?: (cancel: () => void) => void,
  ): Promise<FsEntry> =>
    uploadMultipart(
      `${baseUrl}/fs/upload?path=${encodeURIComponent(dirPath)}`,
      token,
      asset,
      onProgress,
      onCancelReady,
    ),
};
