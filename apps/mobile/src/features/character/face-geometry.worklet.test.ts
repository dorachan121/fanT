import type { CharacterPart } from '@fant/content-schema';
import { describe, expect, it } from 'vitest';

import { IDENTITY, type Affine } from '../../engine/affine.worklet';
import {
  anchorPoint,
  placePart,
  primaryFaces,
  toFaceGeometry,
  type DetectedFace,
} from './face-geometry.worklet';

const FACE: DetectedFace = {
  bounds: { x: 100, y: 100, width: 200, height: 240 },
  landmarks: {
    LEFT_EYE: { x: 250, y: 180 },
    RIGHT_EYE: { x: 150, y: 180 },
    NOSE_BASE: { x: 200, y: 240 },
  },
};

const PART: CharacterPart = {
  anchor: 'leftEar',
  art: { type: 'shape', shape: 'round_ear', fill: 'primary' },
  offset: [0, 0],
  size: 0.4,
  rotation: 10,
  mirrored: false,
};

describe('toFaceGeometry', () => {
  it('takes the centre, width and screen-ordered eyes', () => {
    const face = toFaceGeometry(FACE, IDENTITY);
    expect(face.center).toEqual({ x: 200, y: 220 });
    expect(face.width).toBe(200);
    expect(face.eyes?.[0].x).toBe(150);
    expect(face.roll).toBeCloseTo(0);
  });

  it('maps through mirroring and keeps eyes ordered on screen', () => {
    const mirror: Affine = [-1, 0, 400, 0, 1, 0];
    const face = toFaceGeometry(FACE, mirror);
    expect(face.center.x).toBe(200);
    expect(face.eyes?.[0].x).toBe(150);
    expect(face.width).toBe(200);
  });

  it('measures tilt from the eyes', () => {
    const tilted = {
      ...FACE,
      landmarks: { LEFT_EYE: { x: 100, y: 100 }, RIGHT_EYE: { x: 200, y: 200 } },
    };
    expect(toFaceGeometry(tilted, IDENTITY).roll).toBeCloseTo(45);
  });
});

describe('anchors and parts', () => {
  const face = toFaceGeometry(FACE, IDENTITY);

  it('uses landmarks when available and proportions otherwise', () => {
    expect(anchorPoint(face, 'nose')).toEqual({ x: 200, y: 240 });
    const ear = anchorPoint(face, 'leftEar');
    expect(ear.x).toBeCloseTo(200 - 0.36 * 200);
    expect(ear.y).toBeCloseTo(220 - 0.5 * 200);
  });

  it('scales and tilts parts with the face', () => {
    const placement = placePart({ ...face, roll: 20 }, PART);
    expect(placement.size).toBe(80);
    expect(placement.rotation).toBe(30);
  });

  it('keeps at most four of the largest faces', () => {
    const faces = [50, 300, 120, 80, 200].map((width) => ({ ...face, width }));
    expect(primaryFaces(faces).map(({ width }) => width)).toEqual([300, 200, 120, 80]);
  });
});
