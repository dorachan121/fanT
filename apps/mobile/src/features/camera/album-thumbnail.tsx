import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { strings } from '../../i18n';
import { colors, TOUCH_TARGET } from '../../ui/theme';
import { useAlbum } from '../album/use-album';

/** The latest photo; opens the album (S-50). */
export function AlbumThumbnail() {
  const latest = useAlbum()[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={strings.camera.album}
      style={styles.thumb}
      onPress={() => {
        router.push('/album');
      }}
    >
      {latest === undefined ? (
        <View style={styles.empty} />
      ) : (
        <Image
          source={{ uri: latest.outputUri, cacheKey: `${latest.id}-${String(latest.updatedAt)}` }}
          style={styles.image}
          contentFit="cover"
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.text,
    overflow: 'hidden',
  },
  image: { flex: 1 },
  empty: { flex: 1, backgroundColor: colors.surfaceRaised },
});
