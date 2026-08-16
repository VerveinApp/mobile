import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { WheelPicker } from '@/components/onboarding/wheel-picker';
import { useAppColors } from '@/lib/theme-context';
import { getUnitSystem, setUnitSystem, type UnitSystem } from '@/lib/unit-preference';
import { getProfile, updateProfile, withHealthConsent } from '@/lib/user-profile';

type SexId = 'female' | 'male';

const SEX_OPTIONS: { id: SexId; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
];

const UNIT_OPTIONS: { id: UnitSystem; label: string }[] = [
  { id: 'imperial', label: 'ft / lb' },
  { id: 'metric', label: 'cm / kg' },
];

// Same conversion math as onboarding/step-5.tsx's biometrics fields —
// duplicated rather than shared so this sheet stays independent of an
// already-shipped onboarding flow.
const FEET_ITEMS = Array.from({ length: 5 }, (_, i) => `${i + 3} ft`);
const INCHES_ITEMS = Array.from({ length: 12 }, (_, i) => `${i} in`);
const WEIGHT_LB_ITEMS = Array.from({ length: 281 }, (_, i) => `${i + 80} lb`);
const HEIGHT_CM_ITEMS = Array.from({ length: 101 }, (_, i) => `${i + 120} cm`);
const WEIGHT_KG_ITEMS = Array.from({ length: 146 }, (_, i) => `${i + 35} kg`);

const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_WEIGHT_KG = 73;

function cmToFeetInches(cm: number): { feetIndex: number; inchesIndex: number } {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.min(7, Math.max(3, Math.floor(totalInches / 12)));
  const inches = Math.min(11, Math.max(0, totalInches - feet * 12));
  return { feetIndex: feet - 3, inchesIndex: inches };
}

function feetInchesToCm(feetIndex: number, inchesIndex: number): number {
  return Math.round((feetIndex + 3) * 30.48 + inchesIndex * 2.54);
}

function kgToLbIndex(kg: number): number {
  return Math.min(WEIGHT_LB_ITEMS.length - 1, Math.max(0, Math.round(kg / 0.453592) - 80));
}

function lbToKg(lbIndex: number): number {
  return Math.round((lbIndex + 80) * 0.453592);
}

function cmToCmIndex(cm: number): number {
  return Math.min(HEIGHT_CM_ITEMS.length - 1, Math.max(0, cm - 120));
}

function kgToKgIndex(kg: number): number {
  return Math.min(WEIGHT_KG_ITEMS.length - 1, Math.max(0, kg - 35));
}

/**
 * Editable sex/height/weight — the only real biometric fields this app
 * collects (no age/birthdate anywhere in onboarding, so none shown here).
 * Doubles as the fill-in path for anyone who skipped the onboarding
 * health-consent gate: saving from here sets healthConsent true, same as
 * checking that box would have.
 *
 * Presented as a bottom sheet (not a pushed route) from Settings — see
 * AdjustPlanSheet's doc comment for why data loads on `onChange` here
 * instead of a route-focus effect.
 */
