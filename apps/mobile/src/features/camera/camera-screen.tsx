import { BEAUTY_LEVELS } from '@fant/filters';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listenToVolumeShutter } from '../../../modules/volume-shutter/src';
import { APP_CONFIG } from '../../config';
import { CameraView, type CameraViewHandle, type LensCapabilities } from '../../engine/camera-view';
import { useFaceTracking } from '../../engine/face-tracking';
import { localized, strings } from '../../i18n';
import { IconButton } from '../../ui/icon-button';
import { haptics } from '../../ui/haptics';
import { Notice, useNotice } from '../../ui/notice';
import { Slider } from '../../ui/slider';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { track } from '../analytics/analytics';
import { useContent } from '../content/content-store';
import { available } from '../content/lookup';
import { PerformanceOverlay } from '../performance/performance-overlay';
import { ASPECT_VALUES, containRect } from '../photo/geometry';
import { isLocked, usePremium } from '../purchases/purchases-store';
import { useSettings } from '../settings/settings-store';
import { AlbumThumbnail } from './album-thumbnail';
import { BeautySheet } from './beauty-sheet';
import { CameraPermissionGate } from './camera-permission-gate';
import { shapesFaces } from '../character/face-geometry.worklet';
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
import { usePreviewRenderer } from './use-preview-renderer';
import { useCameraGestures } from './use-camera-gestures';
import { useShutter } from './use-shutter';
import { useWinkActions } from './use-wink-actions';
import { Text } from '../../ui/text';

type SheetName = 'film' | 'beauty' | 'character' | null;

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
  const premium = usePremium();
  const manifest = useContent((state) => state.manifest);
  const mode = useCameraSettings((state) => state.mode);
  const lens = useCameraSettings((state) => state.lens);
  const aspect = useCameraSettings((state) => state.aspect);
  const grid = useCameraSettings((state) => state.grid);
  const beauty = useCameraSettings((state) => state.beauty);
  const faceShape = useCameraSettings((state) => state.faceShape);
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

  // The volume buttons also take a photo while the camera is on screen (CAM-03).
  const shootRef = useRef(shoot);
  useEffect(() => {
    shootRef.current = shoot;
  });
  useEffect(() => {
    if (!isActive) return;
    return listenToVolumeShutter(() => {
      shootRef.current();
    });
  }, [isActive]);

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
    haptics.select();
  });

  const tracking = useFaceTracking({
    onEyes: analysisEnabled ? onEyes : null,
    // Characters and face fine-tuning both follow the faces.
    trackFaces: analysisEnabled && (mode === 'character' || shapesFaces(faceShape)),
  });
  const preview = usePreviewRenderer({ look, seed, tracking, showCharacter: mode === 'character' });

  const box = containRect(
    { width: ASPECT_VALUES[aspect], height: 1 },
    previewArea.width > 0 ? previewArea : { width: 1, height: 1 },
  );

  const { gestures, focus, keepFocus } = useCameraGestures({
    camera,
    zoom,
    capabilities,
    tapToShoot,
    onShoot: shoot,
  });

  const toggleLens = () => {
    zoom.set(1);
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
              onFrame={preview.onFrame}
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
                  keepFocus();
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

      {locked && <Text style={styles.trial}>{strings.camera.premiumTrial}</Text>}
      {shutter.status === 'capturing' && !shutter.screenFlash && (
        <View style={styles.saving} pointerEvents="none">
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.savingText}>{strings.camera.saving}</Text>
        </View>
      )}
      {shutter.screenFlash && <ScreenFlash />}
      <Notice notice={notice} />
      {showPerformance && (
        <PerformanceOverlay
          stats={preview.stats}
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
  previewArea: { flex: 1, marginHorizontal: spacing.sm },
  // The preview sits like a rounded print on the cream background.
  previewBox: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.text,
  },
  exposure: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.overlay,
  },
  controls: {
    gap: spacing.md,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  // Premium content can be tried in the preview (PAY-07); saving asks for premium.
  trial: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
    color: colors.accentText,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: colors.premium,
  },
  saving: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  savingText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
});
