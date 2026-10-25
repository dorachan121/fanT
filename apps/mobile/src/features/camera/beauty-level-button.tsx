import type { BeautyLevel } from '@fant/filters';
import { Pressable, StyleSheet, Text } from 'react-native';

const LABELS: Record<BeautyLevel, string> = { off: 'オフ', low: '弱', medium: '中', high: '強' };

/** Each tap moves to the next strength and wraps around after the strongest. */
const NEXT_LEVEL: Record<BeautyLevel, BeautyLevel> = {
  off: 'low',
  low: 'medium',
  medium: 'high',
  high: 'off',
};

interface BeautyLevelButtonProps {
  readonly level: BeautyLevel;
  readonly onChange: (level: BeautyLevel) => void;
}

export function BeautyLevelButton({ level, onChange }: BeautyLevelButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`美肌の強さ：${LABELS[level]}`}
      accessibilityHint="タップすると強さを切り替えます"
      style={styles.button}
      onPress={() => {
        onChange(NEXT_LEVEL[level]);
      }}
    >
      <Text style={styles.caption}>美肌</Text>
      <Text style={styles.value}>{LABELS[level]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  caption: { color: '#fff', fontSize: 10 },
  value: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
