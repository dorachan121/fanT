import { BEAUTY_LEVELS } from '@fant/filters';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraView, type CameraViewHandle, type LensCapabilities } from '../../engine/camera-view';
import { useFaceTracking } from '../../engine/face-tracking';
import { filterEffects } from '../../engine/filter-effects';
import { useFrameRenderer } from '../../engine/frame-renderer';
import { localized, strings } from '../../i18n';
import { IconButton } from '../../ui/icon-button';
import { Notice, useNotice } from '../../ui/notice';
import { Slider } from '../../ui/slider';
import { colors, spacing } from '../../ui/theme';
import { track } from '../analytics/analytics';
import { useContent } from '../content/content-store';
import { available } from '../content/lookup';
import { PerformanceOverlay } from '../performance/performance-overlay';
import { useFrameStats } from '../performance/use-frame-stats';
import { ASPECT_VALUES, containRect } from '../photo/geometry';
import { isLocked, usePremium } from '../purchases/purchases-store';
import { useSettings } from '../settings/settings-store';
import { AlbumThumbnail } from './album-thumbnail';
import { BeautySheet } from './beauty-sheet';
import { CameraPermissionGate } from './camera-permission-gate';
import { useCameraSettings } from './camera-store';
import { CharacterSheet, CharacterStrip } from './character-strip';
import { FilmSheet } from './film-sheet';
import { FilmStrip, orderFilms } from './film-strip';
import { ModeTabs } from './mode-tabs';
import { nextBeautyLevel, nextItem } from './presets';
import { Countdown, FocusRing, GridOverlay, ScreenFlash } from './preview-overlays';
import { ShutterButton } from './shutter-button';
import { TopBar } from './top-bar';
import { useCameraActive } from './use-camera-active';
import { useCameraLook } from './use-camera-look';
import { useShutter } from './use-shutter';
import { useWinkActions } from './use-wink-actions';
import { APP_CONFIG } from '../../config';

type SheetName = 'film' | 'beauty' | 'character' | null;

