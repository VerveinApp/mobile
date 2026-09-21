import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';

import { TabularNums, Type } from '@/constants/theme';
import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { localDateStr } from '@/lib/local-date';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppColors } from '@/lib/theme-context';
import { getUnitSystem, type UnitSystem } from '@/lib/unit-preference';
import { getProfile, updateProfile } from '@/lib/user-profile';
import { deleteWeightEntry, getWeightLog, resolveCurrentWeightKg, saveWeightEntry, type WeightLogEntry } from '@/lib/weight-log';
import {
  HorizontalRuler,
  RULER_HEIGHT,
  RULER_TICK_HEIGHT,
  RULER_TICK_SPACING,
} from '@/components/onboarding/horizontal-ruler';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/ui/sparkline';

// Same full-swipe-commits gesture as Notes' own list — see that file's
// comment for the full reasoning. Only one action here (Delete), so there's
// no archive-vs-delete ambiguity to resolve on commit.
const FULL_SWIPE_DELETE_THRESHOLD = -220;

// Same conversion math and item ranges as biometrics-sheet.tsx — duplicated
// rather than shared so this screen stays independent of that sheet, same
// reasoning biometrics-sheet.tsx itself gives for not sharing with
// onboarding/step-5.tsx.
// BUG FIX (found in a later full-app audit): these used to read `"161 lb"`
// and (below) `".0"` — two big, equally-weighted ruler labels side by side,
// which read as two disconnected values rather than one number. Plain
// digits here; the "." lives once, between the two rulers (see
// weightGlue/weightSeparator in the styles below), and the unit shows once,
// after — see biometrics-sheet.tsx's own identical fix and comment.
const WEIGHT_LB_ITEMS = Array.from({ length: 281 }, (_, i) => `${i + 80}`);
const WEIGHT_KG_ITEMS = Array.from({ length: 146 }, (_, i) => `${i + 35}`);
// A second, narrow wheel for tenths — this log previously only stored whole
// kg/lb, which was coarse enough to hide several days of genuine progress
// between one whole-unit tick and the next.
const DECIMAL_ITEMS = Array.from({ length: 10 }, (_, i) => `${i}`);
const DEFAULT_WEIGHT_KG = 73;

