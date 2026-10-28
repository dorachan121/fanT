import { BEAUTY_LEVELS, BEAUTY_PARAM_RANGES, type BeautyParams } from '@fant/filters';
import { View, StyleSheet } from 'react-native';

import { strings } from '../../i18n';
import { Chip } from '../../ui/chip';
import { Sheet } from '../../ui/sheet';
import { Slider } from '../../ui/slider';
import { spacing } from '../../ui/theme';
import { BEAUTY_LEVEL_ORDER, beautyLevelOf } from './presets';

interface BeautyControlsProps {
  readonly beauty: BeautyParams;
  readonly onChange: (beauty: BeautyParams) => void;
}

/** Strength presets (BTY-02) and fine-tuning of smoothing and skin tone (BTY-03). */
export function BeautyControls({ beauty, onChange }: BeautyControlsProps) {
  const level = beautyLevelOf(beauty);
  return (
    <>
      <View style={styles.chips}>
        {BEAUTY_LEVEL_ORDER.map((candidate) => (
          <Chip
            key={candidate}
            label={strings.beauty.levels[candidate]}
            selected={level === candidate}
            onPress={() => {
              onChange(BEAUTY_LEVELS[candidate]);
            }}
          />
        ))}
      </View>
      {(['smoothing', 'brightness', 'rosiness'] as const).map((key) => (
        <Slider
          key={key}
          label={strings.beauty[key]}
          value={beauty[key]}
          min={BEAUTY_PARAM_RANGES[key].min}
          max={BEAUTY_PARAM_RANGES[key].max}
          onChange={(value) => {
            onChange({ ...beauty, [key]: value });
          }}
        />
      ))}
    </>
  );
}

export function BeautySheet({
  beauty,
  onChange,
  visible,
  onClose,
}: BeautyControlsProps & { readonly visible: boolean; readonly onClose: () => void }) {
  return (
    <Sheet visible={visible} title={strings.beauty.title} onClose={onClose}>
      <BeautyControls beauty={beauty} onChange={onChange} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
