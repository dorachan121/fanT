import { StyleSheet, View } from 'react-native';

import { strings } from '../../../i18n';
import { Chip } from '../../../ui/chip';
import { IconButton } from '../../../ui/icon-button';
import { spacing } from '../../../ui/theme';
import {
  ASPECT_VALUES,
  centerCrop,
  rotatedSize,
  turnClockwise,
  type Size,
} from '../../photo/geometry';
import { ASPECT_RATIOS, FULL_CROP, type AspectRatio } from '../../photo/recipe';
import type { PanelProps } from './panel-props';

/** Crop to an aspect ratio, rotate and flip (EDT-03). */
export function CropPanel({
  recipe,
  update,
  originalSize,
}: PanelProps & { readonly originalSize: Size }) {
  const setAspect = (aspect: AspectRatio | null) => {
    const turned = rotatedSize(originalSize, recipe.transform.rotation);
    update({
      transform: {
        ...recipe.transform,
        crop: aspect === null ? FULL_CROP : centerCrop(turned, ASPECT_VALUES[aspect]),
      },
    });
  };
  return (
    <>
      <View style={styles.row}>
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
      <View style={styles.row}>
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
            update({ transform: { ...recipe.transform, mirror: !recipe.transform.mirror } });
          }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
