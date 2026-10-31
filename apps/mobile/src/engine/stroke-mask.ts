import type { SkCanvas } from '@shopify/react-native-skia';

import type { Size } from '../features/photo/geometry';
import type { DecoStroke } from '../features/photo/recipe';
import { drawDeco, NO_DECO_ASSETS } from './draw-deco';

/**
 * Painted strokes in white over a `size` canvas: the area to erase (AI-10) or to
 * adjust with the brush (EDT-35). Pen strokes whatever tool drew them.
 */
export function drawStrokeMask(canvas: SkCanvas, strokes: readonly DecoStroke[], size: Size): void {
  drawDeco(
    canvas,
    strokes.map((stroke) => ({ ...stroke, tool: 'pen' as const, color: '#ffffff' })),
    size.width,
    size.height,
    NO_DECO_ASSETS,
  );
}
