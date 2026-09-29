import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';

import { TodaysTrainingCard } from '@/components/home/todays-training-card';
import { AndroidCardElevation, Type } from '@/constants/theme';
import { BODY_AREA_LABELS, BODY_AREA_ORDER } from '@/lib/body-area-labels';
import { getCalibration } from '@/lib/calibration';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import type { UserCalibration } from '@/lib/engine/types';
import { getMostNeglectedBodyArea, type TrainingState } from '@/lib/engine/training-state';
import { getHealthReadinessModifier, getHealthReadinessReasons } from '@/lib/health-kit';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import { usePremiumEntitlement } from '@/lib/purchases';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppColors } from '@/lib/theme-context';
import { DAY_ORDER, ENVIRONMENT_LABELS, SESSION_LABEL_BY_GOAL, WEEKDAY_NAMES } from '@/lib/profile-labels';
import { getWeekActivity, type WeekDay } from '@/lib/session-history';
import { getTodaySession, type TodaySession } from '@/lib/today-session';
import { getTrainingState } from '@/lib/training-state-loader';
import { unlessUnchanged } from '@/lib/stable-state';
import { getProfile, type UserProfile } from '@/lib/user-profile';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';

const WEEKDAY_LABELS: Record<string, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};


/**
 * The training-launch destination — same "Today" card Summary previews,
 * plus the full week's plan below it (every scheduled day, not just
 * today's). Duration/exercise-count estimates for days other than today
 * use a baseline energy of 4 ("Feeling good") since there's no real
 * check-in for a day that hasn't happened yet — labeled "Est." rather than
 * presented as a resolved session, same honesty rule as Summary's card.
 */
