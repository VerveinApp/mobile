import { router, Stack, useLocalSearchParams, useNavigation, useRoute } from 'expo-router';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import ReanimatedAnimated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  useReducedMotion,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';

import { SymbolView } from '@/components/ui/app-symbol';
import { SkeletonBlock } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/ui/sparkline';
import { SuccessCheckmark } from '@/components/onboarding/success-checkmark';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
  WordmarkTextGraphic,
} from '@/components/auth/create-account-graphics';
import { AndroidRippleOnAccent, TabularNums, Type } from '@/constants/theme';
import { PRESSED_DIM, useDisabledScrimStyle, useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { LIST_ROW_ENTERING, LIST_ROW_EXITING, LIST_ROW_LAYOUT, MOTION_DURATION } from '@/lib/motion';
import { useIsOffline } from '@/lib/network-status';
import { isPlusFeature, PLUS_FEATURES } from '@/lib/plus-features';
import {
  getIntroOfferEligibility,
  loadPlans,
  purchasePackage,
  restorePurchases,
  type PlansFailure,
} from '@/lib/purchases';
import {
  annualSavings,
  billingPeriod,
  buyLabel,
  packageLabel,
  planCaption,
  plansFailureMessage,
  priceWithPeriod,
  renewalDisclosure,
  trialLabel,
} from '@/lib/paywall-plans';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme-context';
import { getLoggedSessionCount } from '@/lib/workout-log';

type Colors = ReturnType<typeof useAppTheme>['colors'];
type Styles = ReturnType<typeof createStyles>;

// Liquid Glass is reserved for the moments that matter — the EnergyGauge
// dial, account creation, entering the app, and this one: deciding to pay.
// Here it carries the Buy button, the close button, and the selected plan.
const isGlassAvailable = isLiquidGlassAvailable();

/** A failure can come back in the same frame (RevenueCat not configured, a
 * cached error); the loading state holds at least this long so a retry
 * visibly does something instead of blinking straight back to the error. */
const MIN_LOADING_MS = 400;
/** Plans that arrive faster than this (RevenueCat's in-memory cache on a
 * repeat open) just appear — no loading→loaded crossfade for a state
 * nobody saw. */
const REVEAL_ANIMATION_AFTER_MS = 150;
/** A network or App Store hiccup the device didn't register as offline
 * retries on its own this many times, this far apart, then waits for
 * "Try again". */
const AUTO_RETRY_DELAYS_MS = [3000, 10000];
const GENERIC_DISCLOSURE =
  'Plans renew automatically unless canceled at least 24 hours before the current period ends — manage or cancel anytime in your Apple ID subscription settings.';

const BRAND_GREEN = '#5FBE84';

type PlansState =
  | { kind: 'loading' }
  | { kind: 'ready'; packages: PurchasesPackage[]; eligibility: Record<string, boolean> }
  | { kind: 'failed'; reason: PlansFailure };

type Notice = { tone: 'error' | 'info'; text: string };

/**
 * VerveIn Plus — presented as a page sheet (see _layout.tsx), either
 * automatically after the third check-in (paywall-trigger.ts) or from any
 * locked feature, which passes its `feature` so that row leads the list
 * (plus-features.ts). The core loop — the daily check-in and the plan it
 * builds — is never gated; Plus is the charts, history and coaching on top.
 *
 * Laid out at the device's real size, not the fixed 375×812 canvas most
 * screens scale: this is the app's only sheet, and a canvas scaled to the
 * window overflowed the shorter sheet — about 29pt cut off top and bottom
 * on a Pro Max (clipping the close button and pushing the legal links onto
 * the home indicator), bitmap-scaled text on big phones, and 8pt fine print
 * on an SE.
 */
export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { colors, resolvedScheme } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(colors, resolvedScheme === 'dark'), [colors, resolvedScheme]);
  const params = useLocalSearchParams<{ feature?: string }>();
  const highlightedFeature = isPlusFeature(params.feature) ? params.feature : null;
  const isOffline = useIsOffline();
  const navigation = useNavigation();
  const route = useRoute();
  const { height: windowHeight, fontScale } = useWindowDimensions();
  // A short phone at a large text size: the full renewal terms move into
  // the scroll (right under the plans) and the header tightens — otherwise
  // the pinned footer alone pushes the plan picker below the fold.
  const compact = windowHeight < 700 && fontScale > 1.15;

  const ctaHover = useHoverFade();
  const ctaPress = useLiquidPress();

  const [plans, setPlans] = useState<PlansState>({ kind: 'loading' });
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [success, setSuccess] = useState<'purchased' | 'restored' | null>(null);
  const [animateReveal, setAnimateReveal] = useState(false);
  const busy = isPurchasing || isRestoring || success !== null;

  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // handlePurchase/handleRestore await network calls, then act on the
  // result. If the sheet closed meanwhile (the X is disabled while busy, but
  // the system can still dismiss it), a late success used to arm a
  // router.back() on an unmounted screen that popped whatever the user had
  // navigated to since. Checked after every await below.
  const isMountedRef = useRef(true);
  // Only the latest load may write state — a slow first attempt must not
  // overwrite the result of a retry that finished before it.
  const loadSeqRef = useRef(0);
  const plansKindRef = useRef<PlansState['kind']>('loading');
  const announceFailureRef = useRef(false);
  const autoRetriesRef = useRef(0);
  const isOfflineRef = useRef(isOffline);

  useEffect(() => {
    // Set here, not only by the ref's initial value: an effect re-run (Fast
    // Refresh, StrictMode's double mount) runs the cleanup below first, and
    // a ref left false would make every later load discard its result.
    isMountedRef.current = true;
    const revealTimer = setTimeout(() => setAnimateReveal(true), REVEAL_ANIMATION_AFTER_MS);
    return () => {
      isMountedRef.current = false;
      clearTimeout(revealTimer);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    plansKindRef.current = plans.kind;
  }, [plans.kind]);
  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

  const loadOffering = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const startedAt = Date.now();
    setPlans({ kind: 'loading' });
    const result = await loadPlans();
    // Trial eligibility is read before anything is shown and lands in the
    // same batch as the prices, so the button never flips from "Subscribe"
    // to "Start free trial" a beat after they appear.
    const eligibility =
      result.kind === 'ready' ? await getIntroOfferEligibility(result.packages.map((p) => p.product.identifier)) : {};
    const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
    if (result.kind === 'failed' && remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    if (seq !== loadSeqRef.current || !isMountedRef.current) return;
    if (result.kind === 'failed') {
      setPlans({ kind: 'failed', reason: result.reason });
      if (announceFailureRef.current) {
        AccessibilityInfo.announceForAccessibility(plansFailureMessage(result.reason, isOfflineRef.current));
      }
      announceFailureRef.current = false;
      return;
    }
    autoRetriesRef.current = 0;
    setPlans({ kind: 'ready', packages: result.packages, eligibility });
    // Starts on the plan whose free trial this Apple ID can actually get,
    // wherever the trial lives in App Store Connect; with none, on yearly.
    setSelectedPackage(
      result.packages.find((p) => eligibility[p.product.identifier] && trialLabel(p) !== null) ??
        result.packages.find((p) => p.packageType === 'ANNUAL') ??
        result.packages[0]
    );
  }, []);

  useEffect(() => {
    // Deferred a microtask: loadOffering sets state before its first await,
    // which react-hooks/set-state-in-effect flags inside an effect body.
    queueMicrotask(() => {
      loadOffering();
    });
  }, [loadOffering]);

  // A failed load retries itself when the connection comes back, when the
  // app returns to the foreground (someone who went to fix their Wi-Fi), and
  // — for a network or App Store hiccup the device itself never registered
  // as offline (a sub-2s drop, a timeout on a weak gym signal) — a couple of
  // times on a backoff, instead of leaving it all to a manual "Try again".
  useEffect(() => {
    if (isOffline) return;
    queueMicrotask(() => {
      if (plansKindRef.current === 'failed') loadOffering();
    });
  }, [isOffline, loadOffering]);
  const failedReason = plans.kind === 'failed' ? plans.reason : null;
  useEffect(() => {
    if (isOffline || (failedReason !== 'offline' && failedReason !== 'store')) return;
    const attempt = autoRetriesRef.current;
    if (attempt >= AUTO_RETRY_DELAYS_MS.length) return;
    const timer = setTimeout(() => {
      autoRetriesRef.current = attempt + 1;
      loadOffering();
    }, AUTO_RETRY_DELAYS_MS[attempt]);
    return () => clearTimeout(timer);
  }, [failedReason, isOffline, loadOffering]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && plansKindRef.current === 'failed') loadOffering();
    });
    return () => sub.remove();
  }, [loadOffering]);

  const [loggedSessionCount, setLoggedSessionCount] = useState<number | null>(null);
  useEffect(() => {
    getLoggedSessionCount().then(setLoggedSessionCount);
  }, []);

  // Closes THIS sheet, whatever sits above it. An untargeted router.back()
  // pops the top route — which, if anything had been opened from here while
  // a restore ran, left the paywall under a success overlay with no way out.
  // With nothing underneath (a cold-start deep link), goes Home instead.
  const closeSelf = () => {
    const state = navigation.getState();
    if (state && state.routes.findIndex((r) => r.key === route.key) > 0) {
      navigation.dispatch({ type: 'POP', payload: { count: 1 }, source: route.key, target: state.key });
    } else {
      router.replace('/');
    }
  };

  const handleClose = () => {
    if (busy) return;
    hapticImpactLight();
    closeSelf();
  };

  const handleRetry = () => {
    hapticImpactLight();
    announceFailureRef.current = true;
    autoRetriesRef.current = 0;
    loadOffering();
  };

  const handleSelectPackage = (pkg: PurchasesPackage) => {
    if (busy || selectedPackage?.identifier === pkg.identifier) return;
    hapticSelect();
    setSelectedPackage(pkg);
    if (notice) setNotice(null);
  };

  const showSuccess = (kind: 'purchased' | 'restored') => {
    // SuccessCheckmark plays the success haptic itself as the check lands.
    setSuccess(kind);
    AccessibilityInfo.announceForAccessibility(kind === 'purchased' ? 'VerveIn Plus unlocked' : 'Purchases restored');
    closeTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) closeSelf();
    }, reducedMotion ? 900 : 1500);
  };

  const showNotice = (next: Notice) => {
    if (next.tone === 'error') hapticError();
    setNotice(next);
    AccessibilityInfo.announceForAccessibility(next.text);
  };

  const handlePurchase = async () => {
    if (!selectedPackage || busy) return;
    setIsPurchasing(true);
    setNotice(null);
    // A purchase needs a real account to attach the entitlement to — this
    // screen is unreachable signed out ((tabs)/_layout.tsx's session guard),
    // so reaching here means that guard was bypassed. Fail loudly rather
    // than let StoreKit run and orphan the purchase on an anonymous ID.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!isMountedRef.current) return;
    if (!session) {
      setIsPurchasing(false);
      showNotice({ tone: 'error', text: 'Sign in to your account before purchasing VerveIn Plus.' });
      return;
    }
    const outcome = await purchasePackage(selectedPackage);
    if (!isMountedRef.current) return;
    setIsPurchasing(false);
    if (outcome.kind === 'purchased') showSuccess('purchased');
    else if (outcome.kind === 'error') showNotice({ tone: 'error', text: outcome.message });
    // 'cancelled' — backing out of Apple's sheet is the most common outcome
    // by far and not an error: nothing to say.
  };

  const handleRestore = async () => {
    if (busy) return;
    hapticImpactLight();
    setIsRestoring(true);
    setNotice(null);
    // Same as handlePurchase — restoring signed out would attach the
    // entitlement to RevenueCat's anonymous device ID, not the account.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!isMountedRef.current) return;
    if (!session) {
      setIsRestoring(false);
      showNotice({ tone: 'error', text: 'Sign in to your account before restoring purchases.' });
      return;
    }
    const outcome = await restorePurchases();
    if (!isMountedRef.current) return;
    setIsRestoring(false);
    if (outcome.kind === 'restored') showSuccess('restored');
    // Finding nothing to restore is an answer, not a failure.
    else if (outcome.kind === 'none') showNotice({ tone: 'info', text: 'No VerveIn Plus purchase found for this Apple ID.' });
    else showNotice({ tone: 'error', text: outcome.message });
  };

  const readyPackages = plans.kind === 'ready' ? plans.packages : [];
  const eligibility = plans.kind === 'ready' ? plans.eligibility : {};
  // trialLabel only says the product HAS an intro offer; eligibility says
  // this Apple ID can still get it — someone who already used a trial must
  // never be shown one (they'd be charged the moment they tapped).
  const trialFor = (pkg: PurchasesPackage) => (eligibility[pkg.product.identifier] ? trialLabel(pkg) : null);
  const selectedTrial = selectedPackage && plans.kind === 'ready' ? trialFor(selectedPackage) : null;
  const savings = annualSavings(readyPackages);

  const ctaMode = plans.kind === 'failed' ? 'retry' : plans.kind === 'loading' ? 'loading' : 'buy';
  const ctaWorking = ctaMode === 'loading' || isPurchasing;
  const ctaDisabled = ctaMode === 'loading' || busy || (ctaMode === 'buy' && !selectedPackage);
  const ctaLabel =
    ctaMode === 'retry'
      ? 'Try again'
      : ctaMode === 'loading'
        ? 'Loading plans…'
        : selectedPackage
          ? buyLabel(selectedPackage, selectedTrial)
          : 'Choose a plan';
  // Working (loading, purchasing) stays full colour with a spinner; only a
  // button that genuinely can't be used dims.
  const ctaScrimStyle = useDisabledScrimStyle(ctaDisabled && !ctaWorking);
  const closeScrimStyle = useDisabledScrimStyle(busy && success === null);

  const orderedFeatures = highlightedFeature
    ? [
        ...PLUS_FEATURES.filter((f) => f.id === highlightedFeature),
        ...PLUS_FEATURES.filter((f) => f.id !== highlightedFeature),
      ]
    : PLUS_FEATURES;

  const errorRed = resolvedScheme === 'dark' ? '#e5484d' : '#CE2C31';
  const disclosure =
    plans.kind === 'ready' && selectedPackage ? renewalDisclosure(selectedPackage, selectedTrial) : GENERIC_DISCLOSURE;
  // The line right above the button: the trial and what it becomes, or — in
  // the compact layout, where the full terms sit in the scroll — the price,
  // period and renewal in one line.
  const footerSummary =
    plans.kind !== 'ready' || !selectedPackage
      ? null
      : selectedTrial
        ? `${selectedTrial}, then ${priceWithPeriod(selectedPackage)}${compact ? ', renews until canceled' : ''}.`
        : !compact
          ? null
          : billingPeriod(selectedPackage)
            ? `${priceWithPeriod(selectedPackage)}, renews automatically until canceled.`
            : `One-time purchase of ${selectedPackage.product.priceString}.`;
  const headerTextScale = compact ? 1.2 : undefined;

  return (
    <View style={styles.root}>
      {/* The sheet can't be swiped away mid-purchase or mid-restore — the X
          is disabled then too, so the result always lands on screen. */}
      <Stack.Screen options={{ gestureEnabled: !busy }} />
      <LayoutAnimationConfig skipEntering>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <View style={styles.header}>
              <PlusLockup scale={0.82} color={colors.text} plusColor={colors.accentText} />
              <Text
                style={styles.headline}
                maxFontSizeMultiplier={headerTextScale ?? 1.4}
                accessibilityRole="header"
                lineBreakStrategyIOS="push-out"
              >
                See what your training adds up to.
              </Text>
              <Text style={styles.subhead} maxFontSizeMultiplier={headerTextScale ?? 1.5} lineBreakStrategyIOS="push-out">
                Strength, consistency and recovery trends, built from the sessions you log.
              </Text>
              <Text style={styles.freeNote} maxFontSizeMultiplier={headerTextScale ?? 1.5}>
                Your check-in and daily plan stay free.
              </Text>
            </View>

            {/* The price area holds one shape through loading → loaded or
                failed: the old version rendered nothing while loading and
                everything below jumped ~100pt when prices landed. Each state
                crossfades over the last while the block springs to its new
                height. */}
            <ReanimatedAnimated.View layout={LIST_ROW_LAYOUT} style={styles.plansSlot}>
              <ReanimatedAnimated.View
                key={plans.kind}
                entering={animateReveal ? LIST_ROW_ENTERING : undefined}
                exiting={animateReveal ? LIST_ROW_EXITING : undefined}
              >
                {plans.kind === 'loading' ? (
                  <View style={styles.planList} accessible accessibilityLabel="Loading plans">
                    <PlanRowPlaceholder styles={styles} />
                    <PlanRowPlaceholder styles={styles} />
                  </View>
                ) : plans.kind === 'failed' ? (
                  <View style={styles.noticeCard} accessibilityRole="alert">
                    <SymbolView
                      name={isOffline || plans.reason === 'offline' ? 'wifi.slash' : 'exclamationmark.circle'}
                      size={18}
                      tintColor={colors.iconMuted}
                    />
                    <Text style={styles.noticeCardText} maxFontSizeMultiplier={1.5}>
                      {plansFailureMessage(plans.reason, isOffline)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.planList} accessibilityRole="radiogroup">
                    {plans.packages.map((pkg) => (
                      <PlanRow
                        key={pkg.identifier}
                        pkg={pkg}
                        caption={planCaption(pkg, trialFor(pkg), savings)}
                        active={selectedPackage?.identifier === pkg.identifier}
                        disabled={busy}
                        onPress={() => handleSelectPackage(pkg)}
                        styles={styles}
                        colors={colors}
                        reducedMotion={reducedMotion}
                      />
                    ))}
                  </View>
                )}
              </ReanimatedAnimated.View>
            </ReanimatedAnimated.View>

            {compact ? (
              <ReanimatedAnimated.View layout={LIST_ROW_LAYOUT}>
                <Text style={[styles.disclosureText, styles.disclosureInScroll]} maxFontSizeMultiplier={1.5}>
                  {disclosure}
                </Text>
              </ReanimatedAnimated.View>
            ) : null}

            <ReanimatedAnimated.View layout={LIST_ROW_LAYOUT} style={styles.section}>
              <PreviewCard loggedSessionCount={loggedSessionCount} styles={styles} colors={colors} />
            </ReanimatedAnimated.View>

            <ReanimatedAnimated.View layout={LIST_ROW_LAYOUT} style={[styles.section, styles.featureCard]}>
              {orderedFeatures.map((feature, index) => {
                const highlighted = feature.id === highlightedFeature;
                return (
                  <View key={feature.id}>
                    {index > 0 ? <View style={styles.featureDivider} /> : null}
                    <View
                      style={[styles.featureRow, highlighted && styles.featureRowHighlighted]}
                      accessible
                      accessibilityLabel={`${feature.title}. ${feature.detail}`}
                    >
                      <View style={styles.featureIcon}>
                        <SymbolView name={feature.icon} size={15} weight="semibold" tintColor={BRAND_GREEN} />
                      </View>
                      <View style={styles.featureText}>
                        <Text
                          style={[styles.featureTitle, highlighted && styles.featureTitleHighlighted]}
                          maxFontSizeMultiplier={1.5}
                        >
                          {feature.title}
                        </Text>
                        <Text style={styles.featureDetail} maxFontSizeMultiplier={1.5}>
                          {feature.detail}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ReanimatedAnimated.View>

            {/* Grounded in something true about this engine (see
                policy-orchestration.ts's "surfacing, not hiding" comment),
                not a generic trust badge — moved out of the footer, where it
                sat between the price and the Buy button. */}
            <ReanimatedAnimated.View layout={LIST_ROW_LAYOUT}>
              <Text style={styles.trustText} maxFontSizeMultiplier={1.5}>
                No black box — every chart and plan change traces back to something you logged or told VerveIn.
              </Text>
            </ReanimatedAnimated.View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Content scrolls behind this pinned footer; the fade says "more
              below" instead of cutting rows off in a hard line. Both stops
              share the page colour's RGB so light mode doesn't band grey. */}
          <View pointerEvents="none" style={styles.scrollFade} />
          <View style={styles.column}>
            {notice ? (
              // Entering only: the footer is pinned to the bottom, so a line
              // leaving it shifts everything up and a fading copy would sit
              // on top of the terms below it.
              <ReanimatedAnimated.Text
                key={notice.text}
                entering={LIST_ROW_ENTERING}
                style={[styles.noticeText, notice.tone === 'error' && { color: errorRed }]}
                maxFontSizeMultiplier={1.3}
              >
                {notice.text}
              </ReanimatedAnimated.Text>
            ) : null}
            {footerSummary ? (
              <ReanimatedAnimated.Text
                key={footerSummary}
                entering={LIST_ROW_ENTERING}
                style={styles.trialText}
                maxFontSizeMultiplier={1.3}
              >
                {footerSummary}
              </ReanimatedAnimated.Text>
            ) : null}
            {/* Apple 3.1.2 and the California/Illinois auto-renewal laws want
                the terms right at the point of purchase: price, period, that
                it renews, and how to cancel. Above the button (not below) so
                a plan switch changes its length without moving the button
                under someone's thumb. */}
            {compact ? null : (
              <Text style={styles.disclosureText} maxFontSizeMultiplier={1.3}>
                {disclosure}
              </Text>
            )}

            <Pressable
              style={styles.ctaHit}
              onPress={ctaMode === 'retry' ? handleRetry : handlePurchase}
              disabled={ctaDisabled}
              onHoverIn={ctaHover.onHoverIn}
              onHoverOut={ctaHover.onHoverOut}
              onPressIn={ctaPress.onPressIn}
              onPressOut={ctaPress.onPressOut}
              android_ripple={AndroidRippleOnAccent}
              accessibilityRole="button"
              accessibilityLabel={ctaLabel}
              accessibilityState={{ disabled: ctaDisabled, busy: ctaWorking }}
            >
              <View style={[styles.ctaVisual, isGlassAvailable && styles.ctaVisualGlass]}>
                {/* Interactive glass: it answers the finger itself (the
                    liquid press), so nothing above it takes the touch. */}
                {isGlassAvailable ? (
                  <GlassView
                    glassEffectStyle="regular"
                    tintColor="#1c3d29"
                    isInteractive
                    // Disabling the Pressable only stops the JS responder;
                    // without this the glass still bounces under a finger on
                    // a button that won't do anything.
                    pointerEvents={ctaDisabled ? 'none' : 'auto'}
                    style={[StyleSheet.absoluteFill, styles.behindContent, styles.ctaRadius]}
                  />
                ) : (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      styles.ctaWash,
                      styles.behindContent,
                      { opacity: ctaPress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }) },
                    ]}
                  />
                )}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    styles.ctaWash,
                    styles.behindContent,
                    { opacity: ctaHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) },
                  ]}
                />
                <View pointerEvents="none" style={styles.ctaLabelSlot}>
                  <ReanimatedAnimated.Text
                    key={ctaLabel}
                    entering={FadeIn.duration(MOTION_DURATION.fast)}
                    exiting={FadeOut.duration(100)}
                    style={styles.ctaText}
                    numberOfLines={1}
                    // "Subscribe for $49.99/year" is longer than the old label:
                    // shrink a little on a narrow phone at a large text size
                    // (or with a long local price) rather than cut the price off.
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    maxFontSizeMultiplier={1.3}
                  >
                    {ctaLabel}
                  </ReanimatedAnimated.Text>
                </View>
                <View pointerEvents="none" style={styles.ctaAccessory}>
                  {ctaWorking ? (
                    <ReanimatedAnimated.View key="working" entering={FadeIn.duration(MOTION_DURATION.fast)}>
                      <ActivityIndicator size="small" color="#ffffff" />
                    </ReanimatedAnimated.View>
                  ) : ctaMode === 'retry' ? (
                    <ReanimatedAnimated.View key="retry" entering={FadeIn.duration(MOTION_DURATION.fast)}>
                      <SymbolView name="arrow.clockwise" size={16} weight="semibold" tintColor="#ffffff" />
                    </ReanimatedAnimated.View>
                  ) : !ctaDisabled ? (
                    <ReanimatedAnimated.View
                      key="arrow"
                      entering={FadeIn.duration(MOTION_DURATION.fast)}
                      style={styles.ctaArrow}
                    >
                      <ArrowUpIconGraphic size={24} />
                    </ReanimatedAnimated.View>
                  ) : null}
                </View>
                {/* The disabled dim as a fading scrim, never an opacity on the
                    GlassView's ancestors (which must not fade). */}
                <ReanimatedAnimated.View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, styles.ctaRadius, styles.scrim, ctaScrimStyle]}
                />
              </View>
            </Pressable>

            <View style={styles.linksRow}>
              <Pressable
                onPress={handleRestore}
                disabled={busy}
                style={({ pressed }) => [styles.linkHit, pressed && PRESSED_DIM]}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy: isRestoring }}
              >
                <ReanimatedAnimated.Text
                  key={isRestoring ? 'restoring' : 'restore'}
                  entering={FadeIn.duration(MOTION_DURATION.fast)}
                  exiting={FadeOut.duration(100)}
                  style={styles.linkText}
                  maxFontSizeMultiplier={1.3}
                >
                  {isRestoring ? 'Restoring…' : 'Restore purchases'}
                </ReanimatedAnimated.Text>
              </Pressable>
              <Text style={styles.linkDot} maxFontSizeMultiplier={1.3} accessible={false}>
                ·
              </Text>
              <Pressable
                onPress={() => router.push('/legal/terms' as never)}
                // Nothing opens on top of the sheet while a purchase or
                // restore is resolving — its success closes this sheet.
                disabled={busy}
                style={({ pressed }) => [styles.linkHit, pressed && PRESSED_DIM]}
                accessibilityRole="link"
              >
                <Text style={styles.linkText} maxFontSizeMultiplier={1.3}>Terms</Text>
              </Pressable>
              <Text style={styles.linkDot} maxFontSizeMultiplier={1.3} accessible={false}>
                ·
              </Text>
              <Pressable
                onPress={() => router.push('/legal/privacy' as never)}
                disabled={busy}
                style={({ pressed }) => [styles.linkHit, pressed && PRESSED_DIM]}
                accessibilityRole="link"
              >
                <Text style={styles.linkText} maxFontSizeMultiplier={1.3}>Privacy</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Top-left, the iOS sheet's own dismiss side, in the sheet's
            coordinates — inside its rounded corner, where the old scaled
            canvas used to clip it. */}
        <Pressable
          style={styles.closeHit}
          onPress={handleClose}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
          accessibilityState={{ disabled: busy }}
        >
          {({ pressed }) => (
            <View style={[styles.closeVisual, !isGlassAvailable && pressed && PRESSED_DIM]}>
              {isGlassAvailable ? (
                <GlassView
                  glassEffectStyle="regular"
                  isInteractive
                  pointerEvents={busy ? 'none' : 'auto'}
                  style={[StyleSheet.absoluteFill, styles.closeRadius]}
                />
              ) : null}
              <View pointerEvents="none" style={styles.closeGlyph}>
                <SymbolView name="xmark" size={14} weight="semibold" tintColor={colors.text} />
              </View>
              <ReanimatedAnimated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, styles.closeRadius, styles.scrim, closeScrimStyle]}
              />
            </View>
          )}
        </Pressable>

        {success ? (
          <ReanimatedAnimated.View
            entering={FadeIn.duration(MOTION_DURATION.base)}
            style={[StyleSheet.absoluteFill, styles.successOverlay]}
            accessibilityViewIsModal
          >
            <SuccessCheckmark size={72} />
            <View style={styles.successLockup}>
              <PlusLockup scale={1} color={colors.text} plusColor={colors.accentText} />
            </View>
            <Text style={styles.successText} maxFontSizeMultiplier={1.4}>
              {success === 'purchased' ? "You're on VerveIn Plus." : 'Purchases restored.'}
            </Text>
          </ReanimatedAnimated.View>
        ) : null}
      </LayoutAnimationConfig>
    </View>
  );
}

