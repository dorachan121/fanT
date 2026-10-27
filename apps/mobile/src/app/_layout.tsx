import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { purgeExpiredOriginals } from '../features/album/album-db';
import { reportError, startAnalytics } from '../features/analytics/analytics';
import { useContent } from '../features/content/content-store';
import { startPurchases } from '../features/purchases/purchases-store';
import { colors } from '../ui/theme';

// Render errors show a recoverable error screen instead of crashing the app.
export { ErrorBoundary } from 'expo-router';

/** Work that runs once per launch; none of it blocks the camera from opening (S-01). */
function useStartup() {
  useEffect(() => {
    startAnalytics();
    void useContent.getState().refresh();
    void startPurchases();
    try {
      purgeExpiredOriginals();
    } catch (error) {
      reportError(error, 'album.purge');
    }
  }, []);
}

export default function RootLayout() {
  useStartup();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="credits" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
