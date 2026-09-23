import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';

import { Type } from '@/constants/theme';
import { useHoverFade, PRESSED_DIM } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight } from '@/lib/haptics';
import { getArchivedNotes, deleteNote, setNoteArchived, type NoteEntry } from '@/lib/notes';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppColors } from '@/lib/theme-context';
import { SkeletonCard } from '@/components/ui/skeleton';

// Same full-swipe-commits gesture as the main Notes list — see that file's
// own comment. The outer, full-swipe action here is Unarchive (putting a
// note back), not Delete — this is the one place a full swipe shouldn't
// mean "gone," since everything in this list already survived one swipe
// gesture to get here.
const FULL_SWIPE_UNARCHIVE_THRESHOLD = -220;

function noteTitle(text: string): string {
  return text.split('\n')[0].trim();
}
function notePreview(text: string): string {
  return text.split('\n').slice(1).join(' ').trim();
}

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (daysAgo < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * A real second screen, not an inline section of the main Notes list — same
 * "tap a folder, see what's inside" model as Apple Notes' own Recently
 * Deleted. Notes' own list used to render every archived note's full row
 * right there below the active ones; that meant "archiving" something
 * barely moved it out of the way at all, still taking up just as much
 * visible space one section down. This screen is that space back — Notes
 * only ever shows a single summary row for however many notes are archived.
 */
export default function ArchiveScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const entering = useFadeInEntering();

  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const dragListeners = useRef<Map<string, string>>(new Map());
  const pendingFullSwipeUnarchive = useRef<Set<string>>(new Set());

  const reload = useCallback(() => {
    (async () => {
      setNotes(await getArchivedNotes());
      setLoaded(true);
    })();
  }, []);

  useFocusEffect(reload);

  const handleDelete = async (id: string) => {
    hapticImpactLight();
    const previous = notes;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteNote(id);
    } catch {
      hapticError();
      setNotes(previous);
    }
  };

  const handleUnarchive = async (note: NoteEntry) => {
    hapticImpactLight();
    const previous = notes;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    try {
      await setNoteArchived(note.id, false);
    } catch {
      hapticError();
      setNotes(previous);
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
          style={({ pressed }) => [styles.headerButton, pressed && PRESSED_DIM]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Archive</Text>
        <View style={styles.headerButton} />
      </View>

      {!loaded ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <SkeletonCard height={140} lines={3} />
        </ScrollView>
      ) : (
        <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {notes.length === 0 ? (
            <View style={styles.emptyCard}>
              <SymbolView name="archivebox" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
              <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                Nothing archived — notes you archive from the main list show up here.
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {notes.map((note, index) => (
                <Swipeable
                  key={note.id}
                  ref={(ref) => {
                    if (ref) swipeableRefs.current.set(note.id, ref);
                    else swipeableRefs.current.delete(note.id);
                  }}
                  renderRightActions={(_progress, dragX) => {
                    const previousListenerId = dragListeners.current.get(note.id);
                    if (previousListenerId) dragX.removeListener(previousListenerId);
                    const listenerId = dragX.addListener(({ value }) => {
                      if (
                        value < FULL_SWIPE_UNARCHIVE_THRESHOLD &&
                        !pendingFullSwipeUnarchive.current.has(note.id)
                      ) {
                        pendingFullSwipeUnarchive.current.add(note.id);
                        swipeableRefs.current.get(note.id)?.close();
                      }
                    });
                    dragListeners.current.set(note.id, listenerId);
                    return (
                      <View style={styles.actionsRow}>
                        <Pressable
                          style={({ pressed }) => [styles.action, styles.unarchiveAction, pressed && PRESSED_DIM]}
                          onPress={() => {
                            swipeableRefs.current.get(note.id)?.close();
                            handleUnarchive(note);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Move note out of Archive"
                        >
                          <SymbolView name="arrow.uturn.left" size={15} tintColor="#ffffff" />
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [styles.action, styles.deleteAction, pressed && PRESSED_DIM]}
                          onPress={() => handleDelete(note.id)}
                          accessibilityRole="button"
                          accessibilityLabel="Delete note"
                        >
                          <SymbolView name="trash.fill" size={15} tintColor="#ffffff" />
                        </Pressable>
                      </View>
                    );
                  }}
                  onSwipeableClose={() => {
                    if (pendingFullSwipeUnarchive.current.has(note.id)) {
                      pendingFullSwipeUnarchive.current.delete(note.id);
                      handleUnarchive(note);
                    }
                  }}
                  overshootRight
                >
                  <Pressable
                    style={[
                      styles.noteRow,
                      index < notes.length - 1 && styles.noteRowDivider,
                      { backgroundColor: colors.surface },
                    ]}
                    onPress={() => {
                      hapticImpactLight();
                      router.push({ pathname: '/notes/[id]', params: { id: note.id } } as never);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${noteTitle(note.text)}. ${formatNoteDate(note.updatedAt)}`}
                  >
                    <View style={styles.noteText}>
                      <Text style={styles.noteTitle} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                        {noteTitle(note.text)}
                      </Text>
                      <View style={styles.noteMetaRow}>
                        <Text style={styles.noteDate} maxFontSizeMultiplier={1.2}>{formatNoteDate(note.updatedAt)}</Text>
                        {notePreview(note.text) ? (
                          <Text style={styles.notePreview} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                            {notePreview(note.text)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                </Swipeable>
              ))}
            </View>
          )}
        </ScrollView>
        </ReanimatedAnimated.View>
      )}
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
    },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
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
    noteRow: {
      paddingHorizontal: 16,
      paddingVertical: 13,
      gap: 3,
    },
    noteRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    noteText: {
      gap: 3,
    },
    noteTitle: {
      color: colors.text,
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-SemiBold',
    },
    noteMetaRow: {
      flexDirection: 'row',
      gap: 6,
    },
    noteDate: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
    },
    notePreview: {
      flex: 1,
      color: colors.textTertiary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Regular',
    },
    actionsRow: {
      flexDirection: 'row',
    },
    action: {
      width: 64,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unarchiveAction: {
      backgroundColor: '#8E8E93',
    },
    deleteAction: {
      backgroundColor: '#E5484D',
    },
  });
}
