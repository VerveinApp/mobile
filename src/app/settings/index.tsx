import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as LocalAuthentication from 'expo-local-authentication';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

import appConfig from '../../../app.json';
import { deleteAccount } from '@/lib/account';
import { isAppLockEnabled, setAppLockEnabled } from '@/lib/app-lock';
import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { buildBackupPayload, clearAllLocalData, parseBackupPayload, restoreBackupPayload, type BackupPayload } from '@/lib/data-backup';
import { hapticError, hapticImpactLight, hapticSuccess, hapticWarning, isHapticsEnabled, setHapticsEnabled } from '@/lib/haptics';
import { disconnectHealthKit, hasConnectedHealthKit, isHealthKitAvailable, requestHealthKitAccess } from '@/lib/health-kit';
import {
  disableSessionReminders,
  enableSessionReminders,
  isReminderEnabled,
  isReminderPermissionGranted,
  isReminderSupported,
} from '@/lib/session-reminders';
import { useAppTheme } from '@/lib/theme-context';
import type { ThemePreference } from '@/lib/theme-preference';
import { getUnitSystem, setUnitSystem, type UnitSystem } from '@/lib/unit-preference';
import { supabase } from '@/lib/supabase';
import { getProfile } from '@/lib/user-profile';
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
 * "Coming soon": nothing here pretends to work when it doesn't. Workout
 * Reminders is real (local, on-device scheduled notifications via
 * expo-notifications — see session-reminders.ts). Apple Health is real too
 * (see health-kit.ts) — same connect flow as the Home-tab banner, just
 * reachable here as well, with a working disconnect this row is the only
 * place in the app that actually calls. Account is real as well — there IS
 * a real backend (Supabase; see lib/supabase.ts) with working email-OTP
 * sign-in already wired at onboarding (create-account.tsx / auth/verify.tsx)
 * — this row just shows the real signed-in session and a real sign-out
 * instead of a stale "no account system yet" placeholder. What's still
 * genuinely absent: none of this app's actual data (profile, session
 * history, workout logs, calibration) syncs to that account anywhere —
 * every store stays local-only (AsyncStorage) regardless of auth state,
 * so nothing in the app currently gates on or reads the Supabase session
 * except this row and the two onboarding auth screens. Delete Account (see
 * account.ts) is real client code calling a real, written Edge Function
 * (supabase/functions/delete-account) — but that function may not be
 * deployed to this project yet, since deploying requires the developer's
 * own Supabase CLI login. If it isn't, deleteAccount() reports that
 * honestly (an inline error in the confirm modal, distinguishable from a
 * generic failure) rather than pretending the account was deleted.
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
  const [remindersOn, setRemindersOn] = useState(false);
  const [scheduledDaysCount, setScheduledDaysCount] = useState(0);
  const [remindersSupported, setRemindersSupported] = useState(false);
  const [healthKitOn, setHealthKitOn] = useState(false);
  const [healthKitAvailable, setHealthKitAvailable] = useState(false);
  // The real, already-live Supabase session (see onboarding/create-account.tsx
  // and auth/verify.tsx — email OTP sign-in genuinely works today) — null
  // means no session, not "loading," since this only ever gets set after
  // the real getSession() call below resolves. Nothing else in the app
  // reads or gates on this; it exists purely so this row can stop claiming
  // "No account system yet" when a real one already exists underneath.
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  // Import flow state — see handleOpenImport/handleValidateImport/
  // handleConfirmImport below. Two-step (paste, then confirm) rather than
  // one tap: restoring genuinely overwrites existing history, so this gets
  // the same "review before an irreversible action" treatment as
  // check-in.tsx's skip-confirm modal, not a blind one-tap action the way
  // "Delete My Data" currently is.
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<'paste' | 'confirm'>('paste');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null);
  const [lastRestoredAt, setLastRestoredAt] = useState<string | null>(null);
  // Delete Account flow state — see handleConfirmDeleteAccount below and
  // account.ts's own doc comment. Genuinely separate from "Delete My Data":
  // that clears local storage only; this also deletes the real Supabase
  // auth user server-side, so it gets its own confirm modal and its own
  // honest failure state (the Edge Function may not be deployed yet).
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
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
        const [remindersEnabled, remindersProfile, remindersSupportedNow] = await Promise.all([
          isReminderEnabled(),
          getProfile(),
          isReminderSupported(),
        ]);
        setRemindersSupported(remindersSupportedNow);
        // Re-verify the real OS permission, not just the stored preference —
        // if it was revoked in system Settings since being turned on here,
        // showing this toggle as still "on" would be exactly the kind of
        // pretends-to-work row this screen's own doc comment rules out.
        const stillPermitted = remindersEnabled ? await isReminderPermissionGranted() : false;
        if (remindersEnabled && !stillPermitted) await disableSessionReminders();
        setRemindersOn(stillPermitted);
        setScheduledDaysCount(remindersProfile?.days ? remindersProfile.days.split(',').filter(Boolean).length : 0);
        const [hkAvailable, hkConnected] = await Promise.all([isHealthKitAvailable(), hasConnectedHealthKit()]);
        setHealthKitAvailable(hkAvailable);
        setHealthKitOn(hkConnected);
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setAccountEmail(session?.user?.email ?? null);
        setLoaded(true);
      })();
    }, [])
  );

  const backHover = useHoverFade();
  const deleteHover = useHoverFade();
  const deletePress = useLiquidPress();
  const exportHover = useHoverFade();
  const importHover = useHoverFade();
  const termsHover = useHoverFade();
  const privacyHover = useHoverFade();
  const biometricsHover = useHoverFade();
  const weightHistoryHover = useHoverFade();
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

  const handleToggleReminders = async (value: boolean) => {
    if (!remindersSupported || scheduledDaysCount === 0) return;
    if (!value) {
      setRemindersOn(false);
      await disableSessionReminders();
      hapticImpactLight();
      return;
    }
    const profile = await getProfile();
    const days = profile?.days ? profile.days.split(',').filter(Boolean) : [];
    const granted = await enableSessionReminders(days);
    if (granted) {
      setRemindersOn(true);
      hapticImpactLight();
    } else {
      // Permission denied at the OS prompt — the toggle reverts rather than
      // showing "on" for something that can't actually fire.
      hapticError();
    }
  };

  const handleToggleHealthKit = async (value: boolean) => {
    if (!healthKitAvailable) return;
    if (!value) {
      // Clears only Vervein's own "connected" flag — HealthKit itself never
      // lets an app revoke permissions it already granted; the real grant
      // can only be changed in iOS Settings. See health-kit.ts's own doc
      // comment on CONNECTED_KEY for why this is still an honest toggle
      // rather than a fake one: it's tracking "does Vervein use this data,"
      // not "does iOS still permit it."
      setHealthKitOn(false);
      await disconnectHealthKit();
      hapticImpactLight();
      return;
    }
    const granted = await requestHealthKitAccess();
    if (granted) {
      setHealthKitOn(true);
      hapticImpactLight();
    } else {
      hapticError();
    }
  };

  // No confirm modal, unlike Delete My Data/Import — this is a genuinely
  // low-stakes action, not a hidden one. Nothing in this app gates any
  // screen or local data behind auth (grepped: supabase is only ever
  // touched by this row and the two onboarding auth screens), so signing
  // out can't strand the user or lose anything — it's trivially reversible
  // by signing back in with the same email.
  const handleSignOut = async () => {
    hapticImpactLight();
    await supabase.auth.signOut();
    setAccountEmail(null);
  };

  // Real backup payload (see data-backup.ts) — the same shape
  // handleConfirmImport below can read back in, so Export now round-trips
  // instead of being a one-way dead end (the gap this pair of handlers
  // exists to close).
  const handleExport = async () => {
    hapticImpactLight();
    const payload = await buildBackupPayload();
    try {
      await Share.share({ message: JSON.stringify(payload, null, 2) });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  };

  const handleOpenImport = () => {
    hapticImpactLight();
    setImportStep('paste');
    setImportText('');
    setImportError(null);
    setPendingImport(null);
    setShowImportModal(true);
  };

  const handleCancelImport = () => {
    hapticImpactLight();
    setShowImportModal(false);
  };

  // Paste → validate step. Never writes anything yet — parseBackupPayload
  // is pure, so a malformed paste just shows an error inline and the user
  // can edit and retry without anything having touched real storage.
  const handleValidateImport = () => {
    const result = parseBackupPayload(importText.trim());
    if (!result.ok) {
      hapticError();
      setImportError(result.error);
      return;
    }
    hapticImpactLight();
    setImportError(null);
    setPendingImport(result.payload);
    setImportStep('confirm');
  };

  // The one step that actually overwrites stored data — only reachable
  // after the explicit confirm step above, matching this app's standing
  // "confirm before an irreversible action" rule.
  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    await restoreBackupPayload(pendingImport);
    hapticSuccess();
    setShowImportModal(false);
    setLastRestoredAt(new Date().toLocaleDateString());
  };

  const handleDeleteData = async () => {
    hapticWarning();
    await clearAllLocalData();
    router.replace('/onboarding/welcome' as never);
  };

  const handleOpenDeleteAccount = () => {
    hapticWarning();
    setDeleteAccountError(null);
    setShowDeleteAccountModal(true);
  };

  const handleCancelDeleteAccount = () => {
    if (deletingAccount) return;
    hapticImpactLight();
    setShowDeleteAccountModal(false);
  };

  // See account.ts's deleteAccount() for the honest-failure cases this
  // handles (the Edge Function isn't deployed yet, or a real server error) —
  // local data and the Supabase session are only ever cleared after the
  // server confirms the account itself is actually gone, so a failed call
  // never leaves someone signed out of an account that still exists.
  const handleConfirmDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteAccountError(null);
    const result = await deleteAccount();
    if (!result.ok) {
      setDeletingAccount(false);
      hapticError();
      setDeleteAccountError(result.error);
      return;
    }
    await clearAllLocalData();
    await supabase.auth.signOut();
    setShowDeleteAccountModal(false);
    setDeletingAccount(false);
    hapticWarning();
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
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Settings</Text>
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
              icon="scalemass"
              label="Weight History"
              onPress={() => router.push('/settings/weight-history' as never)}
              hover={weightHistoryHover}
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
            <AppLockRow
              styles={styles}
              colors={colors}
              icon="bell.fill"
              label="Workout Reminders"
              available={remindersSupported && scheduledDaysCount > 0}
              value={remindersOn && remindersSupported && scheduledDaysCount > 0}
              onValueChange={handleToggleReminders}
              trackOffColor={hapticsTrackOff}
              unavailableSubtitle={!remindersSupported ? 'Not available in this app build' : 'Set your training days first'}
              last
            />
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
              <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>Units</Text>
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
                        <Text
                          style={[styles.unitPillText, isSelected && styles.unitPillTextSelected]}
                          maxFontSizeMultiplier={1.2}
                        >
                          {option.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <AppLockRow
              styles={styles}
              colors={colors}
              icon="link"
              label="Apple Health"
              available={healthKitAvailable}
              value={healthKitOn && healthKitAvailable}
              onValueChange={handleToggleHealthKit}
              trackOffColor={hapticsTrackOff}
              unavailableSubtitle="Not available on this device"
              last
            />
          </View>
        </Section>

        <Section styles={styles} title="APP">
          <View style={styles.card}>
            <View style={[styles.unitRow, styles.rowDivider]}>
              <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>Appearance</Text>
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
                        <Text
                          style={[styles.unitPillText, isSelected && styles.unitPillTextSelected]}
                          maxFontSizeMultiplier={1.2}
                        >
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
                <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>Haptics</Text>
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
              <Text style={styles.actionText} maxFontSizeMultiplier={1.2}>Export My Data</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={handleOpenImport}
            onHoverIn={importHover.onHoverIn}
            onHoverOut={importHover.onHoverOut}
          >
            <View style={styles.actionVisual}>
              <Text style={styles.actionText} maxFontSizeMultiplier={1.2}>Import My Data</Text>
            </View>
          </Pressable>
          {lastRestoredAt ? (
            <Text style={styles.importConfirmText} maxFontSizeMultiplier={1.3}>
              Restored from backup on {lastRestoredAt}.
            </Text>
          ) : null}

          <Modal
            visible={showImportModal}
            transparent
            animationType="fade"
            onRequestClose={handleCancelImport}
            statusBarTranslucent
          >
            <Pressable style={styles.importBackdrop} onPress={handleCancelImport}>
              <Pressable style={styles.importCard} onPress={() => {}}>
                {importStep === 'paste' ? (
                  <>
                    <Text style={styles.importTitle} maxFontSizeMultiplier={1.3}>Import My Data</Text>
                    <Text style={styles.importBody} maxFontSizeMultiplier={1.4}>
                      Paste the backup you saved from Export My Data.
                    </Text>
                    <TextInput
                      style={styles.importInput}
                      value={importText}
                      onChangeText={(text) => {
                        setImportText(text);
                        if (importError) setImportError(null);
                      }}
                      placeholder="Paste your exported backup here"
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxFontSizeMultiplier={1.3}
                    />
                    {importError ? (
                      <Text style={styles.importErrorText} maxFontSizeMultiplier={1.3}>{importError}</Text>
                    ) : null}
                    <View style={styles.importActions}>
                      <Pressable style={styles.importCancelHit} onPress={handleCancelImport} hitSlop={8}>
                        <Text style={styles.importCancelText} maxFontSizeMultiplier={1.2}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.importConfirmHit, importText.trim().length === 0 && styles.importConfirmHitDisabled]}
                        onPress={handleValidateImport}
                        disabled={importText.trim().length === 0}
                        hitSlop={8}
                      >
                        <Text style={styles.importConfirmHitText} maxFontSizeMultiplier={1.2}>Continue</Text>
                      </Pressable>
                    </View>
                  </>
                ) : pendingImport ? (
                  <>
                    <Text style={styles.importTitle} maxFontSizeMultiplier={1.3}>Replace current data?</Text>
                    <Text style={styles.importBody} maxFontSizeMultiplier={1.4}>
                      This backup is from {new Date(pendingImport.exportedAt).toLocaleDateString()} and has{' '}
                      {pendingImport.sessionHistory.length} logged session
                      {pendingImport.sessionHistory.length === 1 ? '' : 's'}. Restoring replaces your current profile,
                      calibration, and history with what&apos;s in this backup — it can&apos;t be undone.
                    </Text>
                    <View style={styles.importActions}>
                      <Pressable
                        style={styles.importCancelHit}
                        onPress={() => setImportStep('paste')}
                        hitSlop={8}
                      >
                        <Text style={styles.importCancelText} maxFontSizeMultiplier={1.2}>Back</Text>
                      </Pressable>
                      <Pressable style={styles.importDestructiveHit} onPress={handleConfirmImport} hitSlop={8}>
                        <Text style={styles.importDestructiveHitText} maxFontSizeMultiplier={1.2}>Replace Data</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </Pressable>
            </Pressable>
          </Modal>

          <Pressable
            onPress={handleDeleteData}
            onHoverIn={deleteHover.onHoverIn}
            onHoverOut={deleteHover.onHoverOut}
            onPressIn={deletePress.onPressIn}
            onPressOut={deletePress.onPressOut}
          >
            <View style={styles.destructiveVisual}>
              <Text style={styles.destructiveText} maxFontSizeMultiplier={1.2}>Delete My Data</Text>
            </View>
          </Pressable>
          <View style={styles.card}>
            {accountEmail ? (
              <>
                <View style={[styles.comingSoonRow, styles.rowDivider]}>
                  <View style={styles.switchRowLeft}>
                    <SymbolView name="person.crop.circle.fill" size={15} tintColor="#5FBE84" style={styles.rowIcon} />
                    <View>
                      <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>Signed in</Text>
                      <Text style={styles.comingSoonSubtitle} maxFontSizeMultiplier={1.3}>{accountEmail}</Text>
                    </View>
                  </View>
                </View>
                <Pressable style={[styles.comingSoonRow, styles.rowDivider]} onPress={handleSignOut}>
                  <Text style={styles.signOutText} maxFontSizeMultiplier={1.3}>Sign Out</Text>
                </Pressable>
                <Pressable style={styles.comingSoonRow} onPress={handleOpenDeleteAccount}>
                  <Text style={styles.deleteAccountRowText} maxFontSizeMultiplier={1.3}>Delete Account</Text>
                </Pressable>
              </>
            ) : (
              <ComingSoonRow styles={styles} colors={colors} icon="person.crop.circle.badge.xmark" label="Account" subtitle="Not signed in" last />
            )}
          </View>

          <Modal
            visible={showDeleteAccountModal}
            transparent
            animationType="fade"
            onRequestClose={handleCancelDeleteAccount}
            statusBarTranslucent
          >
            <Pressable style={styles.importBackdrop} onPress={handleCancelDeleteAccount}>
              <Pressable style={styles.importCard} onPress={() => {}}>
                <Text style={styles.importTitle} maxFontSizeMultiplier={1.3}>Delete your account?</Text>
                <Text style={styles.importBody} maxFontSizeMultiplier={1.4}>
                  This permanently deletes the sign-in for {accountEmail} — it can&apos;t be undone. Your on-device
                  profile, history, and logs are cleared too, the same as Delete My Data.
                </Text>
                {deleteAccountError ? (
                  <Text style={styles.importErrorText} maxFontSizeMultiplier={1.3}>{deleteAccountError}</Text>
                ) : null}
                <View style={styles.importActions}>
                  <Pressable
                    style={styles.importCancelHit}
                    onPress={handleCancelDeleteAccount}
                    hitSlop={8}
                    disabled={deletingAccount}
                  >
                    <Text style={styles.importCancelText} maxFontSizeMultiplier={1.2}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.importDestructiveHit, deletingAccount && styles.importConfirmHitDisabled]}
                    onPress={handleConfirmDeleteAccount}
                    hitSlop={8}
                    disabled={deletingAccount}
                  >
                    <Text style={styles.importDestructiveHitText} maxFontSizeMultiplier={1.2}>
                      {deletingAccount ? 'Deleting…' : 'Delete Account'}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
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
              <Text style={styles.aboutRowLabel} maxFontSizeMultiplier={1.2}>Terms of Service</Text>
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
              <Text style={styles.aboutRowLabel} maxFontSizeMultiplier={1.2}>Privacy Policy</Text>
              <SymbolView name="chevron.right" size={12} tintColor={colors.iconFaint} />
            </Pressable>
            <ComingSoonRow styles={styles} colors={colors} icon="questionmark.circle" label="Help & Feedback" subtitle="No support channel yet" last />
          </View>
        </Section>

        <Text style={styles.footer} maxFontSizeMultiplier={1.3}>VerveIn v{appConfig.expo?.version ?? '1.0.0'}</Text>
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
      <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>{title}</Text>
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
        <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      </View>
      <SymbolView name="chevron.right" size={12} tintColor={colors.iconFaint} />
    </Pressable>
  );
}

