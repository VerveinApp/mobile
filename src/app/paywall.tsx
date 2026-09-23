import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useCanvasScale } from '@/lib/canvas-scale';
import ReanimatedAnimated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight, hapticSelect, hapticSuccess } from '@/lib/haptics';
import { MOTION_DURATION } from '@/lib/motion';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { AndroidCardElevation, AndroidRipple, AndroidRippleOnAccent, Type } from '@/constants/theme';
import { useAppTheme } from '@/lib/theme-context';
import { getCurrentOffering, getIntroOfferEligibility, purchasePackage, restorePurchases } from '@/lib/purchases';
import { supabase } from '@/lib/supabase';
import { getLoggedSessionCount } from '@/lib/workout-log';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
  WordmarkTextGraphic,
} from '@/components/auth/create-account-graphics';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

// Every real Plus-gated feature in the app, not aspirational copy — cross-
// checked against every PremiumGate/isPremium call site (progress.tsx's
// consistency calendar, training balance, and strength progress; check-
// in.tsx's symptom tracking, HealthKit-aware readiness trim, and coaching/
// plan-fit notes; settings/index.tsx's own whole-DATA-section gate; log.tsx's
// whole-screen gate; profile.tsx's Goals gate). Re-verified against a fresh
// grep of every PremiumGate/isPremium call site — Goals and Symptom tracking
// were both real, shipped gates missing from this list; the old Sleep &
// Nutrition entry described a narrower inner gate than the outer DATA-section
// gate that actually applies. Don't let this list drift from the code again —
// grep for PremiumGate before trusting it's still complete.
const BENEFITS: { icon: Parameters<typeof SymbolView>[0]['name']; title: string; subtitle: string }[] = [
  {
    icon: 'chart.bar.fill',
    title: 'Training Balance',
    subtitle: 'The full radar shape and movement-pattern breakdown, not just the headline numbers.',
  },
  {
    icon: 'calendar',
    title: 'Consistency calendar',
    // Loss-framed on purpose: the free tier already shows a real 4-week
    // completion number (Progress's own summary card) — the calendar GRID
    // is what's actually locked. "You already have X, Plus reveals Y" reads
    // as recovering something real rather than being sold a new feature,
    // since the number really is already visible one tap away.
    subtitle: "You already see your 4-week completion number — Plus is where you see which days actually made it up.",
  },
  {
    icon: 'arrow.up.right',
    title: 'Strength Progress',
    subtitle: 'Real 1RM improvements and relative-strength tracking, exercise by exercise.',
  },
  {
    icon: 'heart.fill',
    title: 'HealthKit-aware readiness',
    subtitle: "Your plan trims further when your resting heart rate says recovery isn't complete.",
  },
  {
    icon: 'sparkles',
    title: 'Coaching & plan-fit notes',
    subtitle: 'Coaching notes and plan-fit callouts, surfaced only when the pattern is real.',
  },
  {
    icon: 'chart.bar.xaxis',
    title: 'Data & History',
    // BUG FIX: this used to be framed as just "logs older than a week are
    // still there" (a loss-framed nudge for a narrow inner gate on the
    // Sleep/Nutrition screens specifically). settings/index.tsx's own
    // POLICY CHANGE comment shows the whole DATA section — Progress &
    // History, Body Measurements, Condition Log, Progress Photos, Sleep
    // History, and Nutrition History — is now gated as one bundle; a free
    // user can't open any of these six screens at all, not just their
    // older entries. This entry undersold that.
    subtitle: 'Progress & History, body measurements, progress photos, your condition log, and full sleep & nutrition history — all in one place.',
  },
  {
    icon: 'clock.arrow.circlepath',
    title: 'Log',
    // log.tsx's own POLICY CHANGE comment: the whole backfill hub (past
    // session, weigh-in, etc.) is gated behind Plus as a single unit again,
    // not just deeper history — this entry was missing that reversal.
    subtitle: 'Backfill a session you forgot to log, or record a weigh-in for a day that already happened.',
  },
  {
    icon: 'target',
    title: 'Goals',
    // profile.tsx's own PremiumGate label="Goals" — target lift and target
    // weight, each with a real progress ring / trend sparkline, not just a
    // number.
    subtitle: 'Set a target lift and target weight, and watch real progress rings and trend charts track you there.',
  },
  {
    icon: 'bandage.fill',
    title: 'Symptom tracking',
    // check-in.tsx's own PremiumGate label="Symptom tracking" — only
    // surfaced when energy <= 2, so most users won't see this locked often,
    // but it's a real gate and belongs on the list like every other one.
    subtitle: "On a low-energy day, tag what's actually going on — sore, sick, stressed — so today's session can account for it.",
  },
];

/**
 * One card in the benefits pager — its own component (not inlined in a
 * `.map()` inside PaywallScreen) because `useAnimatedStyle` is a hook, and
 * every card needs its own instance tracking its own distance from center.
 * Neighboring cards ease back in scale/opacity as they move off-center —
 * the same "coverflow" language a real swipe reads as fluid, not just a
 * hard cut between pages.
 */
