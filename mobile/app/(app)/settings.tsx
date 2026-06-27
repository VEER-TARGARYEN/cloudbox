import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { Screen } from '../../src/components/Screen';
import { TopBar } from '../../src/components/TopBar';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/auth/AuthContext';
import { colors, font, PAGE_PADDING, radius, spacing, typography } from '../../src/theme';

export default function SettingsScreen() {
  const { user, serverUrl, signOut } = useAuth();
  const initial = (user?.email?.trim()?.[0] ?? '?').toUpperCase();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen edges={['top']}>
      <TopBar email={user?.email} />

      <View style={styles.body}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>Signed in as</Text>
            <Text style={styles.cardValue} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { marginTop: spacing(3) }]}>
          <View style={styles.badge}>
            <Feather name="server" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>Connected server</Text>
            <Text style={styles.cardValue} numberOfLines={1}>
              {serverUrl || 'Not set'}
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
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: font.bold, fontSize: 19, color: colors.primary },
  cardLabel: { fontFamily: font.medium, fontSize: 13, color: colors.textFaint },
  cardValue: { fontFamily: font.semibold, fontSize: 15, color: colors.text, marginTop: 2 },
  version: { fontFamily: font.medium, fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: spacing(4) },
});
