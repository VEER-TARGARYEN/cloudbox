import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { type FileItem } from '../api/client';
import { fileEmoji, formatBytes, formatDate } from '../utils/format';
import { colors, radius, spacing } from '../theme';

interface Props {
  file: FileItem;
  busy?: boolean; // true while this row is downloading
  onPress: () => void; // tap to download + open
  onDelete: () => void;
}

export function FileRow({ file, busy = false, onPress, onDelete }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.icon}>{fileEmoji(file.mime_type)}</Text>

      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {file.name}
        </Text>
        <Text style={styles.sub}>
          {formatBytes(file.size_bytes)} · {formatDate(file.created_at)}
        </Text>
      </View>

      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Pressable onPress={onDelete} hitSlop={12} style={styles.delete}>
          <Text style={styles.deleteText}>✕</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(1.5),
    marginBottom: spacing(1),
  },
  pressed: { opacity: 0.7 },
  icon: { fontSize: 26, marginRight: spacing(1.5) },
  meta: { flex: 1, marginRight: spacing(1) },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  delete: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  deleteText: { color: colors.muted, fontSize: 16, fontWeight: '700' },
});
