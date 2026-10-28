import { defineParams, type ParamRange, type ParamValues } from '../params';

/**
 * Face fine-tuning (BTY-04). Each goes from 0 (off, the default) to 1, and 1 is
 * kept subtle in the shader itself: eyes at most about 15% larger at their centre,
 * the jaw at most about 6% narrower.
 */
export const FACE_SHAPE_PARAM_RANGES = {
  /** Larger eyes. */
  eyes: { min: 0, max: 1, defaultValue: 0 },
  /** A slimmer lower face (cheeks and jaw). */
  slim: { min: 0, max: 1, defaultValue: 0 },
} as const satisfies Record<string, ParamRange>;

export type FaceShapeParamName = keyof typeof FACE_SHAPE_PARAM_RANGES;

export type FaceShapeParams = ParamValues<FaceShapeParamName>;

const faceShapeParams = defineParams(FACE_SHAPE_PARAM_RANGES);

/** Off: the photo keeps everyone's own face. */
export const DEFAULT_FACE_SHAPE_PARAMS: FaceShapeParams = faceShapeParams.defaults;

export const normalizeFaceShapeParams = faceShapeParams.normalize;
