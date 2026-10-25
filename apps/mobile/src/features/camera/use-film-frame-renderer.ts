import { packUniforms, toFilmUniforms, type FilmParams } from '@fant/filters';
import {
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';
import { useCallback } from 'react';
import type { SkiaCameraProps } from 'react-native-vision-camera-skia';

/**
 * Returns a `SkiaCamera` frame callback that draws every camera frame through
 * the shared film shader. It runs as a worklet on the camera frame thread.
 *
 * Every Skia object made for a frame is disposed before the frame is released:
 * `SkiaCamera` frees the frame's hardware buffer right after drawing, and objects
 * left to the garbage collector would keep referencing it and pile up native memory.
 */
export function useFilmFrameRenderer(
  effect: SkRuntimeEffect,
  params: FilmParams,
  seed: number,
): SkiaCameraProps['onFrame'] {
  return useCallback<SkiaCameraProps['onFrame']>(
    (frame, render) => {
      'worklet';
      try {
        render(({ canvas, frameTexture }) => {
          const uniforms = toFilmUniforms(params, {
            width: frameTexture.width(),
            height: frameTexture.height(),
            seed,
          });
          const source = frameTexture.makeShaderOptions(
            TileMode.Clamp,
            TileMode.Clamp,
            FilterMode.Linear,
            MipmapMode.None,
          );
          const shader = effect.makeShaderWithChildren(packUniforms(effect, uniforms), [source]);
          const paint = Skia.Paint();
          try {
            paint.setShader(shader);
            canvas.drawImage(frameTexture, 0, 0, paint);
          } finally {
            paint.dispose();
            shader.dispose();
            source.dispose();
          }
        });
      } finally {
        frame.dispose();
      }
    },
    [effect, params, seed],
  );
}
