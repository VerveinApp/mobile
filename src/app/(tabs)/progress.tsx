import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import type { SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SymbolView } from '@/components/ui/app-symbol';
import { RadarChart } from '@/components/onboarding/radar-chart';
import { TabularNums, Type } from '@/constants/theme';
import { PremiumGate } from '@/components/premium-gate';
import { Sparkline } from '@/components/ui/sparkline';
import { BODY_AREA_LABELS, BODY_AREA_ORDER } from '@/lib/body-area-labels';
import { getImprovedExercises, getPerformanceHistory, type ExercisePerformance } from '@/lib/exercise-performance';
import { hapticSelect } from '@/lib/haptics';
import { MOVEMENT_PATTERN_LABELS } from '@/lib/movement-pattern-labels';
import { usePremiumEntitlement } from '@/lib/purchases';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { getRecentWeeks, type WeekDay } from '@/lib/session-history';
import { useAppTheme } from '@/lib/theme-context';
import { getTrainingState } from '@/lib/training-state-loader';
import type { TrainingState } from '@/lib/engine/training-state';
import { getProfile, type UserProfile } from '@/lib/user-profile';
import {
  getBodyAreaBreakdown,
  getLoggedSessionCount,
  getMovementPatternBreakdown,
  type BodyAreaBreakdown,
  type MovementPatternBreakdown,
} from '@/lib/workout-log';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_WEEK_COUNT = 4;
// A rolling trailing cutoff, not a calendar-week reset — see
// workout-log.ts's sinceDateStr for why a hard reset was rejected (it would
// collapse the shape to near-empty every reset moment, fighting this
// section's own "never reads as you didn't do enough" design). 7 days,
// always trailing today — "the last week," never "since Monday."
const RECENT_BALANCE_WINDOW_DAYS = 7;
// The self-normalized radar scales each axis against the user's OWN busiest
// area — real, deliberate, and documented below (hasMovementData's comment).
// But with EXERCISES_PER_FOCUS_AREA at 2 (policy-parameters.ts), that means
// a single session can already max an axis (2 completed / its own max of 2
// = 100%), which reads as an "achieved" shape after one day — exactly
// backwards from what a shape built from real history should communicate.
// Requiring a few distinct real sessions first (not just areasWithData >= 2)
// is what actually fixes that, without touching the normalization math
// itself, which has its own separate, still-valid rationale.
const MIN_SESSIONS_FOR_SHAPE = 3;
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

// Local-date parsing (not `new Date(dateStr)`) to avoid the classic UTC
// off-by-one — same pattern every other dated-history screen in this app
// already uses for its own formatEntryDate.
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Only fetches history for the exercises actually being shown, not the
 * whole exercise-performance store — improvedExercises is already the
 * filtered, real list Strength Progress renders. */
async function loadExerciseHistories(
  exercises: { exerciseName: string }[]
): Promise<Record<string, ExercisePerformance[]>> {
  const entries = await Promise.all(
    exercises.map(async (e) => [e.exerciseName, await getPerformanceHistory(e.exerciseName)] as const)
  );
  return Object.fromEntries(entries);
}

