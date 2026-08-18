import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RadarChart } from '@/components/onboarding/radar-chart';
import { hapticSelect } from '@/lib/haptics';
import { MOVEMENT_PATTERN_LABELS } from '@/lib/movement-pattern-labels';
import type { BodyArea } from '@/lib/plan-preview';
import { getRecentWeeks, type WeekDay } from '@/lib/session-history';
import { useAppColors } from '@/lib/theme-context';
import { getTrainingState } from '@/lib/training-state';
import type { TrainingState } from '@/lib/engine/training-state';
import { getProfile } from '@/lib/user-profile';
import {
  getBodyAreaBreakdown,
  getMovementPatternBreakdown,
  type BodyAreaBreakdown,
  type MovementPatternBreakdown,
} from '@/lib/workout-log';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_WEEK_COUNT = 4;
const BODY_AREA_LABELS: Record<BodyArea, string> = {
  upper: 'Upper Body',
  lower: 'Lower Body',
  core: 'Core',
  full: 'Full Body',
};
const BODY_AREA_ORDER: BodyArea[] = ['upper', 'lower', 'core', 'full'];
const TREND_LABEL: Record<'improving' | 'stable' | 'declining', string> = {
  improving: 'Improving',
  stable: 'Steady',
  declining: 'Trending down',
};
const TREND_ICON: Record<'improving' | 'stable' | 'declining', SFSymbol> = {
  improving: 'arrow.up.right',
  stable: 'arrow.right',
  declining: 'arrow.down.right',
};

/**
 * Real consistency and training-balance data only — no fabricated
 * performance deltas, since this app doesn't log sets/reps/weight so it
 * doesn't claim to show strength gains. The old "Your Potential" section
 * (a synthetic %-of-potential score + trajectory projection, computed by
 * the since-deleted potential-score.ts) was cut for the same anti-guilt
 * reasoning as onboarding/potential.tsx and Home's Fitness/Trends cards.
 */
