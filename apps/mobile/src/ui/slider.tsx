import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { colors, spacing } from './theme';

interface SliderProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
  /** Shown beside the label, e.g. "80%". */
  readonly formatValue?: (value: number) => string;
  /** A centre mark for two-sided values (e.g. -1…1). */
  readonly centered?: boolean;
}

const STEPS = 20;

/**
 * A horizontal slider driven by touch, and by swipe up/down for screen readers
 * (accessibility "adjustable").
 */
export function Slider({ label, value, min, max, onChange, formatValue, centered }: SliderProps) {
  const [width, setWidth] = useState(0);
  const fraction = max > min ? (value - min) / (max - min) : 0;

  const valueAt = (x: number) => {
    const clamped = Math.min(1, Math.max(0, width > 0 ? x / width : 0));
    return min + clamped * (max - min);
  };
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (event) => {
      onChange(valueAt(event.x));
    },
    onUpdate: (event) => {
      onChange(valueAt(event.x));
    },
  });

  const step = (max - min) / STEPS;
  const display = formatValue?.(value) ?? `${String(Math.round(fraction * 100))}%`;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: display }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
        onChange(Math.min(max, Math.max(min, value + delta)));
      }}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{display}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          style={styles.hitArea}
          onLayout={(event) => {
            setWidth(event.nativeEvent.layout.width);
          }}
        >
          <View style={styles.track}>
            {centered === true && <View style={styles.center} />}
            <View style={[styles.fill, { width: `${String(fraction * 100)}%` }]} />
          </View>
          <View style={[styles.thumb, { left: fraction * width - THUMB / 2 }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const THUMB = 22;

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  value: { color: colors.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
  hitArea: { height: 32, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  center: {
    position: 'absolute',
    left: '50%',
    width: 2,
    height: 4,
    backgroundColor: colors.textMuted,
  },
  fill: { height: 4, backgroundColor: colors.accent },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.text,
  },
});
