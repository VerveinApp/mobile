import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as LocalAuthentication from 'expo-local-authentication';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

import appConfig from '../../../app.json';
import { isAppLockEnabled, setAppLockEnabled } from '@/lib/app-lock';
import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { clearCheckInHistory, getLastCheckIn } from '@/lib/check-in-history';
import { hapticError, hapticImpactLight, hapticWarning, isHapticsEnabled, setHapticsEnabled } from '@/lib/haptics';
import { clearOnboardingCompleted, clearOnboardingDraft } from '@/lib/onboarding-draft';
import { clearSessionHistory, getSessionHistory } from '@/lib/session-history';
import { useAppTheme } from '@/lib/theme-context';
import type { ThemePreference } from '@/lib/theme-preference';
import { clearTodaySession, getTodaySession } from '@/lib/today-session';
import { getUnitSystem, setUnitSystem, type UnitSystem } from '@/lib/unit-preference';
import { clearProfile, getProfile } from '@/lib/user-profile';
import { AdjustPlanSheet } from '@/components/settings/adjust-plan-sheet';
import { BiometricsSheet } from '@/components/settings/biometrics-sheet';
import { ConditionsSheet } from '@/components/settings/conditions-sheet';
import { MovementRestrictionsSheet } from '@/components/settings/movement-restrictions-sheet';

const UNIT_OPTIONS: { id: UnitSystem; label: string }[] = [
  { id: 'imperial', label: 'ft / lb' },
  { id: 'metric', label: 'cm / kg' },
];

const APPEARANCE_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

