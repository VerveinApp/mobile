import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated, {
  Easing,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHoverFade, useLiquidPress, PRESSED_DIM } from '@/lib/button-interactions';
import { AndroidCardElevation, AndroidRipple, TabularNums, Type } from '@/constants/theme';
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
import { getUnitSystem } from '@/lib/unit-preference';
import { hasCompletedOnboarding, loadOnboardingDraft, ONBOARDING_STEP_ROUTES } from '@/lib/onboarding-draft';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import { SESSION_LABEL_BY_GOAL, WEEKDAY_NAMES } from '@/lib/profile-labels';
import { usePremiumEntitlement } from '@/lib/purchases';
import { PremiumGate } from '@/components/premium-gate';
import { getWeekActivity, type WeekDay } from '@/lib/session-history';
import { MOTION_DURATION, MOTION_EASING } from '@/lib/motion';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { unlessUnchanged } from '@/lib/stable-state';
import { useAppColors } from '@/lib/theme-context';
import { getTodaySession, type TodaySession } from '@/lib/today-session';
import { getTrainingState } from '@/lib/training-state-loader';
import { tierOf, type TrainingState } from '@/lib/engine/training-state';
import { getProfile, type UserProfile } from '@/lib/user-profile';
import { dismissEquipmentPrompt, shouldAskForEquipment } from '@/lib/equipment-prompt';
import { TodaysTrainingCard } from '@/components/home/todays-training-card';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';
import { SymbolView } from '@/components/ui/app-symbol';

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Monday-start, matches session-history.ts

