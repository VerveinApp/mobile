import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useHoverFade } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSuccess } from '@/lib/haptics';
import {
  DURATION_LABELS,
  ENVIRONMENT_LABELS,
  EXPERIENCE_LABELS,
  formatDays,
  GOAL_LABELS,
} from '@/lib/profile-labels';
import { COMMITMENT_LEVELS } from '@/lib/commitment-levels';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppColors } from '@/lib/theme-context';
import { usePremiumEntitlement } from '@/lib/purchases';
import { getProfile, updateProfile, type UserProfile } from '@/lib/user-profile';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/skeleton';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Same shared fade used across onboarding, check-in, Home, Progress, and
  // Train — the loading-skeleton-to-real-content swap below previously
  // hard-cut with no transition, the one motion-language gap against the
  // rest of the app. Only fires on the true initial load — loaded stays
  // true across subsequent focuses (see the useFocusEffect comment below),
  // so returning from Settings never re-triggers it.
  const entering = useFadeInEntering();
  const isPremium = usePremiumEntitlement();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  // useFocusEffect (not useEffect) — this tab stays mounted while Settings'
  // Adjust My Plan / Biometrics screens push on top of it, so a plain mount
  // effect would never re-read the profile those screens just changed.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const p = await getProfile();
        setProfile(p);
        setLoaded(true);
      })();
    }, [])
  );

  const settingsHover = useHoverFade();
  const logHover = useHoverFade();
  const nameHover = useHoverFade();

  const handleOpenEditName = () => {
    hapticImpactLight();
    setNameDraft(profile?.name?.trim() ?? '');
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
    const next = await updateProfile({ name: trimmed });
    setProfile(next);
    setSavingName(false);
    setShowEditNameModal(false);
    hapticSuccess();
  };

  if (!loaded) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <SkeletonBlock width={72} height={72} borderRadius={36} />
            <SkeletonBlock width={140} height={19} borderRadius={6} style={{ marginTop: 14 }} />
            <SkeletonBlock width={170} height={12.5} borderRadius={6} style={{ marginTop: 8 }} />
          </View>

          <View style={styles.section}>
            <SkeletonBlock width={80} height={11} borderRadius={4} />
            <SkeletonCard height={260} lines={5} />
          </View>

          <View style={styles.section}>
            <SkeletonBlock width={110} height={11} borderRadius={4} />
            <SkeletonCard height={280} lines={3} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const commitmentIndex = profile?.commitmentLevel ? Number(profile.commitmentLevel) - 1 : null;
  const commitmentName = commitmentIndex !== null ? (COMMITMENT_LEVELS[commitmentIndex]?.name ?? 'Not set') : 'Not set';
  const firstName = profile?.name?.trim().split(' ')[0];
  const initial = firstName ? firstName[0].toUpperCase() : '·';

  return (
    <View style={styles.root}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push('/log' as never)}
            onHoverIn={logHover.onHoverIn}
            onHoverOut={logHover.onHoverOut}
            hitSlop={10}
            style={styles.logButton}
            accessibilityRole="button"
            accessibilityLabel="Open log"
          >
            <SymbolView name="square.and.pencil" size={17} tintColor={colors.iconMuted} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/settings' as never)}
            onHoverIn={settingsHover.onHoverIn}
            onHoverOut={settingsHover.onHoverOut}
            hitSlop={10}
            style={styles.settingsButton}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <SymbolView name="gearshape.fill" size={17} tintColor={colors.iconMuted} />
          </Pressable>

          <View style={styles.avatarVisual}>
            <Text style={styles.avatarText} maxFontSizeMultiplier={1.15}>{initial}</Text>
          </View>
          <Pressable
            style={styles.nameHit}
            onPress={handleOpenEditName}
            onHoverIn={nameHover.onHoverIn}
            onHoverOut={nameHover.onHoverOut}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit your name"
          >
            <Text style={styles.name} maxFontSizeMultiplier={1.3}>{profile?.name?.trim() || 'Your Profile'}</Text>
            <SymbolView name="pencil" size={13} tintColor={colors.textTertiary} style={styles.namePencil} />
          </Pressable>
          {profile?.email ? <Text style={styles.email} maxFontSizeMultiplier={1.3}>{profile.email}</Text> : null}
          {isPremium ? (
            <View style={styles.plusBadge}>
              <SymbolView name="sparkles" size={10} tintColor="#05130b" />
              <Text style={styles.plusBadgeText} maxFontSizeMultiplier={1.2}>Plus</Text>
            </View>
          ) : null}
        </View>

        <Modal
          visible={showEditNameModal}
          transparent
          animationType="fade"
          onRequestClose={handleCancelEditName}
          statusBarTranslucent
        >
          <Pressable style={styles.editNameBackdrop} onPress={handleCancelEditName}>
            <Pressable style={styles.editNameCard} onPress={() => {}}>
              <Text style={styles.editNameTitle} maxFontSizeMultiplier={1.3}>Edit your name</Text>
              <TextInput
                style={styles.editNameInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
                maxFontSizeMultiplier={1.3}
              />
              <View style={styles.editNameActions}>
                <Pressable style={styles.editNameCancelHit} onPress={handleCancelEditName} hitSlop={8} disabled={savingName}>
                  <Text style={styles.editNameCancelText} maxFontSizeMultiplier={1.2}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.editNameConfirmHit, (!nameDraft.trim() || savingName) && styles.editNameConfirmHitDisabled]}
                  onPress={handleSaveName}
                  hitSlop={8}
                  disabled={!nameDraft.trim() || savingName}
                >
                  <Text style={styles.editNameConfirmText} maxFontSizeMultiplier={1.2}>
                    {savingName ? 'Saving…' : 'Save'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <View style={styles.section}>
          <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>YOUR PLAN</Text>
          <View style={styles.card}>
            <View pointerEvents="none" style={styles.cardSheen} />
            <PlanRow styles={styles} icon="target" label="Goal" value={GOAL_LABELS[profile?.goal ?? ''] ?? 'Not set'} />
            <PlanRow styles={styles} icon="chart.bar.fill" label="Experience" value={EXPERIENCE_LABELS[profile?.experience ?? ''] ?? 'Not set'} />
            <PlanRow styles={styles} icon="dumbbell.fill" label="Equipment" value={ENVIRONMENT_LABELS[profile?.environment ?? ''] ?? 'Not set'} />
            <PlanRow styles={styles} icon="clock.fill" label="Session Length" value={DURATION_LABELS[profile?.duration ?? ''] ?? 'Not set'} />
            <PlanRow styles={styles} icon="calendar" label="Training Days" value={formatDays(profile?.days)} />
            <PlanRow styles={styles} icon="flame.fill" label="Commitment" value={commitmentName} last />
          </View>
        </View>
      </ScrollView>
      </ReanimatedAnimated.View>
    </View>
  );
}

