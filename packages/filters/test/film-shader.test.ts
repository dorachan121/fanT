import { describe, expect, it } from 'vitest';

import {
  compileRuntimeEffect,
  DEFAULT_FILM_PARAMS,
  FILM_SHADER_NAME,
  FILM_SHADER_SOURCE,
  normalizeFilmParams,
  toFilmUniforms,
  type FilmParams,
} from '../src';
import {
  createBitmap,
  loadCanvasKit,
  pixelAt,
  renderEffect,
  uniformNames,
  type Bitmap,
} from './canvaskit';

const ck = await loadCanvasKit();
const effect = compileRuntimeEffect(ck.RuntimeEffect, FILM_SHADER_NAME, FILM_SHADER_SOURCE);

const SIZE = 32;
const CENTER = SIZE / 2;
const GRAY = createBitmap(SIZE, SIZE, () => [128, 128, 128, 255]);
const GRADIENT = createBitmap(SIZE, SIZE, (x, y) => [x * 8, y * 8, 128, 255]);
const NO_EFFECTS = normalizeFilmParams({ warmth: 0, fade: 0, vignette: 0, grain: 0 });

function render(params: FilmParams, input: Bitmap = GRAY, seed = 0.5): Bitmap {
  const uniforms = toFilmUniforms(params, { width: input.width, height: input.height, seed });
  return renderEffect(ck, effect, uniforms, input);
}

function maxChannelDifference(a: Bitmap, b: Bitmap): number {
  return a.pixels.reduce((max, value, i) => Math.max(max, Math.abs(value - (b.pixels[i] ?? 0))), 0);
}

function luminance(bitmap: Bitmap, x: number, y: number): number {
  const [r, g, b] = pixelAt(bitmap, x, y);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe(`${FILM_SHADER_NAME} shader`, () => {
  it('declares exactly the uniforms produced by toFilmUniforms', () => {
    const uniforms = toFilmUniforms(DEFAULT_FILM_PARAMS, { width: 1, height: 1, seed: 0 });
    expect(uniformNames(effect).sort()).toEqual(Object.keys(uniforms).sort());
  });

  it('leaves the image untouched at zero intensity', () => {
    const output = render({ ...DEFAULT_FILM_PARAMS, intensity: 0 }, GRADIENT);
    expect(maxChannelDifference(output, GRADIENT)).toBeLessThanOrEqual(1);
  });

  it('is the identity when every effect is disabled', () => {
    expect(maxChannelDifference(render(NO_EFFECTS, GRADIENT), GRADIENT)).toBeLessThanOrEqual(1);
  });

  it('warms the image when warmth is positive', () => {
    const [r, g, b] = pixelAt(render({ ...NO_EFFECTS, warmth: 1 }), CENTER, CENTER);
    expect(r).toBeGreaterThan(128);
    expect(g).toBeCloseTo(128, -1);
    expect(b).toBeLessThan(128);
  });

  it('darkens the corners but not the centre with vignette', () => {
    const output = render({ ...NO_EFFECTS, vignette: 1 });
    expect(luminance(output, CENTER, CENTER)).toBeCloseTo(128, -1);
    expect(luminance(output, 0, 0)).toBeLessThan(luminance(output, CENTER, CENTER) - 20);
  });

  it('renders the same grain for the same seed and different grain for another seed', () => {
    const grainy = { ...NO_EFFECTS, grain: 1 };
    const first = render(grainy, GRAY, 0.25);
    expect(maxChannelDifference(first, GRAY)).toBeGreaterThan(0);
    expect(maxChannelDifference(render(grainy, GRAY, 0.25), first)).toBe(0);
    expect(maxChannelDifference(render(grainy, GRAY, 0.75), first)).toBeGreaterThan(0);
  });
});
