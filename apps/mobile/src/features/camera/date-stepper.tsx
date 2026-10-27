import type { CalendarDate } from '@fant/filters';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '../../ui/icon-button';
import { colors, spacing } from '../../ui/theme';
import { stepDate } from './calendar';
import { Text } from '../../ui/text';

const FIELDS = [
  { field: 'year', label: '年' },
  { field: 'month', label: '月' },
  { field: 'day', label: '日' },
] as const;

/** Picks a fixed date for the imprint (FLM-04) with steppers that cannot produce an invalid date. */
export function DateStepper({
  date,
  onChange,
}: {
  readonly date: CalendarDate;
  readonly onChange: (date: CalendarDate) => void;
}) {
  return (
    <View style={styles.row}>
      {FIELDS.map(({ field, label }) => (
        <View key={field} style={styles.field}>
          <IconButton
            icon="chevron-up"
            label={`${label}を増やす`}
            size={18}
            onPress={() => {
              onChange(stepDate(date, field, 1));
            }}
          />
          <Text style={styles.value}>{`${String(date[field])}${label}`}</Text>
          <IconButton
            icon="chevron-down"
            label={`${label}を減らす`}
            size={18}
            onPress={() => {
              onChange(stepDate(date, field, -1));
            }}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  field: { alignItems: 'center', gap: spacing.xs },
  value: { color: colors.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