export const BiometricsSheet = forwardRef<BottomSheetModal>((_props, forwardedRef) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(forwardedRef, () => sheetRef.current as BottomSheetModal, []);

  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sex, setSex] = useState<SexId | null>(null);
  const [unit, setUnit] = useState<UnitSystem>('imperial');
  const [heightCmValue, setHeightCmValue] = useState(DEFAULT_HEIGHT_CM);
  const [weightKgValue, setWeightKgValue] = useState(DEFAULT_WEIGHT_KG);
  const [hadConsent, setHadConsent] = useState(false);

  const loadFromProfile = useCallback(async () => {
    const [profile, globalUnit] = await Promise.all([getProfile(), getUnitSystem()]);
    if (profile?.sex === 'male' || profile?.sex === 'female') setSex(profile.sex);
    if (profile?.heightCm) setHeightCmValue(Number(profile.heightCm) || DEFAULT_HEIGHT_CM);
    if (profile?.weightKg) setWeightKgValue(Number(profile.weightKg) || DEFAULT_WEIGHT_KG);
    setHadConsent(profile?.healthConsent === 'true');
    setUnit(globalUnit);
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
  const femaleInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const maleInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const sexInteractions: Record<SexId, typeof femaleInteraction> = {
    female: femaleInteraction,
    male: maleInteraction,
  };
  const imperialInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const metricInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const unitInteractions: Record<UnitSystem, typeof imperialInteraction> = {
    imperial: imperialInteraction,
    metric: metricInteraction,
  };

  const handleSelectUnit = (id: UnitSystem) => {
    if (id === unit) return;
    hapticSelect();
    setUnit(id);
    setUnitSystem(id);
  };

  const handleSave = async () => {
    hapticImpactLight();
    await updateProfile({
      ...withHealthConsent('true'),
      sex: sex ?? '',
      heightCm: String(heightCmValue),
      weightKg: String(weightKgValue),
    });
    sheetRef.current?.dismiss();
  };

  const { feetIndex, inchesIndex } = cmToFeetInches(heightCmValue);
  const lbIndex = kgToLbIndex(weightKgValue);
  const cmIndex = cmToCmIndex(heightCmValue);
  const kgIndex = kgToKgIndex(weightKgValue);

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
        <Text style={styles.headerTitle}>Body & Biometrics</Text>
        <Pressable
          onPress={() => sheetRef.current?.dismiss()}
          onHoverIn={closeHover.onHoverIn}
          onHoverOut={closeHover.onHoverOut}
          hitSlop={10}
          style={styles.closeButton}
        >
          <SymbolView name="xmark" size={13} tintColor={colors.iconMuted} />
        </Pressable>
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!hadConsent ? (
          <Text style={styles.hint}>
            You skipped sharing this during onboarding. Add it anytime — used only to tailor your training load.
          </Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Sex at birth</Text>
          <View style={styles.pillRow}>
            {SEX_OPTIONS.map((option) => {
              const isSelected = sex === option.id;
              const interaction = sexInteractions[option.id];
              return (
                <Pressable
                  key={option.id}
                  style={styles.sexPillHit}
                  onPress={() => {
                    hapticSelect();
                    setSex(option.id);
                  }}
                  onHoverIn={interaction.hover.onHoverIn}
                  onHoverOut={interaction.hover.onHoverOut}
                  onPressIn={interaction.press.onPressIn}
                  onPressOut={interaction.press.onPressOut}
                >
                  <View style={[styles.sexPillVisual, isSelected && styles.sexPillVisualSelected]}>
                    <Text style={[styles.sexPillText, isSelected && styles.sexPillTextSelected]}>{option.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Units</Text>
          <View style={styles.unitPillRow}>
            {UNIT_OPTIONS.map((option) => {
              const isSelected = unit === option.id;
              const interaction = unitInteractions[option.id];
              return (
                <Pressable
                  key={option.id}
                  style={styles.unitPillHit}
                  onPress={() => handleSelectUnit(option.id)}
                  onHoverIn={interaction.hover.onHoverIn}
                  onHoverOut={interaction.hover.onHoverOut}
                  onPressIn={interaction.press.onPressIn}
                  onPressOut={interaction.press.onPressOut}
                >
                  <View style={[styles.unitPillVisual, isSelected && styles.unitPillVisualSelected]}>
                    <Text style={[styles.unitPillText, isSelected && styles.unitPillTextSelected]}>{option.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Height</Text>
          <View style={styles.wheelCard}>
            {unit === 'imperial' ? (
              <View style={styles.wheelRow}>
                <WheelPicker
                  items={FEET_ITEMS}
                  selectedIndex={feetIndex}
                  onChange={(index) => setHeightCmValue(feetInchesToCm(index, inchesIndex))}
                  width={76}
                />
                <WheelPicker
                  items={INCHES_ITEMS}
                  selectedIndex={inchesIndex}
                  onChange={(index) => setHeightCmValue(feetInchesToCm(feetIndex, index))}
                  width={76}
                />
              </View>
            ) : (
              <View style={styles.wheelRow}>
                <WheelPicker
                  items={HEIGHT_CM_ITEMS}
                  selectedIndex={cmIndex}
                  onChange={(index) => setHeightCmValue(index + 120)}
                  width={163}
                />
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Weight</Text>
          <View style={styles.wheelCard}>
            <View style={styles.wheelRow}>
              {unit === 'imperial' ? (
                <WheelPicker
                  items={WEIGHT_LB_ITEMS}
                  selectedIndex={lbIndex}
                  onChange={(index) => setWeightKgValue(lbToKg(index))}
                  width={110}
                />
              ) : (
                <WheelPicker
                  items={WEIGHT_KG_ITEMS}
                  selectedIndex={kgIndex}
                  onChange={(index) => setWeightKgValue(index + 35)}
                  width={110}
                />
              )}
            </View>
          </View>
        </View>

        <Pressable
          onPress={handleSave}
          onHoverIn={saveHover.onHoverIn}
          onHoverOut={saveHover.onHoverOut}
          onPressIn={savePress.onPressIn}
          onPressOut={savePress.onPressOut}
        >
          <View style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save</Text>
          </View>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
BiometricsSheet.displayName = 'BiometricsSheet';

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
    hint: {
      color: colors.textTertiary,
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: 'Geist-Medium',
    },
    section: {
      gap: 10,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
    },
    pillRow: {
      flexDirection: 'row',
      gap: 10,
    },
    sexPillHit: {
      flex: 1,
      height: 44,
    },
    sexPillVisual: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
      backgroundColor: colors.pillBg,
    },
    sexPillVisualSelected: {
      borderColor: '#438C63',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    sexPillText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    sexPillTextSelected: {
      color: '#5FBE84',
    },
    unitPillRow: {
      flexDirection: 'row',
      gap: 8,
      width: 180,
    },
    unitPillHit: {
      flex: 1,
      height: 30,
    },
    unitPillVisual: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
      backgroundColor: colors.pillBg,
    },
    unitPillVisualSelected: {
      borderColor: '#438C63',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    unitPillText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: 'Geist-SemiBold',
    },
    unitPillTextSelected: {
      color: '#5FBE84',
    },
    wheelCard: {
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
    saveButton: {
      marginTop: 8,
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: '#438C63',
      alignItems: 'center',
    },
    saveButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
