import { describe, expect, it } from 'vitest';

import { apply } from '../../engine/affine.worklet';
import { FULL_CROP } from './recipe';
import { recipeTransform } from './transform';

const SIZE = { width: 400, height: 300 };

function mapped(transform: Parameters<typeof recipeTransform>[1], x: number, y: number) {
  const p = apply(recipeTransform(SIZE, transform), { x, y });
  return [Math.round(p.x), Math.round(p.y)];
}

describe('recipeTransform', () => {
  it('is the identity without a transform', () => {
    expect(mapped({ rotation: 0, mirror: false, crop: FULL_CROP }, 10, 20)).toEqual([10, 20]);
  });

  it('mirrors horizontally', () => {
    expect(mapped({ rotation: 0, mirror: true, crop: FULL_CROP }, 10, 20)).toEqual([390, 20]);
  });

  it('turns a quarter clockwise: the top-left corner goes to the top-right', () => {
    expect(mapped({ rotation: 90, mirror: false, crop: FULL_CROP }, 0, 0)).toEqual([300, 0]);
    expect(mapped({ rotation: 90, mirror: false, crop: FULL_CROP }, 400, 300)).toEqual([0, 400]);
  });

  it('turns half and three quarters', () => {
    expect(mapped({ rotation: 180, mirror: false, crop: FULL_CROP }, 0, 0)).toEqual([400, 300]);
    expect(mapped({ rotation: 270, mirror: false, crop: FULL_CROP }, 0, 0)).toEqual([0, 400]);
  });

  it('crops after turning', () => {
    const crop = { x: 0.5, y: 0.25, width: 0.5, height: 0.5 };
    // Rotated size is 300×400: the crop starts at (150, 100).
    expect(mapped({ rotation: 90, mirror: false, crop }, 0, 0)).toEqual([150, -100]);
  });
});