/**
 * Apple-Health-style grouped settings — reached from Profile's gear button.
 * Every row is either real (does exactly what it says) or visibly marked
 * "Coming soon": nothing here pretends to work when the app has no backend,
 * no push-notification wiring, and no HealthKit sync yet.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, resolvedScheme, preference, setPreference } = useAppTheme();
  // Exact original dark-mode value preserved; light mode gets its own
  // appropriately-visible track fill instead of reusing a token tuned for
  // something else.
  const hapticsTrackOff = resolvedScheme === 'dark' ? '#2a2a2a' : '#D1D1D6';
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [unit, setUnit] = useState<UnitSystem>('imperial');
  const [hapticsOn, setHapticsOn] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [appLockOn, setAppLockOn] = useState(false);
  const [appLockAvailable, setAppLockAvailable] = useState(false);
  const [appLockLabel, setAppLockLabel] = useState('App Lock');
  const biometricsSheetRef = useRef<BottomSheetModal>(null);
  const adjustPlanSheetRef = useRef<BottomSheetModal>(null);
  const conditionsSheetRef = useRef<BottomSheetModal>(null);
  const movementRestrictionsSheetRef = useRef<BottomSheetModal>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setUnit(await getUnitSystem());
        setHapticsOn(isHapticsEnabled());
        setAppLockOn(await isAppLockEnabled());
        const [hasHardware, isEnrolled, types] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);
        setAppLockAvailable(hasHardware && isEnrolled);
        setAppLockLabel(
          types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
            ? 'Face ID'
            : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
              ? 'Touch ID'
              : 'App Lock'
        );
        setLoaded(true);
      })();
    }, [])
  );

  const backHover = useHoverFade();
  const deleteHover = useHoverFade();
  const deletePress = useLiquidPress();
  const exportHover = useHoverFade();
  const termsHover = useHoverFade();
  const privacyHover = useHoverFade();
  const biometricsHover = useHoverFade();
  const adjustPlanHover = useHoverFade();
  const conditionsHover = useHoverFade();
  const movementRestrictionsHover = useHoverFade();
  const progressHover = useHoverFade();
  const imperialInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const metricInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const unitInteractions: Record<UnitSystem, typeof imperialInteraction> = {
    imperial: imperialInteraction,
    metric: metricInteraction,
  };
  const systemInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const lightInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const darkInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const appearanceInteractions: Record<ThemePreference, typeof systemInteraction> = {
    system: systemInteraction,
    light: lightInteraction,
    dark: darkInteraction,
  };

  const handleSelectUnit = (system: UnitSystem) => {
    if (system === unit) return;
    hapticImpactLight();
    setUnit(system);
    setUnitSystem(system);
  };

  const handleSelectAppearance = (next: ThemePreference) => {
    if (next === preference) return;
    hapticImpactLight();
    setPreference(next);
  };

  const handleToggleHaptics = (value: boolean) => {
    setHapticsOn(value);
    setHapticsEnabled(value);
    if (value) hapticImpactLight(); // confirms the switch itself still works once re-enabled
  };

  const handleToggleAppLock = async (value: boolean) => {
    if (!appLockAvailable) return;
    if (!value) {
      setAppLockOn(false);
      setAppLockEnabled(false);
      hapticImpactLight();
      return;
    }
    // Confirm the user can actually authenticate before committing to the
    // toggle — turning this on blind risks locking them out of their own app.
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Confirm ${appLockLabel} to enable App Lock`,
      cancelLabel: 'Cancel',
    });
    if (result.success) {
      setAppLockOn(true);
      setAppLockEnabled(true);
      hapticImpactLight();
    } else {
      hapticError();
    }
  };

  const handleExport = async () => {
    hapticImpactLight();
    const [profile, sessions, todaySession, lastCheckIn] = await Promise.all([
      getProfile(),
      getSessionHistory(),
      getTodaySession(),
      getLastCheckIn(),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      sessionHistory: sessions,
      todaySession,
      lastCheckIn,
    };
    try {
      await Share.share({ message: JSON.stringify(payload, null, 2) });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  };

  const handleDeleteData = async () => {
    hapticWarning();
    await Promise.all([
      clearOnboardingCompleted(),
      clearOnboardingDraft(),
      clearProfile(),
      clearCheckInHistory(),
      clearTodaySession(),
      clearSessionHistory(),
    ]);
    router.replace('/onboarding/welcome' as never);
  };

  if (!loaded) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          onHoverIn={backHover.onHoverIn}
          onHoverOut={backHover.onHoverOut}
          hitSlop={10}
          style={styles.backButton}
        >
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Section styles={styles} title="PROFILE">
          <View style={styles.card}>
            <NavRow
              styles={styles}
              colors={colors}
              icon="figure.arms.open"
              label="Body & Biometrics"
              onPress={() => biometricsSheetRef.current?.present()}
              hover={biometricsHover}
            />
            <NavRow
              styles={styles}
              colors={colors}
              icon="heart.text.square"
              label="Health Conditions"
              onPress={() => conditionsSheetRef.current?.present()}
              hover={conditionsHover}
            />
            <NavRow
              styles={styles}
              colors={colors}
              icon="figure.walk"
              label="Movement"
              onPress={() => movementRestrictionsSheetRef.current?.present()}
              hover={movementRestrictionsHover}
              last
            />
          </View>
        </Section>

        <Section styles={styles} title="TRAINING">
          <View style={styles.card}>
            <NavRow
              styles={styles}
              colors={colors}
              icon="slider.horizontal.3"
              label="Adjust My Plan"
              onPress={() => adjustPlanSheetRef.current?.present()}
              hover={adjustPlanHover}
              last
            />
          </View>
        </Section>

        <Section styles={styles} title="NOTIFICATIONS">
          <View style={styles.card}>
            <ComingSoonRow styles={styles} colors={colors} icon="bell.fill" label="Workout Reminders" subtitle="Push notifications aren't wired up yet" last />
          </View>
        </Section>

        <Section styles={styles} title="DATA">
          <View style={styles.card}>
            <NavRow
              styles={styles}
              colors={colors}
              icon="chart.bar.xaxis"
              label="Progress & History"
              onPress={() => router.push('/settings/progress-history' as never)}
              hover={progressHover}
            />
            <View style={[styles.unitRow, styles.rowDivider]}>
              <Text style={styles.rowLabel}>Units</Text>
              <View style={styles.unitPills}>
                {UNIT_OPTIONS.map((option) => {
                  const isSelected = unit === option.id;
                  const interaction = unitInteractions[option.id];
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => handleSelectUnit(option.id)}
                      onHoverIn={interaction.hover.onHoverIn}
                      onHoverOut={interaction.hover.onHoverOut}
                      onPressIn={interaction.press.onPressIn}
                      onPressOut={interaction.press.onPressOut}
                      style={styles.unitPillHit}
                    >
                      <View style={[styles.unitPillVisual, isSelected && styles.unitPillVisualSelected]}>
                        <Text style={[styles.unitPillText, isSelected && styles.unitPillTextSelected]}>
                          {option.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <ComingSoonRow styles={styles} colors={colors} icon="link" label="Integrations" subtitle="Apple Health sync isn't available yet" last />
          </View>
        </Section>

        <Section styles={styles} title="APP">
          <View style={styles.card}>
            <View style={[styles.unitRow, styles.rowDivider]}>
              <Text style={styles.rowLabel}>Appearance</Text>
              <View style={styles.appearancePills}>
                {APPEARANCE_OPTIONS.map((option) => {
                  const isSelected = preference === option.id;
                  const interaction = appearanceInteractions[option.id];
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => handleSelectAppearance(option.id)}
                      onHoverIn={interaction.hover.onHoverIn}
                      onHoverOut={interaction.hover.onHoverOut}
                      onPressIn={interaction.press.onPressIn}
                      onPressOut={interaction.press.onPressOut}
                      style={styles.unitPillHit}
                    >
                      <View style={[styles.unitPillVisual, isSelected && styles.unitPillVisualSelected]}>
                        <Text style={[styles.unitPillText, isSelected && styles.unitPillTextSelected]}>
                          {option.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchRowLeft}>
                <SymbolView name="iphone.radiowaves.left.and.right" size={15} tintColor="#5FBE84" style={styles.rowIcon} />
                <Text style={styles.rowLabel}>Haptics</Text>
              </View>
              <Switch
                value={hapticsOn}
                onValueChange={handleToggleHaptics}
                trackColor={{ false: hapticsTrackOff, true: '#438C63' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </Section>

        <Section styles={styles} title="PRIVACY & ACCOUNT">
          <View style={styles.card}>
            <AppLockRow
              styles={styles}
              colors={colors}
              label={appLockLabel}
              available={appLockAvailable}
              value={appLockOn && appLockAvailable}
              onValueChange={handleToggleAppLock}
              trackOffColor={hapticsTrackOff}
              last
            />
          </View>
          <Pressable
            onPress={handleExport}
            onHoverIn={exportHover.onHoverIn}
            onHoverOut={exportHover.onHoverOut}
          >
            <View style={styles.actionVisual}>
              <Text style={styles.actionText}>Export My Data</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={handleDeleteData}
            onHoverIn={deleteHover.onHoverIn}
            onHoverOut={deleteHover.onHoverOut}
            onPressIn={deletePress.onPressIn}
            onPressOut={deletePress.onPressOut}
          >
            <View style={styles.destructiveVisual}>
              <Text style={styles.destructiveText}>Delete My Data</Text>
            </View>
          </Pressable>
          <View style={styles.card}>
            <ComingSoonRow styles={styles} colors={colors} icon="person.crop.circle.badge.xmark" label="Account" subtitle="No account system yet" last />
          </View>
        </Section>

        <Section styles={styles} title="SUPPORT">
          <View style={styles.card}>
            <Pressable
              style={styles.aboutRow}
              onPress={() => {
                hapticImpactLight();
                router.push('/legal/terms' as never);
              }}
              onHoverIn={termsHover.onHoverIn}
              onHoverOut={termsHover.onHoverOut}
            >
              <Text style={styles.aboutRowLabel}>Terms of Service</Text>
              <SymbolView name="chevron.right" size={12} tintColor={colors.iconFaint} />
            </Pressable>
            <Pressable
              style={[styles.aboutRow, styles.rowDivider]}
              onPress={() => {
                hapticImpactLight();
                router.push('/legal/privacy' as never);
              }}
              onHoverIn={privacyHover.onHoverIn}
              onHoverOut={privacyHover.onHoverOut}
            >
              <Text style={styles.aboutRowLabel}>Privacy Policy</Text>
              <SymbolView name="chevron.right" size={12} tintColor={colors.iconFaint} />
            </Pressable>
            <ComingSoonRow styles={styles} colors={colors} icon="questionmark.circle" label="Help & Feedback" subtitle="No support channel yet" last />
          </View>
        </Section>

        <Text style={styles.footer}>Vervein v{appConfig.expo?.version ?? '1.0.0'}</Text>
      </ScrollView>

      <BiometricsSheet ref={biometricsSheetRef} />
      <AdjustPlanSheet ref={adjustPlanSheetRef} />
      <ConditionsSheet ref={conditionsSheetRef} />
      <MovementRestrictionsSheet ref={movementRestrictionsSheetRef} />
    </View>
  );
}

function Section({ styles, title, children }: { styles: ReturnType<typeof createStyles>; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionKicker}>{title}</Text>
      {children}
    </View>
  );
}

function NavRow({
  styles,
  colors,
  icon,
  label,
  onPress,
  hover,
  last = false,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: Record<string, string>;
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  hover: ReturnType<typeof useHoverFade>;
  last?: boolean;
}) {
  return (
    <Pressable
      style={[styles.navRow, !last && styles.rowDivider]}
      onPress={() => {
        hapticImpactLight();
        onPress();
      }}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
    >
      <View style={styles.switchRowLeft}>
        <SymbolView name={icon} size={15} tintColor="#5FBE84" style={styles.rowIcon} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <SymbolView name="chevron.right" size={12} tintColor={colors.iconFaint} />
    </Pressable>
  );
}

function AppLockRow({
  styles,
  colors,
  label,
  available,
  value,
  onValueChange,
  trackOffColor,
  last = false,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: Record<string, string>;
  label: string;
  available: boolean;
  value: boolean;
  onValueChange: (value: boolean) => void;
  trackOffColor: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.comingSoonRow, !last && styles.rowDivider]}>
      <View style={styles.switchRowLeft}>
        <SymbolView name="faceid" size={15} tintColor={available ? '#5FBE84' : colors.iconFaint} style={styles.rowIcon} />
        <View>
          <Text style={styles.rowLabel}>{label}</Text>
          {!available ? <Text style={styles.comingSoonSubtitle}>Not set up on this device</Text> : null}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={!available}
        trackColor={{ false: trackOffColor, true: '#438C63' }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

function ComingSoonRow({
  styles,
  colors,
  icon,
  label,
  subtitle,
  last = false,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: Record<string, string>;
  icon: SFSymbol;
  label: string;
  subtitle: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.comingSoonRow, !last && styles.rowDivider]}>
      <View style={styles.switchRowLeft}>
        <SymbolView name={icon} size={15} tintColor={colors.iconFaint} style={styles.rowIcon} />
        <View>
          <Text style={styles.comingSoonLabel}>{label}</Text>
          <Text style={styles.comingSoonSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.comingSoonBadge}>
        <Text style={styles.comingSoonBadgeText}>Soon</Text>
      </View>
    </View>
  );
}

function createStyles(colors: Record<string, string>) {
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
      gap: 24,
    },
    section: {
      gap: 10,
    },
    sectionKicker: {
      color: colors.textTertiary,
      fontSize: 11,
      letterSpacing: 1,
      fontFamily: 'Geist-SemiBold',
    },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    rowIcon: {
      width: 15,
      height: 15,
      marginRight: 10,
    },
    rowLabel: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    switchRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    unitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    unitPills: {
      flexDirection: 'row',
      gap: 8,
      width: 148,
    },
    appearancePills: {
      flexDirection: 'row',
      gap: 6,
      width: 190,
    },
    unitPillHit: {
      flex: 1,
      height: 26,
    },
    unitPillVisual: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
      backgroundColor: colors.pillBg,
    },
    unitPillVisualSelected: {
      borderColor: '#438C63',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    unitPillText: {
      color: colors.textSecondary,
      fontSize: 10.5,
      fontFamily: 'Geist-SemiBold',
    },
    unitPillTextSelected: {
      color: '#5FBE84',
    },
    comingSoonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    comingSoonLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    comingSoonSubtitle: {
      marginTop: 2,
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: 'Geist-Medium',
    },
    comingSoonBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: colors.badgeBg,
    },
    comingSoonBadgeText: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: 'Geist-SemiBold',
    },
    actionVisual: {
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      alignItems: 'center',
      marginBottom: 10,
    },
    actionText: {
      color: '#5FBE84',
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    destructiveVisual: {
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(229,72,77,0.3)',
      backgroundColor: colors.surface,
      alignItems: 'center',
      marginBottom: 10,
    },
    destructiveText: {
      color: '#E5484D',
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    aboutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    aboutRowLabel: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    footer: {
      textAlign: 'center',
      color: colors.textQuaternary,
      fontSize: 11,
      fontFamily: 'Geist-Medium',
    },
  });
}
