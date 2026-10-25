import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import type { Frame } from 'react-native-vision-camera';
import {
  useFaceDetector,
  type FaceDetectorOptions,
} from 'react-native-vision-camera-face-detector';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import { primaryFaceEyes } from './eye-openness.worklet';
import type { EyeOpenness } from './wink-detector';

const DETECTOR_OPTIONS: FaceDetectorOptions = {
  performanceMode: 'fast',
  runClassifications: true,
  // Ignore faces smaller than 15% of the frame (people in the background).
  minFaceSize: 0.15,
};

/** Every other frame (~12 times a second at 24fps) is plenty for a 0.7s wink. */
const DETECT_EVERY_N_FRAMES = 2;

/**
 * On Android the plugin hands ML Kit the camera's raw buffer, and the left eye it
 * reports is the face's own right eye (checked on a Pixel 7a with both cameras).
 * On iOS the plugin passes the front camera's mirroring to ML Kit; that is
 * unverified until it runs on an iPhone.
 */
const EYES_SWAPPED = Platform.OS === 'android';

/**
 * Returns a frame-thread worklet that reads the primary face's eye openness and
 * reports it to the JS thread (`null` when no face is visible). Face data never
 * leaves memory. A detection failure is reported once and never breaks the preview.
 */
export function useEyeTracking(onEyes: (eyes: EyeOpenness | null) => void): (frame: Frame) => void {
  const detector = useFaceDetector(DETECTOR_OPTIONS);
  const frameCount = useMemo(() => createSynchronizable(0), []);
  const failureReported = useMemo(() => createSynchronizable(false), []);

  return useCallback(
    (frame: Frame) => {
      'worklet';
      const count = frameCount.getBlocking();
      frameCount.setBlocking(count + 1);
      if (count % DETECT_EVERY_N_FRAMES !== 0) return;

      try {
        const faces = detector.detectFaces(frame);
        try {
          scheduleOnRN(onEyes, primaryFaceEyes(faces, EYES_SWAPPED));
        } finally {
          for (const face of faces) face.dispose();
        }
      } catch (error) {
        if (!failureReported.getBlocking()) {
          failureReported.setBlocking(true);
          console.error('Face detection failed; wink gestures are unavailable', error);
        }
      }
    },
    [detector, frameCount, failureReported, onEyes],
  );
}
