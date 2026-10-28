import { ImageFormat, Skia } from '@shopify/react-native-skia';

import type { Size } from '../features/photo/geometry';
import type { DecoStroke } from '../features/photo/recipe';
import { drawDeco } from './draw-deco';
import { makeSurface } from './surface';

const NO_ASSETS = { stamps: new Map(), images: {} } as const;

/**
 * The erase tool's mask (AI-10): the painted strokes in white on black, at the size
 * of the uploaded photo, as a PNG.
 */
export function encodeEraseMask(strokes: readonly DecoStroke[], size: Size): Uint8Array {
  const surface = makeSurface(size.width, size.height);
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('#000000'));
    drawDeco(
      canvas,
      strokes.map((stroke) => ({ ...stroke, tool: 'pen' as const, color: '#ffffff' })),
      size.width,
      size.height,
      NO_ASSETS,
    );
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      return snapshot.encodeToBytes(ImageFormat.PNG, 100);
    } finally {
      snapshot.dispose();
    }
  } finally {
    surface.dispose();
  }
}
