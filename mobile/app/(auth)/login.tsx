import { useState } from 'react';
import { Link } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiError } from '../../src/api/client';
import { colors, spacing } from '../../src/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // Success: the root guard sees `user` is set and redirects to the
      // dashboard automatically — no navigation code needed here.
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong';
      Alert.alert('Login failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.header}>
          <Text style={styles.logo}>CloudBox</Text>
          <Text style={styles.subtitle}>Your files. Your laptop. Anywhere.</Text>
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
          placeholder="••••••••"
        />

        <View style={{ height: spacing(1) }} />
        <Button label="Sign in" onPress={onSubmit} loading={loading} />

        <View style={styles.footer}>
          <Text style={styles.muted}>New here? </Text>
          <Link href="/register" style={styles.link}>
            Create an account
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  header: { marginBottom: spacing(4) },
  logo: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: spacing(0.5) },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing(3) },
  muted: { color: colors.muted },
  link: { color: colors.primary, fontWeight: '600' },
});
