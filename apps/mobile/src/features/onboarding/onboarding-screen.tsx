import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../../i18n';
import { Button } from '../../ui/button';
import { colors, spacing } from '../../ui/theme';
import { useSettings } from '../settings/settings-store';

/**
 * The first launch (S-02, ONB-01): the modes in three pages at most, ending with
 * how the camera and photos are used. Camera access is asked for on the camera
 * screen right after, with its own explanation (ONB-02).
 */
export function OnboardingScreen() {
  const [page, setPage] = useState(0);
  const { top, bottom } = useSafeAreaInsets();
  const pages = strings.onboarding.pages;
  const current = pages[page];
  const last = page === pages.length - 1;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: top + spacing.xl, paddingBottom: bottom + spacing.lg },
      ]}
    >
      <View style={styles.dots} accessibilityElementsHidden>
        {pages.map((_, index) => (
          <View key={String(index)} style={[styles.dot, index === page && styles.activeDot]} />
        ))}
      </View>
      {current !== undefined && (
        <View style={styles.body}>
          <Text accessibilityRole="header" style={styles.title}>
            {current.title}
          </Text>
          <Text style={styles.text}>{current.body}</Text>
        </View>
      )}
      <Button
        label={last ? strings.onboarding.start : strings.onboarding.next}
        onPress={() => {
          if (!last) {
            setPage(page + 1);
            return;
          }
          useSettings.getState().update({ onboardingCompleted: true });
          router.replace('/');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised },
  activeDot: { backgroundColor: colors.accent },
  body: { gap: spacing.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  text: { color: colors.text, fontSize: 17, lineHeight: 28 },
});
