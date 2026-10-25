import type { ExpoConfig } from 'expo/config';

import packageJson from './package.json';

/**
 * Placeholder application ID until the store listing is registered
 * (docs/requirements/06-open-issues.md, Q-01). Changing it after release is not possible.
 */
const BASE_APP_ID = 'com.fant.camera';

/** Build variants installable side by side; selected by EAS via `APP_VARIANT`. */
const VARIANTS = {
  development: { name: 'fanT (Dev)', suffix: 'dev' },
  preview: { name: 'fanT (Preview)', suffix: 'preview' },
  production: { name: 'fanT', suffix: null },
} as const;

type AppVariant = keyof typeof VARIANTS;

function resolveVariant(value: string | undefined): AppVariant {
  if (value === undefined) return 'development';
  if (Object.hasOwn(VARIANTS, value)) return value as AppVariant;
  throw new Error(
    `Unknown APP_VARIANT "${value}". Expected one of: ${Object.keys(VARIANTS).join(', ')}`,
  );
}

const { name, suffix } = VARIANTS[resolveVariant(process.env.APP_VARIANT)];
const appId = suffix ? `${BASE_APP_ID}.${suffix}` : BASE_APP_ID;

const config: ExpoConfig = {
  name,
  slug: 'fant',
  scheme: suffix ? `fant-${suffix}` : 'fant',
  version: packageJson.version,
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: appId,
    infoPlist: {
      NSCameraUsageDescription: '写真を撮影するためにカメラを使用します。',
    },
  },
  android: {
    package: appId,
    permissions: ['android.permission.CAMERA'],
    blockedPermissions: [
      // Read access added by expo-media-library; saving with add-only access never uses it.
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      // Draw-over-other-apps from the Expo template; the app has no overlays.
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-build-properties',
      {
        android: {
          // VisionCamera and Skia compile their HardwareBuffer frame paths only when minSdk >= 26.
          // Android 10 is the planned floor (docs/requirements/03-non-functional-requirements.md, Q-07).
          minSdkVersion: 29,
        },
      },
    ],
    [
      'expo-media-library',
      {
        // Add-only access: the app saves photos but never reads the library.
        photosPermission: false,
        savePhotosPermission: '撮影した写真を保存するために使用します。',
        isAccessMediaLocationEnabled: false,
        granularPermissions: [],
      },
    ],
  ],
  experiments: { reactCompiler: true },
};

export default config;
