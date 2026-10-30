import {
  AlphaType,
  ColorType,
  FilterMode,
  MipmapMode,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';

import { makeSurface } from './surface';

/**
 * The image shrunk to fit `maxEdge` as unpremultiplied RGBA8, for statistics such
 * as auto adjustment (EDT-19). Small on purpose: reading pixels back is slow.
 */
export function samplePixels(image: SkImage, maxEdge = 64): Uint8Array {
  const scale = Math.min(1, maxEdge / Math.max(image.width(), image.height()));
  const width = Math.max(1, Math.round(image.width() * scale));
  const height = Math.max(1, Math.round(image.height() * scale));
  const surface = makeSurface(width, height);
  const paint = Skia.Paint();
  try {
    surface
      .getCanvas()
      .drawImageRectOptions(
        image,
        Skia.XYWHRect(0, 0, image.width(), image.height()),
        Skia.XYWHRect(0, 0, width, height),
        FilterMode.Linear,
        MipmapMode.Linear,
        paint,
      );
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      const pixels = snapshot.readPixels(0, 0, {
        width,
        height,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      });
      if (!(pixels instanceof Uint8Array)) throw new Error('Failed to read the image');
      return pixels;
    } finally {
      snapshot.dispose();
    }
  } finally {
    paint.dispose();
    surface.dispose();
  }
}