// Same light→dark green ramp energy-gauge.tsx's own MOOD_COLORS already
// uses for its "Good"/"Great" levels (#8FBF5C, #5FBE84) plus this app's
// established darker/pressed-state brand green (#438C63) for the third
// stop — deliberately NOT a red/yellow/green scale. Training Load isn't a
// pass/fail signal the way WHOOP's Recovery is: a heavier day reflects
// real effort, not a warning. A single-hue intensity ramp reads as
// "more," not "worse." Used per-day below (not per-tier anymore since the
// chart moved from one commitment-level meter to a real day-by-day
// breakdown) — each bar's own real caloriesBurned, relative to the
// heaviest real day this week, picks its stop on the ramp.
const LOAD_METER_COLORS = ['#8FBF5C', '#5FBE84', '#438C63'];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Welcome back';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Welcome back';
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Everything Home shows, read in one place for the first load, every focus
// and pull-to-refresh. This list used to be written out three times, and a
// store added to one copy but not the others would quietly go stale.
async function loadHomeData(isPremium: boolean | null) {
  const [
    profile,
    todaySession,
    calibration,
    deloadNudge,
    healthReadinessModifier,
    healthReadinessReasons,
    trainingState,
  ] = await Promise.all([
    getProfile(),
    getTodaySession(),
    getCalibration(),
    getDeloadNudge(isPremium),
    getHealthReadinessModifier(),
    getHealthReadinessReasons(),
    getTrainingState(),
  ]);
  const trainingDays = profile?.days ? profile.days.split(',') : null;
  const weekActivity = await getWeekActivity(trainingDays);
  return {
    profile,
    todaySession,
    calibration,
    deloadNudge,
    healthReadinessModifier,
    healthReadinessReasons,
    trainingState,
    weekActivity,
  };
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
  const reducedMotion = useReducedMotion();
  const bannerExiting = reducedMotion ? undefined : FadeOut.duration(MOTION_DURATION.fast).easing(MOTION_EASING.standard);
  const contentLayout = reducedMotion ? undefined : LinearTransition.springify(280).dampingRatio(0.8);
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
  const [showEquipmentPrompt, setShowEquipmentPrompt] = useState(false);
  const isPremium = usePremiumEntitlement();
  // BUG FIX (found in a later full-app audit): `today`/`isRestDay` below are
  // plain consts recomputed from `new Date()` on every SummaryScreen render
  // — correct as far as it goes, but nothing here was ever forcing a render
  // on its own. Header's own clockTick (see below) only re-renders Header
  // itself, not this parent, so leaving Home mounted across a real midnight
  // boundary (typically: backgrounded overnight, then resumed) left the
  // Rest-Day/training-day determination frozen on yesterday even though
  // Header's own greeting/date text — refreshed by its own, separate
  // mechanism — correctly showed today. Same interval+AppState pattern,
  // lifted here so the one tick drives both this screen's own day logic and
  // (via the normal prop re-render, Header isn't memoized) Header's text,
  // instead of two independent, easy-to-desync copies of the same fix.
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
  // BUG FIX: the HealthKit-informed trim is a VerveIn Plus benefit —
  // check-in.tsx already gates it this exact way (its own
  // effectiveHealthReadinessModifier), but this screen was applying the raw,
  // ungated modifier to every user's plan preview (and, via getDeloadNudge
  // below, showing a banner claiming the RHR-based trim happened even for
  // free users). isPremium === null (still checking) falls back to 1/undefined
  // too — an unverified session should never silently get the paid trim.
  const effectiveHealthReadinessModifier = isPremium ? healthReadinessModifier : 1;
  const effectiveHealthReadinessReasons = isPremium ? healthReadinessReasons : undefined;
  // Once today's session has started, its readiness adjustment is frozen
  // (TodaySession.planHealthReadiness) — reading the same frozen value here
  // keeps this card's counts identical to the session actually being done.
  const planHealthReadinessModifier = todaySession?.planHealthReadiness?.modifier ?? effectiveHealthReadinessModifier;
  const planHealthReadinessReasons = todaySession?.planHealthReadiness
    ? todaySession.planHealthReadiness.reasons
    : effectiveHealthReadinessReasons;

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

  // unlessUnchanged: a focus that finds nothing new keeps every object as
  // it was, so the plan engine above doesn't re-run and the screen doesn't
  // re-render on a plain tab switch.
  const applyHomeData = useCallback((data: Awaited<ReturnType<typeof loadHomeData>>) => {
    setProfile(unlessUnchanged(data.profile));
    setTodaySession(unlessUnchanged(data.todaySession));
    setCalibration(unlessUnchanged(data.calibration));
    setDeloadNudge(unlessUnchanged(data.deloadNudge));
    setHealthReadinessModifier(data.healthReadinessModifier);
    setHealthReadinessReasons(unlessUnchanged(data.healthReadinessReasons));
    setTrainingState(unlessUnchanged(data.trainingState));
    setWeekActivity(unlessUnchanged(data.weekActivity));
  }, []);

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

      // The banner check resolves BEFORE status flips to ready — it used to
      // run after, so the banner popped in above Today's card a beat after
      // the screen had already appeared, shoving everything below it down.
      const [data, available, connected, dismissed] = await Promise.all([
        loadHomeData(isPremium),
        isHealthKitAvailable(),
        hasConnectedHealthKit(),
        isHealthKitBannerDismissed(),
      ]);
      if (cancelled) return;
      applyHomeData(data);
      setShowHealthKitBanner(available && !connected && !dismissed);
      setStatus('ready');
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
        applyHomeData(await loadHomeData(isPremium));
      })();
      // isPremium added alongside the getDeloadNudge/effectiveHealthReadinessModifier
      // gating fix — without it, this callback (and the isPremium value it
      // closes over when calling getDeloadNudge) would stay frozen at
      // whatever isPremium was the one time `status` flipped to 'ready',
      // never picking up entitlement resolving moments later.
    }, [status, isPremium, applyHomeData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    applyHomeData(await loadHomeData(isPremium));
    setRefreshing(false);
  }, [isPremium, applyHomeData]);

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

  // Re-read on every focus (and profile change), so answering on the
  // equipment screen and coming back clears it straight away.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      shouldAskForEquipment(profile).then((ask) => {
        if (!cancelled) setShowEquipmentPrompt(ask);
      });
      return () => {
        cancelled = true;
      };
    }, [profile])
  );

  const handleSetEquipment = useCallback(() => {
    hapticImpactLight();
    router.push({
      pathname: '/onboarding/equipment',
      params: { mode: 'edit', environment: profile?.environment ?? '' },
    } as never);
  }, [profile?.environment]);

  const handleDismissEquipmentPrompt = useCallback(async () => {
    hapticSelect();
    setShowEquipmentPrompt(false);
    await dismissEquipmentPrompt();
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
    const unit = await getUnitSystem();
    const message = getShareableWeeklyRecapText(
      weekActivity,
      recentImprovement
        ? {
            exerciseName: recentImprovement.exerciseName,
            estimatedOneRepMaxKg: recentImprovement.performance.estimatedOneRepMax,
          }
        : null,
      unit
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
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 100 + insets.bottom }]}
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
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.textSecondary} />
        }
      >
        <Header styles={styles} firstName={firstName} weeklyRecap={weeklyRecap} />

        {deloadNudge?.triggered && deloadNudge.message ? (
          <ReanimatedAnimated.View exiting={bannerExiting}>
          <Pressable
            style={({ pressed }) => [styles.deloadBanner, pressed && PRESSED_DIM]}
            onPress={() => {
              hapticSelect();
              router.push('/home/check-in' as never);
            }}
            android_ripple={AndroidRipple}
          >
            <View style={styles.deloadBannerRow}>
              <SymbolView name="moon.zzz.fill" size={15} tintColor={colors.textSecondary} />
              <Text style={styles.deloadBannerText} maxFontSizeMultiplier={1.4}>{deloadNudge.message}</Text>
            </View>
            <Text style={styles.deloadBannerAction} maxFontSizeMultiplier={1.2}>
              Check in →
            </Text>
          </Pressable>
          </ReanimatedAnimated.View>
        ) : null}

        {/* Plans for a home setup that never said what it has use a default
            kit — worth one ask. Shown instead of the Apple Health card, not
            stacked with it; that one waits until this is answered. */}
        {showEquipmentPrompt ? (
          <ReanimatedAnimated.View exiting={bannerExiting} style={styles.healthKitBanner}>
            <View style={styles.healthKitBannerRow}>
              <SymbolView name="dumbbell.fill" size={15} tintColor="#5FBE84" />
              <Text style={styles.healthKitBannerText} maxFontSizeMultiplier={1.4}>
                What equipment do you have? Your plans use a basic home kit until you say.
              </Text>
            </View>
            <View style={styles.healthKitBannerActions}>
              <Pressable
                style={({ pressed }) => [styles.healthKitBannerDismiss, pressed && PRESSED_DIM]}
                onPress={handleDismissEquipmentPrompt}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.healthKitBannerDismissText} maxFontSizeMultiplier={1.2}>
                  Not now
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.healthKitBannerConnect, pressed && PRESSED_DIM]}
                onPress={handleSetEquipment}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.healthKitBannerConnectText} maxFontSizeMultiplier={1.2}>
                  Set equipment
                </Text>
              </Pressable>
            </View>
          </ReanimatedAnimated.View>
        ) : null}

        {/* Fades out when dismissed or connected, and everything below
            glides up into its space (contentLayout) — it used to vanish
            and let the whole screen jump. */}
        {showHealthKitBanner && !showEquipmentPrompt ? (
          <ReanimatedAnimated.View exiting={bannerExiting} style={styles.healthKitBanner}>
            <View style={styles.healthKitBannerRow}>
              <SymbolView name="heart.fill" size={15} tintColor="#5FBE84" />
              <Text style={styles.healthKitBannerText} maxFontSizeMultiplier={1.4}>
                See your plan alongside real activity, calories burned, sleep, and heart rate from Apple Health.
              </Text>
            </View>
            <View style={styles.healthKitBannerActions}>
              <Pressable
                style={({ pressed }) => [styles.healthKitBannerDismiss, pressed && PRESSED_DIM]}
                onPress={handleDismissHealthKitBanner}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.healthKitBannerDismissText} maxFontSizeMultiplier={1.2}>
                  Not now
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.healthKitBannerConnect, pressed && PRESSED_DIM]}
                onPress={handleConnectHealthKit}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.healthKitBannerConnectText} maxFontSizeMultiplier={1.2}>
                  Connect
                </Text>
              </Pressable>
            </View>
          </ReanimatedAnimated.View>
        ) : null}

        <ReanimatedAnimated.View layout={contentLayout} style={styles.contentStack}>
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
          isPremium={isPremium}
        />
        </ReanimatedAnimated.View>
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

  // getGreeting()/formatToday() below stay fresh via SummaryScreen's own
  // clock-tick (see there) — Header isn't memoized, so every re-render its
  // parent gets, this gets too. Used to have its own separate copy of the
  // same interval+AppState mechanism, but that only ever re-rendered this
  // component, not the parent's own today/isRestDay logic, which could
  // still go stale across a real midnight boundary even while this text
  // looked fine. One shared tick instead of two independent ones.

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
        android_ripple={{ ...AndroidRipple, borderless: true }}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
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
                // A rest day is a small quiet dot, not the same ring as a
                // training day with a slightly fainter border — the two
                // used to be all but indistinguishable. Today keeps its
                // full ring either way so it's always findable.
                !day.isScheduled && !day.isToday && styles.weekDotRest,
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
            android_ripple={AndroidRipple}
            accessibilityRole="button"
            accessibilityLabel="Share this week's activity"
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
  isPremium,
}: {
  styles: ReturnType<typeof createStyles>;
  profile: UserProfile | null;
  todaySession: TodaySession | null;
  weekActivity: { days: WeekDay[]; completedCount: number; scheduledCount: number };
  calibration: UserCalibration | null;
  isPremium: boolean | null;
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

  // Real per-day intensity, not a redraw of loadLevel's own commitment-tier
  // meter — the same caloriesBurned estimate getWeeklyCaloriesBurned sums
  // for the week, read per day instead. A day with no real estimate (rest,
  // future, unscheduled, or an old entry logged before caloriesBurned
  // existed) draws as an empty track rather than a fabricated bar, per this
  // app's own no-synthetic-data rule for trend visuals.
  const maxDailyKcal = Math.max(1, ...weekActivity.days.map((day) => day.caloriesBurned ?? 0));
  // An all-empty chart was seven flat stubs under 40pt of blank space — a
  // plain line saying what will appear there reads better until real data does.
  const hasAnyLoadData = weekActivity.days.some((day) => (day.caloriesBurned ?? 0) > 0);
  // Once real sessions are in, the header reports what the week actually
  // took — the same estimates the bars are drawn from — instead of the
  // planned level, which only stands in until there's something to measure.
  const weekKcal = weekActivity.days.reduce((sum, day) => sum + (day.caloriesBurned ?? 0), 0);
  // The bars are each session's calorie estimate, and that estimate needs a
  // body weight (check-in.tsx records none without one). Someone who skipped
  // sharing it would otherwise read "bars fill in as you log sessions" week
  // after week while logging sessions and never see one.
  const hasBodyWeight = Number(profile?.weightKg) > 0;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>YOUR FITNESS</Text>

      {/* POLICY CHANGE (explicit product decision, not a bug fix): Home's
          own Training Load and Consistency cards are now Plus-gated too,
          same PremiumGate teaser as Progress tab's Training Balance and
          consistency calendar — those two are a deeper, per-exercise/
          per-day breakdown of the same underlying signal this quick
          glanceable summary shows, so this closes the last free preview of
          it rather than leaving the headline number reachable for free
          while its detail view costs Plus. */}
      <PremiumGate isPremium={isPremium} label="Training Load" feature="consistency">
      <View style={styles.fitnessCard}>
        <View style={styles.fitnessCardHeader}>
          <Text style={styles.fitnessCardLabel} maxFontSizeMultiplier={1.3}>Training Load</Text>
          {/* Before any session: the PLANNED load (from the commitment level
              chosen at setup), not a measurement — labeled as such, since it
              sat above an empty chart and read as a claim about training
              that hadn't happened. After: the week's real estimate, "~"
              like every other calorie figure in the app. */}
          {hasAnyLoadData ? (
            <Text style={styles.fitnessCardValue} maxFontSizeMultiplier={1.2}>
              ~{weekKcal.toLocaleString('en-US')}
              <Text style={styles.fitnessCardTier}> cal this week</Text>
            </Text>
          ) : (
            <Text style={styles.fitnessCardValue} maxFontSizeMultiplier={1.2}>
              {loadLabel}
              <Text style={styles.fitnessCardTier}> plan</Text>
            </Text>
          )}
        </View>
        {hasAnyLoadData ? (
        <View style={styles.loadChart} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {weekActivity.days.map((day, index) => {
            const kcal = day.caloriesBurned ?? 0;
            const hasData = kcal > 0;
            const ratio = hasData ? kcal / maxDailyKcal : 0;
            const barColor = ratio > 0.66 ? LOAD_METER_COLORS[2] : ratio > 0.33 ? LOAD_METER_COLORS[1] : LOAD_METER_COLORS[0];
            return (
              <View key={day.date} style={styles.loadChartColumn}>
                <View style={styles.loadChartTrack}>
                  {hasData ? (
                    <LoadChartBar
                      styles={styles}
                      heightPct={Math.max(ratio, 0.12) * 100}
                      color={barColor}
                      delay={index * 40}
                    />
                  ) : (
                    <View style={[styles.loadChartBar, styles.loadChartBarEmpty]} />
                  )}
                </View>
                <Text
                  style={[styles.loadChartDay, day.isToday && styles.loadChartDayToday]}
                  maxFontSizeMultiplier={1.15}
                >
                  {WEEKDAY_LETTERS[index]}
                </Text>
              </View>
            );
          })}
        </View>
        ) : (
          <Text style={styles.loadChartEmptyText} maxFontSizeMultiplier={1.3}>
            {hasBodyWeight
              ? 'Bars fill in as you log sessions this week.'
              : 'Add your weight in Settings → Body & Biometrics to chart each session’s effort.'}
          </Text>
        )}
        <Text style={styles.fitnessCardNote} maxFontSizeMultiplier={1.4}>{readinessNote}</Text>
        {calibrationNote ? (
          <Text style={styles.fitnessCardCalibrationNote} maxFontSizeMultiplier={1.4}>
            {calibrationNote}
          </Text>
        ) : null}
      </View>
      </PremiumGate>

      <PremiumGate isPremium={isPremium} label="Consistency" feature="consistency">
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
      </PremiumGate>
    </View>
  );
}

