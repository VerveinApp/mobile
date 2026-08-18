import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useHoverFade } from '@/lib/button-interactions';
import {
  DURATION_LABELS,
  ENVIRONMENT_LABELS,
  EXPERIENCE_LABELS,
  formatDays,
  GOAL_LABELS,
} from '@/lib/profile-labels';
import { COMMITMENT_LEVELS } from '@/lib/commitment-levels';
import { useAppColors } from '@/lib/theme-context';
import { getProfile, type UserProfile } from '@/lib/user-profile';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  // useFocusEffect (not useEffect) — this tab stays mounted while Settings'
  // Adjust My Plan / Biometrics screens push on top of it, so a plain mount
  // effect would never re-read the profile those screens just changed.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const p = await getProfile();
        setProfile(p);
        setLoaded(true);
      })();
    }, [])
  );

  const settingsHover = useHoverFade();

  if (!loaded) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <SkeletonBlock width={72} height={72} borderRadius={36} />
            <SkeletonBlock width={140} height={19} borderRadius={6} style={{ marginTop: 14 }} />
            <SkeletonBlock width={170} height={12.5} borderRadius={6} style={{ marginTop: 8 }} />
          </View>

          <View style={styles.section}>
            <SkeletonBlock width={80} height={11} borderRadius={4} />
            <SkeletonCard height={260} lines={5} />
          </View>

          <View style={styles.section}>
            <SkeletonBlock width={110} height={11} borderRadius={4} />
            <SkeletonCard height={280} lines={3} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const commitmentIndex = profile?.commitmentLevel ? Number(profile.commitmentLevel) - 1 : null;
  const commitmentName = commitmentIndex !== null ? (COMMITMENT_LEVELS[commitmentIndex]?.name ?? 'Not set') : 'Not set';
  const firstName = profile?.name?.trim().split(' ')[0];
  const initial = firstName ? firstName[0].toUpperCase() : '·';

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push('/settings' as never)}
            onHoverIn={settingsHover.onHoverIn}
            onHoverOut={settingsHover.onHoverOut}
            hitSlop={10}
            style={styles.settingsButton}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <SymbolView name="gearshape.fill" size={17} tintColor={colors.iconMuted} />
          </Pressable>

          <View style={styles.avatarGlow} pointerEvents="none" />
          <View style={styles.avatarVisual}>
            <Text style={styles.avatarText} maxFontSizeMultiplier={1.15}>{initial}</Text>
          </View>
          <Text style={styles.name} maxFontSizeMultiplier={1.3}>{profile?.name?.trim() || 'Your Profile'}</Text>
          {profile?.email ? <Text style={styles.email} maxFontSizeMultiplier={1.3}>{profile.email}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>YOUR PLAN</Text>
          <View style={styles.card}>
            <View pointerEvents="none" style={styles.cardSheen} />
            <PlanRow styles={styles} icon="target" label="Goal" value={GOAL_LABELS[profile?.goal ?? ''] ?? 'Not set'} />
            <PlanRow styles={styles} icon="chart.bar.fill" label="Experience" value={EXPERIENCE_LABELS[profile?.experience ?? ''] ?? 'Not set'} />
            <PlanRow styles={styles} icon="dumbbell.fill" label="Equipment" value={ENVIRONMENT_LABELS[profile?.environment ?? ''] ?? 'Not set'} />
            <PlanRow styles={styles} icon="clock.fill" label="Session Length" value={DURATION_LABELS[profile?.duration ?? ''] ?? 'Not set'} />
            <PlanRow styles={styles} icon="calendar" label="Training Days" value={formatDays(profile?.days)} />
            <PlanRow styles={styles} icon="flame.fill" label="Commitment" value={commitmentName} last />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function PlanRow({
  styles,
  icon,
  label,
  value,
  last = false,
}: {
  styles: ReturnType<typeof createStyles>;
  icon: SFSymbol;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.planRow, !last && styles.planRowDivider]}>
      <View style={styles.planRowLeft}>
        <SymbolView name={icon} size={15} tintColor="#5FBE84" style={styles.planRowIcon} />
        <Text style={styles.planRowLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      </View>
      <Text style={styles.planRowValue} maxFontSizeMultiplier={1.2}>{value}</Text>
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
      alignItems: 'center',
      paddingVertical: 8,
    },
    settingsButton: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Same radial-glow language used behind the CommitmentDial/logo elsewhere
    // in the app — the avatar gets a moment of that too, not a flat circle.
    avatarGlow: {
      position: 'absolute',
      top: -12,
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: '#438C63',
      opacity: 0.14,
    },
    avatarVisual: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.glassBorder,
      backgroundColor: 'rgba(67,140,99,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: '#5FBE84',
      fontSize: 24,
      fontFamily: 'Geist-Bold',
    },
    name: {
      marginTop: 14,
      color: colors.text,
      fontSize: 19,
      letterSpacing: -0.2,
      fontFamily: 'Geist-Bold',
    },
    email: {
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: 12.5,
      fontFamily: 'Geist-Medium',
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
      overflow: 'hidden',
    },
    cardSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '40%',
      backgroundColor: colors.surfaceSheen,
    },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
    },
    planRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    planRowIcon: {
      width: 15,
      height: 15,
      marginRight: 10,
    },
    planRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    planRowLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    planRowValue: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
