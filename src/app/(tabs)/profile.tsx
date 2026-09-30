import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useHoverFade, PRESSED_DIM } from '@/lib/button-interactions';
import { AndroidCardElevation, AndroidRipple, TabularNums, Type, sheenGradient } from '@/constants/theme';
import { hapticImpactLight, hapticSuccess } from '@/lib/haptics';
import {
  DURATION_LABELS,
  ENVIRONMENT_LABELS,
  EXPERIENCE_LABELS,
  formatDays,
  GOAL_LABELS,
} from '@/lib/profile-labels';
import { COMMITMENT_LEVELS } from '@/lib/commitment-levels';
import { getLastPerformance } from '@/lib/exercise-performance';
import { getUnitSystem, type UnitSystem } from '@/lib/unit-preference';
import { getWeightLog, resolveCurrentWeightKg } from '@/lib/weight-log';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { unlessUnchanged } from '@/lib/stable-state';
import { useAppTheme } from '@/lib/theme-context';
import { usePremiumEntitlement } from '@/lib/purchases';
import { getProfile, updateProfile, type UserProfile } from '@/lib/user-profile';
import { AdjustPlanSheet } from '@/components/settings/adjust-plan-sheet';
import { GoalsSheet } from '@/components/settings/goals-sheet';
import { PremiumGate } from '@/components/premium-gate';
import { ProgressRing } from '@/components/ui/progress-ring';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';
import { Sparkline, type SparklinePoint } from '@/components/ui/sparkline';

