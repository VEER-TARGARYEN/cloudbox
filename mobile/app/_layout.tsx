import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { colors } from '../src/theme';

function Splash() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

// Router-level auth guard: logged-out users are forced into (auth); logged-in
// users are kept out of it and sent to the Files tab.
function RootNavigator() {
  const { user, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, initializing, segments, router]);

  if (initializing) return <Splash />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

export default function RootLayout() {
  // Load Inter (the design font) before rendering, to avoid a flash of the
  // system font. We gate on (loaded OR error) so that if the fonts ever fail
  // to load, the app still renders (falling back to the system font) instead
  // of hanging on the splash forever.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {fontsLoaded || fontError ? (
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      ) : (
        <Splash />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
