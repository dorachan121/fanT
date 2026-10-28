import { DETAIL_PARAM_RANGES, type DetailParamName } from '@fant/filters';
import { StyleSheet } from 'react-native';

import { strings } from '../../../i18n';
import { Text } from '../../../ui/text';
import { colors } from '../../../ui/theme';
import type { PanelProps } from './panel-props';
import { ParamSliders } from './param-sliders';

const TONE = ['sharpen', 'highlights', 'shadows', 'vibrance'] as const;
const CURVE = ['curveShadows', 'curveDarks', 'curveLights', 'curveHighlights'] as const;

/** Sharpening and tone (EDT-07) and the four-point tone curve (EDT-09). */
export function TonePanel({ recipe, update }: PanelProps) {
  const change = (name: DetailParamName, value: number) => {
    update({ detail: { ...recipe.detail, [name]: value } }, name);
  };
  return (
    <>
      <ParamSliders
        names={TONE}
        ranges={DETAIL_PARAM_RANGES}
        values={recipe.detail}
        label={(name) => strings.edit.detail[name]}
        onChange={change}
      />
      <Text style={styles.heading}>{strings.edit.curve.title}</Text>
      <ParamSliders
        names={CURVE}
        ranges={DETAIL_PARAM_RANGES}
        values={recipe.detail}
        label={(name) => strings.edit.curve[name]}
        onChange={change}
      />
    </>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
