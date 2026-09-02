import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useHoverFade } from '@/lib/button-interactions';
import { hapticSelect } from '@/lib/haptics';
import { useAppTheme } from '@/lib/theme-context';

/**
 * Wraps a Plus-only section (Progress tab's Training Balance radar and
 * consistency calendar, so far) with a locked teaser in its place when the
 * user isn't subscribed — never hides the section outright, so someone can
 * always see what they'd get, matching this app's own "never a silent
 * adjustment" discipline applied to monetization: gating a feature away
 * with no trace of it existing reads as broken, not as an upsell.
 *
 * `isPremium === null` (the entitlement check is still in flight) renders
 * nothing rather than a flash of the locked state — usePremiumEntitlement's
 * own doc comment explains why that distinction exists.
 */
export function PremiumGate({
  isPremium,
  label,
  style,
  children,
}: {
  isPremium: boolean | null;
  /** What's behind the lock, e.g. "Training Balance" — used in the teaser's own copy. */
  label: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const hover = useHoverFade();

  if (isPremium === null) return null;
  if (isPremium) return <>{children}</>;

  return (
    <Pressable
      style={[styles.card, style]}
      onPress={() => {
        hapticSelect();
        router.push('/paywall' as never);
      }}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      accessibilityRole="button"
      accessibilityLabel={`${label} is part of VerveIn Plus. Tap to see what's included.`}
    >
      <View style={styles.iconWrap}>
        <SymbolView name="lock.fill" size={15} tintColor="#5FBE84" />
      </View>
      <Text style={styles.title} maxFontSizeMultiplier={1.3}>{label} is part of VerveIn Plus</Text>
      <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>Tap to see what&apos;s included.</Text>
    </Pressable>
  );
}

function useStyles() {
  const { colors } = useAppTheme();
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingVertical: 28,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(95,190,132,0.14)',
      marginBottom: 10,
    },
    title: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 11.5,
      fontFamily: 'Geist-Regular',
      textAlign: 'center',
    },
  });
}
