import {
  BEAUTY_PARAM_RANGES,
  DATE_STAMP_FORMATS,
  DEFAULT_BEAUTY_PARAMS,
  type BeautyParams,
  type DateStampFormat,
} from '@fant/filters';
import { z } from 'zod';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistValidated } from '../../lib/kv-storage';
import { ASPECT_RATIOS } from '../photo/recipe';

export const CAMERA_MODES = ['film', 'character', 'puri', 'ai'] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];

export const FLASH_MODES = ['off', 'on', 'auto'] as const;
export type FlashMode = (typeof FLASH_MODES)[number];

export const TIMER_SECONDS = [0, 3, 10] as const;
export type TimerSeconds = (typeof TIMER_SECONDS)[number];

const beautySchema = z.object(
  Object.fromEntries(
    Object.entries(BEAUTY_PARAM_RANGES).map(([name, { min, max }]) => [
      name,
      z.number().min(min).max(max),
    ]),
  ) as Record<keyof BeautyParams, z.ZodNumber>,
);

const cameraSchema = z.object({
  mode: z.enum(CAMERA_MODES),
  lens: z.enum(['front', 'back']),
  aspect: z.enum(ASPECT_RATIOS),
  flash: z.enum(FLASH_MODES),
  timer: z.union([z.literal(0), z.literal(3), z.literal(10)]),
  grid: z.boolean(),
  filmId: z.string(),
  /** Strength per film (FLM-05), remembered separately for each. */
  filmIntensity: z.record(z.string(), z.number().min(0).max(1)),
  favoriteFilms: z.array(z.string()).max(100),
  /** Remembered between launches (BTY-06). */
  beauty: beautySchema,
  dateStamp: z.object({
    enabled: z.boolean(),
    format: z.enum(DATE_STAMP_FORMATS),
    /** A fixed date instead of today (FLM-04), e.g. to recreate an old photo. */
    customDate: z
      .object({ year: z.number().int(), month: z.number().int(), day: z.number().int() })
      .nullable(),
  }),
  characterId: z.string(),
  /** Chosen colour per character (CHR-03). */
  characterVariants: z.record(z.string(), z.string()),
});

export type CameraSettings = z.infer<typeof cameraSchema>;

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  mode: 'film',
  lens: 'front',
  aspect: '3:4',
  flash: 'off',
  timer: 0,
  grid: false,
  filmId: 'natural',
  filmIntensity: {},
  favoriteFilms: [],
  beauty: DEFAULT_BEAUTY_PARAMS,
  dateStamp: { enabled: false, format: 'yy mm dd', customDate: null },
  characterId: 'bear',
  characterVariants: {},
};

interface CameraActions {
  readonly update: (patch: Partial<CameraSettings>) => void;
  /** Selects a film and applies its date stamp default (FLM-04). */
  readonly selectFilm: (filmId: string, dateStampByDefault: boolean) => void;
  readonly setFilmIntensity: (filmId: string, intensity: number) => void;
  readonly toggleFavorite: (filmId: string) => void;
  readonly setBeauty: (beauty: BeautyParams) => void;
  readonly setDateStampFormat: (format: DateStampFormat) => void;
  readonly selectCharacterVariant: (characterId: string, variantId: string) => void;
}

export const useCameraSettings = create<CameraSettings & CameraActions>()(
  persist(
    (set) => ({
      ...DEFAULT_CAMERA_SETTINGS,
      update: (patch) => {
        set(patch);
      },
      selectFilm: (filmId, dateStampByDefault) => {
        set((state) => ({
          filmId,
          dateStamp: { ...state.dateStamp, enabled: dateStampByDefault },
        }));
      },
      setFilmIntensity: (filmId, intensity) => {
        set((state) => ({ filmIntensity: { ...state.filmIntensity, [filmId]: intensity } }));
      },
      toggleFavorite: (filmId) => {
        set((state) => ({
          favoriteFilms: state.favoriteFilms.includes(filmId)
            ? state.favoriteFilms.filter((id) => id !== filmId)
            : [...state.favoriteFilms, filmId],
        }));
      },
      setBeauty: (beauty) => {
        set({ beauty });
      },
      setDateStampFormat: (format) => {
        set((state) => ({ dateStamp: { ...state.dateStamp, format } }));
      },
      selectCharacterVariant: (characterId, variantId) => {
        set((state) => ({
          characterId,
          characterVariants: { ...state.characterVariants, [characterId]: variantId },
        }));
      },
    }),
    persistValidated<CameraSettings & CameraActions, typeof cameraSchema>('camera', cameraSchema),
  ),
);

/** The film strength, full unless the user changed it for this film. */
export function filmIntensityOf(
  settings: Pick<CameraSettings, 'filmIntensity'>,
  filmId: string,
): number {
  return settings.filmIntensity[filmId] ?? 1;
}
