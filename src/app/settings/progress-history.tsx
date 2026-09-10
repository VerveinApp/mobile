import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';

import { LogPastSessionSheet } from '@/components/settings/log-past-session-sheet';
import { Type } from '@/constants/theme';
import { useHoverFade } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { useFadeInEntering } from '@/lib/screen-transitions';
import {
  deleteSessionHistoryEntry,
  getSessionHistory,
  getWeekActivity,
  type SessionHistoryEntry,
} from '@/lib/session-history';
import { useAppColors } from '@/lib/theme-context';
import { getProfile } from '@/lib/user-profile';
import { deleteWorkoutLog, getAllWorkoutLogs, type WorkoutLogExercise } from '@/lib/workout-log';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';

// Same full-swipe-commits gesture as Notes/Weight History's own lists — see
// notes/index.tsx's comment for the full reasoning. Scoped per HistoryRow
// instance below (a plain ref, not a Map) since each row is already its own
// component instance, not an inline .map() render.
const FULL_SWIPE_DELETE_THRESHOLD = -220;

function formatEntryDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

type MonthGroup = { key: string; label: string; entries: SessionHistoryEntry[] };

// Entries arrive newest-first (getSessionHistory's own sort) — bucketing in
// that same order, first-seen-key-wins, keeps the resulting month groups
// newest-first too, with no separate re-sort needed.
function groupByMonth(entries: SessionHistoryEntry[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const byKey = new Map<string, MonthGroup>();
  for (const entry of entries) {
    const key = monthKey(entry.date);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: formatMonthLabel(key), entries: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

/**
 * The real log behind "Progress & History" — every stored session entry,
 * most recent first, plus how many happened this week. No streak counter,
 * trend charts, or fabricated deltas here, just the actual local record.
 */
export default function ProgressHistoryScreen() {
  // Set when arriving from Progress's own consistency calendar (tapping a
  // real logged day there) — the one this list should already have open and
  // easy to spot, not just another undifferentiated row in the same list.
  const { date: targetDate } = useLocalSearchParams<{ date?: string }>();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const addHover = useHoverFade();
  const entering = useFadeInEntering();
  const logPastSessionSheetRef = useRef<BottomSheetModal>(null);
  const [entries, setEntries] = useState<SessionHistoryEntry[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<Map<string, WorkoutLogExercise[]>>(new Map());
  const [thisWeekCount, setThisWeekCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Which month "folders" are open — defaulted once (see the effect below),
  // never reset by a later reload (a delete or a new past-session log
  // shouldn't silently re-collapse a month the user opened by hand).
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const hasSetDefaultExpandedMonth = useRef(false);

  // Shared by the initial load and the "Log a Past Session" sheet's onSaved
  // callback — a fresh read from storage rather than optimistically
  // patching local state, since the sheet may have just replaced an
  // existing day's entry (see its own alreadyLogged warning), not only
  // appended a new one.
  const loadHistory = useCallback(async () => {
    const [history, logs, profile] = await Promise.all([
      getSessionHistory(),
      getAllWorkoutLogs(),
      getProfile(),
    ]);
    const trainingDays = profile?.days ? profile.days.split(',') : null;
    setEntries(history);
    setWorkoutLogs(new Map(logs.map((l) => [l.date, l.exercises])));
    setThisWeekCount((await getWeekActivity(trainingDays)).completedCount);
    setLoaded(true);
  }, []);

  // Wrapped in its own inline IIFE, not a bare `loadHistory();` — same
  // shape this file's original mount effect already used before this
  // function existed as a named, reusable callback. The lint rule reads a
  // direct call to an external function reference as "this effect
  // synchronously triggers setState," but an inline async arrow it can see
  // into (even one that just awaits that same function) as the deferred,
  // microtask-timed pattern the rule wants.
  useEffect(() => {
    (async () => {
      await loadHistory();
    })();
  }, [loadHistory]);

  const completedCount = entries.filter((e) => e.completed).length;
  const monthGroups = useMemo(() => groupByMonth(entries), [entries]);

  // Runs once, the first time real entries exist — opens the most recent
  // month by default (so history doesn't load into an all-collapsed wall of
  // folders), plus whichever month holds the day someone tapped from
  // Progress's own calendar to get here, even if that's an older month.
  useEffect(() => {
    if (hasSetDefaultExpandedMonth.current || monthGroups.length === 0) return;
    hasSetDefaultExpandedMonth.current = true;
    const defaults = new Set([monthGroups[0].key]);
    if (targetDate) defaults.add(monthKey(targetDate));
    setExpandedMonths(defaults);
  }, [monthGroups, targetDate]);

  const toggleMonth = (key: string) => {
    hapticSelect();
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDelete = async (date: string) => {
    hapticImpactLight();
    const previousEntries = entries;
    const previousWorkoutLogs = workoutLogs;
    setEntries((prev) => prev.filter((e) => e.date !== date));
    setWorkoutLogs((prev) => {
      const next = new Map(prev);
      next.delete(date);
      return next;
    });
    try {
      await Promise.all([deleteSessionHistoryEntry(date), deleteWorkoutLog(date)]);
    } catch {
      // Persisted delete failed — restore the exact prior state instead of
      // silently letting the entry reappear on next load with no signal.
      hapticError();
      setEntries(previousEntries);
      setWorkoutLogs(previousWorkoutLogs);
    }
  };

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
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Progress & History</Text>
        <Pressable
          onPress={() => {
            hapticImpactLight();
            logPastSessionSheetRef.current?.present();
          }}
          onHoverIn={addHover.onHoverIn}
          onHoverOut={addHover.onHoverOut}
          hitSlop={10}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Log a past session"
        >
          <SymbolView name="plus" size={16} tintColor={colors.text} />
        </Pressable>
      </View>

      <LogPastSessionSheet ref={logPastSessionSheetRef} onSaved={loadHistory} />

      {!loaded ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryRow}>
            <SkeletonCard height={80} style={{ flex: 1 }} />
            <SkeletonCard height={80} style={{ flex: 1 }} />
          </View>
          <View style={styles.section}>
            <SkeletonBlock width={60} height={11} borderRadius={4} />
            <SkeletonCard height={150} lines={3} />
          </View>
        </ScrollView>
      ) : (
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue} maxFontSizeMultiplier={1.15}>{thisWeekCount}</Text>
              <Text style={styles.summaryLabel} maxFontSizeMultiplier={1.2}>This Week</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue} maxFontSizeMultiplier={1.15}>{completedCount}</Text>
              <Text style={styles.summaryLabel} maxFontSizeMultiplier={1.2}>Logged Sessions</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>HISTORY</Text>
            {entries.length === 0 ? (
              <View style={styles.emptyCard}>
                <SymbolView name="clock.arrow.circlepath" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
                <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                  No sessions logged yet — complete a check-in to start your history.
                </Text>
              </View>
            ) : (
              <View style={styles.monthList}>
                {monthGroups.map((group) => {
                  const expanded = expandedMonths.has(group.key);
                  const completedInMonth = group.entries.filter((e) => e.completed).length;
                  return (
                    <View key={group.key} style={styles.card}>
                      <Pressable
                        style={styles.monthHeaderRow}
                        onPress={() => toggleMonth(group.key)}
                        accessibilityRole="button"
                        accessibilityLabel={`${group.label}, ${completedInMonth} of ${group.entries.length} completed. ${expanded ? 'Collapse' : 'Expand'}.`}
                      >
                        <View style={styles.monthHeaderLeft}>
                          <SymbolView name={expanded ? 'folder.fill' : 'folder'} size={14} tintColor={colors.textTertiary} />
                          <Text style={styles.monthHeaderLabel} maxFontSizeMultiplier={1.2}>{group.label}</Text>
                        </View>
                        <View style={styles.monthHeaderRight}>
                          <Text style={styles.monthHeaderCount} maxFontSizeMultiplier={1.2}>
                            {completedInMonth}/{group.entries.length}
                          </Text>
                          <SymbolView
                            name={expanded ? 'chevron.up' : 'chevron.down'}
                            size={11}
                            tintColor={colors.textTertiary}
                          />
                        </View>
                      </Pressable>
                      {expanded ? (
                        <View style={styles.monthBody}>
                          {group.entries.map((entry, index) => (
                            <HistoryRow
                              key={entry.date}
                              entry={entry}
                              exercises={workoutLogs.get(entry.date)}
                              isLast={index === group.entries.length - 1}
                              isTarget={entry.date === targetDate}
                              styles={styles}
                              colors={colors}
                              onDelete={() => handleDelete(entry.date)}
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </ReanimatedAnimated.View>
      )}
    </View>
  );
}

/** One history row — swipe left to reveal a delete action, matching iOS's native list-row convention. Tapping the row (when a per-exercise log exists for that day) expands the real workout log below it. */
function HistoryRow({
  entry,
  exercises,
  isLast,
  isTarget,
  styles,
  colors,
  onDelete,
}: {
  entry: SessionHistoryEntry;
  exercises: WorkoutLogExercise[] | undefined;
  isLast: boolean;
  /** True for the one day someone tapped from Progress's own calendar to
   * get here — starts pre-expanded (if it has a real log) and gets a
   * subtle highlight so it's easy to spot among the rest of the list. */
  isTarget: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppColors>;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(isTarget);
  const hasLog = !!exercises && exercises.length > 0;
  const doneCount = exercises?.filter((e) => e.completed).length ?? 0;
  const swipeableRef = useRef<Swipeable>(null);
  const dragListenerId = useRef<string | null>(null);
  const pendingFullSwipeDelete = useRef(false);

  const toggleExpanded = () => {
    if (!hasLog) return;
    hapticSelect();
    setExpanded((e) => !e);
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={(_progress, dragX) => {
        if (dragListenerId.current) dragX.removeListener(dragListenerId.current);
        dragListenerId.current = dragX.addListener(({ value }) => {
          if (value < FULL_SWIPE_DELETE_THRESHOLD && !pendingFullSwipeDelete.current) {
            pendingFullSwipeDelete.current = true;
            swipeableRef.current?.close();
          }
        });
        return (
          <Pressable
            style={styles.deleteAction}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete session"
          >
            <SymbolView name="trash.fill" size={15} tintColor="#ffffff" />
          </Pressable>
        );
      }}
      onSwipeableClose={() => {
        if (pendingFullSwipeDelete.current) {
          pendingFullSwipeDelete.current = false;
          onDelete();
        }
      }}
      overshootRight
    >
      <Pressable
        onPress={toggleExpanded}
        style={[
          styles.entryRow,
          !isLast && styles.entryRowDivider,
          { backgroundColor: colors.surface },
          isTarget && styles.entryRowTarget,
        ]}
      >
        <View style={styles.entryRowTop}>
          <View style={styles.entryDateRow}>
            <Text style={styles.entryDate} maxFontSizeMultiplier={1.2}>{formatEntryDate(entry.date)}</Text>
            {entry.loggedRetroactively ? (
              <Text style={styles.retroactiveTag} maxFontSizeMultiplier={1.2}>Logged after the fact</Text>
            ) : null}
          </View>
          <View style={styles.entryStatus}>
            <SymbolView
              name={entry.completed ? 'checkmark.circle.fill' : 'circle.dashed'}
              size={14}
              tintColor={entry.completed ? '#5FBE84' : colors.iconFaint}
            />
            <Text
              style={[styles.entryStatusText, entry.completed && styles.entryStatusTextDone]}
              maxFontSizeMultiplier={1.2}
            >
              {entry.completed ? 'Completed' : 'Missed'}
            </Text>
          </View>
        </View>
        {entry.notes ? (
          <Text style={styles.entryNote} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {entry.notes}
          </Text>
        ) : null}
        {hasLog ? (
          <View style={styles.logToggleRow}>
            <Text style={styles.logToggleText} maxFontSizeMultiplier={1.3}>
              {expanded ? 'Hide' : 'Show'} workout ({doneCount}/{exercises.length})
            </Text>
            <SymbolView
              name={expanded ? 'chevron.up' : 'chevron.down'}
              size={10}
              tintColor={colors.textTertiary}
            />
          </View>
        ) : null}
        {hasLog && expanded ? (
          <View style={styles.logList}>
            {exercises.map((exercise) => (
              <View key={exercise.name} style={styles.logExerciseRow}>
                <SymbolView
                  name={exercise.completed ? 'checkmark.circle.fill' : 'circle.dashed'}
                  size={13}
                  tintColor={exercise.completed ? '#5FBE84' : colors.iconFaint}
                />
                <Text
                  style={[styles.logExerciseName, !exercise.completed && styles.logExerciseNameSkipped]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                >
                  {exercise.name}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>
    </Swipeable>
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
    summaryRow: {
      flexDirection: 'row',
      gap: 12,
    },
    summaryCard: {
      flex: 1,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingVertical: 18,
      alignItems: 'center',
    },
    summaryValue: {
      color: colors.text,
      fontSize: Type.display,
      letterSpacing: -0.4,
      fontFamily: 'Geist-Black',
    },
    summaryLabel: {
      marginTop: 4,
      color: colors.textTertiary,
      fontSize: Type.micro,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontFamily: 'Geist-Medium',
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
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    monthList: {
      gap: 12,
    },
    monthHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    monthHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    monthHeaderLabel: {
      color: colors.text,
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
    },
    monthHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    monthHeaderCount: {
      color: colors.textTertiary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-SemiBold',
    },
    monthBody: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.surfaceDivider,
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
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    entryRowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    entryNote: {
      marginTop: 6,
      color: colors.textTertiary,
      fontSize: Type.caption,
      lineHeight: 16,
      fontFamily: 'Geist-Regular',
      fontStyle: 'italic',
    },
    logToggleRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    logToggleText: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
    },
    logList: {
      marginTop: 10,
      gap: 8,
    },
    logExerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    logExerciseName: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Medium',
    },
    logExerciseNameSkipped: {
      color: colors.textTertiary,
      textDecorationLine: 'line-through',
    },
    entryRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    // Marks the one row someone arrived here to see (tapped from Progress's
    // own calendar) — subtle enough not to look like a new permanent state,
    // just enough to be findable at a glance in a longer list.
    entryRowTarget: {
      backgroundColor: 'rgba(95,190,132,0.1)',
    },
    deleteAction: {
      width: 72,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#E5484D',
    },
    entryDateRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    entryDate: {
      color: colors.text,
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    retroactiveTag: {
      color: colors.textTertiary,
      fontSize: Type.micro,
      fontStyle: 'italic',
      fontFamily: 'Geist-Regular',
    },
    entryStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    entryStatusText: {
      color: colors.iconFaint,
      fontSize: Type.secondary,
      fontFamily: 'Geist-SemiBold',
    },
    entryStatusTextDone: {
      color: '#5FBE84',
    },
  });
}
