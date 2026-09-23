import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';

import {
  deleteBodyMeasurementEntry,
  getBodyMeasurements,
  saveBodyMeasurementEntry,
  type BodyMeasurementEntry,
  type BodyMeasurementField,
} from '@/lib/body-measurements';
import { Type } from '@/constants/theme';
import { useHoverFade, useLiquidPress, PRESSED_DIM } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { localDateStr } from '@/lib/local-date';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppColors } from '@/lib/theme-context';
import { getUnitSystem, type UnitSystem } from '@/lib/unit-preference';
import { parseDecimalInput } from '@/lib/weight-units';
import { getProfile } from '@/lib/user-profile';
import { HealthConsentGate } from '@/components/settings/health-consent-gate';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/ui/sparkline';

// Same full-swipe-commits gesture as Notes/Weight History's own lists — see
// notes/index.tsx's comment for the full reasoning.
const FULL_SWIPE_DELETE_THRESHOLD = -220;

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
  // parseDecimalInput, not Number(): a comma-decimal keypad ("72,5") used to
  // parse as NaN and the measurement was silently dropped.
  const n = parseDecimalInput(value);
  if (n === null) return undefined;
  return unit === 'metric' ? n : n * 2.54;
}

function formatEntryDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Reached from Settings' DATA section. Gated on healthConsent, same as the
 * onboarding fields this data extends — see HealthConsentGate's own comment.
 */
