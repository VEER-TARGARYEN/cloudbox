import { Stack } from 'expo-router';

// Groups the authenticated screens. Today it holds just the dashboard
// (index.tsx -> "/"); Phase 5 adds file detail/upload screens alongside it.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
