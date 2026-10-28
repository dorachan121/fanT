import type { CharacterShape, StampShape } from '@fant/content-schema';

/**
 * Vector art for characters and stamps, as SVG paths in a 100×100 box. Each shape
 * has a main path filled (or stroked) with the chosen colour and an optional
 * inner detail drawn in white at partial opacity.
 */
export interface ShapeArt {
  readonly path: string;
  readonly stroke?: number;
  readonly blur?: number;
  readonly detail?: string;
}

const HEART =
  'M50 88 C20 65 5 48 5 30 C5 15 17 5 30 5 C40 5 47 11 50 18 C53 11 60 5 70 5 C83 5 95 15 95 30 C95 48 80 65 50 88Z';
const STAR = 'M50 5 L61 38 L95 38 L67 58 L78 92 L50 71 L22 92 L33 58 L5 38 L39 38Z';
const SPARKLE =
  'M50 0 C53 35 65 47 100 50 C65 53 53 65 50 100 C47 65 35 53 0 50 C35 47 47 35 50 0Z';
const RIBBON =
  'M50 50 L12 22 C2 16 2 84 12 78 Z M50 50 L88 22 C98 16 98 84 88 78 Z M42 41 H58 V59 H42 Z';

export const CHARACTER_SHAPE_ART: Record<CharacterShape, ShapeArt> = {
  round_ear: {
    path: 'M50 5 C75 5 95 25 95 50 C95 75 75 95 50 95 C25 95 5 75 5 50 C5 25 25 5 50 5Z',
    detail: 'M50 30 C64 30 72 42 72 55 C72 68 62 76 50 76 C38 76 28 68 28 55 C28 42 36 30 50 30Z',
  },
  pointed_ear: { path: 'M12 95 L45 8 Q50 0 55 8 L88 95 Z', detail: 'M30 88 L50 35 L70 88 Z' },
  long_ear: {
    path: 'M50 0 C78 0 82 100 50 100 C18 100 22 0 50 0Z',
    detail: 'M50 14 C64 14 66 88 50 88 C34 88 36 14 50 14Z',
  },
  floppy_ear: { path: 'M30 5 C70 0 95 40 85 85 C80 100 55 100 45 85 C30 65 10 30 30 5Z' },
  bear_nose: {
    path: 'M50 30 C75 30 85 45 85 55 C85 70 65 75 50 75 C35 75 15 70 15 55 C15 45 25 30 50 30Z',
    detail: 'M38 40 C44 37 52 37 56 41 C50 46 42 46 38 40Z',
  },
  cat_nose: { path: 'M28 35 L72 35 Q75 38 53 64 Q50 67 47 64 Q25 38 28 35Z' },
  dog_nose: {
    path: 'M50 25 C80 25 90 40 85 55 C80 70 60 75 50 75 C40 75 20 70 15 55 C10 40 20 25 50 25Z',
    detail: 'M36 36 C44 32 54 32 60 37 C52 43 42 43 36 36Z',
  },
  whiskers: { path: 'M95 40 L5 25 M95 50 L5 50 M95 60 L5 75', stroke: 3 },
  blush: {
    path: 'M50 30 C80 30 95 40 95 50 C95 60 80 70 50 70 C20 70 5 60 5 50 C5 40 20 30 50 30Z',
    blur: 6,
  },
  heart: { path: HEART },
  star: { path: STAR },
  ribbon: { path: RIBBON },
  sparkle: { path: SPARKLE },
};

export const STAMP_SHAPE_ART: Record<StampShape, ShapeArt> = {
  heart: { path: HEART, detail: 'M28 18 C22 20 18 26 19 32 C24 28 28 24 34 22 Z' },
  star: { path: STAR },
  sparkle: { path: SPARKLE },
  crown: {
    path: 'M10 82 L10 30 L30 55 L50 18 L70 55 L90 30 L90 82 Z',
    detail: 'M18 70 H82 V76 H18 Z',
  },
  ribbon: { path: RIBBON },
  flower: {
    path: 'M50 20 C60 0 80 10 70 30 C90 25 95 50 75 55 C90 70 70 90 60 75 C55 95 35 95 35 75 C20 90 5 70 22 58 C0 50 10 25 30 32 C20 12 40 0 50 20Z',
    detail: 'M50 40 C56 40 60 44 60 50 C60 56 56 60 50 60 C44 60 40 56 40 50 C40 44 44 40 50 40Z',
  },
  music: {
    path: 'M60 10 L60 70 C60 82 48 90 38 88 C26 86 24 72 34 66 C42 61 52 63 55 66 L55 20 L85 12 L85 25 L60 32Z',
  },
};
