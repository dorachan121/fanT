import type { Shader } from 'canvaskit-wasm';
import { describe, expect, it } from 'vitest';

import {
  chainFilters,
  compileFilterEffects,
  DEFAULT_ADJUST_PARAMS,
  IDENTITY_LUT,
  normalizeBeautyParams,
  normalizeFilmParams,
  toDateStampGlyphs,
  type FilterSettings,
} from '../src';
import {
  createBitmap,
  loadCanvasKit,
  lutBitmap,
  maxChannelDifference,
  renderWith,
} from './canvaskit';

const ck = await loadCanvasKit();
const effects = compileFilterEffects(ck.RuntimeEffect);
const INPUT = createBitmap(32, 32, (x, y) => [x * 8, y * 8, 120, 255]);

const NEUTRAL: FilterSettings = {
  adjust: DEFAULT_ADJUST_PARAMS,
  beauty: normalizeBeautyParams({ smoothing: 0, brightness: 0, rosiness: 0 }),
  film: normalizeFilmParams({ warmth: 0, fade: 0, vignette: 0, grain: 0 }),
  dateStamp: toDateStampGlyphs(null),
};

function render(settings: FilterSettings) {
  let created = 0;
  const output = renderWith(
    ck,
    INPUT,
    ([source, lut], track) => {
      if (source === undefined || lut === undefined) throw new Error('missing children');
      const chain = chainFilters(effects, settings, { width: 32, height: 32, seed: 0.3 }, source, {
        shader: lut,
        size: IDENTITY_LUT.size,
      });
      created = chain.created.length;
      chain.created.forEach((shader: Shader) => track(shader));
      return chain.shader;
    },
    [lutBitmap(IDENTITY_LUT)],
  );
  return { output, created };
}

describe('chainFilters', () => {
  it('compiles every shader of the chain', () => {
    expect(Object.keys(effects).sort()).toEqual(['adjust', 'beauty', 'dateStamp', 'film']);
  });

  it('only runs the film stage when everything else is neutral', () => {
    const { output, created } = render(NEUTRAL);
    expect(created).toBe(1);
    expect(maxChannelDifference(output, INPUT)).toBeLessThanOrEqual(1);
  });

  it('adds a stage for each non-neutral setting', () => {
    const { created } = render({
      ...NEUTRAL,
      adjust: { ...DEFAULT_ADJUST_PARAMS, brightness: 0.2 },
      beauty: normalizeBeautyParams(),
      dateStamp: toDateStampGlyphs({
        date: { year: 2026, month: 1, day: 2 },
        format: 'yy mm dd',
        color: [1, 0.5, 0],
      }),
    });
    expect(created).toBe(4);
  });
});
