import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogPastSessionSheet } from '@/components/settings/log-past-session-sheet';
import { useHoverFade } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { useAppColors } from '@/lib/theme-context';

/**
 * A quick-access hub for backfilling things about a day that already
 * happened — reachable from the Profile tab and from Settings, both of
 * which stay as they were (this doesn't replace either, just adds a
 * faster, more discoverable path to the same real actions). Deliberately
 * external to the live check-in flow, same "I trained on a day I never
 * opened the app for" honesty as log-past-session-sheet.tsx's own doc
 * comment — nothing here runs the adaptive engine or pretends to be a
 * real-time session.
 */
export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const backHover = useHoverFade();

  const logPastSessionSheetRef = useRef<BottomSheetModal>(null);

  const handleOpenPastSession = useCallback(() => {
    logPastSessionSheetRef.current?.present();
  }, []);

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
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Log</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.introText} maxFontSizeMultiplier={1.4}>
          For anything that already happened — a day you forgot to check in on, or a number worth recording — never a
          substitute for today&apos;s real check-in.
        </Text>

        <View style={styles.card}>
          <LogRow
            styles={styles}
            colors={colors}
            icon="figure.strengthtraining.traditional"
            label="Past Session"
            subtitle="Which areas you trained, for a day you missed"
            onPress={handleOpenPastSession}
          />
          <LogRow
            styles={styles}
            colors={colors}
            icon="scalemass"
            label="Weight"
            subtitle="Add today's or a past weigh-in"
            onPress={() => router.push('/settings/weight-history' as never)}
          />
          <LogRow
            styles={styles}
            colors={colors}
            icon="note.text"
            label="Notes"
            subtitle="Anything freeform, not tied to a day"
            onPress={() => router.push('/notes' as never)}
            last
          />
        </View>
      </ScrollView>

      <LogPastSessionSheet ref={logPastSessionSheetRef} />
    </View>
  );
}

function LogRow({
  styles,
  colors,
  icon,
  label,
  subtitle,
  onPress,
  last = false,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppColors>;
  icon: SFSymbol;
  label: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
}) {
  const hover = useHoverFade();
  return (
    <Pressable
      style={[styles.row, !last && styles.rowDivider]}
      onPress={() => {
        hapticImpactLight();
        onPress();
      }}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${subtitle}`}
    >
      <View style={styles.rowIconWrap}>
        <SymbolView name={icon} size={16} tintColor="#5FBE84" />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
        <Text style={styles.rowSubtitle} maxFontSizeMultiplier={1.4}>{subtitle}</Text>
      </View>
      <SymbolView name="chevron.right" size={12} tintColor={colors.iconFaint} />
    </Pressable>
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
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      gap: 20,
    },
    introText: {
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: 'Geist-Regular',
    },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    rowIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(95,190,132,0.14)',
    },
    rowText: {
      flex: 1,
    },
    rowLabel: {
      color: colors.text,
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
    rowSubtitle: {
      marginTop: 2,
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: 'Geist-Regular',
    },
  });
}
