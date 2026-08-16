import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { getCalibration } from '@/lib/calibration';
import { getDeloadNudge } from '@/lib/deload';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import type { DeloadNudge, UserCalibration } from '@/lib/engine/types';
import { getMomentumNote } from '@/lib/momentum';
import { hasCompletedOnboarding, loadOnboardingDraft, ONBOARDING_STEP_ROUTES } from '@/lib/onboarding-draft';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import { computePotential, type PotentialResult } from '@/lib/potential-score';
import { getCurrentStreak, getWeekActivity, type WeekDay } from '@/lib/session-history';
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
  const [streak, setStreak] = useState(0);
  const [calibration, setCalibration] = useState<UserCalibration | null>(null);
  const [deloadNudge, setDeloadNudge] = useState<DeloadNudge | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      const [activity, currentStreak] = await Promise.all([
        getWeekActivity(trainingDays),
        getCurrentStreak(trainingDays),
      ]);
      if (cancelled) return;
      setWeekActivity(activity);
      setStreak(currentStreak);
      setStatus('ready');
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
        const [activity, currentStreak] = await Promise.all([
          getWeekActivity(trainingDays),
          getCurrentStreak(trainingDays),
        ]);
        setWeekActivity(activity);
        setStreak(currentStreak);
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
    const [activity, currentStreak] = await Promise.all([
      getWeekActivity(trainingDays),
      getCurrentStreak(trainingDays),
    ]);
    setWeekActivity(activity);
    setStreak(currentStreak);
    setRefreshing(false);
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

  const potential = computePotential(profile ?? {});
  const today = WEEKDAY_NAMES[new Date().getDay()];
  const trainingDays = profile?.days ? profile.days.split(',') : null;
  const isRestDay = trainingDays !== null && !trainingDays.includes(today);
  const firstName = profile?.name?.trim().split(' ')[0];
  const sessionLabel = SESSION_LABEL_BY_GOAL[profile?.goal ?? ''] ?? 'Training Session';
  const momentum = getMomentumNote(streak, weekActivity);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.textSecondary} />
        }
      >
        <Header styles={styles} firstName={firstName} momentum={momentum} />

        {deloadNudge?.triggered && deloadNudge.message ? (
          <View style={styles.deloadBanner}>
            <SymbolView name="moon.zzz.fill" size={15} tintColor={colors.textSecondary} />
            <Text style={styles.deloadBannerText}>{deloadNudge.message}</Text>
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

        <YourFitness styles={styles} profile={profile} todaySession={todaySession} weekActivity={weekActivity} potential={potential} />

        <YourTrends styles={styles} potential={potential} />
      </ScrollView>
    </View>
  );
}

