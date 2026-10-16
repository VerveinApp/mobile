import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PremiumGate } from '@/components/premium-gate';
import { SymbolView } from '@/components/ui/app-symbol';
import { TrendChart, type TrendPoint } from '@/components/ui/trend-chart';
import { Type } from '@/constants/theme';
import { getBodyMeasurements } from '@/lib/body-measurements';
import { PRESSED_DIM } from '@/lib/button-interactions';
import { hapticSelect } from '@/lib/haptics';
import { getSleepLog } from '@/lib/sleep-log';
import { useAppColors } from '@/lib/theme-context';
import { getUnitSystem, type UnitSystem } from '@/lib/unit-preference';
import { getWeightLog } from '@/lib/weight-log';
import { formatWeight } from '@/lib/weight-units';

// How far back each trend looks: long enough to see a direction, short
// enough that it's about now.
const WEIGHT_DAYS = 90;
const SLEEP_DAYS = 30;
const WAIST_DAYS = 180;

type BodyTrends = { weight: TrendPoint[]; sleep: TrendPoint[]; waist: TrendPoint[]; unit: UnitSystem };

function since(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Oldest first, inside the window, from a newest-first log. */
function trend<T extends { date: string }>(entries: T[], days: number, value: (e: T) => number | undefined): TrendPoint[] {
  const from = since(days);
  return entries
    .filter((e) => e.date >= from && value(e) !== undefined)
    .map((e) => ({ date: e.date, value: value(e) as number }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Progress's Body section: weight, sleep and waist next to the training
 * above them, so the one screen shows how the body is doing too — drawn
 * only from what was actually logged, one chart per measure with 2+ entries
 * in its window, each linking to its full history. Plus, the same tier as
 * those histories' own trends.
 */
export function BodySection({
  isPremium,
  onScrubbingChange,
}: {
  /** Null while the entitlement is still loading, same as PremiumGate. */
  isPremium: boolean | null;
  onScrubbingChange: (scrubbing: boolean) => void;
}) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [trends, setTrends] = useState<BodyTrends | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [weightLog, sleepLog, measurements, unit] = await Promise.all([
          getWeightLog(),
          getSleepLog(),
          getBodyMeasurements(),
          getUnitSystem(),
        ]);
        if (cancelled) return;
        setTrends({
          weight: trend(weightLog, WEIGHT_DAYS, (e) => e.weightKg),
          sleep: trend(sleepLog, SLEEP_DAYS, (e) => e.hours),
          waist: trend(measurements, WAIST_DAYS, (e) => e.waistCm),
          unit,
        });
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (!trends) return null;
  const charts = [
    trends.weight.length >= 2
      ? {
          key: 'weight',
          caption: 'Weight · 90 days',
          data: trends.weight,
          format: (kg: number) => formatWeight(kg, trends.unit),
          route: '/settings/weight-history',
        }
      : null,
    trends.sleep.length >= 2
      ? {
          key: 'sleep',
          caption: 'Sleep · 30 days',
          data: trends.sleep,
          format: (hours: number) => `${Math.round(hours * 10) / 10} h`,
          route: '/settings/sleep-history',
          min: 0,
        }
      : null,
    trends.waist.length >= 2
      ? {
          key: 'waist',
          caption: 'Waist · 6 months',
          data: trends.waist,
          format: (cm: number) =>
            trends.unit === 'metric' ? `${Math.round(cm * 10) / 10} cm` : `${Math.round((cm / 2.54) * 10) / 10} in`,
          route: '/settings/body-measurements',
        }
      : null,
  ].filter((chart) => chart !== null);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionKicker} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
        BODY
      </Text>
      <PremiumGate isPremium={isPremium} label="Body trends" feature="history">
        {charts.length > 0 ? (
          <View style={styles.card}>
            {charts.map((chart, index) => (
              <View key={chart.key} style={[styles.chartBlock, index > 0 && styles.chartDivider]}>
                <TrendChart
                  data={chart.data}
                  caption={chart.caption}
                  formatValue={chart.format}
                  height={44}
                  min={chart.min}
                  onScrubbingChange={onScrubbingChange}
                />
                <Pressable
                  onPress={() => {
                    hapticSelect();
                    router.push(chart.route as never);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [styles.seeAll, pressed && PRESSED_DIM]}
                  accessibilityRole="link"
                  accessibilityLabel={`See all ${chart.key} entries`}
                >
                  <Text style={styles.seeAllText} maxFontSizeMultiplier={1.2}>
                    See all
                  </Text>
                  <SymbolView name="chevron.right" size={10} tintColor={colors.textTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <SymbolView name="figure.stand" size={26} tintColor={colors.iconFaint} />
            <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
              Log your weight, sleep or measurements a couple of times and their trends show up here.
            </Text>
          </View>
        )}
      </PremiumGate>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  // Progress's own section, card and empty-state treatment, so this reads
  // as one of its sections rather than something bolted on.
  return StyleSheet.create({
    section: {
      gap: 12,
    },
    sectionKicker: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      letterSpacing: 1,
      fontFamily: 'Geist-SemiBold',
    },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
    },
    chartBlock: {
      paddingVertical: 16,
    },
    chartDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.surfaceDivider,
    },
    seeAll: {
      marginTop: 8,
      alignSelf: 'flex-end',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    seeAllText: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
    },
    emptyCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 20,
      alignItems: 'center',
      gap: 10,
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: Type.secondary,
      lineHeight: 18,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
  });
}
