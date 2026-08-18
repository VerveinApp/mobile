import { useCallback, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticSelect } from '@/lib/haptics';
import { useAppTheme } from '@/lib/theme-context';

const SELECTION_CONFIRM_MS = 100;

export type SelectableCardOption<T extends string> = {
  id: T;
  label: string;
  /** Second line under the label — omit for the icon-row layout (goal screen style). */
  subtitle?: string;
  /** Presence of an icon switches the card to a single-line icon-row layout. */
  Icon?: (props: { size?: number; color?: string }) => React.JSX.Element;
  iconSize?: number;
  /** Per-card width override (the goal screen's first card is wider than the rest). */
  width?: number;
};

type SingleSelectCardsProps<T extends string> = {
  options: readonly SelectableCardOption<T>[];
  onSelect: (id: T) => void;
  cardWidth?: number;
  cardSpacing?: number;
};

/** One card's hover/press feel — same primitives as every other Vervein button. */
function useCardInteraction() {
  const hover = useHoverFade();
  const press = useLiquidPress();
  return { hover, press };
}

/**
 * The single-select, auto-navigate card list shared by the goal, experience,
 * environment, and duration onboarding screens: tap a card, it flashes
 * Vervein green for ~100ms with a selection haptic, then `onSelect` fires.
 *
 * Resets its own "selected" state on focus so backtracking into the screen
 * never leaves a stale selection visually stuck or blocking new taps — this
 * is the exact fix for the backtracking-selection bug found earlier, now
 * centralized instead of re-implemented per screen.
 */
export function SingleSelectCards<T extends string>({
  options,
  onSelect,
  cardWidth = 343,
  cardSpacing = 16,
}: SingleSelectCardsProps<T>) {
  const { colors, resolvedScheme } = useAppTheme();
  const isDark = resolvedScheme === 'dark';
  const washColor = isDark ? '#ffffff' : '#000000';
  const styles = useMemo(() => createStyles(colors, washColor), [colors, washColor]);
  const iconColor = isDark ? 'white' : colors.text;
  const [selectedId, setSelectedId] = useState<T | null>(null);

  useFocusEffect(
    useCallback(() => {
      setSelectedId(null);
    }, [])
  );

  const handleSelect = (id: T) => {
    if (selectedId) return;
    hapticSelect();
    setSelectedId(id);
    setTimeout(() => onSelect(id), SELECTION_CONFIRM_MS);
  };

  return (
    <>
      {options.map((option) => (
        <SelectableCard
          key={option.id}
          option={option}
          isSelected={selectedId === option.id}
          iconColor={iconColor}
          cardWidth={cardWidth}
          cardSpacing={cardSpacing}
          styles={styles}
          onSelect={handleSelect}
        />
      ))}
    </>
  );
}

type SelectableCardProps<T extends string> = {
  option: SelectableCardOption<T>;
  isSelected: boolean;
  iconColor: string;
  cardWidth: number;
  cardSpacing: number;
  styles: ReturnType<typeof createStyles>;
  onSelect: (id: T) => void;
};

/** One option's card — owns its own hover/press interaction hooks. */
function SelectableCard<T extends string>({
  option,
  isSelected,
  iconColor,
  cardWidth,
  cardSpacing,
  styles,
  onSelect,
}: SelectableCardProps<T>) {
  const { hover, press } = useCardInteraction();
  const hasIcon = !!option.Icon;
  const Icon = option.Icon;

  return (
    <Pressable
      style={[
        hasIcon ? styles.cardIconRow : styles.card,
        { width: option.width ?? cardWidth, marginBottom: cardSpacing },
      ]}
      onPress={() => onSelect(option.id)}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          hasIcon ? styles.cardVisualIcon : styles.cardVisualPlain,
          isSelected && styles.cardVisualSelected,
          { transform: [{ scale: press.scale }] },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.cardWash,
            { opacity: hover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }) },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.cardWash,
            { opacity: press.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }) },
          ]}
        />
        {isSelected ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cardWashSelected]} />
        ) : null}
        <View pointerEvents="none" style={styles.cardSheen} />
        {hasIcon && Icon ? (
          <>
            <View style={styles.cardIcon}>
              <Icon size={option.iconSize} color={iconColor} />
            </View>
            <Text style={styles.cardLabel} maxFontSizeMultiplier={1.2}>{option.label}</Text>
          </>
        ) : (
          <View style={styles.optionTextCol}>
            <Text style={styles.optionTitle} maxFontSizeMultiplier={1.2}>{option.label}</Text>
            {option.subtitle ? <Text style={styles.optionSubtitle} maxFontSizeMultiplier={1.3}>{option.subtitle}</Text> : null}
          </View>
        )}
        {isSelected ? (
          <View style={styles.checkBadge}>
            <View style={styles.checkDot} />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const CARD_RADIUS = 10;

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], washColor: string) {
  return StyleSheet.create({
    cardIconRow: {
      height: 40,
    },
    card: {},
    cardVisualIcon: {
      width: '100%',
      height: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      borderRadius: CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    cardVisualPlain: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    // A static, subtle top-edge highlight — not the native glass material used
    // on primary buttons (cards were deliberately kept out of that pass), just
    // enough of a light-catches-the-top cue to read as raised rather than flat.
    cardSheen: {
      position: 'absolute',
      left: 1,
      right: 1,
      top: 1,
      height: '48%',
      borderTopLeftRadius: CARD_RADIUS - 1,
      borderTopRightRadius: CARD_RADIUS - 1,
      backgroundColor: colors.surfaceSheen,
      zIndex: -1,
    },
    cardWash: {
      borderRadius: CARD_RADIUS,
      backgroundColor: washColor,
      zIndex: -1,
    },
    cardVisualSelected: {
      borderColor: '#438C63',
    },
    cardWashSelected: {
      borderRadius: CARD_RADIUS,
      backgroundColor: '#438C63',
      opacity: 0.16,
      zIndex: -1,
    },
    cardIcon: {
      width: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardLabel: {
      flex: 1,
      marginLeft: 10,
      color: colors.text,
      fontSize: 11.14,
      fontFamily: 'Geist-SemiBold',
    },
    optionTextCol: {
      flex: 1,
    },
    optionTitle: {
      color: colors.text,
      fontSize: 12.5,
      fontFamily: 'Geist-SemiBold',
    },
    optionSubtitle: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 9.5,
      lineHeight: 13,
      fontFamily: 'Geist-Regular',
    },
    checkBadge: {
      width: 18,
      height: 18,
      borderRadius: 9,
      marginLeft: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    checkDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: '#438C63',
    },
  });
}
