import { z } from 'zod';

const centered = z.number().min(-1).max(1).default(0);

/**
 * Changes to the sky alone (EDT-25), found on the device: its brightness, colour
 * and warmth, or a new sky (a scenery backdrop) in its place.
 */
export const skyEditSchema = z.strictObject({
  brightness: centered,
  saturation: centered,
  warmth: centered,
  /** A backdrop ID from `BACKDROPS` to put in place of the sky, or `null`. */
  backdrop: z.string().max(32).nullable().default(null),
});
export type SkyEdit = z.infer<typeof skyEditSchema>;

export const NO_SKY_EDIT: SkyEdit = skyEditSchema.parse({});

export function editsSky(edit: SkyEdit): boolean {
  return (
    edit.brightness !== 0 || edit.saturation !== 0 || edit.warmth !== 0 || edit.backdrop !== null
  );
}

const LUMA = [0.2126, 0.7152, 0.0722] as const;

/**
 * The sky's colour change as a 4×5 colour matrix (rows R, G, B, A; no offsets):
 * saturation around the luma, then warmth and brightness as channel gains.
 */
export function skyColorMatrix(edit: SkyEdit): number[] {
  const s = 1 + edit.saturation;
  const gain = 2 ** (edit.brightness * 0.8);
  const gains = [gain * (1 + edit.warmth * 0.12), gain, gain * (1 - edit.warmth * 0.12)];
  const rows = [0, 1, 2].map((row) => [
    ...LUMA.map(
      (weight, column) => ((row === column ? s : 0) + weight * (1 - s)) * (gains[row] ?? 1),
    ),
    0,
    0,
  ]);
  return [...rows.flat(), 0, 0, 0, 1, 0];
}
