import type { EyeOpenness } from './wink-detector';

/** The parts of a detected face this app reads; the face detector plugin's `Face` fits it. */
export interface DetectedFace {
  readonly bounds: { readonly width: number; readonly height: number };
  /** Head rotation to the left or right in degrees; 0 when facing the camera. */
  readonly yawAngle: number;
  readonly leftEyeOpenProbability?: number;
  readonly rightEyeOpenProbability?: number;
}

/**
 * Beyond this head turn ML Kit cannot see the far eye but still classifies it, usually
 * as closed, so the near eye alone looks like a wink. On a Pixel 7a, deliberate winks
 * stayed within 5° and false winks started at 35°.
 */
const MAX_YAW_DEGREES = 25;

/**
 * Eye openness of the largest (closest) face, or `null` when no face is visible, it is
 * turned too far to the side, or its eyes could not be classified. Set `swapSides` when
 * the detector's left and right are the opposite of the face's own eyes, so the result
 * is always the user's point of view. Marked as a worklet so it can run on the camera
 * frame thread.
 */
export function primaryFaceEyes(
  faces: readonly DetectedFace[],
  swapSides: boolean,
): EyeOpenness | null {
  'worklet';
  let primary: DetectedFace | null = null;
  let largestArea = 0;
  for (const face of faces) {
    const area = face.bounds.width * face.bounds.height;
    if (area > largestArea) {
      largestArea = area;
      primary = face;
    }
  }
  if (primary === null || Math.abs(primary.yawAngle) > MAX_YAW_DEGREES) return null;
  const left = primary.leftEyeOpenProbability;
  const right = primary.rightEyeOpenProbability;
  if (left === undefined || right === undefined) return null;
  return swapSides ? { left: right, right: left } : { left, right };
}
