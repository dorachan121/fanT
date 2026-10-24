import { describe, expect, it } from 'vitest';

import { DEFAULT_FILM_PARAMS } from './film-params';
import { toFilmUniforms } from './film-uniforms';

describe('toFilmUniforms', () => {
  it('combines film parameters with per-frame values', () => {
    expect(toFilmUniforms(DEFAULT_FILM_PARAMS, { width: 1080, height: 1440, seed: 0.42 })).toEqual({
      ...DEFAULT_FILM_PARAMS,
      resolution: [1080, 1440],
      seed: 0.42,
    });
  });

  it.each([
    { width: 0, height: 100 },
    { width: 100, height: -1 },
    { width: Number.NaN, height: 100 },
    { width: 100, height: Number.POSITIVE_INFINITY },
  ])('rejects an invalid frame size $width x $height', (size) => {
    expect(() => toFilmUniforms(DEFAULT_FILM_PARAMS, { ...size, seed: 0 })).toThrow(RangeError);
  });

  it('rejects a non-finite seed', () => {
    expect(() =>
      toFilmUniforms(DEFAULT_FILM_PARAMS, { width: 10, height: 10, seed: Number.NaN }),
    ).toThrow(RangeError);
  });
});
