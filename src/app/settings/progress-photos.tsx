import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedAnimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { SymbolView } from '@/components/ui/app-symbol';

import { Type } from '@/constants/theme';
import { useHoverFade, PRESSED_DIM } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight, hapticWarning } from '@/lib/haptics';
import { localDateStr } from '@/lib/local-date';
import {
  addProgressPhoto,
  deleteProgressPhoto,
  getProgressPhotos,
  progressPhotoUri,
  type ProgressPhotoEntry,
} from '@/lib/progress-photos';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppColors } from '@/lib/theme-context';
import { getProfile } from '@/lib/user-profile';
import { BeforeAfterSlider } from '@/components/settings/before-after-slider';
import { HealthConsentGate } from '@/components/settings/health-consent-gate';
import { SkeletonBlock } from '@/components/ui/skeleton';

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
 * A chronological grid + a full-screen single-photo viewer, plus a
 * drag-to-reveal before/after slider (BeforeAfterSlider) once there are at
 * least two photos to compare — the follow-up this file's own comment used
 * to defer. Always compares against your own past self, never anyone
 * else's (no upload, no sharing) — the same self-referential framing the
 * grid already had, just a more direct way to see it than flipping between
 * two full-screen views.
 */
export default function ProgressPhotosScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const backHover = useHoverFade();
  const addHover = useHoverFade();
  const compareHover = useHoverFade();
  const entering = useFadeInEntering();

  const [photos, setPhotos] = useState<ProgressPhotoEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  // The photo in the full-screen viewer. Kept set after the viewer closes,
  // so the photo fades out with the modal instead of blanking first.
  const [viewing, setViewing] = useState<ProgressPhotoEntry | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  // The viewer's trash button used to delete on a single tap — the one
  // place a photo could be lost without a second, deliberate tap (the grid
  // needs a long-press, then the badge). First tap arms it, second deletes.
  const [confirmingViewerDelete, setConfirmingViewerDelete] = useState(false);
  // How far the viewer's photo has been dragged down, in points. Swiping
  // down dismisses it, like Photos: the photo follows the finger and
  // shrinks a little while the black backdrop thins to show the grid.
  const viewerDragY = useSharedValue(0);
  // Long-press reveals a delete badge on that one thumbnail rather than
  // deleting outright — same "reveal, then a real second tap commits it"
  // shape as every swipe-to-delete list elsewhere in the app (Notes, Weight
  // History, …), just using long-press as the reveal gesture since a grid
  // has no natural swipe direction to reserve for it. Tapping anywhere else
  // in the grid clears it, same as tapping away from a revealed swipe action.
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  // Indices into `photos` (newest-first, per getProgressPhotos' own sort).
  // Defaults set on opening the sheet (see handleOpenCompare) rather than
  // here, since they depend on `photos.length` at that moment — oldest vs.
  // newest is the most honest starting comparison (the longest real
  // stretch of time on file), not two arbitrary/adjacent photos.
  const [comparing, setComparing] = useState(false);
  const [beforeIndex, setBeforeIndex] = useState(0);
  const [afterIndex, setAfterIndex] = useState(0);

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
      // BUG FIX: was filtering out every OTHER photo sharing the new one's
      // date — a pattern borrowed from Weight/Sleep/Nutrition Log, where
      // saveWeightEntry-style functions really do overwrite the day's one
      // value. addProgressPhoto never overwrites (it always appends, see
      // its own doc comment) — this app supports multiple photos per day,
      // so adding a second photo today was making every earlier photo from
      // today vanish from the list, even though they were still safely on
      // disk the whole time (a reload would have brought them right back —
      // still a real, confusing bug, just not actual data loss).
      setPhotos((prev) => [entry, ...prev]);
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

  const openViewer = (photo: ProgressPhotoEntry) => {
    viewerDragY.value = 0;
    setConfirmingViewerDelete(false);
    setViewing(photo);
    setViewerOpen(true);
  };
  const closeViewer = useCallback(() => setViewerOpen(false), []);

  const viewerDismissGesture = useMemo(
    () =>
      Gesture.Pan()
        // Downward drags only; a sideways or upward start stays a no-op.
        .activeOffsetY(12)
        .failOffsetX([-24, 24])
        .onUpdate((e) => {
          viewerDragY.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          if (e.translationY > 120 || e.velocityY > 900) {
            // The modal's own fade takes it from wherever the drag left it.
            scheduleOnRN(closeViewer);
          } else {
            viewerDragY.value = withSpring(0, { velocity: e.velocityY, damping: 26, stiffness: 280 });
          }
        }),
    // viewerDragY is a stable shared value — listing it here makes the React
    // Compiler treat the worklet's writes as mutating a hook argument (same
    // as BeforeAfterSlider's gesture).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [closeViewer]
  );
  const viewerPhotoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: viewerDragY.value },
      { scale: interpolate(viewerDragY.value, [0, 400], [1, 0.88], Extrapolation.CLAMP) },
    ],
  }));
  const viewerBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(viewerDragY.value, [0, 300], [1, 0.35], Extrapolation.CLAMP),
  }));
  const viewerChromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(viewerDragY.value, [0, 100], [1, 0], Extrapolation.CLAMP),
  }));

  const handleDelete = async (id: string) => {
    hapticImpactLight();
    const previous = photos;
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setViewerOpen(false);
    try {
      await deleteProgressPhoto(id);
    } catch {
      hapticError();
      setPhotos(previous);
    }
  };

  const handleViewerDelete = () => {
    if (!viewing) return;
    if (!confirmingViewerDelete) {
      hapticWarning();
      setConfirmingViewerDelete(true);
      return;
    }
    setConfirmingViewerDelete(false);
    handleDelete(viewing.id);
  };

  const handleOpenCompare = () => {
    hapticImpactLight();
    setBeforeIndex(photos.length - 1);
    setAfterIndex(0);
    setComparing(true);
  };

  // Clamped, not wrapped — stepping past either end just stops there rather
  // than cycling back around, since "before" and "after" are meant to read
  // as a real chronological range, not an arbitrary pair.
  const stepBefore = (delta: number) =>
    setBeforeIndex((i) => Math.min(photos.length - 1, Math.max(0, i + delta)));
  const stepAfter = (delta: number) => setAfterIndex((i) => Math.min(photos.length - 1, Math.max(0, i + delta)));

  return (
    <View style={styles.root}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          onHoverIn={backHover.onHoverIn}
          onHoverOut={backHover.onHoverOut}
          hitSlop={10}
          style={({ pressed }) => [styles.headerButton, pressed && PRESSED_DIM]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Progress Photos</Text>
        <View style={styles.headerButton} />
      </View>

      {!loaded ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <SkeletonBlock width={130} height={44} borderRadius={14} />
          <View style={styles.section}>
            <SkeletonBlock width={60} height={11} borderRadius={4} />
            <View style={styles.grid}>
              {[0, 1, 2].map((i) => (
                <SkeletonBlock key={i} width="31.5%" height={150} borderRadius={10} />
              ))}
            </View>
          </View>
        </ScrollView>
      ) : !hasConsent ? (
        <HealthConsentGate />
      ) : (
        <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Pressable
              style={({ pressed }) => [styles.addRow, pressed && PRESSED_DIM]}
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
                  style={({ pressed }) => [styles.choiceRow, pressed && PRESSED_DIM]}
                  onPress={handleTakePhoto}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Take Photo"
                >
                  <SymbolView name="camera" size={16} tintColor={colors.text} />
                  <Text style={styles.choiceText} maxFontSizeMultiplier={1.2}>Take Photo</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.choiceRow, pressed && PRESSED_DIM]}
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

          {photos.length >= 2 ? (
            <View style={styles.section}>
              <Pressable
                style={({ pressed }) => [styles.addRow, pressed && PRESSED_DIM]}
                onPress={handleOpenCompare}
                onHoverIn={compareHover.onHoverIn}
                onHoverOut={compareHover.onHoverOut}
                accessibilityRole="button"
                accessibilityLabel="Compare two photos"
              >
                <SymbolView name="rectangle.split.2x1" size={13} tintColor="#5FBE84" />
                <Text style={styles.addRowText} maxFontSizeMultiplier={1.2}>Compare before/after</Text>
              </Pressable>
            </View>
          ) : null}

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
                {photos.map((photo) => {
                  const isDeleteTarget = deleteTargetId === photo.id;
                  return (
                    <Pressable
                      key={photo.id}
                      style={({ pressed }) => [styles.gridCell, pressed && PRESSED_DIM]}
                      onPress={() => {
                        if (deleteTargetId) {
                          setDeleteTargetId(null);
                          return;
                        }
                        openViewer(photo);
                      }}
                      onLongPress={() => {
                        hapticImpactLight();
                        setDeleteTargetId(photo.id);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Photo from ${formatEntryDate(photo.date)}`}
                    >
                      <View>
                        <Image source={{ uri: progressPhotoUri(photo) }} style={styles.gridImage} contentFit="cover" transition={150} />
                        {isDeleteTarget ? (
                          <Pressable
                            style={({ pressed }) => [styles.gridDeleteBadge, pressed && PRESSED_DIM]}
                            onPress={() => {
                              setDeleteTargetId(null);
                              handleDelete(photo.id);
                            }}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Delete photo"
                          >
                            <SymbolView name="trash.fill" size={13} tintColor="#ffffff" />
                          </Pressable>
                        ) : null}
                      </View>
                      <Text style={styles.gridDate} maxFontSizeMultiplier={1.2}>{formatEntryDate(photo.date)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
        </ReanimatedAnimated.View>
      )}

      <Modal visible={viewerOpen} animationType="fade" transparent onRequestClose={closeViewer}>
        {/* Its own gesture root: RN renders a Modal outside the app's root
            view, and on Android gestures inside one never arrive without
            this (on iOS it's a plain View). */}
        <GestureHandlerRootView style={styles.viewerRoot} onAccessibilityEscape={closeViewer}>
          <ReanimatedAnimated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.viewerBackdrop, viewerBackdropStyle]}
          />
          <ReanimatedAnimated.View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }, viewerChromeStyle]}>
            <Pressable
              onPress={closeViewer}
              hitSlop={10}
              style={({ pressed }) => [styles.headerButton, pressed && PRESSED_DIM]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <SymbolView name="xmark" size={16} tintColor="#ffffff" />
            </Pressable>
            <Text style={styles.viewerDate} maxFontSizeMultiplier={1.2}>
              {viewing ? formatEntryDate(viewing.date) : ''}
            </Text>
            <Pressable
              onPress={handleViewerDelete}
              hitSlop={10}
              style={({ pressed }) => [
                confirmingViewerDelete ? styles.viewerDeleteConfirm : styles.headerButton,
                pressed && PRESSED_DIM,
              ]}
              accessibilityRole="button"
              accessibilityLabel={confirmingViewerDelete ? 'Confirm: delete this photo' : 'Delete photo'}
            >
              {confirmingViewerDelete ? (
                <Text style={styles.viewerDeleteConfirmText} maxFontSizeMultiplier={1.2}>
                  Delete
                </Text>
              ) : (
                <SymbolView name="trash" size={16} tintColor="#ffffff" />
              )}
            </Pressable>
          </ReanimatedAnimated.View>
          <GestureDetector gesture={viewerDismissGesture}>
            <ReanimatedAnimated.View style={[styles.viewerPhotoWrap, viewerPhotoStyle]}>
              {viewing ? (
                <Image
                  source={{ uri: progressPhotoUri(viewing) }}
                  style={styles.viewerImage}
                  contentFit="contain"
                  transition={150}
                />
              ) : null}
            </ReanimatedAnimated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>

      <Modal visible={comparing} animationType="fade" transparent onRequestClose={() => setComparing(false)}>
        <GestureHandlerRootView
          style={[styles.viewerRoot, styles.viewerRootOpaque]}
          onAccessibilityEscape={() => setComparing(false)}
        >
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
            <Pressable
              onPress={() => setComparing(false)}
              hitSlop={10}
              style={({ pressed }) => [styles.headerButton, pressed && PRESSED_DIM]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <SymbolView name="xmark" size={16} tintColor="#ffffff" />
            </Pressable>
            <Text style={styles.viewerDate} maxFontSizeMultiplier={1.2}>Compare</Text>
            <View style={styles.headerButton} />
          </View>

          {photos[beforeIndex] && photos[afterIndex] ? (
            <View style={styles.compareBody}>
              {/* Remounts the slider (via `key`) whenever either side
                  changes, rather than threading new URIs into an already-
                  dragged divider position — a fresh comparison should start
                  at the midpoint again, not wherever the last pair's
                  divider happened to be left. */}
              <BeforeAfterSlider
                key={`${photos[beforeIndex].id}-${photos[afterIndex].id}`}
                beforeUri={progressPhotoUri(photos[beforeIndex])}
                afterUri={progressPhotoUri(photos[afterIndex])}
                width={windowWidth - 40}
                height={((windowWidth - 40) * 4) / 3}
              />

              <View style={styles.compareRow}>
                <Text style={styles.compareLabel} maxFontSizeMultiplier={1.2}>BEFORE</Text>
                <Pressable
                  onPress={() => stepBefore(1)}
                  disabled={beforeIndex >= photos.length - 1}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Show an older before photo"
                >
                  <SymbolView
                    name="chevron.left"
                    size={13}
                    tintColor={beforeIndex >= photos.length - 1 ? colors.textTertiary : '#ffffff'}
                  />
                </Pressable>
                <Text style={styles.compareDate} maxFontSizeMultiplier={1.2}>
                  {formatEntryDate(photos[beforeIndex].date)}
                </Text>
                <Pressable
                  onPress={() => stepBefore(-1)}
                  disabled={beforeIndex <= 0}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Show a newer before photo"
                >
                  <SymbolView name="chevron.right" size={13} tintColor={beforeIndex <= 0 ? colors.textTertiary : '#ffffff'} />
                </Pressable>
              </View>

              <View style={styles.compareRow}>
                <Text style={styles.compareLabel} maxFontSizeMultiplier={1.2}>AFTER</Text>
                <Pressable
                  onPress={() => stepAfter(1)}
                  disabled={afterIndex >= photos.length - 1}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Show an older after photo"
                >
                  <SymbolView
                    name="chevron.left"
                    size={13}
                    tintColor={afterIndex >= photos.length - 1 ? colors.textTertiary : '#ffffff'}
                  />
                </Pressable>
                <Text style={styles.compareDate} maxFontSizeMultiplier={1.2}>
                  {formatEntryDate(photos[afterIndex].date)}
                </Text>
                <Pressable
                  onPress={() => stepAfter(-1)}
                  disabled={afterIndex <= 0}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Show a newer after photo"
                >
                  <SymbolView name="chevron.right" size={13} tintColor={afterIndex <= 0 ? colors.textTertiary : '#ffffff'} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </GestureHandlerRootView>
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
    fadeLayer: {
      flex: 1,
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
      fontSize: Type.headerTitle,
      letterSpacing: -0.2,
      fontFamily: 'Geist-Bold',
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
      fontSize: Type.caption,
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
      fontSize: Type.body,
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
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
    },
    savingText: {
      textAlign: 'center',
      color: colors.textTertiary,
      fontSize: Type.secondary,
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
      fontSize: Type.secondary,
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
    gridDeleteBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#E5484D',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.85)',
    },
    gridDate: {
      color: colors.textTertiary,
      fontSize: Type.micro,
      fontFamily: 'Geist-Medium',
      textAlign: 'center',
    },
    viewerRoot: {
      flex: 1,
    },
    viewerRootOpaque: {
      backgroundColor: '#000000',
    },
    // Its own layer, not viewerRoot's background, so a swipe-down can thin
    // it and let the grid show through.
    viewerBackdrop: {
      backgroundColor: '#000000',
    },
    viewerPhotoWrap: {
      flex: 1,
    },
    viewerDeleteConfirm: {
      height: 32,
      paddingHorizontal: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#E5484D',
    },
    viewerDeleteConfirmText: {
      color: '#ffffff',
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
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
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-SemiBold',
    },
    viewerImage: {
      flex: 1,
    },
    compareBody: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 20,
      gap: 18,
    },
    compareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      width: '100%',
    },
    compareLabel: {
      position: 'absolute',
      left: 0,
      color: 'rgba(255,255,255,0.5)',
      fontSize: Type.micro,
      letterSpacing: 1,
      fontFamily: 'Geist-SemiBold',
    },
    compareDate: {
      color: '#ffffff',
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
      minWidth: 90,
      textAlign: 'center',
    },
  });
}
