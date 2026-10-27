/** Colours used by the app's own UI (photos carry their own colours). */
export const colors = {
  background: '#0d0d10',
  surface: '#1b1b22',
  surfaceRaised: '#26262f',
  text: '#ffffff',
  textMuted: '#b3b3c0',
  accent: '#ff5fa2',
  accentText: '#ffffff',
  danger: '#ff5c6c',
  overlay: 'rgba(0, 0, 0, 0.45)',
  scrim: 'rgba(0, 0, 0, 0.6)',
  premium: '#ffc93c',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/** Minimum touch target (03 §9: 44pt / 48dp). */
export const TOUCH_TARGET = 48;
