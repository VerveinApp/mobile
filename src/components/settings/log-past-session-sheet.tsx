import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';

import { ENERGY_LABELS, type EnergyScore } from '@/components/home/energy-gauge';
import { HorizontalRuler } from '@/components/onboarding/horizontal-ruler';
import { Type } from '@/constants/theme';
import { BODY_AREA_LABELS, BODY_AREA_ORDER } from '@/lib/body-area-labels';
import { useHoverFade, useLiquidPress, PRESSED_DIM } from '@/lib/button-interactions';
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
const ENERGY_SCORES: EnergyScore[] = [1, 2, 3, 4, 5];
const SORENESS_LABELS: Record<EnergyScore, string> = {
  1: 'None',
  2: 'Mild',
  3: 'Moderate',
  4: 'Sore',
  5: 'Very Sore',
};

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
  const insets = useSafeAreaInsets();

  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [dayIndex, setDayIndex] = useState(0); // index into WHEEL_DAY_OFFSETS — 0 = yesterday
  const [selectedAreas, setSelectedAreas] = useState<Set<BodyArea>>(new Set());
  const [energy, setEnergy] = useState<EnergyScore | null>(null);
  const [soreness, setSoreness] = useState<EnergyScore | null>(null);
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
    setSoreness(null);
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

  // Body area is the common case, but not required — a rest day worth
  // remembering (an energy score, or just a note) is honest information
  // about a past day too. getCompletionStatus already reads a zero-area
  // selection as 'skipped' rather than fabricating a session, so widening
  // this to accept energy/note-only doesn't change what gets recorded, just
  // stops blocking someone who has nothing to say about training that day.
  const isValid = selectedAreas.size > 0 || energy !== null || note.trim().length > 0;

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
    await recordPastSessionCompletion(selectedDateStr, status !== 'skipped', energy ?? undefined, status, soreness ?? undefined);
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
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 } : { backgroundColor: colors.background }}
      handleIndicatorStyle={{ backgroundColor: Platform.OS === 'android' ? 'rgba(95,190,132,0.5)' : colors.surfaceBorder, width: Platform.OS === 'android' ? 36 : undefined }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Log a Past Session</Text>
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
        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>When</Text>
          <View style={styles.wheelCard}>
            <HorizontalRuler items={wheelItems} selectedIndex={dayIndex} onChange={setDayIndex} accessibilityLabel="Day" />
          </View>
          {alreadyLogged ? (
            <Text style={styles.warningText} maxFontSizeMultiplier={1.3}>
              This day already has a logged session — saving will replace it.
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>What did you train? (optional)</Text>
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
                  style={({ pressed }) => [styles.energyPillHit, pressed && PRESSED_DIM]}
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
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Soreness that day (optional)</Text>
          <View style={styles.energyRow}>
            {ENERGY_SCORES.map((score) => {
              const isSelected = soreness === score;
              return (
                <Pressable
                  key={score}
                  style={({ pressed }) => [styles.energyPillHit, pressed && PRESSED_DIM]}
                  onPress={() => {
                    hapticSelect();
                    setSoreness((prev) => (prev === score ? null : score));
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
          {soreness !== null ? (
            <Text style={styles.energyReadout} maxFontSizeMultiplier={1.3}>{SORENESS_LABELS[soreness]}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Note (optional)</Text>
          {/* BottomSheetTextInput, not TextInput — only the sheet's own input
              registers focus with the sheet's keyboard handling. A plain
              TextInput here left the note field (and Save under it) behind
              the keyboard, since it sits at the very bottom of the sheet. */}
          <BottomSheetTextInput
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
            {/* The press glow savePress already animates — wired to the
                Pressable above but never drawn, so Save gave no visual
                response to a tap. */}
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.saveButtonGlow, { opacity: savePress.glow }]}
            />
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
      // paddingBottom set inline (40 + insets.bottom) — real safe-area
      // clearance below the home indicator.
      gap: 24,
    },
    section: {
      gap: 10,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
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
      fontSize: Type.caption,
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
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
    },
    gridPillTextSelected: {
      color: colors.accentText,
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
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-SemiBold',
    },
    energyPillTextSelected: {
      color: colors.accentText,
    },
    energyReadout: {
      color: colors.textTertiary,
      fontSize: Type.caption,
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
      fontSize: Type.body,
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
    saveButtonGlow: {
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    saveButtonDisabled: {
      opacity: 0.4,
    },
    saveButtonText: {
      color: '#ffffff',
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
