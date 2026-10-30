import { describe, expect, it } from 'vitest';

import { apply } from '../../engine/affine.worklet';
import { FULL_CROP } from './recipe';
import { recipeTransform, straightenZoom } from './transform';

const SIZE = { width: 400, height: 300 };

function mapped(transform: Parameters<typeof recipeTransform>[1], x: number, y: number) {
  const p = apply(recipeTransform(SIZE, transform), { x, y });
  return [Math.round(p.x), Math.round(p.y)];
}

describe('recipeTransform', () => {
  it('is the identity without a transform', () => {
    expect(mapped({ rotation: 0, mirror: false, straighten: 0, crop: FULL_CROP }, 10, 20)).toEqual([
      10, 20,
    ]);
  });

  it('mirrors horizontally', () => {
    expect(mapped({ rotation: 0, mirror: true, straighten: 0, crop: FULL_CROP }, 10, 20)).toEqual([
      390, 20,
    ]);
  });

  it('turns a quarter clockwise: the top-left corner goes to the top-right', () => {
    expect(mapped({ rotation: 90, mirror: false, straighten: 0, crop: FULL_CROP }, 0, 0)).toEqual([
      300, 0,
    ]);
    expect(
      mapped({ rotation: 90, mirror: false, straighten: 0, crop: FULL_CROP }, 400, 300),
    ).toEqual([0, 400]);
  });

  it('turns half and three quarters', () => {
    expect(mapped({ rotation: 180, mirror: false, straighten: 0, crop: FULL_CROP }, 0, 0)).toEqual([
      400, 300,
    ]);
    expect(mapped({ rotation: 270, mirror: false, straighten: 0, crop: FULL_CROP }, 0, 0)).toEqual([
      0, 400,
    ]);
  });

  it('crops after turning', () => {
    const crop = { x: 0.5, y: 0.25, width: 0.5, height: 0.5 };
    // Rotated size is 300×400: the crop starts at (150, 100).
    expect(mapped({ rotation: 90, mirror: false, straighten: 0, crop }, 0, 0)).toEqual([150, -100]);
  });

  it('straightens around the centre, zoomed in so no corner is left empty', () => {
    const transform = { rotation: 0, mirror: false, straighten: 10, crop: FULL_CROP } as const;
    const m = recipeTransform(SIZE, transform);

    expect(mapped(transform, 200, 150)).toEqual([200, 150]);
    // Every corner of the output must show the photo: map them back into the original.
    const zoom = straightenZoom(SIZE, 10);
    for (const [x, y] of [
      [0, 0],
      [400, 0],
      [0, 300],
      [400, 300],
    ] as const) {
      const radians = (-10 * Math.PI) / 180;
      const dx = (x - 200) / zoom;
      const dy = (y - 150) / zoom;
      const sx = 200 + dx * Math.cos(radians) - dy * Math.sin(radians);
      const sy = 150 + dx * Math.sin(radians) + dy * Math.cos(radians);
      expect(sx).toBeGreaterThanOrEqual(-1e-6);
      expect(sx).toBeLessThanOrEqual(400 + 1e-6);
      expect(sy).toBeGreaterThanOrEqual(-1e-6);
      expect(sy).toBeLessThanOrEqual(300 + 1e-6);
      // The inverse above matches the transform.
      const forward = apply(m, { x: sx, y: sy });
      expect(forward.x).toBeCloseTo(x, 6);
      expect(forward.y).toBeCloseTo(y, 6);
    }
  });

  it('zooms just enough: a corner of the output touches the edge of the photo', () => {
    expect(straightenZoom(SIZE, 0)).toBe(1);
    expect(straightenZoom(SIZE, -10)).toBe(straightenZoom(SIZE, 10));
    expect(straightenZoom({ width: 300, height: 400 }, 10)).toBe(straightenZoom(SIZE, 10));
  });

  it('straightens after quarter turns and before the crop', () => {
    const crop = { x: 0.5, y: 0, width: 0.5, height: 1 };
    const straight = recipeTransform(SIZE, { rotation: 90, mirror: false, straighten: 0, crop });
    const tilted = recipeTransform(SIZE, { rotation: 90, mirror: false, straighten: 5, crop });
    // The centre of the turned photo (150, 200) stays put; the crop then moves it left.
    const centre = { x: 200, y: 150 };
    expect(apply(straight, centre)).toEqual(apply(tilted, centre));
    expect(apply(tilted, centre).x).toBeCloseTo(0, 6);
  });
});
