import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useAppColors } from '@/lib/theme-context';

/**
 * Shown instead of a screen's real content when the local profile hasn't
 * granted healthConsent — body-measurements.tsx, condition-log.tsx, and
 * progress-photos.tsx are all reachable directly from Settings, but their
 * whole premise ("share this to tailor my training load") assumes the same
 * consent onboarding/step-5.tsx collects. Points back at Settings' own
 * "Body & Biometrics" row, the only place consent can be granted after
 * onboarding — saving from that sheet sets healthConsent true (see
 * biometrics-sheet.tsx).
 */
export function HealthConsentGate() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  return (
    <View style={styles.card}>
      <SymbolView name="hand.raised" size={22} tintColor={colors.iconFaint} />
      <Text style={styles.text} maxFontSizeMultiplier={1.3}>
        Turn on health sharing first — Settings → Body & Biometrics — then come back here.
      </Text>
      <Pressable onPress={() => router.back()} style={styles.backHit}>
        <Text style={styles.backText} maxFontSizeMultiplier={1.2}>Go back</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    card: {
      margin: 20,
      padding: 20,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      alignItems: 'center',
      gap: 12,
    },
    text: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    backHit: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    backText: {
      color: '#438C63',
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
