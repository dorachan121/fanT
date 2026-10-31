import { StyleSheet, View } from 'react-native';

import { skyMaskImage } from '../../../engine/sky-mask-image';
import type { SkImage } from '../../../engine/skia';
import { strings } from '../../../i18n';
import { Chip } from '../../../ui/chip';
import { signedPercent } from '../../../ui/param-sliders';
import { Slider } from '../../../ui/slider';
import { Text } from '../../../ui/text';
import { colors, spacing } from '../../../ui/theme';
import { findBackdrop, SKY_BACKDROP_IDS } from '../../photo/backdrops';
import type { SkyEdit } from '../../sky/sky-edit';
import type { PanelProps } from './panel-props';

const SLIDERS = ['brightness', 'saturation', 'warmth'] as const;

/** The sky alone, found on the device (EDT-25): recolour it or put a new one in. */
export function SkyPanel({
  recipe,
  update,
  original,
}: PanelProps & { readonly original: SkImage }) {
  if (skyMaskImage(original) === null) {
    return <Text style={styles.hint}>{strings.edit.sky.none}</Text>;
  }
  const change = (next: Partial<SkyEdit>, key?: string) => {
    update({ sky: { ...recipe.sky, ...next } }, key);
  };
  return (
    <>
      <Text style={styles.hint}>{strings.edit.sky.hint}</Text>
      <View style={styles.row}>
        <Chip
          label={strings.edit.sky.keep}
          selected={recipe.sky.backdrop === null}
          onPress={() => {
            change({ backdrop: null });
          }}
        />
        {SKY_BACKDROP_IDS.map((id) => (
          <Chip
            key={id}
            label={findBackdrop(id)?.emoji ?? id}
            selected={recipe.sky.backdrop === id}
            onPress={() => {
              change({ backdrop: id });
            }}
          />
        ))}
      </View>
      {SLIDERS.map((name) => (
        <Slider
          key={name}
          label={strings.edit.sky[name]}
          value={recipe.sky[name]}
          min={-1}
          max={1}
          centered
          formatValue={signedPercent}
          onChange={(value) => {
            change({ [name]: value }, `sky-${name}`);
          }}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