// Same conversion as biometrics-sheet.tsx/weight-history.tsx's own weight
// formatters — duplicated rather than shared, same cross-screen independence
// reasoning those already give.
function formatWeightKg(weightKg: number, unit: UnitSystem): string {
  const value = unit === 'metric' ? weightKg : weightKg / 0.453592;
  return `${Math.round(value * 10) / 10}${unit === 'metric' ? 'kg' : 'lb'}`;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors, resolvedScheme } = useAppTheme();
  const isDark = resolvedScheme === 'dark';
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Same shared fade used across onboarding, check-in, Home, Progress, and
  // Train — the loading-skeleton-to-real-content swap below previously
  // hard-cut with no transition, the one motion-language gap against the
  // rest of the app. Only fires on the true initial load — loaded stays
  // true across subsequent focuses (see the useFocusEffect comment below),
  // so returning from Settings never re-triggers it.
  const entering = useFadeInEntering();
  const isPremium = usePremiumEntitlement();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [unit, setUnit] = useState<UnitSystem>('imperial');
  // The real current weight, same "latest log entry, else profile" resolution
  // weight-history.tsx already uses — profile.weightKg alone can go stale
  // the moment someone logs a new weigh-in there without also reopening
  // Biometrics.
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);
  // Oldest-to-newest, mirroring weight-history.tsx's own trend chart exactly
  // (same >= 2-entries threshold) — empty means "not enough real history
  // yet," which the render below reads as "show the plain text fallback,"
  // never a fabricated flat line.
  const [weightTrendData, setWeightTrendData] = useState<SparklinePoint[]>([]);
  const [trendChartWidth, setTrendChartWidth] = useState(0);
  // Real logged best for the target-lift exercise (undefined until the
  // profile itself resolves, since which exercise to look up depends on
  // it) — null (not 0) whenever there's no target set or nothing logged yet
  // for that exercise, same "no honest number, don't show one" rule
  // targetWeightKg's own progress already follows.
  const [currentLiftBestKg, setCurrentLiftBestKg] = useState<number | null>(null);
  const goalsSheetRef = useRef<BottomSheetModal>(null);
  const adjustPlanSheetRef = useRef<BottomSheetModal>(null);

  const loadProfileData = useCallback(async () => {
    const [p, globalUnit, weightLog] = await Promise.all([getProfile(), getUnitSystem(), getWeightLog()]);
    // unlessUnchanged: a focus that finds nothing new keeps every object as
    // it was, so a plain tab switch doesn't re-render this screen.
    setProfile(unlessUnchanged(p));
    setUnit(globalUnit);
    setCurrentWeightKg(resolveCurrentWeightKg(weightLog, p?.weightKg));
    setWeightTrendData(
      unlessUnchanged(weightLog.length >= 2 ? [...weightLog].reverse().map((e) => ({ value: e.weightKg })) : [])
    );
    // Which exercise to look up only exists once the profile itself has
    // resolved, so this can't join the Promise.all above.
    const lastLiftPerformance = p?.targetLiftExercise ? await getLastPerformance(p.targetLiftExercise) : null;
    setCurrentLiftBestKg(lastLiftPerformance?.estimatedOneRepMax ?? null);
    setLoaded(true);
  }, []);

  // useFocusEffect (not useEffect) — this tab stays mounted while Settings'
  // Adjust My Plan / Biometrics screens push on top of it, so a plain mount
  // effect would never re-read the profile those screens just changed.
  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

  const settingsHover = useHoverFade();
  const logHover = useHoverFade();
  const nameHover = useHoverFade();
  const goalsHover = useHoverFade();

  const handleOpenEditName = () => {
    hapticImpactLight();
    setNameDraft(profile?.name?.trim() ?? '');
    setShowEditNameModal(true);
  };

  const handleCancelEditName = () => {
    if (savingName) return;
    hapticImpactLight();
    setShowEditNameModal(false);
  };

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || savingName) return;
    setSavingName(true);
    const next = await updateProfile({ name: trimmed });
    setProfile(next);
    setSavingName(false);
    setShowEditNameModal(false);
    hapticSuccess();
  };

  if (!loaded) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 100 + insets.bottom }]}
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

  // Same "configured vs computable" split targetWeight below already needs —
  // a target genuinely set but not yet computable (the logged exercise has
  // no history, e.g. cleared via Delete My Data) shouldn't collapse into the
  // same "Not set" the never-configured case shows.
  const targetLiftConfigured = Boolean(profile?.targetLiftExercise && profile?.targetLiftWeightKg);
  const targetLiftExerciseName = targetLiftConfigured ? (profile?.targetLiftExercise as string) : null;
  const targetLiftGoalKg = targetLiftConfigured ? Number(profile?.targetLiftWeightKg) : null;
  const hasLiftProgress = targetLiftConfigured && currentLiftBestKg !== null;
  const targetLiftProgress =
    hasLiftProgress && targetLiftGoalKg !== null && targetLiftGoalKg > 0 ? (currentLiftBestKg as number) / targetLiftGoalKg : 0;
  const targetLiftPct = Math.round(Math.min(1, Math.max(0, targetLiftProgress)) * 100);

  // BUG FIX (found via live device testing, not caught by unit tests since
  // profile.tsx has none — an E2E profile with a real targetWeightKg but no
  // weightKg/weight-log entry at all reproduced this): a target genuinely
  // configured but not yet computable (no current weight on file) used to
  // collapse into the same "Not set" the never-configured case shows,
  // silently implying the person's own saved target didn't stick. These are
  // two different states now — targetWeightConfigured for "did they set
  // one," hasTargetWeight for "can I show real progress on it."
  const targetWeightConfigured = Boolean(profile?.targetWeightKg);
  const hasTargetWeight = targetWeightConfigured && currentWeightKg !== null;
  const targetWeightKg = targetWeightConfigured ? Number(profile?.targetWeightKg) : null;
  const targetRemainingKg = hasTargetWeight ? Math.abs((currentWeightKg as number) - (targetWeightKg as number)) : null;
  // Same neutral, direction-agnostic "to go" framing as weight-history.tsx's
  // own target row — never "over"/"under," matching this app's anti-guilt
  // rule for every other progress-toward-a-number display.
  const targetRemainingLabel =
    targetRemainingKg !== null
      ? targetRemainingKg < 0.5
        ? "You're at your target."
        : `${formatWeightKg(targetRemainingKg, unit)} to go`
      : null;

  return (
    <View style={styles.root}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push('/settings' as never)}
            onHoverIn={settingsHover.onHoverIn}
            onHoverOut={settingsHover.onHoverOut}
            hitSlop={10}
            style={({ pressed }) => [styles.settingsButton, pressed && PRESSED_DIM]}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <SymbolView name="gearshape.fill" size={17} tintColor={colors.iconMuted} />
          </Pressable>

          <View style={styles.avatarVisual}>
            <Text style={styles.avatarText} maxFontSizeMultiplier={1.15}>{initial}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.nameHit, pressed && PRESSED_DIM]}
            onPress={handleOpenEditName}
            onHoverIn={nameHover.onHoverIn}
            onHoverOut={nameHover.onHoverOut}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit your name"
          >
            <View style={styles.namePencilSpacer} pointerEvents="none" />
            <Text style={styles.name} maxFontSizeMultiplier={1.3}>{profile?.name?.trim() || 'Your Profile'}</Text>
            <SymbolView name="pencil" size={13} tintColor={colors.textTertiary} style={styles.namePencil} />
          </Pressable>
          {profile?.email ? <Text style={styles.email} maxFontSizeMultiplier={1.3}>{profile.email}</Text> : null}
          {isPremium ? (
            <View style={styles.plusBadge}>
              {/* Dark mode's own request: keep the near-black icon there (it
                  was already correct), but flip to white in light mode —
                  the same dark tone read as too harsh/muddy against this
                  badge's lighter-appearing green background there. */}
              <SymbolView name="sparkles" size={10} tintColor={isDark ? '#05130b' : '#ffffff'} />
              <Text
                style={[styles.plusBadgeText, { color: isDark ? '#05130b' : '#ffffff' }]}
                maxFontSizeMultiplier={1.2}
              >
                Plus
              </Text>
            </View>
          ) : null}
        </View>

        <Modal
          visible={showEditNameModal}
          transparent
          animationType="fade"
          onRequestClose={handleCancelEditName}
          statusBarTranslucent
        >
          <Pressable style={styles.editNameBackdrop} onPress={handleCancelEditName}>
            {/* BUG FIX (found in a later full-app audit): this modal has no
                keyboard-avoidance at all — the card is vertically centered
                with an auto-focused TextInput, so the keyboard could
                partially cover it with no shift-up behavior on shorter
                devices. */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.editNameKeyboardWrap}
            >
            <Pressable style={styles.editNameCard} onPress={() => {}}>
              <Text style={styles.editNameTitle} maxFontSizeMultiplier={1.3}>Edit your name</Text>
              <TextInput
                style={styles.editNameInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
                maxLength={25}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
                maxFontSizeMultiplier={1.3}
              />
              <View style={styles.editNameActions}>
                <Pressable
                  style={({ pressed }) => [styles.editNameCancelHit, pressed && PRESSED_DIM]}
                  onPress={handleCancelEditName}
                  hitSlop={8}
                  disabled={savingName}
                >
                  <Text style={styles.editNameCancelText} maxFontSizeMultiplier={1.2}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.editNameConfirmHit, (!nameDraft.trim() || savingName) && styles.editNameConfirmHitDisabled, pressed && PRESSED_DIM]}
                  onPress={handleSaveName}
                  hitSlop={8}
                  disabled={!nameDraft.trim() || savingName}
                >
                  <Text style={styles.editNameConfirmText} maxFontSizeMultiplier={1.2}>
                    {savingName ? 'Saving…' : 'Save'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>

        <View style={styles.section}>
          <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>YOUR PLAN</Text>
          {/* Tappable — these rows looked like settings you could change,
              but tapping did nothing; editing lived only in Settings. Opens
              the same Adjust My Plan sheet directly. */}
          <Pressable
            style={({ pressed }) => [styles.card, pressed && PRESSED_DIM]}
            onPress={() => {
              hapticImpactLight();
              adjustPlanSheetRef.current?.present();
            }}
            accessibilityRole="button"
            accessibilityLabel="Your plan. Tap to adjust it"
          >
            <View pointerEvents="none" style={styles.cardSheen} />
            <PlanRow styles={styles} icon="target" label="Objective" value={GOAL_LABELS[profile?.goal ?? ''] ?? 'Not set'} />
            <PlanRow styles={styles} icon="chart.bar.fill" label="Experience" value={EXPERIENCE_LABELS[profile?.experience ?? ''] ?? 'Not set'} />
            <PlanRow styles={styles} icon="dumbbell.fill" label="Equipment" value={ENVIRONMENT_LABELS[profile?.environment ?? ''] ?? 'Not set'} />
            <PlanRow styles={styles} icon="clock.fill" label="Session Length" value={DURATION_LABELS[profile?.duration ?? ''] ?? 'Not set'} />
            <PlanRow styles={styles} icon="calendar" label="Training Days" value={formatDays(profile?.days)} />
            <PlanRow styles={styles} icon="flame.fill" label="Commitment" value={commitmentName} last />
            <View style={styles.planEditRow}>
              <Text style={styles.planEditText} maxFontSizeMultiplier={1.2}>Adjust my plan</Text>
              <SymbolView name="chevron.right" size={11} tintColor={colors.accentText} />
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>LOG</Text>
          <Pressable
            style={({ pressed }) => [styles.card, pressed && PRESSED_DIM]}
            onPress={() => router.push('/log' as never)}
            onHoverIn={logHover.onHoverIn}
            onHoverOut={logHover.onHoverOut}
            android_ripple={AndroidRipple}
            accessibilityRole="button"
            accessibilityLabel="Log. Backfill a past session or weigh-in"
          >
            <View pointerEvents="none" style={styles.cardSheen} />
            <View style={styles.logRow}>
              <View style={styles.planRowLeft}>
                <SymbolView name="square.and.pencil" size={15} tintColor="#5FBE84" style={styles.planRowIcon} />
                <View>
                  <Text style={styles.planRowLabel} maxFontSizeMultiplier={1.3}>Log</Text>
                  <Text style={styles.logRowSubtitle} maxFontSizeMultiplier={1.3}>Backfill a past session or weigh-in</Text>
                </View>
              </View>
              <SymbolView name="chevron.right" size={12} tintColor={colors.iconFaint} />
            </View>
          </Pressable>
        </View>

        {/* Kicker outside the gate, same as every PremiumGate on Progress —
            wrapping the whole section used to hide the GOALS heading (and
            its section spacing) from free users, leaving a bare teaser card
            jammed against the LOG section above it. */}
        <View style={styles.section}>
          <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>GOALS</Text>
          <PremiumGate isPremium={isPremium} label="Goals" feature="goals">
          <Pressable
            style={({ pressed }) => [styles.card, pressed && PRESSED_DIM]}
            onPress={() => goalsSheetRef.current?.present()}
            onHoverIn={goalsHover.onHoverIn}
            onHoverOut={goalsHover.onHoverOut}
            android_ripple={AndroidRipple}
            accessibilityRole="button"
            accessibilityLabel="Goals. Set a target weight and a target lift"
          >
            <View pointerEvents="none" style={styles.cardSheen} />

            <View style={styles.goalRingRow}>
              <ProgressRing size={56} strokeWidth={6} progress={targetLiftProgress} color="#5FBE84" trackColor={colors.surfaceDivider} />
              <View style={styles.goalRingTextBlock}>
                <Text style={styles.goalEyebrow} maxFontSizeMultiplier={1.3}>Target Lift</Text>
                {!targetLiftConfigured ? (
                  <Text style={styles.goalRingValue} maxFontSizeMultiplier={1.2}>Not set</Text>
                ) : !hasLiftProgress ? (
                  <Text style={styles.goalRingValue} maxFontSizeMultiplier={1.2}>No logged sets yet</Text>
                ) : (
                  <>
                    <Text style={styles.goalRingValue} maxFontSizeMultiplier={1.2}>
                      {formatWeightKg(currentLiftBestKg as number, unit)}
                      <Text style={styles.goalRingValueMuted}> / {formatWeightKg(targetLiftGoalKg as number, unit)}</Text>
                    </Text>
                    <Text style={styles.goalRingSub} maxFontSizeMultiplier={1.3}>
                      {targetLiftExerciseName} · {targetLiftPct}% to target
                    </Text>
                  </>
                )}
              </View>
            </View>

            <View style={styles.goalDivider} />

            <View style={styles.goalTrendBlock}>
              <View style={styles.goalTrendTop}>
                <Text style={styles.goalEyebrow} maxFontSizeMultiplier={1.3}>Target Weight</Text>
                {targetRemainingLabel ? (
                  <Text style={styles.goalTrendNote} maxFontSizeMultiplier={1.2}>{targetRemainingLabel}</Text>
                ) : null}
              </View>
              {!targetWeightConfigured ? (
                <Text style={styles.goalTrendFallback} maxFontSizeMultiplier={1.3}>Not set</Text>
              ) : !hasTargetWeight ? (
                <Text style={styles.goalTrendFallback} maxFontSizeMultiplier={1.3}>
                  Add your current weight to see progress
                </Text>
              ) : weightTrendData.length >= 2 ? (
                <View onLayout={(e) => setTrendChartWidth(e.nativeEvent.layout.width)}>
                  {trendChartWidth > 0 ? (
                    <Sparkline
                      data={weightTrendData}
                      width={trendChartWidth}
                      height={46}
                      color="#5FBE84"
                      filled
                      referenceValue={targetWeightKg as number}
                      referenceColor={colors.textTertiary}
                    />
                  ) : null}
                </View>
              ) : (
                <Text style={styles.goalTrendFallback} maxFontSizeMultiplier={1.3}>
                  {formatWeightKg(currentWeightKg as number, unit)} now → {formatWeightKg(targetWeightKg as number, unit)} target
                </Text>
              )}
            </View>
          </Pressable>
          </PremiumGate>
        </View>
      </ScrollView>
      </ReanimatedAnimated.View>
      <GoalsSheet ref={goalsSheetRef} onDismiss={loadProfileData} />
      <AdjustPlanSheet ref={adjustPlanSheetRef} onDismiss={loadProfileData} />
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

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
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
      color: colors.accentText,
      fontSize: Type.display,
      fontFamily: 'Geist-Bold',
    },
    nameHit: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    name: {
      color: colors.text,
      fontSize: Type.title,
      letterSpacing: -0.2,
      fontFamily: 'Geist-Bold',
    },
    namePencil: {
      marginTop: 2,
    },
    // Mirrors the pencil icon's width on the other side of the name so the
    // name text itself sits centered on screen — without this, the row's
    // combined (name + icon) width centers instead, visibly shifting the
    // name left of center.
    namePencilSpacer: {
      width: 13,
    },
    email: {
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Medium',
    },
    plusBadge: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: '#5FBE84',
    },
    plusBadgeText: {
      fontSize: Type.caption,
      fontFamily: 'Geist-Bold',
      letterSpacing: 0.2,
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
    card: {
      borderRadius: Platform.OS === 'android' ? 20 : 16,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      overflow: 'hidden',
      ...(Platform.OS === 'android'
        ? AndroidCardElevation
        : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceBorder }),
    },
    cardSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '40%',
      ...sheenGradient(colors.surfaceSheen),
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
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    planRowValue: {
      color: colors.text,
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
    },
    planEditRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
      paddingTop: 12,
      paddingBottom: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.surfaceDivider,
    },
    planEditText: {
      color: colors.accentText,
      fontSize: Type.secondary,
      fontFamily: 'Geist-SemiBold',
    },
    logRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    logRowSubtitle: {
      marginTop: 2,
      color: colors.textTertiary,
      fontSize: Type.micro,
      fontFamily: 'Geist-Medium',
    },
    goalRingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
    },
    goalRingTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    goalEyebrow: {
      color: colors.textTertiary,
      // Was 10 (a stray half-pixel off sectionKicker's own 11 for the
      // identical "small-caps eyebrow" role, unintentional drift — see
      // constants/theme.ts's own Type.caption doc comment).
      fontSize: Type.caption,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      fontFamily: 'Geist-SemiBold',
      marginBottom: 3,
    },
    goalRingValue: {
      color: colors.text,
      fontSize: Type.stat,
      letterSpacing: -0.2,
      fontFamily: 'Geist-Black',
      ...TabularNums,
    },
    goalRingValueMuted: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-SemiBold',
      ...TabularNums,
    },
    goalRingSub: {
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
    },
    goalDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.surfaceDivider,
    },
    goalTrendBlock: {
      paddingVertical: 12,
    },
    goalTrendTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 8,
    },
    goalTrendNote: {
      color: '#438C63',
      // Was 11.5, half a pixel off goalRingSub's own 11 for the same "small
      // supporting note" role right above it.
      fontSize: Type.caption,
      fontFamily: 'Geist-SemiBold',
    },
    goalTrendFallback: {
      color: colors.text,
      fontSize: Type.secondary,
      fontFamily: 'Geist-SemiBold',
    },
    editNameBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    editNameKeyboardWrap: {
      width: '100%',
      alignItems: 'center',
    },
    editNameCard: {
      width: '100%',
      maxWidth: 340,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 22,
      paddingVertical: 22,
      gap: 12,
    },
    editNameTitle: {
      color: colors.text,
      fontSize: Type.subtitle,
      fontFamily: 'Geist-SemiBold',
    },
    editNameInput: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-Medium',
    },
    editNameActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 16,
    },
    editNameCancelHit: {
      paddingVertical: 10,
      paddingHorizontal: 6,
    },
    editNameCancelText: {
      color: colors.textSecondary,
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    editNameConfirmHit: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: '#29563a',
    },
    editNameConfirmHitDisabled: {
      opacity: 0.5,
    },
    editNameConfirmText: {
      color: '#ffffff',
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
