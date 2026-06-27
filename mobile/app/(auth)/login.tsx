import { useState } from 'react';
import { Link } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { BrandMark } from '../../src/components/Logo';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiError } from '../../src/api/client';
import { colors, font, PAGE_PADDING, spacing, typography } from '../../src/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // Success: the root guard redirects to the Files tab automatically.
    } catch (e) {
      Alert.alert('Login failed', e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <BrandMark />
          <Text style={styles.title}>CloudBox</Text>
          <Text style={styles.subtitle}>Your files. Your laptop. Anywhere.</Text>
        </View>

        <TextField
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextField
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoCapitalize="none"
          rightSlot={
            <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
              <Feather name={show ? 'eye-off' : 'eye'} size={20} color={colors.textFaint} />
            </Pressable>
          }
        />

        <View style={{ height: spacing(2) }} />
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
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: PAGE_PADDING },
  hero: { alignItems: 'center', marginBottom: spacing(9) },
  title: { ...typography.title, color: colors.text, marginTop: spacing(4) },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing(2) },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing(6) },
  muted: { ...typography.body, color: colors.textMuted },
  link: { fontFamily: font.semibold, fontSize: 16, color: colors.primary },
});
