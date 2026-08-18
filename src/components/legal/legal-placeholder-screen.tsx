import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { useHoverFade } from '@/lib/button-interactions';
import { useAppColors } from '@/lib/theme-context';

/**
 * Both /legal/terms and /legal/privacy render this — real legal copy needs
 * actual legal review before ship (same caveat as onboarding/step-5.tsx's
 * CONSENT_COPY), so this states that plainly instead of either 404ing or
 * standing in a fabricated document that reads as the real thing.
 */
export function LegalPlaceholderScreen({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();

  return (
    <View style={styles.root}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          onHoverIn={backHover.onHoverIn}
          onHoverOut={backHover.onHoverOut}
          hitSlop={10}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>{title}</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.body}>
        <Text style={styles.placeholderText} maxFontSizeMultiplier={1.4}>
          This is a prototype build — {title.toLowerCase()} hasn&apos;t been drafted yet. Real copy needs legal review
          before this app ships.
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: colors.text,
      fontSize: 16,
      fontFamily: 'Geist-SemiBold',
    },
    body: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    placeholderText: {
      color: colors.textSecondary,
      fontSize: 13.5,
      lineHeight: 20,
      fontFamily: 'Geist-Medium',
    },
  });
}
