import {
  packUniforms,
  toBeautyUniforms,
  toFilmUniforms,
  type BeautyParams,
  type FilmParams,
} from '@fant/filters';
import type { SkRuntimeEffect, SkShader } from '@shopify/react-native-skia';

export interface FilterEffects {
  readonly beauty: SkRuntimeEffect;
  readonly film: SkRuntimeEffect;
}

export interface FilterParams {
  readonly beauty: BeautyParams;
  readonly film: FilmParams;
}

export interface FilterShader {
  readonly shader: SkShader;
  /** Disposes every shader in the chain except the caller-owned source. */
  readonly dispose: () => void;
}

/**
 * Chains source → beauty → film for one camera frame or photo. The preview and the
 * saved photo both go through here, so they always get the same look.
 * Marked as a worklet so it can run on the camera frame thread.
 */
export function makeFilterShader(
  effects: FilterEffects,
  source: SkShader,
  size: { readonly width: number; readonly height: number },
  params: FilterParams,
  seed: number,
): FilterShader {
  'worklet';
  const beauty = effects.beauty.makeShaderWithChildren(
    packUniforms(effects.beauty, toBeautyUniforms(params.beauty, size)),
    [source],
  );
  const film = effects.film.makeShaderWithChildren(
    packUniforms(effects.film, toFilmUniforms(params.film, { ...size, seed })),
    [beauty],
  );
  return {
    shader: film,
    dispose: () => {
      film.dispose();
      beauty.dispose();
    },
  };
}
