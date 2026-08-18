import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { CONDITION_LABELS, CONDITIONS, type Condition } from '@/lib/conditions';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { useAppColors } from '@/lib/theme-context';
import { getProfile, updateProfile } from '@/lib/user-profile';

/**
 * Collects, never gates — see lib/conditions.ts's own doc comment for why.
 * Deliberately not part of onboarding (a medical-condition checklist mid-
 * signup reads as a bigger ask than this app can currently back up with any
 * real adaptation), so it lives here as an optional, editable-anytime
 * Settings entry instead, same shape as BiometricsSheet.
 */
export const ConditionsSheet = forwardRef<BottomSheetModal>((_props, forwardedRef) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(forwardedRef, () => sheetRef.current as BottomSheetModal, []);

  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selected, setSelected] = useState<Set<Condition>>(new Set());

  const loadFromProfile = useCallback(async () => {
    const profile = await getProfile();
    const stored = (profile?.conditions ?? []).filter((c): c is Condition => (CONDITIONS as readonly string[]).includes(c));
    setSelected(new Set(stored));
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

  const toggleCondition = (condition: Condition) => {
    hapticSelect();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(condition)) next.delete(condition);
      else next.add(condition);
      return next;
    });
  };

  const handleSave = async () => {
    hapticImpactLight();
    await updateProfile({ conditions: Array.from(selected) });
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
      snapPoints={['75%']}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.background }}
      handleIndicatorStyle={{ backgroundColor: colors.surfaceBorder }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Health Conditions</Text>
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
        <Text style={styles.hint} maxFontSizeMultiplier={1.4}>
          Optional, and not used to change your plan yet — this app doesn&apos;t have a validated way to safely adjust
          exercise selection for these conditions, so nothing here changes what you&apos;re shown. It&apos;s saved for
          your own record and to be ready if that changes.
        </Text>

        <View style={styles.list}>
          {CONDITIONS.map((condition, index) => {
            const isSelected = selected.has(condition);
            return (
              <Pressable
                key={condition}
                style={[styles.row, index < CONDITIONS.length - 1 && styles.rowDivider]}
                onPress={() => toggleCondition(condition)}
              >
                <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>{CONDITION_LABELS[condition]}</Text>
                <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                  {isSelected ? <SymbolView name="checkmark" size={11} tintColor="#ffffff" weight="bold" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={handleSave}
          onHoverIn={saveHover.onHoverIn}
          onHoverOut={saveHover.onHoverOut}
          onPressIn={savePress.onPressIn}
          onPressOut={savePress.onPressOut}
        >
          <View style={styles.saveButton}>
            <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.15}>Save</Text>
          </View>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
ConditionsSheet.displayName = 'ConditionsSheet';

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
      gap: 20,
    },
    hint: {
      color: colors.textTertiary,
      fontSize: 12.5,
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
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    rowLabel: {
      color: colors.text,
      fontSize: 13.5,
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
    saveButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
