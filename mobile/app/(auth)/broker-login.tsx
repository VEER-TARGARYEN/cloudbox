import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/auth/AuthContext';
import { broker, type BrokerDevice } from '../../src/api/client';
import { DEFAULT_BROKER_URL } from '../../src/config';
import { colors, font, PAGE_PADDING, radius, spacing, typography } from '../../src/theme';

function norm(u: string): string {
  let x = u.trim();
  if (!x) return '';
  if (!/^https?:\/\//i.test(x)) x = `https://${x}`;
  return x.replace(/\/+$/, '');
}

export default function BrokerLoginScreen() {
  const router = useRouter();
  const { connectWithBroker } = useAuth();

  const [brokerUrl, setBrokerUrl] = useState(DEFAULT_BROKER_URL);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'form' | 'devices'>('form');
  const [token, setToken] = useState('');
  const [devices, setDevices] = useState<BrokerDevice[]>([]);

  const onLogin = async () => {
    const bu = norm(brokerUrl);
    if (!bu) {
      Alert.alert('Broker needed', 'Enter the broker URL.');
      return;
    }
    if (!email || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await broker.login(bu, email.trim(), password);
      const list = await broker.devices(bu, res.token);
      setBrokerUrl(bu);
      setToken(res.token);
      setDevices(list.devices);
      setPhase('devices');
    } catch (e) {
      Alert.alert('Sign in failed', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const onPick = async (d: BrokerDevice) => {
    setLoading(true);
    try {
      await connectWithBroker(brokerUrl, token, d, email.trim());
      // success → guard redirects into the app
    } catch (e) {
      setLoading(false);
      Alert.alert('Connect failed', e instanceof Error ? e.message : 'Something went wrong');
    }
  };

  if (phase === 'devices') {
    return (
      <Screen>
        <View style={styles.body}>
          <Text style={styles.title}>Choose your laptop</Text>
          <Text style={styles.muted}>Tap the device you want to connect to.</Text>
          <View style={{ height: spacing(4) }} />
          <FlatList
            data={devices}
            keyExtractor={(d) => d.id}
            ListEmptyComponent={
              <Text style={styles.muted}>
                No laptops linked yet. Start CloudBox on your laptop, then sign in again.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item)}
                disabled={loading}
                style={({ pressed }) => [styles.device, pressed && { backgroundColor: colors.surfaceLow }]}
              >
                <View style={styles.deviceIcon}>
                  <Feather name="monitor" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {item.url ? item.url : 'offline — start CloudBox on it'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textFaint} />
              </Pressable>
            )}
          />
          <Pressable onPress={() => setPhase('form')} style={{ marginTop: spacing(2) }}>
            <Text style={styles.link}>Back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.muted}>Use your CloudBox account to find your laptop.</Text>
        <View style={{ height: spacing(6) }} />

        <TextField
          label="Broker URL"
          leftIcon="server"
          value={brokerUrl}
          onChangeText={setBrokerUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="broker.example.com"
        />
        <TextField
          label="Email"
          leftIcon="mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <TextField
          label="Password"
          leftIcon="lock"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="••••••••"
        />

        <View style={{ height: spacing(2) }} />
        <Button label="Sign in" onPress={onLogin} loading={loading} />

        <Pressable onPress={() => router.back()} style={styles.backWrap}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: PAGE_PADDING, paddingVertical: spacing(8) },
  body: { flex: 1, paddingHorizontal: PAGE_PADDING, paddingTop: spacing(6) },
  title: { ...typography.title, color: colors.text },
  muted: { ...typography.body, color: colors.textMuted, marginTop: spacing(1) },
  link: { fontFamily: font.semibold, fontSize: 15, color: colors.primary },
  backWrap: { alignItems: 'center', marginTop: spacing(4) },

  device: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    marginBottom: spacing(2),
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceName: { fontFamily: font.semibold, fontSize: 16, color: colors.text },
});
