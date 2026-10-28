import { TEXT_STAMP_STYLES, type Stamp, type TextStampStyle } from '@fant/content-schema';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { localized, strings } from '../../i18n';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { Bouncy } from '../../ui/bouncy';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { useContent } from '../content/content-store';
import { available } from '../content/lookup';
import { DECO_COLORS, PEN_WIDTHS } from './deco-ops';
import { Text, TextInput } from '../../ui/text';

export function ColorPalette({
  color,
  onChange,
}: {
  readonly color: string;
  readonly onChange: (color: string) => void;
}) {
  return (
    <View style={styles.row}>
      {DECO_COLORS.map((candidate) => (
        <Bouncy
          key={candidate}
          accessibilityRole="button"
          accessibilityLabel={candidate}
          accessibilityState={{ selected: candidate === color }}
          style={[
            styles.swatch,
            { backgroundColor: candidate },
            candidate === color && styles.selectedSwatch,
          ]}
          onPress={() => {
            onChange(candidate);
          }}
        />
      ))}
    </View>
  );
}

export function WidthPicker({
  width,
  onChange,
}: {
  readonly width: number;
  readonly onChange: (width: number) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{strings.deco.width}</Text>
      {PEN_WIDTHS.map((candidate, index) => (
        <Bouncy
          key={candidate}
          accessibilityRole="button"
          accessibilityLabel={`${strings.deco.width} ${String(index + 1)}`}
          accessibilityState={{ selected: candidate === width }}
          style={[styles.widthButton, candidate === width && styles.selectedWidth]}
          onPress={() => {
            onChange(candidate);
          }}
        >
          <View style={[styles.dot, { width: 6 + index * 6, height: 6 + index * 6 }]} />
        </Bouncy>
      ))}
    </View>
  );
}

/** Stamps to place (DCO-02); premium ones are marked and checked on save. */
export function StampPalette({
  premium,
  onPick,
}: {
  readonly premium: boolean;
  readonly onPick: (stamp: Stamp) => void;
}) {
  const stamps = available(useContent((state) => state.manifest).stamps);
  return (
    <FlatList
      horizontal
      data={stamps}
      keyExtractor={(stamp) => stamp.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stamps}
      renderItem={({ item }) => (
        <Chip
          label={item.art.type === 'text' ? item.art.text : localized(item.name)}
          selected={false}
          locked={item.tier === 'premium' && !premium}
          onPress={() => {
            onPick(item);
          }}
        />
      )}
    />
  );
}

/** Free text and Heisei phrases (DCO-03) in three styles. */
export function TextComposer({
  color,
  onAdd,
}: {
  readonly color: string;
  readonly onAdd: (text: string, style: TextStampStyle) => void;
}) {
  const phrases = useContent((state) => state.manifest.phrases);
  const [text, setText] = useState('');
  const [style, setStyle] = useState<TextStampStyle>('outline');
  return (
    <View style={styles.composer}>
      <TextInput
        accessibilityLabel={strings.deco.textPlaceholder}
        placeholder={strings.deco.textPlaceholder}
        placeholderTextColor={colors.textMuted}
        value={text}
        maxLength={40}
        style={[styles.input, { color }]}
        onChangeText={setText}
      />
      <Text style={styles.label}>{strings.deco.phrases}</Text>
      <FlatList
        horizontal
        data={phrases}
        keyExtractor={(phrase) => phrase.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stamps}
        renderItem={({ item }) => (
          <Chip
            label={item.text}
            selected={false}
            onPress={() => {
              setText(item.text);
            }}
          />
        )}
      />
      <View style={styles.row}>
        {TEXT_STAMP_STYLES.map((candidate) => (
          <Chip
            key={candidate}
            label={strings.deco.textStyles[candidate]}
            selected={candidate === style}
            onPress={() => {
              setStyle(candidate);
            }}
          />
        ))}
      </View>
      <Button
        label={strings.common.done}
        disabled={text.trim() === ''}
        onPress={() => {
          onAdd(text.trim(), style);
          setText('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: colors.surface,
    ...softShadow,
  },
  selectedSwatch: { borderColor: colors.accent, borderWidth: 4 },
  widthButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceRaised,
  },
  selectedWidth: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  dot: { borderRadius: 12, backgroundColor: colors.accent },
  stamps: { gap: spacing.sm },
  composer: { gap: spacing.sm },
  input: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    fontSize: 16,
    backgroundColor: colors.surfaceRaised,
  },
});