function BenefitCarouselCard({
  benefit,
  index,
  translateX,
  cardWidth,
  styles,
}: {
  benefit: (typeof BENEFITS)[number];
  index: number;
  translateX: SharedValue<number>;
  cardWidth: number;
  styles: ReturnType<typeof createStyles>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(-translateX.value / cardWidth - index);
    return {
      transform: [{ scale: interpolate(distance, [0, 1], [1, 0.92], Extrapolation.CLAMP) }],
      opacity: interpolate(distance, [0, 1], [1, 0.5], Extrapolation.CLAMP),
    };
  });

  return (
    <View style={{ width: cardWidth }}>
      {/* shouldRasterizeIOS: without it, scaling this view's text content
          live (not just a wheel-picker-style plain Text glyph-ghost,
          already avoided above) re-rasterizes the glyphs every frame as the
          scale interpolates, reading as text "glitching" mid-swipe.
          Rasterizing once lets the GPU transform a cached bitmap instead of
          re-drawing text each frame. */}
      <ReanimatedAnimated.View shouldRasterizeIOS style={[styles.benefitCard, animatedStyle]}>
        <View style={styles.benefitCardIcon}>
          <SymbolView name={benefit.icon} size={30} tintColor="#5FBE84" />
        </View>
        <Text style={styles.benefitCardTitle} maxFontSizeMultiplier={1.3}>{benefit.title}</Text>
        <Text style={styles.benefitCardSubtitle} maxFontSizeMultiplier={1.4}>{benefit.subtitle}</Text>
      </ReanimatedAnimated.View>
    </View>
  );
}

/**
 * VerveIn Plus — presented as a modal (see _layout.tsx's Stack.Screen entry),
 * either automatically after the third real check-in (paywall-trigger.ts) or
 * manually from Settings. The core adaptive engine (check-in, the daily
 * plan) is never gated here or anywhere else, per the founder's own "core
 * loop free, premium analytics" split. Basic history (Weight, Notes, Sleep/
 * Nutrition logging, Progress Photos, Body Measurements, Condition Log,
 * backfilling a past session) is free too, from both Settings and log.tsx's
 * hub — only looking back further than the last week (Sleep/Nutrition) and
 * the Progress-tab insight views (Training Balance, Consistency Calendar,
 * Strength Progress) are actually Plus. BUG FIX: this comment (and log.tsx's
 * hub, and Settings' own DATA section) used to claim otherwise — a blanket
 * Plus gate had drifted in ahead of what each screen's own code actually
 * enforces, hiding real free-tier logic behind an outer gate that didn't
 * match it. See log.tsx's and settings/index.tsx's own fix comments.
 */
