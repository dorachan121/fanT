import { compose, translate, type Affine } from '../../engine/affine.worklet';
import { rotatedSize, type Size } from './geometry';
import type { PhotoRecipe } from './recipe';

/**
 * Maps pixels of the original (upright) photo to pixels of the output: mirror,
 * then quarter turns clockwise, then the crop. The renderer draws with it and face
 * positions found on the original are mapped through it.
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
  return compose(crop, compose(rotations[transform.rotation], mirror));
}
