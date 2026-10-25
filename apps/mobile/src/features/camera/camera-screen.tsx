import { DEFAULT_FILM_PARAMS } from '@fant/filters';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TargetCameraPosition } from 'react-native-vision-camera';
import { SkiaCamera } from 'react-native-vision-camera-skia';

import { CameraPermissionGate } from './camera-permission-gate';
import { useCameraActive } from './use-camera-active';
import { useFilmFrameRenderer } from './use-film-frame-renderer';

type LensPosition = Extract<TargetCameraPosition, 'front' | 'back'>;

export function CameraScreen() {
  return (
    <CameraPermissionGate>
      <FilmCamera />
    </CameraPermissionGate>
  );
}

function FilmCamera() {
  const isActive = useCameraActive();
  const { bottom } = useSafeAreaInsets();
  const [position, setPosition] = useState<LensPosition>('front');
  // Fixed per session so grain stays stable; capture will record it with the photo.
  const [seed] = useState(Math.random);
  const onFrame = useFilmFrameRenderer(DEFAULT_FILM_PARAMS, seed);

  const toggleLens = () => {
    setPosition((current) => (current === 'front' ? 'back' : 'front'));
  };

  return (
    <View style={styles.container}>
      <SkiaCamera style={styles.preview} device={position} isActive={isActive} onFrame={onFrame} />
      <View style={[styles.controls, { paddingBottom: bottom + 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="前後のカメラを切り替える"
          style={styles.iconButton}
          onPress={toggleLens}
        >
          <Text style={styles.iconLabel}>⇄</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  preview: { flex: 1 },
  controls: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'flex-end',
    paddingHorizontal: 24,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  iconLabel: { color: '#fff', fontSize: 22 },
});
