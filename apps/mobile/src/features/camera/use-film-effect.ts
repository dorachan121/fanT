import { compileRuntimeEffect, FILM_SHADER_NAME, FILM_SHADER_SOURCE } from '@fant/filters';
import { Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

/**
 * Compiles the shared film shader once per mount. A compile failure throws during
 * render so the route's error boundary reports it instead of drawing a blank canvas.
 */
export function useFilmEffect() {
  return useMemo(
    () => compileRuntimeEffect(Skia.RuntimeEffect, FILM_SHADER_NAME, FILM_SHADER_SOURCE),
    [],
  );
}
