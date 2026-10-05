import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  Animated,
  type LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { TabularNums, Type } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';
import { useAppTheme } from '@/lib/theme-context';

export const RULER_TICK_SPACING = 26;
// How long a release waits for UIKit to start a momentum phase before the
// ruler settles onto its nearest tick itself (see handleScrollEndDrag).
const SETTLE_WAIT_MS = 80;
export const RULER_HEIGHT = 68;
export const RULER_TICK_HEIGHT = 24;
const TICK_HEIGHT = RULER_TICK_HEIGHT;
const LABEL_BAND_HEIGHT = 26;
// Ticks stay at least partially visible out to ±4 neighbors rather than
// fading to near-zero — the same "raised floor" fix WheelPicker needed after
// a fully-dimmed edge read as dead space rather than a visible option.
const TICK_FADE_SPAN = 4;
// Only ticks within MOUNT_RADIUS of the value are mounted up front; spacers
// stand in for the rest so the content width, snapping and every offset stay
// exactly what a fully mounted ruler would have. Whenever the scroll comes
// within MOUNT_MARGIN ticks of either edge of what's mounted, the range grows
// (never shrinks) around the new position. 60 ticks is 1,560pt, several
// screen widths each side, so even a hard fling can't outrun it. Mounting
// every tick at once cost up to 601 ticks (lift goals in lb), three native
// views and two animated nodes apiece, right as a sheet was opening.
const MOUNT_RADIUS = 60;
const MOUNT_MARGIN = 30;

function mountRangeAround(index: number, count: number): [number, number] {
  return [Math.max(0, index - MOUNT_RADIUS), Math.min(count - 1, index + MOUNT_RADIUS)];
}

type HorizontalRulerProps = {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  // Fixed pixel width for a control that shares its row with another ruler
  // (e.g. feet + inches). Omit it to fill the row instead — see the measured-
  // width note below.
  width?: number;
  // What VoiceOver reads before the value, e.g. "Height, feet". Include the
  // unit whenever the items themselves are bare numbers.
  accessibilityLabel?: string;
};

/**
 * A horizontal, scrubbable measuring strip — same snap-and-settle mechanics
 * as WheelPicker (Animated.ScrollView, momentum-end haptic, index clamp),
 * rotated into a different metaphor: a fixed pointer reads the value off
 * ticks that slide underneath, like a ruler drawn past a fixed mark, rather
 * than a boxed row scrolling past a static highlight band.
 *
 * Only the tick nearest the pointer shows its label. Entries here range up
 * to "Wed, Aug 12" (the day picker) — showing every neighbor's label at
 * once would overlap, so the label crossfades in as its tick nears center
 * and back out as it leaves, and the tick marks themselves (not their text)
 * carry the sense of a surrounding scale.
 *
 * BUG FIX (found by the user from a screenshot): every call site originally
 * passed a small fixed `width` sized for a vertical wheel's text column,
 * leaving most of the card's real width as dead space next to the control.
 * Without an explicit `width`, this now stretches to fill its row (flex: 1)
 * and measures its own laid-out pixel width via onLayout — the tick math
 * below needs a real number, not a percentage, to center ticks and compute
 * scroll padding.
 */
