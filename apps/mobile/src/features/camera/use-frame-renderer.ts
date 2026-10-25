import { FilterMode, MipmapMode, Skia, TileMode } from '@shopify/react-native-skia';
import { useCallback } from 'react';
import type { Frame } from 'react-native-vision-camera';
import type { SkiaCameraProps } from 'react-native-vision-camera-skia';

import { makeFilterShader, type FilterEffects, type FilterParams } from './filter-pipeline.worklet';

/**
 * Returns a `SkiaCamera` frame callback that draws every camera frame through the
 * filter pipeline. It runs as a worklet on the camera frame thread.
 *
 * `analyzeFrame` (a worklet, e.g. face detection) runs after drawing, so analysis never
 * delays the preview.
 *
 * Every Skia object made for a frame is disposed before the frame is released:
 * `SkiaCamera` frees the frame's hardware buffer right after drawing, and objects
 * left to the garbage collector would keep referencing it and pile up native memory.
 */
export function useFrameRenderer(
  effects: FilterEffects,
  params: FilterParams,
  seed: number,
  analyzeFrame?: (frame: Frame) => void,
): SkiaCameraProps['onFrame'] {
  return useCallback<SkiaCameraProps['onFrame']>(
    (frame, render) => {
      'worklet';
      try {
        render(({ canvas, frameTexture }) => {
          const size = { width: frameTexture.width(), height: frameTexture.height() };
          const source = frameTexture.makeShaderOptions(
            TileMode.Clamp,
            TileMode.Clamp,
            FilterMode.Linear,
            MipmapMode.None,
          );
          const filter = makeFilterShader(effects, source, size, params, seed);
          const paint = Skia.Paint();
          try {
            paint.setShader(filter.shader);
            canvas.drawImage(frameTexture, 0, 0, paint);
          } finally {
            paint.dispose();
            filter.dispose();
            source.dispose();
          }
        });
        analyzeFrame?.(frame);
      } finally {
        frame.dispose();
      }
    },
    [effects, params, seed, analyzeFrame],
  );
}
