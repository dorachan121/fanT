import type { FilmParams } from '@fant/filters';
import type { SkRuntimeEffect } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { usePhotoOutput, type CameraPhotoOutput } from 'react-native-vision-camera';

import { renderFilmPhoto } from './render-film-photo';
import { saveToPhotoLibrary } from './save-to-photo-library';

export type CaptureStatus = 'idle' | 'capturing' | 'saved';

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

  const capture = async (): Promise<void> => {
    setStatus('capturing');
    try {
      const encodedPhoto = await takeEncodedPhoto(photoOutput);
      await saveToPhotoLibrary(renderFilmPhoto(encodedPhoto, effect, params, seed));
      setStatus('saved');
    } catch (error) {
      setStatus('idle');
      throw error;
    }
  };

  return { photoOutput, status, capture };
}

async function takeEncodedPhoto(output: CameraPhotoOutput): Promise<Uint8Array> {
  const photo = await output.capturePhoto({}, {});
  try {
    return new Uint8Array(await photo.getFileDataAsync());
  } finally {
    photo.dispose();
  }
}
