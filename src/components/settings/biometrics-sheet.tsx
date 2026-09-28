import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';

import { Type } from '@/constants/theme';
import { useHoverFade, useLiquidPress, PRESSED_DIM } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSelect, hapticWarning } from '@/lib/haptics';
import {
  HorizontalRuler,
  RULER_HEIGHT,
  RULER_TICK_HEIGHT,
  RULER_TICK_SPACING,
} from '@/components/onboarding/horizontal-ruler';
import { useAppColors } from '@/lib/theme-context';
import { usePreloadedSheet } from '@/components/settings/use-preloaded-sheet';
import { getUnitSystem, setUnitSystem, type UnitSystem } from '@/lib/unit-preference';
import { getProfile, updateProfile, withHealthConsent, withdrawHealthConsent } from '@/lib/user-profile';

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
// BUG FIX (found in a later full-app audit): these used to read `"161 lb"`
// and (below) `".0"` — two big, equally-weighted ruler labels sitting side
// by side, which reads as two disconnected values ("161 lb" then a stray
// ".0") rather than one number. Feet+inches legitimately are two separate
// values (5′ 11″), which is why that pair keeps its own per-item units —
// weight's whole/decimal split is one number artificially cut in half.
// Plain digits here; the "." lives once, between the two rulers (see
// weightWhole/weightSeparator below), and the unit shows once, after.
const WEIGHT_LB_ITEMS = Array.from({ length: 281 }, (_, i) => `${i + 80}`);
const HEIGHT_CM_ITEMS = Array.from({ length: 101 }, (_, i) => `${i + 120} cm`);
const WEIGHT_KG_ITEMS = Array.from({ length: 146 }, (_, i) => `${i + 35}`);
// BUG FIX (found by the user): this weight wheel only ever offered whole
// lb/kg — the only precision this sheet's own profile.weightKg field ever
// got, unlike weight-history.tsx's log entries, which have supported tenths
// for a while. Same second, narrow decimal wheel that screen already uses.
const DECIMAL_ITEMS = Array.from({ length: 10 }, (_, i) => `${i}`);
// 13-95 — collected only to make calorie-estimate.ts's Mifflin-St Jeor
// maintenance-calorie estimate possible (see user-profile.ts's age field
// doc comment); no other part of this app reads it.
const AGE_ITEMS = Array.from({ length: 83 }, (_, i) => `${i + 13}`);

const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_WEIGHT_KG = 73;
const DEFAULT_AGE = 30;

function cmToFeetInches(cm: number): { feetIndex: number; inchesIndex: number } {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.min(7, Math.max(3, Math.floor(totalInches / 12)));
  const inches = Math.min(11, Math.max(0, totalInches - feet * 12));
  return { feetIndex: feet - 3, inchesIndex: inches };
}

function feetInchesToCm(feetIndex: number, inchesIndex: number): number {
  return Math.round((feetIndex + 3) * 30.48 + inchesIndex * 2.54);
}

// Same precision-safe whole/decimal split as weight-history.tsx's own
// helpers (identical math, duplicated rather than shared for this sheet's
// own independence — see this file's own header comment) — see that
// screen's kgToLbWholeIndex's own comment for why the intermediate
// Math.round(...*1000)/1000 step matters (plain float division can land a
// hair off the true value, which floor/modulo below are sensitive to in a
// way Math.round alone isn't).
function kgToLbWholeIndex(kg: number): number {
  const lb = Math.round((kg / 0.453592) * 1000) / 1000;
  return Math.min(WEIGHT_LB_ITEMS.length - 1, Math.max(0, Math.floor(lb) - 80));
}

function kgToLbDecimalIndex(kg: number): number {
  const lb = Math.round((kg / 0.453592) * 1000) / 1000;
  return Math.round((lb % 1) * 10) % 10;
}

function lbPartsToKg(lbWholeIndex: number, decimalIndex: number): number {
  return (lbWholeIndex + 80 + decimalIndex / 10) * 0.453592;
}

function cmToCmIndex(cm: number): number {
  return Math.min(HEIGHT_CM_ITEMS.length - 1, Math.max(0, cm - 120));
}

function kgToKgWholeIndex(kg: number): number {
  return Math.min(WEIGHT_KG_ITEMS.length - 1, Math.max(0, Math.floor(kg) - 35));
}

function kgToKgDecimalIndex(kg: number): number {
  return Math.round((kg % 1) * 10) % 10;
}

