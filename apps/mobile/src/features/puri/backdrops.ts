import type { SheetPattern } from '@fant/content-schema';

/** A background that replaces what is behind the people in a puri shot (PRI-04). */
export interface Backdrop {
  readonly id: string;
  /** Shown on the chip. */
  readonly emoji: string;
  readonly color: string;
  readonly pattern: SheetPattern;
  readonly patternColor: string;
}

/** Plain pastels and Heisei-style patterns, in the app's palette. */
export const BACKDROPS: readonly Backdrop[] = [
  { id: 'pink', emoji: '🩷', color: '#ffd1e6', pattern: 'plain', patternColor: '#ffffff' },
  { id: 'dots', emoji: '🫧', color: '#eee6ff', pattern: 'dots', patternColor: '#ffffff' },
  { id: 'hearts', emoji: '💕', color: '#ffe4f1', pattern: 'hearts', patternColor: '#ff7bb8' },
  { id: 'checker', emoji: '🏁', color: '#ddf6ef', pattern: 'checker', patternColor: '#ffffff' },
  { id: 'heisei', emoji: '🌈', color: '#ffe27a', pattern: 'stripes', patternColor: '#ff9ccf' },
];
