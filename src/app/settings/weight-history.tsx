import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { localDateStr } from '@/lib/local-date';
import { useAppColors } from '@/lib/theme-context';
import { getUnitSystem, type UnitSystem } from '@/lib/unit-preference';
import { updateProfile } from '@/lib/user-profile';
import { deleteWeightEntry, getWeightLog, saveWeightEntry, type WeightLogEntry } from '@/lib/weight-log';
import { WheelPicker } from '@/components/onboarding/wheel-picker';

// Same conversion math and item ranges as biometrics-sheet.tsx — duplicated
// rather than shared so this screen stays independent of that sheet, same
// reasoning biometrics-sheet.tsx itself gives for not sharing with
// onboarding/step-5.tsx.
const WEIGHT_LB_ITEMS = Array.from({ length: 281 }, (_, i) => `${i + 80} lb`);
const WEIGHT_KG_ITEMS = Array.from({ length: 146 }, (_, i) => `${i + 35} kg`);
const DEFAULT_WEIGHT_KG = 73;

function kgToLbIndex(kg: number): number {
  return Math.min(WEIGHT_LB_ITEMS.length - 1, Math.max(0, Math.round(kg / 0.453592) - 80));
}
function lbToKg(lbIndex: number): number {
  return Math.round((lbIndex + 80) * 0.453592);
}
function kgToKgIndex(kg: number): number {
  return Math.min(WEIGHT_KG_ITEMS.length - 1, Math.max(0, kg - 35));
}

function formatWeight(weightKg: number, unit: UnitSystem): string {
  return unit === 'metric' ? `${weightKg} kg` : `${Math.round(weightKg / 0.453592)} lb`;
}

function formatEntryDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * The real dated weight log — separate from user-profile.ts's single
 * `weightKg` field (which is just "the current value," read elsewhere in
 * the app for training-load math). Saving a new entry here also updates
 * that field via updateProfile, so the rest of the app never reads a stale
 * current weight after a new weigh-in — this log is additive history on
 * top of it, not a replacement.
 */
export default function WeightHistoryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const addHover = useHoverFade();
  const savePress = useLiquidPress();

  const [entries, setEntries] = useState<WeightLogEntry[]>([]);
  const [unit, setUnit] = useState<UnitSystem>('imperial');
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftWeightKg, setDraftWeightKg] = useState(DEFAULT_WEIGHT_KG);

  useEffect(() => {
    (async () => {
      const [log, globalUnit] = await Promise.all([getWeightLog(), getUnitSystem()]);
      setEntries(log);
      setUnit(globalUnit);
      setDraftWeightKg(log[0]?.weightKg ?? DEFAULT_WEIGHT_KG);
      setLoaded(true);
    })();
  }, []);

  const today = localDateStr();
  const hasTodayEntry = entries.some((e) => e.date === today);

  const handleToggleAdd = () => {
    hapticSelect();
    setAdding((a) => !a);
  };

  const handleSave = async () => {
    hapticImpactLight();
    await saveWeightEntry(today, draftWeightKg);
    await updateProfile({ weightKg: String(draftWeightKg) });
    setEntries((prev) => [{ date: today, weightKg: draftWeightKg }, ...prev.filter((e) => e.date !== today)]);
    setAdding(false);
  };

  const handleDelete = (date: string) => {
    hapticImpactLight();
    setEntries((prev) => prev.filter((e) => e.date !== date));
    deleteWeightEntry(date);
  };

  const lbIndex = kgToLbIndex(draftWeightKg);
  const kgIndex = kgToKgIndex(draftWeightKg);

  return (
    <View style={styles.root}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          onHoverIn={backHover.onHoverIn}
          onHoverOut={backHover.onHoverOut}
          hitSlop={10}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Weight History</Text>
        <View style={styles.backButton} />
      </View>

      {!loaded ? null : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Pressable
              style={styles.addRow}
              onPress={handleToggleAdd}
              onHoverIn={addHover.onHoverIn}
              onHoverOut={addHover.onHoverOut}
              accessibilityRole="button"
              accessibilityLabel={adding ? 'Cancel adding a weight entry' : "Add today's weight"}
            >
              <SymbolView name={adding ? 'xmark' : 'plus'} size={13} tintColor="#5FBE84" />
              <Text style={styles.addRowText} maxFontSizeMultiplier={1.2}>
                {adding ? 'Cancel' : hasTodayEntry ? "Update today's weight" : "Add today's weight"}
              </Text>
            </Pressable>

            {adding ? (
              <View style={styles.addCard}>
                <View style={styles.wheelRow}>
                  {unit === 'imperial' ? (
                    <WheelPicker
                      items={WEIGHT_LB_ITEMS}
                      selectedIndex={lbIndex}
                      onChange={(index) => setDraftWeightKg(lbToKg(index))}
                      width={110}
                    />
                  ) : (
                    <WheelPicker
                      items={WEIGHT_KG_ITEMS}
                      selectedIndex={kgIndex}
                      onChange={(index) => setDraftWeightKg(index + 35)}
                      width={110}
                    />
                  )}
                </View>
                <Pressable
                  onPress={handleSave}
                  onPressIn={savePress.onPressIn}
                  onPressOut={savePress.onPressOut}
                  style={styles.saveButtonHit}
                >
                  <View style={styles.saveButton}>
                    <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.15}>Save</Text>
                  </View>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>HISTORY</Text>
            {entries.length === 0 ? (
              <View style={styles.emptyCard}>
                <SymbolView name="scalemass" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
                <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                  No weigh-ins logged yet — add today&apos;s to start your history.
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                {entries.map((entry, index) => (
                  <Swipeable
                    key={entry.date}
                    renderRightActions={() => (
                      <Pressable
                        style={styles.deleteAction}
                        onPress={() => handleDelete(entry.date)}
                        accessibilityRole="button"
                        accessibilityLabel="Delete entry"
                      >
                        <SymbolView name="trash.fill" size={15} tintColor="#ffffff" />
                      </Pressable>
                    )}
                    overshootRight={false}
                  >
                    <View
                      style={[
                        styles.entryRow,
                        index < entries.length - 1 && styles.entryRowDivider,
                        { backgroundColor: colors.surface },
                      ]}
                    >
                      <Text style={styles.entryDate} maxFontSizeMultiplier={1.2}>{formatEntryDate(entry.date)}</Text>
                      <Text style={styles.entryWeight} maxFontSizeMultiplier={1.2}>
                        {formatWeight(entry.weightKg, unit)}
                      </Text>
                    </View>
                  </Swipeable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: colors.text,
      fontSize: 16,
      fontFamily: 'Geist-SemiBold',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      gap: 28,
    },
    section: {
      gap: 12,
    },
    sectionKicker: {
      color: colors.textTertiary,
      fontSize: 11,
      letterSpacing: 1,
      fontFamily: 'Geist-SemiBold',
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    addRowText: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    addCard: {
      marginTop: 10,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 16,
      alignItems: 'center',
      gap: 14,
    },
    wheelRow: {
      flexDirection: 'row',
      gap: 10,
    },
    saveButtonHit: {
      width: '100%',
    },
    saveButton: {
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: '#438C63',
      alignItems: 'center',
    },
    saveButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    emptyCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 20,
      alignItems: 'center',
    },
    emptyIcon: {
      marginBottom: 10,
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: 12.5,
      fontFamily: 'Geist-Medium',
      lineHeight: 18,
      textAlign: 'center',
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    entryRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    entryDate: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    entryWeight: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    deleteAction: {
      width: 72,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#E5484D',
    },
  });
}
