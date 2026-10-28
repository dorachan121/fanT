import { z } from 'zod';

import {
  assetRefSchema,
  contentItemBase,
  contentIdSchema,
  hexColorSchema,
  localizedTextSchema,
} from './common';

/**
 * Where a part sits on the face. The app derives each point from the face detector's
 * landmarks and the face's size and tilt, so parts follow the face (CHR-01).
 */
export const FACE_ANCHORS = [
  'headTop',
  'leftEar',
  'rightEar',
  'forehead',
  'nose',
  'leftCheek',
  'rightCheek',
  'mouth',
  'chin',
] as const;
export type FaceAnchor = (typeof FACE_ANCHORS)[number];

/** Vector shapes drawn by the app; new shapes need an app update, new images do not. */
export const CHARACTER_SHAPES = [
  'round_ear',
  'pointed_ear',
  'long_ear',
  'floppy_ear',
  'bear_nose',
  'cat_nose',
  'dog_nose',
  'whiskers',
  'blush',
  'heart',
  'star',
  'ribbon',
  'sparkle',
] as const;
export type CharacterShape = (typeof CHARACTER_SHAPES)[number];

/** Which colour of the selected variant a shape is filled with (CHR-03). */
export const colorRoleSchema = z.enum(['primary', 'secondary', 'accent']);
export type ColorRole = z.infer<typeof colorRoleSchema>;

const partArtSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('shape'),
    shape: z.enum(CHARACTER_SHAPES),
    fill: colorRoleSchema,
  }),
  z.strictObject({ type: z.literal('image'), image: assetRefSchema }),
]);

/** One sticker on the face. Sizes and offsets are in face widths, so they scale with the face. */
const characterPartSchema = z.strictObject({
  anchor: z.enum(FACE_ANCHORS),
  art: partArtSchema,
  offset: z.tuple([z.number().min(-2).max(2), z.number().min(-2).max(2)]),
  size: z.number().min(0.02).max(2),
  rotation: z.number().min(-180).max(180),
  mirrored: z.boolean(),
});
export type CharacterPart = z.infer<typeof characterPartSchema>;

const characterVariantSchema = z.strictObject({
  id: contentIdSchema,
  name: localizedTextSchema,
  colors: z.strictObject({
    primary: hexColorSchema,
    secondary: hexColorSchema,
    accent: hexColorSchema,
  }),
});
export type CharacterVariant = z.infer<typeof characterVariantSchema>;

/** A face-tracked 2D character (CHR-01/02) with colour variants (CHR-03). */
export const characterSchema = z
  .strictObject({
    ...contentItemBase,
    parts: z.array(characterPartSchema).min(1).max(16),
    variants: z.array(characterVariantSchema).min(1).max(8),
  })
  .refine(
    ({ variants }) => new Set(variants.map(({ id }) => id)).size === variants.length,
    'Variant IDs must be unique',
  );
export type Character = z.infer<typeof characterSchema>;
