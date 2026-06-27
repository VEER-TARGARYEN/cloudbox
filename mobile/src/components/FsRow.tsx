import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, font, radius, spacing } from '../theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface Props {
  title: string;
  subtitle?: string; // "size · date" for files; omitted for folders/roots
  icon: FeatherName;
  iconBg: string;
  iconFg: string;
  showChevron?: boolean; // folders + roots navigate inward
  busy?: boolean; // file is downloading
  onPress: () => void;
}

// One row in the filesystem browser — a drive, folder, or file.
export function FsRow({
  title,
  subtitle,
  icon,
  iconBg,
  iconFg,
  showChevron = false,
  busy = false,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={20} color={iconFg} />
      </View>

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : showChevron ? (
        <Feather name="chevron-right" size={20} color={colors.textFaint} />
      ) : null}
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
    marginBottom: spacing(2),
  },
  pressed: { backgroundColor: colors.surfaceLow },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(3),
  },
  meta: { flex: 1, marginRight: spacing(2) },
  title: { fontFamily: font.semibold, fontSize: 16, color: colors.text },
  sub: { fontFamily: font.medium, fontSize: 13, color: colors.textFaint, marginTop: 2 },
});