export default function BodyMeasurementsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const addHover = useHoverFade();
  const savePress = useLiquidPress();
  const entering = useFadeInEntering();
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const dragListeners = useRef<Map<string, string>>(new Map());
  const pendingFullSwipeDelete = useRef<Set<string>>(new Set());

  const [entries, setEntries] = useState<BodyMeasurementEntry[]>([]);
  const [unit, setUnit] = useState<UnitSystem>('imperial');
  const [loaded, setLoaded] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [adding, setAdding] = useState(false);
  // Same disabled-while-saving guard condition-log.tsx's handleSave now has
  // — found in a later full-app audit as a shared missing pattern. Lower
  // real impact here since saveBodyMeasurementEntry merges by date rather
  // than appending, but a double-tap could still drop one write's fields.
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<BodyMeasurementField, string>>({
    waistCm: '',
    chestCm: '',
    hipCm: '',
    armCm: '',
    thighCm: '',
  });
  const [chartField, setChartField] = useState<BodyMeasurementField>('waistCm');
  const [chartWidth, setChartWidth] = useState(0);

  const reload = useCallback(() => {
    (async () => {
      const [log, globalUnit, profile] = await Promise.all([getBodyMeasurements(), getUnitSystem(), getProfile()]);
      setEntries(log);
      setUnit(globalUnit);
      setHasConsent(profile?.healthConsent === 'true');
      setLoaded(true);
    })();
  }, []);
  useFocusEffect(reload);

  const handleToggleAdd = () => {
    hapticSelect();
    setAdding((a) => !a);
  };

  const handleSave = async () => {
    if (saving) return;
    const fields: Partial<Record<BodyMeasurementField, number>> = {};
    for (const { key } of FIELDS) {
      const cm = displayToCm(draft[key], unit);
      if (cm !== undefined) fields[key] = cm;
    }
    if (Object.keys(fields).length === 0) return;
    hapticImpactLight();
    setSaving(true);
    const today = localDateStr();
    await saveBodyMeasurementEntry(today, fields);
    reload();
    setDraft({ waistCm: '', chestCm: '', hipCm: '', armCm: '', thighCm: '' });
    setAdding(false);
    setSaving(false);
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

  // Each field is independently optional per entry (someone might only log
  // waist most days) — a field needs its own 2+ real, defined points to
  // chart, not just 2+ entries overall. Never fabricates a value for a gap;
  // a field with a skipped day simply has fewer points, not an interpolated
  // one.
  const chartableFields = FIELDS.filter(({ key }) => entries.filter((e) => e[key] !== undefined).length >= 2);
  const activeChartField = chartableFields.some((f) => f.key === chartField) ? chartField : chartableFields[0]?.key;
  const chartData = activeChartField
    ? [...entries]
        .reverse()
        .filter((e) => e[activeChartField] !== undefined)
        .map((e) => ({ value: e[activeChartField] as number }))
    : [];

  return (
    // BUG FIX (found in a later full-app audit): this screen's numeric
    // measurement fields have no keyboard-avoidance — same fix as
    // settings/index.tsx already has.
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          onHoverIn={backHover.onHoverIn}
          onHoverOut={backHover.onHoverOut}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && PRESSED_DIM]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Body Measurements</Text>
        <View style={styles.backButton} />
      </View>

      {!loaded ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <SkeletonBlock width={150} height={44} borderRadius={14} />
          <View style={styles.section}>
            <SkeletonBlock width={60} height={11} borderRadius={4} />
            <SkeletonCard height={80} lines={2} />
          </View>
        </ScrollView>
      ) : !hasConsent ? (
        <HealthConsentGate />
      ) : (
        <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Pressable
              style={({ pressed }) => [styles.addRow, pressed && PRESSED_DIM]}
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
                  disabled={saving}
                  style={styles.saveButtonHit}
                >
                  <View style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
                    <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.15}>
                      {saving ? 'Saving…' : 'Save'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : null}
          </View>

          {chartableFields.length > 0 && activeChartField ? (
            <View style={styles.section}>
              <View style={styles.chartHeaderRow}>
                <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>TREND</Text>
                <View style={styles.chartFieldPills}>
                  {chartableFields.map(({ key, label }) => {
                    const active = activeChartField === key;
                    return (
                      <Pressable
                        key={key}
                        style={({ pressed }) => [styles.chartFieldPill, active && styles.chartFieldPillActive, pressed && PRESSED_DIM]}
                        onPress={() => {
                          hapticSelect();
                          setChartField(key);
                        }}
                      >
                        <Text
                          style={[styles.chartFieldPillText, active && styles.chartFieldPillTextActive]}
                          maxFontSizeMultiplier={1.2}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={[styles.card, styles.chartCardPadding]}>
                <View style={styles.chartCardInner} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                  {chartWidth > 0 ? (
                    <Sparkline data={chartData} width={chartWidth} height={56} color="#5FBE84" />
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

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
                      ref={(ref) => {
                        if (ref) swipeableRefs.current.set(entry.date, ref);
                        else swipeableRefs.current.delete(entry.date);
                      }}
                      renderRightActions={(_progress, dragX) => {
                        const previousListenerId = dragListeners.current.get(entry.date);
                        if (previousListenerId) dragX.removeListener(previousListenerId);
                        const listenerId = dragX.addListener(({ value }) => {
                          if (
                            value < FULL_SWIPE_DELETE_THRESHOLD &&
                            !pendingFullSwipeDelete.current.has(entry.date)
                          ) {
                            pendingFullSwipeDelete.current.add(entry.date);
                            swipeableRefs.current.get(entry.date)?.close();
                          }
                        });
                        dragListeners.current.set(entry.date, listenerId);
                        return (
                          <Pressable
                            style={({ pressed }) => [styles.deleteAction, pressed && PRESSED_DIM]}
                            onPress={() => handleDelete(entry.date)}
                            accessibilityRole="button"
                            accessibilityLabel="Delete entry"
                          >
                            <SymbolView name="trash.fill" size={15} tintColor="#ffffff" />
                          </Pressable>
                        );
                      }}
                      onSwipeableClose={() => {
                        if (pendingFullSwipeDelete.current.has(entry.date)) {
                          pendingFullSwipeDelete.current.delete(entry.date);
                          handleDelete(entry.date);
                        }
                      }}
                      overshootRight
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
        </ReanimatedAnimated.View>
      )}
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    fadeLayer: {
      flex: 1,
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
      fontSize: Type.headerTitle,
      letterSpacing: -0.2,
      fontFamily: 'Geist-Bold',
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
      fontSize: Type.caption,
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
      fontSize: Type.body,
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
      fontSize: Type.body,
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
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-SemiBold',
      textAlign: 'right',
      minWidth: 32,
      padding: 0,
    },
    fieldSuffix: {
      color: colors.textTertiary,
      fontSize: Type.secondary,
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
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: '#ffffff',
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-SemiBold',
    },
    chartHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    chartFieldPills: {
      flexDirection: 'row',
      gap: 6,
    },
    chartFieldPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
      backgroundColor: colors.pillBg,
    },
    chartFieldPillActive: {
      borderColor: '#5FBE84',
      backgroundColor: '#5FBE84',
    },
    chartFieldPillText: {
      color: colors.textSecondary,
      fontSize: Type.caption,
      fontFamily: 'Geist-SemiBold',
    },
    chartFieldPillTextActive: {
      color: '#ffffff',
    },
    chartCardPadding: {
      padding: 16,
    },
    chartCardInner: {
      width: '100%',
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
      fontSize: Type.secondary,
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
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    entryValues: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: Type.secondary,
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
