import type { Film } from '@fant/content-schema';
import {
  ClipOp,
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
} from '@shopify/react-native-skia';

import {
  primaryFaces,
  shapesFaces,
  toFaceGeometry,
  toShapedFaces,
} from '../features/character/face-geometry.worklet';
import { hasMakeup } from '../features/makeup/makeup';
import { filterSettingsFor } from '../features/photo/filter-settings';
import { coverPlacement, framedPhotoRect } from '../features/photo/frames';
import { croppedSize, fitLongEdge, type Size } from '../features/photo/geometry';
import type { PhotoRecipe } from '../features/photo/recipe';
import { recipeTransform } from '../features/photo/transform';
import { compose, scale, toMatrix3 } from './affine.worklet';
import type { CharacterDrawing } from './draw-character';
import { drawDeco, type DecoAssets } from './draw-deco';
import { drawFiltered } from './draw-filtered';
import { drawFrameBackground, drawFrameOverlay } from './draw-frame';
import { faceOverlay } from './face-overlay';
import { drawStyledText } from './draw-text';
import { filterEffects } from './filter-effects';
import { loadFilmLut } from './lut';
import { detectFacesInImage } from './still-faces';
import { makeSurface } from './surface';

/** JPEG quality for saved photos (03 §3: about 90). */
const JPEG_QUALITY = 92;

/**
 * Decodes a JPEG/PNG/HEIC. Skia applies the EXIF orientation, so the result is
 * upright; encoding later writes no metadata, so location data never leaves (SHR-05).
 */
export function decodeImage(bytes: Uint8Array): SkImage {
  const data = Skia.Data.fromBytes(bytes);
  try {
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (image === null) throw new Error('Failed to decode the image');
    return image;
  } finally {
    data.dispose();
  }
}

export function imageSize(image: SkImage): Size {
  return { width: image.width(), height: image.height() };
}

export function encodeJpeg(image: SkImage): Uint8Array {
  return image.encodeToBytes(ImageFormat.JPEG, JPEG_QUALITY);
}

export interface PhotoRenderInput {
  /** The upright original. */
  readonly image: SkImage;
  /** The original's file, to find faces for characters. */
  readonly originalUri: string | null;
  readonly recipe: PhotoRecipe;
  readonly film: Film;
  readonly character: CharacterDrawing | null;
  readonly deco: DecoAssets;
  /** Renders smaller, e.g. for the editor's live preview. */
  readonly maxLongEdge?: number;
}

/**
 * Renders a photo from its original and recipe (07 §5.2): transform, retouch,
 * characters, film, date and decorations. The capture, the editor and re-edits all
 * use this, with the same shaders as the preview. The caller disposes the result.
 */
export async function renderPhoto(input: PhotoRenderInput): Promise<SkImage> {
  const { image, recipe, film } = input;
  const lut = await loadFilmLut(film);
  const full = croppedSize(imageSize(image), recipe.transform.rotation, recipe.transform.crop);
  const size = input.maxLongEdge === undefined ? full : fitLongEdge(full, input.maxLongEdge);
  const transform = compose(
    scale(size.width / full.width, size.height / full.height),
    recipeTransform(imageSize(image), recipe.transform),
  );

  const shaping = shapesFaces(recipe.faceShape);
  const faces =
    (input.character !== null || shaping || hasMakeup(recipe.makeup)) && input.originalUri !== null
      ? primaryFaces(
          detectFacesInImage(input.originalUri).map((face) => toFaceGeometry(face, transform)),
        )
      : [];
  const { character } = input;

  const surface = makeSurface(size.width, size.height);
  const matrix = Skia.Matrix(toMatrix3(transform));
  const source = image.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Linear,
    MipmapMode.None,
    matrix,
  );
  try {
    const canvas = surface.getCanvas();
    // A frame shrinks the photo into its window; the photo is cropped, never stretched.
    const window = framedPhotoRect(recipe.frame, size);
    const placement = coverPlacement(size, window);
    drawFrameBackground(canvas, recipe.frame, size);
    canvas.save();
    canvas.clipRect(
      Skia.XYWHRect(window.x, window.y, window.width, window.height),
      ClipOp.Intersect,
      true,
    );
    canvas.translate(placement.x, placement.y);
    canvas.scale(placement.scale, placement.scale);
    drawFiltered(canvas, source, size, {
      effects: filterEffects(),
      settings: filterSettingsFor({
        film,
        intensity: recipe.film.intensity,
        seed: recipe.seed,
        beauty: recipe.beauty,
        adjust: recipe.adjust,
        dateStamp: recipe.dateStamp,
        faceShape: recipe.faceShape,
        detail: recipe.detail,
        local: recipe.local,
      }),
      faces: shaping ? toShapedFaces(faces) : undefined,
      seed: recipe.seed,
      lut,
      overlay: faceOverlay(faces, recipe.makeup, character),
    });
    canvas.restore();
    drawFrameOverlay(canvas, recipe.frame, size, window, recipe.seed);
    // Decorations cover the whole output, so the frame can be written on too.
    drawDeco(canvas, recipe.deco, size.width, size.height, input.deco);
    surface.flush();
    return surface.makeImageSnapshot();
  } finally {
    source.dispose();
    matrix.dispose();
    surface.dispose();
  }
}

/** Shrinks an encoded photo for sharing on social media (SHR-04). */
export function resizeJpeg(bytes: Uint8Array, maxLongEdge: number): Uint8Array {
  const image = decodeImage(bytes);
  try {
    const size = fitLongEdge(imageSize(image), maxLongEdge);
    if (size.width === image.width()) return bytes;
    const surface = makeSurface(size.width, size.height);
    const paint = Skia.Paint();
    try {
      paint.setAntiAlias(true);
      surface
        .getCanvas()
        .drawImageRectOptions(
          image,
          Skia.XYWHRect(0, 0, image.width(), image.height()),
          Skia.XYWHRect(0, 0, size.width, size.height),
          FilterMode.Linear,
          MipmapMode.Linear,
          paint,
        );
      surface.flush();
      const snapshot = surface.makeImageSnapshot();
      try {
        return encodeJpeg(snapshot);
      } finally {
        snapshot.dispose();
      }
    } finally {
      paint.dispose();
      surface.dispose();
    }
  } finally {
    image.dispose();
  }
}

/**
 * Marks an AI-generated image with a small visible "AI" badge (AI-06; the visible
 * mark is the part kept even if the metadata approach changes, Q-09).
 */
export function markAiGenerated(bytes: Uint8Array): {
  readonly jpeg: Uint8Array;
  readonly width: number;
  readonly height: number;
} {
  const image = decodeImage(bytes);
  const width = image.width();
  const height = image.height();
  const surface = makeSurface(width, height);
  try {
    const canvas = surface.getCanvas();
    canvas.drawImage(image, 0, 0);
    const size = Math.max(14, Math.min(width, height) * 0.035);
    drawStyledText(canvas, 'AI', 'bubble', '#555555', {
      center: { x: width - size * 1.6, y: height - size * 1.2 },
      fontSize: size,
      rotation: 0,
    });
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      return { jpeg: encodeJpeg(snapshot), width, height };
    } finally {
      snapshot.dispose();
    }
  } finally {
    surface.dispose();
    image.dispose();
  }
}
