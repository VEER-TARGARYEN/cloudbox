import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}

// A single button used everywhere. While `loading` it shows a spinner and
// becomes unpressable, so a double-tap can't fire two requests.
export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: Props) {
  const isGhost = variant === 'ghost';
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        isGhost ? styles.ghost : styles.primary,
        blocked && styles.blocked,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? colors.primary : colors.primaryText} />
      ) : (
        <Text style={[styles.label, isGhost && styles.ghostLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2),
  },
  primary: { backgroundColor: colors.primary },
  ghost: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.85 },
  blocked: { opacity: 0.5 },
  label: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
  ghostLabel: { color: colors.primary },
});
