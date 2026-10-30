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
 * (EDT-08), a four-point tone curve (EDT-09) and scenery tools (EDT-15). Zero leaves
 * the photo unchanged.
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
  /** Positive clears haze from distant scenery, negative adds a soft mist. */
  dehaze: centered,
  /** Contrast between neighbouring areas in the midtones: crisper or softer detail. */
  clarity: centered,
  /** Positive deepens blue skies, negative pales them. */
  sky: centered,
  /** Positive glows warmer in reds, oranges and highlights, negative cools them. */
  sunset: centered,
} as const satisfies Record<string, ParamRange>;

export type DetailParamName = keyof typeof DETAIL_PARAM_RANGES;

export type DetailParams = ParamValues<DetailParamName>;

const detailParams = defineParams(DETAIL_PARAM_RANGES);

export const DEFAULT_DETAIL_PARAMS: DetailParams = detailParams.defaults;

export const normalizeDetailParams = detailParams.normalize;

/** How a local area is shaped: a circle (EDT-10) or a graduated filter (EDT-17). */
export const LOCAL_SHAPES = ['radial', 'linear'] as const;
export type LocalShape = (typeof LOCAL_SHAPES)[number];

/** An area adjusted on its own, in photo fractions. */
export interface LocalAdjustment {
  readonly shape: LocalShape;
  /** The circle's centre, or a point on the graduated filter's middle line. */
  readonly x: number;
  readonly y: number;
  /**
   * A circle's radius, or half the width of a graduated filter's fade, as a
   * fraction of the photo's short edge.
   */
  readonly radius: number;
  /** A circle's soft edge as a fraction of the radius (0 hard, 1 fully soft). */
  readonly feather: number;
  /** Where a graduated filter applies, in degrees clockwise from up (0 = the top). */
  readonly angle: number;
  readonly brightness: number;
  readonly saturation: number;
  readonly temperature: number;
}

/** Local adjustments a photo can have at once. */
export const MAX_LOCAL_ADJUSTMENTS = 4;
