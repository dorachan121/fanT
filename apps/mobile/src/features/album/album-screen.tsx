import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { strings } from '../../i18n';
import { confirmDestructive, showError } from '../../ui/dialogs';
import { IconButton } from '../../ui/icon-button';
import { ScreenHeader } from '../../ui/screen-header';
import { colors, spacing } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { importPhoto } from '../photo/import-photo';
import { deletePhotos } from './album-db';
import { useAlbum } from './use-album';

const COLUMNS = 3;

/** Photos taken with the app (ALB-01), with selection for deleting several (ALB-02). */
export function AlbumScreen() {
  const photos = useAlbum();
  const { width } = useWindowDimensions();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const size = (width - spacing.xs * (COLUMNS + 1)) / COLUMNS;

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeSelected = async () => {
    if (!(await confirmDestructive(strings.album.deleteConfirm(selected.size)))) return;
    deletePhotos([...selected]);
    setSelected(new Set());
    setSelecting(false);
  };

  const runImport = async () => {
    setImporting(true);
    try {
      const photo = await importPhoto();
      if (photo !== null) router.push({ pathname: '/edit/[id]', params: { id: photo.id } });
    } catch (error) {
      reportError(error, 'album.import');
      showError();
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={selecting ? strings.album.selected(selected.size) : strings.album.title}
        actions={
          selecting ? (
            <>
              <IconButton
                icon="trash-outline"
                label={strings.common.delete}
                disabled={selected.size === 0}
                onPress={() => void removeSelected()}
              />
              <IconButton
                icon="close"
                label={strings.common.cancel}
                onPress={() => {
                  setSelecting(false);
                  setSelected(new Set());
                }}
              />
            </>
          ) : (
            <>
              <IconButton
                icon="add"
                label={strings.album.import}
                disabled={importing}
                onPress={() => void runImport()}
              />
              <IconButton
                icon="checkmark-circle-outline"
                label={strings.album.select}
                disabled={photos.length === 0}
                onPress={() => {
                  setSelecting(true);
                }}
              />
            </>
          )
        }
      />
      <FlatList
        data={photos}
        numColumns={COLUMNS}
        keyExtractor={(photo) => photo.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={<Text style={styles.empty}>{strings.album.empty}</Text>}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable
              accessibilityRole={selecting ? 'checkbox' : 'imagebutton'}
              accessibilityState={selecting ? { checked: isSelected } : undefined}
              accessibilityLabel={new Date(item.createdAt).toLocaleString('ja-JP')}
              onPress={() => {
                if (selecting) toggle(item.id);
                else router.push({ pathname: '/photo/[id]', params: { id: item.id } });
              }}
              onLongPress={() => {
                setSelecting(true);
                toggle(item.id);
              }}
            >
              <Image
                source={{ uri: item.outputUri, cacheKey: `${item.id}-${String(item.updatedAt)}` }}
                style={{ width: size, height: size }}
                contentFit="cover"
                recyclingKey={item.id}
              />
              {selecting && <View style={[styles.check, isSelected && styles.checked]} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  grid: { gap: spacing.xs, padding: spacing.xs },
  gridRow: { gap: spacing.xs },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  check: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.text,
  },
  checked: { backgroundColor: colors.accent },
});