function kgPartsToKg(kgWholeIndex: number, decimalIndex: number): number {
  return kgWholeIndex + 35 + decimalIndex / 10;
}

function ageToIndex(age: number): number {
  return Math.min(AGE_ITEMS.length - 1, Math.max(0, age - 13));
}

/**
 * Editable sex/height/weight/age — the real biometric fields this app
 * collects. Doubles as the fill-in path for anyone who skipped the
 * onboarding health-consent gate: saving from here sets healthConsent true,
 * same as checking that box would have.
 *
 * Presented as a bottom sheet (not a pushed route) from Settings — see
 * AdjustPlanSheet's doc comment for why data loads on present here instead
 * of a route-focus effect.
 */
export const BiometricsSheet = forwardRef<BottomSheetModal>((_props, forwardedRef) => {
  const sheetRef = useRef<BottomSheetModal>(null);

  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sex, setSex] = useState<SexId | null>(null);
  const [unit, setUnit] = useState<UnitSystem>('imperial');
  const [heightCmValue, setHeightCmValue] = useState(DEFAULT_HEIGHT_CM);
  const [weightKgValue, setWeightKgValue] = useState(DEFAULT_WEIGHT_KG);
  const [ageValue, setAgeValue] = useState(DEFAULT_AGE);
  const [hadConsent, setHadConsent] = useState(false);
  // BUG FIX (found in a later full-app audit): heightCmValue/weightKgValue/
  // ageValue all default to a hardcoded placeholder so the wheels have
  // something to show before a real profile loads — but handleSave used to
  // write that placeholder unconditionally, every time. Someone who opened
  // this sheet only to update, say, their weight, and never touched Height
  // or Age (because they don't have one on file yet), would silently get
  // heightCm:"170"/age:"30" written as if they'd actually told the app
  // that — a fabricated value confidently feeding real math elsewhere
  // (plan-preview's real duration/volume calcs for height in principle, and
  // calorie-estimate.ts's Mifflin-St Jeor formula for age) with nothing
  // marking it as a guess. These three track whether each field actually
  // has a real value (loaded from the profile, or genuinely edited this
  // session) — handleSave below only writes a field when one of those is
  // true, same "optional, never assumed" contract sex already had via its
  // own `sex ?? ''` (never silently promoted from null to a fake selection).
  const [hasRealHeight, setHasRealHeight] = useState(false);
  const [hasRealWeight, setHasRealWeight] = useState(false);
  const [hasRealAge, setHasRealAge] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFromProfile = useCallback(async () => {
    const [profile, globalUnit] = await Promise.all([getProfile(), getUnitSystem()]);
    if (profile?.sex === 'male' || profile?.sex === 'female') setSex(profile.sex);
    if (profile?.heightCm) {
      setHeightCmValue(Number(profile.heightCm) || DEFAULT_HEIGHT_CM);
      setHasRealHeight(true);
    } else {
      setHasRealHeight(false);
    }
    if (profile?.weightKg) {
      setWeightKgValue(Number(profile.weightKg) || DEFAULT_WEIGHT_KG);
      setHasRealWeight(true);
    } else {
      setHasRealWeight(false);
    }
    if (profile?.age) {
      setAgeValue(Number(profile.age) || DEFAULT_AGE);
      setHasRealAge(true);
    } else {
      setHasRealAge(false);
    }
    setHadConsent(profile?.healthConsent === 'true');
    setUnit(globalUnit);
  }, []);

  const openSheet = useCallback(async () => {
    setConfirmingWithdraw(false);
    await loadFromProfile();
  }, [loadFromProfile]);
  usePreloadedSheet(forwardedRef, sheetRef, openSheet);

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

  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  const handleWithdrawConsent = async () => {
    if (!confirmingWithdraw) {
      hapticWarning();
      setConfirmingWithdraw(true);
      return;
    }
    setSaving(true);
    await withdrawHealthConsent();
    setSaving(false);
    setConfirmingWithdraw(false);
    hapticImpactLight();
    sheetRef.current?.dismiss();
  };

  const handleSave = async () => {
    if (saving) return;
    hapticImpactLight();
    setSaving(true);
    await updateProfile({
      ...withHealthConsent('true'),
      sex: sex ?? '',
      ...(hasRealHeight ? { heightCm: String(heightCmValue) } : null),
      ...(hasRealWeight ? { weightKg: String(weightKgValue) } : null),
      ...(hasRealAge ? { age: String(ageValue) } : null),
    });
    setSaving(false);
    sheetRef.current?.dismiss();
  };

  const { feetIndex, inchesIndex } = cmToFeetInches(heightCmValue);
  const lbWholeIndex = kgToLbWholeIndex(weightKgValue);
  const lbDecimalIndex = kgToLbDecimalIndex(weightKgValue);
  const cmIndex = cmToCmIndex(heightCmValue);
  const kgWholeIndex = kgToKgWholeIndex(weightKgValue);
  const kgDecimalIndex = kgToKgDecimalIndex(weightKgValue);
  const ageIndex = ageToIndex(ageValue);

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
      backdropComponent={renderBackdrop}
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 } : { backgroundColor: colors.background }}
      handleIndicatorStyle={{ backgroundColor: Platform.OS === 'android' ? 'rgba(95,190,132,0.5)' : colors.surfaceBorder, width: Platform.OS === 'android' ? 36 : undefined }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Body & Biometrics</Text>
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
        {!hadConsent ? (
          <Text style={styles.hint} maxFontSizeMultiplier={1.4}>
            You skipped sharing this during onboarding. Add it anytime — used only to tailor your training load.
          </Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Sex at birth</Text>
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
                    <Text
                      style={[styles.sexPillText, isSelected && styles.sexPillTextSelected]}
                      maxFontSizeMultiplier={1.2}
                    >
                      {option.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Units</Text>
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
                    <Text
                      style={[styles.unitPillText, isSelected && styles.unitPillTextSelected]}
                      maxFontSizeMultiplier={1.2}
                    >
                      {option.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Height</Text>
          <View style={styles.wheelCard}>
            {unit === 'imperial' ? (
              <View style={styles.wheelRow}>
                <HorizontalRuler
                  items={FEET_ITEMS}
                  accessibilityLabel="Height, feet"
                  selectedIndex={feetIndex}
                  onChange={(index) => {
                    setHeightCmValue(feetInchesToCm(index, inchesIndex));
                    setHasRealHeight(true);
                  }}
                />
                <HorizontalRuler
                  items={INCHES_ITEMS}
                  accessibilityLabel="Height, inches"
                  selectedIndex={inchesIndex}
                  onChange={(index) => {
                    setHeightCmValue(feetInchesToCm(feetIndex, index));
                    setHasRealHeight(true);
                  }}
                />
              </View>
            ) : (
              <View style={styles.wheelRow}>
                <HorizontalRuler
                  items={HEIGHT_CM_ITEMS}
                  accessibilityLabel="Height"
                  selectedIndex={cmIndex}
                  onChange={(index) => {
                    setHeightCmValue(index + 120);
                    setHasRealHeight(true);
                  }}
                />
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Weight</Text>
          <View style={styles.wheelCard}>
            <View style={styles.wheelRow}>
              {unit === 'imperial' ? (
                <>
                  <HorizontalRuler
                    width={RULER_TICK_SPACING * 4}
                    items={WEIGHT_LB_ITEMS}
                    accessibilityLabel="Weight, pounds"
                    selectedIndex={lbWholeIndex}
                    onChange={(index) => {
                      setWeightKgValue(lbPartsToKg(index, lbDecimalIndex));
                      setHasRealWeight(true);
                    }}
                  />
                  <View style={styles.weightGlue}>
                    <Text style={styles.weightSeparator}>.</Text>
                  </View>
                  <HorizontalRuler
                    width={RULER_TICK_SPACING * 2}
                    items={DECIMAL_ITEMS}
                    accessibilityLabel="Weight, tenths of a pound"
                    selectedIndex={lbDecimalIndex}
                    onChange={(index) => {
                      setWeightKgValue(lbPartsToKg(lbWholeIndex, index));
                      setHasRealWeight(true);
                    }}
                  />
                  <View style={styles.weightGlue}>
                    <Text style={styles.weightUnit}>lb</Text>
                  </View>
                </>
              ) : (
                <>
                  <HorizontalRuler
                    width={RULER_TICK_SPACING * 4}
                    items={WEIGHT_KG_ITEMS}
                    accessibilityLabel="Weight, kilograms"
                    selectedIndex={kgWholeIndex}
                    onChange={(index) => {
                      setWeightKgValue(kgPartsToKg(index, kgDecimalIndex));
                      setHasRealWeight(true);
                    }}
                  />
                  <View style={styles.weightGlue}>
                    <Text style={styles.weightSeparator}>.</Text>
                  </View>
                  <HorizontalRuler
                    width={RULER_TICK_SPACING * 2}
                    items={DECIMAL_ITEMS}
                    accessibilityLabel="Weight, tenths of a kilogram"
                    selectedIndex={kgDecimalIndex}
                    onChange={(index) => {
                      setWeightKgValue(kgPartsToKg(kgWholeIndex, index));
                      setHasRealWeight(true);
                    }}
                  />
                  <View style={styles.weightGlue}>
                    <Text style={styles.weightUnit}>kg</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Age</Text>
          <View style={styles.wheelCard}>
            <View style={styles.wheelRow}>
              <HorizontalRuler
                items={AGE_ITEMS}
                accessibilityLabel="Age"
                selectedIndex={ageIndex}
                onChange={(index) => {
                  setAgeValue(index + 13);
                  setHasRealAge(true);
                }}
              />
            </View>
          </View>
        </View>

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

        {/* Withdrawing consent — promised by the Privacy Policy, and until
            now impossible short of deleting everything. Two taps, not a
            modal-in-a-sheet: the first explains what happens, the second
            does it. */}
        {hadConsent ? (
          <Pressable
            style={({ pressed }) => [styles.withdrawHit, pressed && PRESSED_DIM]}
            onPress={handleWithdrawConsent}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={
              confirmingWithdraw ? 'Confirm: stop sharing and clear health info' : 'Stop sharing health info'
            }
          >
            <Text style={styles.withdrawText} maxFontSizeMultiplier={1.3}>
              {confirmingWithdraw ? 'Tap again to stop sharing and clear it' : 'Stop sharing health info'}
            </Text>
            {confirmingWithdraw ? (
              <Text style={styles.withdrawHint} maxFontSizeMultiplier={1.3}>
                Clears your sex, height, weight, age, conditions, and movement restrictions here and from your
                account. Logs on this device stay until you use Delete My Data.
              </Text>
            ) : null}
          </Pressable>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
BiometricsSheet.displayName = 'BiometricsSheet';

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    withdrawHit: {
      marginTop: 18,
      alignItems: 'center',
      paddingVertical: 8,
    },
    withdrawText: {
      color: '#E5484D',
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    withdrawHint: {
      marginTop: 6,
      color: colors.textTertiary,
      fontSize: Type.caption,
      lineHeight: 15,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
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
      // clearance for the Save button below the home indicator.
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
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
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
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
    },
    sexPillTextSelected: {
      color: colors.accentText,
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
      fontSize: Type.caption,
      fontFamily: 'Geist-SemiBold',
    },
    unitPillTextSelected: {
      color: colors.accentText,
    },
    wheelCard: {
      // BUG FIX (found by the user, screenshotted with the empty region
      // circled): `section`'s own flex column has no alignItems, so its
      // default `stretch` forced this card to the section's full width —
      // `alignItems: 'flex-start'` below only ever controlled how the
      // wheelRow sat WITHIN that already-full-width card, not the card's
      // own width, so it left a large empty region wherever the wheels
      // themselves were narrower than the sheet (every case except the
      // metric height wheel, the one row that happens to be wide enough to
      // fill it). alignSelf overrides the inherited stretch so the card
      // shrinks to fit its actual content instead.
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
    // Bottom-anchored to RULER_TICK_HEIGHT, same as HorizontalRuler's own
    // tickLabel sits above its tick marks — without this, a plain Text
    // dropped into wheelRow's row stretches to the row's full height and
    // top-aligns by RN's own default, landing well above the ruler's actual
    // big number instead of next to it. Negative margins pull it in past
    // wheelRow's own gap:10 (shared with the Height row, where that gap is
    // correct — feet and inches ARE two separate values) so the "." and
    // unit read as touching the numbers on either side, not floating
    // between them.
    weightGlue: {
      height: RULER_HEIGHT,
      justifyContent: 'flex-end',
      paddingBottom: RULER_TICK_HEIGHT,
      marginHorizontal: -6,
    },
    weightSeparator: {
      color: colors.text,
      fontSize: Type.stat,
      fontFamily: 'Geist-SemiBold',
    },
    weightUnit: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Medium',
      marginLeft: 2,
      marginBottom: 2,
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
