import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as LocalAuthentication from 'expo-local-authentication';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';
import type { SFSymbol } from 'sf-symbols-typescript';

import appConfig from '../../../app.json';
import { deleteAccount } from '@/lib/account';
import { isAppLockEnabled, setAppLockEnabled } from '@/lib/app-lock';
import { AndroidCardElevation, AndroidRipple, Type } from '@/constants/theme';
import { useHoverFade, useLiquidPress, PRESSED_DIM } from '@/lib/button-interactions';
import { buildBackupPayload, clearAllLocalData, parseBackupPayload, restoreBackupPayload, type BackupPayload } from '@/lib/data-backup';
import {
  getSubscriptionManagementUrl,
  usePremiumEntitlement,
} from '@/lib/purchases';
import { hapticError, hapticImpactLight, hapticSuccess, hapticWarning, isHapticsEnabled, setHapticsEnabled } from '@/lib/haptics';
import {
  disconnectHealthKit,
  getLastRestingHeartRateSyncDate,
  hasConnectedHealthKit,
  isHealthKitAvailable,
  requestHealthKitAccess,
} from '@/lib/health-kit';
import { CONTACT_EMAIL } from '@/lib/legal/terms-content';
import { localDateStr } from '@/lib/local-date';
import { deleteRemoteProfile } from '@/lib/profile-sync';
import { registerForRemotePushNotifications, unregisterPushTokenForThisDevice } from '@/lib/push-notifications';
import { forgetLocalDataOwner } from '@/lib/account-switch';
import { useFadeInEntering } from '@/lib/screen-transitions';
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
import { getProfile, updateProfile } from '@/lib/user-profile';
import { AdjustPlanSheet } from '@/components/settings/adjust-plan-sheet';
import { BiometricsSheet } from '@/components/settings/biometrics-sheet';
import { ConditionsSheet } from '@/components/settings/conditions-sheet';
import { GoalsSheet } from '@/components/settings/goals-sheet';
import { PremiumGate } from '@/components/premium-gate';
import { openPaywall } from '@/lib/plus-features';
import { MovementRestrictionsSheet } from '@/components/settings/movement-restrictions-sheet';
import { StandingSymptomsSheet } from '@/components/settings/standing-symptoms-sheet';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';

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
 * instead of a stale "no account system yet" placeholder. The profile
 * itself now syncs too (see lib/profile-sync.ts) — every local save
 * best-effort mirrors to a real per-account row, and sign-in restores it on
 * a device with no local profile instead of forcing onboarding again. What
 * remains genuinely local-only: session history, workout logs, and
 * calibration — none of that syncs to the account anywhere yet, so a new
 * device gets a real profile back but starts that history fresh. Delete
 * Account (see account.ts) is real client code calling a real Edge Function
 * (supabase/functions/delete-account), deployed 2026-09-13 and verified live.
 * deleteAccount() still distinguishes a "not deployed" failure from a
 * generic one in its result type, as a defensive fallback rather than dead
 * code — see that function's own comment.
 */
/** Settings' own "Last synced" line — see getLastRestingHeartRateSyncDate's
 * doc comment for why this exists here specifically. UTC-midnight date-diff,
 * same pattern as check-in.tsx's daysSinceLastCheckIn, to avoid a local-time
 * DST edge case skewing the day count by one. */
