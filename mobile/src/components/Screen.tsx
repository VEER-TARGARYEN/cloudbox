import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors } from '../theme';

// A page frame: fills the screen with the app background, respects safe areas,
// and lifts content above the keyboard on iOS. Children manage their own
// horizontal padding (so headers/sheets can go full-bleed).
export function Screen({
  children,
  edges = ['top', 'bottom'],
}: {
  children: ReactNode;
  edges?: readonly Edge[];
}) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
});