function PlanRow({
  styles,
  icon,
  label,
  value,
  last = false,
}: {
  styles: ReturnType<typeof createStyles>;
  icon: SFSymbol;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.planRow, !last && styles.planRowDivider]}>
      <View style={styles.planRowLeft}>
        <SymbolView name={icon} size={15} tintColor="#5FBE84" style={styles.planRowIcon} />
        <Text style={styles.planRowLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      </View>
      <Text style={styles.planRowValue} maxFontSizeMultiplier={1.2}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    fadeLayer: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      gap: 28,
    },
    header: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    settingsButton: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logButton: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarVisual: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.glassBorder,
      backgroundColor: 'rgba(67,140,99,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: '#5FBE84',
      fontSize: 24,
      fontFamily: 'Geist-Bold',
    },
    nameHit: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    name: {
      color: colors.text,
      fontSize: 19,
      letterSpacing: -0.2,
      fontFamily: 'Geist-Bold',
    },
    namePencil: {
      marginTop: 2,
    },
    email: {
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: 12.5,
      fontFamily: 'Geist-Medium',
    },
    plusBadge: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: '#5FBE84',
    },
    plusBadgeText: {
      color: '#05130b',
      fontSize: 11,
      fontFamily: 'Geist-Bold',
      letterSpacing: 0.2,
    },
    section: {
      gap: 12,
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
      overflow: 'hidden',
    },
    cardSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '40%',
      backgroundColor: colors.surfaceSheen,
    },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
    },
    planRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    planRowIcon: {
      width: 15,
      height: 15,
      marginRight: 10,
    },
    planRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    planRowLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    planRowValue: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    editNameBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    editNameCard: {
      width: '100%',
      maxWidth: 340,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 22,
      paddingVertical: 22,
      gap: 12,
    },
    editNameTitle: {
      color: colors.text,
      fontSize: 16,
      fontFamily: 'Geist-SemiBold',
    },
    editNameInput: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 14,
      fontFamily: 'Geist-Medium',
    },
    editNameActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 16,
    },
    editNameCancelHit: {
      paddingVertical: 10,
      paddingHorizontal: 6,
    },
    editNameCancelText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
    },
    editNameConfirmHit: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: '#29563a',
    },
    editNameConfirmHitDisabled: {
      opacity: 0.5,
    },
    editNameConfirmText: {
      color: '#ffffff',
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
