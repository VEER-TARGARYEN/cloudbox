import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { type FileItem } from '../api/client';
import { fileVisual } from '../utils/fileType';
import { formatBytes, formatDate } from '../utils/format';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  file: FileItem;
  busy?: boolean; // true while this row is downloading
  onPress: () => void; // open the actions sheet
}

// A card row: 40px circular tinted type-icon, name, "size · date", kebab.
export function FileRow({ file, busy = false, onPress }: Props) {
  const v = fileVisual(file.mime_type);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.iconCircle, { backgroundColor: v.bg }]}>
        <Feather name={v.icon} size={20} color={v.fg} />
      </View>

      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {file.name}
        </Text>
        <Text style={styles.sub}>
          {formatBytes(file.size_bytes)} · {formatDate(file.created_at)}
        </Text>
      </View>

      {busy ? (
        <ActivityIndicator color={colors.primary} style={styles.trailing} />
      ) : (
        <Feather name="more-vertical" size={20} color={colors.textFaint} style={styles.trailing} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(3),
    marginBottom: spacing(3),
  },
  pressed: { backgroundColor: colors.surfaceLow },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(3),
  },
  meta: { flex: 1, marginRight: spacing(2) },
  name: { fontFamily: font.semibold, fontSize: 16, color: colors.text },
  sub: { fontFamily: font.medium, fontSize: 13, color: colors.textFaint, marginTop: 2 },
  trailing: { width: 24, textAlign: 'center' },
});
