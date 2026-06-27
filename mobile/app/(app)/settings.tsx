import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';

import { Screen } from '../../src/components/Screen';
import { TopBar } from '../../src/components/TopBar';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/auth/AuthContext';
import { colors, font, PAGE_PADDING, radius, spacing, typography } from '../../src/theme';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const initial = (user?.email?.trim()?.[0] ?? '?').toUpperCase();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen edges={['top']}>
      <TopBar email={user?.email} />

      <View style={styles.body}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>Signed in as</Text>
            <Text style={styles.cardEmail} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <Button label="Sign out" variant="secondary" onPress={signOut} />
        <Text style={styles.version}>CloudBox v{version}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: PAGE_PADDING, paddingTop: spacing(4), paddingBottom: spacing(6) },
  title: { ...typography.display, color: colors.text, marginBottom: spacing(5) },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(4),
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: font.bold, fontSize: 20, color: colors.primary },
  cardLabel: { fontFamily: font.medium, fontSize: 13, color: colors.textFaint },
  cardEmail: { fontFamily: font.semibold, fontSize: 16, color: colors.text, marginTop: 2 },
  version: { fontFamily: font.medium, fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: spacing(4) },
});
