import { contentIdSchema, hexColorSchema, TEXT_STAMP_STYLES } from '@fant/content-schema';
import {
  ADJUST_PARAM_RANGES,
  BEAUTY_LEVELS,
  BEAUTY_PARAM_RANGES,
  DATE_STAMP_FORMATS,
  DEFAULT_ADJUST_PARAMS,
  DEFAULT_DETAIL_PARAMS,
  DEFAULT_FACE_SHAPE_PARAMS,
  DETAIL_PARAM_RANGES,
  MAX_LOCAL_ADJUSTMENTS,
  FACE_SHAPE_PARAM_RANGES,
  type AdjustParams,
  type FaceShapeParams,
  type BeautyParams,
  type ParamRange,
} from '@fant/filters';
import { z } from 'zod';

import { FRAME_TYPES } from './frames';

/** Limits that keep a recipe small; the editor stops adding past them (DCO-*). */
export const MAX_STROKE_POINTS = 2000;
export const MAX_DECO_LAYERS = 500;

/** Numbers within each parameter's range, e.g. the beauty or adjust parameters. */
export function paramsSchema<Name extends string>(ranges: Readonly<Record<Name, ParamRange>>) {
  return z.strictObject(
    Object.fromEntries(
      Object.entries<ParamRange>(ranges).map(([name, { min, max }]) => [
        name,
        z.number().min(min).max(max),
      ]),
    ) as Record<Name, z.ZodNumber>,
  );
}

const unit = z.number().min(0).max(1);
/** Positions on the photo, as fractions of its width and height. */
const position = z.number().min(-0.5).max(1.5);

const decoStrokeSchema = z.strictObject({
  type: z.literal('stroke'),
  /** `neon` glows (DCO-01); `eraser` clears other decorations, never the photo (DCO-05). */
  tool: z.enum(['pen', 'neon', 'eraser']),
  color: hexColorSchema,
  /** Line width as a fraction of the photo's short edge. */
  width: z.number().min(0.002).max(0.2),
  /** Flattened x, y pairs in photo fractions. */
  points: z
    .array(position)
    .min(2)
    .max(MAX_STROKE_POINTS * 2)
    .refine((points) => points.length % 2 === 0),
});

const decoStampSchema = z.strictObject({
  type: z.literal('stamp'),
  stampId: contentIdSchema,
  x: position,
  y: position,
  /** Size as a fraction of the photo's short edge. */
  size: z.number().min(0.02).max(2),
  rotation: z.number().min(-360).max(360),
  /** A colour chosen for a shape or text stamp, e.g. the oshi colour (PRI-08). */
  color: hexColorSchema.optional(),
});

const decoTextSchema = z.strictObject({
  type: z.literal('text'),
  text: z.string().min(1).max(40),
  style: z.enum(TEXT_STAMP_STYLES),
  color: hexColorSchema,
  x: position,
  y: position,
  size: z.number().min(0.02).max(2),
  rotation: z.number().min(-360).max(360),
});

const decoLayerSchema = z.discriminatedUnion('type', [
  decoStrokeSchema,
  decoStampSchema,
  decoTextSchema,
]);
export type DecoLayer = z.infer<typeof decoLayerSchema>;
export type DecoStroke = z.infer<typeof decoStrokeSchema>;
export type DecoStamp = z.infer<typeof decoStampSchema>;
export type DecoText = z.infer<typeof decoTextSchema>;

export const ASPECT_RATIOS = ['3:4', '9:16', '1:1'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

const cropSchema = z
  .strictObject({ x: unit, y: unit, width: unit, height: unit })
  .refine(({ x, width }) => width > 0 && x + width <= 1 + 1e-9)
  .refine(({ y, height }) => height > 0 && y + height <= 1 + 1e-9);
export type Crop = z.infer<typeof cropSchema>;

export const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 };

const centeredUnit = z.number().min(-1).max(1);

const localAdjustmentSchema = z.strictObject({
  x: unit,
  y: unit,
  radius: z.number().min(0.02).max(1),
  feather: unit,
  brightness: centeredUnit,
  saturation: centeredUnit,
  temperature: centeredUnit,
});

