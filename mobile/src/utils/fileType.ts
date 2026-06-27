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
