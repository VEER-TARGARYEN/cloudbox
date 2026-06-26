import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../theme';

// A labelled input. Extends TextInputProps so callers can pass any native prop
// (secureTextEntry, keyboardType, autoCapitalize, value, onChangeText, ...).
interface Props extends TextInputProps {
  label: string;
}

export function TextField({ label, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing(2) },
  label: {
    color: colors.muted,
    marginBottom: spacing(0.5),
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing(1.5),
    height: 50,
    fontSize: 16,
  },
});
