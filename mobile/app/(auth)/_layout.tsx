import { Stack } from 'expo-router';

// Groups the public auth screens (login, register) under their own stack.
// The parentheses in "(auth)" make this a ROUTE GROUP: it organizes files
// without adding a segment to the URL — so login.tsx is "/login", not
// "/(auth)/login".
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
