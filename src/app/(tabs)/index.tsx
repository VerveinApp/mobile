import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { getCalibration } from '@/lib/calibration';
import { getDeloadNudge } from '@/lib/deload';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import type { DeloadNudge, UserCalibration } from '@/lib/engine/types';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import {
  dismissHealthKitBanner,
  getHealthReadinessModifier,
  getHealthReadinessReasons,
  hasConnectedHealthKit,
  isHealthKitAvailable,
  isHealthKitBannerDismissed,
  requestHealthKitAccess,
} from '@/lib/health-kit';
import { getImprovedExercises } from '@/lib/exercise-performance';
import { getShareableWeeklyRecapText, getWeeklyRecap } from '@/lib/momentum';
import { hasCompletedOnboarding, loadOnboardingDraft, ONBOARDING_STEP_ROUTES } from '@/lib/onboarding-draft';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import { usePremiumEntitlement } from '@/lib/purchases';
import { getWeekActivity, type WeekDay } from '@/lib/session-history';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppColors } from '@/lib/theme-context';
import { getTodaySession, type TodaySession } from '@/lib/today-session';
import { getTrainingState } from '@/lib/training-state';
import { tierOf, type TrainingState } from '@/lib/engine/training-state';
import { getProfile, type UserProfile } from '@/lib/user-profile';
import { TodaysTrainingCard } from '@/components/home/todays-training-card';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';
import { SymbolView } from 'expo-symbols';

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Monday-start, matches session-history.ts

