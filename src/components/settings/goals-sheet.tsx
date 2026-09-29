import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import ReanimatedAnimated, { LayoutAnimationConfig } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';

import { Type } from '@/constants/theme';
import { useHoverFade, useLiquidPress, PRESSED_DIM } from '@/lib/button-interactions';
import { getAllExercisePerformances, type ExercisePerformance } from '@/lib/exercise-performance';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { HorizontalRuler } from '@/components/onboarding/horizontal-ruler';
import { LIST_ROW_ENTERING, LIST_ROW_EXITING, LIST_ROW_LAYOUT } from '@/lib/motion';
import { useAppColors } from '@/lib/theme-context';
import { usePreloadedSheet } from '@/components/settings/use-preloaded-sheet';
import { getUnitSystem, type UnitSystem } from '@/lib/unit-preference';
import { getProfile, updateProfile } from '@/lib/user-profile';
import { getWeightLog, resolveCurrentWeightKg } from '@/lib/weight-log';

// Same conversion math as biometrics-sheet.tsx's own weight fields —
// duplicated rather than shared, same independence reasoning that sheet
// itself already gives for not sharing with onboarding/step-5.tsx.
const WEIGHT_LB_ITEMS = Array.from({ length: 281 }, (_, i) => `${i + 80} lb`);
const WEIGHT_KG_ITEMS = Array.from({ length: 146 }, (_, i) => `${i + 35} kg`);
const DEFAULT_WEIGHT_KG = 73;
// A wider range than the body-weight wheel above — a compound lift target
// (squat, deadlift) can comfortably exceed anyone's own bodyweight range.
const LIFT_LB_ITEMS = Array.from({ length: 601 }, (_, i) => `${i} lb`);
const LIFT_KG_ITEMS = Array.from({ length: 273 }, (_, i) => `${i} kg`);
const DEFAULT_LIFT_TARGET_KG = 60;

function kgToLbIndex(kg: number): number {
  return Math.min(WEIGHT_LB_ITEMS.length - 1, Math.max(0, Math.round(kg / 0.453592) - 80));
}

function lbToKg(lbIndex: number): number {
  return Math.round((lbIndex + 80) * 0.453592);
}

function kgToKgIndex(kg: number): number {
  return Math.min(WEIGHT_KG_ITEMS.length - 1, Math.max(0, kg - 35));
}

function kgToLiftLbIndex(kg: number): number {
  return Math.min(LIFT_LB_ITEMS.length - 1, Math.max(0, Math.round(kg / 0.453592)));
}

function liftLbToKg(lbIndex: number): number {
  return Math.round(lbIndex * 0.453592);
}

function kgToLiftKgIndex(kg: number): number {
  return Math.min(LIFT_KG_ITEMS.length - 1, Math.max(0, Math.round(kg)));
}

function latestOneRepMaxKg(history: ExercisePerformance[] | undefined): number | null {
  return history && history.length > 0 ? history[history.length - 1].estimatedOneRepMax : null;
}

// Same conversion as biometrics-sheet.tsx/weight-history.tsx's own weight
// formatters — duplicated rather than shared, same cross-screen independence
// reasoning those already give.
function formatLiftWeight(weightKg: number, unit: UnitSystem): string {
  const value = unit === 'metric' ? weightKg : weightKg / 0.453592;
  return `${Math.round(value)} ${unit === 'metric' ? 'kg' : 'lb'}`;
}

/**
 * Two entirely optional targets — a target weight (compared against
 * weight-log.ts's real entries on settings/weight-history.tsx) and a target
 * lift (compared against exercise-performance.ts's own real logged
 * estimated-1RM history for that exercise). Neither is auto-calculated as a
 * *target*: the final number is always the user's own, never a projection of
 * their current plan or a fabricated formula result. The lift target can
 * only be set for an exercise that already has real logged history — a
 * target compared against nothing real isn't honest progress, it's a guess
 * dressed up as a number (the same objection that got the old weekly
 * calorie-burn goal replaced: it mostly just re-measured "did you do your
 * planned sessions," dressed up in kcal).
 *
 * Either goal can be turned off independently — a target someone doesn't
 * want isn't a gap to fill with a guessed default, same "optional, never
 * assumed" contract as conditions/movementRestrictions.
 */
