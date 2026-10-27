import type { ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { useCameraPermission } from '../../engine/camera-view';
import { strings } from '../../i18n';
import { Button } from '../../ui/button';
import { colors, spacing } from '../../ui/theme';

/**
 * Renders its children only once camera access is granted. Otherwise it asks for
 * access, or links to the system settings when the OS will no longer prompt (ONB-02, S-03).
 */
export function CameraPermissionGate({ children }: { readonly children: ReactNode }) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  if (hasPermission) return children;
  const { permission } = strings.camera;
  return (
    <View style={styles.container}>
      <Text style={styles.message}>
        {canRequestPermission ? permission.request : permission.denied}
      </Text>
      <Button
        label={canRequestPermission ? permission.allow : permission.openSettings}
        onPress={() => {
          void (canRequestPermission ? requestPermission() : Linking.openSettings());
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  message: { color: colors.text, fontSize: 16, textAlign: 'center', lineHeight: 24 },
});
