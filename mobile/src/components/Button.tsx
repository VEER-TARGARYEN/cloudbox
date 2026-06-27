import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, font, radius, spacing } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

// Pill-shaped button. Primary = filled indigo; secondary = light indigo tint.
// While `loading` it shows a spinner and is unpressable (blocks double-submit).
export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: Props) {
  const secondary = variant === 'secondary';
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        secondary ? styles.secondary : styles.primary,
        blocked && styles.blocked,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.primary : colors.onPrimary} />
      ) : (
        <Text style={[styles.label, secondary && styles.labelSecondary]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primaryTint },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
  blocked: { opacity: 0.5 },
  label: { fontFamily: font.semibold, fontSize: 16, color: colors.onPrimary },
  labelSecondary: { color: colors.primary },
});
