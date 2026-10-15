import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * A soft fade from transparent into `color`, laid over the top edge of a
 * pinned bottom bar so scrolling content dissolves under it instead of
 * meeting a hard line or a border.
 */
export function BottomFade({ color, height }: { color: string; height: number }) {
  return (
    <Svg style={[styles.fade, { height, top: -height }]} width="100%" height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0} />
          <Stop offset="1" stopColor={color} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height={height} fill="url(#bottomFade)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
