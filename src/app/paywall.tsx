import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight, hapticSelect, hapticSuccess } from '@/lib/haptics';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppTheme } from '@/lib/theme-context';
import { getCurrentOffering, purchasePackage, restorePurchases } from '@/lib/purchases';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
  WordmarkTextGraphic,
} from '@/components/auth/create-account-graphics';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

const BENEFITS: { icon: Parameters<typeof SymbolView>[0]['name']; title: string; subtitle: string }[] = [
  {
    icon: 'chart.bar.fill',
    title: 'Training Balance',
    subtitle: 'The full radar shape and movement-pattern breakdown, not just the headline numbers.',
  },
  {
    icon: 'calendar',
    title: 'Consistency calendar',
    subtitle: 'A month-by-month view of every scheduled day, completed or missed.',
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
];

/**
 * VerveIn Plus — presented as a modal (see _layout.tsx's Stack.Screen entry),
 * either automatically after the third real check-in (paywall-trigger.ts) or
 * manually from Settings. The core adaptive engine (check-in, the daily
 * plan, basic history) is never gated here or anywhere else — this screen
 * only ever offers the deeper analytics/insight layer, per the founder's own
 * "core loop free, premium analytics" split.
 */
export default function PaywallScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;
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
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [justPurchased, setJustPurchased] = useState(false);
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
  const selectedTrial = selectedPackage ? trialLabel(selectedPackage) : null;

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
            contentContainerStyle={styles.scrollContent}
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
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
              Your daily check-in and adaptive plan stay free, always. Plus unlocks the deeper view of your own
              training.
            </Text>

            <View style={styles.benefitsCard}>
              {BENEFITS.map((benefit, index) => (
                <View key={benefit.title}>
                  {index > 0 ? <View style={styles.benefitDivider} /> : null}
                  <View style={styles.benefitRow}>
                    <View style={styles.benefitIcon}>
                      <SymbolView name={benefit.icon} size={15} tintColor="#5FBE84" />
                    </View>
                    <View style={styles.benefitText}>
                      <Text style={styles.benefitTitle} maxFontSizeMultiplier={1.3}>{benefit.title}</Text>
                      <Text style={styles.benefitSubtitle} maxFontSizeMultiplier={1.4}>{benefit.subtitle}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

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

            {purchaseError ? (
              <ReanimatedAnimated.Text entering={FadeIn.duration(150)} style={styles.errorText} maxFontSizeMultiplier={1.3}>
                {purchaseError}
              </ReanimatedAnimated.Text>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {/* Only appears when the selected package actually has a free
                trial configured in RevenueCat — never a hardcoded length,
                so this stays correct whatever trial gets set up later. */}
            {selectedTrial ? (
              <Text style={styles.trialText} maxFontSizeMultiplier={1.3}>
                {selectedTrial}, then {selectedPackage?.product.priceString}
              </Text>
            ) : null}
            <Pressable
              style={styles.primaryButtonHit}
              onPress={handlePurchase}
              disabled={!selectedPackage || isPurchasing}
              onHoverIn={ctaHover.onHoverIn}
              onHoverOut={ctaHover.onHoverOut}
              onPressIn={ctaPress.onPressIn}
              onPressOut={ctaPress.onPressOut}
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
                  {isPurchasing ? 'Purchasing…' : selectedTrial ? 'Start Free Trial' : 'Continue'}
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

            <Text style={styles.legalText} maxFontSizeMultiplier={1.4}>
              {'Cancel anytime in Settings. By continuing, you agree to VerveIn’s '}
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
              entering={FadeIn.duration(180)}
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
    headerLockup: {
      flexDirection: 'row',
      alignItems: 'flex-end',
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
      color: '#5FBE84',
      fontSize: 24,
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
    benefitsCard: {
      marginTop: 28,
      width: '100%',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    benefitDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.surfaceDivider,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 14,
    },
    benefitIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(95,190,132,0.14)',
      marginTop: 1,
    },
    benefitText: {
      flex: 1,
    },
    benefitTitle: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    benefitSubtitle: {
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Geist-Regular',
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
      fontSize: 11,
      fontFamily: 'Geist-Medium',
    },
    packagePillLabelActive: {
      color: '#05130b',
      fontFamily: 'Geist-SemiBold',
    },
    packagePillPrice: {
      color: colors.text,
      fontSize: 13,
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
      fontSize: 11,
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
    errorText: {
      marginTop: 18,
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
      fontSize: 12,
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
      fontSize: 12,
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
    successLockup: {
      flexDirection: 'row',
      alignItems: 'flex-end',
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
      color: '#5FBE84',
      fontSize: 24,
      letterSpacing: -0.3,
      fontFamily: 'Geist-Bold',
    },
  });
}
