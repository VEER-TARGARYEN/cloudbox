import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, font, radius } from '../theme';

// A cloud glyph inside a tinted rounded-square — the login hero mark.
export function BrandMark({ size = 72 }: { size?: number }) {
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size * 0.28 },
      ]}
    >
      <Feather name="cloud" size={size * 0.46} color={colors.primary} />
    </View>
  );
}

// Cloud icon + "CloudBox" wordmark — used in the top bar and register header.
export function BrandWordmark({ size = 22 }: { size?: number }) {
  return (
    <View style={styles.row}>
      <Feather name="cloud" size={size} color={colors.primary} />
      <Text style={[styles.word, { fontSize: size * 0.95 }]}>CloudBox</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontFamily: font.bold, color: colors.primary, letterSpacing: -0.2 },
});