export function HorizontalRuler({ items, selectedIndex, onChange, width, accessibilityLabel }: HorizontalRulerProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [scrollX] = useState(() => new Animated.Value(selectedIndex * RULER_TICK_SPACING));
  const lastIndex = useRef(selectedIndex);
  const scrollRef = useRef<ScrollView>(null);
  const hasSetInitialOffset = useRef(false);
  const [measuredWidth, setMeasuredWidth] = useState(width ?? 0);
  const trackWidth = width ?? measuredWidth;
  const sidePadding = trackWidth / 2 - RULER_TICK_SPACING / 2;

  const handleLayout = (e: LayoutChangeEvent) => {
    if (width == null) setMeasuredWidth(e.nativeEvent.layout.width);
  };

  // Same first-paint fix as WheelPicker's handleContentSizeChange: the
  // `contentOffset` prop is only a hint RN's initial layout pass can drop,
  // so force a real scrollTo once content is measured.
  const handleContentSizeChange = () => {
    if (hasSetInitialOffset.current) return;
    hasSetInitialOffset.current = true;
    scrollRef.current?.scrollTo({ x: selectedIndex * RULER_TICK_SPACING, animated: false });
  };

  // A light selection tick each time a new value passes the center pointer
  // while scrolling — the feel of a native picker wheel, instead of a single
  // haptic only once the scroll has fully settled. Tracked separately from
  // lastIndex, which only ever means "the committed value".
  const tickIndex = useRef(selectedIndex);
  const [mountRange, setMountRange] = useState(() => mountRangeAround(selectedIndex, items.length));
  // A mirror of mountRange for the scroll listener, which runs every frame
  // and should only touch state when the range actually has to grow.
  const mountRangeRef = useRef(mountRange);
  useEffect(() => {
    // A JS listener on the natively-driven value — RN forwards native
    // updates to it whenever one is attached.
    const id = scrollX.addListener(({ value }) => {
      const index = Math.max(0, Math.min(items.length - 1, Math.round(value / RULER_TICK_SPACING)));
      if (index === tickIndex.current) return;
      tickIndex.current = index;
      hapticSelect();
      const [start, end] = mountRangeRef.current;
      const nearStart = start > 0 && index - start < MOUNT_MARGIN;
      const nearEnd = end < items.length - 1 && end - index < MOUNT_MARGIN;
      if (nearStart || nearEnd) {
        const [aroundStart, aroundEnd] = mountRangeAround(index, items.length);
        const grown: [number, number] = [Math.min(start, aroundStart), Math.max(end, aroundEnd)];
        mountRangeRef.current = grown;
        setMountRange(grown);
      }
    });
    return () => scrollX.removeListener(id);
  }, [scrollX, items.length]);
  // Clamped in case the items list ever shrinks under a mounted ruler.
  const lastItemIndex = items.length - 1;
  const mountStart = Math.max(0, Math.min(mountRange[0], lastItemIndex));
  const mountEnd = Math.min(mountRange[1], lastItemIndex);
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: true,
  });

  const commitAtOffset = (offsetX: number) => {
    const index = Math.max(0, Math.min(items.length - 1, Math.round(offsetX / RULER_TICK_SPACING)));
    // BUG FIX (found by the user while recording): a drag released without
    // a real flick could come to rest between two ticks. snapToInterval only
    // works by retargeting the deceleration, and a release UIKit doesn't
    // decelerate has none, so the strip stayed wherever the finger stopped.
    // The committed value often didn't change in that case either, so
    // nothing else re-aligned it, and the number stayed off-center and
    // half-faded (gray) until the ruler was touched again. Pulling the strip
    // onto the tick here gives every release the same magnetic settle a
    // native picker has; the animation's own scroll events bring the label
    // to full opacity.
    const tickOffset = index * RULER_TICK_SPACING;
    if (Math.abs(offsetX - tickOffset) > 0.5) {
      scrollRef.current?.scrollTo({ x: tickOffset, animated: true });
    }
    if (index !== lastIndex.current) {
      lastIndex.current = index;
      onChange(index);
    }
  };
  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    commitAtOffset(e.nativeEvent.contentOffset.x);
  };
  // BUG FIX: the value only ever committed on onMomentumScrollEnd — but a
  // slow drag has no momentum phase at all, so that event never fired and
  // the ruler showed a new value while the old one stayed saved. A release
  // now commits (and settles onto its tick) unless momentum actually starts.
  // That used to be guessed from the release velocity (< 0.01), but UIKit
  // skips deceleration for small nonzero velocities too, and those releases
  // were left uncommitted and between ticks. onMomentumScrollBegin arrives
  // right behind onScrollEndDrag when UIKit does decelerate, so a short wait
  // for it is the reliable signal.
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelSettle = () => {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  };
  useEffect(
    () => () => {
      if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    },
    []
  );
  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    cancelSettle();
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      commitAtOffset(offsetX);
    }, SETTLE_WAIT_MS);
  };

  // VoiceOver sees the ruler as one adjustable control (swipe up or down to
  // step the value), the same pattern as EnergyGauge and CommitmentDial. A
  // scrolling strip of ticks can't be operated with VoiceOver on otherwise,
  // and onboarding's height and weight are set only through these.
  const stepBy = (delta: number) => {
    const next = Math.max(0, Math.min(items.length - 1, lastIndex.current + delta));
    if (next === lastIndex.current) return;
    lastIndex.current = next;
    scrollRef.current?.scrollTo({ x: next * RULER_TICK_SPACING, animated: true });
    onChange(next);
  };
  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') stepBy(1);
    else if (event.nativeEvent.actionName === 'decrement') stepBy(-1);
  };

  // Built only when the mounted range or the items change. Each RulerTick
  // keeps its own interpolations, so growing the range mounts just the new
  // ticks. (Left inline, the React Compiler grouped the tick list with the
  // ScrollView's contentOffset, which reads selectedIndex, so every
  // committed value rebuilt every tick right as the scroll settled.)
  const ticks = useMemo(() => {
    const list = [];
    for (let index = mountStart; index <= mountEnd; index++) {
      list.push(
        <RulerTick key={items[index] + index} label={items[index]} index={index} scrollX={scrollX} styles={styles} />
      );
    }
    return list;
  }, [items, mountStart, mountEnd, scrollX, styles]);

  return (
    <View
      style={[styles.wrap, { height: RULER_HEIGHT }, width != null ? { width } : styles.wrapFill]}
      onLayout={handleLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: items[selectedIndex] ?? '' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={handleAccessibilityAction}
    >
      {trackWidth <= 0 ? null : (
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={RULER_TICK_SPACING}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: sidePadding }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={cancelSettle}
        onMomentumScrollBegin={cancelSettle}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleScrollEndDrag}
        onContentSizeChange={handleContentSizeChange}
        contentOffset={{ x: selectedIndex * RULER_TICK_SPACING, y: 0 }}
      >
        <View style={{ width: mountStart * RULER_TICK_SPACING }} />
        {ticks}
        <View style={{ width: (items.length - 1 - mountEnd) * RULER_TICK_SPACING }} />
      </Animated.ScrollView>
      )}
      <View pointerEvents="none" style={styles.pointer} />
    </View>
  );
}

