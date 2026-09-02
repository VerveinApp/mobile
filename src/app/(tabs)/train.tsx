import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { TodaysTrainingCard } from '@/components/home/todays-training-card';
import { getCalibration } from '@/lib/calibration';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import type { UserCalibration } from '@/lib/engine/types';
import type { TrainingState } from '@/lib/engine/training-state';
import { getHealthReadinessModifier, getHealthReadinessReasons } from '@/lib/health-kit';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import { usePremiumEntitlement } from '@/lib/purchases';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppColors } from '@/lib/theme-context';
import { getTodaySession, type TodaySession } from '@/lib/today-session';
import { getTrainingState } from '@/lib/training-state';
import { getProfile, type UserProfile } from '@/lib/user-profile';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_LABELS: Record<string, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

const SESSION_LABEL_BY_GOAL: Record<string, string> = {
  'build-physique': 'Strength Session',
  'get-leaner': 'Conditioning Session',
  'get-stronger': 'Strength Session',
  'move-better': 'Mobility Session',
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
        setProfile(loadedProfile);
        setTodaySession(loadedSession);
        setCalibration(loadedCalibration);
        setTrainingState(loadedTrainingState);
        setHealthReadinessModifier(loadedReadinessModifier);
        setHealthReadinessReasons(loadedReadinessReasons);
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
        effectiveHealthReadinessModifier,
        undefined,
        todaySession?.timeAvailableMin,
        undefined,
        undefined,
        effectiveHealthReadinessReasons
      ),
    [
      profile,
      todaySession?.energy,
      todaySession?.symptomTags,
      todaySession?.timeAvailableMin,
      calibration,
      trainingState,
      effectiveHealthReadinessModifier,
      effectiveHealthReadinessReasons,
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
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
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

  const orderedScheduledDays = WEEKDAY_NAMES.filter((d) => trainingDays?.includes(d));

  return (
    <View style={styles.root}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle} maxFontSizeMultiplier={1.3}>Train</Text>

        <View style={styles.section}>
          <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>TODAY</Text>
          <TodaysTrainingCard
            isRestDay={isRestDay}
            todaySession={todaySession}
            sessionLabel={sessionLabel}
            exerciseCount={preview.exerciseCount}
            durationMin={preview.durationMin}
            explanation={preview.explanation}
          />
        </View>

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
                return (
                  <View
                    key={day}
                    style={[styles.planRow, index < orderedScheduledDays.length - 1 && styles.rowDivider]}
                  >
                    <View>
                      <Text style={[styles.planRowDay, isToday && styles.planRowDayToday]} maxFontSizeMultiplier={1.2}>
                        {WEEKDAY_LABELS[day]}
                        {isToday ? ' · Today' : ''}
                      </Text>
                      <Text style={styles.planRowLabel} maxFontSizeMultiplier={1.3}>{sessionLabel}</Text>
                    </View>
                    <Text style={styles.planRowMeta} maxFontSizeMultiplier={1.3}>
                      Est. {rowExerciseCount} · {rowDurationMin} min
                    </Text>
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
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
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
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    planRowDayToday: {
      color: '#5FBE84',
    },
    planRowLabel: {
      marginTop: 2,
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: 'Geist-Medium',
    },
    planRowMeta: {
      color: colors.textSecondary,
      fontSize: 11.5,
      fontFamily: 'Geist-Medium',
    },
  });
}
