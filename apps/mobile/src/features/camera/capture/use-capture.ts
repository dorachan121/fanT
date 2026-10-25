import { useState } from 'react';
import { usePhotoOutput, type CameraPhotoOutput } from 'react-native-vision-camera';

import type { FilterEffects, FilterParams } from '../filter-pipeline.worklet';
import { renderFilteredPhoto } from './render-filtered-photo';
import { saveToPhotoLibrary } from './save-to-photo-library';

export type CaptureStatus = 'idle' | 'capturing';

export interface CaptureOptions {
  /** Whether the live preview is mirrored (front camera); the photo is saved the same way. */
  readonly previewMirrored: boolean;
}

interface CapturedPhoto {
  readonly encoded: Uint8Array;
  readonly isMirrored: boolean;
}

/**
 * Captures a full-resolution photo, applies the filters exactly as previewed,
 * and saves it. Errors are rethrown so the screen can explain them to the user.
 */
export function useCapture(effects: FilterEffects, params: FilterParams, seed: number) {
  // JPEG keeps decoding portable (Skia has no HEIC codec on every platform).
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg', qualityPrioritization: 'quality' });
  const [status, setStatus] = useState<CaptureStatus>('idle');

  const capture = async ({ previewMirrored }: CaptureOptions): Promise<void> => {
    setStatus('capturing');
    try {
      const photo = await takePhoto(photoOutput);
      // Platforms differ in whether still photos come out mirrored, so flip only when
      // the captured photo disagrees with what the preview showed.
      const mirror = photo.isMirrored !== previewMirrored;
      await saveToPhotoLibrary(
        renderFilteredPhoto(photo.encoded, effects, params, seed, { mirror }),
      );
    } finally {
      setStatus('idle');
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