export const calendarDateSchema = z.strictObject({
  year: z.number().int().min(1900).max(2099),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

const dateStampSchema = z.strictObject({
  date: calendarDateSchema,
  format: z.enum(DATE_STAMP_FORMATS),
  color: z.tuple([unit, unit, unit]).readonly(),
});

/**
 * Everything needed to render a photo again from its original (CAM-04, EDT-01/02):
 * the shot's look, the edits and the decorations. Stored as JSON with each album
 * photo and validated when read back. Face positions are never stored (03 §6); they
 * are detected again when rendering.
 */
const photoRecipeSchema = z.strictObject({
  version: z.literal(1),
  film: z.strictObject({ id: contentIdSchema, intensity: unit }),
  /** Fixes grain and light leaks so every render of this shot looks the same (FLM-06). */
  seed: z.number().min(0).max(1),
  beauty: paramsSchema(BEAUTY_PARAM_RANGES),
  adjust: paramsSchema(ADJUST_PARAM_RANGES),
  dateStamp: dateStampSchema.nullable(),
  character: z.strictObject({ id: contentIdSchema, variantId: contentIdSchema }).nullable(),
  /** Applied to the original first: quarter turns, mirroring, then the crop. */
  transform: z.strictObject({
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    mirror: z.boolean(),
    crop: cropSchema,
  }),
  deco: z.array(decoLayerSchema).max(MAX_DECO_LAYERS),
  /** Detailed adjustments (EDT-07–09); missing in older recipes. */
  detail: paramsSchema(DETAIL_PARAM_RANGES).default(DEFAULT_DETAIL_PARAMS),
  /** Local areas (EDT-10); missing in older recipes. */
  local: z.array(localAdjustmentSchema).max(MAX_LOCAL_ADJUSTMENTS).default([]),
  /** Face fine-tuning (BTY-04); recipes saved without it leave faces as they are. */
  faceShape: paramsSchema(FACE_SHAPE_PARAM_RANGES).default(DEFAULT_FACE_SHAPE_PARAMS),
  /** Added after the first release: recipes saved without it have no frame. */
  frame: z
    .strictObject({ type: z.enum(FRAME_TYPES), color: hexColorSchema })
    .nullable()
    .default(null),
});
export type PhotoRecipe = z.infer<typeof photoRecipeSchema>;
export type QuarterTurn = PhotoRecipe['transform']['rotation'];

export function newRecipe(options: {
  readonly filmId: string;
  readonly intensity: number;
  readonly beauty: BeautyParams;
  readonly dateStamp: PhotoRecipe['dateStamp'];
  readonly character: PhotoRecipe['character'];
  readonly seed: number;
  readonly mirror: boolean;
  readonly crop: Crop;
  readonly adjust?: AdjustParams;
  readonly faceShape?: FaceShapeParams;
}): PhotoRecipe {
  return {
    version: 1,
    film: { id: options.filmId, intensity: options.intensity },
    seed: options.seed,
    beauty: options.beauty,
    adjust: options.adjust ?? DEFAULT_ADJUST_PARAMS,
    dateStamp: options.dateStamp,
    character: options.character,
    transform: { rotation: 0, mirror: options.mirror, crop: options.crop },
    deco: [],
    frame: null,
    faceShape: options.faceShape ?? DEFAULT_FACE_SHAPE_PARAMS,
    detail: DEFAULT_DETAIL_PARAMS,
    local: [],
  };
}

/** A recipe that leaves the photo as it is, for imported photos and expired originals. */
export function neutralRecipe(seed: number): PhotoRecipe {
  return newRecipe({
    filmId: 'natural',
    intensity: 0,
    beauty: BEAUTY_LEVELS.off,
    dateStamp: null,
    character: null,
    seed,
    mirror: false,
    crop: FULL_CROP,
  });
}

/** Parses a stored recipe; `null` when it is missing or no longer valid. */
export function parseRecipe(json: string | null): PhotoRecipe | null {
  if (json === null) return null;
  try {
    const result = photoRecipeSchema.safeParse(JSON.parse(json));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
