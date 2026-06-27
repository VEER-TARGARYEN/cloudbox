import { useState } from 'react';
import { Link } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { BrandMark } from '../../src/components/Logo';
import { useAuth } from '../../src/auth/AuthContext';
import { colors, font, PAGE_PADDING, spacing, typography } from '../../src/theme';

export default function LoginScreen() {
  const { signIn, serverUrl } = useAuth();
  const [server, setServer] = useState(serverUrl);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!server.trim()) {
      Alert.alert('Server needed', 'Enter the address of your CloudBox server.');
      return;
    }
    if (!email || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(server, email.trim(), password);
    } catch (e) {
      Alert.alert('Login failed', e instanceof Error ? e.message : 'Something went wrong');
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
        <View style={styles.hero}>
          <BrandMark />
          <Text style={styles.title}>CloudBox</Text>
          <Text style={styles.subtitle}>Your files. Your laptop. Anywhere.</Text>
        </View>

        <TextField
          placeholder="your-server.ngrok-free.app"
          leftIcon="server"
          value={server}
          onChangeText={setServer}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TextField
          placeholder="Email"
          leftIcon="mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextField
          placeholder="Password"
          leftIcon="lock"
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: PAGE_PADDING, paddingVertical: spacing(8) },
  hero: { alignItems: 'center', marginBottom: spacing(8) },
  title: { ...typography.title, color: colors.text, marginTop: spacing(4) },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing(2) },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing(6) },
  muted: { ...typography.body, color: colors.textMuted },
  link: { fontFamily: font.semibold, fontSize: 16, color: colors.primary },
});
