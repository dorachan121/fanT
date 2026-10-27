import type { BeautyParams } from '@fant/filters';

import { decodeImage, encodeJpeg, imageSize } from '../../engine/photo';
import { centerCrop } from '../photo/geometry';
import { renderRecipe } from '../photo/photo-service';
import { newRecipe } from '../photo/recipe';

/** Purikura-style correction (PRI-03): bright, white, smooth skin… */
export const PURI_BEAUTY: BeautyParams = { smoothing: 0.7, brightness: 0.55, rosiness: 0.15 };
/** …through the purikura film with its sparkle. */
export const PURI_FILM_ID = 'puri';
/** Shots are kept at this size; a sheet cell is smaller still. */
const SHOT_LONG_EDGE = 1600;

/**
 * Renders a captured shot with the puri look, cropped to its cell's shape so it
 * fills the cell exactly and scribbles land where they were drawn.
 */
export async function renderPuriShot(input: {
  readonly bytes: Uint8Array;
  readonly cellAspect: number;
  readonly mirror: boolean;
  readonly seed: number;
}): Promise<Uint8Array> {
  const image = decodeImage(input.bytes);
  try {
    const recipe = newRecipe({
      filmId: PURI_FILM_ID,
      intensity: 1,
      beauty: PURI_BEAUTY,
      dateStamp: null,
      character: null,
      seed: input.seed,
      mirror: input.mirror,
      crop: centerCrop(imageSize(image), input.cellAspect),
    });
    const rendered = await renderRecipe(image, null, recipe, { maxLongEdge: SHOT_LONG_EDGE });
    try {
      return encodeJpeg(rendered);
    } finally {
      rendered.dispose();
    }
  } finally {
    image.dispose();
  }
}
