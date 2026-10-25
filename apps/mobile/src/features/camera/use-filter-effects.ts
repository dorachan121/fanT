import {
  BEAUTY_SHADER_NAME,
  BEAUTY_SHADER_SOURCE,
  compileRuntimeEffect,
  FILM_SHADER_NAME,
  FILM_SHADER_SOURCE,
} from '@fant/filters';
import { Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { FilterEffects } from './filter-pipeline.worklet';

/**
 * Compiles the shared shaders once per mount. A compile failure throws during
 * render so the route's error boundary reports it instead of drawing a blank canvas.
 */
export function useFilterEffects(): FilterEffects {
  return useMemo(
    () => ({
      beauty: compileRuntimeEffect(Skia.RuntimeEffect, BEAUTY_SHADER_NAME, BEAUTY_SHADER_SOURCE),
      film: compileRuntimeEffect(Skia.RuntimeEffect, FILM_SHADER_NAME, FILM_SHADER_SOURCE),
    }),
    [],
  );
}
