import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { getCalibration } from '@/lib/calibration';
import { getDeloadNudge } from '@/lib/deload';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import type { DeloadNudge, UserCalibration } from '@/lib/engine/types';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import {
  dismissHealthKitBanner,
  hasConnectedHealthKit,
  isHealthKitAvailable,
  isHealthKitBannerDismissed,
  requestHealthKitAccess,
} from '@/lib/health-kit';
import { getWeeklyRecap } from '@/lib/momentum';
import { hasCompletedOnboarding, loadOnboardingDraft, ONBOARDING_STEP_ROUTES } from '@/lib/onboarding-draft';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import { getWeekActivity, type WeekDay } from '@/lib/session-history';
import { useAppColors } from '@/lib/theme-context';
import { getTodaySession, type TodaySession } from '@/lib/today-session';
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
  const [refreshing, setRefreshing] = useState(false);
  const [showHealthKitBanner, setShowHealthKitBanner] = useState(false);

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
        calibration ?? { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION }
      ),
    [profile, todaySession?.energy, calibration]
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

      const [loadedProfile, loadedSession, loadedCalibration, loadedDeloadNudge] = await Promise.all([
        getProfile(),
        getTodaySession(),
        getCalibration(),
        getDeloadNudge(),
      ]);
      if (cancelled) return;
      setProfile(loadedProfile);
      setTodaySession(loadedSession);
      setCalibration(loadedCalibration);
      setDeloadNudge(loadedDeloadNudge);

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
        const [loadedProfile, loadedSession, loadedCalibration, loadedDeloadNudge] = await Promise.all([
          getProfile(),
          getTodaySession(),
          getCalibration(),
          getDeloadNudge(),
        ]);
        setProfile(loadedProfile);
        setTodaySession(loadedSession);
        setCalibration(loadedCalibration);
        setDeloadNudge(loadedDeloadNudge);
        const trainingDays = loadedProfile?.days ? loadedProfile.days.split(',') : null;
        setWeekActivity(await getWeekActivity(trainingDays));
      })();
    }, [status])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const [loadedProfile, loadedSession, loadedCalibration, loadedDeloadNudge] = await Promise.all([
      getProfile(),
      getTodaySession(),
      getCalibration(),
      getDeloadNudge(),
    ]);
    setProfile(loadedProfile);
    setTodaySession(loadedSession);
    setCalibration(loadedCalibration);
    setDeloadNudge(loadedDeloadNudge);
    const trainingDays = loadedProfile?.days ? loadedProfile.days.split(',') : null;
    setWeekActivity(await getWeekActivity(trainingDays));
    setRefreshing(false);
  }, []);

  const handleConnectHealthKit = useCallback(async () => {
    hapticImpactLight();
    // Fires the real system permission dialog — banner only disappears on
    // completion (granted or not) so a mid-decision tap can't leave the
    // banner stuck in a stale "still asking" state.
    await requestHealthKitAccess();
    setShowHealthKitBanner(false);
  }, []);

  const handleDismissHealthKitBanner = useCallback(async () => {
    hapticSelect();
    setShowHealthKitBanner(false);
    await dismissHealthKitBanner();
  }, []);

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
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.textSecondary} />
        }
      >
        <Header styles={styles} firstName={firstName} weeklyRecap={weeklyRecap} />

        {deloadNudge?.triggered && deloadNudge.message ? (
          <View style={styles.deloadBanner}>
            <SymbolView name="moon.zzz.fill" size={15} tintColor={colors.textSecondary} />
            <Text style={styles.deloadBannerText} maxFontSizeMultiplier={1.4}>{deloadNudge.message}</Text>
          </View>
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

        <WeeklyActivity styles={styles} weekActivity={weekActivity} />

        <YourFitness
          styles={styles}
          profile={profile}
          todaySession={todaySession}
          weekActivity={weekActivity}
          calibration={calibration}
        />
      </ScrollView>
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
  weekActivity,
}: {
  styles: ReturnType<typeof createStyles>;
  weekActivity: { days: WeekDay[]; completedCount: number; scheduledCount: number };
}) {
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
                day.isScheduled && day.completed && styles.weekDotCompleted,
                day.isScheduled && day.completed === false && styles.weekDotMissed,
                day.isToday && styles.weekDotToday,
              ]}
            />
          </View>
        ))}
      </View>
      <Text style={styles.weekSummary} maxFontSizeMultiplier={1.3}>
        {weekActivity.completedCount} / {weekActivity.scheduledCount} workouts completed
      </Text>
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
  // has — invisible until now. Only surfaced once "established" (same
  // TIER_ESTABLISHED_MIN=10 threshold M20's Tiered pattern uses elsewhere)
  // and only when the deviation is a real signal, not early noise — 0.08 is
  // personal-calibration.ts's own STEP size, so anything smaller is less
  // than a single full adjustment's worth of movement.
  const calibrationNote =
    calibration && calibration.sampleCount >= 10
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    deloadBannerText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
      fontFamily: 'Geist-Medium',
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
    weekSummary: {
      color: colors.textSecondary,
      fontSize: 13,
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
