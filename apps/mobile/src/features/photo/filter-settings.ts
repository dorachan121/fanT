import { resolveFilmParams, type Film } from '@fant/content-schema';
import {
  DEFAULT_ADJUST_PARAMS,
  toDateStampGlyphs,
  type AdjustParams,
  type BeautyParams,
  type DateStamp,
  type FilterSettings,
} from '@fant/filters';

/** Shader settings for one shot; the preview and the saved photo use the same ones. */
export function filterSettingsFor(input: {
  readonly film: Film;
  readonly intensity: number;
  readonly seed: number;
  readonly beauty: BeautyParams;
  readonly adjust?: AdjustParams;
  readonly dateStamp: DateStamp | null;
}): FilterSettings {
  return {
    adjust: input.adjust ?? DEFAULT_ADJUST_PARAMS,
    beauty: input.beauty,
    film: resolveFilmParams(input.film, { intensity: input.intensity, seed: input.seed }),
    dateStamp: toDateStampGlyphs(input.dateStamp),
  };
}
