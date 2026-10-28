import {
  BEAUTY_LEVELS,
  BEAUTY_PARAM_RANGES,
  FACE_SHAPE_PARAM_RANGES,
  type BeautyParams,
  type FaceShapeParams,
} from '@fant/filters';
import { View, StyleSheet } from 'react-native';

import { strings } from '../../i18n';
import { Chip } from '../../ui/chip';
import { Sheet } from '../../ui/sheet';
import { Slider } from '../../ui/slider';
import { Text } from '../../ui/text';
import { colors, spacing } from '../../ui/theme';
import { useCameraSettings } from './camera-store';
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

/** Face fine-tuning (BTY-04): off by default, and subtle even at the maximum. */
export function FaceShapeControls({
  faceShape,
  onChange,
}: {
  readonly faceShape: FaceShapeParams;
  readonly onChange: (faceShape: FaceShapeParams) => void;
}) {
  return (
    <>
      <Text style={styles.heading}>{strings.beauty.faceShape}</Text>
      {(['eyes', 'slim'] as const).map((key) => (
        <Slider
          key={key}
          label={strings.beauty[key]}
          value={faceShape[key]}
          min={FACE_SHAPE_PARAM_RANGES[key].min}
          max={FACE_SHAPE_PARAM_RANGES[key].max}
          onChange={(value) => {
            onChange({ ...faceShape, [key]: value });
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
  const faceShape = useCameraSettings((state) => state.faceShape);
  return (
    <Sheet visible={visible} title={strings.beauty.title} onClose={onClose}>
      <BeautyControls beauty={beauty} onChange={onChange} />
      <FaceShapeControls
        faceShape={faceShape}
        onChange={(next) => {
          useCameraSettings.getState().update({ faceShape: next });
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  heading: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: spacing.sm },
});
