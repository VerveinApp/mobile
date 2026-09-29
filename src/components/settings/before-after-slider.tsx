import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReanimatedAnimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { SymbolView } from '@/components/ui/app-symbol';

function clamp(n: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, n));
}

type BeforeAfterSliderProps = {
  beforeUri: string;
  afterUri: string;
  width: number;
  height: number;
};

const HANDLE_SIZE = 34;

/**
 * Drag anywhere to move the divider — same "direct manipulation, not just
 * the handle" gesture as CommitmentDial, same UI-thread-only Pan +
 * Reanimated pattern (no PanResponder). `after` is the full-size layer
 * underneath; `before` sits on top, clipped at the divider. Starts at the
 * midpoint rather than either edge — nobody has to discover which side is
 * draggable before seeing both photos at all.
 *
 * The clip is transform-only: the clipping window slides left by
 * (width - dividerX) while the photo inside it slides right by the same
 * amount, so the photo stays still and only the window's edge moves. This
 * used to animate the window's `width` and the divider's `left` instead —
 * layout properties, so every frame of a drag over two full-size photos
 * went through a layout pass. The round grab handle on the divider is new
 * too: a bare 2px line gave no hint that the photo could be dragged.
 */
export function BeforeAfterSlider({ beforeUri, afterUri, width, height }: BeforeAfterSliderProps) {
  const dividerX = useSharedValue(width / 2);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => {
          dividerX.value = clamp(e.x, 0, width);
        })
        .onUpdate((e) => {
          dividerX.value = clamp(e.x, 0, width);
        }),
    // dividerX is a stable shared value — listing it here makes the React
    // Compiler treat the worklet's writes as mutating a hook argument.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width]
  );

  const clipWindowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dividerX.value - width }],
  }));
  const clippedPhotoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: width - dividerX.value }],
  }));
  const dividerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dividerX.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={[styles.root, { width, height }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Before and after comparison. Drag sideways to compare the two photos."
      >
        <Image source={{ uri: afterUri }} style={{ width, height }} contentFit="cover" transition={150} />
        <ReanimatedAnimated.View style={[styles.clipWindow, { width, height }, clipWindowStyle]}>
          <ReanimatedAnimated.View style={clippedPhotoStyle}>
            <Image source={{ uri: beforeUri }} style={{ width, height }} contentFit="cover" transition={150} />
          </ReanimatedAnimated.View>
        </ReanimatedAnimated.View>
        <ReanimatedAnimated.View pointerEvents="none" style={[styles.dividerTrack, { height }, dividerStyle]}>
          <View style={styles.dividerLine} />
          <View style={[styles.handle, { top: height / 2 - HANDLE_SIZE / 2 }]}>
            <SymbolView name="chevron.left" size={10} tintColor="#111111" weight="bold" />
            <SymbolView name="chevron.right" size={10} tintColor="#111111" weight="bold" />
          </View>
        </ReanimatedAnimated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    borderRadius: 14,
  },
  clipWindow: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  // Zero-width anchor positioned by transform; the line and handle are
  // centered on it.
  dividerTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 0,
    alignItems: 'center',
  },
  dividerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ffffff',
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
