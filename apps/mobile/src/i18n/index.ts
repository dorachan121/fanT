import type { LocalizedText } from '@fant/content-schema';

/**
 * The app speaks Japanese in the MVP (03 §1). UI strings live in `strings.ts` and
 * content text is per language, so adding English means adding a dictionary and
 * choosing it here.
 */
const LOCALE = 'ja' as const;

/** Text of a content item in the app's language. */
export function localized(text: LocalizedText): string {
  return text[LOCALE];
}

export { strings } from './strings';
