import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from './theme';

interface ChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly locked?: boolean;
  readonly badge?: string;
}

/** A selectable pill, e.g. a beauty level or a text style. */
export function Chip({ label, selected, onPress, locked, badge }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.selected]}
      onPress={onPress}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {locked === true ? `🔒 ${label}` : label}
      </Text>
      {badge !== undefined && <Text style={styles.badge}>{badge}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
  },
  selected: { backgroundColor: colors.text },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  selectedLabel: { color: colors.background },
  badge: { color: colors.accent, fontSize: 10, fontWeight: '800' },
});
