import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { BrandMark } from '../../src/components/Logo';
import { colors, font, PAGE_PADDING, spacing, typography } from '../../src/theme';

export default function ConnectScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <BrandMark />
          <Text style={styles.title}>CloudBox</Text>
          <Text style={styles.subtitle}>Connect to your laptop</Text>
        </View>

        <Button label="Scan QR code" onPress={() => router.push('/scan')} />
        <View style={{ height: spacing(2) }} />
        <Button
          label="Sign in with email"
          variant="secondary"
          onPress={() => router.push('/broker-login')}
        />

        <View style={styles.footer}>
          <Link href="/login" style={styles.link}>
            Connect manually (advanced)
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
  footer: { alignItems: 'center', marginTop: spacing(6) },
  link: { fontFamily: font.semibold, fontSize: 15, color: colors.primary },
});