/**
 * One day's bar in Training Load — grows up from its baseline the first
 * time it appears, on the same curve as the app's other charts (Sparkline,
 * ProgressRing, RadarChart), rather than appearing fully drawn; `delay`
 * lets the week rise left to right. Instant under Reduce Motion.
 */
function LoadChartBar({
  styles,
  heightPct,
  color,
  delay,
}: {
  styles: ReturnType<typeof createStyles>;
  heightPct: number;
  color: string;
  delay: number;
}) {
  const reducedMotion = useReducedMotion();
  const grow = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) {
      grow.value = 1;
      return;
    }
    grow.value = withDelay(150 + delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [grow, reducedMotion, delay]);
  const growStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));
  return (
    <ReanimatedAnimated.View
      style={[styles.loadChartBar, { height: `${heightPct}%`, backgroundColor: color, transformOrigin: 'bottom' }, growStyle]}
    />
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
    // Same spacing as scrollContent's own gap — the cards below the banners
    // are grouped only so they can move together when a banner leaves.
    contentStack: {
      gap: 28,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    greeting: {
      color: colors.text,
      fontSize: Type.heading,
      letterSpacing: -0.3,
      fontFamily: 'Geist-Bold',
    },
    dateText: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: Type.body,
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
      fontSize: Type.secondary,
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
      color: colors.accentText,
      fontSize: Type.secondary,
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
      fontSize: Type.secondary,
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
      fontSize: Type.secondary,
      fontFamily: 'Geist-SemiBold',
    },
    healthKitBannerConnect: {
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    healthKitBannerConnectText: {
      color: colors.accentText,
      fontSize: Type.secondary,
      fontFamily: 'Geist-SemiBold',
    },
    // Neutral, not a celebratory accent — this is an observation ("3
    // sessions this week"), never a score, so it reads the same as any
    // other plain fact on the screen rather than drawing extra attention.
    momentumText: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
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
      color: colors.accentText,
      fontSize: Type.bodyLarge,
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
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
    },
    weekDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.textQuaternary,
      backgroundColor: 'transparent',
    },
    // Same 22pt footprint as a ring (margins), so the row never shifts.
    weekDotRest: {
      width: 6,
      height: 6,
      borderRadius: 3,
      borderWidth: 0,
      marginVertical: 8,
      backgroundColor: colors.surfaceBorder,
    },
    weekDotCompleted: {
      borderColor: '#5FBE84',
      backgroundColor: '#5FBE84',
    },
    // A scheduled day that's gone by without a session is just quieter than
    // one still ahead — never red. A skipped day isn't a debt this app
    // holds against anyone; the body was resting either way.
    weekDotMissed: {
      opacity: 0.45,
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
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
      ...TabularNums,
    },
    weekShareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    weekShareText: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Medium',
    },
    fitnessCard: {
      padding: 16,
      borderRadius: Platform.OS === 'android' ? 20 : 16,
      backgroundColor: colors.surface,
      ...(Platform.OS === 'android'
        ? AndroidCardElevation
        : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceBorder }),
    },
    fitnessCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fitnessCardLabel: {
      color: colors.text,
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
    },
    fitnessCardValue: {
      color: colors.text,
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-Bold',
      ...TabularNums,
    },
    fitnessCardTier: {
      color: colors.textTertiary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Medium',
    },
    // Seven slim columns with their weekday under each — the bars used to
    // run edge to edge with no labels, so a tall one couldn't be read as a
    // particular day without counting along from Monday.
    loadChart: {
      marginTop: 14,
      flexDirection: 'row',
      gap: 6,
    },
    loadChartColumn: {
      flex: 1,
      alignItems: 'center',
    },
    loadChartTrack: {
      width: '100%',
      height: 56,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    loadChartBar: {
      width: '58%',
      maxWidth: 22,
      borderRadius: 4,
    },
    loadChartBarEmpty: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.badgeBg,
    },
    loadChartDay: {
      marginTop: 6,
      color: colors.textTertiary,
      fontSize: Type.micro,
      fontFamily: 'Geist-Medium',
    },
    loadChartDayToday: {
      color: colors.text,
      fontFamily: 'Geist-SemiBold',
    },
    loadChartEmptyText: {
      marginTop: 10,
      color: colors.textTertiary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Medium',
    },
    fitnessCardNote: {
      marginTop: 6,
      color: colors.textSecondary,
      fontSize: Type.secondary,
      lineHeight: 17,
      fontFamily: 'Geist-Regular',
    },
    fitnessCardCalibrationNote: {
      marginTop: 4,
      color: colors.textTertiary,
      fontSize: Type.caption,
      lineHeight: 15,
      fontFamily: 'Geist-Regular',
    },
  });
}
