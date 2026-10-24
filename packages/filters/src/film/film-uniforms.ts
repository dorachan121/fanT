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

export function toFilmUniforms(params: FilmParams, frame: FilmFrame): FilmUniforms {
  const { width, height, seed } = frame;
  if (!isPositiveFinite(width) || !isPositiveFinite(height)) {
    throw new RangeError(`Invalid frame size: ${String(width)}x${String(height)}`);
  }
  if (!Number.isFinite(seed)) {
    throw new RangeError(`Invalid seed: ${String(seed)}`);
  }
  return { ...params, resolution: [width, height], seed };
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
