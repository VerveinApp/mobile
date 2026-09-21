import { router } from 'expo-router';
import { useMemo } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AndroidRaisedElevation, AndroidRipple, Type } from '@/constants/theme';
import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { useAppColors } from '@/lib/theme-context';
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
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = () => {
    hapticImpactLight();
    router.push('/home/check-in' as never);
  };

  if (isRestDay) {
    return (
      <View style={styles.card}>
        <View pointerEvents="none" style={styles.cardSheen} />
        <Text style={styles.cardKicker} maxFontSizeMultiplier={1.2}>TODAY</Text>
        <Text style={styles.cardTitle} maxFontSizeMultiplier={1.2}>Rest Day</Text>
        <Text style={styles.cardMeta} maxFontSizeMultiplier={1.3}>Recovery is part of the plan.</Text>
        <Pressable
          onPress={handlePress}
          onHoverIn={hover.onHoverIn}
          onHoverOut={hover.onHoverOut}
          android_ripple={AndroidRipple}
        >
          <Text style={styles.cardLinkText} maxFontSizeMultiplier={1.2}>Check in anyway</Text>
        </Pressable>
      </View>
    );
  }

  const resolved = todaySession !== null;

  return (
    <Pressable
      onPress={handlePress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      android_ripple={AndroidRipple}
    >
      <Animated.View style={[styles.card, { transform: [{ scale: press.scale }] }]}>
        <View pointerEvents="none" style={styles.cardSheen} />
        <Text style={styles.cardKicker} maxFontSizeMultiplier={1.2}>TODAY</Text>
        <Text style={styles.cardTitle} maxFontSizeMultiplier={1.2}>{sessionLabel}</Text>
        <Text style={styles.cardMeta} maxFontSizeMultiplier={1.3}>
          {resolved ? '' : 'Est. '}
          {exerciseCount} exercises · {durationMin} min
        </Text>
        {resolved && explanation ? (
          <Text style={styles.cardReason} maxFontSizeMultiplier={1.4}>{explanation}</Text>
        ) : null}
        <Text style={styles.cardLinkText} maxFontSizeMultiplier={1.2}>
          {resolved ? 'Continue session' : 'Check in & start'} →
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
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
    cardSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '55%',
      backgroundColor: colors.surfaceSheen,
    },
    cardKicker: {
      // Brand green — deliberately fixed across both themes, same as every
      // other accent usage in this app, not a theme token.
      color: '#5FBE84',
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
      color: '#5FBE84',
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
