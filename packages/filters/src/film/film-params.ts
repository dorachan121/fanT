import { defineParams, type ParamRange, type ParamValues } from '../params';

/** Single source of truth for every film parameter: its bounds and default. */
export const FILM_PARAM_RANGES = {
  /** Blend between the original image (0) and the full film look (1). */
  intensity: { min: 0, max: 1, defaultValue: 1 },
  /** Colour temperature shift: negative is cooler, positive is warmer. */
  warmth: { min: -1, max: 1, defaultValue: 0.15 },
  /** Lifted blacks for a washed-out print look. */
  fade: { min: 0, max: 1, defaultValue: 0.1 },
  /** Darkening towards the corners. */
  vignette: { min: 0, max: 1, defaultValue: 0.25 },
  /** Luminance-weighted film grain. */
  grain: { min: 0, max: 1, defaultValue: 0.12 },
} as const satisfies Record<string, ParamRange>;

export type FilmParamName = keyof typeof FILM_PARAM_RANGES;

export type FilmParams = ParamValues<FilmParamName>;

const filmParams = defineParams(FILM_PARAM_RANGES);

export const DEFAULT_FILM_PARAMS: FilmParams = filmParams.defaults;

export const normalizeFilmParams = filmParams.normalize;
