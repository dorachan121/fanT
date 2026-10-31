import { describe, expect, it } from 'vitest';

import { editsSky, NO_SKY_EDIT, skyColorMatrix } from './sky-edit';

/** Applies a 4×5 matrix (no offsets) to an RGB colour. */
function apply(
  matrix: number[],
  [r, g, b]: readonly [number, number, number],
): [number, number, number] {
  const row = (index: number) =>
    (matrix[index * 5] ?? 0) * r +
    (matrix[index * 5 + 1] ?? 0) * g +
    (matrix[index * 5 + 2] ?? 0) * b;
  return [row(0), row(1), row(2)];
}

describe('sky edit', () => {
  it('changes nothing by default', () => {
    expect(editsSky(NO_SKY_EDIT)).toBe(false);
    expect(
      apply(skyColorMatrix(NO_SKY_EDIT), [0.2, 0.5, 0.9]).map((v) => Math.round(v * 1e6) / 1e6),
    ).toEqual([0.2, 0.5, 0.9]);
  });

  it('counts a new sky as an edit', () => {
    expect(editsSky({ ...NO_SKY_EDIT, backdrop: 'sunset' })).toBe(true);
  });

  it('brightens, saturates and warms', () => {
    const blue = [0.4, 0.6, 0.9] as const;
    const [, g1] = apply(skyColorMatrix({ ...NO_SKY_EDIT, brightness: 0.5 }), blue);
    expect(g1).toBeGreaterThan(0.6);
    const [r2, , b2] = apply(skyColorMatrix({ ...NO_SKY_EDIT, saturation: 0.5 }), blue);
    expect(b2 - r2).toBeGreaterThan(0.9 - 0.4);
    const [r3, , b3] = apply(skyColorMatrix({ ...NO_SKY_EDIT, warmth: 1 }), blue);
    expect(r3).toBeGreaterThan(0.4);
    expect(b3).toBeLessThan(0.9);
  });

  it('keeps grey grey when saturating', () => {
    const [r, g, b] = apply(skyColorMatrix({ ...NO_SKY_EDIT, saturation: 1 }), [0.5, 0.5, 0.5]);
    expect(r).toBeCloseTo(0.5);
    expect(g).toBeCloseTo(0.5);
    expect(b).toBeCloseTo(0.5);
  });
});
