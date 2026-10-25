import type { FilmParams } from '@fant/filters';
import type { SkRuntimeEffect } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { usePhotoOutput, type CameraPhotoOutput } from 'react-native-vision-camera';

import { renderFilmPhoto } from './render-film-photo';
import { saveToPhotoLibrary } from './save-to-photo-library';

export type CaptureStatus = 'idle' | 'capturing' | 'saved';

export interface CaptureOptions {
  /** Whether the live preview is mirrored (front camera); the photo is saved the same way. */
  readonly previewMirrored: boolean;
}

interface CapturedPhoto {
  readonly encoded: Uint8Array;
  readonly isMirrored: boolean;
}

const SAVED_NOTICE_MS = 1500;

/**
 * Captures a full-resolution photo, applies the film look exactly as previewed,
 * and saves it. Errors are rethrown so the screen can explain them to the user.
 */
export function useFilmCapture(effect: SkRuntimeEffect, params: FilmParams, seed: number) {
  // JPEG keeps decoding portable (Skia has no HEIC codec on every platform).
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg', qualityPrioritization: 'quality' });
  const [status, setStatus] = useState<CaptureStatus>('idle');

  useEffect(() => {
    if (status !== 'saved') return;
    const timer = setTimeout(() => {
      setStatus('idle');
    }, SAVED_NOTICE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [status]);

  const capture = async ({ previewMirrored }: CaptureOptions): Promise<void> => {
    setStatus('capturing');
    try {
      const photo = await takePhoto(photoOutput);
      // Platforms differ in whether still photos come out mirrored, so flip only when
      // the captured photo disagrees with what the preview showed.
      const mirror = photo.isMirrored !== previewMirrored;
      await saveToPhotoLibrary(renderFilmPhoto(photo.encoded, effect, params, seed, { mirror }));
      setStatus('saved');
    } catch (error) {
      setStatus('idle');
      throw error;
    }
  };

  return { photoOutput, status, capture };
}

async function takePhoto(output: CameraPhotoOutput): Promise<CapturedPhoto> {
  const photo = await output.capturePhoto({}, {});
  try {
    return {
      encoded: new Uint8Array(await photo.getFileDataAsync()),
      isMirrored: photo.isMirrored,
    };
  } finally {
    photo.dispose();
  }
}