export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [weeks, setWeeks] = useState<WeekDay[][]>([]);
  const [bodyAreaBreakdown, setBodyAreaBreakdown] = useState<BodyAreaBreakdown | null>(null);
  const [movementPatternBreakdown, setMovementPatternBreakdown] = useState<MovementPatternBreakdown | null>(null);
  const [trainingState, setTrainingState] = useState<TrainingState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gridRange, setGridRange] = useState<'week' | 'month'>('month');
  const weekCount = gridRange === 'week' ? 1 : MONTH_WEEK_COUNT;

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const profile = await getProfile();
        const trainingDays = profile?.days ? profile.days.split(',') : null;
        setWeeks(await getRecentWeeks(trainingDays, weekCount));
        setBodyAreaBreakdown(await getBodyAreaBreakdown());
        setMovementPatternBreakdown(await getMovementPatternBreakdown());
        setTrainingState(await getTrainingState());
        setLoaded(true);
      })();
    }, [weekCount])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const profile = await getProfile();
    const trainingDays = profile?.days ? profile.days.split(',') : null;
    setWeeks(await getRecentWeeks(trainingDays, weekCount));
    setBodyAreaBreakdown(await getBodyAreaBreakdown());
    setMovementPatternBreakdown(await getMovementPatternBreakdown());
    setTrainingState(await getTrainingState());
    setRefreshing(false);
  }, [weekCount]);

  if (!loaded) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonBlock width={130} height={24} borderRadius={6} />

          <View style={styles.section}>
            <SkeletonBlock width={90} height={11} borderRadius={4} />
            <View style={styles.summaryRow}>
              <SkeletonCard height={80} style={{ flex: 1 }} />
              <SkeletonCard height={80} style={{ flex: 1 }} />
            </View>
            <SkeletonCard height={200} lines={4} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const scheduledPast = weeks.flat().filter((d) => d.isScheduled && d.completed !== null);
  const completedPast = scheduledPast.filter((d) => d.completed);
  const completionRate = scheduledPast.length > 0 ? Math.round((completedPast.length / scheduledPast.length) * 100) : null;

  // Gated independently — capacityTrend reads session-history's energy log
  // (real data going back as far as that's been tracked), stimulusDebt reads
  // decision-trace-log (only started recording with this feature), so an
  // existing account can have one without the other for a while. Each
  // "insufficient" tier means exactly what it says: not enough real
  // observations yet, not zero — never shown as a confident claim either way.
  const showTrend = trainingState !== null && trainingState.capacityTrend.tier !== 'insufficient';
  const showDebt = trainingState !== null && trainingState.stimulusDebt.tier !== 'insufficient';
  const bankedAreas = trainingState
    ? BODY_AREA_ORDER.filter((area) => trainingState.stimulusDebt.value[area].debtSets > 0)
    : [];

  // The shape of real training done, not a score against a target — no
  // "total assigned" denominator anywhere in this computation. Each axis is
  // self-normalized against the user's OWN busiest area, not an external
  // 0–100 ideal, so whichever area they've done most of always reaches the
  // outer ring by definition. A quiet month still produces a full-reaching
  // shape (just possibly a lopsided one) instead of a shrunken one — the
  // chart can never read as "you didn't do enough," only "here's the
  // pattern." See radar-chart.tsx's own doc comment for why this replaced
  // the earlier current-vs-potential overlay design.
  const hasMovementData = bodyAreaBreakdown ? BODY_AREA_ORDER.some((area) => bodyAreaBreakdown[area].completed > 0) : false;
  const maxAreaCompleted = bodyAreaBreakdown
    ? Math.max(1, ...BODY_AREA_ORDER.map((area) => bodyAreaBreakdown[area].completed))
    : 1;
  const movementShapeData = bodyAreaBreakdown
    ? BODY_AREA_ORDER.map((area) => ({
        label: BODY_AREA_LABELS[area],
        value: Math.round((bodyAreaBreakdown[area].completed / maxAreaCompleted) * 100),
      }))
    : [];

  // Plain list, not a second radar — 12 real axes would be cluttered, and
  // grouping them into fewer buckets would mean inventing boundaries the
  // vault/engine never defined (see the pentagon-radar discussion this
  // matches). Only patterns something was actually logged against appear —
  // a pattern with zero real data isn't a zero score, it's just absent.
  // Multi-pattern exercises count toward each of their real patterns (see
  // getMovementPatternBreakdown's own doc comment), so this can sum to more
  // than the raw exercise count — that's correct, not a bug.
  const movementPatternRows = movementPatternBreakdown
    ? (Object.entries(movementPatternBreakdown) as [keyof typeof movementPatternBreakdown, { completed: number; total: number }][])
        .filter(([, counts]) => counts.total > 0)
        .sort((a, b) => b[1].total - a[1].total)
    : [];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.textSecondary} />
        }
      >
        <Text style={styles.screenTitle} maxFontSizeMultiplier={1.3}>Progress</Text>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>CONSISTENCY</Text>
            <View style={styles.rangeToggle}>
              {(['week', 'month'] as const).map((option) => (
                <Pressable
                  key={option}
                  style={[styles.rangeOption, gridRange === option && styles.rangeOptionActive]}
                  onPress={() => {
                    if (gridRange === option) return;
                    hapticSelect();
                    setGridRange(option);
                  }}
                >
                  <Text
                    style={[styles.rangeOptionText, gridRange === option && styles.rangeOptionTextActive]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {option === 'week' ? 'Week' : 'Month'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue} maxFontSizeMultiplier={1.15}>{completedPast.length}</Text>
              <Text style={styles.summaryLabel} maxFontSizeMultiplier={1.2}>Logged Sessions</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue} maxFontSizeMultiplier={1.15}>
                {completionRate !== null ? `${completionRate}%` : '—'}
              </Text>
              <Text style={styles.summaryLabel} maxFontSizeMultiplier={1.2}>
                {weekCount === 1 ? 'This Week' : `${weekCount}-Week Completion`}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.gridHeaderRow}>
              {WEEKDAY_LETTERS.map((letter, index) => (
                <Text key={index} style={styles.gridHeaderText} maxFontSizeMultiplier={1.15}>
                  {letter}
                </Text>
              ))}
            </View>
            {weeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.gridRow}>
                {week.map((day, dayIndex) => (
                  <View key={dayIndex} style={styles.gridCellWrap}>
                    {day.isScheduled ? (
                      <View
                        style={[
                          styles.gridCell,
                          day.completed === true && styles.gridCellCompleted,
                          day.completed === false && styles.gridCellMissed,
                          day.completed === null && styles.gridCellPending,
                        ]}
                      />
                    ) : (
                      <View style={styles.gridCellEmpty} />
                    )}
                  </View>
                ))}
              </View>
            ))}
            <View style={styles.legendRow}>
              <LegendDot styles={styles} style={styles.gridCellCompleted} label="Completed" />
              <LegendDot styles={styles} style={styles.gridCellMissed} label="Missed" />
              <LegendDot styles={styles} style={styles.gridCellPending} label="Upcoming" />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>TRAINING BALANCE</Text>
          {bodyAreaBreakdown && BODY_AREA_ORDER.some((area) => bodyAreaBreakdown[area].total > 0) ? (
            <View style={styles.card}>
              {hasMovementData ? (
                <>
                  <View style={styles.movementRadarWrap}>
                    <RadarChart size={172} data={movementShapeData} />
                  </View>
                  <Text style={styles.movementShapeCaption} maxFontSizeMultiplier={1.3}>
                    Your movement pattern so far — no target, just the shape.
                  </Text>
                </>
              ) : null}
              {BODY_AREA_ORDER.map((area, index) => {
                const { completed, total } = bodyAreaBreakdown[area];
                return (
                  <View
                    key={area}
                    style={[styles.balanceRow, index < BODY_AREA_ORDER.length - 1 && styles.rowDivider]}
                  >
                    <Text style={styles.balanceLabel} maxFontSizeMultiplier={1.3}>{BODY_AREA_LABELS[area]}</Text>
                    <Text style={styles.balanceCount} maxFontSizeMultiplier={1.2}>
                      {completed}/{total}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <SymbolView name="figure.strengthtraining.traditional" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
              <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                Finish a session and check off exercises to see your training balance here.
              </Text>
            </View>
          )}
        </View>

        {movementPatternRows.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>MOVEMENT PATTERNS</Text>
            <View style={styles.card}>
              <Text style={styles.movementShapeCaption} maxFontSizeMultiplier={1.3}>
                A more granular cut of the same real sessions — what kinds of movement, not just which body areas.
              </Text>
              {movementPatternRows.map(([pattern, counts], index) => (
                <View
                  key={pattern}
                  style={[styles.balanceRow, index < movementPatternRows.length - 1 && styles.rowDivider]}
                >
                  <Text style={styles.balanceLabel} maxFontSizeMultiplier={1.3}>{MOVEMENT_PATTERN_LABELS[pattern]}</Text>
                  <Text style={styles.balanceCount} maxFontSizeMultiplier={1.2}>
                    {counts.completed}/{counts.total}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>TRAINING LOAD</Text>
          {showTrend || showDebt ? (
            <View style={styles.card}>
              {showTrend && trainingState ? (
                <View style={[styles.trendRow, showDebt && styles.rowDivider]}>
                  <SymbolView
                    name={TREND_ICON[trainingState.capacityTrend.value]}
                    size={15}
                    tintColor={trainingState.capacityTrend.value === 'improving' ? '#5FBE84' : colors.textSecondary}
                  />
                  <Text style={styles.trendText} maxFontSizeMultiplier={1.3}>
                    Energy trend: <Text style={styles.trendValue}>{TREND_LABEL[trainingState.capacityTrend.value]}</Text>
                  </Text>
                </View>
              ) : null}
              {showDebt ? (
                bankedAreas.length > 0 ? (
                  <>
                    <Text style={styles.debtHint} maxFontSizeMultiplier={1.3}>
                      Banked volume — sets your plan called for that a lower-energy day trimmed, ready to make up on a
                      stronger one.
                    </Text>
                    {bankedAreas.map((area, index) => (
                      <View
                        key={area}
                        style={[styles.debtRow, index < bankedAreas.length - 1 && styles.rowDivider]}
                      >
                        <Text style={styles.balanceLabel} maxFontSizeMultiplier={1.3}>{BODY_AREA_LABELS[area]}</Text>
                        <Text style={styles.debtValue} maxFontSizeMultiplier={1.2}>
                          {trainingState?.stimulusDebt.value[area].debtSets} sets banked
                        </Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={styles.debtHint} maxFontSizeMultiplier={1.3}>
                    No banked volume right now — recent sessions delivered what your plan called for.
                  </Text>
                )
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <SymbolView name="chart.line.uptrend.xyaxis" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
              <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                Finish a few more sessions to see your energy trend and banked volume here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function LegendDot({
  styles,
  style,
  label,
}: {
  styles: ReturnType<typeof createStyles>;
  style: object;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, style]} />
      <Text style={styles.legendText} maxFontSizeMultiplier={1.2}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 20,
      gap: 28,
    },
    screenTitle: {
      color: colors.text,
      fontSize: 24,
      letterSpacing: -0.3,
      fontFamily: 'Geist-Bold',
    },
    section: {
      gap: 12,
    },
    sectionKicker: {
      color: colors.textTertiary,
      fontSize: 11,
      letterSpacing: 1,
      fontFamily: 'Geist-SemiBold',
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rangeToggle: {
      flexDirection: 'row',
      padding: 2,
      borderRadius: 8,
      backgroundColor: colors.pillBg,
    },
    rangeOption: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 6,
    },
    rangeOptionActive: {
      backgroundColor: colors.surface,
    },
    rangeOptionText: {
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: 'Geist-SemiBold',
    },
    rangeOptionTextActive: {
      color: colors.text,
    },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 16,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    movementRadarWrap: {
      alignItems: 'center',
      marginTop: 4,
    },
    movementShapeCaption: {
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 12,
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: 'Geist-Medium',
    },
    // Plain numbers, no fill bar — the vault's brand system treats progress
    // bars as permanently off-limits (same reasoning as dropping streaks:
    // a bar reads as a score to chase, a number is just a fact).
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    balanceLabel: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    balanceCount: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    trendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    trendText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    trendValue: {
      color: colors.text,
      fontFamily: 'Geist-SemiBold',
    },
    debtHint: {
      paddingVertical: 12,
      color: colors.textTertiary,
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Geist-Medium',
    },
    debtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    debtValue: {
      color: '#5FBE84',
      fontSize: 12.5,
      fontFamily: 'Geist-SemiBold',
    },
    emptyCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 20,
      alignItems: 'center',
    },
    emptyIcon: {
      marginBottom: 10,
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: 12.5,
      fontFamily: 'Geist-Medium',
      lineHeight: 18,
      textAlign: 'center',
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 12,
    },
    summaryCard: {
      flex: 1,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingVertical: 18,
      alignItems: 'center',
    },
    summaryValue: {
      color: colors.text,
      fontSize: 24,
      letterSpacing: -0.4,
      fontFamily: 'Geist-Black',
    },
    summaryLabel: {
      marginTop: 4,
      color: colors.textTertiary,
      fontSize: 10.5,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontFamily: 'Geist-Medium',
    },
    gridHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    gridHeaderText: {
      width: 28,
      textAlign: 'center',
      color: colors.iconFaint,
      fontSize: 10,
      fontFamily: 'Geist-SemiBold',
    },
    gridRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    gridCellWrap: {
      width: 28,
      alignItems: 'center',
    },
    gridCell: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
    },
    gridCellEmpty: {
      width: 22,
      height: 22,
    },
    gridCellCompleted: {
      backgroundColor: '#438C63',
      borderColor: '#5FBE84',
    },
    // Neutral, not alarm-red — a day that passed without a session is a
    // fact, not a failure. Same reasoning as dropping streaks: the visual
    // language shouldn't punish a quiet day any more than the copy does.
    gridCellMissed: {
      backgroundColor: colors.pillBg,
      borderColor: colors.pillBorder,
    },
    gridCellPending: {
      backgroundColor: 'transparent',
      borderColor: colors.pillBorder,
    },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
      marginTop: 8,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
    },
    legendText: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: 'Geist-Medium',
    },
  });
}
