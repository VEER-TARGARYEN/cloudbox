import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, font, radius, spacing } from '../theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface Props extends TextInputProps {
  label?: string;
  hint?: string;
  leftIcon?: FeatherName;
  rightSlot?: React.ReactNode; // e.g. a show/hide password toggle
}

// Filled input with a hairline border that turns indigo on focus. Supports an
// optional label, helper hint, leading icon, and a trailing slot.
export function TextField({ label, hint, leftIcon, rightSlot, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.field, focused && styles.fieldFocused]}>
        {leftIcon ? (
          <Feather name={leftIcon} size={20} color={colors.textFaint} style={styles.leftIcon} />
        ) : null}

        <TextInput
          placeholderTextColor={colors.textFaint}
          style={[styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />

        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing(4) },
  label: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing(2),
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    height: 56,
    paddingHorizontal: spacing(4),
  },
  fieldFocused: { borderColor: colors.primary },
  leftIcon: { marginRight: spacing(3) },
  input: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.text,
    padding: 0, // remove Android default vertical padding
  },
  rightSlot: { marginLeft: spacing(3) },
  hint: {
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.textFaint,
    marginTop: spacing(2),
    marginLeft: spacing(1),
  },
});
