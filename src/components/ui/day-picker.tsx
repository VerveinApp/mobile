import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Type } from '@/constants/theme';
import { PRESSED_DIM } from '@/lib/button-interactions';
import { hapticSelect } from '@/lib/haptics';
import { dayPillLabel, recentDays } from '@/lib/day-labels';
import { localDateStr } from '@/lib/local-date';
import { useAppColors } from '@/lib/theme-context';

/**
 * Which day an entry is for — today by default, or any of the last few
 * weeks, so a forgotten weigh-in or night's sleep can still go under the
 * day it happened instead of being lost or logged on the wrong date.
 */
export function DayPicker({
  value,
  onChange,
  days = 30,
  loggedDates,
}: {
  value: string;
  onChange: (date: string) => void;
  days?: number;
  /** Days that already have an entry get a dot, so updating one is obvious. */
  loggedDates?: ReadonlySet<string>;
}) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = localDateStr();
  const options = recentDays(days);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel="Day"
    >
      {options.map((date) => {
        const selected = date === value;
        const label = dayPillLabel(date, today);
        const logged = loggedDates?.has(date) ?? false;
        return (
          <Pressable
            key={date}
            onPress={() => {
              if (selected) return;
              hapticSelect();
              onChange(date);
            }}
            style={({ pressed }) => [styles.pill, selected && styles.pillSelected, pressed && PRESSED_DIM]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label.spoken}${logged ? ', has an entry' : ''}`}
          >
            <Text style={[styles.pillText, selected && styles.pillTextSelected]} maxFontSizeMultiplier={1.2}>
              {label.text}
            </Text>
            {logged ? <Text style={[styles.dot, selected && styles.pillTextSelected]}>•</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    row: {
      gap: 6,
      paddingBottom: 12,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
      backgroundColor: colors.pillBg,
    },
    pillSelected: {
      borderColor: 'rgba(95,190,132,0.6)',
      backgroundColor: 'rgba(95,190,132,0.14)',
    },
    pillText: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Medium',
    },
    pillTextSelected: {
      color: colors.accentText,
    },
    dot: {
      color: colors.textTertiary,
      fontSize: Type.secondary,
    },
  });
}
