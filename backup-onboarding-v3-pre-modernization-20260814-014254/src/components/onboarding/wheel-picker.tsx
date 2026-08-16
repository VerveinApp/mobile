import { useRef } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View } from 'react-native';

import { hapticSelect } from '@/lib/haptics';

export const WHEEL_ITEM_HEIGHT = 32;
const VISIBLE_ITEMS = 5;
export const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * VISIBLE_ITEMS;
const WHEEL_PADDING = WHEEL_ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

type WheelPickerProps = {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  width?: number;
};

/**
 * A scrollable, snapping value wheel — the same interaction shape as iOS's
 * native picker (e.g. the Clock app's timer wheels): items snap to the
 * center band, fade/shrink with distance from center, and settle with a
 * selection haptic. Built on Animated.ScrollView rather than a native
 * UIPickerView since there's no Expo wrapper for that control.
 */
export function WheelPicker({ items, selectedIndex, onChange, width = 90 }: WheelPickerProps) {
  const scrollY = useRef(new Animated.Value(selectedIndex * WHEEL_ITEM_HEIGHT)).current;
  const lastIndex = useRef(selectedIndex);
  const scrollRef = useRef<ScrollView>(null);
  const hasSetInitialOffset = useRef(false);

  // The `contentOffset` prop below is only a first-paint hint — RN's initial
  // layout pass can drop it (seen in practice on the first-mounted wheel in
  // a screen), leaving the scroll position at 0 while `scrollY` still reads
  // the seeded value, so the highlighted item and the selection band
  // disagree. Forcing a real scrollTo once content is measured fixes that.
  const handleContentSizeChange = () => {
    if (hasSetInitialOffset.current) return;
    hasSetInitialOffset.current = true;
    scrollRef.current?.scrollTo({ y: selectedIndex * WHEEL_ITEM_HEIGHT, animated: false });
  };

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
  });

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(
      0,
      Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT))
    );
    if (index !== lastIndex.current) {
      lastIndex.current = index;
      hapticSelect();
      onChange(index);
    }
  };

  return (
    <View style={[styles.wrap, { width, height: WHEEL_HEIGHT }]}>
      <View pointerEvents="none" style={styles.selectionBand} />
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
        onContentSizeChange={handleContentSizeChange}
        contentOffset={{ x: 0, y: selectedIndex * WHEEL_ITEM_HEIGHT }}
      >
        {items.map((label, index) => {
          const inputRange = [
            (index - 2) * WHEEL_ITEM_HEIGHT,
            index * WHEEL_ITEM_HEIGHT,
            (index + 2) * WHEEL_ITEM_HEIGHT,
          ];
          const opacity = scrollY.interpolate({ inputRange, outputRange: [0.22, 1, 0.22], extrapolate: 'clamp' });
          const scale = scrollY.interpolate({ inputRange, outputRange: [0.8, 1, 0.8], extrapolate: 'clamp' });
          return (
            <View key={label + index} style={styles.item}>
              <Animated.Text style={[styles.itemText, { opacity, transform: [{ scale }] }]}>{label}</Animated.Text>
            </View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  selectionBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_HEIGHT / 2 - WHEEL_ITEM_HEIGHT / 2,
    height: WHEEL_ITEM_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(67,140,99,0.1)',
    borderRadius: 6,
  },
  item: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Geist-SemiBold',
  },
});
