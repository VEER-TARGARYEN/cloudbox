import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { colors, font } from '../../src/theme';

// Bottom tab navigator: Files (functional), Shared/Recent (placeholders),
// Settings (account + sign out).
export default function AppTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Files', tabBarIcon: ({ color }) => <Feather name="folder" size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="shared"
        options={{ title: 'Shared', tabBarIcon: ({ color }) => <Feather name="users" size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="recent"
        options={{ title: 'Recent', tabBarIcon: ({ color }) => <Feather name="clock" size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color }) => <Feather name="settings" size={20} color={color} /> }}
      />
    </Tabs>
  );
}
