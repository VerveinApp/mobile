import { StyleSheet, View } from 'react-native';

export const ONBOARDING_STEP_COUNT = 8;

/** Thin segmented progress bar spanning the header — one segment per onboarding step. */
export function OnboardingProgress({ step }: { step: number }) {
  return (
    <View style={styles.row} pointerEvents="none">
      {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, i) => (
        <View key={i} style={[styles.segment, i < step && styles.segmentActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 48,
    right: 48,
    top: 66,
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  segmentActive: {
    backgroundColor: '#ffffff',
  },
});