export const GoalsSheet = forwardRef<BottomSheetModal, { onDismiss?: () => void }>(({ onDismiss }, forwardedRef) => {
  const sheetRef = useRef<BottomSheetModal>(null);

  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [unit, setUnit] = useState<UnitSystem>('imperial');
  const [targetWeightEnabled, setTargetWeightEnabled] = useState(false);
  const [targetWeightKgValue, setTargetWeightKgValue] = useState(DEFAULT_WEIGHT_KG);
  const [targetLiftEnabled, setTargetLiftEnabled] = useState(false);
  const [targetLiftExercise, setTargetLiftExercise] = useState<string | null>(null);
  const [targetLiftKgValue, setTargetLiftKgValue] = useState(DEFAULT_LIFT_TARGET_KG);
  // Every exercise with real logged history — a target can only be set
  // against one of these, never picked from the full exercise library, since
  // there'd be nothing real yet to compare it to (see this sheet's own doc
  // comment on why that distinction matters).
  const [exercisePerformances, setExercisePerformances] = useState<Record<string, ExercisePerformance[]>>({});
  const [saving, setSaving] = useState(false);

  const loadFromProfile = useCallback(async () => {
    const [profile, globalUnit, weightLog, performances] = await Promise.all([
      getProfile(),
      getUnitSystem(),
      getWeightLog(),
      getAllExercisePerformances(),
    ]);
    setUnit(globalUnit);
    setExercisePerformances(performances);
    // BUG FIX (found in a later full-app audit): this used to read
    // profile.weightKg directly everywhere below, while profile.tsx's own
    // Goals card preferred the latest Weight History log entry — updating
    // weight via Biometrics (which only touches profile.weightKg, not the
    // weight log) without also logging a fresh weigh-in could make this
    // sheet's own target disagree with Profile's, opened from the very same
    // card. resolveCurrentWeightKg is the one shared resolution both now use.
    const currentWeightKg = resolveCurrentWeightKg(weightLog, profile?.weightKg);
    if (profile?.targetWeightKg) {
      setTargetWeightEnabled(true);
      setTargetWeightKgValue(Number(profile.targetWeightKg) || currentWeightKg || DEFAULT_WEIGHT_KG);
    } else {
      setTargetWeightEnabled(false);
      setTargetWeightKgValue(currentWeightKg || DEFAULT_WEIGHT_KG);
    }
    if (profile?.targetLiftExercise && profile?.targetLiftWeightKg) {
      setTargetLiftEnabled(true);
      setTargetLiftExercise(profile.targetLiftExercise);
      setTargetLiftKgValue(Number(profile.targetLiftWeightKg) || DEFAULT_LIFT_TARGET_KG);
    } else {
      setTargetLiftEnabled(false);
      setTargetLiftExercise(null);
      setTargetLiftKgValue(DEFAULT_LIFT_TARGET_KG);
    }
  }, []);

  usePreloadedSheet(forwardedRef, sheetRef, loadFromProfile);

  const closeHover = useHoverFade();
  const saveHover = useHoverFade();
  const savePress = useLiquidPress();

  const handleToggleTargetWeight = (value: boolean) => {
    hapticSelect();
    setTargetWeightEnabled(value);
  };

  const handleToggleTargetLift = (value: boolean) => {
    hapticSelect();
    setTargetLiftEnabled(value);
  };

  // Seeds the wheel at this exercise's own current best (rounded to a whole
  // unit) every time the exercise selection changes — same "start from a
  // real number, not whatever the wheel happened to be at" reasoning
  // targetWeightKgValue's own seeding follows, applied on selection instead
  // of on sheet-open since there's no single profile value to seed from here.
  const handleSelectExercise = (name: string) => {
    hapticSelect();
    setTargetLiftExercise(name);
    const best = latestOneRepMaxKg(exercisePerformances[name]);
    if (best !== null) setTargetLiftKgValue(Math.round(best));
  };

  const handleSave = async () => {
    if (saving) return;
    hapticImpactLight();
    setSaving(true);
    const liftGoalComplete = targetLiftEnabled && targetLiftExercise !== null;
    await updateProfile({
      targetWeightKg: targetWeightEnabled ? String(targetWeightKgValue) : undefined,
      targetLiftExercise: liftGoalComplete ? (targetLiftExercise as string) : undefined,
      targetLiftWeightKg: liftGoalComplete ? String(targetLiftKgValue) : undefined,
    });
    setSaving(false);
    sheetRef.current?.dismiss();
  };

  const lbIndex = kgToLbIndex(targetWeightKgValue);
  const kgIndex = kgToKgIndex(targetWeightKgValue);
  const liftLbIndex = kgToLiftLbIndex(targetLiftKgValue);
  const liftKgIndex = kgToLiftKgIndex(targetLiftKgValue);
  const loggedExerciseNames = Object.keys(exercisePerformances).sort((a, b) => a.localeCompare(b));
  const currentBestKg = targetLiftExercise ? latestOneRepMaxKg(exercisePerformances[targetLiftExercise]) : null;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['75%']}
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 } : { backgroundColor: colors.background }}
      handleIndicatorStyle={{ backgroundColor: Platform.OS === 'android' ? 'rgba(95,190,132,0.5)' : colors.surfaceBorder, width: Platform.OS === 'android' ? 36 : undefined }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Goals</Text>
        <Pressable
          onPress={() => sheetRef.current?.dismiss()}
          onHoverIn={closeHover.onHoverIn}
          onHoverOut={closeHover.onHoverOut}
          hitSlop={10}
          style={({ pressed }) => [styles.closeButton, pressed && PRESSED_DIM]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <SymbolView name="xmark" size={13} tintColor={colors.iconMuted} />
        </Pressable>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Content mounts fresh on every present — a goal that's already on
            arrives with the sheet's slide, not faded in on top of it. Only
            what a switch or a pick reveals after that glides in. */}
        <LayoutAnimationConfig skipEntering>
        <Text style={styles.hint} maxFontSizeMultiplier={1.4}>
          Entirely optional, and entirely yours to set — nothing here changes how your plan is built.
        </Text>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Target weight</Text>
            <Switch
              value={targetWeightEnabled}
              onValueChange={handleToggleTargetWeight}
              trackColor={{ false: colors.pillBorder, true: '#438C63' }}
            />
          </View>
          {targetWeightEnabled ? (
            <ReanimatedAnimated.View style={styles.wheelCard} entering={LIST_ROW_ENTERING} exiting={LIST_ROW_EXITING}>
              <View style={styles.wheelRow}>
                {unit === 'imperial' ? (
                  <HorizontalRuler
                    items={WEIGHT_LB_ITEMS}
                    accessibilityLabel="Target weight"
                    selectedIndex={lbIndex}
                    onChange={(index) => setTargetWeightKgValue(lbToKg(index))}
                  />
                ) : (
                  <HorizontalRuler
                    items={WEIGHT_KG_ITEMS}
                    accessibilityLabel="Target weight"
                    selectedIndex={kgIndex}
                    onChange={(index) => setTargetWeightKgValue(index + 35)}
                  />
                )}
              </View>
            </ReanimatedAnimated.View>
          ) : null}
        </View>

        <ReanimatedAnimated.View style={styles.section} layout={LIST_ROW_LAYOUT}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Target lift</Text>
            <Switch
              value={targetLiftEnabled}
              onValueChange={handleToggleTargetLift}
              trackColor={{ false: colors.pillBorder, true: '#438C63' }}
            />
          </View>
          {targetLiftEnabled ? (
            loggedExerciseNames.length === 0 ? (
              <ReanimatedAnimated.Text
                style={styles.hint}
                entering={LIST_ROW_ENTERING}
                exiting={LIST_ROW_EXITING}
                maxFontSizeMultiplier={1.4}
              >
                Log a weight for an exercise first — a target compares against your real numbers, not a guess.
              </ReanimatedAnimated.Text>
            ) : (
              <>
                <ReanimatedAnimated.View style={styles.exerciseList} entering={LIST_ROW_ENTERING} exiting={LIST_ROW_EXITING}>
                  {loggedExerciseNames.map((name, index) => {
                    const isSelected = targetLiftExercise === name;
                    const isLast = index === loggedExerciseNames.length - 1;
                    return (
                      <Pressable
                        key={name}
                        style={({ pressed }) => [styles.exerciseRow, !isLast && styles.exerciseRowDivider, pressed && PRESSED_DIM]}
                        onPress={() => handleSelectExercise(name)}
                      >
                        <Text style={styles.exerciseRowLabel} maxFontSizeMultiplier={1.3}>{name}</Text>
                        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                          {isSelected ? <SymbolView name="checkmark" size={11} tintColor="#ffffff" weight="bold" /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </ReanimatedAnimated.View>
                {targetLiftExercise ? (
                  <>
                    <ReanimatedAnimated.View style={styles.wheelCard} entering={LIST_ROW_ENTERING} exiting={LIST_ROW_EXITING}>
                      <View style={styles.wheelRow}>
                        {unit === 'imperial' ? (
                          <HorizontalRuler
                            items={LIFT_LB_ITEMS}
                            accessibilityLabel="Target lift weight"
                            selectedIndex={liftLbIndex}
                            onChange={(index) => setTargetLiftKgValue(liftLbToKg(index))}
                          />
                        ) : (
                          <HorizontalRuler
                            items={LIFT_KG_ITEMS}
                            accessibilityLabel="Target lift weight"
                            selectedIndex={liftKgIndex}
                            onChange={(index) => setTargetLiftKgValue(index)}
                          />
                        )}
                      </View>
                    </ReanimatedAnimated.View>
                    {currentBestKg !== null ? (
                      <ReanimatedAnimated.Text
                        style={styles.hint}
                        entering={LIST_ROW_ENTERING}
                        exiting={LIST_ROW_EXITING}
                        maxFontSizeMultiplier={1.4}
                      >
                        Current best: {formatLiftWeight(currentBestKg, unit)} est. 1RM — real logged sets, not a
                        projection.
                      </ReanimatedAnimated.Text>
                    ) : null}
                  </>
                ) : null}
              </>
            )
          ) : null}
        </ReanimatedAnimated.View>

        <ReanimatedAnimated.View layout={LIST_ROW_LAYOUT}>
        <Pressable
          onPress={handleSave}
          onHoverIn={saveHover.onHoverIn}
          onHoverOut={saveHover.onHoverOut}
          onPressIn={savePress.onPressIn}
          onPressOut={savePress.onPressOut}
          disabled={saving}
        >
          <View style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
            {/* The press glow savePress already animates — wired to the
                Pressable above but never drawn, so Save gave no visual
                response to a tap. */}
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.saveButtonGlow, { opacity: savePress.glow }]}
            />
            <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.15}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </View>
        </Pressable>
        </ReanimatedAnimated.View>
        </LayoutAnimationConfig>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
GoalsSheet.displayName = 'GoalsSheet';

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    headerTitle: {
      color: colors.text,
      fontSize: Type.subtitle,
      fontFamily: 'Geist-SemiBold',
    },
    closeButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.pillBg,
    },
    scrollContent: {
      paddingHorizontal: 20,
      gap: 24,
    },
    hint: {
      color: colors.textTertiary,
      fontSize: Type.secondary,
      lineHeight: 18,
      fontFamily: 'Geist-Medium',
    },
    section: {
      gap: 10,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Medium',
    },
    wheelCard: {
      // BUG FIX: same fix as biometrics-sheet.tsx's identical wheelCard —
      // the parent section's default flex `stretch` forced this to full
      // width, and alignItems: 'flex-start' below only controlled the
      // wheelRow's position WITHIN that already-too-wide card, leaving a
      // large empty region to the right of the narrow wheel content.
      alignSelf: 'flex-start',
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingVertical: 8,
      paddingHorizontal: 12,
      alignItems: 'flex-start',
    },
    wheelRow: {
      flexDirection: 'row',
      gap: 10,
    },
    // Same row-list/checkbox visual language as movement-restrictions-
    // sheet.tsx's own selectable list — single-select here (picking one
    // clears any previous pick) rather than that sheet's multi-select.
    exerciseList: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    exerciseRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    exerciseRowLabel: {
      color: colors.text,
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      borderColor: '#438C63',
      backgroundColor: '#438C63',
    },
    saveButton: {
      marginTop: 8,
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: '#438C63',
      alignItems: 'center',
    },
    saveButtonGlow: {
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: '#ffffff',
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
