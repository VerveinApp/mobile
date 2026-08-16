import { router } from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
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

  const handlePress = () => {
    hapticImpactLight();
    router.push('/home/check-in' as never);
  };

  if (isRestDay) {
    return (
      <View style={styles.card}>
        <View pointerEvents="none" style={styles.cardSheen} />
        <Text style={styles.cardKicker}>TODAY</Text>
        <Text style={styles.cardTitle}>Rest Day</Text>
        <Text style={styles.cardMeta}>Recovery is part of the plan.</Text>
        <Pressable onPress={handlePress} onHoverIn={hover.onHoverIn} onHoverOut={hover.onHoverOut}>
          <Text style={styles.cardLinkText}>Check in anyway</Text>
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
    >
      <Animated.View style={[styles.card, { transform: [{ scale: press.scale }] }]}>
        <View pointerEvents="none" style={styles.cardSheen} />
        <Text style={styles.cardKicker}>TODAY</Text>
        <Text style={styles.cardTitle}>{sessionLabel}</Text>
        <Text style={styles.cardMeta}>
          {resolved ? '' : 'Est. '}
          {exerciseCount} exercises · {durationMin} min
        </Text>
        {resolved && explanation ? <Text style={styles.cardReason}>{explanation}</Text> : null}
        <Text style={styles.cardLinkText}>{resolved ? 'Continue session' : 'Check in & start'} →</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0C0C0C',
    overflow: 'hidden',
  },
  cardSheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '55%',
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  cardKicker: {
    color: '#5FBE84',
    fontSize: 10.5,
    letterSpacing: 1,
    fontFamily: 'Geist-SemiBold',
  },
  cardTitle: {
    marginTop: 6,
    color: '#ffffff',
    fontSize: 20,
    letterSpacing: -0.2,
    fontFamily: 'Geist-Bold',
  },
  cardMeta: {
    marginTop: 4,
    color: '#9a9a9a',
    fontSize: 13,
    fontFamily: 'Geist-Medium',
  },
  cardReason: {
    marginTop: 8,
    color: '#7a7a7a',
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: 'Geist-Regular',
  },
  cardLinkText: {
    marginTop: 14,
    color: '#5FBE84',
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
  },
});
