import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';

import { strings } from '../../i18n';
import { Bouncy } from '../../ui/bouncy';
import { Gradient } from '../../ui/gradient';
import { colors, softShadow } from '../../ui/theme';

interface ShutterButtonProps {
  readonly disabled: boolean;
  readonly onPress: () => void;
}

/** A candy shutter with a heart; the shutter itself gives the haptic tap. */
export function ShutterButton({ disabled, onPress }: ShutterButtonProps) {
  return (
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={strings.camera.shutter}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      squash={0.84}
      feedback="none"
      style={[styles.ring, disabled && styles.dimmed]}
      onPress={onPress}
    >
      <Gradient style={styles.core}>
        <Ionicons name="heart" size={30} color={colors.accentText} />
      </Gradient>
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 42,
    borderWidth: 4,
    borderColor: colors.accentSoft,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  core: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 33,
  },
  dimmed: { opacity: 0.5 },
});
