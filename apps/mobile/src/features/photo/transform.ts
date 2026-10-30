import { compose, rotateAround, scale, translate, type Affine } from '../../engine/affine.worklet';
import { rotatedSize, type Size } from './geometry';
import type { PhotoRecipe } from './recipe';

/**
 * How much a `size` image turned by `degrees` must grow to cover its own frame, so
 * straightening never shows empty corners.
 */
export function straightenZoom(size: Size, degrees: number): number {
  const radians = (Math.abs(degrees) * Math.PI) / 180;
  const longOverShort = Math.max(size.width, size.height) / Math.min(size.width, size.height);
  return Math.cos(radians) + Math.sin(radians) * longOverShort;
}

/** Turns an image of `size` around its centre and zooms in to fill its frame. */
function straightenAffine(size: Size, degrees: number): Affine {
  if (degrees === 0) return [1, 0, 0, 0, 1, 0];
  const center = { x: size.width / 2, y: size.height / 2 };
  const zoom = straightenZoom(size, degrees);
  return compose(
    rotateAround(degrees, center),
    compose(
      translate(center.x, center.y),
      compose(scale(zoom, zoom), translate(-center.x, -center.y)),
    ),
  );
}

/**
 * Maps pixels of the original (upright) photo to pixels of the output: mirror,
 * then quarter turns clockwise, straightening, then the crop. The renderer draws
 * with it and face positions found on the original are mapped through it.
 */
export function recipeTransform(original: Size, transform: PhotoRecipe['transform']): Affine {
  const { width, height } = original;
  const mirror: Affine = transform.mirror ? [-1, 0, width, 0, 1, 0] : [1, 0, 0, 0, 1, 0];
  const rotations: Record<PhotoRecipe['transform']['rotation'], Affine> = {
    0: [1, 0, 0, 0, 1, 0],
    90: [0, -1, height, 1, 0, 0],
    180: [-1, 0, width, 0, -1, height],
    270: [0, 1, 0, -1, 0, width],
  };
  const turned = rotatedSize(original, transform.rotation);
  const crop = translate(-transform.crop.x * turned.width, -transform.crop.y * turned.height);
  return compose(
    crop,
    compose(
      straightenAffine(turned, transform.straighten),
      compose(rotations[transform.rotation], mirror),
    ),
  );
}
