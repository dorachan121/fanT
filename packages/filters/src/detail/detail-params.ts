import { defineParams, type ParamRange, type ParamValues } from '../params';

const centered = { min: -1, max: 1, defaultValue: 0 } as const;

/** The eight colour bands of the HSL tool (EDT-08), in hue order. */
export const HSL_BANDS = [
  'red',
  'orange',
  'yellow',
  'green',
  'aqua',
  'blue',
  'purple',
  'magenta',
] as const;
export type HslBand = (typeof HSL_BANDS)[number];

type HslParamName = `${HslBand}${'Hue' | 'Saturation' | 'Luminance'}`;

const hslRanges = Object.fromEntries(
  HSL_BANDS.flatMap((band) =>
    (['Hue', 'Saturation', 'Luminance'] as const).map((part) => [`${band}${part}`, centered]),
  ),
) as Record<HslParamName, typeof centered>;

/**
 * Detailed adjustments in the editor: sharpening and tone (EDT-07), colour bands
 * (EDT-08) and a four-point tone curve (EDT-09). Zero leaves the photo unchanged.
 */
export const DETAIL_PARAM_RANGES = {
  sharpen: { min: 0, max: 1, defaultValue: 0 },
  /** Negative recovers bright areas, positive brightens them. */
  highlights: centered,
  /** Positive lifts dark areas, negative deepens them. */
  shadows: centered,
  /** Saturation that favours dull colours over already vivid ones. */
  vibrance: centered,
  /** Tone curve: brightness around 1/8, 3/8, 5/8 and 7/8 of the range. */
  curveShadows: centered,
  curveDarks: centered,
  curveLights: centered,
  curveHighlights: centered,
  ...hslRanges,
} as const satisfies Record<string, ParamRange>;

export type DetailParamName = keyof typeof DETAIL_PARAM_RANGES;

export type DetailParams = ParamValues<DetailParamName>;

const detailParams = defineParams(DETAIL_PARAM_RANGES);

export const DEFAULT_DETAIL_PARAMS: DetailParams = detailParams.defaults;

export const normalizeDetailParams = detailParams.normalize;

/** A circular area adjusted on its own (EDT-10), in photo fractions. */
export interface LocalAdjustment {
  readonly x: number;
  readonly y: number;
  /** Radius as a fraction of the photo's short edge. */
  readonly radius: number;
  /** Soft edge as a fraction of the radius (0 hard, 1 fully soft). */
  readonly feather: number;
  readonly brightness: number;
  readonly saturation: number;
  readonly temperature: number;
}

/** Local adjustments a photo can have at once. */
export const MAX_LOCAL_ADJUSTMENTS = 4;
