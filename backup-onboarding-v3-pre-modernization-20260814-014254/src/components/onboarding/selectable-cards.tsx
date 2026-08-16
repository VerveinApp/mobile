import { useCallback, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticSelect } from '@/lib/haptics';

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
  const [selectedId, setSelectedId] = useState<T | null>(null);

  // One hook instance per option — `options` is always a fixed-length,
  // module-level constant from the caller, so this satisfies the rules of
  // hooks despite being in a loop.
  const interactions = options.map(() => useCardInteraction());

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
      {options.map((option, index) => {
        const { hover, press } = interactions[index];
        const isSelected = selectedId === option.id;
        const hasIcon = !!option.Icon;
        const Icon = option.Icon;

        return (
          <Pressable
            key={option.id}
            style={[
              hasIcon ? styles.cardIconRow : styles.card,
              { width: option.width ?? cardWidth, marginBottom: cardSpacing },
            ]}
            onPress={() => handleSelect(option.id)}
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
                    <Icon size={option.iconSize} />
                  </View>
                  <Text style={styles.cardLabel}>{option.label}</Text>
                </>
              ) : (
                <View style={styles.optionTextCol}>
                  <Text style={styles.optionTitle}>{option.label}</Text>
                  {option.subtitle ? <Text style={styles.optionSubtitle}>{option.subtitle}</Text> : null}
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
      })}
    </>
  );
}

const CARD_RADIUS = 10;

const styles = StyleSheet.create({
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
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#0C0C0C',
  },
  cardVisualPlain: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#0C0C0C',
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
    backgroundColor: 'rgba(255,255,255,0.03)',
    zIndex: -1,
  },
  cardWash: {
    borderRadius: CARD_RADIUS,
    backgroundColor: '#ffffff',
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
    color: '#ffffff',
    fontSize: 11.14,
    fontFamily: 'Geist-SemiBold',
  },
  optionTextCol: {
    flex: 1,
  },
  optionTitle: {
    color: '#ffffff',
    fontSize: 12.5,
    fontFamily: 'Geist-SemiBold',
  },
  optionSubtitle: {
    marginTop: 4,
    color: '#a3a3a3',
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
