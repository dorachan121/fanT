import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  type LayoutRectangle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoCanvas } from '../../engine/photo-canvas';
import { strings } from '../../i18n';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { showError } from '../../ui/dialogs';
import { IconButton } from '../../ui/icon-button';
import { ScreenHeader } from '../../ui/screen-header';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { useContent } from '../content/content-store';
import { findFilm } from '../content/lookup';
import { saveEdit } from '../photo/photo-service';
import type { PhotoRecipe } from '../photo/recipe';
import { isLocked, usePremium } from '../purchases/purchases-store';
import { EDIT_TABS, EditTabPanel, type EditTab } from './edit-tabs';
import { PhotoTapLayer } from './photo-tap-layer';
import type { PhotoTool } from './tools/photo-tool';
import { useFocusTool } from './tools/use-focus-tool';
import { useLightTool } from './tools/use-light-tool';
import { useLocalTool } from './tools/use-local-tool';
import { useRetouchTool } from './tools/use-retouch-tool';
import { usePhotoSession } from './use-photo-session';

type Session = ReturnType<typeof usePhotoSession>;
type Loaded = Session & {
  readonly recipe: PhotoRecipe;
  readonly source: NonNullable<Session['source']>;
  readonly outputSize: NonNullable<Session['outputSize']>;
};

function isLoaded(session: Session): session is Loaded {
  return session.recipe !== null && session.source !== null && session.outputSize !== null;
}

/** Re-edits a photo from its original (S-21): every tool works on the recipe, undoably. */
export function EditScreen({ id }: { readonly id: string }) {
  const session = usePhotoSession(id);
  if (!isLoaded(session)) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={strings.edit.title} />
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      </View>
    );
  }
  return <Editor id={id} session={session} />;
}

function Editor({ id, session }: { readonly id: string; readonly session: Loaded }) {
  const { recipe, source, outputSize } = session;
  const { bottom } = useSafeAreaInsets();
  const premium = usePremium();
  const manifest = useContent((state) => state.manifest);
  const [tab, setTab] = useState<EditTab>('film');
  const [saving, setSaving] = useState(false);
  const [photoRect, setPhotoRect] = useState<LayoutRectangle | null>(null);
  const [comparing, setComparing] = useState(false);
  const { setView } = session;
  // Hold to compare with the photo before editing (EDT-28); crop over the whole photo (EDT-29).
  useEffect(() => {
    setView({ before: comparing, uncropped: tab === 'crop' });
  }, [setView, comparing, tab]);

  const update = (next: Partial<PhotoRecipe>, key?: string) => {
    session.change({ ...recipe, ...next }, key);
  };
  const local = useLocalTool({ recipe, update });
  const retouch = useRetouchTool({ recipe, update });
  const focus = useFocusTool({ recipe, update });
  const light = useLightTool({ recipe, update });
  /** The tabs whose tool places things where the photo is tapped. */
  const tools: Partial<Record<EditTab, PhotoTool>> = {
    local: local.tool,
    retouch: retouch.tool,
    blur: focus,
    light,
  };
  const tool = tools[tab];

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
              icon="eye-outline"
              label={strings.edit.compare}
              active={comparing}
              onPress={() => undefined}
              onPressIn={() => {
                setComparing(true);
              }}
              onPressOut={() => {
                setComparing(false);
              }}
            />
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
      <PhotoCanvas
        image={session.preview}
        photoSize={session.previewSize ?? outputSize}
        onPhotoRect={setPhotoRect}
      >
        <PhotoTapLayer rect={photoRect} markers={tool?.markers ?? []} onTap={tool?.onTap ?? null} />
      </PhotoCanvas>
      <View style={[styles.panel, { paddingBottom: bottom + spacing.md }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          contentContainerStyle={styles.tabs}
        >
          {EDIT_TABS.map((candidate) => (
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
          <EditTabPanel
            tab={tab}
            context={{
              recipe,
              update,
              preview: session.preview,
              original: { image: source.image, size: source.originalSize },
              takenAt: session.photo?.createdAt ?? null,
              local,
              retouch,
            }}
          />
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
