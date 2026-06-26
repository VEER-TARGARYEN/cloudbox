import { useState } from 'react';
import { Link } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiError } from '../../src/api/client';
import { colors, spacing } from '../../src/theme';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    // Client-side checks mirror the server's rules so users get instant
    // feedback instead of a round-trip 400. The server still re-validates.
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
      const msg = e instanceof ApiError ? e.message : 'Something went wrong';
      Alert.alert('Registration failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Start storing files on your own cloud.</Text>
        </View>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 8 characters"
        />
        <TextField
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="Re-enter password"
        />

        <View style={{ height: spacing(1) }} />
        <Button label="Create account" onPress={onSubmit} loading={loading} />

        <View style={styles.footer}>
          <Text style={styles.muted}>Already have an account? </Text>
          <Link href="/login" style={styles.link}>
            Sign in
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  header: { marginBottom: spacing(4) },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: spacing(0.5) },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing(3) },
  muted: { color: colors.muted },
  link: { color: colors.primary, fontWeight: '600' },
});
