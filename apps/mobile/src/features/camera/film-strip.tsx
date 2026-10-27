import { isNew, type Film } from '@fant/content-schema';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFilmThumbnail } from '../../engine/film-thumbnails';
import { Canvas, SkiaImage } from '../../engine/skia';
import { localized, strings } from '../../i18n';
import { colors, spacing } from '../../ui/theme';
import { isLocked } from '../purchases/purchases-store';

const THUMB_WIDTH = 54;
const THUMB_HEIGHT = 72;

interface FilmStripProps {
  readonly films: readonly Film[];
  readonly selectedId: string;
  readonly favorites: readonly string[];
  readonly premium: boolean;
  readonly onSelect: (film: Film) => void;
  /** Tapping the selected film opens its settings (S-11). */
  readonly onOpenSettings: () => void;
  readonly onToggleFavorite: (film: Film) => void;
}

/** Favourites first (FLM-08), then the manifest's order. */
export function orderFilms(films: readonly Film[], favorites: readonly string[]): Film[] {
  const favoriteSet = new Set(favorites);
  return [
    ...films.filter(({ id }) => favoriteSet.has(id)),
    ...films.filter(({ id }) => !favoriteSet.has(id)),
  ];
}

function FilmItem({
  film,
  selected,
  favorite,
  locked,
  onPress,
  onLongPress,
}: {
  readonly film: Film;
  readonly selected: boolean;
  readonly favorite: boolean;
  readonly locked: boolean;
  readonly onPress: () => void;
  readonly onLongPress: () => void;
}) {
  const thumbnail = useFilmThumbnail(film);
  const name = localized(film.name);
  const badge = isNew(film, new Date()) ? strings.common.new : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={locked ? `${name}（${strings.common.premium}）` : name}
      accessibilityState={{ selected }}
      accessibilityHint={favorite ? strings.film.removeFavorite : strings.film.addFavorite}
      style={styles.item}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={[styles.thumb, selected && styles.selectedThumb]}>
        {thumbnail !== null && (
          <Canvas style={styles.canvas}>
            <SkiaImage
              image={thumbnail}
              x={0}
              y={0}
              width={THUMB_WIDTH}
              height={THUMB_HEIGHT}
              fit="cover"
            />
          </Canvas>
        )}
        {locked && <Text style={styles.lock}>👑</Text>}
        {favorite && <Text style={styles.favorite}>♥</Text>}
        {badge !== null && <Text style={styles.newBadge}>{badge}</Text>}
      </View>
      <Text numberOfLines={1} style={[styles.name, selected && styles.selectedName]}>
        {name}
      </Text>
    </Pressable>
  );
}

/** The films to shoot with (FLM-01): sample thumbnails, premium and NEW badges. */
export function FilmStrip({
  films,
  selectedId,
  favorites,
  premium,
  onSelect,
  onOpenSettings,
  onToggleFavorite,
}: FilmStripProps) {
  return (
    <FlatList
      horizontal
      data={orderFilms(films, favorites)}
      keyExtractor={(film) => film.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <FilmItem
          film={item}
          selected={item.id === selectedId}
          favorite={favorites.includes(item.id)}
          locked={isLocked(item, premium)}
          onPress={() => {
            if (item.id === selectedId) onOpenSettings();
            else onSelect(item);
          }}
          onLongPress={() => {
            onToggleFavorite(item);
          }}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingHorizontal: spacing.md },
  item: { width: THUMB_WIDTH + 8, alignItems: 'center', gap: 4 },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  selectedThumb: { borderColor: colors.text },
  canvas: { width: THUMB_WIDTH, height: THUMB_HEIGHT },
  lock: { position: 'absolute', top: 2, left: 3, fontSize: 11 },
  favorite: { position: 'absolute', top: 1, right: 4, color: colors.accent, fontSize: 12 },
  newBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    paddingHorizontal: 3,
    borderRadius: 3,
    overflow: 'hidden',
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: colors.accent,
  },
  name: { color: colors.textMuted, fontSize: 11 },
  selectedName: { color: colors.text, fontWeight: '700' },
});
