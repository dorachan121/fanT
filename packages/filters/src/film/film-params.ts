interface ParamRange {
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
}

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

export type FilmParams = Readonly<Record<FilmParamName, number>>;

const PARAM_NAMES = Object.keys(FILM_PARAM_RANGES) as readonly FilmParamName[];

export const DEFAULT_FILM_PARAMS: FilmParams = Object.freeze(
  Object.fromEntries(
    PARAM_NAMES.map((name) => [name, FILM_PARAM_RANGES[name].defaultValue]),
  ) as Record<FilmParamName, number>,
);

/**
 * Turns untrusted input (e.g. downloaded film definitions) into safe shader parameters:
 * missing or non-finite values fall back to defaults, the rest are clamped to range,
 * and unknown keys are dropped.
 */
export function normalizeFilmParams(
  input: Partial<Record<FilmParamName, unknown>> = {},
): FilmParams {
  const params = {} as Record<FilmParamName, number>;
  for (const name of PARAM_NAMES) {
    const { min, max, defaultValue } = FILM_PARAM_RANGES[name];
    const value = input[name];
    params[name] =
      typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : defaultValue;
  }
  return Object.freeze(params);
}
