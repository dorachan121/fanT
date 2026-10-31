import {
  compileRuntimeEffect,
  HAIR_SHADER_NAME,
  HAIR_SHADER_SOURCE,
  packUniforms,
  toHairUniforms,
  type HairHead,
} from '@fant/filters';
import {
  BlendMode,
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  vec,
  type SkCanvas,
  type SkImage,
  type SkMatrix,
  type SkRuntimeEffect,
  type SkShader,
  type SkSurface,
} from '@shopify/react-native-skia';

import type { Backdrop } from '../features/photo/backdrops';
import type { Size } from '../features/photo/geometry';
import { focusBlurSigma, focusGradient, type FocusBlur } from '../features/retouch/focus-blur';
import { rgbOf, type Hair, type HealSpot } from '../features/retouch/retouch';
import { drawBackdrop } from './backdrop';
import { makeSurface } from './surface';

let hairEffect: SkRuntimeEffect | undefined;

function hair(): SkRuntimeEffect {
  hairEffect ??= compileRuntimeEffect(Skia.RuntimeEffect, HAIR_SHADER_NAME, HAIR_SHADER_SOURCE);
  return hairEffect;
}

export interface RetouchInput {
  readonly heal: readonly HealSpot[];
  readonly backdrop: Backdrop | null;
  readonly backgroundBlur: number;
  readonly hair: Hair;
  /** The people (alpha = person), with the matrix that maps it onto the output. */
  readonly mask: { readonly image: SkImage; readonly matrix: SkMatrix } | null;
  /** Heads in output pixels, for hair colour. */
  readonly heads: readonly HairHead[];
  /** Tilt-shift (EDT-23): blur beyond the focus; needs no mask. */
  readonly focusBlur: FocusBlur;
}

/** Whether there is anything to do before the filter chain. */
export function hasRetouch(input: RetouchInput): boolean {
  return (
    input.heal.length > 0 ||
    input.focusBlur.amount > 0 ||
    (input.mask !== null &&
      (input.backdrop !== null ||
        input.backgroundBlur > 0 ||
        (input.hair.amount > 0 && input.heads.length > 0)))
  );
}

function snapshot(surface: SkSurface): SkImage {
  surface.flush();
  return surface.makeImageSnapshot();
}

function drawImage(canvas: SkCanvas, image: SkImage, blurSigma: number): void {
  const paint = Skia.Paint();
  const blur =
    blurSigma > 0 ? Skia.ImageFilter.MakeBlur(blurSigma, blurSigma, TileMode.Clamp, null) : null;
  try {
    if (blur !== null) paint.setImageFilter(blur);
    canvas.drawImage(image, 0, 0, paint);
  } finally {
    blur?.dispose();
    paint.dispose();
  }
}

/** The person mask over the whole output (destination-in keeps only the people). */
function keepPeople(canvas: SkCanvas, mask: NonNullable<RetouchInput['mask']>): void {
  const paint = Skia.Paint();
  const shader = mask.image.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Linear,
    MipmapMode.None,
    mask.matrix,
  );
  try {
    paint.setShader(shader);
    paint.setBlendMode(BlendMode.DstIn);
    canvas.drawPaint(paint);
  } finally {
    shader.dispose();
    paint.dispose();
  }
}

/** Smooths a blemish into the skin around it: a blurred copy, faded out at the edge. */
function healSpot(canvas: SkCanvas, image: SkImage, spot: HealSpot, size: Size): void {
  const short = Math.min(size.width, size.height);
  const radius = spot.radius * short;
  const center = { x: spot.x * size.width, y: spot.y * size.height };
  const bounds = Skia.XYWHRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
  const fade = Skia.Paint();
  const gradient = Skia.Shader.MakeRadialGradient(
    vec(center.x, center.y),
    radius,
    [Skia.Color('black'), Skia.Color('black'), Skia.Color('transparent')],
    [0, 0.55, 1],
    TileMode.Clamp,
  );
  try {
    canvas.saveLayer(undefined, bounds);
    drawImage(canvas, image, radius * 0.45);
    fade.setShader(gradient);
    fade.setBlendMode(BlendMode.DstIn);
    canvas.drawRect(bounds, fade);
    canvas.restore();
  } finally {
    gradient.dispose();
    fade.dispose();
  }
}

