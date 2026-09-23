import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SymbolView } from '@/components/ui/app-symbol';

import { Type } from '@/constants/theme';
import { MOTION_DURATION, MOTION_EASING } from '@/lib/motion';
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
 * Styled as a quiet, theme-matched pill (the app's own surface/border
 * tokens) rather than an inverted black/white bar — this is ambient status,
 * not an alert, so it should read as part of the app's own chrome in
 * whichever theme is active, not stand out against it. A compact centered
 * pill, not the full-width strip it used to be: that strip sat over every
 * screen's header — its back button and title — for as long as the device
 * was offline. It fades in and out instead of cutting, and only appears
 * once a drop has lasted a couple of seconds (see useIsOffline).
 */
export function OfflineBanner() {
  const isOffline = useIsOffline();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  // VoiceOver users can't see the pill appear — say it once.
  useEffect(() => {
    if (isOffline) AccessibilityInfo.announceForAccessibility("You're offline.");
  }, [isOffline]);

  if (!isOffline) return null;

  return (
    <ReanimatedAnimated.View
      entering={FadeIn.duration(MOTION_DURATION.emphasis).easing(MOTION_EASING.standard)}
      exiting={FadeOut.duration(MOTION_DURATION.base).easing(MOTION_EASING.standard)}
      style={[styles.root, { top: insets.top + 4 }]}
      pointerEvents="none"
    >
      <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <SymbolView name="wifi.slash" size={11} tintColor={colors.textSecondary} />
        <Text style={[styles.text, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
          You&apos;re offline
        </Text>
      </View>
    </ReanimatedAnimated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: Type.caption,
    fontFamily: 'Geist-SemiBold',
  },
});
