import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { useHoverFade } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight } from '@/lib/haptics';
import { localDateStr } from '@/lib/local-date';
import {
  addProgressPhoto,
  deleteProgressPhoto,
  getProgressPhotos,
  progressPhotoUri,
  type ProgressPhotoEntry,
} from '@/lib/progress-photos';
import { useAppColors } from '@/lib/theme-context';
import { getProfile } from '@/lib/user-profile';
import { HealthConsentGate } from '@/components/settings/health-consent-gate';

function formatEntryDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Reached from Settings' DATA section. Gated on healthConsent, same as the
 * onboarding fields this data extends — see HealthConsentGate's own comment.
 * The most sensitive of everything Log added this session (real photos, not
 * a number or a self-reported tag), so this one still gets the extra
 * caution of an explicit consent gate rather than assuming reachability
 * implies consent.
 *
 * Deliberately just a chronological grid + a full-screen single-photo
 * viewer for this first pass, not a dedicated side-by-side compare screen —
 * flipping between two full views in the grid already delivers the
 * self-referential "how do I look now vs. then" comparison this app's own
 * philosophy favors (compare against your own past, never anyone else's),
 * a dedicated compare UI is a real but separable follow-up.
 */
export default function ProgressPhotosScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const addHover = useHoverFade();

  const [photos, setPhotos] = useState<ProgressPhotoEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhotoEntry | null>(null);

  const reload = useCallback(() => {
    (async () => {
      const [entries, profile] = await Promise.all([getProgressPhotos(), getProfile()]);
      setPhotos(entries);
      setHasConsent(profile?.healthConsent === 'true');
      setLoaded(true);
    })();
  }, []);
  useFocusEffect(reload);

  const handleToggleAdd = () => {
    hapticImpactLight();
    setAdding((a) => !a);
  };

  const savePickedAsset = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return;
    setSaving(true);
    const id = Crypto.randomUUID();
    const entry = await addProgressPhoto(id, localDateStr(), result.assets[0].uri);
    setSaving(false);
    setAdding(false);
    if (entry) {
      setPhotos((prev) => [entry, ...prev.filter((p) => p.date !== entry.date || p.id === entry.id)]);
    } else {
      hapticError();
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.85 });
    await savePickedAsset(result);
  };

  const handleChooseFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.85 });
    await savePickedAsset(result);
  };

  const handleDelete = async (id: string) => {
    hapticImpactLight();
    const previous = photos;
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setViewing(null);
    try {
      await deleteProgressPhoto(id);
    } catch {
      hapticError();
      setPhotos(previous);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          onHoverIn={backHover.onHoverIn}
          onHoverOut={backHover.onHoverOut}
          hitSlop={10}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Progress Photos</Text>
        <View style={styles.headerButton} />
      </View>

      {!loaded ? null : !hasConsent ? (
        <HealthConsentGate />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Pressable
              style={styles.addRow}
              onPress={handleToggleAdd}
              onHoverIn={addHover.onHoverIn}
              onHoverOut={addHover.onHoverOut}
              accessibilityRole="button"
              accessibilityLabel={adding ? 'Cancel adding a photo' : 'Add a progress photo'}
            >
              <SymbolView name={adding ? 'xmark' : 'plus'} size={13} tintColor="#5FBE84" />
              <Text style={styles.addRowText} maxFontSizeMultiplier={1.2}>
                {adding ? 'Cancel' : 'Add a photo'}
              </Text>
            </Pressable>

            {adding ? (
              <View style={styles.addCard}>
                <Pressable
                  style={styles.choiceRow}
                  onPress={handleTakePhoto}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Take Photo"
                >
                  <SymbolView name="camera" size={16} tintColor={colors.text} />
                  <Text style={styles.choiceText} maxFontSizeMultiplier={1.2}>Take Photo</Text>
                </Pressable>
                <Pressable
                  style={styles.choiceRow}
                  onPress={handleChooseFromLibrary}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Choose from Library"
                >
                  <SymbolView name="photo.on.rectangle" size={16} tintColor={colors.text} />
                  <Text style={styles.choiceText} maxFontSizeMultiplier={1.2}>Choose from Library</Text>
                </Pressable>
                {saving ? (
                  <Text style={styles.savingText} maxFontSizeMultiplier={1.2}>Saving…</Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>PHOTOS</Text>
            {photos.length === 0 ? (
              <View style={styles.emptyCard}>
                <SymbolView name="photo.stack" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
                <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                  No progress photos yet — add one to start tracking how you look over time.
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {photos.map((photo) => (
                  <Pressable
                    key={photo.id}
                    style={styles.gridCell}
                    onPress={() => setViewing(photo)}
                    accessibilityRole="button"
                    accessibilityLabel={`Photo from ${formatEntryDate(photo.date)}`}
                  >
                    <Image source={{ uri: progressPhotoUri(photo) }} style={styles.gridImage} contentFit="cover" />
                    <Text style={styles.gridDate} maxFontSizeMultiplier={1.2}>{formatEntryDate(photo.date)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={viewing !== null} animationType="fade" transparent onRequestClose={() => setViewing(null)}>
        <View style={styles.viewerRoot}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
            <Pressable
              onPress={() => setViewing(null)}
              hitSlop={10}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <SymbolView name="xmark" size={16} tintColor="#ffffff" />
            </Pressable>
            <Text style={styles.viewerDate} maxFontSizeMultiplier={1.2}>
              {viewing ? formatEntryDate(viewing.date) : ''}
            </Text>
            <Pressable
              onPress={() => viewing && handleDelete(viewing.id)}
              hitSlop={10}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Delete photo"
            >
              <SymbolView name="trash" size={16} tintColor="#ffffff" />
            </Pressable>
          </View>
          {viewing ? (
            <Image source={{ uri: progressPhotoUri(viewing) }} style={styles.viewerImage} contentFit="contain" />
          ) : null}
        </View>
      </Modal>
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
    headerButton: {
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
      gap: 28,
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
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    addRowText: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    addCard: {
      marginTop: 10,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 8,
      gap: 4,
    },
    choiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    choiceText: {
      color: colors.text,
      fontSize: 13.5,
      fontFamily: 'Geist-Medium',
    },
    savingText: {
      textAlign: 'center',
      color: colors.textTertiary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
      paddingVertical: 8,
    },
    emptyCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 20,
      alignItems: 'center',
    },
    emptyIcon: {
      marginBottom: 10,
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: 12.5,
      fontFamily: 'Geist-Medium',
      lineHeight: 18,
      textAlign: 'center',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    gridCell: {
      width: '31.5%',
      gap: 4,
    },
    gridImage: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    gridDate: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: 'Geist-Medium',
      textAlign: 'center',
    },
    viewerRoot: {
      flex: 1,
      backgroundColor: '#000000',
    },
    viewerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    viewerDate: {
      color: '#ffffff',
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
    viewerImage: {
      flex: 1,
    },
  });
}
