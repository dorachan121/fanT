import { BEAUTY_LEVELS, FILM_PRESETS, type BeautyLevel, type FilmPreset } from '@fant/filters';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Constraint, TargetCameraPosition } from 'react-native-vision-camera';
import { SkiaCamera } from 'react-native-vision-camera-skia';

import { useEyeTracking } from '../gestures/use-eye-tracking';
import { useWinkGestures } from '../gestures/use-wink-gestures';
import type { Eye } from '../gestures/wink-detector';
import { BeautyLevelButton } from './beauty-level-button';
import { CameraPermissionGate } from './camera-permission-gate';
import { PhotoLibraryPermissionError } from './capture/save-to-photo-library';
import { useCapture } from './capture/use-capture';
import { FilmPresetButton } from './film-preset-button';
import {
  BEAUTY_LEVEL_LABELS,
  FILM_PRESET_LABELS,
  NEXT_BEAUTY_LEVEL,
  NEXT_FILM_PRESET,
} from './presets';
import { ShutterButton } from './shutter-button';
import { useCameraActive } from './use-camera-active';
import { useFilterEffects } from './use-filter-effects';
import { useFrameRenderer } from './use-frame-renderer';
import { useNotice } from './use-notice';

type LensPosition = Extract<TargetCameraPosition, 'front' | 'back'>;

const newSeed = () => Math.random();

/**
 * Fixed 24fps: dark scenes keep a smooth preview instead of the camera stretching
 * exposure down to ~16fps. VisionCamera v5 only supports a fixed rate, not a range.
 */
const CAMERA_CONSTRAINTS: Constraint[] = [{ fps: 24 }];

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
  const [filmPreset, setFilmPreset] = useState<FilmPreset>('natural');
  const [beautyLevel, setBeautyLevel] = useState<BeautyLevel>('medium');
  // Shared by the preview and the next capture so the photo matches what was shown.
  const [seed, setSeed] = useState(newSeed);
  const [notice, showNotice] = useNotice();

  const effects = useFilterEffects();
  const params = useMemo(
    () => ({ beauty: BEAUTY_LEVELS[beautyLevel], film: FILM_PRESETS[filmPreset] }),
    [beautyLevel, filmPreset],
  );
  const { photoOutput, status, capture } = useCapture(effects, params, seed);

  // Right wink: next film. Left wink: next beauty strength (GST-01). The buttons do the same.
  const handleWink = (eye: Eye) => {
    if (status === 'capturing') return;
    if (eye === 'right') {
      const next = NEXT_FILM_PRESET[filmPreset];
      setFilmPreset(next);
      showNotice(`フィルム：${FILM_PRESET_LABELS[next]}`);
    } else {
      const next = NEXT_BEAUTY_LEVEL[beautyLevel];
      setBeautyLevel(next);
      showNotice(`美肌：${BEAUTY_LEVEL_LABELS[next]}`);
    }
    void Haptics.selectionAsync();
  };
  const analyzeFrame = useEyeTracking(useWinkGestures(handleWink));
  const onFrame = useFrameRenderer(effects, params, seed, analyzeFrame);
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
        showNotice('保存しました');
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
        constraints={CAMERA_CONSTRAINTS}
        // YUV frames are CPU-readable, which face detection needs (Android defaults to GPU-only).
        pixelFormat="yuv"
        outputs={outputs}
        onFrame={onFrame}
      />
      {notice !== null && (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      )}
      <View style={[styles.controls, { paddingBottom: bottom + 16 }]}>
        <FilmPresetButton preset={filmPreset} onChange={setFilmPreset} />
        <View style={styles.row}>
          <View style={styles.side}>
            <BeautyLevelButton level={beautyLevel} onChange={setBeautyLevel} />
          </View>
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
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
