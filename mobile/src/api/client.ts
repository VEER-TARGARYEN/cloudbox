import * as LegacyFileSystem from 'expo-file-system/legacy';

import { API_BASE_URL } from '../config';

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

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
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

  // Upload via XMLHttpRequest, not fetch: React Native's fetch can't report
  // upload progress, but XHR fires `upload.onprogress`. A FormData part shaped
  // like { uri, name, type } is RN's way to stream a file straight from disk as
  // multipart/form-data — the bytes never sit in JS memory.
  uploadFile: (
    token: string,
    asset: UploadAsset,
    onProgress?: (fraction: number) => void,
    onCancelReady?: (cancel: () => void) => void,
  ) =>
    new Promise<FileItem>((resolve, reject) => {
      const form = new FormData();
      // The field name MUST be "file" — that's what the Go handler reads.
      form.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? 'application/octet-stream',
      } as any);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      // IMPORTANT: do NOT set Content-Type. XHR generates the multipart
      // boundary from FormData; overriding it corrupts the request body.

      xhr.upload.onprogress = (e: any) => {
        if (e?.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as FileItem);
          } catch {
            reject(new ApiError(xhr.status, 'Malformed server response'));
          }
        } else {
          let message = `Upload failed (${xhr.status})`;
          try {
            message = JSON.parse(xhr.responseText).error ?? message;
          } catch {
            /* keep default */
          }
          reject(new ApiError(xhr.status, message));
        }
      };

      xhr.onerror = () => reject(new ApiError(0, 'Network error during upload'));
      xhr.onabort = () => reject(new ApiError(0, 'Upload canceled'));

      // Expose a cancel function to the caller (the upload progress sheet).
      onCancelReady?.(() => xhr.abort());

      xhr.send(form);
    }),

  // Download an owned file to the device cache (authenticated) and return its
  // local file:// URI, ready to hand to the OS share/preview sheet. We use the
  // legacy FileSystem API because its downloadAsync accepts custom headers,
  // which we need to send the Bearer token.
  downloadToCache: async (token: string, file: FileItem): Promise<string> => {
    const safeName = file.name.replace(/[\\/:*?"<>|]/g, '_');
    const target = `${LegacyFileSystem.cacheDirectory ?? ''}${file.id}-${safeName}`;

    const res = await LegacyFileSystem.downloadAsync(
      `${API_BASE_URL}/files/${file.id}/download`,
      target,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (res.status >= 400) {
      throw new ApiError(res.status, `Download failed (${res.status})`);
    }
    return res.uri;
  },
};
