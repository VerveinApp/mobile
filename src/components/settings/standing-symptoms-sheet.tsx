import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';

import { Type } from '@/constants/theme';
import { useHoverFade, useLiquidPress, PRESSED_DIM } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import {
  isStandingSymptomTag,
  STANDING_SYMPTOM_EFFECTS,
  STANDING_SYMPTOM_TAGS,
  SYMPTOM_TAG_LABELS,
  type StandingSymptomTag,
} from '@/lib/symptom-tags';
import { useAppColors } from '@/lib/theme-context';
import { getProfile, updateProfile } from '@/lib/user-profile';

/**
 * The vault's standing symptom tags (Symptom Tags.md — "set once, active
 * every day until changed"), as a Settings sheet rather than an onboarding
 * screen, same reasoning as MovementRestrictionsSheet: optional, editable
 * anytime, and not worth lengthening signup for. Saving changes real
 * exercise selection — see symptom-tags.ts's STANDING_SYMPTOM_TAGS for what
 * each one does and why they can only make a plan gentler. Free, not Plus:
 * this is the one way to tell the engine about a body that shouldn't jump.
 *
 * No "None of these" row, unlike Movement: nothing reads the difference
 * between never answered and answered none, so unticking everything is the
 * whole answer.
 */
export const StandingSymptomsSheet = forwardRef<BottomSheetModal>((_props, forwardedRef) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(forwardedRef, () => sheetRef.current as BottomSheetModal, []);
  const insets = useSafeAreaInsets();

  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selected, setSelected] = useState<Set<StandingSymptomTag>>(new Set());
  const [saving, setSaving] = useState(false);

  const loadFromProfile = useCallback(async () => {
    const profile = await getProfile();
    setSelected(new Set((profile?.standingSymptoms ?? []).filter(isStandingSymptomTag)));
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

  const toggleSymptom = (tag: StandingSymptomTag) => {
    hapticSelect();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleSave = async () => {
    if (saving) return;
    hapticImpactLight();
    setSaving(true);
    // Stored in the list's own order, not tap order, so the same answer
    // always saves as the same value.
    await updateProfile({ standingSymptoms: STANDING_SYMPTOM_TAGS.filter((tag) => selected.has(tag)) });
    setSaving(false);
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
      snapPoints={['70%']}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 } : { backgroundColor: colors.background }}
      handleIndicatorStyle={{ backgroundColor: Platform.OS === 'android' ? 'rgba(95,190,132,0.5)' : colors.surfaceBorder, width: Platform.OS === 'android' ? 36 : undefined }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Ongoing Symptoms</Text>
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
        <Text style={styles.headline} maxFontSizeMultiplier={1.3}>Anything that affects you most days?</Text>
        <Text style={styles.hint} maxFontSizeMultiplier={1.4}>
          Every session is built around these, whatever your energy. They only ever make a plan easier.
        </Text>

        <View style={styles.list}>
          {STANDING_SYMPTOM_TAGS.map((tag, index) => {
            const isSelected = selected.has(tag);
            const isLast = index === STANDING_SYMPTOM_TAGS.length - 1;
            return (
              <Pressable
                key={tag}
                style={({ pressed }) => [styles.row, isLast && styles.rowLast, pressed && PRESSED_DIM]}
                onPress={() => toggleSymptom(tag)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${SYMPTOM_TAG_LABELS[tag]}. ${STANDING_SYMPTOM_EFFECTS[tag]}`}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>{SYMPTOM_TAG_LABELS[tag]}</Text>
                  <Text style={styles.rowEffect} maxFontSizeMultiplier={1.3}>{STANDING_SYMPTOM_EFFECTS[tag]}</Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                  {isSelected ? <SymbolView name="checkmark" size={11} tintColor="#ffffff" weight="bold" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.footnote} maxFontSizeMultiplier={1.4}>
          Just a bad day? Pick Empty or Low at check-in to tag what&apos;s going on today instead.
        </Text>

        <Pressable
          onPress={handleSave}
          onHoverIn={saveHover.onHoverIn}
          onHoverOut={saveHover.onHoverOut}
          onPressIn={savePress.onPressIn}
          onPressOut={savePress.onPressOut}
          disabled={saving}
        >
          <View style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.saveButtonGlow, { opacity: savePress.glow }]}
            />
            <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.15}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </View>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
StandingSymptomsSheet.displayName = 'StandingSymptomsSheet';

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
      gap: 16,
    },
    headline: {
      color: colors.text,
      fontSize: 17,
      lineHeight: 23,
      fontFamily: 'Geist-Bold',
    },
    hint: {
      marginTop: -8,
      color: colors.textTertiary,
      fontSize: Type.secondary,
      lineHeight: 18,
      fontFamily: 'Geist-Medium',
    },
    list: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowText: {
      flex: 1,
      gap: 2,
      paddingRight: 12,
    },
    rowLabel: {
      color: colors.text,
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    rowEffect: {
      color: colors.textTertiary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Medium',
    },
    footnote: {
      marginTop: -4,
      color: colors.textTertiary,
      fontSize: Type.secondary,
      lineHeight: 18,
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