function Header({
  styles,
  firstName,
  momentum,
}: {
  styles: ReturnType<typeof createStyles>;
  firstName?: string;
  momentum: { text: string; hasStreak: boolean } | null;
}) {
  const hover = useHoverFade();
  const press = useLiquidPress();
  const initial = firstName ? firstName[0].toUpperCase() : '·';

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting}>
          {getGreeting()}
          {firstName ? `, ${firstName}` : ''}
        </Text>
        <Text style={styles.dateText}>{formatToday()}</Text>
        {momentum ? (
          <View style={styles.momentumRow}>
            {momentum.hasStreak ? (
              <SymbolView name="flame.fill" size={11} tintColor="#E8823C" style={styles.momentumIcon} />
            ) : null}
            <Text style={[styles.momentumText, momentum.hasStreak && styles.momentumTextStreak]}>
              {momentum.text}
            </Text>
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
          <Text style={styles.avatarText}>{initial}</Text>
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
      <Text style={styles.sectionKicker}>THIS WEEK</Text>
      <View style={styles.weekRow}>
        {weekActivity.days.map((day, index) => (
          <View key={day.weekday} style={styles.weekDayCol}>
            <Text style={styles.weekDayLetter}>{WEEKDAY_LETTERS[index]}</Text>
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
      <Text style={styles.weekSummary}>
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
  potential,
}: {
  styles: ReturnType<typeof createStyles>;
  profile: UserProfile | null;
  todaySession: TodaySession | null;
  weekActivity: { completedCount: number; scheduledCount: number };
  potential: PotentialResult;
}) {
  const strength = potential.pillars.find((p) => p.key === 'strength');
  const strengthNote =
    strength && strength.value > potential.overall
      ? 'One of your stronger areas right now.'
      : 'Room to build here.';

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

  const ratio = weekActivity.scheduledCount > 0 ? weekActivity.completedCount / weekActivity.scheduledCount : 0;
  const consistencyNote =
    weekActivity.scheduledCount === 0
      ? "Let's get your first session in."
      : ratio >= 0.75
        ? "You're building real momentum."
        : ratio >= 0.25
          ? 'Stay consistent to build momentum.'
          : "Let's get back on track this week.";

  return (
    <View style={styles.section}>
      <Text style={styles.sectionKicker}>YOUR FITNESS</Text>

      <View style={styles.fitnessCard}>
        <View style={styles.fitnessCardHeader}>
          <Text style={styles.fitnessCardLabel}>Strength</Text>
          <Text style={styles.fitnessCardValue}>
            {strength?.value ?? 60}% <Text style={styles.fitnessCardTier}>· {strength?.tier ?? 'Moderate'}</Text>
          </Text>
        </View>
        <Text style={styles.fitnessCardNote}>{strengthNote}</Text>
      </View>

      <View style={styles.fitnessCard}>
        <View style={styles.fitnessCardHeader}>
          <Text style={styles.fitnessCardLabel}>Training Load</Text>
          <Text style={styles.fitnessCardValue}>{loadLabel}</Text>
        </View>
        <Text style={styles.fitnessCardNote}>{readinessNote}</Text>
      </View>

      <View style={styles.fitnessCard}>
        <View style={styles.fitnessCardHeader}>
          <Text style={styles.fitnessCardLabel}>Consistency</Text>
          <Text style={styles.fitnessCardValue}>
            {weekActivity.completedCount}/{weekActivity.scheduledCount}
            <Text style={styles.fitnessCardTier}> this week</Text>
          </Text>
        </View>
        <Text style={styles.fitnessCardNote}>{consistencyNote}</Text>
      </View>
    </View>
  );
}

function YourTrends({ styles, potential }: { styles: ReturnType<typeof createStyles>; potential: PotentialResult }) {
  const hover = useHoverFade();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionKicker}>YOUR TRENDS</Text>
      <View style={styles.trendsCard}>
        <View pointerEvents="none" style={styles.cardSheen} />
        {potential.pillars.map((pillar, index) => {
          const direction = pillar.value > potential.overall + 3 ? 'up' : pillar.value < potential.overall - 3 ? 'down' : 'flat';
          const arrow = direction === 'up' ? '↗' : direction === 'down' ? '↘' : '→';
          return (
            <View key={pillar.key}>
              {index > 0 ? <View style={styles.trendDivider} /> : null}
              <Pressable
                style={styles.trendRow}
                onPress={() => router.push('/progress' as never)}
                onHoverIn={hover.onHoverIn}
                onHoverOut={hover.onHoverOut}
              >
                <Text style={styles.trendLabel}>{pillar.label}</Text>
                <View style={styles.trendRight}>
                  <Text style={styles.trendValue}>{pillar.value}%</Text>
                  <Text style={[styles.trendArrow, direction === 'up' && styles.trendArrowUp]}>{arrow}</Text>
                </View>
              </Pressable>
            </View>
          );
        })}
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
    momentumIcon: {
      marginRight: 5,
    },
    momentumText: {
      color: '#5FBE84',
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    momentumTextStreak: {
      color: '#E8823C',
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
    // Softer, roomier radius than the 10px card language used everywhere
    // else — this screen is deliberately "soft and spacious," not another
    // hard-outlined rectangle. Still used by YourFitness's stacked cards below
    // even though TodaysTrainingCard itself now lives in its own component.
    cardSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '55%',
      backgroundColor: colors.surfaceSheen,
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
    trendsCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      overflow: 'hidden',
    },
    trendDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.surfaceDivider,
    },
    trendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
    },
    trendLabel: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    trendRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    trendValue: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    trendArrow: {
      color: colors.textTertiary,
      fontSize: 14,
      fontFamily: 'Geist-Bold',
    },
    trendArrowUp: {
      color: '#5FBE84',
    },
  });
}
