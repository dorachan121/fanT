import { calendarDateOf, DATE_STAMP_ORANGE, type AdjustParamName } from '@fant/filters';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoCanvas } from '../../engine/photo-canvas';
import { localized, strings } from '../../i18n';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { showError } from '../../ui/dialogs';
import { IconButton } from '../../ui/icon-button';
import { ScreenHeader } from '../../ui/screen-header';
import { Slider } from '../../ui/slider';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { Toggle } from '../../ui/toggle';
import { reportError } from '../analytics/analytics';
import { BeautyControls } from '../camera/beauty-sheet';
import { FilmStrip } from '../camera/film-strip';
import { useCameraSettings } from '../camera/camera-store';
import { useContent } from '../content/content-store';
import { available, findFilm } from '../content/lookup';
import { ASPECT_VALUES, centerCrop, rotatedSize, turnClockwise } from '../photo/geometry';
import { saveEdit } from '../photo/photo-service';
import { ASPECT_RATIOS, FULL_CROP, type AspectRatio, type PhotoRecipe } from '../photo/recipe';
import { isLocked, usePremium } from '../purchases/purchases-store';
import { usePhotoSession } from './use-photo-session';
import { Text } from '../../ui/text';

type Tab = 'film' | 'beauty' | 'adjust' | 'crop';
const TABS: readonly Tab[] = ['film', 'beauty', 'adjust', 'crop'];
const ADJUSTMENTS: readonly AdjustParamName[] = [
  'brightness',
  'contrast',
  'saturation',
  'temperature',
];

/** Re-edits a photo from its original (S-21): film, beauty, corrections, crop and rotation. */
export function EditScreen({ id }: { readonly id: string }) {
  const session = usePhotoSession(id);
  const { bottom } = useSafeAreaInsets();
  const premium = usePremium();
  const manifest = useContent((state) => state.manifest);
  const favorites = useCameraSettings((state) => state.favoriteFilms);
  const [tab, setTab] = useState<Tab>('film');
  const [saving, setSaving] = useState(false);
  const { recipe, source, outputSize } = session;

  if (recipe === null || source === null || outputSize === null) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={strings.edit.title} />
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      </View>
    );
  }

  const film = findFilm(manifest, recipe.film.id);
  const update = (next: Partial<PhotoRecipe>, key?: string) => {
    session.change({ ...recipe, ...next }, key);
  };
  const setAspect = (aspect: AspectRatio | null) => {
    const turned = rotatedSize(source.originalSize, recipe.transform.rotation);
    update({
      transform: {
        ...recipe.transform,
        crop: aspect === null ? FULL_CROP : centerCrop(turned, ASPECT_VALUES[aspect]),
      },
    });
  };

  const save = async () => {
    if (isLocked(film, premium)) {
      router.push({ pathname: '/paywall', params: { trigger: 'edit' } });
      return;
    }
    setSaving(true);
    try {
      await saveEdit(id, source.originalUri, recipe);
      router.back();
    } catch (error) {
      reportError(error, 'edit.save');
      showError();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={strings.edit.title}
        actions={
          <>
            <IconButton
              icon="arrow-undo"
              label={strings.edit.undo}
              disabled={!session.canUndo}
              onPress={session.undo}
            />
            <IconButton
              icon="arrow-redo"
              label={strings.edit.redo}
              disabled={!session.canRedo}
              onPress={session.redo}
            />
          </>
        }
      />
      <PhotoCanvas image={session.preview} photoSize={outputSize} />
      <View style={[styles.panel, { paddingBottom: bottom + spacing.md }]}>
        <View accessibilityRole="tablist" style={styles.tabs}>
          {TABS.map((candidate) => (
            <Chip
              key={candidate}
              label={strings.edit.tabs[candidate]}
              selected={tab === candidate}
              onPress={() => {
                setTab(candidate);
              }}
            />
          ))}
        </View>
        <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
          {tab === 'film' && (
            <>
              <FilmStrip
                films={available(manifest.films)}
                selectedId={film.id}
                favorites={favorites}
                premium={premium}
                onSelect={(next) => {
                  update({
                    film: {
                      id: next.id,
                      intensity: recipe.film.intensity === 0 ? 1 : recipe.film.intensity,
                    },
                  });
                }}
                onOpenSettings={() => undefined}
                onToggleFavorite={(next) => {
                  useCameraSettings.getState().toggleFavorite(next.id);
                }}
              />
              <Slider
                label={`${localized(film.name)}・${strings.camera.strength}`}
                value={recipe.film.intensity}
                min={0}
                max={1}
                onChange={(intensity) => {
                  update({ film: { ...recipe.film, intensity } }, 'intensity');
                }}
              />
              <View style={styles.row}>
                <Text style={styles.label}>{strings.film.dateStamp}</Text>
                <Toggle
                  label={strings.film.dateStamp}
                  value={recipe.dateStamp !== null}
                  onChange={(enabled) => {
                    update({
                      dateStamp: enabled
                        ? {
                            date: calendarDateOf(new Date(session.photo?.createdAt ?? Date.now())),
                            format: 'yy mm dd',
                            color: DATE_STAMP_ORANGE,
                          }
                        : null,
                    });
                  }}
                />
              </View>
            </>
          )}
          {tab === 'beauty' && (
            <BeautyControls
              beauty={recipe.beauty}
              onChange={(beauty) => {
                update({ beauty }, 'beauty');
              }}
            />
          )}
          {tab === 'adjust' &&
            ADJUSTMENTS.map((key) => (
              <Slider
                key={key}
                label={strings.edit[key]}
                value={recipe.adjust[key]}
                min={-1}
                max={1}
                centered
                formatValue={(value) => `${value > 0 ? '+' : ''}${String(Math.round(value * 100))}`}
                onChange={(value) => {
                  update({ adjust: { ...recipe.adjust, [key]: value } }, key);
                }}
              />
            ))}
          {tab === 'crop' && (
            <>
              <View style={styles.tabs}>
                <Chip
                  label={strings.edit.original}
                  selected={recipe.transform.crop === FULL_CROP}
                  onPress={() => {
                    setAspect(null);
                  }}
                />
                {ASPECT_RATIOS.map((aspect) => (
                  <Chip
                    key={aspect}
                    label={aspect}
                    selected={false}
                    onPress={() => {
                      setAspect(aspect);
                    }}
                  />
                ))}
              </View>
              <View style={styles.tabs}>
                <IconButton
                  icon="refresh"
                  label={strings.edit.rotate}
                  onPress={() => {
                    update({
                      transform: {
                        ...recipe.transform,
                        rotation: turnClockwise(recipe.transform.rotation),
                        crop: FULL_CROP,
                      },
                    });
                  }}
                />
                <IconButton
                  icon="swap-horizontal"
                  label={strings.edit.flip}
                  onPress={() => {
                    update({
                      transform: { ...recipe.transform, mirror: !recipe.transform.mirror },
                    });
                  }}
                />
              </View>
            </>
          )}
        </ScrollView>
        <Button label={strings.common.save} busy={saving} onPress={() => void save()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1 },
  panel: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  controls: { maxHeight: 220 },
  controlsContent: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
