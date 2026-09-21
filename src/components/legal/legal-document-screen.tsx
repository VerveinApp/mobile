import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';

import { Type } from '@/constants/theme';
import { useHoverFade } from '@/lib/button-interactions';
import { useAppColors } from '@/lib/theme-context';

export type LegalSection = {
  heading: string;
  /** Each string is its own paragraph. A leading "- " renders as a bullet line instead. */
  body: string[];
};

/**
 * Shared renderer for /legal/terms and /legal/privacy — real content lives
 * in src/lib/legal/*.ts, not here. See those files' own header comments for
 * the "drafted by AI, not attorney-reviewed" disclosure this screen's own
 * effectiveDate footer intentionally does not hide.
 */
export function LegalDocumentScreen({
  title,
  effectiveDate,
  intro,
  sections,
}: {
  title: string;
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
}) {
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.effectiveDate} maxFontSizeMultiplier={1.3}>Effective {effectiveDate}</Text>
        <Text style={styles.intro} maxFontSizeMultiplier={1.4}>{intro}</Text>

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>{section.heading}</Text>
            {section.body.map((paragraph, index) =>
              paragraph.startsWith('- ') ? (
                <View key={index} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>{'•'}</Text>
                  <Text style={styles.bulletText} maxFontSizeMultiplier={1.4}>{paragraph.slice(2)}</Text>
                </View>
              ) : (
                <Text key={index} style={styles.paragraph} maxFontSizeMultiplier={1.4}>{paragraph}</Text>
              )
            )}
          </View>
        ))}
      </ScrollView>
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
      fontSize: Type.subtitle,
      fontFamily: 'Geist-SemiBold',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 48,
    },
    effectiveDate: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
      marginBottom: 12,
    },
    intro: {
      color: colors.textSecondary,
      fontSize: Type.body,
      lineHeight: 20,
      fontFamily: 'Geist-Medium',
      marginBottom: 20,
    },
    section: {
      marginBottom: 22,
    },
    sectionHeading: {
      color: colors.text,
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-Bold',
      marginBottom: 8,
    },
    paragraph: {
      color: colors.textSecondary,
      fontSize: Type.body,
      lineHeight: 20,
      fontFamily: 'Geist-Regular',
      marginBottom: 8,
    },
    bulletRow: {
      flexDirection: 'row',
      marginBottom: 6,
      paddingLeft: 2,
    },
    bulletDot: {
      color: colors.textSecondary,
      fontSize: Type.body,
      marginRight: 8,
      lineHeight: 20,
    },
    bulletText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: Type.body,
      lineHeight: 20,
      fontFamily: 'Geist-Regular',
    },
  });
}
