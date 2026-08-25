import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { CommitmentDial } from '@/components/onboarding/commitment-dial';
import { COMMITMENT_LEVELS } from '@/lib/commitment-levels';
import { DURATION_LABELS, ENVIRONMENT_LABELS, EXPERIENCE_LABELS, GOAL_LABELS } from '@/lib/profile-labels';
import { enableSessionReminders, isReminderEnabled } from '@/lib/session-reminders';
import { useAppColors } from '@/lib/theme-context';
import { getProfile, updateProfile } from '@/lib/user-profile';

// Same option ids as onboarding/step-2 (goal), step-3 (experience),
// step-4 (equipment), step-6 (duration/days) — this sheet edits the exact
// same fields onboarding collects, just with the short profile-labels.ts
// copy instead of onboarding's persuasive long-form copy.
const GOAL_OPTIONS = ['build-physique', 'get-leaner', 'get-stronger', 'move-better'];
const EXPERIENCE_OPTIONS = ['just-starting', 'trained-before', 'train-regularly', 'years-experience'];
const ENVIRONMENT_OPTIONS = ['full-gym', 'home-gym', 'minimal-equipment', 'bodyweight-only'];
const DURATION_OPTIONS = ['under-30', '30-45', '45-60', '60-plus'];

const DAY_OPTIONS: { id: string; label: string }[] = [
  { id: 'monday', label: 'M' },
  { id: 'tuesday', label: 'T' },
  { id: 'wednesday', label: 'W' },
  { id: 'thursday', label: 'T' },
  { id: 'friday', label: 'F' },
  { id: 'saturday', label: 'S' },
  { id: 'sunday', label: 'S' },
];

/**
 * The flagship Settings feature: every input Vervein's real engine
 * (plan-preview.ts) actually reads, editable in one place. Saving here
 * changes what Profile/Summary/Progress compute on their next focus —
 * there's no separate "regenerate plan" step because those screens already
 * derive everything live from the saved profile.
 *
 * Presented as a bottom sheet (not a pushed route) from Settings — a real
 * `BottomSheetModal` stays mounted across opens, so data is (re)loaded on
 * `onChange` rather than a route-focus effect.
 */
