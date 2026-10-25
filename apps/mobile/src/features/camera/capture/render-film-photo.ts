import { packUniforms, toFilmUniforms, type FilmParams } from '@fant/filters';
import {
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  TileMode,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';

const JPEG_QUALITY = 92;

/**
 * Re-renders a captured photo through the film shader at full resolution and returns
 * it as JPEG, using the same parameters and seed as the live preview.
 *
 * Skia applies the EXIF orientation while decoding and writes no metadata when
 * encoding, so the result is upright and never carries location data.
 */
export function renderFilmPhoto(
  encodedPhoto: Uint8Array,
  effect: SkRuntimeEffect,
  params: FilmParams,
  seed: number,
): Uint8Array {
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(encodedPhoto));
  if (image === null) throw new Error('Failed to decode the captured photo');

  const width = image.width();
  const height = image.height();
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
  if (surface === null) {
    image.dispose();
    throw new Error(`Failed to allocate a ${String(width)}x${String(height)} surface`);
  }

  try {
    const source = image.makeShaderOptions(
      TileMode.Clamp,
      TileMode.Clamp,
      FilterMode.Linear,
      MipmapMode.None,
    );
    const uniforms = toFilmUniforms(params, { width, height, seed });
    const paint = Skia.Paint();
    paint.setShader(effect.makeShaderWithChildren(packUniforms(effect, uniforms), [source]));
    surface.getCanvas().drawPaint(paint);
    surface.flush();

    const rendered = surface.makeImageSnapshot();
    try {
      return rendered.encodeToBytes(ImageFormat.JPEG, JPEG_QUALITY);
    } finally {
      rendered.dispose();
    }
  } finally {
    surface.dispose();
    image.dispose();
  }
}