/** A gradient that is opaque where the photo stays in focus (EDT-23). */
function focusShader(focus: FocusBlur, size: Size): SkShader {
  const gradient = focusGradient(focus, size);
  const opaque = Skia.Color('black');
  const clear = Skia.Color('transparent');
  if (gradient.kind === 'radial') {
    return Skia.Shader.MakeRadialGradient(
      vec(gradient.center.x, gradient.center.y),
      gradient.radius,
      [opaque, opaque, clear],
      [0, gradient.sharpTo, 1],
      TileMode.Clamp,
    );
  }
  return Skia.Shader.MakeLinearGradient(
    vec(gradient.from.x, gradient.from.y),
    vec(gradient.to.x, gradient.to.y),
    [clear, opaque, opaque, clear],
    [0, 0.25, 0.75, 1],
    TileMode.Clamp,
  );
}

/**
 * Prepares the photo before the filter chain, in output pixels: a new backdrop
 * (EDT-16) and background blur behind the people (EDT-11), hair colour (EDT-12),
 * blemish removal (BTY-11) and tilt-shift (EDT-23).
 * Returns a shader for the chain to draw from; the caller disposes `dispose`.
 */
export function retouchSource(
  source: SkShader,
  size: Size,
  input: RetouchInput,
): { readonly shader: SkShader; readonly dispose: () => void } {
  const surface = makeSurface(size.width, size.height);
  const canvas = surface.getCanvas();
  const images: SkImage[] = [];
  const paint = Skia.Paint();
  try {
    paint.setShader(source);
    canvas.drawRect(Skia.XYWHRect(0, 0, size.width, size.height), paint);
    const { mask } = input;

    if (mask !== null && input.backdrop !== null) {
      // The film then runs over the backdrop too, so it sits in the same light.
      const photo = snapshot(surface);
      images.push(photo);
      canvas.clear(Skia.Color('transparent'));
      drawBackdrop(canvas, input.backdrop, size.width, size.height);
      canvas.saveLayer();
      drawImage(canvas, photo, 0);
      keepPeople(canvas, mask);
      canvas.restore();
    }

    if (mask !== null && input.backgroundBlur > 0) {
      const sharp = snapshot(surface);
      images.push(sharp);
      const sigma = input.backgroundBlur * Math.min(size.width, size.height) * 0.02;
      canvas.clear(Skia.Color('transparent'));
      drawImage(canvas, sharp, sigma);
      canvas.saveLayer();
      drawImage(canvas, sharp, 0);
      keepPeople(canvas, mask);
      canvas.restore();
    }

    if (mask !== null && input.hair.amount > 0 && input.heads.length > 0) {
      const current = snapshot(surface);
      images.push(current);
      const effect = hair();
      const imageShader = current.makeShaderOptions(
        TileMode.Clamp,
        TileMode.Clamp,
        FilterMode.Linear,
        MipmapMode.None,
      );
      const personShader = mask.image.makeShaderOptions(
        TileMode.Clamp,
        TileMode.Clamp,
        FilterMode.Linear,
        MipmapMode.None,
        mask.matrix,
      );
      const uniforms = toHairUniforms(
        input.hair.amount,
        rgbOf(input.hair.color),
        input.heads,
        size,
      );
      const shader = effect.makeShaderWithChildren(packUniforms(effect, uniforms), [
        imageShader,
        personShader,
      ]);
      const hairPaint = Skia.Paint();
      try {
        hairPaint.setShader(shader);
        hairPaint.setBlendMode(BlendMode.Src);
        canvas.drawPaint(hairPaint);
      } finally {
        hairPaint.dispose();
        shader.dispose();
        personShader.dispose();
        imageShader.dispose();
      }
    }

    if (input.heal.length > 0) {
      const current = snapshot(surface);
      images.push(current);
      for (const spot of input.heal) healSpot(canvas, current, spot, size);
    }

    if (input.focusBlur.amount > 0) {
      const sharp = snapshot(surface);
      images.push(sharp);
      canvas.clear(Skia.Color('transparent'));
      drawImage(canvas, sharp, focusBlurSigma(input.focusBlur, size));
      const keep = Skia.Paint();
      const gradient = focusShader(input.focusBlur, size);
      try {
        canvas.saveLayer();
        drawImage(canvas, sharp, 0);
        keep.setShader(gradient);
        keep.setBlendMode(BlendMode.DstIn);
        canvas.drawPaint(keep);
        canvas.restore();
      } finally {
        gradient.dispose();
        keep.dispose();
      }
    }

    const result = snapshot(surface);
    const shader = result.makeShaderOptions(
      TileMode.Clamp,
      TileMode.Clamp,
      FilterMode.Linear,
      MipmapMode.None,
    );
    return {
      shader,
      dispose: () => {
        shader.dispose();
        result.dispose();
      },
    };
  } finally {
    paint.dispose();
    for (const image of images) image.dispose();
    surface.dispose();
  }
}
