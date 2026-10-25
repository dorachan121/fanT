import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';

interface CameraPermissionGateProps {
  readonly children: ReactNode;
}

/**
 * Renders its children only once camera access is granted. Otherwise it asks for
 * access, or links to the system settings when the OS will no longer prompt.
 */
export function CameraPermissionGate({ children }: CameraPermissionGateProps) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();

  if (hasPermission) return children;

  const handlePress = () => {
    void (canRequestPermission ? requestPermission() : Linking.openSettings());
  };

  return (
    <View style={styles.container}>
      <Text style={styles.message}>
        {canRequestPermission
          ? '写真を撮るには、カメラへのアクセスを許可してください。'
          : 'カメラへのアクセスがオフになっています。設定アプリで「カメラ」をオンにしてください。'}
      </Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={handlePress}>
        <Text style={styles.buttonLabel}>
          {canRequestPermission ? 'カメラを許可する' : '設定を開く'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: 32,
    backgroundColor: '#000',
  },
  message: { color: '#fff', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  buttonLabel: { color: '#000', fontSize: 16, fontWeight: '600' },
});
