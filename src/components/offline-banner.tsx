import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';

import { Type } from '@/constants/theme';
import { useIsOffline } from '@/lib/network-status';
import { useAppTheme } from '@/lib/theme-context';

/**
 * Global, read-only awareness — not a retry/queue mechanism. This app has
 * no offline queue anywhere (check-in, calibration, session history are all
 * local-first AsyncStorage and work fine offline already); what actually
 * breaks without a connection is the handful of real network calls
 * (Supabase auth/OTP, Apple/Google sign-in, RevenueCat, the referral Edge
 * Function) — those already surface their own real error messages when a
 * request fails, this banner just answers the "wait, why did that just
 * fail?" question honestly instead of leaving a generic error with no
 * context. Rendered once, at the app root, above the navigator, so it's
 * visible regardless of which screen is showing.
 *
 * Styled as a quiet, theme-matched strip (the app's own surface/border
 * tokens) rather than an inverted black/white bar — this is ambient status,
 * not an alert, so it should read as part of the app's own chrome in
 * whichever theme is active, not stand out against it.
 */
export function OfflineBanner() {
  const isOffline = useIsOffline();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  if (!isOffline) return null;

  return (
    <View
      style={[
        styles.root,
        { top: insets.top, backgroundColor: colors.surface, borderBottomColor: colors.surfaceBorder },
      ]}
      pointerEvents="none"
    >
      <Text style={[styles.text, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
        You&apos;re offline — some features may not work.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    paddingVertical: 6,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: Type.caption,
    fontFamily: 'Geist-SemiBold',
  },
});