function AppLockRow({
  styles,
  colors,
  icon = 'faceid',
  label,
  available,
  value,
  onValueChange,
  trackOffColor,
  unavailableSubtitle = 'Not set up on this device',
  last = false,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: Record<string, string>;
  icon?: SFSymbol;
  label: string;
  available: boolean;
  value: boolean;
  onValueChange: (value: boolean) => void;
  trackOffColor: string;
  unavailableSubtitle?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.comingSoonRow, !last && styles.rowDivider]}>
      <View style={styles.switchRowLeft}>
        <SymbolView name={icon} size={15} tintColor={available ? '#5FBE84' : colors.iconFaint} style={styles.rowIcon} />
        <View>
          <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
          {!available ? (
            <Text style={styles.comingSoonSubtitle} maxFontSizeMultiplier={1.3}>{unavailableSubtitle}</Text>
          ) : null}
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
          <Text style={styles.comingSoonLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
          <Text style={styles.comingSoonSubtitle} maxFontSizeMultiplier={1.3}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.comingSoonBadge}>
        <Text style={styles.comingSoonBadgeText} maxFontSizeMultiplier={1.2}>Soon</Text>
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
    // Deliberately not the destructive red — signing out loses nothing (see
    // handleSignOut's own comment on why), so it doesn't carry the same
    // warning weight as Delete My Data.
    signOutText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    deleteAccountRowText: {
      color: '#E5484D',
      fontSize: 13,
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
    importConfirmText: {
      marginBottom: 10,
      textAlign: 'center',
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: 'Geist-Medium',
    },
    importBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    importCard: {
      width: '100%',
      maxWidth: 340,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 22,
      paddingVertical: 22,
      gap: 8,
    },
    importTitle: {
      color: colors.text,
      fontSize: 16,
      fontFamily: 'Geist-SemiBold',
      textAlign: 'center',
    },
    importBody: {
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: 'Geist-Medium',
      textAlign: 'center',
    },
    importInput: {
      marginTop: 6,
      height: 120,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.pillBg,
      padding: 12,
      color: colors.text,
      fontSize: 12,
      fontFamily: 'Geist-Regular',
      textAlignVertical: 'top',
    },
    importErrorText: {
      marginTop: 4,
      color: '#E5484D',
      fontSize: 12,
      fontFamily: 'Geist-Medium',
      textAlign: 'center',
    },
    importActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    importCancelHit: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 14,
      alignItems: 'center',
    },
    importCancelText: {
      color: colors.textTertiary,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
      textDecorationLine: 'underline',
    },
    importConfirmHit: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: '#438C63',
      alignItems: 'center',
    },
    importConfirmHitDisabled: {
      opacity: 0.4,
    },
    importConfirmHitText: {
      color: '#ffffff',
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    importDestructiveHit: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: '#E5484D',
      alignItems: 'center',
    },
    importDestructiveHitText: {
      color: '#ffffff',
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