/**
 * The "VerveIn Plus" lockup — the icon, wordmark and "Plus" — sized by
 * `scale` from welcome.tsx's pixel-diffed Figma measurements rather than
 * transform-scaled (which would bitmap-scale the text). "Plus" is set in
 * the wordmark's own family, a step lighter than it, so it reads as part of
 * the name instead of a tag bolted on.
 */
function PlusLockup({ scale, color, plusColor }: { scale: number; color: string; plusColor: string }) {
  const s = scale;
  return (
    <View style={lockupStyles.row} accessible accessibilityRole="image" accessibilityLabel="VerveIn Plus">
      <View
        style={{ width: 56.45 * s, height: 50.79 * s, marginBottom: 10.29 * s, flexDirection: 'row', alignItems: 'flex-end' }}
        pointerEvents="none"
      >
        <View style={{ position: 'absolute', left: 0, top: 5.66 * s }}>
          <LogoMarkAccentGraphic width={35.8156 * s} height={45.1325 * s} color={color} />
        </View>
        <View style={{ position: 'absolute', left: 29.18 * s, top: 0 }}>
          <LogoMarkGraphic width={27.2695 * s} height={38.3516 * s} color={color} />
        </View>
      </View>
      <View style={{ marginLeft: -16.16 * s }}>
        <WordmarkTextGraphic height={27.25 * s} color={color} />
      </View>
      <Text
        style={[lockupStyles.plus, { color: plusColor, fontSize: 28.5 * s, marginLeft: 7 * s }]}
        maxFontSizeMultiplier={1}
      >
        Plus
      </Text>
    </View>
  );
}

