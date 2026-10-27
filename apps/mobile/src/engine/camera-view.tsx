import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import {
  useCameraDevice,
  usePhotoOutput,
  type CameraPhotoOutput,
  type Constraint,
  type DeviceFilter,
} from 'react-native-vision-camera';
import {
  SkiaCamera,
  type SkiaCameraProps,
  type SkiaCameraRef,
} from 'react-native-vision-camera-skia';

export { useCameraPermission } from 'react-native-vision-camera';

export type Lens = 'front' | 'back';
export type CaptureFlash = 'off' | 'on' | 'auto';

/** What the current camera supports, for the controls (CAM-06/08/09). */
export interface LensCapabilities {
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly minExposure: number;
  readonly maxExposure: number;
  readonly hasFlash: boolean;
  readonly supportsFocus: boolean;
}

export interface CapturedPhoto {
  /** The encoded original (CAM-04). */
  readonly bytes: Uint8Array;
  /** Whether the camera already mirrored the photo. */
  readonly isMirrored: boolean;
}

export interface CameraViewHandle {
  /** Focuses and meters at a point in view coordinates (CAM-08). */
  focus(point: { readonly x: number; readonly y: number }): Promise<void>;
  capture(options: { readonly flash: CaptureFlash }): Promise<CapturedPhoto>;
}

/**
 * Fixed 24fps (D-07): dark scenes keep a smooth preview instead of the camera
 * stretching exposure down to ~16fps. VisionCamera v5 only supports a fixed rate.
 */
const CONSTRAINTS: Constraint[] = [{ fps: 24 }];

/**
 * The plain wide-angle camera: zoom 1 is then always the normal 1× view (on a
 * multi-lens virtual camera it would be the ultra-wide lens), and a single physical
 * camera is the lightest for the preview (P-1). Pinch zoom is digital.
 */
const WIDE_ANGLE_ONLY: DeviceFilter = { physicalDevices: ['wide-angle'] };

/**
 * 4:3 preview frames, the same shape as the photos, so the preview shows exactly what
 * the photo will contain once both are cropped to the chosen aspect ratio (CAM-05).
 * 1440×1080 keeps the per-frame cost close to the measured 1080p (P-1).
 */
const PREVIEW_RESOLUTION = { width: 1440, height: 1080 };

interface CameraViewProps {
  readonly ref?: Ref<CameraViewHandle>;
  readonly lens: Lens;
  readonly isActive: boolean;
  readonly zoom: SharedValue<number>;
  /** Exposure bias in EV, within the lens's range. */
  readonly exposure: number;
  readonly onFrame: SkiaCameraProps['onFrame'];
  readonly onCapabilities?: (capabilities: LensCapabilities) => void;
  readonly style?: StyleProp<ViewStyle>;
}

async function takePhoto(output: CameraPhotoOutput, flash: CaptureFlash): Promise<CapturedPhoto> {
  // The system shutter sound always plays: silent capture is not allowed (CAM-11).
  const photo = await output.capturePhoto({ flashMode: flash, enableShutterSound: true }, {});
  try {
    return { bytes: new Uint8Array(await photo.getFileDataAsync()), isMirrored: photo.isMirrored };
  } finally {
    photo.dispose();
  }
}

/**
 * The live camera preview drawn through Skia. All VisionCamera APIs stay in this
 * module (03 §8) so a library upgrade touches one place.
 */
export function CameraView({
  ref,
  lens,
  isActive,
  zoom,
  exposure,
  onFrame,
  onCapabilities,
  style,
}: CameraViewProps) {
  const camera = useRef<SkiaCameraRef>(null);
  const device = useCameraDevice(lens, WIDE_ANGLE_ONLY);
  // JPEG keeps decoding portable (Skia has no HEIC codec on every platform).
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg', qualityPrioritization: 'quality' });
  // A stable array keeps the camera session from being reconfigured on every render.
  const outputs = useMemo(() => [photoOutput], [photoOutput]);

  const capabilities = useMemo<LensCapabilities | null>(
    () =>
      device === undefined
        ? null
        : {
            minZoom: device.minZoom,
            maxZoom: device.maxZoom,
            minExposure: device.minExposureBias,
            maxExposure: device.maxExposureBias,
            hasFlash: device.hasFlash,
            supportsFocus: device.supportsFocusMetering,
          },
    [device],
  );
  useEffect(() => {
    if (capabilities !== null) onCapabilities?.(capabilities);
  }, [capabilities, onCapabilities]);

  useImperativeHandle(ref, () => ({
    async focus(point) {
      if (capabilities?.supportsFocus !== true) return;
      await camera.current?.focusTo(point);
    },
    capture({ flash }) {
      return takePhoto(photoOutput, capabilities?.hasFlash === true ? flash : 'off');
    },
  }));

  if (device === undefined) return null;
  return (
    <SkiaCamera
      ref={camera}
      style={style}
      device={device}
      isActive={isActive}
      constraints={CONSTRAINTS}
      targetResolution={PREVIEW_RESOLUTION}
      zoom={zoom}
      exposure={exposure}
      // YUV frames are CPU-readable, which face detection needs (Android defaults to GPU-only).
      pixelFormat="yuv"
      outputs={outputs}
      onFrame={onFrame}
    />
  );
}
