import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Screen } from '../../src/components/Screen';
import { TopBar } from '../../src/components/TopBar';
import { useAuth } from '../../src/auth/AuthContext';
import { colors, spacing, typography } from '../../src/theme';

export default function RecentScreen() {
  const { user } = useAuth();
  return (
    <Screen edges={['top']}>
      <TopBar email={user?.email} />
      <View style={styles.center}>
        <View style={styles.icon}>
          <Feather name="clock" size={26} color={colors.primary} />
        </View>
        <Text style={styles.title}>Recent</Text>
        <Text style={styles.text}>Your recent activity will appear here soon.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(8) },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(4),
  },
  title: { ...typography.headline, color: colors.text },
  text: { ...typography.body, color: colors.textMuted, marginTop: spacing(1), textAlign: 'center' },
});
