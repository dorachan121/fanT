import type { Film } from '@fant/content-schema';
import {
  calendarDateOf,
  DATE_STAMP_ORANGE,
  type DateStamp,
  type FilterSettings,
} from '@fant/filters';
import { useEffect, useMemo, useState } from 'react';

import type { CharacterDrawing } from '../../engine/draw-character';
import { loadContentImages } from '../../engine/images';
import { useFilmLut, type LoadedLut } from '../../engine/lut';
import type { SkImage } from '../../engine/skia';
import { reportError } from '../analytics/analytics';
import { useContent } from '../content/content-store';
import { findCharacter, findFilm, type ResolvedCharacter } from '../content/lookup';
import { filterSettingsFor } from '../photo/filter-settings';
import { filmIntensityOf, useCameraSettings } from './camera-store';

export interface CameraLook {
  readonly film: Film;
  readonly intensity: number;
  readonly dateStamp: DateStamp | null;
  readonly character: ResolvedCharacter | null;
  readonly settings: FilterSettings;
  readonly lut: LoadedLut;
  /** The character as drawn on the preview. */
  readonly characterDrawing: CharacterDrawing | null;
}

/**
 * Everything that decides how the preview (and the next photo) looks, derived from
 * the camera settings and content. `seed` is fixed per shot (FLM-06).
 */
export function useCameraLook(seed: number): CameraLook {
  const manifest = useContent((state) => state.manifest);
  const filmId = useCameraSettings((state) => state.filmId);
  const filmIntensity = useCameraSettings((state) => state.filmIntensity);
  const beauty = useCameraSettings((state) => state.beauty);
  const dateSettings = useCameraSettings((state) => state.dateStamp);
  const mode = useCameraSettings((state) => state.mode);
  const characterId = useCameraSettings((state) => state.characterId);
  const characterVariants = useCameraSettings((state) => state.characterVariants);

  const film = findFilm(manifest, filmId);
  const intensity = filmIntensityOf({ filmIntensity }, film.id);
  const lut = useFilmLut(film);

  const dateStamp = useMemo<DateStamp | null>(
    () =>
      dateSettings.enabled
        ? {
            date: dateSettings.customDate ?? calendarDateOf(new Date()),
            format: dateSettings.format,
            color: DATE_STAMP_ORANGE,
          }
        : null,
    [dateSettings],
  );

  const character = useMemo(
    () =>
      mode === 'character'
        ? findCharacter(manifest, characterId, characterVariants[characterId])
        : null,
    [mode, manifest, characterId, characterVariants],
  );

  const settings = useMemo(
    () => filterSettingsFor({ film, intensity, seed, beauty, dateStamp }),
    [film, intensity, seed, beauty, dateStamp],
  );

  const [images, setImages] = useState<Readonly<Record<string, SkImage>>>({});
  useEffect(() => {
    const refs =
      character?.character.parts.flatMap((part) =>
        part.art.type === 'image' ? [part.art.image] : [],
      ) ?? [];
    if (refs.length === 0) return;
    let current = true;
    loadContentImages(refs)
      .then((loaded) => {
        if (current) setImages(loaded);
      })
      .catch((error: unknown) => {
        reportError(error, 'character.images');
      });
    return () => {
      current = false;
    };
  }, [character]);

  const characterDrawing = useMemo<CharacterDrawing | null>(
    () => (character === null ? null : { ...character, images }),
    [character, images],
  );

  return { film, intensity, dateStamp, character, settings, lut, characterDrawing };
}
