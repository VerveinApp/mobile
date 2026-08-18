import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { TodaysTrainingCard } from '@/components/home/todays-training-card';
import { getCalibration } from '@/lib/calibration';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import type { UserCalibration } from '@/lib/engine/types';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import { useAppColors } from '@/lib/theme-context';
import { getTodaySession, type TodaySession } from '@/lib/today-session';
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todaySession, setTodaySession] = useState<TodaySession | null>(null);
  const [calibration, setCalibration] = useState<UserCalibration | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [loadedProfile, loadedSession, loadedCalibration] = await Promise.all([
          getProfile(),
          getTodaySession(),
          getCalibration(),
        ]);
        setProfile(loadedProfile);
        setTodaySession(loadedSession);
        setCalibration(loadedCalibration);
        setLoaded(true);
      })();
    }, [])
  );

  // Memoized — this now runs the real engine's filtering over the full
  // exercise library (see plan-preview.ts), not a cheap lookup, so it
  // shouldn't recompute on every render, only when its actual inputs change.
  // Declared before the loading-state early return below so the hook order
  // stays stable across renders (Rules of Hooks).
  const preview = useMemo(
    () =>
      computePlanPreview(
        profile ?? {},
        todaySession?.energy ?? 4,
        calibration ?? { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION }
      ),
    [profile, todaySession?.energy, calibration]
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
                      Est. {preview.exerciseCount} · {preview.durationMin} min
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
