import type { FilmParams } from './film-params';

/** Per-frame values that are not part of a film definition. */
export interface FilmFrame {
  /** Output size in pixels. */
  readonly width: number;
  readonly height: number;
  /** Random seed fixed at shutter time so the saved photo matches the preview. */
  readonly seed: number;
}

/** Uniform values keyed exactly as declared in the film shader. */
export type FilmUniforms = FilmParams & {
  readonly resolution: readonly [number, number];
  readonly seed: number;
};

/**
 * Declared before its caller: the worklets Babel plugin turns worklet function
 * declarations into variables that are not hoisted, and a worklet captures its
 * helpers when the module loads. A helper declared below would be captured as
 * `undefined` and throw on the camera frame thread.
 */
function isPositiveFinite(value: number): boolean {
  'worklet';
  return Number.isFinite(value) && value > 0;
}

/** Marked as a worklet so it can run on the camera frame thread. */
export function toFilmUniforms(params: FilmParams, frame: FilmFrame): FilmUniforms {
  'worklet';
  const { width, height, seed } = frame;
  if (!isPositiveFinite(width) || !isPositiveFinite(height)) {
    throw new RangeError(`Invalid frame size: ${String(width)}x${String(height)}`);
  }
  if (!Number.isFinite(seed)) {
    throw new RangeError(`Invalid seed: ${String(seed)}`);
  }
  return { ...params, resolution: [width, height], seed };
}
