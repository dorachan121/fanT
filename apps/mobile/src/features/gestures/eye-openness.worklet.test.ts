import { describe, expect, it } from 'vitest';

import { primaryFaceEyes, type DetectedFace } from './eye-openness.worklet';

const face = (size: number, left?: number, right?: number, yawAngle = 0): DetectedFace => ({
  bounds: { width: size, height: size },
  yawAngle,
  ...(left === undefined ? {} : { leftEyeOpenProbability: left }),
  ...(right === undefined ? {} : { rightEyeOpenProbability: right }),
});

describe('primaryFaceEyes', () => {
  it('returns null when no face is visible', () => {
    expect(primaryFaceEyes([], false)).toBeNull();
  });

  it('reads the largest face, ignoring people further away', () => {
    expect(
      primaryFaceEyes([face(50, 0.1, 0.1), face(200, 0.9, 0.2), face(80, 0.5, 0.5)], false),
    ).toEqual({ left: 0.9, right: 0.2 });
  });

  it('swaps left and right when the detector reports them mirrored', () => {
    expect(primaryFaceEyes([face(200, 0.9, 0.2)], true)).toEqual({ left: 0.2, right: 0.9 });
  });

  it('ignores a face turned to the side, whose far eye reads as closed', () => {
    expect(primaryFaceEyes([face(200, 0.02, 0.98, -40)], false)).toBeNull();
    expect(primaryFaceEyes([face(200, 0.99, 0.28, 80)], false)).toBeNull();
  });

  it('reads a face turned slightly, as in a natural selfie', () => {
    expect(primaryFaceEyes([face(200, 0.02, 0.98, 5)], false)).toEqual({ left: 0.02, right: 0.98 });
  });

  it('returns null when the eyes could not be classified', () => {
    expect(primaryFaceEyes([face(200, 0.9)], false)).toBeNull();
  });
});
