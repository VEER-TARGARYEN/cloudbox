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
