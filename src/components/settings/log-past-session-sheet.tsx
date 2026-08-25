import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ENERGY_LABELS, type EnergyScore } from '@/components/home/energy-gauge';
import { WheelPicker } from '@/components/onboarding/wheel-picker';
import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSelect, hapticSuccess } from '@/lib/haptics';
import { localDateStr } from '@/lib/local-date';
import type { BodyArea } from '@/lib/plan-preview';
import { getSessionHistory, recordPastSessionCompletion, saveSessionNote } from '@/lib/session-history';
import { useAppColors } from '@/lib/theme-context';
import { getCompletionStatus, saveRetroactiveWorkoutLog, type WorkoutLogExercise } from '@/lib/workout-log';

// 30 days back, matching MAX_ENTRIES's own rolling-window convention in
// both session-history.ts and workout-log.ts — logging something older
// than that window wouldn't durably persist against either store anyway.
// Starts at 1 day ago, deliberately excluding today: today already has the
// real, live check-in.tsx flow, and offering a second write path for the
// exact same day would create two conflicting "what happened today"
// records rather than one honest one.
const WHEEL_DAY_OFFSETS = Array.from({ length: 30 }, (_, i) => i + 1);

const BODY_AREA_ORDER: BodyArea[] = ['upper', 'lower', 'core', 'full'];
const BODY_AREA_LABELS: Record<BodyArea, string> = {
  upper: 'Upper Body',
  lower: 'Lower Body',
  core: 'Core',
  full: 'Full Body',
};
const ENERGY_SCORES: EnergyScore[] = [1, 2, 3, 4, 5];

