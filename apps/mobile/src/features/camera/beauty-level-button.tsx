import type { BeautyLevel } from '@fant/filters';
import { Pressable, StyleSheet, Text } from 'react-native';

import { BEAUTY_LEVEL_LABELS, NEXT_BEAUTY_LEVEL } from './presets';

interface BeautyLevelButtonProps {
  readonly level: BeautyLevel;
  readonly onChange: (level: BeautyLevel) => void;
}

export function BeautyLevelButton({ level, onChange }: BeautyLevelButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`美肌の強さ：${BEAUTY_LEVEL_LABELS[level]}`}
      accessibilityHint="タップすると強さを切り替えます"
      style={styles.button}
      onPress={() => {
        onChange(NEXT_BEAUTY_LEVEL[level]);
      }}
    >
      <Text style={styles.caption}>美肌</Text>
      <Text style={styles.value}>{BEAUTY_LEVEL_LABELS[level]}</Text>
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
