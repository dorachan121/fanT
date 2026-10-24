import { Stack } from 'expo-router';

// Render errors show a recoverable error screen instead of crashing the app.
export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
