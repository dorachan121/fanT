import { describe, expect, it } from 'vitest';

import {
  compileRuntimeEffect,
  DEFAULT_DETAIL_PARAMS,
  DETAIL_SHADER_NAME,
  DETAIL_SHADER_SOURCE,
  toDetailUniforms,
  type DetailParams,
  type LocalAdjustment,
} from '../src';
import {
  createBitmap,
  loadCanvasKit,
  maxChannelDifference,
  pixelAt,
  renderEffect,
  uniformNames,
} from './canvaskit';

const ck = await loadCanvasKit();
const effect = compileRuntimeEffect(ck.RuntimeEffect, DETAIL_SHADER_NAME, DETAIL_SHADER_SOURCE);

const SIZE = 64;
/** A grey ramp left to right, and coloured bands top to bottom. */
const RAMP = createBitmap(SIZE, SIZE, (x) => [x * 4, x * 4, x * 4, 255]);
const RED = createBitmap(SIZE, SIZE, () => [200, 40, 40, 255]);
const BLUE = createBitmap(SIZE, SIZE, () => [40, 60, 200, 255]);

function render(
  input: ReturnType<typeof createBitmap>,
  params: Partial<DetailParams>,
  local: LocalAdjustment[] = [],
) {
  const uniforms = toDetailUniforms({ ...DEFAULT_DETAIL_PARAMS, ...params }, local, {
    width: SIZE,
    height: SIZE,
  });
  return renderEffect(ck, effect, uniforms, input);
}

describe(`${DETAIL_SHADER_NAME} shader`, () => {
  it('declares exactly the uniforms produced by toDetailUniforms', () => {
    const uniforms = toDetailUniforms(DEFAULT_DETAIL_PARAMS, [], { width: 1, height: 1 });
    expect(uniformNames(effect).sort()).toEqual(Object.keys(uniforms).sort());
  });

  it('leaves the photo unchanged at the defaults', () => {
    expect(maxChannelDifference(render(RAMP, {}), RAMP)).toBeLessThanOrEqual(1);
  });

  it('lifts shadows more than highlights', () => {
    const output = render(RAMP, { shadows: 1 });
    const darkGain = pixelAt(output, 8, 0)[0] - pixelAt(RAMP, 8, 0)[0];
    const brightGain = pixelAt(output, 60, 0)[0] - pixelAt(RAMP, 60, 0)[0];
    expect(darkGain).toBeGreaterThan(brightGain);
  });

  it('bends the tone curve where it is pulled', () => {
    const output = render(RAMP, { curveDarks: 1 });
    expect(pixelAt(output, 24, 0)[0]).toBeGreaterThan(pixelAt(RAMP, 24, 0)[0]);
    expect(pixelAt(output, 63, 0)[0]).toBeLessThanOrEqual(pixelAt(RAMP, 63, 0)[0] + 1);
  });

  it('changes only the chosen colour band', () => {
    expect(pixelAt(render(RED, { redSaturation: -1 }), 0, 0)[1]).toBeGreaterThan(80);
    expect(maxChannelDifference(render(BLUE, { redSaturation: -1 }), BLUE)).toBeLessThanOrEqual(1);
  });

  it('adjusts inside a local area only', () => {
    const area: LocalAdjustment = {
      x: 0.25,
      y: 0.5,
      radius: 0.2,
      feather: 0.2,
      brightness: 1,
      saturation: 0,
      temperature: 0,
    };
    const output = render(RAMP, {}, [area]);
    expect(pixelAt(output, 16, 32)[0]).toBeGreaterThan(pixelAt(RAMP, 16, 32)[0]);
    expect(pixelAt(output, 56, 32)).toEqual(pixelAt(RAMP, 56, 32));
  });

  it('clears haze: a pale, low-contrast scene gets darker and more contrasted', () => {
    const hazy = createBitmap(SIZE, SIZE, (x) =>
      x < SIZE / 2 ? [150, 160, 175, 255] : [190, 195, 205, 255],
    );
    const output = render(hazy, { dehaze: 1 });
    const before = pixelAt(hazy, 60, 32)[0] - pixelAt(hazy, 4, 32)[0];
    const after = pixelAt(output, 60, 32)[0] - pixelAt(output, 4, 32)[0];
    expect(pixelAt(output, 4, 32)[0]).toBeLessThan(150);
    expect(after).toBeGreaterThan(before);
  });

  it('adds a mist with negative dehaze', () => {
    const dark = createBitmap(SIZE, SIZE, () => [30, 40, 50, 255]);
    expect(pixelAt(render(dark, { dehaze: -1 }), 32, 32)[0]).toBeGreaterThan(60);
  });

  it('sharpens the contrast across an edge with clarity, and leaves flat areas alone', () => {
    const edge = createBitmap(SIZE, SIZE, (x) =>
      x < SIZE / 2 ? [100, 100, 100, 255] : [160, 160, 160, 255],
    );
    const output = render(edge, { clarity: 1 });
    expect(pixelAt(output, SIZE / 2 - 1, 32)[0]).toBeLessThan(100);
    expect(pixelAt(output, SIZE / 2, 32)[0]).toBeGreaterThan(160);
    expect(maxChannelDifference(render(RED, { clarity: 1 }), RED)).toBeLessThanOrEqual(1);
  });

  it('deepens blue skies and leaves warm colours alone', () => {
    const sky = createBitmap(SIZE, SIZE, () => [110, 160, 230, 255]);
    const output = render(sky, { sky: 1 });
    const saturation = ([r, g, b]: readonly number[]) =>
      Math.max(r ?? 0, g ?? 0, b ?? 0) - Math.min(r ?? 0, g ?? 0, b ?? 0);
    expect(saturation(pixelAt(output, 32, 4))).toBeGreaterThan(saturation(pixelAt(sky, 32, 4)));
    // Higher in the frame counts as more likely sky.
    expect(saturation(pixelAt(output, 32, 4))).toBeGreaterThanOrEqual(
      saturation(pixelAt(output, 32, 60)),
    );
    expect(maxChannelDifference(render(RED, { sky: 1 }), RED)).toBeLessThanOrEqual(1);
  });

  it('warms a sunset and cools it the other way', () => {
    const glow = createBitmap(SIZE, SIZE, () => [230, 150, 90, 255]);
    const warmer = pixelAt(render(glow, { sunset: 1 }), 32, 32);
    const cooler = pixelAt(render(glow, { sunset: -1 }), 32, 32);
    expect(warmer[0] - warmer[2]).toBeGreaterThan(230 - 90);
    expect(cooler[0] - cooler[2]).toBeLessThan(230 - 90);
  });
});
