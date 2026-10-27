import { calendarDateOf, formatDateStamp } from '@fant/filters';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { composeSheet, renderCell, type SheetCell } from '../../engine/compose-sheet';
import { decodeImage, encodeJpeg } from '../../engine/photo';
import type { SkImage } from '../../engine/skia';
import { strings } from '../../i18n';
import { Button } from '../../ui/button';
import { showError } from '../../ui/dialogs';
import { IconButton } from '../../ui/icon-button';
import { ScreenHeader } from '../../ui/screen-header';
import { Bouncy } from '../../ui/bouncy';
import { colors, radius, spacing } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { addPhoto } from '../album/album-db';
import { useContent } from '../content/content-store';
import { stampMap } from '../content/lookup';
import { DecoEditor } from '../deco/deco-editor';
import { saveToLibrary } from '../photo/export';
import { newPhotoId } from '../photo/photo-service';
import { isLocked, usePremium } from '../purchases/purchases-store';
import { useSettings } from '../settings/settings-store';
import { usePuriSession, type PuriShot } from './puri-session';

/** Decodes the shots for drawing; freed when they change or the screen closes. */
function useShotImages(shots: readonly (PuriShot | null)[]): (SkImage | null)[] {
  const uris = shots.map((shot) => shot?.uri ?? null).join('|');
  const [images, setImages] = useState<{ key: string; images: (SkImage | null)[] }>({
    key: '',
    images: [],
  });
  useEffect(() => {
    const decoded = uris
      .split('|')
      .map((uri) => (uri === '' ? null : decodeImage(new File(uri).bytesSync())));
    void Promise.resolve().then(() => {
      setImages({ key: uris, images: decoded });
    });
    return () => {
      for (const image of decoded) image?.dispose();
    };
  }, [uris]);
  return images.key === uris ? images.images : [];
}

/**
 * Scribbles per shot (S-33, PRI-05), retakes, and the finished sheet (S-34,
 * PRI-06): saved to the album as one photo, or one shot at a time.
 */
export function FinishScreen() {
  const { layoutId, shots, setDeco } = usePuriSession();
  const manifest = useContent((state) => state.manifest);
  const layout = manifest.layouts.find(({ id }) => id === layoutId);
  const premium = usePremium();
  const { bottom } = useSafeAreaInsets();
  const images = useShotImages(shots);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const assets = useMemo(() => ({ stamps: stampMap(manifest), images: {} }), [manifest]);

  if (layout === undefined) return null;
  const shot = shots[selected];
  const image = images[selected] ?? null;
  const cells = (): SheetCell[] =>
    shots.flatMap((current, index) => {
      const cellImage = images[index];
      return current === null || cellImage === undefined || cellImage === null
        ? []
        : [{ image: cellImage, deco: current.deco }];
    });

  const finish = () => {
    if (isLocked(layout, premium)) {
      router.push({ pathname: '/paywall', params: { trigger: 'layout' } });
      return;
    }
    setBusy(true);
    try {
      const sheet = composeSheet(
        layout,
        cells(),
        assets,
        formatDateStamp(calendarDateOf(new Date()), 'yyyy.mm.dd'),
      );
      try {
        const photo = addPhoto({
          id: newPhotoId(),
          kind: 'puri',
          output: encodeJpeg(sheet),
          width: sheet.width(),
          height: sheet.height(),
          hasOriginal: false,
          recipe: null,
          originalRetentionDays: useSettings.getState().originalRetentionDays,
        });
        usePuriSession.getState().reset();
        router.dismissAll();
        router.push({ pathname: '/photo/[id]', params: { id: photo.id } });
      } finally {
        sheet.dispose();
      }
    } catch (error) {
      reportError(error, 'puri.finish');
      showError();
    } finally {
      setBusy(false);
    }
  };

  const saveCell = async () => {
    if (shot === null || shot === undefined || image === null) return;
    setBusy(true);
    try {
      const rendered = renderCell({ image, deco: shot.deco }, assets);
      try {
        const file = new File(shot.uri.replace(/\.jpg$/, '-deco.jpg'));
        file.writeSync(encodeJpeg(rendered));
        await saveToLibrary(file, 'full');
        file.delete();
      } finally {
        rendered.dispose();
      }
    } catch (error) {
      reportError(error, 'puri.saveCell');
      showError();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottom }]}>
      <ScreenHeader
        title={strings.puri.deco}
        actions={
          <>
            <IconButton
              icon="camera-outline"
              label={strings.puri.retakeShot}
              onPress={() => {
                router.push({ pathname: '/puri/shoot', params: { retake: String(selected) } });
              }}
            />
            <IconButton
              icon="download-outline"
              label={strings.puri.saveCell}
              disabled={busy}
              onPress={() => void saveCell()}
            />
          </>
        }
      />
      <ScrollView horizontal style={styles.thumbs} contentContainerStyle={styles.thumbsContent}>
        {shots.map((current, index) => (
          <Bouncy
            key={String(index)}
            accessibilityRole="button"
            accessibilityLabel={strings.puri.shotOf(index + 1, shots.length)}
            accessibilityState={{ selected: index === selected }}
            onPress={() => {
              setSelected(index);
            }}
          >
            {current === null ? (
              <View style={[styles.thumb, styles.missing]} />
            ) : (
              <Image
                source={{ uri: current.uri }}
                style={[styles.thumb, index === selected && styles.selected]}
              />
            )}
          </Bouncy>
        ))}
      </ScrollView>
      {shot !== null && shot !== undefined && image !== null ? (
        <DecoEditor
          image={image}
          photoSize={{ width: image.width(), height: image.height() }}
          layers={shot.deco}
          premium={premium}
          onChange={(deco) => {
            setDeco(selected, deco);
          }}
        />
      ) : (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      )}
      <View style={styles.footer}>
        <Button
          label={strings.puri.finish}
          busy={busy}
          disabled={shots.some((current) => current === null)}
          onPress={finish}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  thumbs: { flexGrow: 0 },
  thumbsContent: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  thumb: {
    width: 48,
    height: 64,
    borderRadius: radius.sm,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  selected: { borderColor: colors.accent },
  missing: { backgroundColor: colors.surfaceRaised },
  loading: { flex: 1 },
  footer: {
    padding: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});
