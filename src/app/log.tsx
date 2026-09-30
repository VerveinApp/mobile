import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SymbolView } from '@/components/ui/app-symbol';
import { LogPastSessionSheet } from '@/components/settings/log-past-session-sheet';
import { PremiumGate } from '@/components/premium-gate';
import { AndroidCardElevation, AndroidRipple, Type } from '@/constants/theme';
import { useHoverFade, PRESSED_DIM } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { usePremiumEntitlement } from '@/lib/purchases';
import { useAppColors } from '@/lib/theme-context';

/**
 * A quick-access hub for backfilling things about a day that already
 * happened.
 *
 * POLICY CHANGE (explicit product decision, not a bug fix): this whole hub
 * is now gated behind VerveIn Plus as a single unit, via the same
 * PremiumGate teaser every other Plus-only section in this app uses — never
 * hides that it exists, just swaps the row list for a locked card that
 * routes to the paywall on tap. This deliberately overrides the per-row
 * nuance the hub used to have (Weight/Notes/Past Session were reachable
 * free, Sleep/Nutrition logged free with only deeper history behind Plus,
 * and the consent-gated three had no premium check at all) — those
 * individual screens' own access logic is untouched and still reachable a
 * different way (e.g. Settings' own DATA section), only this hub's own
 * front door is now Plus-only.
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
          style={({ pressed }) => [styles.backButton, pressed && PRESSED_DIM]}
          android_ripple={{ ...AndroidRipple, borderless: true }}
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

        <PremiumGate isPremium={isPremium} label="Log" feature="history">
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
            icon="bed.double"
            label="Sleep"
            subtitle="Add tonight's or a past night's sleep"
            onPress={() => router.push('/settings/sleep-history' as never)}
          />
          <LogRow
            styles={styles}
            colors={colors}
            icon="fork.knife"
            label="Nutrition"
            subtitle="Add today's or a past day's calories"
            onPress={() => router.push('/settings/nutrition-history' as never)}
          />
          <LogRow
            styles={styles}
            colors={colors}
            icon="photo.on.rectangle"
            label="Progress Photo"
            subtitle="Add today's or a past photo"
            onPress={() => router.push('/settings/progress-photos' as never)}
          />
          <LogRow
            styles={styles}
            colors={colors}
            icon="ruler"
            label="Body Measurements"
            subtitle="Waist, chest, and other numbers, for today or a past day"
            onPress={() => router.push('/settings/body-measurements' as never)}
          />
          <LogRow
            styles={styles}
            colors={colors}
            icon="list.bullet.clipboard"
            label="Condition Log"
            subtitle="A symptom or condition worth recording, for today or a past day"
            onPress={() => router.push('/settings/condition-log' as never)}
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
        </PremiumGate>
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
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && PRESSED_DIM]}
      onPress={() => {
        hapticImpactLight();
        onPress();
      }}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      android_ripple={AndroidRipple}
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
      borderRadius: Platform.OS === 'android' ? 20 : 16,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...(Platform.OS === 'android'
        ? AndroidCardElevation
        : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceBorder }),
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
