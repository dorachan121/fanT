/**
 * Throws unless the size is usable as a shader resolution.
 * Marked as a worklet so it can run on the camera frame thread.
 */
export function assertFrameSize(width: number, height: number): void {
  'worklet';
  const valid = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
  if (!valid) {
    throw new RangeError(`Invalid frame size: ${String(width)}x${String(height)}`);
  }
}
