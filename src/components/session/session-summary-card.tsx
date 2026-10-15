import { useMemo } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated, { useReducedMotion } from 'react-native-reanimated';

import { SymbolView } from '@/components/ui/app-symbol';
import { TabularNums, Type } from '@/constants/theme';
import { PRESSED_DIM } from '@/lib/button-interactions';
import { scaleCanvasStyles, useCanvasUnit } from '@/lib/canvas-scale';
import { hapticImpactLight } from '@/lib/haptics';
import { LIST_ROW_STAGGER_MS, MOTION_DURATION, listRowEnteringAfter } from '@/lib/motion';
import { describeSessionSummary, getSessionShareText, type SessionSummary } from '@/lib/session-summary';
import { useAppColors } from '@/lib/theme-context';
import type { UnitSystem } from '@/lib/unit-preference';

// The reveal waits for the checkmark above to mostly draw in, so the numbers
// land as its payoff rather than a second entrance competing with it.
const REVEAL_LEAD_IN_MS = MOTION_DURATION.slow;
// A long session's last rows shouldn't wait seconds to appear.
const MAX_STAGGER_STEPS = 8;

/**
 * The done screen's "what you did": time trained, exercise and set counts,
 * then each completed exercise with what was logged — only what was done,
 * never what wasn't. Free for everyone (it's the core loop's payoff).
 * Rendered inside check-in.tsx's fixed canvas, so every length below is in
 * canvas units and goes through scaleCanvasStyles.
 */
export function SessionSummaryCard({ summary, unit }: { summary: SessionSummary; unit: UnitSystem }) {
  const colors = useAppColors();
  const scale = useCanvasUnit();
  const styles = useMemo(() => scaleCanvasStyles(createStyles(colors), scale), [colors, scale]);
  const reducedMotion = useReducedMotion();
  const view = describeSessionSummary(summary, unit);

  if (view.exerciseCount === 0) return null;

  const enteringAt = (step: number) =>
    reducedMotion
      ? undefined
      : listRowEnteringAfter(REVEAL_LEAD_IN_MS + Math.min(step, MAX_STAGGER_STEPS) * LIST_ROW_STAGGER_MS);

  // Same pattern as referral.tsx's and Home's share: build the line, hand it
  // to the native sheet, and let a dismiss pass silently.
  const handleShare = async () => {
    const message = getSessionShareText(view);
    if (!message) return;
    hapticImpactLight();
    try {
      await Share.share({ message });
    } catch {
      // Share sheet dismissed or unavailable — nothing depends on it.
    }
  };

  const stats = [
    view.trainedLabel !== null ? { key: 'time', value: view.trainedLabel, label: 'TIME' } : null,
    { key: 'exercises', value: String(view.exerciseCount), label: view.exerciseCount === 1 ? 'EXERCISE' : 'EXERCISES' },
    view.setCount !== null ? { key: 'sets', value: String(view.setCount), label: view.setCount === 1 ? 'SET' : 'SETS' } : null,
  ].filter((stat) => stat !== null);

  return (
    <View style={styles.section}>
      <ReanimatedAnimated.Text
        entering={enteringAt(0)}
        style={styles.sectionLabel}
        maxFontSizeMultiplier={1.3}
        accessibilityRole="header"
      >
        TODAY&apos;S SESSION
      </ReanimatedAnimated.Text>
      <ReanimatedAnimated.View entering={enteringAt(0)} style={styles.card}>
        <View style={styles.statsRow} accessible accessibilityLabel={view.statsAccessibilityLabel}>
          {stats.map((stat) => (
            <View key={stat.key} style={styles.stat}>
              <Text style={styles.statValue} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit>
                {stat.value}
              </Text>
              <Text style={styles.statLabel} maxFontSizeMultiplier={1.2}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
        {view.rows.map((row, index) => (
          <ReanimatedAnimated.View
            // Names aren't unique within one session (see check-in.tsx's
            // completedExercises), so the position is part of the key.
            key={`${index}-${row.name}`}
            entering={enteringAt(index + 1)}
            style={styles.row}
            accessible
            accessibilityLabel={row.accessibilityLabel}
          >
            <Text style={styles.rowName} maxFontSizeMultiplier={1.3} numberOfLines={2}>
              {row.name}
            </Text>
            {row.detail ? (
              <Text style={styles.rowDetail} maxFontSizeMultiplier={1.3} numberOfLines={2}>
                {row.detail}
              </Text>
            ) : null}
          </ReanimatedAnimated.View>
        ))}
      </ReanimatedAnimated.View>
      <ReanimatedAnimated.View entering={enteringAt(view.rows.length + 1)} style={styles.shareWrap}>
        <Pressable
          style={({ pressed }) => [styles.shareButton, pressed && PRESSED_DIM]}
          onPress={handleShare}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Share today's session"
          accessibilityHint="Shares your time and exercise and set counts"
        >
          <SymbolView name="square.and.arrow.up" size={13} tintColor={colors.textSecondary} />
          <Text style={styles.shareText} maxFontSizeMultiplier={1.2}>
            Share
          </Text>
        </Pressable>
      </ReanimatedAnimated.View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    // Same 325 column and label treatment as the feedback/note sections
    // below it on the done screen.
    section: {
      marginTop: 24,
      width: 325,
    },
    sectionLabel: {
      marginBottom: 8,
      color: colors.textTertiary,
      fontSize: Type.micro,
      letterSpacing: 0.4,
      fontFamily: 'Geist-Medium',
    },
    card: {
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    statsRow: {
      flexDirection: 'row',
      paddingVertical: 14,
      paddingHorizontal: 8,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      color: colors.text,
      fontSize: Type.stat,
      fontFamily: 'Geist-SemiBold',
      ...TabularNums,
    },
    statLabel: {
      marginTop: 2,
      color: colors.textTertiary,
      fontSize: Type.micro,
      letterSpacing: 0.4,
      fontFamily: 'Geist-Medium',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.surfaceDivider,
    },
    rowName: {
      flex: 1,
      color: colors.text,
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    rowDetail: {
      maxWidth: '55%',
      color: colors.textSecondary,
      fontSize: Type.secondary,
      textAlign: 'right',
      fontFamily: 'Geist-Regular',
      ...TabularNums,
    },
    shareWrap: {
      marginTop: 10,
      alignItems: 'center',
    },
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minHeight: 32,
      paddingHorizontal: 12,
    },
    shareText: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Medium',
    },
  });
}
