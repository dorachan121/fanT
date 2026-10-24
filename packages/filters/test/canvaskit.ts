import { createRequire } from 'node:module';

import CanvasKitInit, { type CanvasKit, type RuntimeEffect } from 'canvaskit-wasm';

/** Unpremultiplied RGBA8 pixels in row-major order. */
export interface Bitmap {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}

type Rgba = readonly [number, number, number, number];
type UniformValues = Readonly<Record<string, number | readonly number[]>>;

const require = createRequire(import.meta.url);
let canvasKit: Promise<CanvasKit> | undefined;

/** Loads the CanvasKit WebAssembly build once per test worker. */
export function loadCanvasKit(): Promise<CanvasKit> {
  canvasKit ??= CanvasKitInit({
    locateFile: (file) => require.resolve(`canvaskit-wasm/bin/${file}`),
  });
  return canvasKit;
}

export function createBitmap(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => Rgba,
): Bitmap {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.set(colorAt(x, y), (y * width + x) * 4);
    }
  }
  return { width, height, pixels };
}

export function pixelAt(bitmap: Bitmap, x: number, y: number): Rgba {
  const offset = (y * bitmap.width + x) * 4;
  const [r = 0, g = 0, b = 0, a = 0] = bitmap.pixels.subarray(offset, offset + 4);
  return [r, g, b, a];
}

export function uniformNames(effect: RuntimeEffect): string[] {
  return Array.from({ length: effect.getUniformCount() }, (_, i) => effect.getUniformName(i));
}

/** Draws `input` through `effect` (as its single child shader) on a CPU surface. */
export function renderEffect(
  ck: CanvasKit,
  effect: RuntimeEffect,
  uniforms: UniformValues,
  input: Bitmap,
): Bitmap {
  const { width, height } = input;
  const info = {
    width,
    height,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  };
  const disposables: { delete(): void }[] = [];
  const track = <T extends { delete(): void }>(object: T | null, what: string): T => {
    if (object === null) throw new Error(`CanvasKit failed to create ${what}`);
    disposables.push(object);
    return object;
  };

  try {
    const image = track(ck.MakeImage(info, input.pixels, width * 4), 'image');
    const surface = track(ck.MakeSurface(width, height), 'surface');
    const imageShader = track(
      image.makeShaderOptions(
        ck.TileMode.Clamp,
        ck.TileMode.Clamp,
        ck.FilterMode.Nearest,
        ck.MipmapMode.None,
      ),
      'image shader',
    );
    const shader = track(
      effect.makeShaderWithChildren(packUniforms(effect, uniforms), [imageShader]),
      'effect shader',
    );
    const paint = track(new ck.Paint(), 'paint');
    paint.setShader(shader);
    surface.getCanvas().drawPaint(paint);

    const snapshot = track(surface.makeImageSnapshot(), 'snapshot');
    const pixels = snapshot.readPixels(0, 0, info);
    if (!(pixels instanceof Uint8Array)) throw new Error('CanvasKit failed to read pixels');
    return { width, height, pixels };
  } finally {
    disposables.reverse().forEach((object) => {
      object.delete();
    });
  }
}

function packUniforms(effect: RuntimeEffect, uniforms: UniformValues): Float32Array {
  const packed = new Float32Array(effect.getUniformFloatCount());
  for (const [index, name] of uniformNames(effect).entries()) {
    const value = uniforms[name];
    if (value === undefined) throw new Error(`Missing value for uniform "${name}"`);
    const values = typeof value === 'number' ? [value] : value;
    const { slot, columns, rows } = effect.getUniform(index);
    if (values.length !== columns * rows) {
      throw new Error(`Uniform "${name}" expects ${String(columns * rows)} floats`);
    }
    packed.set(values, slot);
  }
  return packed;
}
