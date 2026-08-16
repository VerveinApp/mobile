import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TrajectoryBars } from '@/components/onboarding/trajectory-bars';
import { RadarChart } from '@/components/onboarding/radar-chart';
import { hapticSelect } from '@/lib/haptics';
import type { BodyArea } from '@/lib/plan-preview';
import { computePotential, type PotentialResult } from '@/lib/potential-score';
import { getRecentWeeks, type WeekDay } from '@/lib/session-history';
import { useAppColors } from '@/lib/theme-context';
import { getTrainingState } from '@/lib/training-state';
import type { TrainingState } from '@/lib/engine/training-state';
import { getProfile } from '@/lib/user-profile';
import { getBodyAreaBreakdown, type BodyAreaBreakdown } from '@/lib/workout-log';
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
 * The real "trend detail" destination Profile's potential card links to.
 * Two honest sections: the same potential estimate shown compactly on
 * Profile, expanded with a trajectory projection; and actual consistency
 * data from session-history.ts. No fabricated performance deltas — this app
 * doesn't log sets/reps/weight, so it doesn't claim to show strength gains.
 */
export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [potential, setPotential] = useState<PotentialResult | null>(null);
  const [weeks, setWeeks] = useState<WeekDay[][]>([]);
  const [bodyAreaBreakdown, setBodyAreaBreakdown] = useState<BodyAreaBreakdown | null>(null);
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
        setPotential(computePotential(profile ?? {}));
        setWeeks(await getRecentWeeks(trainingDays, weekCount));
        setBodyAreaBreakdown(await getBodyAreaBreakdown());
        setTrainingState(await getTrainingState());
        setLoaded(true);
      })();
    }, [weekCount])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const profile = await getProfile();
    const trainingDays = profile?.days ? profile.days.split(',') : null;
    setPotential(computePotential(profile ?? {}));
    setWeeks(await getRecentWeeks(trainingDays, weekCount));
    setBodyAreaBreakdown(await getBodyAreaBreakdown());
    setTrainingState(await getTrainingState());
    setRefreshing(false);
  }, [weekCount]);

  if (!loaded || !potential) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonBlock width={130} height={24} borderRadius={6} />

          <View style={styles.section}>
            <SkeletonBlock width={110} height={11} borderRadius={4} />
            <SkeletonCard height={280} lines={3} />
            <SkeletonCard height={150} lines={3} />
            <SkeletonCard height={130} lines={2} />
          </View>

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

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.textSecondary} />
        }
      >
        <Text style={styles.screenTitle}>Progress</Text>

        <View style={styles.section}>
          <Text style={styles.sectionKicker}>YOUR POTENTIAL</Text>
          <View style={styles.card}>
            <View style={styles.radarWrap}>
              <RadarChart
                size={220}
                data={potential.pillars.map((p) => ({ label: p.label, value: p.value }))}
              />
            </View>
            <Text style={styles.potentialValue}>{potential.overall}%</Text>
            <Text style={styles.potentialLabel}>Overall Potential</Text>
            {potential.leadPillars.length > 0 ? (
              <Text style={styles.insightText}>
                With your inputs, you have high potential for{' '}
                <Text style={styles.insightAccent}>
                  {potential.leadPillars[0]?.toLowerCase()} and {potential.leadPillars[1]?.toLowerCase()}
                </Text>
                .
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            {potential.pillars.map((pillar, index) => (
              <View
                key={pillar.key}
                style={[styles.pillarRow, index < potential.pillars.length - 1 && styles.rowDivider]}
              >
                <Text style={styles.pillarLabel}>{pillar.label}</Text>
                <View style={styles.pillarRight}>
                  <Text style={styles.pillarTier}>{pillar.tier}</Text>
                  <Text style={styles.pillarValue}>{pillar.value}%</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.trajectoryHint}>A hedged projection, not a guarantee — where consistent training could take this estimate.</Text>
            <View style={styles.trajectoryWrap}>
              <TrajectoryBars points={potential.trajectory} maxHeight={110} barWidth={72} />
            </View>
            <Text style={styles.trajectoryNote}>
              Stay consistent and you could reach <Text style={styles.trajectoryNoteAccent}>{potential.peak}%</Text> within a
              year.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionKicker}>CONSISTENCY</Text>
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
                  <Text style={[styles.rangeOptionText, gridRange === option && styles.rangeOptionTextActive]}>
                    {option === 'week' ? 'Week' : 'Month'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{completedPast.length}</Text>
              <Text style={styles.summaryLabel}>Logged Sessions</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{completionRate !== null ? `${completionRate}%` : '—'}</Text>
              <Text style={styles.summaryLabel}>{weekCount === 1 ? 'This Week' : `${weekCount}-Week Completion`}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.gridHeaderRow}>
              {WEEKDAY_LETTERS.map((letter, index) => (
                <Text key={index} style={styles.gridHeaderText}>
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
          <Text style={styles.sectionKicker}>TRAINING BALANCE</Text>
          {bodyAreaBreakdown && BODY_AREA_ORDER.some((area) => bodyAreaBreakdown[area].total > 0) ? (
            <View style={styles.card}>
              {hasMovementData ? (
                <>
                  <View style={styles.movementRadarWrap}>
                    <RadarChart size={172} data={movementShapeData} />
                  </View>
                  <Text style={styles.movementShapeCaption}>Your movement this month — no target, just the pattern.</Text>
                </>
              ) : null}
              {BODY_AREA_ORDER.map((area, index) => {
                const { completed, total } = bodyAreaBreakdown[area];
                return (
                  <View
                    key={area}
                    style={[styles.balanceRow, index < BODY_AREA_ORDER.length - 1 && styles.rowDivider]}
                  >
                    <Text style={styles.balanceLabel}>{BODY_AREA_LABELS[area]}</Text>
                    <Text style={styles.balanceCount}>
                      {completed}/{total}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <SymbolView name="figure.strengthtraining.traditional" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>
                Finish a session and check off exercises to see your training balance here.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionKicker}>TRAINING LOAD</Text>
          {showTrend || showDebt ? (
            <View style={styles.card}>
              {showTrend && trainingState ? (
                <View style={[styles.trendRow, showDebt && styles.rowDivider]}>
                  <SymbolView
                    name={TREND_ICON[trainingState.capacityTrend.value]}
                    size={15}
                    tintColor={trainingState.capacityTrend.value === 'improving' ? '#5FBE84' : colors.textSecondary}
                  />
                  <Text style={styles.trendText}>
                    Energy trend: <Text style={styles.trendValue}>{TREND_LABEL[trainingState.capacityTrend.value]}</Text>
                  </Text>
                </View>
              ) : null}
              {showDebt ? (
                bankedAreas.length > 0 ? (
                  <>
                    <Text style={styles.debtHint}>
                      Banked volume — sets your plan called for that a lower-energy day trimmed, ready to make up on a
                      stronger one.
                    </Text>
                    {bankedAreas.map((area, index) => (
                      <View
                        key={area}
                        style={[styles.debtRow, index < bankedAreas.length - 1 && styles.rowDivider]}
                      >
                        <Text style={styles.balanceLabel}>{BODY_AREA_LABELS[area]}</Text>
                        <Text style={styles.debtValue}>
                          {trainingState?.stimulusDebt.value[area].debtSets} sets banked
                        </Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={styles.debtHint}>No banked volume right now — recent sessions delivered what your plan called for.</Text>
                )
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <SymbolView name="chart.line.uptrend.xyaxis" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>
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
      <Text style={styles.legendText}>{label}</Text>
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
    radarWrap: {
      alignItems: 'center',
      marginBottom: 4,
    },
    potentialValue: {
      textAlign: 'center',
      color: colors.text,
      fontSize: 26,
      letterSpacing: -0.4,
      fontFamily: 'Geist-Black',
    },
    potentialLabel: {
      textAlign: 'center',
      marginTop: 2,
      color: colors.textTertiary,
      fontSize: 10.5,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontFamily: 'Geist-Medium',
    },
    insightText: {
      textAlign: 'center',
      marginTop: 10,
      paddingHorizontal: 20,
      color: colors.textSecondary,
      fontSize: 11.5,
      lineHeight: 17,
      fontFamily: 'Geist-Regular',
    },
    insightAccent: {
      color: '#438C63',
      fontFamily: 'Geist-SemiBold',
    },
    pillarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
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
    pillarLabel: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    pillarRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pillarTier: {
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: 'Geist-Medium',
    },
    pillarValue: {
      color: '#5FBE84',
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
      width: 40,
      textAlign: 'right',
    },
    trajectoryHint: {
      color: colors.textTertiary,
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Geist-Medium',
      marginBottom: 8,
    },
    trajectoryWrap: {
      paddingTop: 4,
    },
    trajectoryNote: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    trajectoryNoteAccent: {
      color: '#5FBE84',
      fontFamily: 'Geist-Bold',
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
