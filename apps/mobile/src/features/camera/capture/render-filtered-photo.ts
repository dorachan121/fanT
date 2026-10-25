import { FilterMode, ImageFormat, MipmapMode, Skia, TileMode } from '@shopify/react-native-skia';

import {
  makeFilterShader,
  type FilterEffects,
  type FilterParams,
} from '../filter-pipeline.worklet';

const JPEG_QUALITY = 92;

interface SkiaObject {
  dispose(): void;
}

export interface RenderOptions {
  /** Flip horizontally, e.g. to match a mirrored front-camera preview. */
  readonly mirror: boolean;
}

/**
 * Re-renders a captured photo through the filter pipeline at full resolution and
 * returns it as JPEG, using the same parameters and seed as the live preview.
 *
 * Skia applies the EXIF orientation while decoding and writes no metadata when
 * encoding, so the result is upright and never carries location data.
 *
 * Every Skia object is disposed before returning: a full-resolution photo holds tens
 * of megabytes of native memory that the JS garbage collector does not account for.
 */
export function renderFilteredPhoto(
  encodedPhoto: Uint8Array,
  effects: FilterEffects,
  params: FilterParams,
  seed: number,
  { mirror }: RenderOptions,
): Uint8Array {
  const owned: SkiaObject[] = [];
  const own = <T extends SkiaObject>(object: T): T => {
    owned.push(object);
    return object;
  };

  try {
    const data = own(Skia.Data.fromBytes(encodedPhoto));
    const decoded = Skia.Image.MakeImageFromEncoded(data);
    if (decoded === null) throw new Error('Failed to decode the captured photo');
    const image = own(decoded);

    const width = image.width();
    const height = image.height();
    const created = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
    if (created === null) {
      throw new Error(`Failed to allocate a ${String(width)}x${String(height)} surface`);
    }
    const surface = own(created);

    const source = own(
      image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None),
    );
    const filter = own(makeFilterShader(effects, source, { width, height }, params, seed));
    const paint = own(Skia.Paint());
    paint.setShader(filter.shader);
    const canvas = surface.getCanvas();
    if (mirror) {
      canvas.translate(width, 0);
      canvas.scale(-1, 1);
    }
    canvas.drawPaint(paint);
    surface.flush();

    const rendered = own(surface.makeImageSnapshot());
    return rendered.encodeToBytes(ImageFormat.JPEG, JPEG_QUALITY);
  } finally {
    for (const object of owned.reverse()) object.dispose();
  }
}
