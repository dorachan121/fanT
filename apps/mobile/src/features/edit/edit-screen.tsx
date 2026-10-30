import type { LocalShape } from '@fant/filters';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  type LayoutRectangle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoCanvas } from '../../engine/photo-canvas';
import { samplePixels } from '../../engine/sample-pixels';
import { strings } from '../../i18n';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { showError, showMessage } from '../../ui/dialogs';
import { IconButton } from '../../ui/icon-button';
import { ScreenHeader } from '../../ui/screen-header';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { BeautyControls, FaceShapeControls } from '../camera/beauty-sheet';
import { useContent } from '../content/content-store';
import { findFilm } from '../content/lookup';
import { MakeupControls } from '../makeup/makeup-controls';
import { addHealSpot } from '../retouch/retouch';
import { saveEdit } from '../photo/photo-service';
import type { PhotoRecipe } from '../photo/recipe';
import { isLocked, usePremium } from '../purchases/purchases-store';
import { autoAdjust, statsOf } from './auto-adjust';
import { FramePicker } from './frame-picker';
import { AdjustPanel } from './panels/adjust-panel';
import { BackgroundPanel } from './panels/background-panel';
import { CropPanel } from './panels/crop-panel';
import { FilmPanel } from './panels/film-panel';
import { HslPanel } from './panels/hsl-panel';
import { addLocalArea, LocalPanel } from './panels/local-panel';
import type { PanelProps, PhotoPoint } from './panels/panel-props';
import { RetouchPanel, type RetouchTool } from './panels/retouch-panel';
import { SceneryPanel } from './panels/scenery-panel';
import { TonePanel } from './panels/tone-panel';
import { PhotoTapLayer, type PhotoMarker } from './photo-tap-layer';
import { usePhotoSession } from './use-photo-session';

const TABS = [
  'film',
  'beauty',
  'makeup',
  'retouch',
  'background',
  'adjust',
  'scenery',
  'tone',
  'hsl',
  'local',
  'crop',
  'frame',
] as const;
type Tab = (typeof TABS)[number];

/** Re-edits a photo from its original (S-21): every tool works on the recipe, undoably. */
export function EditScreen({ id }: { readonly id: string }) {
  const session = usePhotoSession(id);
  const { bottom } = useSafeAreaInsets();
  const premium = usePremium();
  const manifest = useContent((state) => state.manifest);
  const [tab, setTab] = useState<Tab>('film');
  const [saving, setSaving] = useState(false);
  const [photoRect, setPhotoRect] = useState<LayoutRectangle | null>(null);
  const [selectedLocal, setSelectedLocal] = useState(0);
  const [localShape, setLocalShape] = useState<LocalShape>('radial');
  const [retouchTool, setRetouchTool] = useState<RetouchTool>('heal');
  const [healSize, setHealSize] = useState(0.025);
  const { recipe, source, outputSize } = session;

  if (recipe === null || source === null || outputSize === null) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={strings.edit.title} />
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      </View>
    );
  }

  const update = (next: Partial<PhotoRecipe>, key?: string) => {
    session.change({ ...recipe, ...next }, key);
  };
  const props: PanelProps = { recipe, update };

  /** Tools that place something where the photo is tapped. */
  const tapActions: Partial<Record<Tab, (point: PhotoPoint) => void>> = {
    local: (point) => {
      const local = addLocalArea(recipe.local, point, localShape);
      if (local === null) {
        showMessage(strings.edit.local.full);
        return;
      }
      update({ local });
      setSelectedLocal(local.length - 1);
    },
    retouch: (point) => {
      if (retouchTool === 'body') {
        update({ body: { ...recipe.body, legLine: point.y, bodyX: point.x } });
        return;
      }
      const heal = addHealSpot(recipe.heal, point, healSize);
      if (heal === null) showMessage(strings.retouch.full);
      else update({ heal });
    },
  };
  /** What is shown on the photo for the tools that place things. */
  const markers = (): PhotoMarker[] => {
    if (tab === 'local') {
      return recipe.local.map((area, index) => ({
        x: area.x,
        y: area.y,
        radius: area.radius,
        selected: index === selectedLocal,
        line: area.shape === 'linear' ? area.angle : undefined,
      }));
    }
    if (tab !== 'retouch') return [];
    if (retouchTool === 'heal') return recipe.heal;
    return [{ x: recipe.body.bodyX, y: recipe.body.legLine, radius: 0.03, selected: true }];
  };

  const panels: Record<Tab, () => ReactNode> = {
    film: () => <FilmPanel {...props} takenAt={session.photo?.createdAt ?? null} />,
    beauty: () => (
      <>
        <BeautyControls
          beauty={recipe.beauty}
          onChange={(beauty) => {
            update({ beauty }, 'beauty');
          }}
        />
        <FaceShapeControls
          faceShape={recipe.faceShape}
          onChange={(faceShape) => {
            update({ faceShape }, 'faceShape');
          }}
        />
      </>
    ),
    makeup: () => (
      <MakeupControls
        makeup={recipe.makeup}
        onChange={(makeup) => {
          update({ makeup }, 'makeup');
        }}
      />
    ),
    retouch: () => (
      <RetouchPanel
        {...props}
        tool={retouchTool}
        onTool={setRetouchTool}
        healSize={healSize}
        onHealSize={setHealSize}
      />
    ),
    background: () => <BackgroundPanel {...props} />,
    adjust: () => (
      <AdjustPanel
        {...props}
        onAuto={() => {
          try {
            const auto = autoAdjust(statsOf(samplePixels(source.image)));
            update({
              adjust: { ...recipe.adjust, ...auto.adjust },
              detail: { ...recipe.detail, ...auto.detail },
            });
          } catch (error) {
            reportError(error, 'edit.auto');
            showError();
          }
        }}
      />
    ),
    scenery: () => <SceneryPanel {...props} />,
    tone: () => <TonePanel {...props} />,
    hsl: () => <HslPanel {...props} />,
    local: () => (
      <LocalPanel
        {...props}
        selected={selectedLocal}
        onSelect={setSelectedLocal}
        shape={localShape}
        onShape={setLocalShape}
      />
    ),
    crop: () => <CropPanel {...props} originalSize={source.originalSize} />,
    frame: () => (
      <FramePicker
        frame={recipe.frame}
        onChange={(frame) => {
          update({ frame });
        }}
      />
    ),
  };

  const save = async () => {
    if (isLocked(findFilm(manifest, recipe.film.id), premium)) {
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
      <PhotoCanvas image={session.preview} photoSize={outputSize} onPhotoRect={setPhotoRect}>
        <PhotoTapLayer rect={photoRect} markers={markers()} onTap={tapActions[tab] ?? null} />
      </PhotoCanvas>
      <View style={[styles.panel, { paddingBottom: bottom + spacing.md }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          contentContainerStyle={styles.tabs}
        >
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
        </ScrollView>
        <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
          {panels[tab]()}
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
  tabs: { gap: spacing.sm },
  controls: { maxHeight: 240 },
  controlsContent: { gap: spacing.md },
});
