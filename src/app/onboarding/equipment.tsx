import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCanvasScale } from '@/lib/canvas-scale';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';

import { PRESSED_DIM, useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { MOTION_DURATION, MOTION_EASING } from '@/lib/motion';
import { goBack } from '@/lib/onboarding-nav';
import {
  DEFAULT_OWNED_EQUIPMENT,
  OWNED_EQUIPMENT,
  OWNED_EQUIPMENT_LABELS,
  asksForEquipment,
  parseOwnedEquipment,
  serializeOwnedEquipment,
  type OwnedEquipment,
} from '@/lib/owned-equipment';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { AndroidRippleOnAccent, Type } from '@/constants/theme';
import { useAppTheme } from '@/lib/theme-context';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { BackArrowGraphic } from '@/components/auth/verify-email-graphics';
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress';
import { SymbolView } from '@/components/ui/app-symbol';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

/**
 * Step 4's follow-up, only for a home gym or minimal setup: what's actually
 * there, so the plan never asks for kit that isn't (see
 * lib/owned-equipment.ts and engine/equipment-requirements.ts). A full gym
 * has everything and bodyweight-only has nothing, so those go straight on
 * to step 5. Starts with the setup's usual kit ticked — one tap to confirm
 * for most people — and "none of these" is a real answer, not a blocked
 * Continue.
 */
export default function OnboardingEquipmentScreen() {
  const scale = useCanvasScale();
  const { colors, resolvedScheme } = useAppTheme();
  const washColor = resolvedScheme === 'dark' ? '#ffffff' : '#000000';
  const styles = useMemo(() => createStyles(colors, washColor), [colors, washColor]);

  const { name, goal, experience, environment, verifiedEmail, equipment } = useLocalSearchParams<{
    name?: string;
    goal?: string;
    experience?: string;
    environment?: string;
    verifiedEmail?: string;
    equipment?: string;
  }>();

  const baseParams = {
    name: name ?? '',
    goal: goal ?? '',
    experience: experience ?? '',
    environment: environment ?? '',
    verifiedEmail: verifiedEmail ?? '',
  };

  // Coming back here keeps what was ticked; arriving fresh starts from the
  // setup's usual kit.
  const [selected, setSelected] = useState<Set<OwnedEquipment>>(
    () =>
      new Set(
        parseOwnedEquipment(equipment) ?? (asksForEquipment(environment) ? DEFAULT_OWNED_EQUIPMENT[environment] : [])
      )
  );

  const entering = useFadeInEntering();
  const continueHover = useHoverFade();
  const continuePress = useLiquidPress();

  const toggle = (item: OwnedEquipment) => {
    hapticSelect();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const handleContinue = () => {
    hapticImpactLight();
    const params = { ...baseParams, equipment: serializeOwnedEquipment(selected) };
    saveOnboardingDraft({ step: 5, params });
    router.push({ pathname: '/onboarding/step-5', params } as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>

        <OnboardingProgress step={4} settled />

        <Pressable
          style={styles.backButton}
          onPress={() =>
            goBack('/onboarding/step-4', {
              name: baseParams.name,
              goal: baseParams.goal,
              experience: baseParams.experience,
              verifiedEmail: baseParams.verifiedEmail,
            })
          }
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <BackArrowGraphic color={colors.text} />
        </Pressable>

        <View style={styles.logoMark} pointerEvents="none">
          <View style={styles.logoAccent}>
            <LogoMarkAccentGraphic width={41.52} height={52.31} color={colors.text} />
          </View>
          <View style={styles.logoCheck}>
            <LogoMarkGraphic width={31.82} height={44.75} color={colors.text} />
          </View>
        </View>

        <Text style={styles.title} maxFontSizeMultiplier={1.3}>What do you have?</Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
          Your plan only uses what&apos;s ticked. You can change it anytime in Settings.
        </Text>

        <View style={styles.grid}>
          {OWNED_EQUIPMENT.map((item) => {
            const isSelected = selected.has(item);
            return (
              <Pressable
                key={item}
                style={({ pressed }) => [styles.chip, isSelected && styles.chipSelected, pressed && PRESSED_DIM]}
                onPress={() => toggle(item)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={OWNED_EQUIPMENT_LABELS[item]}
              >
                <Text
                  style={[styles.chipText, isSelected && styles.chipTextSelected]}
                  numberOfLines={2}
                  maxFontSizeMultiplier={1.2}
                >
                  {OWNED_EQUIPMENT_LABELS[item]}
                </Text>
                {/* Always laid out so ticking never re-wraps the label. */}
                <View style={styles.checkSlot}>
                  {isSelected ? (
                    <ReanimatedAnimated.View entering={FadeIn.duration(MOTION_DURATION.fast).easing(MOTION_EASING.standard)}>
                      <SymbolView name="checkmark" size={10} tintColor="#438C63" weight="bold" />
                    </ReanimatedAnimated.View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={styles.primaryButtonHit}
          // 38pt tall by design; the slop brings the tap target past 44pt.
          hitSlop={{ top: 6, bottom: 6 }}
          onPress={handleContinue}
          onHoverIn={continueHover.onHoverIn}
          onHoverOut={continueHover.onHoverOut}
          onPressIn={continuePress.onPressIn}
          onPressOut={continuePress.onPressOut}
          android_ripple={AndroidRippleOnAccent}
          accessibilityRole="button"
          accessibilityLabel={selected.size > 0 ? 'Continue' : 'Continue with none of these'}
        >
          <Animated.View style={styles.primaryButtonVisual}>
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.hoverWash,
                { opacity: continueHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.hoverWash,
                { opacity: continuePress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }) },
              ]}
            />
            <Text style={styles.primaryText} maxFontSizeMultiplier={1.15}>
              {selected.size > 0 ? 'Continue' : 'None of these'}
            </Text>
            <View style={styles.buttonArrow}>
              <ArrowUpIconGraphic size={24} />
            </View>
          </Animated.View>
        </Pressable>
      </ReanimatedAnimated.View>
      </View>
    </View>
  );
}

const CARD_RADIUS = 10;
// Sixteen options on the fixed 375×812 canvas: eight rows of 38pt end at
// 612, clear of Continue at 656.
const GRID_GAP = 6;
const CHIP_WIDTH = (343 - GRID_GAP) / 2;

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], washColor: string) {
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
    backButton: {
      position: 'absolute',
      left: 11,
      top: 33,
      width: 27,
      height: 27,
    },
    logoMark: {
      position: 'absolute',
      left: 155.68,
      top: 83,
      width: 65.65,
      height: 58.91,
    },
    logoAccent: {
      position: 'absolute',
      left: 0,
      top: 6.61,
    },
    logoCheck: {
      position: 'absolute',
      left: 33.83,
      top: 0,
    },
    title: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 188,
      paddingHorizontal: 40,
      color: colors.text,
      fontSize: Type.headerTitle,
      lineHeight: 27,
      textAlign: 'center',
      fontFamily: 'Geist-SemiBold',
    },
    subtitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 222,
      paddingHorizontal: 56,
      color: colors.textSecondary,
      fontSize: Type.caption,
      lineHeight: 16.5,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    grid: {
      position: 'absolute',
      left: 16,
      top: 266,
      width: 343,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
    },
    chip: {
      width: CHIP_WIDTH,
      height: 38,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 12,
      paddingRight: 8,
      borderRadius: CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      borderColor: '#438C63',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    chipText: {
      flex: 1,
      color: colors.text,
      fontSize: 11.5,
      lineHeight: 14,
      fontFamily: 'Geist-SemiBold',
    },
    chipTextSelected: {
      color: '#438C63',
    },
    checkSlot: {
      width: 14,
      marginLeft: 6,
      alignItems: 'center',
    },
    primaryButtonHit: {
      position: 'absolute',
      left: 46,
      top: 656,
      width: 285,
      height: 38,
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
    primaryText: {
      color: '#ffffff',
      fontSize: Type.secondary,
      fontFamily: 'Geist-SemiBold',
    },
    buttonArrow: {
      position: 'absolute',
      right: 14,
      top: 6,
      transform: [{ rotate: '90deg' }],
    },
    hoverWash: {
      borderRadius: 6,
      backgroundColor: washColor,
      zIndex: -1,
    },
  });
}
