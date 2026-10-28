import { BlendMode, Skia } from '@shopify/react-native-skia';

import type { Backdrop } from '../features/puri/backdrops';
import { drawPattern } from './draw-pattern';
import { decodeImageFile } from './images';
import { decodeImage, encodeJpeg } from './photo';
import { makeSurface } from './surface';

/**
 * Puts the people of a photo on a new background (PRI-04): the backdrop, then the
 * photo masked by the person mask (alpha = person), stretched to the photo's size.
 * Returns an upright JPEG to render like any other shot.
 */
export async function replaceBackground(
  photo: Uint8Array,
  maskUri: string,
  backdrop: Backdrop,
): Promise<Uint8Array> {
  const image = decodeImage(photo);
  const mask = await decodeImageFile(maskUri);
  const width = image.width();
  const height = image.height();
  const surface = makeSurface(width, height);
  const paint = Skia.Paint();
  const maskPaint = Skia.Paint();
  try {
    const canvas = surface.getCanvas();
    const bounds = Skia.XYWHRect(0, 0, width, height);
    paint.setColor(Skia.Color(backdrop.color));
    canvas.drawRect(bounds, paint);
    drawPattern(canvas, backdrop.pattern, backdrop.patternColor, width, height);

    // The person, cut out in a layer of their own so the mask only affects them.
    canvas.saveLayer(undefined, bounds);
    canvas.drawImage(image, 0, 0);
    maskPaint.setBlendMode(BlendMode.DstIn);
    canvas.drawImageRect(mask, Skia.XYWHRect(0, 0, mask.width(), mask.height()), bounds, maskPaint);
    canvas.restore();
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      return encodeJpeg(snapshot);
    } finally {
      snapshot.dispose();
    }
  } finally {
    paint.dispose();
    maskPaint.dispose();
    surface.dispose();
    mask.dispose();
    image.dispose();
  }
}
