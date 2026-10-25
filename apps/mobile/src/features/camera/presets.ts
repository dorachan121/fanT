import type { BeautyLevel, FilmPreset } from '@fant/filters';

export const FILM_PRESET_LABELS: Record<FilmPreset, string> = {
  natural: 'ナチュラル',
  warm: 'ウォーム',
  cool: 'クール',
  faded: 'フェード',
};

export const BEAUTY_LEVEL_LABELS: Record<BeautyLevel, string> = {
  off: 'オフ',
  low: '弱',
  medium: '中',
  high: '強',
};

/** Each step moves to the next look and wraps around after the last. */
export const NEXT_FILM_PRESET: Record<FilmPreset, FilmPreset> = {
  natural: 'warm',
  warm: 'cool',
  cool: 'faded',
  faded: 'natural',
};

/** Each step moves to the next strength and wraps around after the strongest. */
export const NEXT_BEAUTY_LEVEL: Record<BeautyLevel, BeautyLevel> = {
  off: 'low',
  low: 'medium',
  medium: 'high',
  high: 'off',
};
