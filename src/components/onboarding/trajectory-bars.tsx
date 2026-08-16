import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export type TrajectoryPoint = { label: string; value: number };

type TrajectoryBarsProps = {
  points: TrajectoryPoint[];
  maxHeight?: number;
  barWidth?: number;
};

/**
 * Three ascending bars (Now / 6 Months / Peak potential) that grow in on
 * mount — the visual centerpiece of the trajectory screen. The last point
 * gets the brighter fill + thicker border treatment (same "this one is the
 * highlight" language as EnergyGauge's selected wedge), everything else
 * stays the flat, non-gradient brand green established this pass.
 */
export function TrajectoryBars({ points, maxHeight = 130, barWidth = 62 }: TrajectoryBarsProps) {
  return (
    <View style={[styles.row, { height: maxHeight + 56 }]}>
      {points.map((point, index) => (
        <Bar
          key={point.label}
          point={point}
          maxHeight={maxHeight}
          width={barWidth}
          delay={index * 160}
          isPeak={index === points.length - 1}
        />
      ))}
    </View>
  );
}

function Bar({
  point,
  maxHeight,
  width,
  delay,
  isPeak,
}: {
  point: TrajectoryPoint;
  maxHeight: number;
  width: number;
  delay: number;
  isPeak: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withDelay(250 + delay, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: maxHeight * (point.value / 100) * progress.value,
  }));

  return (
    <View style={[styles.col, { width }]}>
      <View style={[styles.valueBlock, isPeak && styles.valueBlockPeak]}>
        <Text style={styles.valueText}>{point.value}%</Text>
      </View>
      <View style={[styles.track, { height: maxHeight, width }]}>
        <ReanimatedAnimated.View style={[styles.bar, isPeak && styles.barPeak, animatedStyle, { width }]} />
      </View>
      <Text style={styles.label}>{point.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  col: {
    alignItems: 'center',
  },
  valueBlock: {
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderWidth: 2,
    borderRadius: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: '#0A0A0A',
  },
  valueBlockPeak: {
    borderColor: '#5FBE84',
  },
  valueText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Geist-Bold',
  },
  track: {
    justifyContent: 'flex-end',
  },
  bar: {
    borderRadius: 4,
    backgroundColor: '#2f6647',
  },
  barPeak: {
    backgroundColor: '#438C63',
    borderWidth: 1,
    borderColor: '#5FBE84',
  },
  label: {
    marginTop: 8,
    color: '#8a8a8a',
    fontSize: 10,
    fontFamily: 'Geist-Medium',
  },
});
