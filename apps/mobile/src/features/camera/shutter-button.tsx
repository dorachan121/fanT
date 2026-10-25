import { Pressable, StyleSheet, View } from 'react-native';

interface ShutterButtonProps {
  readonly disabled: boolean;
  readonly onPress: () => void;
}

export function ShutterButton({ disabled, onPress }: ShutterButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="撮影する"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.ring, (pressed || disabled) && styles.dimmed]}
      onPress={onPress}
    >
      <View style={styles.core} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
  },
  core: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  dimmed: { opacity: 0.5 },
});
