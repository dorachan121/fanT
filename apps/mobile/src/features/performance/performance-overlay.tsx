import Constants from 'expo-constants';
import { Pressable, StyleSheet, Text } from 'react-native';

import type { FrameStatsSummary } from './frame-stats.worklet';

/**
 * The overlay is for measuring on real devices (P-1), so development and preview
 * builds show it and store builds never do. Preview builds are release builds,
 * which is what measurements should use.
 */
export const PERFORMANCE_OVERLAY_ENABLED: boolean =
  Constants.expoConfig?.extra?.appVariant !== 'production';

interface PerformanceOverlayProps {
  readonly stats: FrameStatsSummary | null;
  readonly analysisEnabled: boolean;
  readonly onToggleAnalysis: () => void;
  readonly top: number;
}

/**
 * Preview frame rate and frame-thread timings, refreshed every second. Tapping it
 * turns face detection on and off so its cost can be measured on its own.
 */
export function PerformanceOverlay({
  stats,
  analysisEnabled,
  onToggleAnalysis,
  top,
}: PerformanceOverlayProps) {
  const analysis = analysisEnabled
    ? `顔検出 ${formatMs(stats?.analysisAvgMs ?? null)}（最大 ${formatMs(stats?.analysisMaxMs ?? null)}）`
    : '顔検出 オフ';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="性能の計測値"
      accessibilityHint="タップすると顔検出のオン/オフを切り替えます"
      style={[styles.overlay, { top: top + 8 }]}
      onPress={onToggleAnalysis}
    >
      <Text style={styles.line}>{stats === null ? '-- fps' : `${stats.fps.toFixed(1)} fps`}</Text>
      <Text style={styles.line}>
        描画 {formatMs(stats?.renderAvgMs ?? null)}（最大 {formatMs(stats?.renderMaxMs ?? null)}）
      </Text>
      <Text style={styles.line}>{analysis}</Text>
    </Pressable>
  );
}

function formatMs(ms: number | null): string {
  return ms === null ? '--' : `${ms.toFixed(1)}ms`;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  line: { color: '#0f0', fontSize: 12, fontVariant: ['tabular-nums'] },
});
