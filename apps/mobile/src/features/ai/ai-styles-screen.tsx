import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { localized, strings } from '../../i18n';
import { Button } from '../../ui/button';
import { ScreenHeader } from '../../ui/screen-header';
import { colors, spacing } from '../../ui/theme';
import { useContent } from '../content/content-store';
import { available } from '../content/lookup';
import { useSettings } from '../settings/settings-store';
import { useAi } from './ai-store';
import { AI_CONSENT_VERSION } from './consent';

/** Consent before the first generation (S-42, AI-03). */
function ConsentModal({
  visible,
  onAgree,
  onClose,
}: {
  readonly visible: boolean;
  readonly onAgree: () => void;
  readonly onClose: () => void;
}) {
  const { consent } = strings.ai;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.title}>
            {consent.title}
          </Text>
          {consent.body.map((line) => (
            <Text key={line} style={styles.body}>
              ・{line}
            </Text>
          ))}
          <Button label={consent.agree} onPress={onAgree} />
          <Button label={strings.common.cancel} variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/** Styles, their price and the balance (S-41, AI-02/07). */
export function AiStylesScreen({ sourceUri }: { readonly sourceUri: string }) {
  const aiStyles = available(useContent((state) => state.manifest).aiStyles);
  const credits = useAi((state) => state.credits);
  const consentVersion = useSettings((state) => state.aiConsentVersion);
  const { bottom } = useSafeAreaInsets();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    void useAi.getState().refreshCredits();
  }, []);

  const generate = (styleId: string, cost: number) => {
    if (consentVersion !== AI_CONSENT_VERSION) {
      setPending(styleId);
      return;
    }
    if (credits !== null && credits.total < cost) {
      router.push('/credits');
      return;
    }
    router.push({ pathname: '/ai/generate', params: { uri: sourceUri, styleId } });
  };

  return (
    <View style={[styles.container, { paddingBottom: bottom }]}>
      <ScreenHeader
        title={strings.ai.chooseStyle}
        actions={
          <Pressable
            accessibilityRole="button"
            style={styles.balance}
            onPress={() => {
              router.push('/credits');
            }}
          >
            <Text style={styles.balanceText}>
              {credits === null ? '…' : strings.ai.credits(credits.total)}
            </Text>
          </Pressable>
        }
      />
      <FlatList
        data={aiStyles}
        keyExtractor={(style) => style.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${localized(item.name)}、${strings.ai.cost(item.credits)}`}
            accessibilityHint={localized(item.description)}
            style={styles.card}
            onPress={() => {
              generate(item.id, item.credits);
            }}
          >
            <Text style={styles.name}>{localized(item.name)}</Text>
            <Text style={styles.description}>{localized(item.description)}</Text>
            <Text style={styles.cost}>{strings.ai.cost(item.credits)}</Text>
          </Pressable>
        )}
      />
      <ConsentModal
        visible={pending !== null}
        onClose={() => {
          setPending(null);
        }}
        onAgree={() => {
          useSettings.getState().update({ aiConsentVersion: AI_CONSENT_VERSION });
          const styleId = pending;
          setPending(null);
          if (styleId !== null)
            router.push({ pathname: '/ai/generate', params: { uri: sourceUri, styleId } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  balance: { justifyContent: 'center', paddingHorizontal: spacing.sm, minHeight: 48 },
  balanceText: { color: colors.premium, fontSize: 14, fontWeight: '700' },
  list: { gap: spacing.md, padding: spacing.md },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: 16, backgroundColor: colors.surface },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  description: { color: colors.textMuted, fontSize: 14 },
  cost: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  scrim: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.scrim },
  dialog: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
});
