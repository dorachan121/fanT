import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, spacing } from './theme';

const VISIBLE_MS = 1500;

interface NoticeState {
  readonly text: string;
  readonly id: number;
}

/** A short message that hides itself; showing it again restarts the timer. */
export function useNotice(): [text: string | null, show: (text: string) => void] {
  const [notice, setNotice] = useState<NoticeState | null>(null);

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => {
      setNotice(null);
    }, VISIBLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [notice]);

  const show = useCallback((text: string) => {
    setNotice((previous) => ({ text, id: (previous?.id ?? 0) + 1 }));
  }, []);

  return [notice?.text ?? null, show];
}

/** Announced to screen readers as it appears. */
export function Notice({ text }: { readonly text: string | null }) {
  if (text === null) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={styles.notice}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    overflow: 'hidden',
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.scrim,
  },
});
