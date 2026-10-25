import type { FilmPreset } from '@fant/filters';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FILM_PRESET_LABELS, NEXT_FILM_PRESET } from './presets';

interface FilmPresetButtonProps {
  readonly preset: FilmPreset;
  readonly onChange: (preset: FilmPreset) => void;
}

export function FilmPresetButton({ preset, onChange }: FilmPresetButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`フィルム：${FILM_PRESET_LABELS[preset]}`}
      accessibilityHint="タップすると次のフィルムに切り替えます"
      style={styles.chip}
      onPress={() => {
        onChange(NEXT_FILM_PRESET[preset]);
      }}
    >
      <Text style={styles.label}>フィルム：{FILM_PRESET_LABELS[preset]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  label: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