type RulerTickProps = {
  label: string;
  index: number;
  scrollX: Animated.Value;
  styles: ReturnType<typeof createStyles>;
};

/**
 * One tick and its label. Memoized, with its two interpolations built once
 * per index, so growing the mounted range (or any parent re-render) never
 * recreates the animated nodes of ticks that are already on screen.
 */
const RulerTick = memo(function RulerTick({ label, index, scrollX, styles }: RulerTickProps) {
  const tickOpacity = useMemo(
    () =>
      scrollX.interpolate({
        inputRange: [
          (index - TICK_FADE_SPAN) * RULER_TICK_SPACING,
          index * RULER_TICK_SPACING,
          (index + TICK_FADE_SPAN) * RULER_TICK_SPACING,
        ],
        outputRange: [0.3, 1, 0.3],
        extrapolate: 'clamp',
      }),
    [index, scrollX]
  );
  // BUG FIX: this used to fade across a full tick spacing on each side, so
  // two neighboring labels (e.g. "5 ft" and "6 ft") were simultaneously
  // partway visible for the whole distance between them — wide enough that
  // both rendered legibly at once, reading as garbled overlapping text
  // mid-swipe. Halving the fade distance means a label reaches 0 opacity
  // exactly where its neighbor's own fade-in starts, so only one is ever
  // meaningfully visible.
  const labelOpacity = useMemo(
    () =>
      scrollX.interpolate({
        inputRange: [(index - 0.5) * RULER_TICK_SPACING, index * RULER_TICK_SPACING, (index + 0.5) * RULER_TICK_SPACING],
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
      }),
    [index, scrollX]
  );
  return (
    <View style={styles.tickSlot}>
      {/* Absolutely positioned and centered on its own tick slot so it never
          nudges neighboring ticks apart while animating — same reason
          WheelPicker keeps its scale/opacity animation on a wrapping view
          rather than the Text node directly.
          BUG FIX: this used to also animate `transform: [{ scale }]` on the
          Text node itself (0.7 → 1 → 0.7, same range as the opacity fade) —
          scaling a rasterized text layer mid-motion is exactly the kind of
          transform iOS doesn't always re-rasterize crisply for, and swiping
          is when a label spends the most time at an intermediate,
          blurry-looking scale value rather than settled at a clean 1.0 or 0.
          Opacity alone gives the same "coming into focus" feel without ever
          touching how the glyphs themselves are rendered. */}
      <Animated.Text style={[styles.tickLabel, { opacity: labelOpacity }]} maxFontSizeMultiplier={1.15} numberOfLines={1}>
        {label}
      </Animated.Text>
      <Animated.View style={[styles.tick, { opacity: tickOpacity }]} />
    </View>
  );
});

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    wrap: {
      position: 'relative',
      justifyContent: 'flex-end',
    },
    wrapFill: {
      flex: 1,
      alignSelf: 'stretch',
    },
    tickSlot: {
      width: RULER_TICK_SPACING,
      height: LABEL_BAND_HEIGHT + TICK_HEIGHT,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    tickLabel: {
      position: 'absolute',
      top: 0,
      width: 140,
      textAlign: 'center',
      color: colors.text,
      fontSize: Type.stat,
      fontFamily: 'Geist-SemiBold',
      ...TabularNums,
    },
    tick: {
      width: 2,
      height: TICK_HEIGHT,
      borderRadius: 1,
      backgroundColor: colors.iconFaint,
    },
    // Fixed read mark, drawn just beneath the tick baseline rather than
    // through the ticks themselves — a needle crossing the tick row would
    // sit exactly on top of the centered tick at rest and read as clutter
    // rather than a pointer.
    pointer: {
      position: 'absolute',
      left: '50%',
      marginLeft: -4,
      bottom: -2,
      width: 0,
      height: 0,
      borderLeftWidth: 4,
      borderRightWidth: 4,
      borderBottomWidth: 6,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: '#5FBE84',
    },
  });
}
