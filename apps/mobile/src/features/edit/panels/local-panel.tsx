import { MAX_LOCAL_ADJUSTMENTS, type LocalAdjustment } from '@fant/filters';
import { StyleSheet, View } from 'react-native';

import { strings } from '../../../i18n';
import { Chip } from '../../../ui/chip';
import { IconButton } from '../../../ui/icon-button';
import { Slider } from '../../../ui/slider';
import { Text } from '../../../ui/text';
import { colors, spacing } from '../../../ui/theme';
import type { PanelProps, PhotoPoint } from './panel-props';
import { signedPercent } from './param-sliders';

const NEW_AREA: Omit<LocalAdjustment, 'x' | 'y'> = {
  radius: 0.25,
  feather: 0.6,
  brightness: 0.3,
  saturation: 0,
  temperature: 0,
};

/** A new area at a tapped point, or `null` when the photo already has the most it can. */
export function addLocalArea(
  local: readonly LocalAdjustment[],
  point: PhotoPoint,
): LocalAdjustment[] | null {
  if (local.length >= MAX_LOCAL_ADJUSTMENTS) return null;
  return [...local, { ...NEW_AREA, x: point.x, y: point.y }];
}

const SLIDERS = [
  { key: 'radius', min: 0.02, max: 1 },
  { key: 'feather', min: 0, max: 1 },
  { key: 'brightness', min: -1, max: 1 },
  { key: 'saturation', min: -1, max: 1 },
  { key: 'temperature', min: -1, max: 1 },
] as const;

/** Circular areas adjusted on their own (EDT-10): tap the photo to add one. */
export function LocalPanel({
  recipe,
  update,
  selected,
  onSelect,
}: PanelProps & { readonly selected: number; readonly onSelect: (index: number) => void }) {
  const area = recipe.local[selected];
  const replace = (next: LocalAdjustment | null) => {
    update(
      {
        local:
          next === null
            ? recipe.local.filter((_, index) => index !== selected)
            : recipe.local.map((item, index) => (index === selected ? next : item)),
      },
      next === null ? undefined : `local${String(selected)}`,
    );
  };
  return (
    <>
      <Text style={styles.hint}>{strings.edit.local.hint}</Text>
      <View style={styles.row}>
        {recipe.local.map((_, index) => (
          <Chip
            key={String(index)}
            label={strings.edit.local.area(index + 1)}
            selected={index === selected}
            onPress={() => {
              onSelect(index);
            }}
          />
        ))}
      </View>
      {area !== undefined && (
        <>
          {SLIDERS.map(({ key, min, max }) => (
            <Slider
              key={key}
              label={strings.edit.local[key]}
              value={area[key]}
              min={min}
              max={max}
              centered={min < 0}
              formatValue={min < 0 ? signedPercent : undefined}
              onChange={(value) => {
                replace({ ...area, [key]: value });
              }}
            />
          ))}
          <IconButton
            icon="trash-outline"
            label={strings.edit.local.remove}
            style={styles.remove}
            onPress={() => {
              replace(null);
              onSelect(Math.max(0, selected - 1));
            }}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  remove: { alignSelf: 'flex-end' },
});