// A real calendar reference for each row — the grid otherwise only ever
// showed weekday letters (M T W …), with no way to tell which actual week a
// row in a 4-week-stacked Month view was without counting backward by hand.
function formatWeekRange(week: WeekDay[]): string {
  const start = parseLocalDate(week[0].date);
  const end = parseLocalDate(week[6].date);
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel =
    start.getMonth() === end.getMonth()
      ? end.toLocaleDateString('en-US', { day: 'numeric' })
      : end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startLabel}–${endLabel}`;
}

function formatEntryDateLabel(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/**
 * Real consistency and training-balance data only — no fabricated
 * performance deltas. The old "Your Potential" section (a synthetic
 * %-of-potential score + trajectory projection, computed by the
 * since-deleted potential-score.ts) was cut for the same anti-guilt
 * reasoning as onboarding/potential.tsx and Home's Fitness/Trends cards.
 * STRENGTH PROGRESS below is a real exception, not a reversal of that rule:
 * it only ever reports a genuine, self-referential 1RM improvement someone
 * opted into logging (see exercise-performance.ts) — never a synthetic
 * score, never a comparison to anyone but their own last session.
 */
export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { colors, resolvedScheme } = useAppTheme();
  const isDark = resolvedScheme === 'dark';
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const isPremium = usePremiumEntitlement();
  // Same shared fade used across onboarding, check-in, and Home — the
  // loading-skeleton-to-real-content swap below previously hard-cut with no
  // transition, the one motion-language gap against the rest of the app.
  const entering = useFadeInEntering();
  const [weeks, setWeeks] = useState<WeekDay[][]>([]);
  const [bodyAreaBreakdown, setBodyAreaBreakdown] = useState<BodyAreaBreakdown | null>(null);
  const [movementPatternBreakdown, setMovementPatternBreakdown] = useState<MovementPatternBreakdown | null>(null);
  const [loggedSessionCount, setLoggedSessionCount] = useState(0);
  const [trainingState, setTrainingState] = useState<TrainingState | null>(null);
  const [improvedExercises, setImprovedExercises] = useState<
    { exerciseName: string; performance: ExercisePerformance }[]
  >([]);
  // Full logged history per exercise, keyed by name — only fetched for the
  // exercises actually shown (improvedExercises), not the whole store.
  // Powers each row's own line trend below its current 1RM stat.
  const [exerciseHistories, setExerciseHistories] = useState<Record<string, ExercisePerformance[]>>({});
  const [strengthChartWidth, setStrengthChartWidth] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gridRange, setGridRange] = useState<'week' | 'month'>('month');
  const weekCount = gridRange === 'week' ? 1 : MONTH_WEEK_COUNT;
  // Defaults matching the pre-existing, unwindowed behavior — nothing
  // changes for someone who never touches either toggle.
  const [balanceRange, setBalanceRange] = useState<'recent' | 'all'>('all');
  const [balanceView, setBalanceView] = useState<'body-area' | 'pattern'>('body-area');
  const balanceSinceDays = balanceRange === 'recent' ? RECENT_BALANCE_WINDOW_DAYS : undefined;
  const [consistencyMeterWidth, setConsistencyMeterWidth] = useState(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const loadedProfile = await getProfile();
        setProfile(loadedProfile);
        const trainingDays = loadedProfile?.days ? loadedProfile.days.split(',') : null;
        setWeeks(await getRecentWeeks(trainingDays, weekCount));
        setBodyAreaBreakdown(await getBodyAreaBreakdown(balanceSinceDays));
        setMovementPatternBreakdown(await getMovementPatternBreakdown(balanceSinceDays));
        setLoggedSessionCount(await getLoggedSessionCount(balanceSinceDays));
        setTrainingState(await getTrainingState());
        const improved = await getImprovedExercises();
        setImprovedExercises(improved);
        setExerciseHistories(await loadExerciseHistories(improved));
        setLoaded(true);
      })();
    }, [weekCount, balanceSinceDays])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const loadedProfile = await getProfile();
    setProfile(loadedProfile);
    const trainingDays = loadedProfile?.days ? loadedProfile.days.split(',') : null;
    setWeeks(await getRecentWeeks(trainingDays, weekCount));
    setBodyAreaBreakdown(await getBodyAreaBreakdown(balanceSinceDays));
    setMovementPatternBreakdown(await getMovementPatternBreakdown(balanceSinceDays));
    setLoggedSessionCount(await getLoggedSessionCount(balanceSinceDays));
    setTrainingState(await getTrainingState());
    const improved = await getImprovedExercises();
    setImprovedExercises(improved);
    setExerciseHistories(await loadExerciseHistories(improved));
    setRefreshing(false);
  }, [weekCount, balanceSinceDays]);

  if (!loaded) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 140 + insets.bottom }]}
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
  // Weeks entirely before the account existed have no scheduled days at all
  // (see session-history.ts's own account-start-date exclusion) — trimming
  // them instead of rendering an empty shell row is what actually fixes a
  // brand-new account showing 3 blank weeks above its one real one.
  const visibleWeeks = weeks.filter((week) => week.some((d) => d.isScheduled));
  // Weekly completion rate as its own trend line — the calendar below already
  // shows the day-by-day detail; this is the same real data one level up,
  // "how did each whole week go" rather than "how did each day go." Only
  // resolved (non-future) scheduled days count toward a week's rate, so an
  // in-progress current week isn't penalized for days that haven't happened
  // yet — same exclusion completionRate above already applies.
  const consistencyMeterData = visibleWeeks
    .map((week) => {
      const resolved = week.filter((d) => d.isScheduled && d.completed !== null);
      if (resolved.length === 0) return null;
      const completed = resolved.filter((d) => d.completed);
      return { value: Math.round((completed.length / resolved.length) * 100) };
    })
    .filter((point): point is { value: number } => point !== null);
  // First-vs-last comparison, not a recent-vs-earlier mean split like
  // training-state.ts's own capacityTrend — that split needs more points
  // than this typically-4-week window ever has. Same honest-default
  // methodology though: a real double-digit swing before calling it a
  // trend at all, 'stable' otherwise (never a fabricated direction off
  // noise). Reuses TREND_ICON/TREND_LABEL below rather than a second,
  // driftable copy of the same icon/label set Training Load's own energy
  // trend already uses.
  const CONSISTENCY_TREND_DELTA = 15;
  const consistencyTrend: 'improving' | 'stable' | 'declining' =
    consistencyMeterData.length < 2
      ? 'stable'
      : (() => {
          const delta = consistencyMeterData[consistencyMeterData.length - 1].value - consistencyMeterData[0].value;
          if (delta > CONSISTENCY_TREND_DELTA) return 'improving';
          if (delta < -CONSISTENCY_TREND_DELTA) return 'declining';
          return 'stable';
        })();

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
  // Self-normalized against the user's own busiest banked area, same
  // "no external target" register the radar/donut already use — a bar's
  // length here is a magnitude comparison between real areas, never a
  // fraction of some assigned ceiling, so this isn't the fill-toward-a-
  // target bar the vault's brand system rules out (see balanceRow's own
  // comment on that rule).
  const maxBankedSets =
    trainingState && bankedAreas.length > 0
      ? Math.max(1, ...bankedAreas.map((area) => trainingState.stimulusDebt.value[area].debtSets))
      : 1;

  // Relative strength (Vervein addition) — same "no fabricated default"
  // discipline check-in.tsx's own calorie estimate already applies to this
  // exact field: a positive bodyweight or nothing, never a guessed average.
  // Self-referential only, same as everything else in this section — 1RM ÷
  // OWN latest bodyweight, never a population strength-standard percentile.
  const weightKg = Number(profile?.weightKg);

  // The shape of real training done, not a score against a target — no
  // "total assigned" denominator anywhere in this computation. Each axis is
  // self-normalized against the user's OWN busiest area, not an external
  // 0–100 ideal, so whichever area they've done most of always reaches the
  // outer ring by definition. A quiet month still produces a full-reaching
  // shape (just possibly a lopsided one) instead of a shrunken one — the
  // chart can never read as "you didn't do enough," only "here's the
  // pattern." See radar-chart.tsx's own doc comment for why this replaced
  // the earlier current-vs-potential overlay design.
  // Requires real spread across at least 2 areas, not just "something,
  // somewhere" — one completed exercise alone produces a single full spike
  // and three empty axes, which reads as a broken chart rather than an
  // honest shape. The plain list below has no such guard: a lone "1/3" row
  // is a perfectly honest fact on its own, it's only the radar's geometry
  // that misleads with too little spread.
  const areasWithData = bodyAreaBreakdown ? BODY_AREA_ORDER.filter((area) => bodyAreaBreakdown[area].completed > 0).length : 0;
  // AND, not OR — see MIN_SESSIONS_FOR_SHAPE's own comment above for why
  // area-spread alone isn't enough: a single session can already touch 2+
  // areas and self-normalize each to 100%, which is exactly the "achieved
  // too easily" case this second condition exists to block.
  const hasMovementData = areasWithData >= 2 && loggedSessionCount >= MIN_SESSIONS_FOR_SHAPE;
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
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 140 + insets.bottom }]}
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

          {/* BUG FIX: this used to be its own separate PremiumGate, right
              above the calendar's own — for anyone not on Plus, that meant
              two identical "The consistency calendar is part of VerveIn
              Plus" teaser cards stacked back-to-back, since both gates
              shared the same label. One gate wrapping both real sections
              below. */}
          <PremiumGate isPremium={isPremium} label="The consistency calendar">
            {consistencyMeterData.length >= 2 ? (
              <View style={styles.card}>
                <View style={styles.chartCaptionRow}>
                  <Text style={styles.chartCaption} maxFontSizeMultiplier={1.3}>Weekly completion</Text>
                  <View style={styles.chartTrendIndicator}>
                    <SymbolView
                      name={TREND_ICON[consistencyTrend]}
                      size={11}
                      tintColor={consistencyTrend === 'improving' ? '#5FBE84' : colors.textTertiary}
                    />
                    <Text style={styles.chartTrendText} maxFontSizeMultiplier={1.2}>
                      {TREND_LABEL[consistencyTrend]}
                    </Text>
                  </View>
                </View>
                <View
                  style={styles.chartCardInner}
                  onLayout={(e) => setConsistencyMeterWidth(e.nativeEvent.layout.width)}
                >
                  {consistencyMeterWidth > 0 ? (
                    <Sparkline
                      data={consistencyMeterData}
                      width={consistencyMeterWidth}
                      height={64}
                      min={0}
                      max={100}
                      filled
                      color="#5FBE84"
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
            <View style={styles.card}>
              {visibleWeeks.length === 0 ? (
                <View style={styles.emptyCard}>
                  <SymbolView name="calendar" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
                  <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                    Nothing scheduled yet — this fills in once your plan has its first training day.
                  </Text>
                </View>
              ) : (
                <>
              <View style={styles.gridHeaderRow}>
                {WEEKDAY_LETTERS.map((letter, index) => (
                  <Text key={index} style={styles.gridHeaderText} maxFontSizeMultiplier={1.15}>
                    {letter}
                  </Text>
                ))}
              </View>
              {visibleWeeks.map((week, weekIndex) => {
                const scheduledInWeek = week.filter((d) => d.isScheduled);
                const completedInWeek = scheduledInWeek.filter((d) => d.completed);
                return (
                  <View key={weekIndex} style={styles.gridWeekBlock}>
                    {/* A real date reference plus a plain count per row — no
                        fill bar (this app's brand system treats those as
                        permanently off-limits), just the two facts someone
                        would otherwise have to count out by hand. */}
                    <View style={styles.gridWeekLabelRow}>
                      <Text style={styles.gridWeekLabel} maxFontSizeMultiplier={1.2}>
                        {formatWeekRange(week)}
                      </Text>
                      {scheduledInWeek.length > 0 ? (
                        <Text style={styles.gridWeekCount} maxFontSizeMultiplier={1.2}>
                          {completedInWeek.length}/{scheduledInWeek.length}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.gridRow}>
                      {week.map((day, dayIndex) => (
                        <View key={dayIndex} style={styles.gridCellWrap}>
                          {day.isScheduled ? (
                            <Pressable
                              disabled={day.completed === null}
                              onPress={() => {
                                hapticSelect();
                                // Progress & History itself is Plus-only —
                                // this calendar stays free, but drilling
                                // into a specific day's detail is the same
                                // gated screen Settings' own DATA section
                                // links to.
                                router.push(
                                  (isPremium
                                    ? { pathname: '/settings/progress-history', params: { date: day.date } }
                                    : '/paywall') as never
                                );
                              }}
                              accessibilityRole={day.completed === null ? undefined : 'button'}
                              accessibilityLabel={
                                day.completed === null
                                  ? undefined
                                  : `${formatEntryDateLabel(day.date)}, ${day.completed ? 'completed' : 'missed'}. Tap for detail.`
                              }
                              style={[
                                styles.gridCell,
                                day.completed === true && styles.gridCellCompleted,
                                // Fixed bug: previously `day.completed === false`
                                // only — a past day with zero recorded entry
                                // (completed: null, not false — see WeekDay's own
                                // doc comment) fell through to gridCellPending
                                // below and rendered as "Upcoming" even though it
                                // had already happened. !isFuture alone isn't
                                // enough either: today is also !isFuture and
                                // typically still completed:null before check-in,
                                // so today is explicitly excluded from "Missed" —
                                // the day isn't over yet.
                                !day.isFuture && !day.isToday && day.completed !== true && styles.gridCellMissed,
                                (day.isFuture || day.isToday) && day.completed !== true && styles.gridCellPending,
                                // Layered last so it wins regardless of which
                                // state the cell is otherwise in — today needs
                                // to be findable at a glance in a 4-week grid
                                // without changing what its fill already says.
                                day.isToday && styles.gridCellToday,
                              ]}
                            />
                          ) : (
                            <View style={styles.gridCellEmpty} />
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
              <View style={styles.legendRow}>
                <LegendDot styles={styles} style={styles.gridCellCompleted} label="Completed" />
                <LegendDot styles={styles} style={styles.gridCellMissed} label="Missed" />
                <LegendDot styles={styles} style={styles.gridCellPending} label="Upcoming" />
              </View>
                </>
              )}
            </View>
          </PremiumGate>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>TRAINING BALANCE</Text>
            <View style={styles.rangeToggle}>
              {(['recent', 'all'] as const).map((option) => (
                <Pressable
                  key={option}
                  style={[styles.rangeOption, balanceRange === option && styles.rangeOptionActive]}
                  onPress={() => {
                    if (balanceRange === option) return;
                    hapticSelect();
                    setBalanceRange(option);
                  }}
                >
                  <Text
                    style={[styles.rangeOptionText, balanceRange === option && styles.rangeOptionTextActive]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {option === 'recent' ? 'Last 7 Days' : 'All'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <PremiumGate isPremium={isPremium} label="Training Balance">
            {bodyAreaBreakdown && BODY_AREA_ORDER.some((area) => bodyAreaBreakdown[area].total > 0) ? (
              <View style={styles.card}>
                {hasMovementData ? (
                  <>
                    <View style={styles.movementRadarWrap}>
                      <RadarChart size={172} data={movementShapeData} />
                    </View>
                    <Text style={styles.movementShapeCaption} maxFontSizeMultiplier={1.3}>
                      {balanceRange === 'recent'
                        ? 'Your movement pattern, last 7 days — no target, just the shape.'
                        : 'Your movement pattern so far — no target, just the shape.'}
                    </Text>
                  </>
                ) : areasWithData >= 2 ? (
                  // Real data across 2+ areas already, just not from enough
                  // distinct sessions yet — same neutral, no-pressure register
                  // as the shown caption above, explaining an absence rather
                  // than leaving it unexplained.
                  <Text style={styles.movementShapeCaption} maxFontSizeMultiplier={1.3}>
                    Your shape will show once a few more sessions are logged.
                  </Text>
                ) : null}
                {/* Same real sessions, one more granular cut — a toggle instead
                    of a second full section, since movementPatternRows' own
                    comment already called this "a more granular cut of the
                    same real sessions," not a different dataset. */}
                {movementPatternRows.length > 0 ? (
                  <View style={styles.balanceViewToggleWrap}>
                    <View style={styles.rangeToggle}>
                      {(['body-area', 'pattern'] as const).map((option) => (
                        <Pressable
                          key={option}
                          style={[styles.rangeOption, balanceView === option && styles.rangeOptionActive]}
                          onPress={() => {
                            if (balanceView === option) return;
                            hapticSelect();
                            setBalanceView(option);
                          }}
                        >
                          <Text
                            style={[styles.rangeOptionText, balanceView === option && styles.rangeOptionTextActive]}
                            maxFontSizeMultiplier={1.2}
                          >
                            {option === 'body-area' ? 'Body Area' : 'Movement'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
                {balanceView === 'body-area'
                  ? BODY_AREA_ORDER.map((area, index) => {
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
                    })
                  : movementPatternRows.map(([pattern, counts], index) => (
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
            ) : (
              <View style={styles.emptyCard}>
                <SymbolView name="figure.strengthtraining.traditional" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
                <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                  {balanceRange === 'recent'
                    ? 'No sessions in the last 7 days yet — switch to All to see your full history.'
                    : 'Finish a session and check off exercises to see your training balance here.'}
                </Text>
              </View>
            )}
          </PremiumGate>
        </View>

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
                    {bankedAreas.map((area, index) => {
                      const debtSets = trainingState?.stimulusDebt.value[area].debtSets ?? 0;
                      const barFraction = Math.min(1, debtSets / maxBankedSets);
                      return (
                        <View
                          key={area}
                          style={[styles.debtRowStacked, index < bankedAreas.length - 1 && styles.rowDivider]}
                        >
                          <View style={styles.debtRow}>
                            <Text style={styles.balanceLabel} maxFontSizeMultiplier={1.3}>{BODY_AREA_LABELS[area]}</Text>
                            <Text style={styles.debtValue} maxFontSizeMultiplier={1.2}>{debtSets} sets banked</Text>
                          </View>
                          <View style={styles.barTrack}>
                            <View style={[styles.barFill, { width: `${barFraction * 100}%` }]} />
                          </View>
                        </View>
                      );
                    })}
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

        {/* Plus-gated — same "deeper insight" tier as Training Load and
            Training Balance above. Only ever lists an exercise someone
            opted into logging a weight for AND that showed a real 1RM
            improvement — most people will see the empty state, and that's
            the honest default, not a lesser version of this section. */}
        <View style={styles.section}>
          <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>STRENGTH PROGRESS</Text>
          <PremiumGate isPremium={isPremium} label="Strength Progress">
            {improvedExercises.length > 0 ? (
              <View style={styles.card}>
                {improvedExercises.map((entry, index) => {
                  // Real logged history, not just the current stat — needs
                  // 2+ points to draw an actual line (a single point is a
                  // dot, not a trend, and not worth its own chart row).
                  const history = exerciseHistories[entry.exerciseName] ?? [];
                  const showChart = history.length >= 2;
                  return (
                    <View
                      key={entry.exerciseName}
                      style={index < improvedExercises.length - 1 ? styles.rowDivider : undefined}
                    >
                      <View style={styles.debtRow}>
                        <Text style={styles.balanceLabel} maxFontSizeMultiplier={1.3}>{entry.exerciseName}</Text>
                        <View style={styles.strengthProgressStats}>
                          <View style={styles.strengthProgressValue}>
                            <SymbolView name="arrow.up.right" size={12} tintColor="#5FBE84" />
                            <Text style={styles.debtValue} maxFontSizeMultiplier={1.2}>
                              {Math.round(entry.performance.estimatedOneRepMax)} kg est. 1RM
                            </Text>
                          </View>
                          {weightKg > 0 ? (
                            <Text style={styles.strengthProgressRelative} maxFontSizeMultiplier={1.3}>
                              {(entry.performance.estimatedOneRepMax / weightKg).toFixed(2)}× bodyweight
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {showChart ? (
                        <View
                          style={[styles.sparklineWrap, styles.sparklineWrapPadded]}
                          onLayout={(e) => setStrengthChartWidth(e.nativeEvent.layout.width)}
                        >
                          {strengthChartWidth > 0 ? (
                            <Sparkline
                              data={history.map((h) => ({ value: h.estimatedOneRepMax }))}
                              width={strengthChartWidth}
                              height={40}
                              color="#5FBE84"
                            />
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <SymbolView name="arrow.up.right" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
                <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                  Log a weight next time you finish a strength exercise to see your progress here.
                </Text>
              </View>
            )}
          </PremiumGate>
        </View>
      </ScrollView>
      </ReanimatedAnimated.View>
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

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    fadeLayer: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      gap: 28,
    },
    screenTitle: {
      color: colors.text,
      fontSize: Type.display,
      letterSpacing: -0.3,
      fontFamily: 'Geist-Bold',
    },
    section: {
      gap: 12,
    },
    sectionKicker: {
      color: colors.textTertiary,
      fontSize: Type.caption,
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
      fontSize: Type.caption,
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
    chartCaptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    chartCaption: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      fontFamily: 'Geist-SemiBold',
    },
    chartTrendIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    chartTrendText: {
      color: colors.textSecondary,
      fontSize: Type.caption,
      fontFamily: 'Geist-SemiBold',
    },
    // No padding of its own — this is the View onLayout measures to size
    // the chart itself; a horizontal padding here would silently shrink
    // the chart's usable width below its measured box.
    chartCardInner: {
      width: '100%',
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
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
    },
    // Reuses rangeToggle/rangeOption's exact pill styling (same segmented-
    // control language as the section-header range toggle) — just needs its
    // own wrapper for in-card centering/spacing instead of the header row's
    // space-between layout.
    balanceViewToggleWrap: {
      alignItems: 'center',
      marginBottom: 12,
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
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    balanceCount: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
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
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    trendValue: {
      color: colors.text,
      fontFamily: 'Geist-SemiBold',
    },
    sparklineWrap: {
      width: '100%',
    },
    // Only ever adds vertical padding — never horizontal, since this View
    // is also what onLayout measures to size the Sparkline itself; a
    // horizontal padding here would silently shrink the chart's usable
    // width below its measured box (the exact bug weight-history.tsx's own
    // chart card fixed once already).
    sparklineWrapPadded: {
      paddingBottom: 12,
    },
    debtHint: {
      paddingVertical: 12,
      color: colors.textTertiary,
      fontSize: Type.caption,
      lineHeight: 16,
      fontFamily: 'Geist-Medium',
    },
    debtRowStacked: {
      paddingVertical: 6,
    },
    debtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    barTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.pillBg,
      overflow: 'hidden',
      marginBottom: 4,
    },
    barFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: '#5FBE84',
    },
    debtValue: {
      color: '#5FBE84',
      fontSize: Type.secondary,
      fontFamily: 'Geist-SemiBold',
      ...TabularNums,
    },
    strengthProgressStats: {
      alignItems: 'flex-end',
      gap: 2,
    },
    strengthProgressValue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    // Only rendered when a real bodyweight exists (see weightKg's own
    // comment) — never a second row of empty space for someone who hasn't
    // set one.
    strengthProgressRelative: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
      ...TabularNums,
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
      fontSize: Type.secondary,
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
      fontSize: Type.display,
      letterSpacing: -0.4,
      fontFamily: 'Geist-Black',
      ...TabularNums,
    },
    summaryLabel: {
      marginTop: 4,
      color: colors.textTertiary,
      fontSize: Type.micro,
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
      fontSize: Type.micro,
      fontFamily: 'Geist-SemiBold',
    },
    gridWeekBlock: {
      marginBottom: 2,
    },
    gridWeekLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    gridWeekLabel: {
      color: colors.textTertiary,
      fontSize: Type.micro,
      fontFamily: 'Geist-Medium',
    },
    gridWeekCount: {
      color: colors.textSecondary,
      fontSize: Type.micro,
      fontFamily: 'Geist-SemiBold',
      ...TabularNums,
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
    //
    // BUG FIX: the shared pillBg/pillBorder tokens (#F2F2F4 fill, 8%-alpha
    // black border) are tuned for pills sitting on top of other UI chrome,
    // not for a cell that needs to read clearly against this card's own
    // pure-white surface in light mode — the two are close enough in
    // luminance that "Missed" and "Upcoming" cells were nearly invisible,
    // legible mainly by process of elimination against the clearly-green
    // "Completed" cells. Dark mode's own pillBorder is already a solid,
    // higher-contrast gray (not alpha-based), which is why only light mode
    // needed its own stronger values here — this doesn't touch the shared
    // tokens themselves, which still look right everywhere else they're
    // used.
    gridCellMissed: {
      backgroundColor: isDark ? colors.pillBg : '#E4E4E9',
      borderColor: isDark ? colors.pillBorder : 'rgba(0,0,0,0.14)',
    },
    gridCellPending: {
      backgroundColor: 'transparent',
      borderColor: isDark ? colors.pillBorder : 'rgba(0,0,0,0.18)',
    },
    // Layered on top of whichever state style already applies — only
    // overrides the border, so a distinct ring marks today in a 4-week grid
    // without changing what its own fill already communicates.
    gridCellToday: {
      borderWidth: 2,
      borderColor: '#5FBE84',
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
      fontSize: Type.micro,
      fontFamily: 'Geist-Medium',
    },
  });
}
