import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SymbolView } from '@/components/ui/app-symbol';
import { LogPastSessionSheet } from '@/components/settings/log-past-session-sheet';
import { Type } from '@/constants/theme';
import { useHoverFade } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { usePremiumEntitlement } from '@/lib/purchases';
import { useAppColors } from '@/lib/theme-context';

/**
 * A quick-access hub for backfilling things about a day that already
 * happened. Weight and Notes stay free, same as their own Settings
 * screens — everything else here (Past Session, Sleep, Nutrition,
 * Progress Photo, Body Measurements, Condition Log) is VerveIn Plus,
 * hidden outright rather than shown locked, matching Settings' own DATA
 * section gating for the exact same features.
 *
 * PRIOR HISTORY: this whole screen used to be Plus-gated, then had that
 * gate removed entirely on the theory that every action here was already
 * free via Settings — true at the time, but Settings' own gating later
 * changed (these same six actions became Plus there) without this screen
 * being revisited to match. Rather than re-gate the whole screen (Weight
 * and Notes still have nothing to protect), each row now mirrors whatever
 * its own Settings equivalent actually does.
 */
export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const backHover = useHoverFade();
  const isPremium = usePremiumEntitlement();

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
          {isPremium ? (
            <LogRow
              styles={styles}
              colors={colors}
              icon="figure.strengthtraining.traditional"
              label="Past Session"
              subtitle="Which areas you trained, for a day you missed"
              onPress={handleOpenPastSession}
            />
          ) : null}
          <LogRow
            styles={styles}
            colors={colors}
            icon="scalemass"
            label="Weight"
            subtitle="Add today's or a past weigh-in"
            onPress={() => router.push('/settings/weight-history' as never)}
          />
          {isPremium ? (
            <LogRow
              styles={styles}
              colors={colors}
              icon="bed.double"
              label="Sleep"
              subtitle="Add tonight's or a past night's sleep"
              onPress={() => router.push('/settings/sleep-history' as never)}
            />
          ) : null}
          {isPremium ? (
            <LogRow
              styles={styles}
              colors={colors}
              icon="fork.knife"
              label="Nutrition"
              subtitle="Add today's or a past day's calories"
              onPress={() => router.push('/settings/nutrition-history' as never)}
            />
          ) : null}
          {isPremium ? (
            <LogRow
              styles={styles}
              colors={colors}
              icon="photo.on.rectangle"
              label="Progress Photo"
              subtitle="Add today's or a past photo"
              onPress={() => router.push('/settings/progress-photos' as never)}
            />
          ) : null}
          {isPremium ? (
            <LogRow
              styles={styles}
              colors={colors}
              icon="ruler"
              label="Body Measurements"
              subtitle="Waist, chest, and other numbers, for today or a past day"
              onPress={() => router.push('/settings/body-measurements' as never)}
            />
          ) : null}
          {isPremium ? (
            <LogRow
              styles={styles}
              colors={colors}
              icon="list.bullet.clipboard"
              label="Condition Log"
              subtitle="A symptom or condition worth recording, for today or a past day"
              onPress={() => router.push('/settings/condition-log' as never)}
            />
          ) : null}
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
      fontSize: Type.headerTitle,
      letterSpacing: -0.2,
      fontFamily: 'Geist-Bold',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      gap: 20,
    },
    introText: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
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
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-SemiBold',
    },
    rowSubtitle: {
      marginTop: 2,
      color: colors.textTertiary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Regular',
    },
  });
}
