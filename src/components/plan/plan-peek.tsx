import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated, { useReducedMotion } from 'react-native-reanimated';

import { TabularNums, Type } from '@/constants/theme';
import { scaleCanvasStyles, useCanvasUnit } from '@/lib/canvas-scale';
import { formatExerciseStat } from '@/lib/exercise-format';
import { LIST_ROW_ENTERING, LIST_ROW_EXITING, LIST_ROW_LAYOUT } from '@/lib/motion';
import type { PlanExercise } from '@/lib/plan-preview';
import { useAppColors } from '@/lib/theme-context';

const SHOWN = 3;

/**
 * A live look at the plan being built: its first exercises, and how long it
 * runs next to a Good-day session. Shown while someone is still choosing
 * their energy, so the adaptation is something they watch happen rather
 * than read about afterwards. Rows are keyed by exercise, so a level change
 * fades out what left the plan and fades in what joined it. Lengths are
 * canvas units (it sits on fixed-canvas screens).
 */
export function PlanPeek({
  exercises,
  minutes,
  goodDayMinutes,
  width = 295,
}: {
  exercises: PlanExercise[];
  minutes: number;
  /** The same plan at Good energy — the comparison bar's reference. Null
   * hides the bar (nothing honest to compare against). */
  goodDayMinutes: number | null;
  width?: number;
}) {
  const colors = useAppColors();
  const unit = useCanvasUnit();
  const styles = useMemo(() => scaleCanvasStyles(createStyles(colors), unit), [colors, unit]);
  const reducedMotion = useReducedMotion();
  const shown = exercises.slice(0, SHOWN);
  const more = exercises.length - shown.length;

  // The bar spans whichever is longer, today or a Good day, so a big day
  // never overflows it; the tick marks where a Good day lands.
  const span = goodDayMinutes ? Math.max(minutes, goodDayMinutes) : 0;
  const showBar = goodDayMinutes !== null && goodDayMinutes > 0 && minutes > 0;

  return (
    <View style={[styles.wrap, { width: width * unit }]}>
      {shown.map((exercise, index) => (
        <ReanimatedAnimated.View
          // Position plus id: the same exercise can sit at a different slot
          // after a level change, and should glide there rather than refade.
          key={`${exercise.id}-${index}`}
          entering={reducedMotion ? undefined : LIST_ROW_ENTERING}
          exiting={reducedMotion ? undefined : LIST_ROW_EXITING}
          layout={reducedMotion ? undefined : LIST_ROW_LAYOUT}
          style={[styles.row, index > 0 && styles.rowDivider]}
          accessible
          accessibilityLabel={`${exercise.name}, ${formatExerciseStat(exercise)}`}
        >
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {exercise.name}
          </Text>
          <Text style={styles.stat} maxFontSizeMultiplier={1.2}>
            {formatExerciseStat(exercise)}
          </Text>
        </ReanimatedAnimated.View>
      ))}
      {more > 0 ? (
        <ReanimatedAnimated.Text
          layout={reducedMotion ? undefined : LIST_ROW_LAYOUT}
          style={styles.more}
          maxFontSizeMultiplier={1.2}
        >
          +{more} more
        </ReanimatedAnimated.Text>
      ) : null}
      {showBar ? (
        <View
          style={styles.barBlock}
          accessible
          accessibilityLabel={`Today ${minutes} minutes. A Good day is ${goodDayMinutes} minutes.`}
        >
          <View style={styles.track}>
            <ReanimatedAnimated.View
              layout={reducedMotion ? undefined : LIST_ROW_LAYOUT}
              style={[styles.fill, { width: `${(minutes / span) * 100}%` }]}
            />
            <View style={[styles.tick, { left: `${(goodDayMinutes / span) * 100}%` }]} />
          </View>
          <Text style={styles.barCaption} maxFontSizeMultiplier={1.2}>
            Good day · {goodDayMinutes} min
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    wrap: {
      marginTop: 4,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 7,
    },
    rowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.surfaceDivider,
    },
    name: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Medium',
    },
    stat: {
      color: colors.textTertiary,
      fontSize: Type.micro,
      fontFamily: 'Geist-SemiBold',
      ...TabularNums,
    },
    more: {
      marginTop: 2,
      color: colors.textTertiary,
      fontSize: Type.micro,
      fontFamily: 'Geist-Medium',
    },
    barBlock: {
      marginTop: 10,
    },
    track: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surfaceDivider,
    },
    fill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.accentText,
    },
    tick: {
      position: 'absolute',
      top: -3,
      width: 2,
      height: 10,
      marginLeft: -1,
      borderRadius: 1,
      backgroundColor: colors.textTertiary,
    },
    barCaption: {
      marginTop: 6,
      alignSelf: 'flex-end',
      color: colors.textTertiary,
      fontSize: Type.micro,
      fontFamily: 'Geist-Medium',
      ...TabularNums,
    },
  });
}