const SESSION_LABEL_BY_GOAL: Record<string, string> = {
  'build-physique': 'Strength Session',
  'get-leaner': 'Conditioning Session',
  'get-stronger': 'Strength Session',
  'move-better': 'Mobility Session',
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * Summary — the real Home tab, an Apple-Health-shaped dashboard rather than
 * a single form. This screen also still owns the app's entry-redirect logic
 * (onboarding resume / welcome for anyone who hasn't finished onboarding);
 * only a completed profile actually sees the dashboard below.
 *
 * Unlike every onboarding/auth screen, this one deliberately isn't built on
 * the fixed 375×812 canvas-and-scale convention — it's a real scrollable,
 * variable-height, data-driven surface, so normal flexbox + ScrollView is
 * the right tool here, not a departure to apologize for.
 */
export default function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Same shared fade the onboarding flow and check-in's state transitions
  // already use — the loading-skeleton-to-real-content swap below is a full
  // remount (a different branch of the status==='ready' conditional), which
  // previously hard-cut with no transition at all, the one clear motion-
  // language gap against the rest of the app.
  const entering = useFadeInEntering();
  const [status, setStatus] = useState<'checking' | 'ready'>('checking');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todaySession, setTodaySession] = useState<TodaySession | null>(null);
  const [weekActivity, setWeekActivity] = useState<{
    days: WeekDay[];
    completedCount: number;
    scheduledCount: number;
  } | null>(null);
  const [calibration, setCalibration] = useState<UserCalibration | null>(null);
  const [deloadNudge, setDeloadNudge] = useState<DeloadNudge | null>(null);
  const [healthReadinessModifier, setHealthReadinessModifier] = useState(1);
  const [healthReadinessReasons, setHealthReadinessReasons] = useState<
    { rhrElevated: boolean; sleepDeficit: boolean } | undefined
  >(undefined);
  const [trainingState, setTrainingState] = useState<TrainingState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showHealthKitBanner, setShowHealthKitBanner] = useState(false);
  const isPremium = usePremiumEntitlement();
  // BUG FIX: the HealthKit-informed trim is a VerveIn Plus benefit —
  // check-in.tsx already gates it this exact way (its own
  // effectiveHealthReadinessModifier), but this screen was applying the raw,
  // ungated modifier to every user's plan preview (and, via getDeloadNudge
  // below, showing a banner claiming the RHR-based trim happened even for
  // free users). isPremium === null (still checking) falls back to 1/undefined
  // too — an unverified session should never silently get the paid trim.
  const effectiveHealthReadinessModifier = isPremium ? healthReadinessModifier : 1;
  const effectiveHealthReadinessReasons = isPremium ? healthReadinessReasons : undefined;

  // Memoized — this now runs the real engine's filtering over the full
  // exercise library (see plan-preview.ts), not a cheap lookup, so it
  // shouldn't recompute on every render, only when its actual inputs change.
  // Declared before the loading-state early return below so the hook order
  // stays stable across renders (Rules of Hooks). Falls back to the neutral
  // default while calibration is still loading, same as a first-ever session.
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const completed = await hasCompletedOnboarding();
      if (cancelled) return;
      if (!completed) {
        const draft = await loadOnboardingDraft();
        if (cancelled) return;
        if (draft) {
          router.replace({ pathname: ONBOARDING_STEP_ROUTES[draft.step], params: draft.params } as never);
        } else {
          router.replace('/onboarding/welcome' as never);
        }
        return;
      }

      const [
        loadedProfile,
        loadedSession,
        loadedCalibration,
        loadedDeloadNudge,
        loadedReadinessModifier,
        loadedReadinessReasons,
        loadedTrainingState,
      ] = await Promise.all([
        getProfile(),
        getTodaySession(),
        getCalibration(),
        getDeloadNudge(isPremium),
        getHealthReadinessModifier(),
        getHealthReadinessReasons(),
        getTrainingState(),
      ]);
      if (cancelled) return;
      setProfile(loadedProfile);
      setTodaySession(loadedSession);
      setCalibration(loadedCalibration);
      setDeloadNudge(loadedDeloadNudge);
      setHealthReadinessModifier(loadedReadinessModifier);
      setHealthReadinessReasons(loadedReadinessReasons);
      setTrainingState(loadedTrainingState);

      const trainingDays = loadedProfile?.days ? loadedProfile.days.split(',') : null;
      const activity = await getWeekActivity(trainingDays);
      if (cancelled) return;
      setWeekActivity(activity);
      setStatus('ready');

      // Own effect below would also work, but this keeps the check
      // alongside the same "only after onboarding is confirmed complete"
      // gate as everything else this screen loads.
      const [available, connected, dismissed] = await Promise.all([
        isHealthKitAvailable(),
        hasConnectedHealthKit(),
        isHealthKitBannerDismissed(),
      ]);
      if (cancelled) return;
      setShowHealthKitBanner(available && !connected && !dismissed);
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately mount-only (see this effect's own leading comment) —
    // isPremium is read here at whatever value it happens to be at first
    // mount (usually still resolving), which is the same safe default this
    // whole gating fix relies on elsewhere; the isPremium-aware
    // useFocusEffect below corrects it moments later once entitlement
    // actually resolves, same "eventually refreshed on focus" pattern this
    // screen already uses for every other one-time-fetched value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Settings' Adjust My Plan / Biometrics screens push on top of this tab
  // rather than unmounting it, so a mount-once effect would never pick up
  // changes made there. This re-syncs on every focus without touching
  // `status`, so a normal tab switch never re-blanks the screen — only the
  // very first load (handled above) does the onboarding-redirect check.
  useFocusEffect(
    useCallback(() => {
      if (status !== 'ready') return;
      (async () => {
        const [
          loadedProfile,
          loadedSession,
          loadedCalibration,
          loadedDeloadNudge,
          loadedReadinessModifier,
          loadedReadinessReasons,
          loadedTrainingState,
        ] = await Promise.all([
          getProfile(),
          getTodaySession(),
          getCalibration(),
          getDeloadNudge(isPremium),
          getHealthReadinessModifier(),
          getHealthReadinessReasons(),
          getTrainingState(),
        ]);
        setProfile(loadedProfile);
        setTodaySession(loadedSession);
        setCalibration(loadedCalibration);
        setDeloadNudge(loadedDeloadNudge);
        setHealthReadinessModifier(loadedReadinessModifier);
        setHealthReadinessReasons(loadedReadinessReasons);
        setTrainingState(loadedTrainingState);
        const trainingDays = loadedProfile?.days ? loadedProfile.days.split(',') : null;
        setWeekActivity(await getWeekActivity(trainingDays));
      })();
      // isPremium added alongside the getDeloadNudge/effectiveHealthReadinessModifier
      // gating fix — without it, this callback (and the isPremium value it
      // closes over when calling getDeloadNudge) would stay frozen at
      // whatever isPremium was the one time `status` flipped to 'ready',
      // never picking up entitlement resolving moments later.
    }, [status, isPremium])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const [
      loadedProfile,
      loadedSession,
      loadedCalibration,
      loadedDeloadNudge,
      loadedReadinessModifier,
      loadedReadinessReasons,
      loadedTrainingState,
    ] = await Promise.all([
      getProfile(),
      getTodaySession(),
      getCalibration(),
      getDeloadNudge(isPremium),
      getHealthReadinessModifier(),
      getHealthReadinessReasons(),
      getTrainingState(),
    ]);
    setProfile(loadedProfile);
    setTodaySession(loadedSession);
    setCalibration(loadedCalibration);
    setDeloadNudge(loadedDeloadNudge);
    setHealthReadinessModifier(loadedReadinessModifier);
    setHealthReadinessReasons(loadedReadinessReasons);
    setTrainingState(loadedTrainingState);
    const trainingDays = loadedProfile?.days ? loadedProfile.days.split(',') : null;
    setWeekActivity(await getWeekActivity(trainingDays));
    setRefreshing(false);
  }, [isPremium]);

  const handleConnectHealthKit = useCallback(async () => {
    hapticImpactLight();
    // Fires the real system permission dialog — banner only disappears on
    // completion (granted or not) so a mid-decision tap can't leave the
    // banner stuck in a stale "still asking" state.
    const granted = await requestHealthKitAccess();
    setShowHealthKitBanner(false);
    // A user with pre-existing elevated-RHR Health data should see that
    // reflected immediately, not after the next focus/refresh cycle —
    // getHealthReadinessModifier already no-ops safely if there isn't
    // enough real data yet.
    if (granted) {
      const [modifier, reasons] = await Promise.all([getHealthReadinessModifier(), getHealthReadinessReasons()]);
      setHealthReadinessModifier(modifier);
      setHealthReadinessReasons(reasons);
    }
  }, []);

  const handleDismissHealthKitBanner = useCallback(async () => {
    hapticSelect();
    setShowHealthKitBanner(false);
    await dismissHealthKitBanner();
  }, []);

  // Computed on demand, not kept in component state — this text is only
  // ever needed at the moment someone taps Share, so there's no reason to
  // fetch/recompute it on every load/focus/refresh cycle the way the
  // screen's other data does. Same pattern as referral.tsx's handleShare:
  // build the message, hand it to the native share sheet, swallow a
  // dismiss/cancel silently (nothing else in the app depends on whether
  // this share actually completed).
  const handleShareWeek = useCallback(async () => {
    if (!weekActivity) return;
    hapticImpactLight();
    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const improved = await getImprovedExercises();
    const recentImprovement = improved
      .filter((e) => Date.parse(`${e.performance.date}T00:00:00`) >= cutoffMs)
      .sort((a, b) => b.performance.date.localeCompare(a.performance.date))[0];
    const message = getShareableWeeklyRecapText(
      weekActivity,
      recentImprovement
        ? {
            exerciseName: recentImprovement.exerciseName,
            estimatedOneRepMaxKg: recentImprovement.performance.estimatedOneRepMax,
          }
        : null
    );
    if (!message) return;
    try {
      await Share.share({ message });
    } catch {
      // Share sheet dismissed/cancelled — no separate error state, same as
      // referral.tsx's own handleShare.
    }
  }, [weekActivity]);

  if (status !== 'ready' || !weekActivity) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={{ gap: 8 }}>
              <SkeletonBlock width={170} height={22} borderRadius={6} />
              <SkeletonBlock width={130} height={13} borderRadius={6} />
            </View>
            <SkeletonBlock width={40} height={40} borderRadius={20} />
          </View>

          <SkeletonCard height={168} lines={3} style={{ borderRadius: 20 }} />

          <View style={styles.section}>
            <SkeletonBlock width={80} height={11} borderRadius={4} />
            <View style={styles.weekRow}>
              {Array.from({ length: 7 }).map((_, index) => (
                <View key={index} style={styles.weekDayCol}>
                  <SkeletonBlock width={12} height={11} borderRadius={3} />
                  <SkeletonBlock width={22} height={22} borderRadius={11} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SkeletonBlock width={90} height={11} borderRadius={4} />
            <SkeletonCard height={70} />
            <SkeletonCard height={70} />
            <SkeletonCard height={70} />
          </View>

          <View style={styles.section}>
            <SkeletonBlock width={90} height={11} borderRadius={4} />
            <SkeletonCard height={160} lines={3} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const today = WEEKDAY_NAMES[new Date().getDay()];
  const trainingDays = profile?.days ? profile.days.split(',') : null;
  const isRestDay = trainingDays !== null && !trainingDays.includes(today);
  const firstName = profile?.name?.trim().split(' ')[0];
  const sessionLabel = SESSION_LABEL_BY_GOAL[profile?.goal ?? ''] ?? 'Training Session';
  const weeklyRecap = getWeeklyRecap(weekActivity);

  return (
    <View style={styles.root}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.textSecondary} />
        }
      >
        <Header styles={styles} firstName={firstName} weeklyRecap={weeklyRecap} />

        {deloadNudge?.triggered && deloadNudge.message ? (
          <Pressable
            style={styles.deloadBanner}
            onPress={() => {
              hapticSelect();
              router.push('/home/check-in' as never);
            }}
          >
            <View style={styles.deloadBannerRow}>
              <SymbolView name="moon.zzz.fill" size={15} tintColor={colors.textSecondary} />
              <Text style={styles.deloadBannerText} maxFontSizeMultiplier={1.4}>{deloadNudge.message}</Text>
            </View>
            <Text style={styles.deloadBannerAction} maxFontSizeMultiplier={1.2}>
              Check in →
            </Text>
          </Pressable>
        ) : null}

        {showHealthKitBanner ? (
          <View style={styles.healthKitBanner}>
            <View style={styles.healthKitBannerRow}>
              <SymbolView name="heart.fill" size={15} tintColor="#5FBE84" />
              <Text style={styles.healthKitBannerText} maxFontSizeMultiplier={1.4}>
                See your plan alongside real activity, sleep, and heart rate from Apple Health.
              </Text>
            </View>
            <View style={styles.healthKitBannerActions}>
              <Pressable style={styles.healthKitBannerDismiss} onPress={handleDismissHealthKitBanner} hitSlop={8}>
                <Text style={styles.healthKitBannerDismissText} maxFontSizeMultiplier={1.2}>
                  Not now
                </Text>
              </Pressable>
              <Pressable style={styles.healthKitBannerConnect} onPress={handleConnectHealthKit} hitSlop={8}>
                <Text style={styles.healthKitBannerConnectText} maxFontSizeMultiplier={1.2}>
                  Connect
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <TodaysTrainingCard
          isRestDay={isRestDay}
          todaySession={todaySession}
          sessionLabel={sessionLabel}
          exerciseCount={preview.exerciseCount}
          durationMin={preview.durationMin}
          explanation={preview.explanation}
        />

        <WeeklyActivity styles={styles} colors={colors} weekActivity={weekActivity} onShare={handleShareWeek} />

        <YourFitness
          styles={styles}
          profile={profile}
          todaySession={todaySession}
          weekActivity={weekActivity}
          calibration={calibration}
        />
      </ScrollView>
      </ReanimatedAnimated.View>
    </View>
  );
}

function Header({
  styles,
  firstName,
  weeklyRecap,
}: {
  styles: ReturnType<typeof createStyles>;
  firstName?: string;
  weeklyRecap: string | null;
}) {
  const hover = useHoverFade();
  const press = useLiquidPress();
  const initial = firstName ? firstName[0].toUpperCase() : '·';

  // Neither getGreeting() nor formatToday() below have any other reason to
  // re-run once this component mounts — without this, leaving Home open
  // across an hour (or day) boundary freezes both at whatever they were on
  // the last render, e.g. still "Good morning" well into the afternoon.
  // Re-ticking every minute keeps them live; the AppState listener catches
  // the larger jump from being backgrounded for a while immediately rather
  // than waiting up to a minute for the interval to fire (JS timers don't
  // run in the background on iOS, so the interval alone only catches up
  // once the app resumes anyway).
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setClockTick((t) => t + 1), 60 * 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setClockTick((t) => t + 1);
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting} maxFontSizeMultiplier={1.3}>
          {getGreeting()}
          {firstName ? `, ${firstName}` : ''}
        </Text>
        <Text style={styles.dateText} maxFontSizeMultiplier={1.3}>{formatToday()}</Text>
        {weeklyRecap ? (
          <View style={styles.momentumRow}>
            <Text style={styles.momentumText} maxFontSizeMultiplier={1.3}>{weeklyRecap}</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        style={styles.avatarHit}
        onPress={() => router.push('/profile' as never)}
        onHoverIn={hover.onHoverIn}
        onHoverOut={hover.onHoverOut}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
      >
        <View style={styles.avatarVisual}>
          <Text style={styles.avatarText} maxFontSizeMultiplier={1.15}>{initial}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function WeeklyActivity({
  styles,
  colors,
  weekActivity,
  onShare,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppColors>;
  weekActivity: { days: WeekDay[]; completedCount: number; scheduledCount: number };
  onShare: () => void;
}) {
  const shareHover = useHoverFade();
  const sharePress = useLiquidPress();
  // Same gate getWeeklyRecap itself applies — no share affordance for a
  // week with nothing real to report yet (blameless silence, not a lesser/
  // empty version of the button).
  const canShare = weekActivity.completedCount > 0;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>THIS WEEK</Text>
      <View style={styles.weekRow}>
        {weekActivity.days.map((day, index) => (
          <View key={day.weekday} style={styles.weekDayCol}>
            <Text style={styles.weekDayLetter} maxFontSizeMultiplier={1.2}>{WEEKDAY_LETTERS[index]}</Text>
            <View
              style={[
                styles.weekDot,
                !day.isScheduled && styles.weekDotUnscheduled,
                day.isScheduled && day.completed === true && styles.weekDotCompleted,
                // Fixed bug: previously `day.completed === false` only — a
                // past day with zero recorded entry (completed: null, not
                // false — recordSessionCompletion only ever writes once
                // "Start Session" is tapped, so a day the user never opened
                // check-in on at all has no entry) fell through to the
                // default dot instead of reading as missed. Today is
                // explicitly excluded — it's !isFuture too, but the day
                // isn't over yet, so completed:null there just means "not
                // checked in yet," not "missed."
                day.isScheduled && !day.isFuture && !day.isToday && day.completed !== true && styles.weekDotMissed,
                day.isToday && styles.weekDotToday,
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.weekSummaryRow}>
        <Text style={styles.weekSummary} maxFontSizeMultiplier={1.3}>
          {weekActivity.completedCount} / {weekActivity.scheduledCount} workouts completed
        </Text>
        {canShare ? (
          <Pressable
            style={styles.weekShareButton}
            onPress={onShare}
            hitSlop={8}
            onHoverIn={shareHover.onHoverIn}
            onHoverOut={shareHover.onHoverOut}
            onPressIn={sharePress.onPressIn}
            onPressOut={sharePress.onPressOut}
          >
            <SymbolView name="square.and.arrow.up" size={13} tintColor={colors.textSecondary} />
            <Text style={styles.weekShareText} maxFontSizeMultiplier={1.2}>
              Share
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function YourFitness({
  styles,
  profile,
  todaySession,
  weekActivity,
  calibration,
}: {
  styles: ReturnType<typeof createStyles>;
  profile: UserProfile | null;
  todaySession: TodaySession | null;
  weekActivity: { completedCount: number; scheduledCount: number };
  calibration: UserCalibration | null;
}) {
  const commitment = Number(profile?.commitmentLevel) || 4;
  const loadLabel = commitment <= 3 ? 'Light' : commitment <= 6 ? 'Moderate' : 'High';
  const energy = todaySession?.energy;
  const readinessNote =
    energy === undefined
      ? 'Check in to see your readiness.'
      : energy >= 4
        ? "You're ready for today's session."
        : energy === 3
          ? 'A steady session fits well today.'
          : 'Consider taking it easier today.';

  // M15's calibration multiplier is the one real learned state this app
  // has — invisible until now. Only surfaced once "established" (tierOf,
  // shared from engine/training-state.ts — same TIER_ESTABLISHED_MIN=10
  // threshold M20's Tiered pattern uses elsewhere, no longer a second,
  // driftable inline copy of that number) and only when the deviation is a
  // real signal, not early noise — 0.08 is personal-calibration.ts's own
  // STEP size, so anything smaller is less than a single full adjustment's
  // worth of movement.
  const calibrationNote =
    calibration && tierOf(calibration.sampleCount) === 'established'
      ? calibration.multiplier >= 1.08
        ? "Your plan's been running heavier than baseline — recent sessions came back easy."
        : calibration.multiplier <= 0.92
          ? "Your plan's been running lighter than baseline right now."
          : null
      : null;

  // Observational, not a nudge — no "back on track" framing for a quiet
  // week, since the exact user this app is for is someone who should feel
  // safe having one, not guilty. The real numbers are already shown above;
  // this is just plain context, same register regardless of how the week
  // went.
  const ratio = weekActivity.scheduledCount > 0 ? weekActivity.completedCount / weekActivity.scheduledCount : 0;
  const consistencyNote =
    weekActivity.scheduledCount === 0
      ? 'No sessions logged yet.'
      : ratio >= 0.75
        ? 'Most sessions logged this week.'
        : ratio >= 0.25
          ? 'Some sessions logged this week.'
          : 'A quieter week so far.';

  // Only surfaced on an actual quiet stretch, not preemptively — the brand
  // thesis lands as reassurance after a real shortfall, not as a caveat
  // shown by default.
  const isQuietWeek = weekActivity.scheduledCount > 0 && ratio < 0.25;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>YOUR FITNESS</Text>

      <View style={styles.fitnessCard}>
        <View style={styles.fitnessCardHeader}>
          <Text style={styles.fitnessCardLabel} maxFontSizeMultiplier={1.3}>Training Load</Text>
          <Text style={styles.fitnessCardValue} maxFontSizeMultiplier={1.2}>{loadLabel}</Text>
        </View>
        <Text style={styles.fitnessCardNote} maxFontSizeMultiplier={1.4}>{readinessNote}</Text>
        {calibrationNote ? (
          <Text style={styles.fitnessCardCalibrationNote} maxFontSizeMultiplier={1.4}>
            {calibrationNote}
          </Text>
        ) : null}
      </View>

      <View style={styles.fitnessCard}>
        <View style={styles.fitnessCardHeader}>
          <Text style={styles.fitnessCardLabel} maxFontSizeMultiplier={1.3}>Consistency</Text>
          <Text style={styles.fitnessCardValue} maxFontSizeMultiplier={1.2}>
            {weekActivity.completedCount}/{weekActivity.scheduledCount}
            <Text style={styles.fitnessCardTier}> this week</Text>
          </Text>
        </View>
        <Text style={styles.fitnessCardNote} maxFontSizeMultiplier={1.4}>{consistencyNote}</Text>
        {isQuietWeek ? (
          <Text style={styles.fitnessCardCalibrationNote} maxFontSizeMultiplier={1.4}>
            On your side, not your goal&apos;s side.
          </Text>
        ) : null}
      </View>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    greeting: {
      color: colors.text,
      fontSize: 22,
      letterSpacing: -0.3,
      fontFamily: 'Geist-Bold',
    },
    dateText: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    momentumRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    deloadBanner: {
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    deloadBannerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    deloadBannerText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
      fontFamily: 'Geist-Medium',
    },
    // Real action, not automatic — tapping goes to check-in so the user
    // decides what to do about the signal (adjust their own energy, see
    // today's plan) rather than the engine silently reducing volume behind
    // their back. Same principle as calibration transparency: surface the
    // real signal, never act on it invisibly.
    deloadBannerAction: {
      alignSelf: 'flex-end',
      color: '#5FBE84',
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    healthKitBanner: {
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    healthKitBannerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    healthKitBannerText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
      fontFamily: 'Geist-Medium',
    },
    healthKitBannerActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 16,
    },
    healthKitBannerDismiss: {
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    healthKitBannerDismissText: {
      color: colors.textTertiary,
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    healthKitBannerConnect: {
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    healthKitBannerConnectText: {
      color: '#5FBE84',
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    // Neutral, not a celebratory accent — this is an observation ("3
    // sessions this week"), never a score, so it reads the same as any
    // other plain fact on the screen rather than drawing extra attention.
    momentumText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
    },
    avatarHit: {
      width: 40,
      height: 40,
    },
    avatarVisual: {
      width: '100%',
      height: '100%',
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.glassBorder,
      backgroundColor: 'rgba(67,140,99,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: '#5FBE84',
      fontSize: 15,
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
    weekRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    weekDayCol: {
      alignItems: 'center',
      gap: 8,
    },
    weekDayLetter: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: 'Geist-Medium',
    },
    weekDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      backgroundColor: 'transparent',
    },
    weekDotUnscheduled: {
      borderColor: colors.badgeBg,
    },
    weekDotCompleted: {
      borderColor: '#5FBE84',
      backgroundColor: '#5FBE84',
    },
    weekDotMissed: {
      borderColor: 'rgba(229,72,77,0.5)',
    },
    weekDotToday: {
      borderColor: colors.text,
    },
    weekSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    weekSummary: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    weekShareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    weekShareText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
    },
    fitnessCard: {
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    fitnessCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fitnessCardLabel: {
      color: colors.text,
      fontSize: 13.5,
      fontFamily: 'Geist-SemiBold',
    },
    fitnessCardValue: {
      color: colors.text,
      fontSize: 14,
      fontFamily: 'Geist-Bold',
    },
    fitnessCardTier: {
      color: colors.textTertiary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
    },
    fitnessCardNote: {
      marginTop: 6,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: 'Geist-Regular',
    },
    fitnessCardCalibrationNote: {
      marginTop: 4,
      color: colors.textTertiary,
      fontSize: 11,
      lineHeight: 15,
      fontFamily: 'Geist-Regular',
    },
  });
}
