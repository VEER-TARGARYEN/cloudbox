// Display helpers shared by the file list.

// 1536 -> "1.5 KB", 1048576 -> "1 MB".
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

// ISO timestamp -> "Today, 09:41", "Yesterday", or "Jun 26".
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(d, now)) {
    return `Today, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Short MIME label for the file-actions sheet, e.g. "application/pdf" -> "PDF".
export function mimeLabel(mime: string): string {
  if (!mime) return 'File';
  if (mime === 'application/pdf') return 'PDF';
  const [type, sub] = mime.split('/');
  if (sub && sub.length <= 5) return sub.toUpperCase();
  return type ? type.toUpperCase() : 'File';
}
