import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FILM_PARAMS,
  FILM_PARAM_RANGES,
  FILM_PRESETS,
  normalizeFilmParams,
} from './film-params';

describe('normalizeFilmParams', () => {
  it('returns the defaults when nothing is given', () => {
    expect(normalizeFilmParams()).toEqual(DEFAULT_FILM_PARAMS);
  });

  it('keeps in-range values', () => {
    expect(normalizeFilmParams({ intensity: 0.5, warmth: -0.3 })).toMatchObject({
      intensity: 0.5,
      warmth: -0.3,
    });
  });

  it('clamps out-of-range values to the nearest bound', () => {
    const params = normalizeFilmParams({ intensity: 2, warmth: -5, grain: -0.1 });
    expect(params.intensity).toBe(FILM_PARAM_RANGES.intensity.max);
    expect(params.warmth).toBe(FILM_PARAM_RANGES.warmth.min);
    expect(params.grain).toBe(FILM_PARAM_RANGES.grain.min);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, '0.5', null, undefined, {}])(
    'falls back to the default for %p',
    (value) => {
      expect(normalizeFilmParams({ fade: value }).fade).toBe(FILM_PARAM_RANGES.fade.defaultValue);
    },
  );

  it('drops unknown keys', () => {
    const input = { vignette: 0.4, unexpected: 1 } as Parameters<typeof normalizeFilmParams>[0];
    expect(Object.keys(normalizeFilmParams(input)).sort()).toEqual(
      Object.keys(FILM_PARAM_RANGES).sort(),
    );
  });

  it('returns an immutable object', () => {
    expect(Object.isFrozen(normalizeFilmParams())).toBe(true);
    expect(Object.isFrozen(DEFAULT_FILM_PARAMS)).toBe(true);
  });
});

describe('FILM_PRESETS', () => {
  it.each(Object.entries(FILM_PRESETS))('preset %s is already within range', (_, params) => {
    expect(normalizeFilmParams(params)).toEqual(params);
  });

  it('starts from the default look', () => {
    expect(FILM_PRESETS.natural).toBe(DEFAULT_FILM_PARAMS);
  });
});
