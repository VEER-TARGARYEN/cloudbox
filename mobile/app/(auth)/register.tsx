import { useState } from 'react';
import { Link } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { BrandWordmark } from '../../src/components/Logo';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiError } from '../../src/api/client';
import { colors, font, PAGE_PADDING, spacing, typography } from '../../src/theme';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    // Client-side checks mirror the server's rules for instant feedback.
    if (!email.includes('@')) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Please re-enter them.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password);
    } catch (e) {
      Alert.alert('Registration failed', e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <BrandWordmark size={24} />
        </View>

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Start storing files on your own cloud.</Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            leftIcon="mail"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextField
            label="Password"
            leftIcon="lock"
            placeholder="••••••••"
            hint="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <TextField
            label="Confirm password"
            leftIcon="lock"
            placeholder="••••••••"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
          />

          <View style={{ height: spacing(2) }} />
          <Button label="Create account" onPress={onSubmit} loading={loading} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.muted}>Already have an account? </Text>
          <Link href="/login" style={styles.link}>
            Sign in
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: PAGE_PADDING, paddingVertical: spacing(8) },
  brand: { marginBottom: spacing(6) },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing(2) },
  form: { marginTop: spacing(8) },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing(6) },
  muted: { ...typography.body, color: colors.textMuted },
  link: { fontFamily: font.semibold, fontSize: 16, color: colors.primary },
});
