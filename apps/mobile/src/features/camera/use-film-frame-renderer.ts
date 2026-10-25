import { packUniforms, toFilmUniforms, type FilmParams } from '@fant/filters';
import { FilterMode, MipmapMode, Skia, TileMode } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import type { SkiaCameraProps } from 'react-native-vision-camera-skia';

import { useFilmEffect } from './use-film-effect';

/**
 * Returns a `SkiaCamera` frame callback that draws every camera frame through
 * the shared film shader. It runs as a worklet on the camera frame thread.
 */
export function useFilmFrameRenderer(params: FilmParams, seed: number): SkiaCameraProps['onFrame'] {
  const effect = useFilmEffect();
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
