import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, TOUCH_TARGET } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface IconButtonProps {
  readonly icon: IconName;
  readonly label: string;
  readonly onPress: () => void;
  /** Small text under or beside the icon, e.g. "3s". */
  readonly badge?: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly size?: number;
  readonly style?: StyleProp<ViewStyle>;
}

/** A round icon button with a screen-reader label (03 §9). */
export function IconButton({
  icon,
  label,
  onPress,
  badge,
  active,
  disabled,
  size = 24,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
    >
      <View>
        <Ionicons name={icon} size={size} color={active === true ? colors.accent : colors.text} />
        {badge !== undefined && <Text style={styles.badge}>{badge}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: TOUCH_TARGET / 2,
    backgroundColor: colors.overlay,
  },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },
  badge: {
    position: 'absolute',
    right: -10,
    bottom: -6,
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
});