function formatLastSync(dateStr: string | null): string | null {
  if (dateStr === null) return 'No recent sync';
  const days = Math.round(
    (Date.parse(`${localDateStr()}T00:00:00Z`) - Date.parse(`${dateStr}T00:00:00Z`)) / 86400000
  );
  if (days <= 0) return 'Last synced today';
  if (days === 1) return 'Last synced yesterday';
  return `Last synced ${days} days ago`;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, resolvedScheme, preference, setPreference } = useAppTheme();
  // Exact original dark-mode value preserved; light mode gets its own
  // appropriately-visible track fill instead of reusing a token tuned for
  // something else.
  const hapticsTrackOff = resolvedScheme === 'dark' ? '#2a2a2a' : '#D1D1D6';
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isPremium = usePremiumEntitlement();
  const [unit, setUnit] = useState<UnitSystem>('imperial');
  const [hapticsOn, setHapticsOn] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [appLockOn, setAppLockOn] = useState(false);
  const [appLockAvailable, setAppLockAvailable] = useState(false);
  const [appLockLabel, setAppLockLabel] = useState('App Lock');
  const [remindersOn, setRemindersOn] = useState(false);
  // Set when turning reminders on fails because iOS has notifications off
  // for the app — iOS never re-asks, so the only way forward is Settings.
  const [remindersBlocked, setRemindersBlocked] = useState(false);
  const [scheduledDaysCount, setScheduledDaysCount] = useState(0);
  const [remindersSupported, setRemindersSupported] = useState(false);
  const [healthKitOn, setHealthKitOn] = useState(false);
  const [healthKitAvailable, setHealthKitAvailable] = useState(false);
  // Null covers both "not connected" and "connected but no sample in the
  // last 10 days" — see getLastRestingHeartRateSyncDate's own doc comment
  // for why Settings, unlike Home/check-in, answers that gap directly.
  const [healthKitLastSync, setHealthKitLastSync] = useState<string | null>(null);
  // The real, already-live Supabase session (see onboarding/create-account.tsx
  // and auth/verify.tsx — email OTP sign-in genuinely works today) — null
  // means no session, not "loading," since this only ever gets set after
  // the real getSession() call below resolves. Nothing else in the app
  // reads or gates on this; it exists purely so this row can stop claiming
  // "No account system yet" when a real one already exists underneath.
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  // Import flow state — see handleOpenImport/handleValidateImport/
  // handleConfirmImport below. Two-step (paste, then confirm) rather than
  // one tap: restoring genuinely overwrites existing history, so this gets
  // the same "review before an irreversible action" treatment as
  // check-in.tsx's skip-confirm modal, and Delete My Data below.
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<'paste' | 'confirm'>('paste');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null);
  const [lastRestoredAt, setLastRestoredAt] = useState<string | null>(null);
  // Guards handleConfirmImport against a fast double-tap firing two
  // concurrent restoreBackupPayload calls — same disabled-during-await
  // pattern the Delete Account modal already uses below.
  const [restoringImport, setRestoringImport] = useState(false);
  // Delete Account flow state — see handleConfirmDeleteAccount below and
  // account.ts's own doc comment. Genuinely separate from "Delete My Data":
  // that clears local storage only; this also deletes the real Supabase
  // auth user server-side, so it gets its own confirm modal and its own
  // honest failure state (the Edge Function may not be deployed yet).
  // Delete My Data flow state — see handleOpenDeleteData/handleConfirmDeleteData
  // below. This used to be a single blind one-tap Pressable with no review
  // step, inconsistent with Import and Delete Account right next to it; now
  // gated behind the same confirm-modal pattern as those.
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const biometricsSheetRef = useRef<BottomSheetModal>(null);
  const adjustPlanSheetRef = useRef<BottomSheetModal>(null);
  const conditionsSheetRef = useRef<BottomSheetModal>(null);
  const goalsSheetRef = useRef<BottomSheetModal>(null);
  const movementRestrictionsSheetRef = useRef<BottomSheetModal>(null);
  const standingSymptomsSheetRef = useRef<BottomSheetModal>(null);

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
        // "Face ID"/"Touch ID" are real Apple product names, correct only on
        // iOS hardware — Android's own face/fingerprint unlock is the same
        // AuthenticationType from this API but isn't either of those
        // trademarked features, so it gets the generic name instead.
        setAppLockLabel(
          types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
            ? Platform.OS === 'ios'
              ? 'Face ID'
              : 'Face Unlock'
            : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
              ? Platform.OS === 'ios'
                ? 'Touch ID'
                : 'Fingerprint'
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
        setProfileName(remindersProfile?.name ?? null);
        const [hkAvailable, hkConnected] = await Promise.all([isHealthKitAvailable(), hasConnectedHealthKit()]);
        setHealthKitAvailable(hkAvailable);
        setHealthKitOn(hkConnected);
        if (hkConnected) setHealthKitLastSync(await getLastRestingHeartRateSyncDate());
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setAccountEmail(session?.user?.email ?? null);
        setLoaded(true);
      })();
    }, [])
  );

  const entering = useFadeInEntering();
  const backHover = useHoverFade();
  const signInHover = useHoverFade();
  const deleteHover = useHoverFade();
  const deletePress = useLiquidPress();
  const exportHover = useHoverFade();
  const importHover = useHoverFade();
  const termsHover = useHoverFade();
  const privacyHover = useHoverFade();
  const biometricsHover = useHoverFade();
  const weightHistoryHover = useHoverFade();
  const goalsHover = useHoverFade();
  const referralHover = useHoverFade();
  const manageSubscriptionHover = useHoverFade();
  const getPlusHover = useHoverFade();
  const adjustPlanHover = useHoverFade();
  const conditionsHover = useHoverFade();
  const movementRestrictionsHover = useHoverFade();
  const standingSymptomsHover = useHoverFade();
  const progressHover = useHoverFade();
  const bodyMeasurementsHover = useHoverFade();
  const conditionLogHover = useHoverFade();
  const progressPhotosHover = useHoverFade();
  const sleepHistoryHover = useHoverFade();
  const nutritionHistoryHover = useHoverFade();
  const nameHover = useHoverFade();
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
      setRemindersBlocked(false);
      hapticImpactLight();
      // Same permission covers remote pushes — register now rather than
      // waiting for the next cold launch (see push-notifications.ts).
      registerForRemotePushNotifications();
    } else {
      // Permission denied at the OS prompt — the toggle reverts rather than
      // showing "on" for something that can't actually fire. It used to
      // revert with only an error buzz, which read as a broken switch to
      // anyone who'd declined the prompt once; the line below the row now
      // says why and links to where it can be changed.
      setRemindersBlocked(true);
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
      setHealthKitLastSync(null);
      await disconnectHealthKit();
      hapticImpactLight();
      return;
    }
    const granted = await requestHealthKitAccess();
    if (granted) {
      setHealthKitOn(true);
      setHealthKitLastSync(await getLastRestingHeartRateSyncDate());
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
  //
  // Navigates to create-account.tsx (the email-entry screen) with no
  // onboarding params — previously this left the user sitting on Settings
  // with no visible "you're signed out" moment at all. verify.tsx's own
  // hasCompletedOnboarding() check is what makes this safe: since this
  // device's local profile is untouched by sign-out, re-verifying routes
  // straight back to the main app instead of re-running onboarding or
  // overwriting the real profile with the empty params this path carries.
  const handleSignOut = async () => {
    hapticImpactLight();
    // While still signed in — the delete is scoped to this account's own row.
    await unregisterPushTokenForThisDevice();
    await supabase.auth.signOut();
    setAccountEmail(null);
    // dismissAll() first, not just replace() — this whole app lives in one
    // flat root Stack (see app/_layout.tsx's own comment), so replace() on
    // its own only swaps the current screen and leaves everything pushed
    // before it (including (tabs), fully alive with local data that
    // sign-out never touches) reachable with a single edge-swipe-back.
    router.dismissAll();
    router.replace('/onboarding/create-account' as never);
  };

  // Opens the App Store's/Play Store's own subscription-management page —
  // same silent-no-op-on-failure convention as this app's other
  // non-critical external calls (see health-kit.ts) rather than an error
  // alert over what's ultimately just a navigation shortcut; the user can
  // always reach the same place through the OS Settings app directly.
  const handleManageSubscription = async () => {
    hapticImpactLight();
    const url = await getSubscriptionManagementUrl();
    if (url) Linking.openURL(url);
  };

  const handleOpenEditName = () => {
    hapticImpactLight();
    setNameDraft(profileName ?? '');
    setShowEditNameModal(true);
  };

  const handleCancelEditName = () => {
    if (savingName) return;
    hapticImpactLight();
    setShowEditNameModal(false);
  };

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || savingName) return;
    setSavingName(true);
    await updateProfile({ name: trimmed });
    setProfileName(trimmed);
    setSavingName(false);
    setShowEditNameModal(false);
    hapticSuccess();
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
    if (restoringImport) return;
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
    if (!pendingImport || restoringImport) return;
    setRestoringImport(true);
    await restoreBackupPayload(pendingImport);
    setRestoringImport(false);
    hapticSuccess();
    setShowImportModal(false);
    setLastRestoredAt(new Date().toLocaleDateString());
  };

  const handleOpenDeleteData = () => {
    hapticWarning();
    setShowDeleteDataModal(true);
  };

  const handleCancelDeleteData = () => {
    if (deletingData) return;
    hapticImpactLight();
    setShowDeleteDataModal(false);
  };

  const handleConfirmDeleteData = async () => {
    if (deletingData) return;
    setDeletingData(true);
    hapticWarning();
    // The synced copy too — otherwise "permanently clears your profile" left
    // its health fields on the server (see deleteRemoteProfile).
    await deleteRemoteProfile();
    await clearAllLocalData();
    setDeletingData(false);
    router.dismissAll();
    // BUG FIX: this used to always land on Welcome, which — since Delete My
    // Data never signs out or touches the real account (that's Delete
    // Account's own, separate confirm flow) — made it look like the account
    // itself was gone. A first attempt at fixing that pulled the synced
    // profile back down and dropped straight into (tabs), but that silently
    // undid the deletion for anyone with a synced profile — the opposite
    // problem, and a direct contradiction of this feature's own "permanently
    // clears... can't be undone" promise in the confirm modal above. Neither
    // extreme is right: still signed in (accountEmail) means no re-verification
    // is needed, so this carries the email forward as the exact same
    // verifiedEmail route param auth/verify.tsx's own "no local profile,
    // nothing to restore" branch already uses — into the real questionnaire
    // to genuinely rebuild a profile, not Welcome's "create an account" framing
    // and not a silent restore.
    if (accountEmail) {
      router.replace({ pathname: '/onboarding', params: { verifiedEmail: accountEmail } } as never);
    } else {
      router.replace('/onboarding/welcome' as never);
    }
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
    await forgetLocalDataOwner();
    await supabase.auth.signOut();
    setShowDeleteAccountModal(false);
    setDeletingAccount(false);
    hapticWarning();
    // Same dismissAll()-then-replace() fix as handleSignOut above, for the
    // same reason — otherwise (tabs) is still one edge-swipe-back away.
    router.dismissAll();
    router.replace('/onboarding/welcome' as never);
  };


  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          onHoverIn={backHover.onHoverIn}
          onHoverOut={backHover.onHoverOut}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && PRESSED_DIM]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      {!loaded ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <SkeletonCard height={90} lines={2} />
          <View style={styles.skeletonSection}>
            <SkeletonBlock width={60} height={11} borderRadius={4} />
            <SkeletonCard height={180} lines={4} />
          </View>
          <View style={styles.skeletonSection}>
            <SkeletonBlock width={80} height={11} borderRadius={4} />
            <SkeletonCard height={120} lines={3} />
          </View>
        </ScrollView>
      ) : (
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Section styles={styles} title="PROFILE">
          <View style={styles.card}>
            <NavRow
              styles={styles}
              colors={colors}
              icon="person.text.rectangle.fill"
              label="Name"
              subtitle={profileName ?? undefined}
              onPress={handleOpenEditName}
              hover={nameHover}
            />
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
              // Same Plus gate as the DATA section and log.tsx's Log hub
              // (its own matching "Weight" row) — this row is the third,
              // otherwise-free door to the same feature those two now lock.
              onPress={() => (isPremium ? router.push('/settings/weight-history' as never) : openPaywall('history'))}
              hover={weightHistoryHover}
              locked={!isPremium}
            />
            <NavRow
              styles={styles}
              colors={colors}
              icon="target"
              label="Goals"
              onPress={() => (isPremium ? goalsSheetRef.current?.present() : openPaywall('goals'))}
              hover={goalsHover}
              locked={!isPremium}
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
            />
            <NavRow
              styles={styles}
              colors={colors}
              icon="bandage"
              label="Ongoing Symptoms"
              onPress={() => standingSymptomsSheetRef.current?.present()}
              hover={standingSymptomsHover}
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
            />
            <View style={styles.unitRow}>
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
            {remindersBlocked ? (
              <Pressable
                onPress={() => Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel="Notifications are turned off for VerveIn. Open Settings to allow them."
                style={styles.permissionHint}
              >
                <Text style={styles.permissionHintText} maxFontSizeMultiplier={1.3}>
                  Notifications are turned off for VerveIn.{' '}
                  <Text style={styles.permissionHintLink}>Open Settings</Text> to allow them.
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Section>

        {/* POLICY CHANGE (explicit product decision, not a bug fix): this
            whole section is now gated behind VerveIn Plus as a single unit,
            same PremiumGate teaser as every other Plus-only section in this
            app — never hides that it exists, just swaps the row list for a
            locked card that routes to the paywall. This deliberately
            overrides the per-row nuance this section used to have (see
            log.tsx's own matching change, made at the same time, for the
            full history of why that nuance existed and was intentionally
            given up here). */}
        <Section styles={styles} title="DATA">
          <PremiumGate isPremium={isPremium} label="Data" feature="history">
          <View style={styles.card}>
            <NavRow
              styles={styles}
              colors={colors}
              icon="chart.bar.xaxis"
              label="Progress & History"
              onPress={() => router.push('/settings/progress-history' as never)}
              hover={progressHover}
            />
            <NavRow
              styles={styles}
              colors={colors}
              icon="ruler"
              label="Body Measurements"
              onPress={() => router.push('/settings/body-measurements' as never)}
              hover={bodyMeasurementsHover}
            />
            <NavRow
              styles={styles}
              colors={colors}
              icon="list.bullet.clipboard"
              label="Condition Log"
              onPress={() => router.push('/settings/condition-log' as never)}
              hover={conditionLogHover}
            />
            <NavRow
              styles={styles}
              colors={colors}
              icon="photo.on.rectangle"
              label="Progress Photos"
              onPress={() => router.push('/settings/progress-photos' as never)}
              hover={progressPhotosHover}
            />
            <NavRow
              styles={styles}
              colors={colors}
              icon="bed.double"
              label="Sleep History"
              onPress={() => router.push('/settings/sleep-history' as never)}
              hover={sleepHistoryHover}
            />
            <NavRow
              styles={styles}
              colors={colors}
              icon="fork.knife"
              label="Nutrition History"
              onPress={() => router.push('/settings/nutrition-history' as never)}
              hover={nutritionHistoryHover}
              last
            />
          </View>
          </PremiumGate>
        </Section>

        <Section styles={styles} title="VERVEIN PLUS">
          <View style={styles.card}>
            {isPremium ? (
              <NavRow
                styles={styles}
                colors={colors}
                icon="creditcard.fill"
                label="Manage Subscription"
                onPress={handleManageSubscription}
                hover={manageSubscriptionHover}
              />
            ) : isPremium === false ? (
              // The paywall's own door — without it Settings only reached the
              // paywall through a locked row, so Restore Purchases (which
              // lives only on the paywall) had no obvious way in.
              <NavRow
                styles={styles}
                colors={colors}
                icon="sparkles"
                label="Get VerveIn Plus"
                onPress={() => openPaywall()}
                hover={getPlusHover}
              />
            ) : null}
            <NavRow
              styles={styles}
              colors={colors}
              icon="person.2.fill"
              label="Bring a Training Partner"
              onPress={() => router.push('/referral' as never)}
              hover={referralHover}
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
            <View style={[styles.switchRow, styles.rowDivider]}>
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
              connectedSubtitle={formatLastSync(healthKitLastSync)}
              last
            />
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
                      <Pressable style={({ pressed }) => [styles.importCancelHit, pressed && PRESSED_DIM]} onPress={handleCancelImport} hitSlop={8}>
                        <Text style={styles.importCancelText} maxFontSizeMultiplier={1.2}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.importConfirmHit, importText.trim().length === 0 && styles.importConfirmHitDisabled, pressed && PRESSED_DIM]}
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
                        style={({ pressed }) => [styles.importCancelHit, pressed && PRESSED_DIM]}
                        onPress={() => setImportStep('paste')}
                        hitSlop={8}
                        disabled={restoringImport}
                      >
                        <Text style={styles.importCancelText} maxFontSizeMultiplier={1.2}>Back</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.importDestructiveHit, restoringImport && styles.importConfirmHitDisabled, pressed && PRESSED_DIM]}
                        onPress={handleConfirmImport}
                        hitSlop={8}
                        disabled={restoringImport}
                      >
                        <Text style={styles.importDestructiveHitText} maxFontSizeMultiplier={1.2}>
                          {restoringImport ? 'Replacing…' : 'Replace Data'}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </Pressable>
            </Pressable>
          </Modal>

          <Pressable
            onPress={handleOpenDeleteData}
            onHoverIn={deleteHover.onHoverIn}
            onHoverOut={deleteHover.onHoverOut}
            onPressIn={deletePress.onPressIn}
            onPressOut={deletePress.onPressOut}
          >
            <View style={styles.destructiveVisual}>
              <Text style={styles.destructiveText} maxFontSizeMultiplier={1.2}>Delete My Data</Text>
            </View>
          </Pressable>

          <Modal
            visible={showDeleteDataModal}
            transparent
            animationType="fade"
            onRequestClose={handleCancelDeleteData}
            statusBarTranslucent
          >
            <Pressable style={styles.importBackdrop} onPress={handleCancelDeleteData}>
              <Pressable style={styles.importCard} onPress={() => {}}>
                <Text style={styles.importTitle} maxFontSizeMultiplier={1.3}>Delete all your data?</Text>
                <Text style={styles.importBody} maxFontSizeMultiplier={1.4}>
                  This permanently clears your profile — on this device and the copy synced to your account —
                  plus your session history, logs, progress photos, and calibration. It can&apos;t be undone.
                  Your account and any VerveIn Plus subscription stay; you&apos;ll set up your plan again.
                </Text>
                <View style={styles.importActions}>
                  <Pressable
                    style={({ pressed }) => [styles.importCancelHit, pressed && PRESSED_DIM]}
                    onPress={handleCancelDeleteData}
                    hitSlop={8}
                    disabled={deletingData}
                  >
                    <Text style={styles.importCancelText} maxFontSizeMultiplier={1.2}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.importDestructiveHit, deletingData && styles.importConfirmHitDisabled, pressed && PRESSED_DIM]}
                    onPress={handleConfirmDeleteData}
                    hitSlop={8}
                    disabled={deletingData}
                  >
                    <Text style={styles.importDestructiveHitText} maxFontSizeMultiplier={1.2}>
                      {deletingData ? 'Deleting…' : 'Delete My Data'}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

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
                <Pressable
                  style={({ pressed }) => [styles.comingSoonRow, styles.rowDivider, pressed && PRESSED_DIM]}
                  onPress={handleSignOut}
                  accessibilityRole="button"
                >
                  <Text style={styles.signOutText} maxFontSizeMultiplier={1.3}>Sign Out</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.comingSoonRow, pressed && PRESSED_DIM]}
                  onPress={handleOpenDeleteAccount}
                  accessibilityRole="button"
                >
                  <Text style={styles.deleteAccountRowText} maxFontSizeMultiplier={1.3}>Delete Account</Text>
                </Pressable>
              </>
            ) : (
              // A real action, not a "Soon" placeholder — being signed out is a
              // state you can fix right here, and the badge made it read as an
              // unfinished feature.
              <NavRow
                styles={styles}
                colors={colors}
                icon="person.crop.circle.badge.xmark"
                label="Sign in"
                subtitle="Not signed in"
                onPress={() => router.push('/onboarding/create-account' as never)}
                hover={signInHover}
                last
              />
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
                {/* Deleting an account can't touch an App Store subscription
                    — Apple bills it independently, so without this line a
                    subscriber could delete their account and keep being
                    charged for a Plus they can no longer reach. */}
                <Text style={[styles.importBody, styles.importBodySpaced]} maxFontSizeMultiplier={1.4}>
                  {'Have VerveIn Plus? Deleting your account doesn’t cancel it — '}
                  <Text style={styles.inlineLink} onPress={handleManageSubscription}>
                    manage your subscription
                  </Text>
                  {' first so you’re not charged again.'}
                </Text>
                {deleteAccountError ? (
                  <Text style={styles.importErrorText} maxFontSizeMultiplier={1.3}>{deleteAccountError}</Text>
                ) : null}
                <View style={styles.importActions}>
                  <Pressable
                    style={({ pressed }) => [styles.importCancelHit, pressed && PRESSED_DIM]}
                    onPress={handleCancelDeleteAccount}
                    hitSlop={8}
                    disabled={deletingAccount}
                  >
                    <Text style={styles.importCancelText} maxFontSizeMultiplier={1.2}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.importDestructiveHit, deletingAccount && styles.importConfirmHitDisabled, pressed && PRESSED_DIM]}
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

          <Modal
            visible={showEditNameModal}
            transparent
            animationType="fade"
            onRequestClose={handleCancelEditName}
            statusBarTranslucent
          >
            <Pressable style={styles.importBackdrop} onPress={handleCancelEditName}>
              <Pressable style={styles.importCard} onPress={() => {}}>
                <Text style={styles.importTitle} maxFontSizeMultiplier={1.3}>Edit your name</Text>
                <TextInput
                  style={styles.nameInput}
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  placeholder="Your name"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxFontSizeMultiplier={1.3}
                />
                <View style={styles.importActions}>
                  <Pressable
                    style={({ pressed }) => [styles.importCancelHit, pressed && PRESSED_DIM]}
                    onPress={handleCancelEditName}
                    hitSlop={8}
                    disabled={savingName}
                  >
                    <Text style={styles.importCancelText} maxFontSizeMultiplier={1.2}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.importConfirmHit, (!nameDraft.trim() || savingName) && styles.importConfirmHitDisabled, pressed && PRESSED_DIM]}
                    onPress={handleSaveName}
                    hitSlop={8}
                    disabled={!nameDraft.trim() || savingName}
                  >
                    <Text style={styles.importConfirmHitText} maxFontSizeMultiplier={1.2}>
                      {savingName ? 'Saving…' : 'Save'}
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
              style={({ pressed }) => [styles.aboutRow, pressed && PRESSED_DIM]}
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
              style={({ pressed }) => [styles.aboutRow, styles.rowDivider, pressed && PRESSED_DIM]}
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
            <Pressable
              style={({ pressed }) => [styles.aboutRow, pressed && PRESSED_DIM]}
              onPress={() => {
                hapticImpactLight();
                Linking.openURL(`mailto:${CONTACT_EMAIL}`);
              }}
            >
              <Text style={styles.aboutRowLabel} maxFontSizeMultiplier={1.2}>Help & Feedback</Text>
              <Text style={styles.comingSoonSubtitle} maxFontSizeMultiplier={1.2}>{CONTACT_EMAIL}</Text>
            </Pressable>
          </View>
        </Section>

        <Text style={styles.footer} maxFontSizeMultiplier={1.3}>VerveIn v{appConfig.expo?.version ?? '1.0.0'}</Text>

      </ScrollView>
      </ReanimatedAnimated.View>
      )}

      <BiometricsSheet ref={biometricsSheetRef} />
      <AdjustPlanSheet ref={adjustPlanSheetRef} />
      <ConditionsSheet ref={conditionsSheetRef} />
      <GoalsSheet ref={goalsSheetRef} />
      <MovementRestrictionsSheet ref={movementRestrictionsSheetRef} />
      <StandingSymptomsSheet ref={standingSymptomsSheetRef} />
    </KeyboardAvoidingView>
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
  subtitle,
  onPress,
  hover,
  last = false,
  locked = false,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: Record<string, string>;
  icon: SFSymbol;
  label: string;
  /** Shown under the label, e.g. the current value for a row that just opens an editor. */
  subtitle?: string;
  onPress: () => void;
  hover: ReturnType<typeof useHoverFade>;
  last?: boolean;
  /** VerveIn Plus tease, not a hide — the row itself, its label, and its
   * icon stay exactly as a subscriber sees them; only the trailing chevron
   * swaps for a lock glyph and the accessibility label names Plus, same
   * "show what you'd get" copy PremiumGate itself uses. The caller is
   * still the one deciding onPress's real behavior (open the real feature
   * vs. push to the paywall) — this prop only ever changes what's drawn. */
  locked?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.navRow, !last && styles.rowDivider, pressed && PRESSED_DIM]}
      onPress={() => {
        hapticImpactLight();
        onPress();
      }}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      android_ripple={AndroidRipple}
      accessibilityRole="button"
      accessibilityLabel={
        locked
          ? `${label} is part of VerveIn Plus. Tap to see what's included.`
          : subtitle
            ? `${label}. ${subtitle}`
            : label
      }
    >
      <View style={styles.switchRowLeft}>
        <SymbolView name={icon} size={15} tintColor="#5FBE84" style={styles.rowIcon} />
        <View>
          <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
          {subtitle ? (
            <Text style={styles.comingSoonSubtitle} maxFontSizeMultiplier={1.3}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <SymbolView name={locked ? 'lock.fill' : 'chevron.right'} size={12} tintColor={colors.iconFaint} />
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
  connectedSubtitle,
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
  /** Shown only when available && value — see getLastRestingHeartRateSyncDate's
   * doc comment. Optional: rows with nothing to report (App Lock) just omit it. */
  connectedSubtitle?: string | null;
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
          ) : available && value && connectedSubtitle ? (
            <Text style={styles.comingSoonSubtitle} maxFontSizeMultiplier={1.3}>{connectedSubtitle}</Text>
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

function createStyles(colors: Record<string, string>) {
  return StyleSheet.create({
    permissionHint: {
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    permissionHintText: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      lineHeight: 16,
      fontFamily: 'Geist-Medium',
    },
    permissionHintLink: {
      color: colors.accentText,
      fontFamily: 'Geist-SemiBold',
    },
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    fadeLayer: {
      flex: 1,
    },
    skeletonSection: {
      marginTop: 20,
      gap: 12,
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
      gap: 24,
    },
    section: {
      gap: 10,
    },
    sectionKicker: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      letterSpacing: 1,
      fontFamily: 'Geist-SemiBold',
    },
    card: {
      // Android gets a soft raised surface (tonal elevation, no border) in
      // place of iOS's flat hairline-bordered card — Material's own depth
      // cue instead of a borrowed iOS convention. `elevation` needs an
      // opaque backgroundColor to actually render a shadow, already true
      // here on both platforms.
      borderRadius: Platform.OS === 'android' ? 20 : 16,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      ...(Platform.OS === 'android'
        ? AndroidCardElevation
        : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceBorder }),
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
      fontSize: Type.body,
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
      fontSize: Type.micro,
      fontFamily: 'Geist-SemiBold',
    },
    unitPillTextSelected: {
      color: colors.accentText,
    },
    comingSoonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    comingSoonSubtitle: {
      marginTop: 2,
      color: colors.textTertiary,
      fontSize: Type.micro,
      fontFamily: 'Geist-Medium',
    },
    // Deliberately not the destructive red — signing out loses nothing (see
    // handleSignOut's own comment on why), so it doesn't carry the same
    // warning weight as Delete My Data.
    signOutText: {
      color: colors.textSecondary,
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    deleteAccountRowText: {
      color: '#E5484D',
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
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
      color: colors.accentText,
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
    },
    importConfirmText: {
      marginBottom: 10,
      textAlign: 'center',
      color: colors.textTertiary,
      fontSize: Type.caption,
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
      fontSize: Type.subtitle,
      fontFamily: 'Geist-SemiBold',
      textAlign: 'center',
    },
    importBody: {
      color: colors.textSecondary,
      fontSize: Type.secondary,
      lineHeight: 18,
      fontFamily: 'Geist-Medium',
      textAlign: 'center',
    },
    importBodySpaced: {
      marginTop: 8,
    },
    inlineLink: {
      color: colors.accentText,
      fontFamily: 'Geist-SemiBold',
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
      fontSize: Type.secondary,
      fontFamily: 'Geist-Regular',
      textAlignVertical: 'top',
    },
    // BUG FIX: "Edit your name" used to reuse importInput above wholesale —
    // that style's 120px height and top-anchored text (textAlignVertical:
    // 'top') exist for the Import My Data JSON textarea's multi-line paste
    // box, not a one-word name field. On a single-line input, that combo
    // left a few letters sitting at the top of a tall, mostly-empty box —
    // reading as text floating in the middle of the card rather than a
    // normal name field, not because of any actual horizontal centering.
    // This is that same visual language (border, background, radius) sized
    // for one line instead.
    nameInput: {
      marginTop: 6,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.pillBg,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: colors.text,
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-Medium',
    },
    importErrorText: {
      marginTop: 4,
      color: '#E5484D',
      fontSize: Type.secondary,
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
      fontSize: Type.body,
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
      fontSize: Type.body,
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
      fontSize: Type.body,
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
      fontSize: Type.body,
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
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    footer: {
      textAlign: 'center',
      color: colors.textQuaternary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
    },
  });
}
