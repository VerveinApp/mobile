import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight, hapticSuccess } from '@/lib/haptics';
import { getOrCreateReferralCode, redeemReferralCode } from '@/lib/referral';
import { useAppColors } from '@/lib/theme-context';

/**
 * Reached from Settings and from the post-session milestone moment (see
 * check-in.tsx's own comment on why that trigger, not signup, is where a
 * referral ask actually converts). Framed around bringing someone along,
 * not a discount — the reward is a free week of VerveIn Plus for both
 * sides, same as the product itself, not cash or a store coupon.
 */
export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const sharePress = useLiquidPress();
  const redeemPress = useLiquidPress();

  const [loaded, setLoaded] = useState(false);
  const [myCode, setMyCode] = useState<string | null>(null);
  // Distinguishes "not signed in" (an expected state, own message) from "a
  // real failure" (transient DB error, retryable) — collapsing both into a
  // bare null used to tell a signed-in user to do something they'd already
  // done, with no way to recover from a transient failure. See
  // referral.ts's getOrCreateReferralCode doc comment.
  const [codeLoadReason, setCodeLoadReason] = useState<'not-signed-in' | 'error' | null>(null);
  const [redeemInput, setRedeemInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const retryPress = useLiquidPress();

  const loadCode = useCallback(async () => {
    const outcome = await getOrCreateReferralCode();
    if (outcome.ok) {
      setMyCode(outcome.code);
      setCodeLoadReason(null);
    } else {
      setMyCode(null);
      setCodeLoadReason(outcome.reason);
    }
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCode();
    }, [loadCode])
  );

  const handleRetryLoadCode = () => {
    hapticImpactLight();
    loadCode();
  };

  const handleShare = async () => {
    if (!myCode) return;
    hapticImpactLight();
    try {
      await Share.share({
        message: `Train with me on VerveIn — use my code ${myCode} when you join and we both get a free week of VerveIn Plus.`,
      });
    } catch {
      // The share sheet itself failing (or just being dismissed) needs no
      // separate error state — same as paywall.tsx's purchase-cancelled
      // outcome, this is just someone backing out.
    }
  };

  const handleRedeem = async () => {
    const code = redeemInput.trim();
    if (!code || isRedeeming) return;
    setIsRedeeming(true);
    setRedeemMessage(null);
    const outcome = await redeemReferralCode(code);
    setIsRedeeming(false);
    if (outcome.ok) {
      hapticSuccess();
      setRedeemInput('');
      setRedeemMessage({
        text: outcome.rewardGranted
          ? "You're both set — a free week of VerveIn Plus just landed on your account."
          : 'Code accepted — your reward is on its way.',
        kind: 'success',
      });
    } else {
      hapticError();
      setRedeemMessage({ text: outcome.error, kind: 'error' });
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          onHoverIn={backHover.onHoverIn}
          onHoverOut={backHover.onHoverOut}
          hitSlop={10}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>
          Bring a Training Partner
        </Text>
        <View style={styles.backButton} />
      </View>

      {!loaded ? null : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>YOUR CODE</Text>
            {myCode ? (
              <>
                <Text style={styles.introText} maxFontSizeMultiplier={1.4}>
                  Share your code. When a friend joins with it, you both get a free week of VerveIn Plus.
                </Text>
                <View style={styles.codeCard}>
                  <Text style={styles.codeText} maxFontSizeMultiplier={1.2}>{myCode}</Text>
                </View>
                <Pressable
                  onPress={handleShare}
                  onPressIn={sharePress.onPressIn}
                  onPressOut={sharePress.onPressOut}
                  style={styles.shareButtonHit}
                >
                  <View style={styles.shareButton}>
                    <Text style={styles.shareButtonText} maxFontSizeMultiplier={1.15}>Share your code</Text>
                  </View>
                </Pressable>
              </>
            ) : codeLoadReason === 'error' ? (
              <View style={styles.signedOutCard}>
                <Text style={styles.signedOutText} maxFontSizeMultiplier={1.3}>
                  Couldn&apos;t load your referral code. Check your connection and try again.
                </Text>
                <Pressable
                  onPress={handleRetryLoadCode}
                  onPressIn={retryPress.onPressIn}
                  onPressOut={retryPress.onPressOut}
                  style={styles.retryHit}
                >
                  <Text style={styles.retryText} maxFontSizeMultiplier={1.2}>Try again</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.signedOutCard}>
                <Text style={styles.signedOutText} maxFontSizeMultiplier={1.3}>
                  Sign in to get your referral code.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>HAVE A CODE?</Text>
            <View style={styles.redeemRow}>
              <TextInput
                style={styles.redeemInput}
                placeholder="Enter a friend's code"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                value={redeemInput}
                onChangeText={setRedeemInput}
                maxLength={6}
              />
              <Pressable
                onPress={handleRedeem}
                onPressIn={redeemPress.onPressIn}
                onPressOut={redeemPress.onPressOut}
                disabled={!redeemInput.trim() || isRedeeming}
                style={styles.redeemButtonHit}
              >
                <View
                  style={[styles.redeemButton, (!redeemInput.trim() || isRedeeming) && styles.redeemButtonDisabled]}
                >
                  <Text style={styles.redeemButtonText} maxFontSizeMultiplier={1.15}>
                    {isRedeeming ? '…' : 'Redeem'}
                  </Text>
                </View>
              </Pressable>
            </View>
            {redeemMessage ? (
              <Text
                style={[styles.redeemMessage, redeemMessage.kind === 'error' && styles.redeemMessageError]}
                maxFontSizeMultiplier={1.3}
              >
                {redeemMessage.text}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: colors.text,
      fontSize: 16,
      fontFamily: 'Geist-SemiBold',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      gap: 28,
    },
    section: {
      gap: 12,
    },
    sectionKicker: {
      color: colors.textTertiary,
      fontSize: 11,
      letterSpacing: 1,
      fontFamily: 'Geist-SemiBold',
    },
    introText: {
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: 'Geist-Regular',
    },
    codeCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingVertical: 22,
      alignItems: 'center',
    },
    codeText: {
      color: colors.text,
      fontSize: 28,
      letterSpacing: 6,
      fontFamily: 'Geist-Bold',
    },
    shareButtonHit: {
      width: '100%',
    },
    shareButton: {
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: '#438C63',
      alignItems: 'center',
    },
    shareButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
    signedOutCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 16,
    },
    signedOutText: {
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: 'Geist-Regular',
    },
    retryHit: {
      marginTop: 12,
      alignSelf: 'flex-start',
    },
    retryText: {
      color: '#438C63',
      fontSize: 12.5,
      fontFamily: 'Geist-SemiBold',
    },
    redeemRow: {
      flexDirection: 'row',
      gap: 10,
    },
    redeemInput: {
      flex: 1,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.text,
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
      letterSpacing: 2,
    },
    redeemButtonHit: {},
    redeemButton: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: '#438C63',
      alignItems: 'center',
      justifyContent: 'center',
    },
    redeemButtonDisabled: {
      opacity: 0.5,
    },
    redeemButtonText: {
      color: '#ffffff',
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    redeemMessage: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: 'Geist-Regular',
    },
    redeemMessageError: {
      color: '#e5484d',
    },
  });
}