export default function TrainScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Same shared fade used across onboarding, check-in, Home, and Progress —
  // the loading-skeleton-to-real-content swap below previously hard-cut
  // with no transition, the one motion-language gap against the rest of the app.
  const entering = useFadeInEntering();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todaySession, setTodaySession] = useState<TodaySession | null>(null);
  const [calibration, setCalibration] = useState<UserCalibration | null>(null);
  const [trainingState, setTrainingState] = useState<TrainingState | null>(null);
  const [healthReadinessModifier, setHealthReadinessModifier] = useState(1);
  const [healthReadinessReasons, setHealthReadinessReasons] = useState<
    { rhrElevated: boolean; sleepDeficit: boolean } | undefined
  >(undefined);
  const [loaded, setLoaded] = useState(false);
  const [weekDays, setWeekDays] = useState<WeekDay[] | null>(null);
  const isPremium = usePremiumEntitlement();
  // BUG FIX: the HealthKit-informed trim is a VerveIn Plus benefit —
  // check-in.tsx already gates it this exact way (its own
  // effectiveHealthReadinessModifier), but this screen was applying the raw,
  // ungated modifier to every user's plan preview, meaning free users' Train
  // tab could already reflect the paid RHR/sleep-based adjustment while
  // check-in.tsx silently withheld the same adjustment from that same user's
  // check-in flow. isPremium === null (still checking) falls back to 1 too —
  // an unverified session should never silently get the paid trim.
  const effectiveHealthReadinessModifier = isPremium ? healthReadinessModifier : 1;
  const effectiveHealthReadinessReasons = isPremium ? healthReadinessReasons : undefined;
  // Once today's session has started, its readiness adjustment is frozen
  // (TodaySession.planHealthReadiness) — reading the same frozen value here
  // keeps this card's counts identical to the session actually being done.
  const planHealthReadinessModifier = todaySession?.planHealthReadiness?.modifier ?? effectiveHealthReadinessModifier;
  const planHealthReadinessReasons = todaySession?.planHealthReadiness
    ? todaySession.planHealthReadiness.reasons
    : effectiveHealthReadinessReasons;

  // `today` below (WEEKDAY_NAMES[new Date().getDay()]) has no other reason
  // to re-run once this screen renders — useFocusEffect already refreshes
  // it on every visit, but someone who opens Train and just leaves it open
  // across midnight without navigating away would keep seeing the
  // previous day's rest-day/training-day read. Same fix as Home's
  // getGreeting() staleness: a slow periodic tick plus an AppState listener
  // so reopening the app after a while corrects it immediately.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setClockTick((t) => t + 1), 5 * 60 * 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setClockTick((t) => t + 1);
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [
          loadedProfile,
          loadedSession,
          loadedCalibration,
          loadedTrainingState,
          loadedReadinessModifier,
          loadedReadinessReasons,
        ] = await Promise.all([
          getProfile(),
          getTodaySession(),
          getCalibration(),
          getTrainingState(),
          getHealthReadinessModifier(),
          getHealthReadinessReasons(),
        ]);
        // unlessUnchanged: a focus that finds nothing new keeps every object
        // as it was, so both plan-engine runs below are skipped and a plain
        // tab switch doesn't re-render this screen.
        setProfile(unlessUnchanged(loadedProfile));
        setTodaySession(unlessUnchanged(loadedSession));
        setCalibration(unlessUnchanged(loadedCalibration));
        setTrainingState(unlessUnchanged(loadedTrainingState));
        setHealthReadinessModifier(loadedReadinessModifier);
        setHealthReadinessReasons(unlessUnchanged(loadedReadinessReasons));
        const trainingDays = loadedProfile?.days ? loadedProfile.days.split(',') : null;
        setWeekDays(unlessUnchanged((await getWeekActivity(trainingDays)).days));
        setLoaded(true);
      })();
    }, [])
  );

  // Memoized — this now runs the real engine's filtering over the full
  // exercise library (see plan-preview.ts), not a cheap lookup, so it
  // shouldn't recompute on every render, only when its actual inputs change.
  // Declared before the loading-state early return below so the hook order
  // stays stable across renders (Rules of Hooks). Same real inputs as Home's
  // and check-in's own preview — this card is the one TodaysTrainingCard
  // shares with Summary specifically "so the two never drift apart
  // visually" (see that component's own doc comment); partial inputs here
  // would silently break that promise.
  const preview = useMemo(
    () =>
      computePlanPreview(
        profile ?? {},
        todaySession?.energy ?? 4,
        calibration ?? { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION },
        todaySession?.symptomTags ?? [],
        trainingState ?? undefined,
        planHealthReadinessModifier,
        undefined,
        todaySession?.timeAvailableMin,
        undefined,
        undefined,
        planHealthReadinessReasons,
        todaySession?.preferredBodyArea,
        todaySession?.equipmentOverride
      ),
    [
      profile,
      todaySession?.energy,
      todaySession?.symptomTags,
      todaySession?.timeAvailableMin,
      todaySession?.preferredBodyArea,
      todaySession?.equipmentOverride,
      calibration,
      trainingState,
      planHealthReadinessModifier,
      planHealthReadinessReasons,
    ]
  );

  // BUG FIX: "This week's plan" below used to show every scheduled day's
  // estimate from the SAME `preview` above — i.e. today's real, energy-
  // adjusted plan — contradicting this file's own header comment, which
  // promises days other than today use a neutral baseline-4 estimate since
  // there's no real check-in for a day that hasn't happened yet. In
  // practice, a real low-energy check-in today shrank every OTHER
  // scheduled day's displayed "Est." figures too, which is backwards: those
  // are supposed to read as "what a normal day looks like," not "today's
  // mood, projected onto the rest of the week." acuteSymptomTags and
  // timeAvailableMin are also today-only inputs (an acute symptom pick or a
  // stated time budget don't apply to a hypothetical future day), so both
  // are omitted here — trainingState/healthReadinessModifier stay, since
  // those are standing signals a future day would genuinely still carry.
  const baselinePreview = useMemo(
    () =>
      computePlanPreview(
        profile ?? {},
        4,
        calibration ?? { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION },
        [],
        trainingState ?? undefined,
        effectiveHealthReadinessModifier
      ),
    [profile, calibration, trainingState, effectiveHealthReadinessModifier]
  );

  if (!loaded) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonBlock width={90} height={24} borderRadius={6} />

          <View style={styles.section}>
            <SkeletonBlock width={50} height={11} borderRadius={4} />
            <SkeletonCard height={168} lines={3} style={{ borderRadius: 20 }} />
          </View>

          <View style={styles.section}>
            <SkeletonBlock width={120} height={11} borderRadius={4} />
            <SkeletonCard height={150} lines={3} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const today = WEEKDAY_NAMES[new Date().getDay()];
  const trainingDays = profile?.days ? profile.days.split(',') : null;
  const isRestDay = trainingDays !== null && !trainingDays.includes(today);
  const sessionLabel = SESSION_LABEL_BY_GOAL[profile?.goal ?? ''] ?? 'Training Session';

  // BUG FIX: this used to filter WEEKDAY_NAMES (Sunday-first, since that
  // array only exists to index new Date().getDay()), so "This Week's Plan"
  // listed a Sunday session before Monday's — inconsistent with the
  // Monday-first calendar order used everywhere else a day list is shown
  // (the onboarding day picker, the adjust-plan sheet, profile-labels.ts's
  // own formatDays). DAY_ORDER is that same shared Monday-first order.
  const orderedScheduledDays = DAY_ORDER.filter((d) => trainingDays?.includes(d));

  // A standing signal, not tied to today's check-in — the same real
  // priority score plan-preview.ts's own body-area reorder already computes
  // (training-state.ts's getMostNeglectedBodyArea), shown here as its own
  // readiness read rather than duplicating Home's identical Today card.
  //
  // Framed as readiness, deliberately not as a deficit: a body area with a
  // long real recency gap is well-rested, not "neglected" or "behind" — see
  // plan-preview.ts's own matching fix for the fuller reasoning (same
  // signal, same reframe, both landed together). Observation only, never a
  // command to go train it — today's real capacity, not a ledger, decides
  // what happens at check-in.
  const readyArea = getMostNeglectedBodyArea(trainingState ?? undefined);
  const readyAreaDays =
    readyArea && trainingState && trainingState.recency.tier !== 'insufficient'
      ? trainingState.recency.value[readyArea].daysSinceTrained
      : null;
  const readinessLine = readyArea
    ? readyAreaDays !== null && readyAreaDays >= 1
      ? `${BODY_AREA_LABELS[readyArea]} — well-rested, ${readyAreaDays} day${readyAreaDays === 1 ? '' : 's'} recovered.`
      : `${BODY_AREA_LABELS[readyArea]} is ready whenever you want it.`
    : null;

  return (
    <View style={styles.root}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle} maxFontSizeMultiplier={1.3}>Train</Text>

        {/* No separate TODAY kicker — the card already carries its own, and
            the two stacked read as a duplicated label. */}
        <View style={styles.section}>
          <TodaysTrainingCard
            isRestDay={isRestDay}
            todaySession={todaySession}
            sessionLabel={sessionLabel}
            exerciseCount={preview.exerciseCount}
            durationMin={preview.durationMin}
            explanation={preview.explanation}
          />
          {/* Only shown when today's check-in actually picked an override —
              real data (check-in.tsx's own "Where are you working out
              today?") that was otherwise invisible on this screen. Absent
              means today matches the standing profile, the default/expected
              case, which doesn't need calling out. */}
          {todaySession?.equipmentOverride ? (
            <View style={styles.locationRow}>
              <SymbolView name="mappin.and.ellipse" size={12} tintColor={colors.textTertiary} />
              <Text style={styles.locationText} maxFontSizeMultiplier={1.2}>
                Training at {ENVIRONMENT_LABELS[todaySession.equipmentOverride] ?? todaySession.equipmentOverride}
              </Text>
            </View>
          ) : null}
        </View>

        {readyArea && readinessLine ? (
          <View style={styles.section}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>READINESS</Text>
            <View style={[styles.card, styles.readinessCardPadding]}>
              <View style={styles.readinessDotsRow}>
                {BODY_AREA_ORDER.map((area) => (
                  <View key={area} style={styles.readinessDotCol}>
                    <View style={[styles.readinessDot, area === readyArea && styles.readinessDotActive]} />
                    <Text
                      style={[styles.readinessDotLabel, area === readyArea && styles.readinessDotLabelActive]}
                      maxFontSizeMultiplier={1.1}
                    >
                      {BODY_AREA_LABELS[area]}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.readinessLine} maxFontSizeMultiplier={1.3}>{readinessLine}</Text>
            </View>
          </View>
        ) : null}

        {orderedScheduledDays.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>THIS WEEK&apos;S PLAN</Text>
            <View style={styles.card}>
              {orderedScheduledDays.map((day, index) => {
                const isToday = day === today;
                // Today shows the real, energy-adjusted plan (same figures
                // as the TODAY card above); every other day shows the
                // neutral baseline-4 estimate — see baselinePreview's own
                // comment for why these must differ.
                const rowExerciseCount = isToday ? preview.exerciseCount : baselinePreview.exerciseCount;
                const rowDurationMin = isToday ? preview.durationMin : baselinePreview.durationMin;
                // Days already behind us this week show what happened, not
                // an estimate for a session that can no longer occur.
                const weekDay = weekDays?.find((d) => d.weekday === day);
                const isPast = !!weekDay && !weekDay.isFuture && !weekDay.isToday;
                // BUG FIX: this used to be past days only, so after today's
                // session was finished the Today card above said "Done for
                // today" while today's row here still offered an estimate
                // for the session just completed.
                const isDone = !!weekDay && !weekDay.isFuture && weekDay.completed === true;
                return (
                  <View
                    key={day}
                    style={[
                      styles.planRow,
                      index < orderedScheduledDays.length - 1 && styles.rowDivider,
                      isPast && !isDone && styles.planRowPast,
                    ]}
                  >
                    <View>
                      <Text style={[styles.planRowDay, isToday && styles.planRowDayToday]} maxFontSizeMultiplier={1.2}>
                        {WEEKDAY_LABELS[day]}
                        {isToday ? ' · Today' : ''}
                      </Text>
                      <Text style={styles.planRowLabel} maxFontSizeMultiplier={1.3}>{sessionLabel}</Text>
                    </View>
                    {isDone ? (
                      <View style={styles.planRowDone}>
                        <SymbolView name="checkmark.circle.fill" size={13} tintColor="#5FBE84" />
                        <Text style={styles.planRowMeta} maxFontSizeMultiplier={1.3}>Done</Text>
                      </View>
                    ) : isPast ? (
                      <Text style={styles.planRowMeta} maxFontSizeMultiplier={1.3}>—</Text>
                    ) : (
                      <Text style={styles.planRowMeta} maxFontSizeMultiplier={1.3}>
                        Est. {rowExerciseCount} exercises · {rowDurationMin} min
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>THIS WEEK&apos;S PLAN</Text>
            <View style={styles.emptyCard}>
              <SymbolView name="calendar.badge.plus" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
              <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                No training days set yet — add some in Adjust My Plan to see your week here.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
      </ReanimatedAnimated.View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
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
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    locationText: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
    },
    readinessCardPadding: {
      paddingVertical: 16,
    },
    readinessDotsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    readinessDotCol: {
      alignItems: 'center',
      gap: 6,
    },
    readinessDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.pillBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
    },
    readinessDotActive: {
      backgroundColor: '#5FBE84',
      borderColor: '#5FBE84',
    },
    readinessDotLabel: {
      color: colors.textTertiary,
      fontSize: Type.micro,
      fontFamily: 'Geist-Medium',
    },
    readinessDotLabelActive: {
      color: colors.text,
      fontFamily: 'Geist-SemiBold',
    },
    readinessLine: {
      marginTop: 14,
      color: colors.textSecondary,
      fontSize: Type.secondary,
      lineHeight: 18,
      fontFamily: 'Geist-Medium',
      textAlign: 'center',
    },
    card: {
      borderRadius: Platform.OS === 'android' ? 20 : 16,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      ...(Platform.OS === 'android'
        ? AndroidCardElevation
        : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceBorder }),
    },
    emptyCard: {
      borderRadius: Platform.OS === 'android' ? 20 : 16,
      backgroundColor: colors.surface,
      padding: 20,
      alignItems: 'center',
      ...(Platform.OS === 'android'
        ? AndroidCardElevation
        : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceBorder }),
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
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    planRowDay: {
      color: colors.text,
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
    },
    planRowDayToday: {
      color: colors.accentText,
    },
    planRowLabel: {
      marginTop: 2,
      color: colors.textTertiary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
    },
    planRowMeta: {
      color: colors.textSecondary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
    },
    planRowDone: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    // A scheduled day that's already passed without a logged session —
    // quieted, not flagged: nothing to act on, no ledger to keep.
    planRowPast: {
      opacity: 0.5,
    },
  });
}