function wheelLabel(offsetDays: number, date: Date): string {
  if (offsetDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * "I trained on a day I never opened the app for" — the honest backfill
 * path Progress & History's own history list can't otherwise capture.
 * Deliberately body-area-level, not a real per-exercise pick from the
 * library: asking someone to reconstruct exact exercise IDs for a day
 * that's already passed would either take real browsing effort or invite a
 * guess dressed up as a fact, neither of which fits this app's "never
 * fabricate" rule. "I trained legs and core that day" is something a
 * person can actually know with confidence days later; "I did exactly
 * Barbell Back Squat for 3 sets of 8" usually isn't. See
 * saveRetroactiveWorkoutLog's own doc comment for how that honest
 * body-area choice threads through to storage.
 *
 * Never runs the real engine (computePlanPreview) — there's no live energy
 * score or health context for a day that's already over, so this doesn't
 * pretend to be an adaptive session, just a manual record of what happened.
 */
export const LogPastSessionSheet = forwardRef<BottomSheetModal, { onSaved?: () => void }>(({ onSaved }, forwardedRef) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(forwardedRef, () => sheetRef.current as BottomSheetModal, []);

  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [dayIndex, setDayIndex] = useState(0); // index into WHEEL_DAY_OFFSETS — 0 = yesterday
  const [selectedAreas, setSelectedAreas] = useState<Set<BodyArea>>(new Set());
  const [energy, setEnergy] = useState<EnergyScore | null>(null);
  const [note, setNote] = useState('');
  const [existingDates, setExistingDates] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const wheelItems = useMemo(
    () =>
      WHEEL_DAY_OFFSETS.map((offset) => {
        const d = new Date();
        d.setDate(d.getDate() - offset);
        return wheelLabel(offset, d);
      }),
    []
  );
  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - WHEEL_DAY_OFFSETS[dayIndex]);
    return d;
  }, [dayIndex]);
  const selectedDateStr = localDateStr(selectedDate);
  const alreadyLogged = existingDates.has(selectedDateStr);

  // Resets to a blank form every time the sheet opens — this isn't an
  // editor for a specific existing entry, so there's no "previous value" to
  // restore the way AdjustPlanSheet/BiometricsSheet load a real saved
  // profile. Also loads which recent dates already have an entry, purely so
  // the inline warning below the wheel can be honest about an overwrite
  // before it happens, not to block picking that date outright.
  const handleSheetChange = useCallback((index: number) => {
    if (index < 0) return;
    setDayIndex(0);
    setSelectedAreas(new Set());
    setEnergy(null);
    setNote('');
    (async () => {
      const history = await getSessionHistory();
      setExistingDates(new Set(history.map((e) => e.date)));
    })();
  }, []);

  const closeHover = useHoverFade();
  const saveHover = useHoverFade();
  const savePress = useLiquidPress();
  // Declared individually, not via a loop/reduce over BODY_AREA_ORDER — same
  // reasoning as biometrics-sheet.tsx's own sexInteractions/unitInteractions:
  // hooks can't be called inside a loop even over a fixed-length array,
  // since neither the rules-of-hooks lint rule nor the React Compiler can
  // statically prove the array never changes length.
  const upperInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const lowerInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const coreInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const fullInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const areaInteractions: Record<BodyArea, typeof upperInteraction> = {
    upper: upperInteraction,
    lower: lowerInteraction,
    core: coreInteraction,
    full: fullInteraction,
  };

  const toggleArea = (area: BodyArea) => {
    hapticSelect();
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  };

  const isValid = selectedAreas.size > 0;

  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    hapticImpactLight();
    const exercises: WorkoutLogExercise[] = Array.from(selectedAreas).map((area) => ({
      name: BODY_AREA_LABELS[area],
      bodyArea: area,
      completed: true,
    }));
    const status = getCompletionStatus(exercises);
    await saveRetroactiveWorkoutLog(selectedDateStr, exercises);
    await recordPastSessionCompletion(selectedDateStr, status !== 'skipped', energy ?? undefined, status);
    const trimmedNote = note.trim();
    if (trimmedNote) await saveSessionNote(selectedDateStr, trimmedNote);
    setSaving(false);
    hapticSuccess();
    onSaved?.();
    sheetRef.current?.dismiss();
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['85%']}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.background }}
      handleIndicatorStyle={{ backgroundColor: colors.surfaceBorder }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Log a Past Session</Text>
        <Pressable
          onPress={() => sheetRef.current?.dismiss()}
          onHoverIn={closeHover.onHoverIn}
          onHoverOut={closeHover.onHoverOut}
          hitSlop={10}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <SymbolView name="xmark" size={13} tintColor={colors.iconMuted} />
        </Pressable>
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>When</Text>
          <View style={styles.wheelCard}>
            <WheelPicker items={wheelItems} selectedIndex={dayIndex} onChange={setDayIndex} width={200} />
          </View>
          {alreadyLogged ? (
            <Text style={styles.warningText} maxFontSizeMultiplier={1.3}>
              This day already has a logged session — saving will replace it.
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>What did you train?</Text>
          <View style={styles.pillGrid}>
            {BODY_AREA_ORDER.map((area) => {
              const isSelected = selectedAreas.has(area);
              const interaction = areaInteractions[area];
              return (
                <Pressable
                  key={area}
                  style={styles.gridPillHit}
                  onPress={() => toggleArea(area)}
                  onHoverIn={interaction.hover.onHoverIn}
                  onHoverOut={interaction.hover.onHoverOut}
                  onPressIn={interaction.press.onPressIn}
                  onPressOut={interaction.press.onPressOut}
                >
                  <View style={[styles.gridPillVisual, isSelected && styles.gridPillVisualSelected]}>
                    <Text
                      style={[styles.gridPillText, isSelected && styles.gridPillTextSelected]}
                      maxFontSizeMultiplier={1.2}
                    >
                      {BODY_AREA_LABELS[area]}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Energy that day (optional)</Text>
          <View style={styles.energyRow}>
            {ENERGY_SCORES.map((score) => {
              const isSelected = energy === score;
              return (
                <Pressable
                  key={score}
                  style={styles.energyPillHit}
                  onPress={() => {
                    hapticSelect();
                    setEnergy((prev) => (prev === score ? null : score));
                  }}
                  hitSlop={2}
                >
                  <View style={[styles.energyPillVisual, isSelected && styles.energyPillVisualSelected]}>
                    <Text
                      style={[styles.energyPillText, isSelected && styles.energyPillTextSelected]}
                      maxFontSizeMultiplier={1.2}
                    >
                      {score}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {energy !== null ? (
            <Text style={styles.energyReadout} maxFontSizeMultiplier={1.3}>{ENERGY_LABELS[energy]}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Anything worth remembering?"
            placeholderTextColor={colors.textTertiary}
            multiline
            maxFontSizeMultiplier={1.3}
          />
        </View>

        <Pressable
          onPress={handleSave}
          onHoverIn={saveHover.onHoverIn}
          onHoverOut={saveHover.onHoverOut}
          onPressIn={savePress.onPressIn}
          onPressOut={savePress.onPressOut}
          disabled={!isValid || saving}
        >
          <View style={[styles.saveButton, (!isValid || saving) && styles.saveButtonDisabled]}>
            <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.15}>
              {alreadyLogged ? 'Replace Logged Session' : 'Save Session'}
            </Text>
          </View>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
LogPastSessionSheet.displayName = 'LogPastSessionSheet';

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
      fontSize: 16,
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
      paddingBottom: 40,
      gap: 24,
    },
    section: {
      gap: 10,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
    },
    wheelCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingVertical: 8,
      alignItems: 'center',
    },
    warningText: {
      color: '#E8823C',
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Geist-Medium',
    },
    pillGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    gridPillHit: {
      width: '47%',
      height: 44,
    },
    gridPillVisual: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
      backgroundColor: colors.pillBg,
    },
    gridPillVisualSelected: {
      borderColor: '#438C63',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    gridPillText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    gridPillTextSelected: {
      color: '#5FBE84',
    },
    energyRow: {
      flexDirection: 'row',
      gap: 8,
    },
    energyPillHit: {
      flex: 1,
      height: 40,
    },
    energyPillVisual: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
      backgroundColor: colors.pillBg,
    },
    energyPillVisualSelected: {
      borderColor: '#438C63',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    energyPillText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
    energyPillTextSelected: {
      color: '#5FBE84',
    },
    energyReadout: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: 'Geist-Medium',
    },
    noteInput: {
      minHeight: 80,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 12,
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-Regular',
      textAlignVertical: 'top',
    },
    saveButton: {
      marginTop: 8,
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: '#438C63',
      alignItems: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.4,
    },
    saveButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
