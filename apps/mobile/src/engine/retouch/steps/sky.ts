import { Skia } from '@shopify/react-native-skia';

import { editsSky, skyColorMatrix } from '../../../features/sky/sky-edit';
import { drawBackdrop } from '../../backdrop';
import { drawImage, keepMasked } from '../drawing';
import type { RetouchStep } from '../types';

/** The sky alone (EDT-25): recoloured, or a new one, in a layer cut to the sky. */
export const skyStep: RetouchStep = {
  applies: ({ sky }) => sky.mask !== null && editsSky(sky.edit),
  run: ({ canvas, size, current }, { sky }) => {
    if (sky.mask === null) return;
    const photo = current();
    const layer = Skia.Paint();
    const colors = Skia.ColorFilter.MakeMatrix(skyColorMatrix(sky.edit));
    try {
      layer.setColorFilter(colors);
      canvas.saveLayer(layer);
      if (sky.backdrop === null) drawImage(canvas, photo);
      else drawBackdrop(canvas, sky.backdrop, size.width, size.height);
      keepMasked(canvas, sky.mask);
      canvas.restore();
    } finally {
      colors.dispose();
      layer.dispose();
    }
  },
};
