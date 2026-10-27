import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { strings } from '../../i18n';
import { colors, spacing, TOUCH_TARGET } from '../../ui/theme';
import { track } from '../analytics/analytics';
import { CAMERA_MODES, useCameraSettings, type CameraMode } from './camera-store';

/**
 * Switches between the four modes (CAM-12). Film and character shoot here; puri and
 * AI have their own flows.
 */
export function ModeTabs() {
  const mode = useCameraSettings((state) => state.mode);
  const select = (next: CameraMode) => {
    track({ name: 'mode_selected', mode: next });
    if (next === 'puri') router.push('/puri');
    else if (next === 'ai') router.push('/ai');
    else useCameraSettings.getState().update({ mode: next });
  };
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {CAMERA_MODES.map((candidate) => {
        const selected = candidate === mode;
        return (
          <Pressable
            key={candidate}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.tab}
            onPress={() => {
              select(candidate);
            }}
          >
            <Text style={[styles.label, selected && styles.selected]}>
              {strings.modes[candidate]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  tab: { minHeight: TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: spacing.sm },
  label: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  selected: { color: colors.accent },
});
