import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';

import { TabularNums, Type } from '@/constants/theme';
import { useHoverFade, useLiquidPress, PRESSED_DIM } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { localDateStr } from '@/lib/local-date';
import { deleteNutritionEntry, getNutritionLog, saveNutritionEntry, type NutritionLogEntry } from '@/lib/nutrition-log';
import { usePremiumEntitlement } from '@/lib/purchases';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppColors } from '@/lib/theme-context';
import { PremiumGate } from '@/components/premium-gate';
import { HorizontalRuler } from '@/components/onboarding/horizontal-ruler';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/ui/sparkline';
import { LIST_ROW_EXITING, LIST_ROW_LAYOUT } from '@/lib/motion';

// 50-calorie resolution, 0–5000 — a manually-recalled daily total doesn't
// need finer precision than that.
const CALORIE_ITEMS = Array.from({ length: 101 }, (_, i) => `${i * 50} kcal`);
const DEFAULT_CALORIES = 2000;
// Free tier sees the most recent RECENT_FREE_COUNT entries — logging itself
// is never gated, only looking back further than that is, same "raw log
// free, deeper view Plus" split as Progress's own gated sections.
const RECENT_FREE_COUNT = 7;
const FULL_SWIPE_DELETE_THRESHOLD = -220;

function caloriesIndexToCalories(index: number): number {
  return index * 50;
}
function caloriesToIndex(calories: number): number {
  return Math.min(CALORIE_ITEMS.length - 1, Math.max(0, Math.round(calories / 50)));
}

function formatCalories(calories: number): string {
  return `${calories} kcal`;
}

function formatEntryDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * A manual, dated calorie-intake log — same conventions as Sleep History
 * and Weight History (one entry per day, full-swipe-to-delete, seeded from
 * the last real entry). Distinct from calorie-estimate.ts, which estimates
 * calories BURNED during a workout — this is calories consumed, entered by
 * hand. The most recent RECENT_FREE_COUNT entries are always visible; older
 * history is Plus-gated, matching the "raw log free, full depth Plus" split
 * already established for Progress's own gated sections.
 */
export default function NutritionHistoryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const savePress = useLiquidPress();
  const entering = useFadeInEntering();
  const isPremium = usePremiumEntitlement();
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const dragListeners = useRef<Map<string, string>>(new Map());
  const pendingFullSwipeDelete = useRef<Set<string>>(new Set());

  const [entries, setEntries] = useState<NutritionLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftCalories, setDraftCalories] = useState(DEFAULT_CALORIES);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    (async () => {
      const log = await getNutritionLog();
      setEntries(log);
      setDraftCalories(log[0]?.calories ?? DEFAULT_CALORIES);
      setLoaded(true);
    })();
  }, []);

  const today = localDateStr();
  const hasTodayEntry = entries.some((e) => e.date === today);
  const recentEntries = entries.slice(0, RECENT_FREE_COUNT);
  const olderEntries = entries.slice(RECENT_FREE_COUNT);
  // Full history, gated the same way EARLIER is — see sleep-history.tsx's
  // own matching comment for why the trend line isn't a third, ungated tier.
  const nutritionTrendData = entries.length >= 2 ? [...entries].reverse().map((e) => ({ value: e.calories })) : [];

  const handleToggleAdd = () => {
    hapticSelect();
    setAdding((wasAdding) => {
      const willAdd = !wasAdding;
      if (willAdd) setDraftCalories(entries[0]?.calories ?? DEFAULT_CALORIES);
      return willAdd;
    });
  };

  const handleSave = async () => {
    hapticImpactLight();
    await saveNutritionEntry(today, draftCalories);
    setEntries((prev) => [{ date: today, calories: draftCalories }, ...prev.filter((e) => e.date !== today)]);
    setAdding(false);
  };

  const handleDelete = async (date: string) => {
    hapticImpactLight();
    const previous = entries;
    setEntries((prev) => prev.filter((e) => e.date !== date));
    try {
      await deleteNutritionEntry(date);
    } catch {
      hapticError();
      setEntries(previous);
    }
  };

  const renderEntryRow = (entry: NutritionLogEntry, index: number, total: number) => (
    <ReanimatedAnimated.View key={entry.date} layout={LIST_ROW_LAYOUT} exiting={LIST_ROW_EXITING}>
    <Swipeable
      ref={(ref) => {
        if (ref) swipeableRefs.current.set(entry.date, ref);
        else swipeableRefs.current.delete(entry.date);
      }}
      renderRightActions={(_progress, dragX) => {
        const previousListenerId = dragListeners.current.get(entry.date);
        if (previousListenerId) dragX.removeListener(previousListenerId);
        const listenerId = dragX.addListener(({ value }) => {
          if (value < FULL_SWIPE_DELETE_THRESHOLD && !pendingFullSwipeDelete.current.has(entry.date)) {
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
      <View style={[styles.entryRow, index < total - 1 && styles.entryRowDivider, { backgroundColor: colors.surface }]}>
        <Text style={styles.entryDate} maxFontSizeMultiplier={1.2}>{formatEntryDate(entry.date)}</Text>
        <Text style={styles.entryValue} maxFontSizeMultiplier={1.2}>{formatCalories(entry.calories)}</Text>
      </View>
    </Swipeable>
    </ReanimatedAnimated.View>
  );

  return (
    <View style={styles.root}>
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
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Nutrition History</Text>
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
              style={({ pressed }) => [styles.addRow, pressed && PRESSED_DIM]}
              onPress={handleToggleAdd}
              accessibilityRole="button"
              accessibilityLabel={adding ? 'Cancel adding a nutrition entry' : "Add today's calories"}
            >
              <SymbolView name={adding ? 'xmark' : 'plus'} size={13} tintColor="#5FBE84" />
              <Text style={styles.addRowText} maxFontSizeMultiplier={1.2}>
                {adding ? 'Cancel' : hasTodayEntry ? "Update today's calories" : "Add today's calories"}
              </Text>
            </Pressable>

            {adding ? (
              <View style={styles.addCard}>
                <HorizontalRuler
                  items={CALORIE_ITEMS}
                  selectedIndex={caloriesToIndex(draftCalories)}
                  onChange={(index) => setDraftCalories(caloriesIndexToCalories(index))}
                />
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

          {nutritionTrendData.length > 0 ? (
            <PremiumGate isPremium={isPremium} label="Full nutrition trend">
              <View style={styles.section}>
                <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>TREND</Text>
                <View style={[styles.card, styles.chartCardPadding]}>
                  <View style={styles.chartCardInner} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                    {chartWidth > 0 ? (
                      <Sparkline data={nutritionTrendData} width={chartWidth} height={56} min={0} color="#5FBE84" />
                    ) : null}
                  </View>
                </View>
              </View>
            </PremiumGate>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>HISTORY</Text>
            {entries.length === 0 ? (
              <View style={styles.emptyCard}>
                <SymbolView name="fork.knife" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
                <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                  No calories logged yet — add today&apos;s to start your history.
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                {recentEntries.map((entry, index) => renderEntryRow(entry, index, recentEntries.length))}
              </View>
            )}
          </View>

          {olderEntries.length > 0 ? (
            <PremiumGate isPremium={isPremium} label="Full nutrition history">
              <View style={styles.section}>
                <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>EARLIER</Text>
                <View style={styles.card}>
                  {olderEntries.map((entry, index) => renderEntryRow(entry, index, olderEntries.length))}
                </View>
              </View>
            </PremiumGate>
          ) : null}
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
    entryValue: {
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
