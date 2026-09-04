import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReanimatedAnimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

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

/**
 * Drag anywhere to move the divider — same "direct manipulation, not just
 * the handle" gesture as CommitmentDial, same UI-thread-only Pan +
 * Reanimated pattern (no PanResponder). `before` sits on top, clipped to
 * the divider's width via a plain overflow:'hidden' wrapper (no masking
 * library needed); `after` is the full-size layer underneath it, so
 * whatever the clip doesn't cover shows through automatically. Starts at
 * the midpoint rather than either edge — nobody has to discover which side
 * is draggable before seeing both photos at all.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width]
  );

  const clipStyle = useAnimatedStyle(() => ({ width: dividerX.value }));
  const handleStyle = useAnimatedStyle(() => ({ left: dividerX.value - 1 }));

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[styles.root, { width, height }]}>
        <Image source={{ uri: afterUri }} style={{ width, height }} contentFit="cover" />
        <ReanimatedAnimated.View style={[styles.beforeClip, { height }, clipStyle]}>
          <Image source={{ uri: beforeUri }} style={{ width, height }} contentFit="cover" />
        </ReanimatedAnimated.View>
        <ReanimatedAnimated.View style={[styles.divider, { height }, handleStyle]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    borderRadius: 14,
  },
  beforeClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  divider: {
    position: 'absolute',
    top: 0,
    width: 2,
    backgroundColor: '#ffffff',
  },
});
