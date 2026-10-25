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
  },
  plugins: ['expo-router'],
  experiments: { reactCompiler: true },
};

export default config;
