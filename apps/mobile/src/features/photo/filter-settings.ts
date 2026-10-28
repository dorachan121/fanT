import { resolveFilmParams, type Film } from '@fant/content-schema';
import {
  DEFAULT_ADJUST_PARAMS,
  DEFAULT_FACE_SHAPE_PARAMS,
  toDateStampGlyphs,
  type AdjustParams,
  type BeautyParams,
  type DateStamp,
  type FaceShapeParams,
  type FilterSettings,
} from '@fant/filters';

/** Shader settings for one shot; the preview and the saved photo use the same ones. */
export function filterSettingsFor(input: {
  readonly film: Film;
  readonly intensity: number;
  readonly seed: number;
  readonly beauty: BeautyParams;
  readonly adjust?: AdjustParams;
  /** Face fine-tuning (BTY-04); off when omitted. */
  readonly faceShape?: FaceShapeParams;
  readonly dateStamp: DateStamp | null;
}): FilterSettings {
  return {
    faceShape: input.faceShape ?? DEFAULT_FACE_SHAPE_PARAMS,
    adjust: input.adjust ?? DEFAULT_ADJUST_PARAMS,
    beauty: input.beauty,
    film: resolveFilmParams(input.film, { intensity: input.intensity, seed: input.seed }),
    dateStamp: toDateStampGlyphs(input.dateStamp),
  };
}
