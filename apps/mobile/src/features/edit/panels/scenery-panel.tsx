import { DETAIL_PARAM_RANGES } from '@fant/filters';

import { strings } from '../../../i18n';
import { ParamSliders } from '../../../ui/param-sliders';
import type { PanelProps } from './panel-props';

const SCENERY = ['dehaze', 'clarity', 'sky', 'sunset'] as const;

/** Tools for landscapes, which work without people in the photo (EDT-15). */
export function SceneryPanel({ recipe, update }: PanelProps) {
  return (
    <ParamSliders
      names={SCENERY}
      ranges={DETAIL_PARAM_RANGES}
      values={recipe.detail}
      label={(name) => strings.edit.scenery[name]}
      onChange={(name, value) => {
        update({ detail: { ...recipe.detail, [name]: value } }, name);
      }}
    />
  );
}
