import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { useHoverFade } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import {
  deleteSessionHistoryEntry,
  getSessionHistory,
  getWeekActivity,
  type SessionHistoryEntry,
} from '@/lib/session-history';
import { useAppColors } from '@/lib/theme-context';
import { getProfile } from '@/lib/user-profile';
import { deleteWorkoutLog, getAllWorkoutLogs, type WorkoutLogExercise } from '@/lib/workout-log';

function formatEntryDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * The real log behind "Progress & History" — every stored session entry,
 * most recent first, plus how many happened this week. No streak counter,
 * trend charts, or fabricated deltas here, just the actual local record.
 */
export default function ProgressHistoryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const [entries, setEntries] = useState<SessionHistoryEntry[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<Map<string, WorkoutLogExercise[]>>(new Map());
  const [thisWeekCount, setThisWeekCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  const completedCount = entries.filter((e) => e.completed).length;

  const handleDelete = (date: string) => {
    hapticImpactLight();
    setEntries((prev) => prev.filter((e) => e.date !== date));
    setWorkoutLogs((prev) => {
      const next = new Map(prev);
      next.delete(date);
      return next;
    });
    deleteSessionHistoryEntry(date);
    deleteWorkoutLog(date);
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
        >
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Progress & History</Text>
        <View style={styles.backButton} />
      </View>

      {!loaded ? null : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{thisWeekCount}</Text>
              <Text style={styles.summaryLabel}>This Week</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{completedCount}</Text>
              <Text style={styles.summaryLabel}>Logged Sessions</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionKicker}>HISTORY</Text>
            {entries.length === 0 ? (
              <View style={styles.emptyCard}>
                <SymbolView name="clock.arrow.circlepath" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
                <Text style={styles.emptyText}>No sessions logged yet — complete a check-in to start your history.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {entries.map((entry, index) => (
                  <HistoryRow
                    key={entry.date}
                    entry={entry}
                    exercises={workoutLogs.get(entry.date)}
                    isLast={index === entries.length - 1}
                    styles={styles}
                    colors={colors}
                    onDelete={() => handleDelete(entry.date)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/** One history row — swipe left to reveal a delete action, matching iOS's native list-row convention. Tapping the row (when a per-exercise log exists for that day) expands the real workout log below it. */
function HistoryRow({
  entry,
  exercises,
  isLast,
  styles,
  colors,
  onDelete,
}: {
  entry: SessionHistoryEntry;
  exercises: WorkoutLogExercise[] | undefined;
  isLast: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppColors>;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasLog = !!exercises && exercises.length > 0;
  const doneCount = exercises?.filter((e) => e.completed).length ?? 0;

  const toggleExpanded = () => {
    if (!hasLog) return;
    hapticSelect();
    setExpanded((e) => !e);
  };

  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable style={styles.deleteAction} onPress={onDelete}>
          <SymbolView name="trash.fill" size={15} tintColor="#ffffff" />
        </Pressable>
      )}
      overshootRight={false}
    >
      <Pressable
        onPress={toggleExpanded}
        style={[styles.entryRow, !isLast && styles.entryRowDivider, { backgroundColor: colors.surface }]}
      >
        <View style={styles.entryRowTop}>
          <Text style={styles.entryDate}>{formatEntryDate(entry.date)}</Text>
          <View style={styles.entryStatus}>
            <SymbolView
              name={entry.completed ? 'checkmark.circle.fill' : 'circle.dashed'}
              size={14}
              tintColor={entry.completed ? '#5FBE84' : colors.iconFaint}
            />
            <Text style={[styles.entryStatusText, entry.completed && styles.entryStatusTextDone]}>
              {entry.completed ? 'Completed' : 'Missed'}
            </Text>
          </View>
        </View>
        {entry.notes ? (
          <Text style={styles.entryNote} numberOfLines={2}>
            {entry.notes}
          </Text>
        ) : null}
        {hasLog ? (
          <View style={styles.logToggleRow}>
            <Text style={styles.logToggleText}>
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
      fontSize: 24,
      letterSpacing: -0.4,
      fontFamily: 'Geist-Black',
    },
    summaryLabel: {
      marginTop: 4,
      color: colors.textTertiary,
      fontSize: 10.5,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontFamily: 'Geist-Medium',
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
      fontSize: 11.5,
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
      fontSize: 11,
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
      fontSize: 12,
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
    deleteAction: {
      width: 72,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#E5484D',
    },
    entryDate: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    entryStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    entryStatusText: {
      color: colors.iconFaint,
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    entryStatusTextDone: {
      color: '#5FBE84',
    },
  });
}
