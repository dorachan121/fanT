import { assertFrameSize } from '../frame';
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

/** Marked as a worklet so it can run on the camera frame thread. */
export function toFilmUniforms(params: FilmParams, frame: FilmFrame): FilmUniforms {
  'worklet';
  const { width, height, seed } = frame;
  assertFrameSize(width, height);
  if (!Number.isFinite(seed)) {
    throw new RangeError(`Invalid seed: ${String(seed)}`);
  }
  return { ...params, resolution: [width, height], seed };
}
