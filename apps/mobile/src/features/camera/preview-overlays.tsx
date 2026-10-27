import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../ui/theme';

/** Rule-of-thirds grid (CAM-10). */
export function GridOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[1, 2].map((line) => (
        <View
          key={`v${String(line)}`}
          style={[styles.vertical, { left: `${String((line * 100) / 3)}%` }]}
        />
      ))}
      {[1, 2].map((line) => (
        <View
          key={`h${String(line)}`}
          style={[styles.horizontal, { top: `${String((line * 100) / 3)}%` }]}
        />
      ))}
    </View>
  );
}

/** Where the camera focused (CAM-08). */
export function FocusRing({
  point,
}: {
  readonly point: { readonly x: number; readonly y: number };
}) {
  return (
    <View
      pointerEvents="none"
      style={[styles.focus, { left: point.x - FOCUS / 2, top: point.y - FOCUS / 2 }]}
    />
  );
}

/** Seconds left on the self-timer (CAM-07). */
export function Countdown({ seconds }: { readonly seconds: number }) {
  return (
    <View pointerEvents="none" style={styles.countdown}>
      <Text accessibilityLiveRegion="assertive" style={styles.countdownText}>
        {seconds}
      </Text>
    </View>
  );
}

/** Lights the face with the screen when the front camera "flashes" (CAM-06). */
export function ScreenFlash() {
  return <View pointerEvents="none" style={styles.flash} />;
}

const FOCUS = 72;

const styles = StyleSheet.create({
  vertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  horizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  focus: {
    position: 'absolute',
    width: FOCUS,
    height: FOCUS,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.premium,
  },
  countdown: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  countdownText: {
    color: colors.text,
    fontSize: 96,
    fontWeight: '800',
    textShadowColor: '#000',
    textShadowRadius: 8,
  },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: '#fff' },
});
