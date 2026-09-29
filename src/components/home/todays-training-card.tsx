import { router } from 'expo-router';
import { useMemo } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { SymbolView } from '@/components/ui/app-symbol';
import { AndroidRaisedElevation, AndroidRipple, Type, sheenGradient } from '@/constants/theme';
import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { useAppTheme } from '@/lib/theme-context';
import type { TodaySession } from '@/lib/today-session';

/**
 * Shared between Summary (the dashboard's own preview) and Train (the
 * tab whose whole job is launching this) — same card, same behavior,
 * extracted so the two never drift apart visually.
 */
export function TodaysTrainingCard({
  isRestDay,
  todaySession,
  sessionLabel,
  exerciseCount,
  durationMin,
  explanation,
}: {
  isRestDay: boolean;
  todaySession: TodaySession | null;
  sessionLabel: string;
  exerciseCount: number;
  durationMin: number;
  /** Why today's count/duration is what it is — only real once a session is
   * actually resolved (an energy check-in happened), never shown for the
   * pre-check-in baseline-4 estimate, since that reasoning isn't real yet. */
  explanation?: string;
}) {
  const press = useLiquidPress();
  const hover = useHoverFade();
  // BUG FIX (found in a later full-app audit): every style below was
  // hardcoded to exactly match Colors.dark's own token values — this card
  // never read the real theme at all, so it rendered as a solid near-black
  // island with white text inside an otherwise light-themed screen in
  // light mode. The literal hex match to Colors.dark rules out "deliberately
  // always dark" as the explanation.
  const { colors, resolvedScheme } = useAppTheme();
  const isDark = resolvedScheme === 'dark';
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const handlePress = () => {
    hapticImpactLight();
    router.push('/home/check-in' as never);
  };
  // The rest-day link has already asked "check in anyway?" — check-in skips
  // its own rest-day screen instead of asking again.
  const handleCheckInAnyway = () => {
    hapticImpactLight();
    router.push('/home/check-in?anyway=1' as never);
  };

  if (isRestDay) {
    return (
      <View style={styles.card}>
        <View pointerEvents="none" style={styles.cardSheen} />
        <Text style={styles.cardKicker} maxFontSizeMultiplier={1.2}>TODAY</Text>
        <Text style={styles.cardTitle} maxFontSizeMultiplier={1.2}>Rest Day</Text>
        <Text style={styles.cardMeta} maxFontSizeMultiplier={1.3}>Recovery is part of the plan.</Text>
        <Pressable
          onPress={handleCheckInAnyway}
          onHoverIn={hover.onHoverIn}
          onHoverOut={hover.onHoverOut}
          android_ripple={AndroidRipple}
          hitSlop={12}
          style={({ pressed }) => [styles.restLinkHit, pressed && styles.linkPressed]}
          accessibilityRole="button"
          accessibilityLabel="Check in anyway"
        >
          <Text style={styles.cardLinkText} maxFontSizeMultiplier={1.2}>Check in anyway</Text>
        </Pressable>
      </View>
    );
  }

  const resolved = todaySession !== null;
  // BUG FIX: a finished day read exactly like an unfinished one — "Continue
  // session →" — because resolved only means "checked in today", and a
  // completed session is still a checked-in one.
  const completed = todaySession?.completed === true;
  const actionLabel = completed ? 'View summary' : resolved ? 'Continue session' : 'Check in & start';

  return (
    <Pressable
      onPress={handlePress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      android_ripple={AndroidRipple}
      accessibilityRole="button"
      accessibilityLabel={
        completed
          ? `${sessionLabel}. Done for today. View summary.`
          : `${sessionLabel}. ${resolved ? '' : 'Estimated '}${exerciseCount} exercises, ${durationMin} minutes. ${actionLabel}.`
      }
    >
      <View style={styles.card}>
        <View pointerEvents="none" style={styles.cardSheen} />
        {/* The press glow useLiquidPress already animates — this card used
            to wire up the handlers but only ever applied press.scale (pinned
            at 1), so the app's main CTA gave no visual response to a tap. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.pressWash,
            { opacity: press.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
          ]}
        />
        <Text style={styles.cardKicker} maxFontSizeMultiplier={1.2}>TODAY</Text>
        <Text style={styles.cardTitle} maxFontSizeMultiplier={1.2}>{sessionLabel}</Text>
        {completed ? (
          <View style={styles.doneRow}>
            <SymbolView name="checkmark.circle.fill" size={14} tintColor="#5FBE84" />
            <Text style={[styles.cardMeta, styles.doneText]} maxFontSizeMultiplier={1.3}>Done for today</Text>
          </View>
        ) : (
          <Text style={styles.cardMeta} maxFontSizeMultiplier={1.3}>
            {resolved ? '' : 'Est. '}
            {exerciseCount} exercises · {durationMin} min
          </Text>
        )}
        {resolved && explanation ? (
          <Text style={styles.cardReason} maxFontSizeMultiplier={1.4}>{explanation}</Text>
        ) : null}
        <Text style={styles.cardLinkText} maxFontSizeMultiplier={1.2}>
          {actionLabel} →
        </Text>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    card: {
      padding: 20,
      borderRadius: Platform.OS === 'android' ? 24 : 20,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...(Platform.OS === 'android'
        ? AndroidRaisedElevation
        : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceBorder }),
    },
    pressWash: {
      // Low-alpha wash of the text color — reads as a subtle press
      // highlight on both the near-black dark card and the white light one.
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    },
    doneRow: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    doneText: {
      marginTop: 0,
    },
    restLinkHit: {
      alignSelf: 'flex-start',
    },
    linkPressed: {
      opacity: 0.6,
    },
    cardSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '55%',
      ...sheenGradient(colors.surfaceSheen),
    },
    cardKicker: {
      // Brand green, but see Colors.light.accentText's own comment — this
      // IS a theme token (unlike the background/icon-tint brand-green
      // literal used elsewhere), specifically because green TEXT needed a
      // darker light-mode shade to clear WCAG AA contrast.
      color: colors.accentText,
      fontSize: Type.micro,
      letterSpacing: 1,
      fontFamily: 'Geist-SemiBold',
    },
    cardTitle: {
      marginTop: 6,
      color: colors.text,
      fontSize: Type.headerTitle,
      letterSpacing: -0.2,
      fontFamily: 'Geist-Bold',
    },
    cardMeta: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    cardReason: {
      marginTop: 8,
      color: colors.textTertiary,
      fontSize: Type.caption,
      lineHeight: 16,
      fontFamily: 'Geist-Regular',
    },
    cardLinkText: {
      marginTop: 14,
      color: colors.accentText,
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
