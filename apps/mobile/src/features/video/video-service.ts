import type { Film } from '@fant/content-schema';
import { File } from 'expo-file-system';

import { applyLut, videoThumbnail } from '../../../modules/video-film/src';
import { bakeFilmLut } from '../../engine/video-lut';
import { tempDirectory } from '../../lib/temp-files';
import { track } from '../analytics/analytics';
import { addPhoto, discardPhotoFiles, prepareVideoFile } from '../album/album-db';
import type { AlbumPhoto } from '../album/album-types';
import { newPhotoId } from '../photo/photo-service';
import { useSettings } from '../settings/settings-store';

/** Longest video, in seconds (CAM-13). */
export const MAX_VIDEO_SECONDS = 15;

function fileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/**
 * Turns a raw recording into an album video (CAM-13): colours it with the film at
 * `intensity`, keeps its first frame for the grid, and deletes the raw file.
 */
export async function saveVideo(input: {
  readonly recording: string;
  readonly film: Film;
  readonly intensity: number;
}): Promise<AlbumPhoto> {
  const raw = new File(fileUri(input.recording));
  const id = newPhotoId();
  const thumbnail = new File(tempDirectory('video'), `${id}.jpg`);
  try {
    const lut = await bakeFilmLut(input.film, input.intensity);
    const video = prepareVideoFile(id);
    await applyLut(raw.uri, video, lut);
    const info = await videoThumbnail(video, thumbnail.uri);
    const photo = addPhoto({
      id,
      kind: 'video',
      output: thumbnail.bytesSync(),
      width: info.width,
      height: info.height,
      hasOriginal: false,
      recipe: null,
      originalRetentionDays: useSettings.getState().originalRetentionDays,
    });
    track({
      name: 'video_recorded',
      filmId: input.film.id,
      seconds: Math.round(info.durationMs / 1000),
    });
    return photo;
  } catch (error) {
    discardPhotoFiles(id);
    throw error;
  } finally {
    if (raw.exists) raw.delete();
    if (thumbnail.exists) thumbnail.delete();
  }
}