export const AdjustPlanSheet = forwardRef<BottomSheetModal>((_props, forwardedRef) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(forwardedRef, () => sheetRef.current as BottomSheetModal, []);

  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [goal, setGoal] = useState('');
  const [experience, setExperience] = useState('');
  const [environment, setEnvironment] = useState('');
  const [duration, setDuration] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [commitmentIndex, setCommitmentIndex] = useState<number | null>(null);

  const loadFromProfile = useCallback(async () => {
    const profile = await getProfile();
    setGoal(profile?.goal ?? '');
    setExperience(profile?.experience ?? '');
    setEnvironment(profile?.environment ?? '');
    setDuration(profile?.duration ?? '');
    setDays(profile?.days ? profile.days.split(',').filter(Boolean) : []);
    const idx = profile?.commitmentLevel ? Number(profile.commitmentLevel) - 1 : null;
    setCommitmentIndex(idx !== null && idx >= 0 && idx < COMMITMENT_LEVELS.length ? idx : null);
  }, []);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index >= 0) loadFromProfile();
    },
    [loadFromProfile]
  );

  const closeHover = useHoverFade();
  const saveHover = useHoverFade();
  const savePress = useLiquidPress();

  const toggleDay = (id: string) => {
    hapticSelect();
    setDays((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const isValid = goal && experience && environment && duration && days.length > 0 && commitmentIndex !== null;

  const handleSave = async () => {
    if (!isValid) return;
    hapticImpactLight();
    await updateProfile({
      goal,
      experience,
      environment,
      duration,
      days: days.join(','),
      commitmentLevel: String((commitmentIndex as number) + 1),
    });
    // Keeps an already-enabled reminder schedule in sync with whatever days
    // just got saved here — enableSessionReminders cancels and re-schedules
    // from scratch, so this is safe to call unconditionally whenever
    // reminders are on, not just when the day selection actually changed.
    // Only ever a no-op permission re-check (already granted, so no dialog)
    // for someone who's already opted in — never turns reminders on for
    // someone who hasn't. See session-reminders.ts and Settings' own
    // Workout Reminders toggle for the opt-in path this is completing.
    if (await isReminderEnabled()) await enableSessionReminders(days);
    sheetRef.current?.dismiss();
  };

  const commitmentLevel = commitmentIndex !== null ? COMMITMENT_LEVELS[commitmentIndex] : null;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['90%']}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.background }}
      handleIndicatorStyle={{ backgroundColor: colors.surfaceBorder }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Adjust My Plan</Text>
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
        <PillGrid
          styles={styles}
          label="Goal"
          options={GOAL_OPTIONS}
          labels={GOAL_LABELS}
          value={goal}
          onSelect={(id) => {
            hapticSelect();
            setGoal(id);
          }}
        />
        <PillGrid
          styles={styles}
          label="Experience"
          options={EXPERIENCE_OPTIONS}
          labels={EXPERIENCE_LABELS}
          value={experience}
          onSelect={(id) => {
            hapticSelect();
            setExperience(id);
          }}
        />
        <PillGrid
          styles={styles}
          label="Equipment"
          options={ENVIRONMENT_OPTIONS}
          labels={ENVIRONMENT_LABELS}
          value={environment}
          onSelect={(id) => {
            hapticSelect();
            setEnvironment(id);
          }}
        />
        <PillGrid
          styles={styles}
          label="Session Length"
          options={DURATION_OPTIONS}
          labels={DURATION_LABELS}
          value={duration}
          onSelect={(id) => {
            hapticSelect();
            setDuration(id);
          }}
          columns={4}
        />

        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Training Days</Text>
          <View style={styles.dayRow}>
            {DAY_OPTIONS.map((day, index) => {
              const isSelected = days.includes(day.id);
              return (
                <Pressable
                  key={day.id + index}
                  style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}
                  onPress={() => toggleDay(day.id)}
                  hitSlop={4}
                >
                  <Text
                    style={[styles.dayCircleText, isSelected && styles.dayCircleTextSelected]}
                    maxFontSizeMultiplier={1.15}
                  >
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Commitment</Text>
          <View style={styles.dialWrap}>
            <CommitmentDial
              size={200}
              value={commitmentIndex}
              onChange={setCommitmentIndex}
              levelLabel={commitmentLevel?.name}
            />
          </View>
          {commitmentLevel ? (
            <Text style={styles.commitmentReadout} maxFontSizeMultiplier={1.2}>
              {(commitmentIndex as number) + 1} / 8 · {commitmentLevel.name}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={handleSave}
          onHoverIn={saveHover.onHoverIn}
          onHoverOut={saveHover.onHoverOut}
          onPressIn={savePress.onPressIn}
          onPressOut={savePress.onPressOut}
          disabled={!isValid}
        >
          <View style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}>
            <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.15}>Save Changes</Text>
          </View>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
AdjustPlanSheet.displayName = 'AdjustPlanSheet';

function PillGrid({
  styles,
  label,
  options,
  labels,
  value,
  onSelect,
  columns = 2,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  options: string[];
  labels: Record<string, string>;
  value: string;
  onSelect: (id: string) => void;
  columns?: 2 | 4;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      <View style={[styles.pillGrid, columns === 4 && styles.pillGridFourAcross]}>
        {options.map((id) => {
          const isSelected = value === id;
          return (
            <Pressable
              key={id}
              style={[styles.gridPillHit, columns === 4 && styles.gridPillHitFourAcross]}
              onPress={() => onSelect(id)}
            >
              <View style={[styles.gridPillVisual, isSelected && styles.gridPillVisualSelected]}>
                <Text
                  style={[styles.gridPillText, isSelected && styles.gridPillTextSelected]}
                  maxFontSizeMultiplier={1.2}
                >
                  {labels[id]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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
    pillGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    pillGridFourAcross: {
      flexWrap: 'nowrap',
    },
    gridPillHit: {
      width: '47%',
      height: 46,
    },
    gridPillHitFourAcross: {
      flex: 1,
      width: undefined,
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
      paddingHorizontal: 6,
    },
    gridPillVisualSelected: {
      borderColor: '#438C63',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    gridPillText: {
      color: colors.textSecondary,
      fontSize: 12.5,
      fontFamily: 'Geist-SemiBold',
      textAlign: 'center',
    },
    gridPillTextSelected: {
      color: '#5FBE84',
    },
    dayRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    dayCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
      backgroundColor: colors.pillBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCircleSelected: {
      borderColor: '#438C63',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    dayCircleText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    dayCircleTextSelected: {
      color: '#5FBE84',
    },
    dialWrap: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    commitmentReadout: {
      textAlign: 'center',
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
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
