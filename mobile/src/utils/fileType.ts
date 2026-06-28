import { colors } from '../theme';

// Maps a MIME type to a Feather icon name + a tinted color pair for the
// 40px circular icon container used in file rows and sheets.
export type FileVisual = {
  icon: 'image' | 'file-text' | 'film' | 'music' | 'archive' | 'file';
  bg: string;
  fg: string;
};

export function fileVisual(mime: string): FileVisual {
  if (mime.startsWith('image/')) return { icon: 'image', bg: colors.primaryTint, fg: colors.primary };
  if (mime === 'application/pdf') return { icon: 'file-text', bg: colors.dangerTint, fg: colors.danger };
  if (mime.startsWith('video/')) return { icon: 'film', bg: colors.primaryTint, fg: colors.primary };
  if (mime.startsWith('audio/')) return { icon: 'music', bg: colors.primaryTint, fg: colors.primary };
  if (/zip|compress|tar|rar|7z|gzip/.test(mime)) {
    return { icon: 'archive', bg: colors.warningTint, fg: colors.warning };
  }
  if (mime.startsWith('text/')) return { icon: 'file-text', bg: colors.primaryTint, fg: colors.primary };
  return { icon: 'file', bg: colors.primaryTint, fg: colors.primary };
}

// Same idea, but inferred from the file extension (real filesystem entries
// don't carry a MIME type).
export function fileVisualByName(name: string): FileVisual {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic'].includes(ext)) {
    return { icon: 'image', bg: colors.primaryTint, fg: colors.primary };
  }
  if (ext === 'pdf') return { icon: 'file-text', bg: colors.dangerTint, fg: colors.danger };
  if (['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v'].includes(ext)) {
    return { icon: 'film', bg: colors.primaryTint, fg: colors.primary };
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
    return { icon: 'music', bg: colors.primaryTint, fg: colors.primary };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { icon: 'archive', bg: colors.warningTint, fg: colors.warning };
  }
  if (['txt', 'md', 'json', 'csv', 'log', 'xml', 'yml', 'yaml'].includes(ext)) {
    return { icon: 'file-text', bg: colors.primaryTint, fg: colors.primary };
  }
  return { icon: 'file', bg: colors.primaryTint, fg: colors.primary };
}

// Best-guess MIME type from a filename extension, so Android can pick the right
// app when opening a file. Falls back to */* (let the OS decide).
export function mimeFromName(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    heic: 'image/heic',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
    m4v: 'video/x-m4v',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    apk: 'application/vnd.android.package-archive',
  };
  return map[ext] ?? '*/*';
}

// Icon for a top-level root (drive or shortcut folder).
export function rootIcon(
  name: string,
): 'hard-drive' | 'home' | 'download' | 'monitor' | 'file-text' | 'folder' {
  if (/^[A-Za-z]:$/.test(name)) return 'hard-drive';
  const n = name.toLowerCase();
  if (n === 'home') return 'home';
  if (n === 'downloads') return 'download';
  if (n === 'desktop') return 'monitor';
  if (n === 'documents') return 'file-text';
  return 'folder';
}
