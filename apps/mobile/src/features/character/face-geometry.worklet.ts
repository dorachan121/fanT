import type { CharacterPart, FaceAnchor } from '@fant/content-schema';
import type { ShapedFace } from '@fant/filters';

import { apply, type Affine, type Point } from '../../engine/affine.worklet';

/** The parts of a detected face this app reads; the face detector's `Face` fits it. */
export interface DetectedFace {
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly landmarks?: {
    readonly LEFT_EYE?: Point;
    readonly RIGHT_EYE?: Point;
    readonly NOSE_BASE?: Point;
    readonly LEFT_CHEEK?: Point;
    readonly RIGHT_CHEEK?: Point;
    readonly MOUTH_LEFT?: Point;
    readonly MOUTH_RIGHT?: Point;
    readonly MOUTH_BOTTOM?: Point;
  };
}

/**
 * A face in output (screen) pixels. "Left" and "right" are as seen in the image,
 * whatever the mirroring, so content can be designed once for both cameras.
 */
export interface FaceGeometry {
  readonly center: Point;
  readonly width: number;
  /** Tilt in degrees, clockwise. */
  readonly roll: number;
  readonly eyes: readonly [Point, Point] | null;
  readonly nose: Point | null;
  readonly cheeks: readonly [Point, Point] | null;
  readonly mouth: Point | null;
}

/** Faces drawn per frame at most (BTY-05/CHR-05). */
const MAX_FACES = 4;

function sortedPair(a: Point | undefined, b: Point | undefined): readonly [Point, Point] | null {
  'worklet';
  if (a === undefined || b === undefined) return null;
  return a.x <= b.x ? [a, b] : [b, a];
}

/** Converts a detected face to output pixels with `map` (detector → output coordinates). */
export function toFaceGeometry(face: DetectedFace, map: Affine): FaceGeometry {
  'worklet';
  const { x, y, width, height } = face.bounds;
  const corner1 = apply(map, { x, y });
  const corner2 = apply(map, { x: x + width, y: y + height });
  const mapped = (point: Point | undefined) => {
    'worklet';
    return point === undefined ? undefined : apply(map, point);
  };
  const landmarks = face.landmarks ?? {};
  const eyes = sortedPair(mapped(landmarks.LEFT_EYE), mapped(landmarks.RIGHT_EYE));
  const mouthPoints = [landmarks.MOUTH_LEFT, landmarks.MOUTH_RIGHT, landmarks.MOUTH_BOTTOM]
    .map(mapped)
    .filter((point): point is Point => point !== undefined);
  const mouth =
    mouthPoints.length === 0
      ? null
      : {
          x: mouthPoints.reduce((sum, p) => sum + p.x, 0) / mouthPoints.length,
          y: mouthPoints.reduce((sum, p) => sum + p.y, 0) / mouthPoints.length,
        };
  const roll =
    eyes === null ? 0 : (Math.atan2(eyes[1].y - eyes[0].y, eyes[1].x - eyes[0].x) * 180) / Math.PI;
  return {
    center: { x: (corner1.x + corner2.x) / 2, y: (corner1.y + corner2.y) / 2 },
    width: Math.abs(corner2.x - corner1.x),
    roll,
    eyes,
    nose: mapped(landmarks.NOSE_BASE) ?? null,
    cheeks: sortedPair(mapped(landmarks.LEFT_CHEEK), mapped(landmarks.RIGHT_CHEEK)),
    mouth,
  };
}

/** Default anchor positions in face widths from the centre, before tilt. */
const ANCHOR_OFFSETS: Record<FaceAnchor, readonly [number, number]> = {
  headTop: [0, -0.62],
  leftEar: [-0.36, -0.5],
  rightEar: [0.36, -0.5],
  forehead: [0, -0.3],
  nose: [0, 0.08],
  leftCheek: [-0.27, 0.15],
  rightCheek: [0.27, 0.15],
  mouth: [0, 0.3],
  chin: [0, 0.55],
};

/** Offsets `local` (in face widths, along the face's own axes) from `origin`. */
function offsetAlongFace(
  face: FaceGeometry,
  origin: Point,
  local: readonly [number, number],
): Point {
  'worklet';
  const radians = (face.roll * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const [dx, dy] = local;
  return {
    x: origin.x + face.width * (dx * cos - dy * sin),
    y: origin.y + face.width * (dx * sin + dy * cos),
  };
}

/** Where an anchor is on this face; landmarks win over the default proportions. */
export function anchorPoint(face: FaceGeometry, anchor: FaceAnchor): Point {
  'worklet';
  if (anchor === 'nose' && face.nose !== null) return face.nose;
  if (anchor === 'leftCheek' && face.cheeks !== null) return face.cheeks[0];
  if (anchor === 'rightCheek' && face.cheeks !== null) return face.cheeks[1];
  if (anchor === 'mouth' && face.mouth !== null) return face.mouth;
  return offsetAlongFace(face, face.center, ANCHOR_OFFSETS[anchor]);
}

export interface PartPlacement {
  readonly center: Point;
  /** Edge length of the part's square, in pixels. */
  readonly size: number;
  /** Degrees, clockwise. */
  readonly rotation: number;
  readonly mirrored: boolean;
}

/** Where to draw one character part on this face (CHR-01). */
export function placePart(face: FaceGeometry, part: CharacterPart): PartPlacement {
  'worklet';
  return {
    center: offsetAlongFace(face, anchorPoint(face, part.anchor), part.offset),
    size: part.size * face.width,
    rotation: face.roll + part.rotation,
    mirrored: part.mirrored,
  };
}

/** Faces for face fine-tuning (BTY-04): only those whose eyes were found. */
export function toShapedFaces(faces: readonly FaceGeometry[]): ShapedFace[] {
  'worklet';
  const shaped: ShapedFace[] = [];
  for (const face of faces) {
    if (face.eyes === null) continue;
    shaped.push({
      leftEye: [face.eyes[0].x, face.eyes[0].y],
      rightEye: [face.eyes[1].x, face.eyes[1].y],
      center: [face.center.x, face.center.y],
      width: face.width,
    });
  }
  return shaped;
}

/** Whether face fine-tuning changes anything (and so needs faces). */
export function shapesFaces(params: Readonly<Record<string, number>>): boolean {
  'worklet';
  for (const key in params) {
    if (params[key] !== 0) return true;
  }
  return false;
}

/** The largest faces first, at most `MAX_FACES` (people in the background are skipped). */
export function primaryFaces(faces: readonly FaceGeometry[]): FaceGeometry[] {
  'worklet';
  return [...faces].sort((a, b) => b.width - a.width).slice(0, MAX_FACES);
}