const lockupStyles = StyleSheet.create({
  // 'baseline' aligns "Plus" with the wordmark's real text baseline; the
  // icon (no text baseline) falls back to its bottom edge, which its own
  // marginBottom already lands on that baseline.
  row: { flexDirection: 'row', alignItems: 'baseline' },
  plus: { fontFamily: 'Geist-SemiBold', letterSpacing: -0.5 },
});

function PlanRow({
  pkg,
  caption,
  active,
  disabled,
  onPress,
  styles,
  colors,
  reducedMotion,
}: {
  pkg: PurchasesPackage;
  caption: string | null;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  styles: Styles;
  colors: Colors;
  reducedMotion: boolean;
}) {
  const period = billingPeriod(pkg);
  // UIKit installs a GlassView's first style without animation, and the row
  // list fades in when plans arrive — so the selected row's glass starts at
  // 'none' and switches on once the fade is done, which runs the system's
  // animated materialize instead of the glass just appearing.
  const [glassLive, setGlassLive] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setGlassLive(true), MOTION_DURATION.base + 30);
    return () => clearTimeout(timer);
  }, []);
  const transition = {
    transitionProperty: ['borderColor', 'backgroundColor'],
    transitionDuration: reducedMotion ? 0 : MOTION_DURATION.base,
    transitionTimingFunction: 'ease-out' as const,
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled }}
      accessibilityLabel={`${packageLabel(pkg)}, ${pkg.product.priceString}${period ? ` per ${period}` : ''}${caption ? `. ${caption}` : ''}`}
    >
      {({ pressed }) => (
      <ReanimatedAnimated.View
        style={[
          styles.planRow,
          active && (isGlassAvailable ? styles.planRowActiveGlass : styles.planRowActive),
          transition,
        ]}
      >
        {/* The selected plan's glass materializes as it's chosen and melts
            away from the one it leaves — the system's own liquid
            transition, animated by UIKit. */}
        {isGlassAvailable ? (
          <GlassView
            pointerEvents="none"
            glassEffectStyle={{ style: active && glassLive ? 'regular' : 'none', animate: true, animationDuration: 0.35 }}
            tintColor="rgba(95,190,132,0.22)"
            style={[StyleSheet.absoluteFill, styles.planRowRadius]}
          />
        ) : null}
        {/* Touch-down feedback as a wash over the row, not an opacity dim —
            opacity on a GlassView's ancestor breaks the glass. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.planRowRadius, pressed && styles.planRowPressed]} />
        <View style={styles.radioSlot}>
          {active ? (
            <ReanimatedAnimated.View
              key="on"
              entering={ZoomIn.springify().duration(300).dampingRatio(0.7)}
              exiting={FadeOut.duration(100)}
            >
              <SymbolView name="checkmark.circle.fill" size={22} tintColor={BRAND_GREEN} />
            </ReanimatedAnimated.View>
          ) : (
            <ReanimatedAnimated.View key="off" entering={FadeIn.duration(MOTION_DURATION.fast)} style={styles.radioRing} />
          )}
        </View>
        <View style={styles.planText}>
          <Text style={styles.planLabel} maxFontSizeMultiplier={1.4}>
            {packageLabel(pkg)}
          </Text>
          {caption ? (
            <Text style={styles.planCaption} maxFontSizeMultiplier={1.4}>
              {caption}
            </Text>
          ) : null}
        </View>
        <View style={styles.planPriceBlock}>
          <Text style={styles.planPrice} maxFontSizeMultiplier={1.4}>
            {pkg.product.priceString}
          </Text>
          {period ? (
            <Text style={styles.planPeriod} maxFontSizeMultiplier={1.4}>
              {`/${period}`}
            </Text>
          ) : null}
        </View>
      </ReanimatedAnimated.View>
      )}
    </Pressable>
  );
}

function PlanRowPlaceholder({ styles }: { styles: Styles }) {
  return (
    <View style={styles.planRow}>
      <View style={styles.radioSlot}>
        <View style={styles.radioRing} />
      </View>
      <View style={styles.planText}>
        <SkeletonBlock width={72} height={13} />
        <SkeletonBlock width={116} height={10} style={{ marginTop: 7 }} />
      </View>
      <SkeletonBlock width={64} height={15} />
    </View>
  );
}

// Clearly labelled example data: the page sells charts, so it shows one —
// not the person's own (that's the Plus feature itself), and never dressed
// up as theirs.
const EXAMPLE_STRENGTH = [100, 101, 103, 102, 105, 107, 106, 109, 112, 111, 114, 117].map((value) => ({ value }));
const EXAMPLE_WEEKS: boolean[][] = [
  [true, false, true, false, true, false, false],
  [true, false, true, false, false, true, false],
  [true, false, true, false, true, false, false],
  [true, true, false, false, true, false, true],
];
const GRID_CELL = 9;
const GRID_GAP = 3;
const GRID_WIDTH = 7 * GRID_CELL + 6 * GRID_GAP;

function PreviewCard({
  loggedSessionCount,
  styles,
  colors,
}: {
  loggedSessionCount: number | null;
  styles: Styles;
  colors: Colors;
}) {
  const [width, setWidth] = useState(0);
  const sparkWidth = Math.max(0, width - 32 - GRID_WIDTH - 20);
  // Honest about which chart fills in from what: every logged session lands
  // on the calendar, but a strength trend needs weights logged on a lift —
  // most people's Strength Progress starts empty (see progress.tsx).
  const caption =
    loggedSessionCount !== null && loggedSessionCount > 0
      ? `You've logged ${loggedSessionCount} session${loggedSessionCount === 1 ? '' : 's'} — ${loggedSessionCount === 1 ? 'it lands' : 'they land'} on your consistency calendar. Strength trends appear once you log weights on a lift.`
      : 'Every session you log lands on your consistency calendar. Strength trends appear once you log weights on a lift.';
  return (
    <View
      style={styles.previewCard}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Example charts: a rising strength trend and a four-week consistency calendar. ${caption}`}
    >
      <View style={styles.previewHeader}>
        <Text style={styles.previewEyebrow} maxFontSizeMultiplier={1.3}>
          STRENGTH · CONSISTENCY
        </Text>
        <Text style={styles.previewTag} maxFontSizeMultiplier={1.3}>
          Example
        </Text>
      </View>
      <View style={styles.previewCharts}>
        <View style={styles.previewSpark}>
          {sparkWidth > 0 ? <Sparkline data={EXAMPLE_STRENGTH} width={sparkWidth} height={52} color={BRAND_GREEN} filled /> : null}
        </View>
        <View style={styles.previewGrid}>
          {EXAMPLE_WEEKS.map((week, w) => (
            <View key={w} style={styles.previewGridRow}>
              {week.map((done, d) => (
                <View
                  key={d}
                  style={[styles.previewGridCell, { backgroundColor: done ? BRAND_GREEN : colors.backgroundSelected }]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.previewCaption} maxFontSizeMultiplier={1.5}>
        {caption}
      </Text>
    </View>
  );
}

function createStyles(colors: Colors, isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 64,
      paddingHorizontal: 20,
      paddingBottom: 28,
    },
    // Still clears the 36pt close button at top 14.
    scrollContentCompact: {
      paddingTop: 56,
    },
    // Phones use the full width; anything wider keeps a readable column.
    column: {
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    header: {
      alignItems: 'center',
    },
    headline: {
      marginTop: 18,
      color: colors.text,
      fontSize: Type.heading,
      lineHeight: 28,
      letterSpacing: -0.3,
      textAlign: 'center',
      fontFamily: 'Geist-SemiBold',
    },
    subhead: {
      marginTop: 8,
      color: colors.textSecondary,
      fontSize: 14.5,
      lineHeight: 20,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
      paddingHorizontal: 4,
    },
    freeNote: {
      marginTop: 6,
      color: colors.textTertiary,
      fontSize: Type.body,
      lineHeight: 18,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    plansSlot: {
      marginTop: 24,
    },
    section: {
      marginTop: 16,
    },
    planList: {
      gap: 10,
    },
    planRowRadius: {
      borderRadius: 16,
    },
    planRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 16,
      // 1.5 in every state, so selecting never shifts the layout.
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    planRowActive: {
      borderColor: BRAND_GREEN,
      backgroundColor: isDark ? 'rgba(95,190,132,0.10)' : 'rgba(95,190,132,0.08)',
    },
    planRowActiveGlass: {
      borderColor: BRAND_GREEN,
    },
    planRowPressed: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    radioSlot: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioRing: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.textQuaternary,
    },
    planText: {
      flex: 1,
    },
    planLabel: {
      color: colors.text,
      fontSize: 15,
      fontFamily: 'Geist-SemiBold',
    },
    planCaption: {
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: Type.secondary,
      lineHeight: 16,
      fontFamily: 'Geist-Regular',
    },
    planPriceBlock: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    planPrice: {
      color: colors.text,
      fontSize: 17,
      fontFamily: 'Geist-SemiBold',
      ...TabularNums,
    },
    planPeriod: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Regular',
    },
    noticeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 64,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    noticeCardText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: Type.body,
      lineHeight: 18,
      fontFamily: 'Geist-Regular',
    },
    previewCard: {
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    previewEyebrow: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      letterSpacing: 0.6,
      fontFamily: 'Geist-Medium',
    },
    previewTag: {
      color: colors.textSecondary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: colors.badgeBg,
    },
    previewCharts: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 20,
    },
    previewSpark: {
      flex: 1,
      height: 52,
      justifyContent: 'flex-end',
    },
    previewGrid: {
      width: GRID_WIDTH,
      gap: GRID_GAP,
    },
    previewGridRow: {
      flexDirection: 'row',
      gap: GRID_GAP,
    },
    previewGridCell: {
      width: GRID_CELL,
      height: GRID_CELL,
      borderRadius: 2.5,
    },
    previewCaption: {
      marginTop: 12,
      color: colors.textSecondary,
      fontSize: Type.secondary,
      lineHeight: 16.5,
      fontFamily: 'Geist-Regular',
    },
    featureCard: {
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 12,
    },
    featureRowHighlighted: {
      backgroundColor: isDark ? 'rgba(95,190,132,0.10)' : 'rgba(95,190,132,0.08)',
    },
    featureIcon: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(95,190,132,0.14)',
    },
    featureText: {
      flex: 1,
    },
    featureTitle: {
      color: colors.text,
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-SemiBold',
    },
    featureTitleHighlighted: {
      color: colors.accentText,
    },
    featureDetail: {
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: Type.secondary,
      lineHeight: 16,
      fontFamily: 'Geist-Regular',
    },
    // Inset past the icon tile, like an iOS inset-grouped list.
    featureDivider: {
      marginLeft: 58,
      marginRight: 8,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.surfaceDivider,
    },
    trustText: {
      marginTop: 16,
      color: colors.textSecondary,
      fontSize: Type.secondary,
      lineHeight: 16.5,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
      paddingHorizontal: 12,
    },
    footer: {
      paddingTop: 10,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
    },
    scrollFade: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: -28,
      height: 28,
      experimental_backgroundImage: `linear-gradient(180deg, ${colors.background}00 0%, ${colors.background} 100%)`,
    },
    noticeText: {
      marginBottom: 8,
      color: colors.textSecondary,
      fontSize: Type.body,
      lineHeight: 18,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    trialText: {
      marginBottom: 6,
      color: colors.text,
      fontSize: Type.body,
      lineHeight: 18,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    disclosureText: {
      marginBottom: 12,
      color: colors.textSecondary,
      fontSize: Type.caption,
      lineHeight: 15,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    disclosureInScroll: {
      marginTop: 12,
      marginBottom: 0,
      paddingHorizontal: 4,
    },
    ctaHit: {
      width: '100%',
      minHeight: 50,
    },
    ctaRadius: {
      borderRadius: 12,
    },
    ctaVisual: {
      minHeight: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      backgroundColor: '#29563a',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 48,
    },
    ctaVisualGlass: {
      backgroundColor: 'rgba(41,86,58,0.4)',
      borderWidth: 0,
    },
    behindContent: {
      zIndex: -1,
    },
    ctaWash: {
      borderRadius: 12,
      backgroundColor: isDark ? '#ffffff' : '#000000',
    },
    ctaLabelSlot: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: {
      color: '#ffffff',
      fontSize: 16,
      fontFamily: 'Geist-SemiBold',
    },
    ctaAccessory: {
      position: 'absolute',
      right: 16,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    ctaArrow: {
      transform: [{ rotate: '90deg' }],
    },
    scrim: {
      backgroundColor: colors.background,
    },
    linksRow: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    linkHit: {
      minHeight: 44,
      paddingHorizontal: 6,
      justifyContent: 'center',
    },
    linkText: {
      color: colors.textSecondary,
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    linkDot: {
      color: colors.textQuaternary,
      fontSize: Type.body,
    },
    closeHit: {
      position: 'absolute',
      top: 14,
      left: 16,
      zIndex: 1,
    },
    closeRadius: {
      borderRadius: 18,
    },
    closeVisual: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isGlassAvailable ? 'transparent' : colors.backgroundSelected,
    },
    closeGlyph: {
      opacity: 0.8,
    },
    successOverlay: {
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      // Above the close button (zIndex 1), which would otherwise draw over it.
      zIndex: 2,
    },
    successLockup: {
      marginTop: 24,
    },
    successText: {
      marginTop: 10,
      color: colors.textSecondary,
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-Regular',
    },
  });
}
