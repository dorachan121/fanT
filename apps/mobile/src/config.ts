import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { z } from 'zod';

const nullableString = z.string().min(1).nullable();

const extraSchema = z.object({
  appVariant: z.enum(['development', 'preview', 'production']),
  contentBaseUrl: z.url({ protocol: /^https$/ }).nullable(),
  apiBaseUrl: z.url({ protocol: /^https$/ }).nullable(),
  revenueCatApiKey: z.object({ ios: nullableString, android: nullableString }),
  supportEmail: z.email().nullable(),
});

/**
 * Build-time configuration from app.config.ts. Invalid configuration fails at
 * startup, so a broken build is caught on the first launch instead of in a feature.
 */
const extra = extraSchema.parse(Constants.expoConfig?.extra);

export const APP_CONFIG = {
  appVariant: extra.appVariant,
  /** Development and preview builds: measurement tools and developer switches. */
  isInternalBuild: extra.appVariant !== 'production',
  /** Where the content manifest and assets are served from (CNT-01); `null` = built-in only. */
  contentBaseUrl: extra.contentBaseUrl,
  /** AI generation and credits (AI-04); `null` disables the AI mode. */
  apiBaseUrl: extra.apiBaseUrl,
  /** RevenueCat public SDK key for this platform; `null` disables purchases. */
  revenueCatApiKey:
    Platform.OS === 'ios' ? extra.revenueCatApiKey.ios : extra.revenueCatApiKey.android,
  supportEmail: extra.supportEmail,
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
} as const;
