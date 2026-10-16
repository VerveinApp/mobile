import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Sparkline } from '@/components/ui/sparkline';
import { TabularNums, Type } from '@/constants/theme';
import { shortDateLabel } from '@/lib/day-labels';
import { useAppColors } from '@/lib/theme-context';

export type TrendPoint = { value: number; date: string };

/**
 * A logged-history trend you can read point by point: touch and hold to
 * scrub, and the caption above shows that entry's date and value instead of
 * the latest. Points are spaced by date, so a two-week gap in logging reads
 * as a gap, not as the next day. `onScrubbingChange` lets the screen lock
 * its scroll while a finger is on the chart.
 */
export function TrendChart({
  data,
  caption,
  formatValue,
  color = '#5FBE84',
  height = 56,
  min,
  onScrubbingChange,
}: {
  /** Oldest first. */
  data: TrendPoint[];
  /** What the line is, shown when nothing is being scrubbed. */
  caption: string;
  formatValue: (value: number) => string;
  color?: string;
  height?: number;
  min?: number;
  onScrubbingChange?: (scrubbing: boolean) => void;
}) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [width, setWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const shown = scrubIndex !== null ? data[scrubIndex] : data[data.length - 1];

  return (
    <View>
      <View style={styles.captionRow}>
        <Text style={styles.caption} maxFontSizeMultiplier={1.3}>
          {scrubIndex !== null && shown ? shortDateLabel(shown.date) : caption}
        </Text>
        {shown ? (
          <Text style={[styles.value, TabularNums]} maxFontSizeMultiplier={1.2}>
            {formatValue(shown.value)}
          </Text>
        ) : null}
      </View>
      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Sparkline
            data={data}
            spacing="date"
            width={width}
            height={height}
            min={min}
            color={color}
            accessibilityLabel={`${caption} trend, ${data.length} entries`}
            describePoint={(index) => `${shortDateLabel(data[index].date)}, ${formatValue(data[index].value)}`}
            onScrub={(index) => {
              setScrubIndex(index);
              onScrubbingChange?.(index !== null);
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    captionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 10,
    },
    caption: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      fontFamily: 'Geist-SemiBold',
    },
    value: {
      color: colors.textSecondary,
      fontSize: Type.caption,
      fontFamily: 'Geist-SemiBold',
    },
    chart: {
      width: '100%',
    },
  });
}