function roundTo1(n: number): number {
  return Math.round(n * 10) / 10;
}
// BUG FIX: kg/0.453592 lands a hair off the true lb value due to ordinary
// float representation error (e.g. 75.5684272/0.453592 can come back as
// 166.59999999999997, not 166.6) — harmless for Math.round (formatWeight's
// own display math), but Math.floor/modulo below are boundary-sensitive:
// flooring that noisy value gives 165, not 166. Rounding to the nearest
// thousandth of a pound first clears the noise while still being far finer
// than the 0.1lb resolution this screen actually offers.
function kgToLbWholeIndex(kg: number): number {
  const lb = Math.round((kg / 0.453592) * 1000) / 1000;
  return Math.min(WEIGHT_LB_ITEMS.length - 1, Math.max(0, Math.floor(lb) - 80));
}
function kgToLbDecimalIndex(kg: number): number {
  const lb = Math.round((kg / 0.453592) * 1000) / 1000;
  return Math.round((lb % 1) * 10) % 10;
}
// BUG FIX: this used to round the converted kg value to 1 decimal place
// before storing it — but 0.1kg (~0.22lb) is coarser than the 0.1lb this
// wheel actually lets someone pick, so a real selection like 166.6lb stored
// as a rounded 75.6kg, then converted back for display, came back as
// 166.7lb — a different number than the one actually chosen. Storing the
// full-precision product (only ever rounded at display time, in
// formatWeight) round-trips losslessly instead.
function lbPartsToKg(lbWholeIndex: number, decimalIndex: number): number {
  return (lbWholeIndex + 80 + decimalIndex / 10) * 0.453592;
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

function formatWeight(weightKg: number, unit: UnitSystem): string {
  return unit === 'metric' ? `${roundTo1(weightKg)} kg` : `${roundTo1(weightKg / 0.453592)} lb`;
}

// Always starts the decimal wheel at .0, in whichever unit is displayed —
// carrying forward the exact tenths from a past entry (or worse, a raw
// kg<->lb conversion artifact, e.g. the old flat 73kg default landed on an
// unrelated .9) reads as false precision nobody actually weighed in at.
// The whole-number part still seeds from the most recently known weight.
function seedWholeUnitKg(weightKg: number, unit: UnitSystem): number {
  return unit === 'metric' ? Math.round(weightKg) : Math.round(weightKg / 0.453592) * 0.453592;
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
  const entering = useFadeInEntering();
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const dragListeners = useRef<Map<string, string>>(new Map());
  const pendingFullSwipeDelete = useRef<Set<string>>(new Set());

  const [entries, setEntries] = useState<WeightLogEntry[]>([]);
  const [unit, setUnit] = useState<UnitSystem>('imperial');
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftWeightKg, setDraftWeightKg] = useState(DEFAULT_WEIGHT_KG);
  // The onboarding-collected profile weight, kept as the raw string
  // (resolveCurrentWeightKg's own param type) rather than pre-cast to a
  // number — every usage below calls that same shared resolver (also used
  // by profile.tsx/goals-sheet.tsx) against the latest `entries` state
  // instead of reimplementing the "log entry, else profile" priority
  // inline, so a future fix to that shared logic can't silently miss this
  // screen the way an inline copy would.
  const [profileWeightKg, setProfileWeightKg] = useState<string | undefined>(undefined);
  // Settings' Goals sheet — self-reported, never derived (see that sheet's
  // own doc comment). null = no goal set, shown nowhere on this screen.
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    (async () => {
      const [log, globalUnit, profile] = await Promise.all([getWeightLog(), getUnitSystem(), getProfile()]);
      setEntries(log);
      setUnit(globalUnit);
      const lastKnownWeightKg = resolveCurrentWeightKg(log, profile?.weightKg) ?? DEFAULT_WEIGHT_KG;
      setProfileWeightKg(profile?.weightKg);
      setTargetWeightKg(profile?.targetWeightKg ? Number(profile.targetWeightKg) : null);
      setDraftWeightKg(seedWholeUnitKg(lastKnownWeightKg, globalUnit));
      setLoaded(true);
    })();
  }, []);

  const today = localDateStr();
  const hasTodayEntry = entries.some((e) => e.date === today);

  const handleToggleAdd = () => {
    hapticSelect();
    setAdding((wasAdding) => {
      const willAdd = !wasAdding;
      // Re-seed on every open, not just on first screen load — otherwise
      // reopening after Cancel (or after this list changed) could show a
      // stale value from whenever the screen first mounted.
      if (willAdd) {
        setDraftWeightKg(seedWholeUnitKg(currentWeightKg ?? DEFAULT_WEIGHT_KG, unit));
      }
      return willAdd;
    });
  };

  const handleSave = async () => {
    hapticImpactLight();
    await saveWeightEntry(today, draftWeightKg);
    await updateProfile({ weightKg: String(draftWeightKg) });
    setEntries((prev) => [{ date: today, weightKg: draftWeightKg }, ...prev.filter((e) => e.date !== today)]);
    setAdding(false);
  };

  const handleDelete = async (date: string) => {
    hapticImpactLight();
    const previous = entries;
    setEntries((prev) => prev.filter((e) => e.date !== date));
    try {
      await deleteWeightEntry(date);
    } catch {
      // Persisted delete failed — restore the exact prior list instead of
      // silently letting the entry reappear on next load with no signal.
      hapticError();
      setEntries(previous);
    }
  };

  // Oldest-first for the chart (getWeightLog's own entries are newest-first,
  // matching the list below) — raw kg regardless of the display unit
  // toggle, since a line's shape is identical either way and Sparkline
  // carries no axis labels to convert. Needs 2+ real points to draw an
  // actual trend, not just a dot.
  const weightTrendData = entries.length >= 2 ? [...entries].reverse().map((e) => ({ value: e.weightKg })) : [];
  const currentWeightKg = resolveCurrentWeightKg(entries, profileWeightKg);

  const lbWholeIndex = kgToLbWholeIndex(draftWeightKg);
  const lbDecimalIndex = kgToLbDecimalIndex(draftWeightKg);
  const kgWholeIndex = kgToKgWholeIndex(draftWeightKg);
  const kgDecimalIndex = kgToKgDecimalIndex(draftWeightKg);

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

      {!loaded ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <SkeletonBlock width={130} height={44} borderRadius={14} />
          <View style={styles.section}>
            <SkeletonBlock width={60} height={11} borderRadius={4} />
            <SkeletonCard height={80} lines={2} />
          </View>
        </ScrollView>
      ) : (
        <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
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
                    <>
                      <HorizontalRuler
                        width={RULER_TICK_SPACING * 4}
                        items={WEIGHT_LB_ITEMS}
                        selectedIndex={lbWholeIndex}
                        onChange={(index) => setDraftWeightKg(lbPartsToKg(index, lbDecimalIndex))}
                      />
                      <View style={styles.weightGlue}>
                        <Text style={styles.weightSeparator}>.</Text>
                      </View>
                      <HorizontalRuler
                        width={RULER_TICK_SPACING * 2}
                        items={DECIMAL_ITEMS}
                        selectedIndex={lbDecimalIndex}
                        onChange={(index) => setDraftWeightKg(lbPartsToKg(lbWholeIndex, index))}
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
                        selectedIndex={kgWholeIndex}
                        onChange={(index) => setDraftWeightKg(kgPartsToKg(index, kgDecimalIndex))}
                      />
                      <View style={styles.weightGlue}>
                        <Text style={styles.weightSeparator}>.</Text>
                      </View>
                      <HorizontalRuler
                        width={RULER_TICK_SPACING * 2}
                        items={DECIMAL_ITEMS}
                        selectedIndex={kgDecimalIndex}
                        onChange={(index) => setDraftWeightKg(kgPartsToKg(kgWholeIndex, index))}
                      />
                      <View style={styles.weightGlue}>
                        <Text style={styles.weightUnit}>kg</Text>
                      </View>
                    </>
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

          {weightTrendData.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>TREND</Text>
              <View style={[styles.card, styles.chartCardPadding]}>
                <View style={styles.chartCardInner} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                  {chartWidth > 0 ? (
                    <Sparkline data={weightTrendData} width={chartWidth} height={56} color="#5FBE84" />
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {targetWeightKg !== null && currentWeightKg !== null ? (
            <View style={styles.section}>
              <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>TARGET</Text>
              <View style={styles.card}>
                <View style={styles.targetRow}>
                  <Text style={styles.targetText} maxFontSizeMultiplier={1.3}>
                    {formatWeight(currentWeightKg, unit)} now → {formatWeight(targetWeightKg, unit)} target
                  </Text>
                  {(() => {
                    const remainingKg = Math.abs(currentWeightKg - targetWeightKg);
                    // Neutral, direction-agnostic phrasing — "to go" either
                    // way, never "over" or "under," same anti-guilt framing
                    // as session-history.ts's own no-streaks rule.
                    return (
                      <Text style={styles.targetRemaining} maxFontSizeMultiplier={1.3}>
                        {remainingKg < 0.5
                          ? "You're at your target."
                          : `${formatWeight(remainingKg, unit)} to go`}
                      </Text>
                    );
                  })()}
                </View>
              </View>
            </View>
          ) : null}

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
                          style={styles.deleteAction}
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
        </ReanimatedAnimated.View>
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
      alignItems: 'center',
      gap: 14,
    },
    wheelRow: {
      flexDirection: 'row',
      gap: 10,
    },
    // Same fix and reasoning as biometrics-sheet.tsx's own weightGlue.
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
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-SemiBold',
    },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    chartCardPadding: {
      padding: 16,
    },
    chartCardInner: {
      width: '100%',
    },
    targetRow: {
      padding: 16,
      gap: 4,
    },
    targetText: {
      color: colors.text,
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
      ...TabularNums,
    },
    targetRemaining: {
      color: colors.textTertiary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Regular',
      ...TabularNums,
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
    entryWeight: {
      color: colors.textSecondary,
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
      ...TabularNums,
    },
    deleteAction: {
      width: 72,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#E5484D',
    },
  });
}
