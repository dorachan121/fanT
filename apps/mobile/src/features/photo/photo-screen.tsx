import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_CONFIG } from '../../config';
import { strings } from '../../i18n';
import { Button } from '../../ui/button';
import { confirmDestructive } from '../../ui/dialogs';
import { IconButton } from '../../ui/icon-button';
import { Notice, useNotice } from '../../ui/notice';
import { ScreenHeader } from '../../ui/screen-header';
import { colors, spacing } from '../../ui/theme';
import { deletePhotos } from '../album/album-db';
import { useAlbumPhoto } from '../album/use-album';
import { savePhoto, sharePhotoFile } from './photo-actions';

interface PhotoScreenProps {
  readonly id: string;
  /** Opened right after shooting (S-20) rather than from the album (S-51). */
  readonly fromCamera: boolean;
}

/** One photo with what can be done to it: save, share, edit, deco, AI, delete (S-20/S-51). */
export function PhotoScreen({ id, fromCamera }: PhotoScreenProps) {
  const photo = useAlbumPhoto(id);
  const { bottom } = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [notice, showNotice] = useNotice();

  if (photo === null) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={strings.photo.title} />
      </View>
    );
  }

  const remove = async () => {
    if (!fromCamera && !(await confirmDestructive(strings.photo.deleteConfirm))) return;
    deletePhotos([photo.id]);
    router.back();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={fromCamera ? '' : new Date(photo.createdAt).toLocaleDateString('ja-JP')}
        actions={
          <IconButton
            icon="trash-outline"
            label={fromCamera ? strings.photo.retake : strings.common.delete}
            onPress={() => {
              void remove();
            }}
          />
        }
      />
      <View style={styles.imageArea}>
        <Image
          source={{ uri: photo.outputUri, cacheKey: `${photo.id}-${String(photo.updatedAt)}` }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          accessibilityLabel={strings.photo.title}
        />
        {photo.kind === 'ai' && <Text style={styles.aiLabel}>{strings.ai.aiLabel}</Text>}
      </View>
      <View style={[styles.actions, { paddingBottom: bottom + spacing.md }]}>
        <View style={styles.row}>
          <IconButton
            icon="color-wand-outline"
            label={strings.photo.edit}
            disabled={photo.kind !== 'camera' && photo.kind !== 'import'}
            onPress={() => {
              router.push({ pathname: '/edit/[id]', params: { id: photo.id } });
            }}
          />
          <IconButton
            icon="brush-outline"
            label={strings.photo.deco}
            disabled={photo.recipe === null}
            onPress={() => {
              router.push({ pathname: '/deco/[id]', params: { id: photo.id } });
            }}
          />
          {APP_CONFIG.apiBaseUrl !== null && (
            <IconButton
              icon="planet-outline"
              label={strings.photo.ai}
              onPress={() => {
                router.push({ pathname: '/ai/styles', params: { photoId: photo.id } });
              }}
            />
          )}
          <IconButton
            icon="share-outline"
            label={strings.common.share}
            onPress={() => {
              void sharePhotoFile(photo);
            }}
          />
        </View>
        <Button
          label={strings.common.save}
          busy={saving}
          onPress={() => {
            setSaving(true);
            void savePhoto(photo)
              .then((saved) => {
                if (saved) showNotice(strings.photo.saved);
              })
              .finally(() => {
                setSaving(false);
              });
          }}
        />
      </View>
      <Notice text={notice} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  imageArea: { flex: 1 },
  aiLabel: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    color: colors.text,
    fontSize: 11,
    backgroundColor: colors.scrim,
  },
  actions: { gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
});
