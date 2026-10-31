import { FilterMode, MipmapMode, Skia, TileMode } from '@shopify/react-native-skia';

import { changesTone } from '../../../features/selection/area-tone';
import { drawStrokeMask } from '../../stroke-mask';
import { makeSurface } from '../../surface';
import { keepWhere } from '../drawing';
import type { RetouchStep } from '../types';
import { toneLayer } from './selective';

/** Soft edge of a painted area, as a fraction of the photo's short edge. */
const FEATHER = 0.008;

/** The area painted with the adjustment brush, toned on its own (EDT-35). */
export const brushStep: RetouchStep = {
  applies: ({ brush }) => brush.strokes.length > 0 && changesTone(brush.tone),
  run: ({ canvas, size, current }, { brush }) => {
    const maskSurface = makeSurface(size.width, size.height);
    const soften = Skia.Paint();
    const sigma = Math.min(size.width, size.height) * FEATHER;
    const blur = Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Decal, null);
    try {
      // The strokes, blurred so the change fades out at the edge of the painting.
      soften.setImageFilter(blur);
      const maskCanvas = maskSurface.getCanvas();
      maskCanvas.saveLayer(soften);
      drawStrokeMask(maskCanvas, brush.strokes, size);
      maskCanvas.restore();
      maskSurface.flush();
      const painted = maskSurface.makeImageSnapshot();
      const shader = painted.makeShaderOptions(
        TileMode.Decal,
        TileMode.Decal,
        FilterMode.Linear,
        MipmapMode.None,
      );
      try {
        toneLayer(canvas, current(), brush.tone, () => {
          keepWhere(canvas, shader);
        });
      } finally {
        shader.dispose();
        painted.dispose();
      }
    } finally {
      blur.dispose();
      soften.dispose();
      maskSurface.dispose();
    }
  },
};
