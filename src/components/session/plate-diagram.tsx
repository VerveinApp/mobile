import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Type } from '@/constants/theme';
import { useCanvasUnit } from '@/lib/canvas-scale';
import { formatPlateBreakdown, type PlateBreakdown } from '@/lib/plate-calculator';
import { useAppColors } from '@/lib/theme-context';

// Drawn heights by share of the biggest plate, so a 45 reads as a 45 next
// to a 2.5 without being drawn to an exact physical scale.
const MAX_PLATE_HEIGHT = 44;
const MIN_PLATE_HEIGHT = 16;
const PLATE_WIDTH = 9;
const PLATE_GAP = 2;
const SLEEVE_LENGTH = 26;
const COLLAR_WIDTH = 5;

/**
 * One end of the bar, loaded from the collar out — which plates go on each
 * side, read at a glance while the bar is being set up. The same breakdown
 * reads underneath as text (and is what VoiceOver hears). Lengths are canvas
 * units (it sits in check-in.tsx's fixed canvas).
 */
export function PlateDiagram({ breakdown, unitLabel }: { breakdown: PlateBreakdown; unitLabel: 'kg' | 'lb' }) {
  const colors = useAppColors();
  const unit = useCanvasUnit();
  const plates = breakdown.platesPerSide;
  const heaviest = plates.length > 0 ? Math.max(...plates) : 1;
  const height = MAX_PLATE_HEIGHT * unit;
  const width = (SLEEVE_LENGTH + COLLAR_WIDTH + plates.length * (PLATE_WIDTH + PLATE_GAP) + 8) * unit;
  const caption = formatPlateBreakdown(breakdown, unitLabel);

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`Plates: ${caption}`}>
      {plates.length > 0 ? (
        <Svg width={width} height={height}>
          {/* The sleeve the plates slide onto, running under them to the end. */}
          <Rect x={0} y={height / 2 - 2 * unit} width={width} height={4 * unit} rx={2 * unit} fill={colors.surfaceBorder} />
          <Rect
            x={SLEEVE_LENGTH * unit}
            y={height / 2 - 7 * unit}
            width={COLLAR_WIDTH * unit}
            height={14 * unit}
            rx={1.5 * unit}
            fill={colors.textTertiary}
          />
          {plates.map((plate, i) => {
            const plateHeight = Math.max(MIN_PLATE_HEIGHT, (plate / heaviest) * MAX_PLATE_HEIGHT) * unit;
            return (
              <Rect
                key={i}
                x={(SLEEVE_LENGTH + COLLAR_WIDTH + PLATE_GAP + i * (PLATE_WIDTH + PLATE_GAP)) * unit}
                y={(height - plateHeight) / 2}
                width={PLATE_WIDTH * unit}
                height={plateHeight}
                rx={2 * unit}
                fill={colors.textSecondary}
              />
            );
          })}
        </Svg>
      ) : null}
      <Text style={[styles.caption, { color: colors.textSecondary, fontSize: Type.caption * unit, marginTop: 4 * unit }]}>
        {caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  caption: {
    fontFamily: 'Geist-Medium',
    textAlign: 'center',
  },
});
