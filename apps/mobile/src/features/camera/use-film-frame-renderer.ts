import { packUniforms, toFilmUniforms, type FilmParams } from '@fant/filters';
import {
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import type { SkiaCameraProps } from 'react-native-vision-camera-skia';

/**
 * Returns a `SkiaCamera` frame callback that draws every camera frame through
 * the shared film shader. It runs as a worklet on the camera frame thread.
 */
export function useFilmFrameRenderer(
  effect: SkRuntimeEffect,
  params: FilmParams,
  seed: number,
): SkiaCameraProps['onFrame'] {
  const paint = useMemo(() => Skia.Paint(), []);

  return (frame, render) => {
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
        paint.setShader(effect.makeShaderWithChildren(packUniforms(effect, uniforms), [source]));
        canvas.drawImage(frameTexture, 0, 0, paint);
      });
    } finally {
      frame.dispose();
    }
  };
}