export default function PaywallScreen() {
  const scale = useCanvasScale();
  const insets = useSafeAreaInsets();
  const { colors, resolvedScheme } = useAppTheme();
  const hoverWashColor = resolvedScheme === 'dark' ? '#ffffff' : '#000000';
  const styles = useMemo(() => createStyles(colors, hoverWashColor), [colors, hoverWashColor]);

  const entering = useFadeInEntering();
  const closeHover = useHoverFade();
  const ctaHover = useHoverFade();
  const ctaPress = useLiquidPress();
  const restoreHover = useHoverFade();

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [offeringLoadFailed, setOfferingLoadFailed] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  // productIdentifier -> can this Apple ID still get the intro offer. Empty
  // (every lookup false) until checked, so a trial is never advertised
  // before eligibility is actually known.
  const [introEligibility, setIntroEligibility] = useState<Record<string, boolean>>({});
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [justPurchased, setJustPurchased] = useState(false);
  const [activeBenefitIndex, setActiveBenefitIndex] = useState(0);
  // Matches scrollContent's own 30px horizontal padding on each side, so a
  // full-width card lines up with everything else on this fixed CANVAS_WIDTH
  // canvas instead of needing its own separate measurement.
  const benefitCardWidth = CANVAS_WIDTH - 60;
  // BUG FIX (found in a later full-app audit): this carousel used to be a
  // real horizontal Animated.ScrollView nested inside this screen's outer
  // vertical ScrollView. That combination — confirmed by stripping every
  // other variable (Animated vs plain, pagingEnabled, onScroll, height,
  // shouldRasterizeIOS, the ancestor canvas's overflow:hidden — none of it
  // was the cause) — silently broke the OUTER ScrollView's ability to
  // render anything after it: benefitDotsRow, personalizedStat, and the
  // entire checklistWrap stopped painting, confirmed both with the real
  // components and with bare hardcoded-size colored Views standing in for
  // them. Nesting any ScrollView inside this one was the actual trigger.
  // Replaced with a gesture-driven pager (same Gesture.Pan + runOnJS +
  // useAnimatedStyle idiom energy-gauge.tsx and before-after-slider.tsx
  // already use) — no nested ScrollView at all, so the outer one measures
  // its content correctly again.
  const benefitTranslateX = useSharedValue(0);
  const benefitDragStartX = useSharedValue(0);
  const setActiveBenefitIndexOnJS = (index: number) => setActiveBenefitIndex(index);
  const benefitPanGesture = useMemo(
    () =>
      Gesture.Pan()
        // Horizontal-only activation — without this, Pan claims any drag
        // that starts within the carousel's bounds, including a mostly-
        // vertical one meant for the outer ScrollView, which then never
        // sees the touch at all. activeOffsetX lets it become the
        // recognized gesture once horizontal movement passes ±10, while
        // failOffsetY hands off to the ScrollView (or whatever's next in
        // the responder chain) the moment vertical movement passes ±10
        // first — same either/or race gesture-handler's own docs recommend
        // for a horizontal control living inside a vertical scroller.
        .activeOffsetX([-10, 10])
        .failOffsetY([-10, 10])
        .onBegin(() => {
          benefitDragStartX.value = benefitTranslateX.value;
        })
        .onUpdate((e) => {
          benefitTranslateX.value = benefitDragStartX.value + e.translationX;
        })
        .onEnd((e) => {
          // Velocity factored in as a bit of extra projected distance, not a
          // separate physics simulation — enough for a fast flick to carry
          // past the halfway point to the next card without needing a real
          // decay curve for what's still a fixed, snap-to-page destination.
          const projected = benefitTranslateX.value + e.velocityX * 0.15;
          const targetIndex = Math.max(
            0,
            Math.min(BENEFITS.length - 1, Math.round(-projected / benefitCardWidth))
          );
          benefitTranslateX.value = withTiming(-targetIndex * benefitCardWidth, {
            duration: 260,
            easing: Easing.out(Easing.cubic),
          });
          runOnJS(setActiveBenefitIndexOnJS)(targetIndex);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [benefitCardWidth]
  );
  const benefitRowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: benefitTranslateX.value }],
  }));
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // BUG FIX: handlePurchase/handleRestore both await a network call, then act
  // on the result (set state, schedule a close, or call router.back()
  // directly). If the screen closes while that call is still in flight —
  // either via handleClose (now also guarded below) or the system back
  // gesture, which handleClose can't intercept — the continuation used to
  // run anyway once the promise resolved: a successful purchase would set
  // justPurchased and arm a 900ms setTimeout(router.back) on an already-
  // unmounted screen, and since the unmount cleanup had already run before
  // that ref assignment ever happened, nothing was left to clear it —
  // 900ms later it fired router.back() again, unexpectedly popping whatever
  // screen the user had since navigated to. Checked before every post-await
  // state update/navigation in both handlers below.
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const loadOffering = useCallback(async () => {
    setOfferingLoadFailed(false);
    const current = await getCurrentOffering();
    setOffering(current);
    setOfferingLoadFailed(current === null);
    // Annual first if available — the honest default for whichever plan
    // is actually the best value, not just "whatever loaded first."
    setSelectedPackage(current?.annual ?? current?.monthly ?? current?.lifetime ?? null);
    const productIds = [current?.monthly, current?.annual, current?.lifetime]
      .filter((p): p is PurchasesPackage => p != null)
      .map((p) => p.product.identifier);
    setIntroEligibility(await getIntroOfferEligibility(productIds));
  }, []);

  useEffect(() => {
    // queueMicrotask: loadOffering's first line (setOfferingLoadFailed)
    // runs synchronously before its first await, which react-hooks/
    // set-state-in-effect flags as a same-tick setState-in-effect (can
    // cascade an extra render). Deferring by a microtask breaks that
    // without changing when the fetch actually starts in practice.
    queueMicrotask(() => {
      loadOffering();
    });
  }, [loadOffering]);

  // Real, this-person's-own number — not a generic claim about "your
  // training." Null while loading (never rendered) and also never rendered
  // at 0: "you've logged 0 sessions" would read as broken or discouraging,
  // not persuasive, and this app doesn't show a stat just to fill space —
  // see getImprovedExercises' own "most people see the empty state" rule
  // in progress.tsx for the same discipline applied here.
  const [loggedSessionCount, setLoggedSessionCount] = useState<number | null>(null);
  useEffect(() => {
    getLoggedSessionCount().then(setLoggedSessionCount);
  }, []);

  const handleClose = () => {
    // The success overlay covers this button visually (see successOverlay's
    // own zIndex comment), but guarding here too means a stray tap can't
    // race the timeout below into a double router.back() call.
    //
    // BUG FIX: also guards isPurchasing/isRestoring, not just justPurchased —
    // closing while either request is still in flight is what let the stray
    // extra router.back() (see isMountedRef's own comment above) happen in
    // the first place. This is the common path (a visible tap on this exact
    // button); isMountedRef is the backstop for the less common one (a
    // system back gesture this button can't intercept).
    if (justPurchased || isPurchasing || isRestoring) return;
    hapticImpactLight();
    if (router.canGoBack()) router.back();
  };

  const handleSelectPackage = (pkg: PurchasesPackage) => {
    hapticSelect();
    setSelectedPackage(pkg);
    if (purchaseError) setPurchaseError(null);
  };

  const handlePurchase = async () => {
    if (!selectedPackage || isPurchasing) return;
    setIsPurchasing(true);
    setPurchaseError(null);
    // A purchase needs a real account to attach the entitlement to — without
    // one there's nothing for RevenueCat to sync Plus status against on a
    // reinstall or a second device, and this screen should be unreachable
    // while signed out anyway (see (tabs)/_layout.tsx's own session guard),
    // so hitting this means that guard was somehow bypassed. Fail loudly
    // here rather than let StoreKit run and silently orphan the purchase.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setIsPurchasing(false);
      hapticError();
      setPurchaseError('Sign in to your account before purchasing VerveIn Plus.');
      return;
    }
    const outcome = await purchasePackage(selectedPackage);
    if (!isMountedRef.current) return;
    setIsPurchasing(false);
    if (outcome.kind === 'purchased') {
      hapticSuccess();
      // A quick, deliberate brand beat before closing — not a lingering
      // celebration screen, just long enough to register "you're in" before
      // the paywall dismisses on its own.
      setJustPurchased(true);
      closeTimeoutRef.current = setTimeout(() => router.back(), 900);
    } else if (outcome.kind === 'error') {
      hapticError();
      setPurchaseError(outcome.message);
    }
    // 'cancelled' — the person just backed out of the system sheet, the
    // most common outcome by far. No error, no haptic, nothing to say.
  };

  const handleRestore = async () => {
    if (isRestoring) return;
    hapticImpactLight();
    setIsRestoring(true);
    // Same reasoning as handlePurchase above — restoring while signed out
    // would reattach RevenueCat's entitlement to the anonymous device ID,
    // not the account, which is exactly the "not linked to their account"
    // gap this whole guard exists to close.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setIsRestoring(false);
      hapticError();
      setPurchaseError('Sign in to your account before restoring purchases.');
      return;
    }
    const outcome = await restorePurchases();
    if (!isMountedRef.current) return;
    setIsRestoring(false);
    if (outcome.kind === 'restored') {
      hapticSuccess();
      router.back();
    } else if (outcome.kind === 'none') {
      hapticError();
      setPurchaseError('No active VerveIn Plus purchase found for this account.');
    } else {
      hapticError();
      setPurchaseError(outcome.message);
    }
  };

  const packages = offering
    ? // Loose inequality deliberately — a package type genuinely absent from
      // the offering (e.g. no Lifetime package configured) comes back as
      // undefined from the SDK at runtime, not the null the TS types
      // declare. `!== null` let undefined slip through into this array,
      // crashing the render below on `pkg.identifier` the first time an
      // offering actually omitted a package type.
      [offering.monthly, offering.annual, offering.lifetime].filter((p): p is PurchasesPackage => p != null)
    : [];
  const savingsText = annualSavingsText(offering?.monthly ?? undefined, offering?.annual ?? undefined);
  // BUG FIX: trialLabel alone only reads whether the product HAS an intro
  // offer, not whether this Apple ID can still get it — someone who already
  // used their trial saw "Start Free Trial" and was charged immediately.
  const selectedTrial =
    selectedPackage && introEligibility[selectedPackage.product.identifier] ? trialLabel(selectedPackage) : null;

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
        <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            onHoverIn={closeHover.onHoverIn}
            onHoverOut={closeHover.onHoverOut}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Animated.View
              style={[
                styles.closeButtonVisual,
                { opacity: closeHover.anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) },
              ]}
            >
              <SymbolView name="xmark" size={13} tintColor={colors.textSecondary} weight="semibold" />
            </Animated.View>
          </Pressable>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerLockup} accessible accessibilityLabel="VerveIn Plus">
              <View style={styles.logoMark} pointerEvents="none">
                <View style={styles.logoAccent}>
                  <LogoMarkAccentGraphic width={35.8156} height={45.1325} color={colors.text} />
                </View>
                <View style={styles.logoCheck}>
                  <LogoMarkGraphic width={27.2695} height={38.3516} color={colors.text} />
                </View>
              </View>
              <View style={styles.headerWordmark}>
                <WordmarkTextGraphic height={27.25} color={colors.text} />
              </View>
              <Text style={styles.headerPlusText} maxFontSizeMultiplier={1.2}>Plus</Text>
            </View>
            {/* Leads with what Plus actually gives you, not just a
                reassurance about what stays free — same honest facts as
                before, just not buried behind the free-tier caveat first.
                The second sentence is now explicit reciprocity, not just a
                caveat: the whole reason the core loop is free first is
                stated outright, not left implicit.
                BUG FIX (found in a later full-app audit, "doesn't look
                compelling" feedback): the original wording described its
                own vagueness ("the deeper view," "insight beyond your daily
                plan") rather than naming an actual thing you get. Naming
                the real screens (strength curve, consistency, recovery)
                does the same honest job with something concrete to picture
                instead of an abstraction. */}
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
              See the real shape behind every session — your strength curve, your consistency, your recovery — not
              just today&apos;s plan. The check-in and adaptive engine stay free, always; Plus is the deeper view
              layered on top.
            </Text>

            {/* Moved above the carousel — price was previously the last
                thing anyone saw after scrolling through every benefit card,
                which reads as buried rather than transparent. */}
            {offeringLoadFailed ? (
              // "try again" rides inline inside errorText (same pattern as
              // legalText's Terms/Privacy links below) rather than as its
              // own block with its own margin — this screen's fixed-height
              // canvas has just enough scrollable room for the normal
              // states; a whole separate line here was tall enough to get
              // clipped by the footer instead of scrolling into view clean.
              <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
                {"Couldn't load pricing right now — check your connection and "}
                <Text
                  style={styles.retryInlineText}
                  onPress={() => {
                    hapticImpactLight();
                    loadOffering();
                  }}
                >
                  try again
                </Text>
                .
              </Text>
            ) : packages.length > 0 ? (
              <View style={styles.packageRow}>
                {packages.map((pkg) => {
                  const active = selectedPackage?.identifier === pkg.identifier;
                  return (
                    <Pressable
                      key={pkg.identifier}
                      style={[styles.packagePill, active && styles.packagePillActive]}
                      onPress={() => handleSelectPackage(pkg)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${packageLabel(pkg)}, ${pkg.product.priceString}`}
                    >
                      <Text
                        style={[styles.packagePillLabel, active && styles.packagePillLabelActive]}
                        maxFontSizeMultiplier={1.2}
                      >
                        {packageLabel(pkg)}
                      </Text>
                      <Text
                        style={[styles.packagePillPrice, active && styles.packagePillPriceActive]}
                        maxFontSizeMultiplier={1.2}
                      >
                        {pkg.product.priceString}
                      </Text>
                      {pkg.packageType === 'ANNUAL' && pkg.product.pricePerMonthString ? (
                        <Text
                          style={[styles.packagePillSubprice, active && styles.packagePillSubpriceActive]}
                          maxFontSizeMultiplier={1.2}
                        >
                          {pkg.product.pricePerMonthString}/mo
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* Plain text, not a boxed badge — matches the app's own
                low-pressure/no-badges direction (see check-in.tsx's
                resolvedEnergyChip comment). Only shown when both packages
                are actually loaded and annual is genuinely cheaper, never a
                guessed number. */}
            {savingsText ? (
              <Text style={styles.savingsText} maxFontSizeMultiplier={1.3}>
                {savingsText}
              </Text>
            ) : null}

            {/* BUG FIX (found in a later full-app audit, "doesn't look
                compelling" feedback): this used to come AFTER the carousel,
                so the first thing anyone saw post-pricing was a single
                benefit card and a lot of empty canvas below it — the full
                value prop was a scroll away. Reordered so the comprehensive,
                all-6-at-once view leads (its own original purpose, per this
                comment's prior home above the old carousel: "guaranteed
                visible without a single swipe" — now also guaranteed
                visible without a scroll). The carousel below is the richer
                per-item deep-dive for anyone who keeps going, not the sole
                way to see what's included. */}
            <View style={styles.checklistWrap}>
              {BENEFITS.map((benefit) => (
                <View key={benefit.title} style={styles.checklistRow}>
                  <SymbolView name={benefit.icon} size={15} tintColor="#5FBE84" />
                  <Text style={styles.checklistLabel} maxFontSizeMultiplier={1.3}>{benefit.title}</Text>
                </View>
              ))}
              {/* Genuinely true, not a filler line: Goals (see profile.tsx's
                  own PremiumGate) and PR celebrations (check-in.tsx) are
                  real Plus features not itemized above — a soft closer
                  gesturing at that rather than a 7th identical-looking
                  claim, muted on purpose so it doesn't read as its own
                  specific promise the way the 6 checked items above do. */}
              <View style={styles.checklistRow}>
                <SymbolView name="plus" size={15} tintColor={colors.textTertiary} />
                <Text style={styles.checklistMoreLabel} maxFontSizeMultiplier={1.3}>& more</Text>
              </View>
            </View>

            <View style={styles.benefitsCarouselWrap}>
              <GestureDetector gesture={benefitPanGesture}>
                <View style={{ width: benefitCardWidth, height: 200, overflow: 'hidden' }}>
                  <ReanimatedAnimated.View style={[{ flexDirection: 'row' }, benefitRowAnimatedStyle]}>
                    {BENEFITS.map((benefit, index) => (
                      <BenefitCarouselCard
                        key={benefit.title}
                        benefit={benefit}
                        index={index}
                        translateX={benefitTranslateX}
                        cardWidth={benefitCardWidth}
                        styles={styles}
                      />
                    ))}
                  </ReanimatedAnimated.View>
                </View>
              </GestureDetector>
              <View style={styles.benefitDotsRow}>
                {BENEFITS.map((benefit, index) => (
                  <View
                    key={benefit.title}
                    style={[styles.benefitDot, index === activeBenefitIndex && styles.benefitDotActive]}
                  />
                ))}
              </View>
            </View>

            {loggedSessionCount !== null && loggedSessionCount > 0 ? (
              <Text style={styles.personalizedStat} maxFontSizeMultiplier={1.3}>
                {`You've logged ${loggedSessionCount} session${loggedSessionCount === 1 ? '' : 's'} — Plus is where you see the full pattern behind ${loggedSessionCount === 1 ? 'it' : 'all of them'}.`}
              </Text>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {/* BUG FIX: this used to render inside the ScrollView, right
                after the checklist — at the bottom of scrollable content the
                fixed Continue button below is reachable without ever
                scrolling to. A purchase failure set purchaseError correctly,
                but the notice itself could render entirely off-screen with
                no visible sign anything went wrong. Living in the fixed
                footer means it's always in view the moment it appears,
                regardless of scroll position. */}
            {purchaseError ? (
              <ReanimatedAnimated.Text entering={FadeIn.duration(MOTION_DURATION.fast)} style={styles.errorText} maxFontSizeMultiplier={1.3}>
                {purchaseError}
              </ReanimatedAnimated.Text>
            ) : null}
            {/* Only appears when the selected package actually has a free
                trial configured in RevenueCat — never a hardcoded length,
                so this stays correct whatever trial gets set up later. */}
            {selectedTrial ? (
              <Text style={styles.trialText} maxFontSizeMultiplier={1.3}>
                {selectedTrial}, then {selectedPackage?.product.priceString}
              </Text>
            ) : null}
            {/* Real authority, not a fake credential — placed right before
                the commit moment on purpose (transparency reduces the
                anxiety that kills conversion right at the point of
                decision), and grounded in something actually true about
                this engine (see policy-orchestration.ts's own "surfacing,
                not hiding" comment) rather than a generic trust badge. */}
            <Text style={styles.trustText} maxFontSizeMultiplier={1.3}>
              No black box — every plan change traces back to something you told it.
            </Text>
            <Pressable
              style={styles.primaryButtonHit}
              onPress={handlePurchase}
              disabled={!selectedPackage || isPurchasing}
              onHoverIn={ctaHover.onHoverIn}
              onHoverOut={ctaHover.onHoverOut}
              onPressIn={ctaPress.onPressIn}
              onPressOut={ctaPress.onPressOut}
              android_ripple={AndroidRippleOnAccent}
            >
              <Animated.View
                style={[
                  styles.primaryButtonVisual,
                  (!selectedPackage || isPurchasing) && styles.primaryButtonDisabled,
                  { transform: [{ scale: ctaPress.scale }] },
                ]}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    styles.hoverWash,
                    { opacity: ctaHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) },
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    styles.hoverWash,
                    { opacity: ctaPress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }) },
                  ]}
                />
                <Text style={styles.primaryText} maxFontSizeMultiplier={1.15}>
                  {isPurchasing ? 'Purchasing…' : selectedTrial ? 'Start Free Trial' : 'Unlock VerveIn Plus'}
                </Text>
                {isPurchasing ? null : (
                  <View style={styles.buttonArrow}>
                    <ArrowUpIconGraphic size={24} />
                  </View>
                )}
              </Animated.View>
            </Pressable>

            <Pressable
              style={styles.restoreHit}
              onPress={handleRestore}
              onHoverIn={restoreHover.onHoverIn}
              onHoverOut={restoreHover.onHoverOut}
              hitSlop={8}
              android_ripple={AndroidRipple}
            >
              <Animated.Text
                style={[
                  styles.restoreText,
                  { opacity: restoreHover.anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                {isRestoring ? 'Restoring…' : 'Restore purchases'}
              </Animated.Text>
            </Pressable>

            {/* Apple 3.1.2 (and California/Illinois auto-renewal laws) want
                the renewal terms spelled out right at the point of purchase:
                price, period, that it renews automatically, and how to
                cancel — the old "Cancel anytime in Settings" named none of
                those (and "Settings" read as the app's own Settings screen,
                which can't cancel an App Store subscription). */}
            <Text style={styles.legalText} maxFontSizeMultiplier={1.4}>
              {selectedPackage ? `${renewalDisclosure(selectedPackage, selectedTrial)} ` : ''}
              {'By continuing, you agree to VerveIn’s '}
              <Text style={styles.legalLink} onPress={() => router.push('/legal/terms' as never)}>
                Terms of Service
              </Text>
              {' and '}
              <Text style={styles.legalLink} onPress={() => router.push('/legal/privacy' as never)}>
                Privacy Policy
              </Text>
              .
            </Text>
          </View>

          {justPurchased ? (
            <ReanimatedAnimated.View
              entering={FadeIn.duration(MOTION_DURATION.base)}
              style={[StyleSheet.absoluteFill, styles.successOverlay]}
            >
              <View style={styles.successLockup}>
                <View style={styles.successLogoBox} pointerEvents="none">
                  <View style={styles.successLogoAccent}>
                    <LogoMarkAccentGraphic width={35.8156} height={45.1325} color={colors.text} />
                  </View>
                  <View style={styles.successLogoCheck}>
                    <LogoMarkGraphic width={27.2695} height={38.3516} color={colors.text} />
                  </View>
                </View>
                <View style={styles.headerWordmark}>
                  <WordmarkTextGraphic height={27.25} color={colors.text} />
                </View>
                <Text style={styles.successPlusText} maxFontSizeMultiplier={1.2}>Plus</Text>
              </View>
            </ReanimatedAnimated.View>
          ) : null}
        </ReanimatedAnimated.View>
      </View>
    </View>
  );
}

const BILLING_PERIOD_BY_PACKAGE_TYPE: Partial<Record<string, string>> = {
  ANNUAL: 'year',
  SIX_MONTH: '6 months',
  THREE_MONTH: '3 months',
  TWO_MONTH: '2 months',
  MONTHLY: 'month',
  WEEKLY: 'week',
};

/**
 * The auto-renewal terms for whichever package is selected — live price and
 * period from the store, never hardcoded. A lifetime package is a one-time
 * purchase and says so instead.
 */
function renewalDisclosure(pkg: PurchasesPackage, trial: string | null): string {
  if (pkg.packageType === 'LIFETIME') return `One-time purchase of ${pkg.product.priceString}.`;
  const period = BILLING_PERIOD_BY_PACKAGE_TYPE[pkg.packageType] ?? 'billing period';
  return (
    `${trial ? `After your ${trial}, ` : ''}${pkg.product.priceString} per ${period}, charged to your Apple ID. ` +
    'Renews automatically unless canceled at least 24 hours before the current period ends — manage or cancel ' +
    'anytime in your Apple ID subscription settings.'
  );
}

function packageLabel(pkg: PurchasesPackage): string {
  if (pkg.packageType === 'ANNUAL') return 'Yearly';
  if (pkg.packageType === 'MONTHLY') return 'Monthly';
  if (pkg.packageType === 'LIFETIME') return 'Lifetime';
  return pkg.product.title;
}

/**
 * Real store-configured intro pricing only — a free trial exists exactly
 * when introPrice.price is 0. Reads entirely off live SDK data rather than
 * a length this code assumes, so whatever trial (or none) gets configured
 * in RevenueCat later displays correctly with no code change here.
 */
function trialLabel(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  return `${intro.periodNumberOfUnits}-${intro.periodUnit.toLowerCase()} free trial`;
}

/**
 * What choosing Yearly over paying Monthly for a year actually saves, in
 * the product's own currency — computed from real prices, never a
 * canned percentage. Null (renders nothing) unless both packages loaded
 * and annual is genuinely cheaper, since a wrong or negative "savings"
 * claim would be worse than the plain price row alone.
 */
function annualSavingsText(monthly: PurchasesPackage | undefined, annual: PurchasesPackage | undefined): string | null {
  if (!monthly || !annual) return null;
  const savings = monthly.product.price * 12 - annual.product.price;
  if (savings <= 0.01) return null;
  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: annual.product.currencyCode,
  }).format(savings);
  return `Yearly saves ${formatted} over paying monthly.`;
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], hoverWashColor: string) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    canvas: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    fadeLayer: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    },
    closeButton: {
      position: 'absolute',
      left: 16,
      top: 20,
      width: 30,
      height: 30,
      zIndex: 1,
    },
    closeButtonVisual: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.pillBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      alignItems: 'center',
      paddingTop: 64,
      paddingHorizontal: 30,
      paddingBottom: 24,
    },
    // Full icon+wordmark+"Plus" lockup — same ground-truth-verified
    // sizing/positioning as onboarding/welcome.tsx's brandRow/iconWrap/
    // brandWordmark (that file's own comments document the pixel-diffing
    // against Figma this is copied from), not a fresh guess. This header
    // used to be icon-only plus a separate text title, replaced to brand
    // "VerveIn Plus" consistently everywhere it appears on this screen.
    // BUG FIX: was alignItems: 'flex-end', which aligns each child by the
    // bottom edge of its own box — fine for the icon (a plain View, already
    // hand-tuned via logoMark's own marginBottom to make its bottom edge
    // land on the wordmark's true baseline) but wrong for headerPlusText: a
    // second, differently-sized Text element has its own different amount
    // of descender space below its own true baseline, so bottom-of-box
    // alignment landed it at a different visual baseline than "VerveIn" —
    // the "tacked on" look. 'baseline' aligns Text children by their real
    // text baseline instead of box edges, which is exactly what two
    // same-row Text elements of different sizes need; a plain View like the
    // icon has no text baseline of its own, so RN falls back to its bottom
    // edge for it, same position it already correctly had.
    headerLockup: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: 20,
    },
    logoMark: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      // Both children below are absolutely positioned, so they don't
      // contribute to this View's own auto-width — without an explicit
      // width here, a centered parent centers a zero-width box, anchoring
      // the logo's left edge at center instead of the logo itself (visually
      // reading as pushed to the right). 56.45 = logoCheck's own left offset
      // (29.18) + its graphic's width (27.2695), the same "second glyph's
      // offset + width" math check-in.tsx's own logoMarkFlow uses for its
      // (larger) version of this same two-glyph mark.
      width: 56.45,
      height: 50.79,
      // Compensates for WordmarkTextGraphic's box height being the full font
      // lineHeight (real descender space below the actual baseline) — see
      // welcome.tsx's own brandRow/iconWrap comment for the full derivation.
      // Without it, flex-end drags the icon's V-point below where the
      // wordmark's letters actually sit.
      marginBottom: 10.29,
    },
    logoAccent: {
      position: 'absolute',
      left: 0,
      top: 5.66,
    },
    logoCheck: {
      position: 'absolute',
      left: 29.18,
      top: 0,
    },
    // -16.16 is welcome.tsx's own ground-truth-tuned gap (pixel-diffed
    // against a real Figma render, not box math — see its brandWordmark
    // comment) between this icon and this exact wordmark glyph.
    headerWordmark: {
      marginLeft: -16.16,
    },
    headerPlusText: {
      marginLeft: 8,
      color: colors.accentText,
      fontSize: Type.display,
      letterSpacing: -0.3,
      fontFamily: 'Geist-Bold',
    },
    subtitle: {
      marginTop: 10,
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
      paddingHorizontal: 8,
    },
    // A horizontal, paged carousel — one feature per card — replacing the
    // old single stacked-list card. Each feature gets its own full-width
    // moment (bigger icon, real breathing room) instead of competing for
    // attention in a shared list, and swiping through five real, distinct
    // benefits reads as a fuller offering than one dense card ever could.
    benefitsCarouselWrap: {
      marginTop: 28,
      alignItems: 'center',
    },
    // BUG FIX: an earlier comment here claimed this was vertically centered
    // ("fixed the mostly-empty-card look"), but the actual justifyContent
    // was never added — the card was still top-anchored the whole time,
    // which is exactly the dead-space-below-the-text look that kept getting
    // reported. Centering here is what that comment always should have done.
    benefitCard: {
      borderRadius: Platform.OS === 'android' ? 24 : 16,
      backgroundColor: colors.surface,
      padding: 20,
      minHeight: 156,
      justifyContent: 'center',
      ...(Platform.OS === 'android'
        ? AndroidCardElevation
        : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceBorder }),
    },
    benefitCardIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(95,190,132,0.14)',
      marginBottom: 14,
    },
    benefitCardTitle: {
      color: colors.text,
      fontSize: 15,
      fontFamily: 'Geist-SemiBold',
    },
    benefitCardSubtitle: {
      marginTop: 6,
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: 'Geist-Regular',
    },
    benefitDotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
    },
    benefitDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceBorder,
    },
    benefitDotActive: {
      width: 16,
      backgroundColor: '#5FBE84',
    },
    personalizedStat: {
      marginTop: 20,
      color: colors.text,
      fontSize: Type.body,
      lineHeight: 19,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    // BUG FIX: bare rows floating directly on the black background read as
    // sparse/unfinished — real content, but with none of the visual weight
    // benefitCard above already has (its own border+surface+padding), which
    // is what actually made the page feel like it ran out of content well
    // before the footer, not a genuine layout gap. Same bordered-card
    // treatment here grounds it into one composed block instead.
    checklistWrap: {
      marginTop: 24,
      width: '100%',
      gap: 14,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 18,
    },
    checklistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    checklistLabel: {
      color: colors.text,
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    checklistMoreLabel: {
      color: colors.textTertiary,
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    packageRow: {
      marginTop: 22,
      width: '100%',
      flexDirection: 'row',
      gap: 10,
    },
    packagePill: {
      flex: 1,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
      backgroundColor: colors.pillBg,
      paddingVertical: 14,
      alignItems: 'center',
      gap: 4,
    },
    packagePillActive: {
      borderColor: '#5FBE84',
      backgroundColor: '#5FBE84',
    },
    packagePillLabel: {
      color: colors.textSecondary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
    },
    packagePillLabelActive: {
      color: '#05130b',
      fontFamily: 'Geist-SemiBold',
    },
    packagePillPrice: {
      color: colors.text,
      fontSize: Type.body,
      fontFamily: 'Geist-Bold',
    },
    packagePillPriceActive: {
      color: '#05130b',
    },
    packagePillSubprice: {
      color: colors.textSecondary,
      fontSize: 10,
      fontFamily: 'Geist-Regular',
    },
    packagePillSubpriceActive: {
      color: '#05130b',
      opacity: 0.7,
    },
    savingsText: {
      marginTop: 10,
      color: colors.textSecondary,
      fontSize: Type.caption,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    trialText: {
      marginBottom: 10,
      color: colors.textSecondary,
      fontSize: 11.5,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    trustText: {
      marginBottom: 10,
      color: colors.textTertiary,
      fontSize: 11.5,
      lineHeight: 15,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    errorText: {
      marginBottom: 12,
      color: '#e5484d',
      fontSize: 11.5,
      lineHeight: 16,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    retryInlineText: {
      color: '#438C63',
      fontFamily: 'Geist-SemiBold',
    },
    footer: {
      paddingHorizontal: 30,
      paddingBottom: 28,
      paddingTop: 8,
      alignItems: 'center',
    },
    primaryButtonHit: {
      width: '100%',
      height: 44,
    },
    primaryButtonVisual: {
      width: '100%',
      height: '100%',
      backgroundColor: '#29563a',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryText: {
      color: '#ffffff',
      fontSize: Type.secondary,
      fontFamily: 'Geist-SemiBold',
    },
    buttonArrow: {
      position: 'absolute',
      right: 14,
      top: 10,
      transform: [{ rotate: '90deg' }],
    },
    hoverWash: {
      borderRadius: 6,
      backgroundColor: hoverWashColor,
      zIndex: -1,
    },
    restoreHit: {
      marginTop: 14,
    },
    restoreText: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
      fontFamily: 'Geist-Medium',
      textDecorationLine: 'underline',
    },
    legalText: {
      marginTop: 16,
      color: colors.textTertiary,
      fontSize: 10,
      lineHeight: 15,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    legalLink: {
      color: '#438C63',
      fontFamily: 'Geist-Medium',
    },
    successOverlay: {
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      // Above closeButton's own zIndex: 1 — siblings under the same parent,
      // and without this the close button (still tappable) would render on
      // top of this full-screen overlay instead of being covered by it.
      zIndex: 2,
    },
    // Same baseline-alignment fix as headerLockup above — see its own comment.
    successLockup: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    // Same ground-truth-verified sizing as headerLockup's logoMark above —
    // see that style's own comment.
    successLogoBox: {
      width: 56.45,
      height: 50.79,
      marginBottom: 10.29,
    },
    successLogoAccent: {
      position: 'absolute',
      left: 0,
      top: 5.66,
    },
    successLogoCheck: {
      position: 'absolute',
      left: 29.18,
      top: 0,
    },
    successPlusText: {
      marginLeft: 8,
      color: colors.accentText,
      fontSize: Type.display,
      letterSpacing: -0.3,
      fontFamily: 'Geist-Bold',
    },
  });
}
