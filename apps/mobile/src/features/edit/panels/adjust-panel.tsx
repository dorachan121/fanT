import { ADJUST_PARAM_RANGES, type AdjustParamName } from '@fant/filters';

import { strings } from '../../../i18n';
import type { PanelProps } from './panel-props';
import { ParamSliders } from './param-sliders';

const ADJUSTMENTS: readonly AdjustParamName[] = [
  'brightness',
  'contrast',
  'saturation',
  'temperature',
];

/** Basic corrections (EDT-03). */
export function AdjustPanel({ recipe, update }: PanelProps) {
  return (
    <ParamSliders
      names={ADJUSTMENTS}
      ranges={ADJUST_PARAM_RANGES}
      values={recipe.adjust}
      label={(name) => strings.edit[name]}
      onChange={(name, value) => {
        update({ adjust: { ...recipe.adjust, [name]: value } }, name);
      }}
    />
  );
}