const newSeed = () => Math.random();
/** How long the focus ring and exposure slider stay after a tap. */
const FOCUS_UI_MS = 3000;

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
  const premium = usePremium();
  const manifest = useContent((state) => state.manifest);
  const mode = useCameraSettings((state) => state.mode);
  const lens = useCameraSettings((state) => state.lens);
  const aspect = useCameraSettings((state) => state.aspect);
  const grid = useCameraSettings((state) => state.grid);
  const beauty = useCameraSettings((state) => state.beauty);
  const favorites = useCameraSettings((state) => state.favoriteFilms);
  const characterId = useCameraSettings((state) => state.characterId);
  const tapToShoot = useSettings((state) => state.tapToShoot);
  const showPerformance = useSettings(
    (state) => APP_CONFIG.isInternalBuild && state.performanceOverlay,
  );

  // Shared by the preview and the next photo, so the photo matches what was shown.
  const [seed, setSeed] = useState(newSeed);
  const look = useCameraLook(seed);
  const [notice, showNotice] = useNotice();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [previewArea, setPreviewArea] = useState({ width: 0, height: 0 });
  const [capabilities, setCapabilities] = useState<LensCapabilities | null>(null);
  const [exposure, setExposure] = useState(0);
  const [focus, setFocus] = useState<{ x: number; y: number; at: number } | null>(null);
  const [analysisEnabled, setAnalysisEnabled] = useState(true);
  const zoom = useSharedValue(1);
  const camera = useRef<CameraViewHandle>(null);

  const films = useMemo(() => available(manifest.films), [manifest]);
  const characters = useMemo(() => available(manifest.characters), [manifest]);
  const shutter = useShutter({
    camera,
    look,
    seed,
    lens,
    onShot: () => {
      setSeed(newSeed());
    },
  });

  const locked =
    isLocked(look.film, premium) ||
    (mode === 'character' &&
      look.character !== null &&
      isLocked(look.character.character, premium));

  const shoot = () => {
    if (locked) {
      // Premium content can be tried in the preview; saving asks for premium (PAY-04/07).
      router.push({ pathname: '/paywall', params: { trigger: 'shutter' } });
      return;
    }
    void shutter.shoot();
  };

  const selectFilm = useCallback(
    (filmId: string) => {
      const film = films.find(({ id }) => id === filmId);
      if (film === undefined) return;
      useCameraSettings.getState().selectFilm(film.id, film.dateStampByDefault);
      track({ name: 'film_selected', filmId: film.id });
      showNotice(strings.camera.filmChanged(localized(film.name)));
    },
    [films, showNotice],
  );

  // Winks (GST-01/02): ignored while the shutter is busy.
  const onEyes = useWinkActions((action) => {
    if (shutter.status !== 'idle') return;
    if (action === 'nextFilm') {
      selectFilm(
        nextItem(
          orderFilms(films, favorites).map(({ id }) => id),
          look.film.id,
        ),
      );
    } else if (action === 'nextBeauty') {
      const level = nextBeautyLevel(beauty);
      useCameraSettings.getState().setBeauty(BEAUTY_LEVELS[level]);
      showNotice(strings.camera.beautyChanged(strings.beauty.levels[level]));
    } else {
      shoot();
    }
    void Haptics.selectionAsync();
  });

  const tracking = useFaceTracking({
    onEyes: analysisEnabled ? onEyes : null,
    trackFaces: analysisEnabled && mode === 'character',
  });
  const frameStats = useFrameStats();
  const inputs = useMemo(
    () => ({ effects: filterEffects(), settings: look.settings, seed, lut: look.lut }),
    [look.settings, seed, look.lut],
  );
  const onFrame = useFrameRenderer({
    inputs,
    character: mode === 'character' ? look.characterDrawing : null,
    faces: tracking.faces,
    analyze: tracking.analyze,
    recordStats: showPerformance ? frameStats.record : null,
  });

  const box = containRect(
    { width: ASPECT_VALUES[aspect], height: 1 },
    previewArea.width > 0 ? previewArea : { width: 1, height: 1 },
  );

  const tap = useTapGesture({
    runOnJS: true,
    onActivate: (event) => {
      if (tapToShoot) {
        shoot();
        return;
      }
      setFocus({ x: event.x, y: event.y, at: Date.now() });
      void camera.current?.focus({ x: event.x, y: event.y });
      setTimeout(() => {
        setFocus((current) =>
          current !== null && Date.now() - current.at >= FOCUS_UI_MS ? null : current,
        );
      }, FOCUS_UI_MS);
    },
  });
  const zoomAtStart = useSharedValue(1);
  const minZoom = capabilities?.minZoom ?? 1;
  const maxZoom = Math.min(capabilities?.maxZoom ?? 1, 10);
  // Pinch to zoom (CAM-09), on the UI thread.
  const pinch = usePinchGesture({
    onBegin: () => {
      'worklet';
      zoomAtStart.value = zoom.value;
    },
    onUpdate: (event) => {
      'worklet';
      zoom.value = Math.min(maxZoom, Math.max(minZoom, zoomAtStart.value * event.scale));
    },
  });
  const gestures = useSimultaneousGestures(tap, pinch);

  const toggleLens = () => {
    zoom.value = 1;
    setExposure(0);
    useCameraSettings.getState().update({ lens: lens === 'front' ? 'back' : 'front' });
  };

  return (
    <View style={styles.container}>
      <TopBar />
      <View
        style={styles.previewArea}
        onLayout={(event) => {
          setPreviewArea({
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          });
        }}
      >
        <GestureDetector gesture={gestures}>
          <View
            style={[
              styles.previewBox,
              { width: box.width, height: box.height, left: box.x, top: box.y },
            ]}
          >
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              lens={lens}
              isActive={isActive}
              zoom={zoom}
              exposure={exposure}
              onFrame={onFrame}
              onCapabilities={setCapabilities}
            />
            {grid && <GridOverlay />}
            {focus !== null && <FocusRing point={focus} />}
            {shutter.countdown !== null && <Countdown seconds={shutter.countdown} />}
          </View>
        </GestureDetector>
        {focus !== null &&
          capabilities !== null &&
          capabilities.maxExposure > capabilities.minExposure && (
            <View style={styles.exposure}>
              <Slider
                label={strings.camera.exposure}
                value={exposure}
                min={Math.max(capabilities.minExposure, -2)}
                max={Math.min(capabilities.maxExposure, 2)}
                centered
                formatValue={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`}
                onChange={(value) => {
                  setExposure(value);
                  setFocus((current) => (current === null ? null : { ...current, at: Date.now() }));
                }}
              />
            </View>
          )}
      </View>

      <View style={[styles.controls, { paddingBottom: bottom + spacing.sm }]}>
        {mode === 'character' ? (
          <CharacterStrip
            characters={characters}
            selectedId={characterId}
            premium={premium}
            onSelect={(character) => {
              useCameraSettings.getState().update({ characterId: character.id });
            }}
            onOpenSettings={() => {
              setSheet('character');
            }}
          />
        ) : (
          <FilmStrip
            films={films}
            selectedId={look.film.id}
            favorites={favorites}
            premium={premium}
            onSelect={(film) => {
              selectFilm(film.id);
            }}
            onOpenSettings={() => {
              setSheet('film');
            }}
            onToggleFavorite={(film) => {
              useCameraSettings.getState().toggleFavorite(film.id);
            }}
          />
        )}
        <View style={styles.shutterRow}>
          <AlbumThumbnail />
          <IconButton
            icon="sparkles-outline"
            label={strings.camera.beauty}
            onPress={() => {
              setSheet('beauty');
            }}
          />
          <ShutterButton disabled={shutter.status !== 'idle'} onPress={shoot} />
          <IconButton
            icon="film-outline"
            label={strings.film.title}
            onPress={() => {
              setSheet(mode === 'character' ? 'character' : 'film');
            }}
          />
          <IconButton
            icon="camera-reverse-outline"
            label={strings.camera.switchLens}
            onPress={toggleLens}
          />
        </View>
        <ModeTabs />
      </View>

      {shutter.screenFlash && <ScreenFlash />}
      <Notice text={notice} />
      {showPerformance && (
        <PerformanceOverlay
          stats={frameStats.stats}
          analysisEnabled={analysisEnabled}
          onToggleAnalysis={() => {
            setAnalysisEnabled((enabled) => !enabled);
          }}
          top={spacing.xl * 2}
        />
      )}

      <FilmSheet
        film={look.film}
        premium={premium}
        visible={sheet === 'film'}
        onClose={() => {
          setSheet(null);
        }}
      />
      <BeautySheet
        beauty={beauty}
        visible={sheet === 'beauty'}
        onClose={() => {
          setSheet(null);
        }}
        onChange={(next) => {
          useCameraSettings.getState().setBeauty(next);
        }}
      />
      <CharacterSheet
        characterId={characterId}
        visible={sheet === 'character'}
        onClose={() => {
          setSheet(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  previewArea: { flex: 1 },
  previewBox: { position: 'absolute', overflow: 'hidden', backgroundColor: '#000' },
  exposure: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.sm },
  controls: { gap: spacing.sm, paddingTop: spacing.sm },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
});
