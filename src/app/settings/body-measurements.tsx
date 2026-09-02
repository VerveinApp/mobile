import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import {
  deleteBodyMeasurementEntry,
  getBodyMeasurements,
  saveBodyMeasurementEntry,
  type BodyMeasurementEntry,
  type BodyMeasurementField,
} from '@/lib/body-measurements';
import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { localDateStr } from '@/lib/local-date';
import { useAppColors } from '@/lib/theme-context';
import { getUnitSystem, type UnitSystem } from '@/lib/unit-preference';

const FIELDS: { key: BodyMeasurementField; label: string }[] = [
  { key: 'waistCm', label: 'Waist' },
  { key: 'chestCm', label: 'Chest' },
  { key: 'hipCm', label: 'Hip' },
  { key: 'armCm', label: 'Arm' },
  { key: 'thighCm', label: 'Thigh' },
];

// Stored value is always cm (same "metric internally, convert only for
// display/input" convention as user-profile.ts's heightCm/weightKg) —
// converting per keystroke rather than storing whatever unit was on
// screen at save time keeps a later unit-preference change from silently
// reinterpreting old numbers.
function cmToDisplay(cm: number, unit: UnitSystem): string {
  return unit === 'metric' ? String(Math.round(cm * 10) / 10) : String(Math.round((cm / 2.54) * 10) / 10);
}
function displayToCm(value: string, unit: UnitSystem): number | undefined {
  const n = Number(value);
  if (!value.trim() || Number.isNaN(n)) return undefined;
  return unit === 'metric' ? n : n * 2.54;
}

function formatEntryDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * NOT YET LINKED from anywhere (no Log or Settings row points here) — see
 * lib/body-measurements.ts's own header comment for why. Reachable only by
 * direct navigation until that's resolved.
 */
export default function BodyMeasurementsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const addHover = useHoverFade();
  const savePress = useLiquidPress();

  const [entries, setEntries] = useState<BodyMeasurementEntry[]>([]);
  const [unit, setUnit] = useState<UnitSystem>('imperial');
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Record<BodyMeasurementField, string>>({
    waistCm: '',
    chestCm: '',
    hipCm: '',
    armCm: '',
    thighCm: '',
  });

  const reload = useCallback(() => {
    (async () => {
      const [log, globalUnit] = await Promise.all([getBodyMeasurements(), getUnitSystem()]);
      setEntries(log);
      setUnit(globalUnit);
      setLoaded(true);
    })();
  }, []);
  useFocusEffect(reload);

  const handleToggleAdd = () => {
    hapticSelect();
    setAdding((a) => !a);
  };

  const handleSave = async () => {
    const fields: Partial<Record<BodyMeasurementField, number>> = {};
    for (const { key } of FIELDS) {
      const cm = displayToCm(draft[key], unit);
      if (cm !== undefined) fields[key] = cm;
    }
    if (Object.keys(fields).length === 0) return;
    hapticImpactLight();
    const today = localDateStr();
    await saveBodyMeasurementEntry(today, fields);
    reload();
    setDraft({ waistCm: '', chestCm: '', hipCm: '', armCm: '', thighCm: '' });
    setAdding(false);
  };

  const handleDelete = async (date: string) => {
    hapticImpactLight();
    const previous = entries;
    setEntries((prev) => prev.filter((e) => e.date !== date));
    try {
      await deleteBodyMeasurementEntry(date);
    } catch {
      hapticError();
      setEntries(previous);
    }
  };

  const unitSuffix = unit === 'metric' ? 'cm' : 'in';

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
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Body Measurements</Text>
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
              accessibilityLabel={adding ? 'Cancel adding measurements' : "Add today's measurements"}
            >
              <SymbolView name={adding ? 'xmark' : 'plus'} size={13} tintColor="#5FBE84" />
              <Text style={styles.addRowText} maxFontSizeMultiplier={1.2}>
                {adding ? 'Cancel' : "Add today's measurements"}
              </Text>
            </Pressable>

            {adding ? (
              <View style={styles.addCard}>
                {FIELDS.map(({ key, label }) => (
                  <View key={key} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
                    <View style={styles.fieldInputWrap}>
                      <TextInput
                        style={styles.fieldInput}
                        value={draft[key]}
                        onChangeText={(v) => setDraft((prev) => ({ ...prev, [key]: v }))}
                        placeholder="—"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        maxFontSizeMultiplier={1.2}
                      />
                      <Text style={styles.fieldSuffix} maxFontSizeMultiplier={1.2}>{unitSuffix}</Text>
                    </View>
                  </View>
                ))}
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
                <SymbolView name="ruler" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
                <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                  No measurements logged yet — add today&apos;s to start your history.
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                {entries.map((entry, index) => {
                  const parts = FIELDS.filter(({ key }) => entry[key] !== undefined).map(
                    ({ key, label }) => `${label} ${cmToDisplay(entry[key] as number, unit)}${unitSuffix}`
                  );
                  return (
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
                        <Text style={styles.entryValues} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                          {parts.join(' · ')}
                        </Text>
                      </View>
                    </Swipeable>
                  );
                })}
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
      gap: 14,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    fieldInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minWidth: 90,
      justifyContent: 'flex-end',
    },
    fieldInput: {
      color: colors.text,
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
      textAlign: 'right',
      minWidth: 32,
      padding: 0,
    },
    fieldSuffix: {
      color: colors.textTertiary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
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
      gap: 10,
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
    entryValues: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
      textAlign: 'right',
    },
    deleteAction: {
      width: 72,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#E5484D',
    },
  });
}
