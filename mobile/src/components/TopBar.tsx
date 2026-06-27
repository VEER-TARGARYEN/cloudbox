import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { BrandWordmark } from './Logo';
import { colors, font, PAGE_PADDING, spacing } from '../theme';

// App top bar: brand wordmark on the left, a circular initials avatar on the
// right that jumps to the Settings tab. Used on the main tab screens.
export function TopBar({ email }: { email?: string | null }) {
  const router = useRouter();
  const initial = (email?.trim()?.[0] ?? '?').toUpperCase();

  return (
    <View style={styles.bar}>
      <BrandWordmark size={22} />
      <Pressable onPress={() => router.push('/settings')} style={styles.avatar} hitSlop={8}>
        <Text style={styles.avatarText}>{initial}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_PADDING,
    paddingVertical: spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: font.bold, color: colors.primary, fontSize: 15 },
});
