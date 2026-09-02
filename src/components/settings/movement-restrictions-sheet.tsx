import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { MOVEMENT_RESTRICTIONS, MOVEMENT_RESTRICTION_LABELS, type MovementRestriction } from '@/lib/movement-restrictions';
import { useAppColors } from '@/lib/theme-context';
import { getProfile, updateProfile } from '@/lib/user-profile';

/**
 * The vault's real Movement Restrictions Screen, ported as a Settings sheet
 * instead of an onboarding step — same reasoning as ConditionsSheet: an
 * already-long onboarding doesn't need a new required screen for something
 * that's genuinely optional and editable anytime. Unlike ConditionsSheet,
 * saving here actually changes exercise selection (see
 * onboarding-to-engine.ts) — this is real, low-risk, self-reported
 * capability data the engine was already built to consume.
 *
 * "None of these" is its own equal-weight row, not a smaller skip-link —
 * the vault's own spec lists it as a "separate option," and it carries real
 * meaning here: selecting it distinguishes "asked, and the answer is no
 * restrictions" from `undefined` ("never asked"). The two are mutually
 * exclusive with the five specific options.
 */
export const MovementRestrictionsSheet = forwardRef<BottomSheetModal>((_props, forwardedRef) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(forwardedRef, () => sheetRef.current as BottomSheetModal, []);

  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selected, setSelected] = useState<Set<MovementRestriction>>(new Set());
  const [noneSelected, setNoneSelected] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFromProfile = useCallback(async () => {
    const profile = await getProfile();
    const stored = profile?.movementRestrictions;
    if (stored === undefined) {
      setSelected(new Set());
      setNoneSelected(false);
    } else if (stored.length === 0) {
      setSelected(new Set());
      setNoneSelected(true);
    } else {
      const valid = stored.filter((r): r is MovementRestriction =>
        (MOVEMENT_RESTRICTIONS as readonly string[]).includes(r)
      );
      setSelected(new Set(valid));
      setNoneSelected(false);
    }
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

  const toggleRestriction = (restriction: MovementRestriction) => {
    hapticSelect();
    setNoneSelected(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(restriction)) next.delete(restriction);
      else next.add(restriction);
      return next;
    });
  };

  const selectNone = () => {
    hapticSelect();
    setSelected(new Set());
    setNoneSelected(true);
  };

  const handleSave = async () => {
    if (saving) return;
    hapticImpactLight();
    setSaving(true);
    await updateProfile({ movementRestrictions: Array.from(selected) });
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
      backgroundStyle={{ backgroundColor: colors.background }}
      handleIndicatorStyle={{ backgroundColor: colors.surfaceBorder }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Movement</Text>
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
        <Text style={styles.headline} maxFontSizeMultiplier={1.3}>Anything your body just doesn&apos;t do right now?</Text>
        <Text style={styles.hint} maxFontSizeMultiplier={1.4}>No explanation needed — we&apos;ll build around it.</Text>

        <View style={styles.list}>
          {MOVEMENT_RESTRICTIONS.map((restriction, index) => {
            const isSelected = selected.has(restriction);
            const isLast = index === MOVEMENT_RESTRICTIONS.length - 1;
            return (
              <Pressable
                key={restriction}
                style={[styles.row, isLast && styles.rowLast]}
                onPress={() => toggleRestriction(restriction)}
              >
                <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>{MOVEMENT_RESTRICTION_LABELS[restriction]}</Text>
                <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                  {isSelected ? <SymbolView name="checkmark" size={11} tintColor="#ffffff" weight="bold" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.noneRow} onPress={selectNone}>
          <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>None of these</Text>
          <View style={[styles.checkbox, noneSelected && styles.checkboxChecked]}>
            {noneSelected ? <SymbolView name="checkmark" size={11} tintColor="#ffffff" weight="bold" /> : null}
          </View>
        </Pressable>

        <Pressable
          onPress={handleSave}
          onHoverIn={saveHover.onHoverIn}
          onHoverOut={saveHover.onHoverOut}
          onPressIn={savePress.onPressIn}
          onPressOut={savePress.onPressOut}
          disabled={saving}
        >
          <View style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
            <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.15}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </View>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
MovementRestrictionsSheet.displayName = 'MovementRestrictionsSheet';

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
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    // Same size/weight as the five rows above, not a smaller skip-link —
    // a real, equal-weight answer, per the vault's own spec.
    noneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
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
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
