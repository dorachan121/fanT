import { DEFAULT_FILM_PARAMS } from '@fant/filters';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TargetCameraPosition } from 'react-native-vision-camera';
import { SkiaCamera } from 'react-native-vision-camera-skia';

import { CameraPermissionGate } from './camera-permission-gate';
import { PhotoLibraryPermissionError } from './capture/save-to-photo-library';
import { useFilmCapture } from './capture/use-film-capture';
import { ShutterButton } from './shutter-button';
import { useCameraActive } from './use-camera-active';
import { useFilmEffect } from './use-film-effect';
import { useFilmFrameRenderer } from './use-film-frame-renderer';

type LensPosition = Extract<TargetCameraPosition, 'front' | 'back'>;

const newSeed = () => Math.random();

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
  // Shared by the preview and the next capture so the photo matches what was shown.
  const [seed, setSeed] = useState(newSeed);

  const effect = useFilmEffect();
  const onFrame = useFilmFrameRenderer(effect, DEFAULT_FILM_PARAMS, seed);
  const { photoOutput, status, capture } = useFilmCapture(effect, DEFAULT_FILM_PARAMS, seed);
  // A stable array keeps the camera session from being reconfigured on every render.
  const outputs = useMemo(() => [photoOutput], [photoOutput]);

  const toggleLens = () => {
    setPosition((current) => (current === 'front' ? 'back' : 'front'));
  };

  const handleShutter = () => {
    // SkiaCamera mirrors the front-camera preview.
    capture({ previewMirrored: position === 'front' })
      .then(() => {
        setSeed(newSeed());
      })
      .catch((error: unknown) => {
        console.error('Capture failed', error);
        Alert.alert('保存できませんでした', describeCaptureError(error));
      });
  };

  return (
    <View style={styles.container}>
      <SkiaCamera
        style={styles.preview}
        device={position}
        isActive={isActive}
        outputs={outputs}
        onFrame={onFrame}
      />
      {status === 'saved' && (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          保存しました
        </Text>
      )}
      <View style={[styles.controls, { paddingBottom: bottom + 16 }]}>
        <View style={styles.side} />
        <ShutterButton disabled={status === 'capturing'} onPress={handleShutter} />
        <View style={styles.side}>
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
    </View>
  );
}

function describeCaptureError(error: unknown): string {
  if (error instanceof PhotoLibraryPermissionError) {
    return '写真への保存が許可されていません。設定アプリから許可してください。';
  }
  return 'もう一度お試しください。';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  preview: { flex: 1 },
  notice: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    color: '#fff',
    fontSize: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  controls: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  side: { width: 48, alignItems: 'center' },
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
