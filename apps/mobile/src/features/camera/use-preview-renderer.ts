import { useMemo } from 'react';

import type { FaceTracking } from '../../engine/face-tracking';
import { filterEffects } from '../../engine/filter-effects';
import { useFrameRenderer } from '../../engine/frame-renderer';
import { useAdaptiveQuality } from '../performance/adaptive-quality';
import { useFrameStats } from '../../engine/use-frame-stats';
import type { CameraLook } from './use-camera-look';

/**
 * The live preview's frame callback for a look: the shared filter chain, the
 * tracked character (if any), and a quality that drops automatically when the
 * device cannot keep 24 fps (03 §2). Also returns the frame statistics (P-1).
 */
export function usePreviewRenderer({
  look,
  seed,
  tracking,
  showCharacter,
}: {
  readonly look: CameraLook;
  readonly seed: number;
  readonly tracking: FaceTracking;
  readonly showCharacter: boolean;
}) {
  const frameStats = useFrameStats();
  const quality = useAdaptiveQuality(frameStats.stats);
  const inputs = useMemo(
    () => ({ effects: filterEffects(), settings: look.settings, seed, lut: look.lut, quality }),
    [look.settings, seed, look.lut, quality],
  );
  const onFrame = useFrameRenderer({
    inputs,
    character: showCharacter ? look.characterDrawing : null,
    faces: tracking.faces,
    analyze: tracking.analyze,
    // Measured once a second on the camera thread: cheap enough to keep on.
    recordStats: frameStats.record,
  });
  return { onFrame, stats: frameStats.stats };
}
