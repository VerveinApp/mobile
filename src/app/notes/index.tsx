import * as Crypto from 'expo-crypto';
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
import { getArchivedNotes, getNotes, deleteNote, setNoteArchived, type NoteEntry } from '@/lib/notes';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppColors } from '@/lib/theme-context';
import { SkeletonCard } from '@/components/ui/skeleton';

// How far (in points) a row has to be dragged left before it auto-archives
// on release — same "drag all the way = committed" gesture as Mail's own
// list. Archive is the full-swipe action here (Mail's own default), not
// Delete — short of this threshold, releasing just leaves both action
// buttons revealed, same as before. Tuned against this card's own row
// width, not the full screen width, since overshootRight lets the drag
// continue well past the buttons.
const FULL_SWIPE_ARCHIVE_THRESHOLD = -220;

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
 * Freeform, undated notes — separate from every other Log entry, which is
 * always about a specific past day. Same one-field, first-line-is-the-title
 * convention as Apple Notes (see lib/notes.ts's own doc comment); a note
 * with nothing but whitespace is never saved, so this list never has to
 * render a blank row.
 *
 * Swipe gestures modeled on Apple Notes/Mail: a partial swipe reveals two
 * actions (Archive, then Delete), and dragging all the way left auto-commits
 * the outer one — Archive, not Delete, same as Mail's own default full-swipe
 * action.
 *
 * Archive is a real second screen (archive.tsx), not an inline section here
 * — this list only ever shows a single summary row for it, same "tap a
 * folder, see what's inside" model as Apple Notes' own Recently Deleted.
 * Rendering every archived note's full row right here (the first version of
 * this feature) meant "archiving" something barely moved it out of the way,
 * still taking up just as much visible space one section down.
 */
export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const addHover = useHoverFade();
  const archiveHover = useHoverFade();
  // Same shared fade used across onboarding, check-in, Home, Progress, and
  // Train — this screen's own loading-to-real-content swap previously
  // hard-cut with no transition (and had no skeleton at all, just a blank
  // area under the header), the one motion-language gap against the rest
  // of the app.
  const entering = useFadeInEntering();

  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Per-row bookkeeping for the Mail-style full-swipe gesture: swipeableRefs
  // lets a row close itself once committed, dragListeners tracks the one
  // active Animated.Value listener per row (removed/replaced each time
  // renderRightActions runs, so re-renders don't stack up duplicates), and
  // pendingFullSwipeArchive marks a row as "committed" the moment the drag
  // crosses the threshold — the actual archive only fires from
  // onSwipeableClose below, once the row has finished animating away from
  // under the still-active touch, not mid-gesture.
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const dragListeners = useRef<Map<string, string>>(new Map());
  const pendingFullSwipeArchive = useRef<Set<string>>(new Set());

  const reload = useCallback(() => {
    (async () => {
      const [active, archived] = await Promise.all([getNotes(), getArchivedNotes()]);
      setNotes(active);
      setArchivedCount(archived.length);
      setLoaded(true);
    })();
  }, []);

  useFocusEffect(reload);

  const handleCompose = () => {
    hapticImpactLight();
    const id = Crypto.randomUUID();
    router.push({ pathname: '/notes/[id]', params: { id } } as never);
  };

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

  const handleArchive = async (note: NoteEntry) => {
    hapticImpactLight();
    const previous = notes;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    setArchivedCount((prev) => prev + 1);
    try {
      await setNoteArchived(note.id, true);
    } catch {
      hapticError();
      setNotes(previous);
      setArchivedCount((prev) => prev - 1);
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
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Notes</Text>
        <Pressable
          onPress={handleCompose}
          onHoverIn={addHover.onHoverIn}
          onHoverOut={addHover.onHoverOut}
          hitSlop={10}
          style={({ pressed }) => [styles.headerButton, pressed && PRESSED_DIM]}
          accessibilityRole="button"
          accessibilityLabel="New note"
        >
          <SymbolView name="square.and.pencil" size={17} tintColor="#5FBE84" />
        </Pressable>
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
              <SymbolView name="note.text" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
              <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                No notes yet — tap the pencil to write one.
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
                      if (value < FULL_SWIPE_ARCHIVE_THRESHOLD && !pendingFullSwipeArchive.current.has(note.id)) {
                        pendingFullSwipeArchive.current.add(note.id);
                        swipeableRefs.current.get(note.id)?.close();
                      }
                    });
                    dragListeners.current.set(note.id, listenerId);
                    return (
                      <View style={styles.actionsRow}>
                        <Pressable
                          style={({ pressed }) => [styles.action, styles.archiveAction, pressed && PRESSED_DIM]}
                          onPress={() => {
                            swipeableRefs.current.get(note.id)?.close();
                            handleArchive(note);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Archive note"
                        >
                          <SymbolView name="archivebox.fill" size={15} tintColor="#ffffff" />
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
                    if (pendingFullSwipeArchive.current.has(note.id)) {
                      pendingFullSwipeArchive.current.delete(note.id);
                      handleArchive(note);
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

          {archivedCount > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.archiveRow, pressed && PRESSED_DIM]}
              onPress={() => {
                hapticImpactLight();
                router.push('/notes/archive' as never);
              }}
              onHoverIn={archiveHover.onHoverIn}
              onHoverOut={archiveHover.onHoverOut}
              accessibilityRole="button"
              accessibilityLabel={`Archive, ${archivedCount} note${archivedCount === 1 ? '' : 's'}`}
            >
              <View style={styles.archiveIconWrap}>
                <SymbolView name="archivebox.fill" size={15} tintColor={colors.textSecondary} />
              </View>
              <Text style={styles.archiveRowLabel} maxFontSizeMultiplier={1.3}>Archive</Text>
              <Text style={styles.archiveRowCount} maxFontSizeMultiplier={1.2}>{archivedCount}</Text>
              <SymbolView name="chevron.right" size={12} tintColor={colors.iconFaint} />
            </Pressable>
          ) : null}
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
      gap: 16,
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
    archiveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    archiveIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.pillBg,
    },
    archiveRowLabel: {
      flex: 1,
      color: colors.text,
      fontSize: Type.bodyLarge,
      fontFamily: 'Geist-SemiBold',
    },
    archiveRowCount: {
      color: colors.textTertiary,
      fontSize: Type.body,
      fontFamily: 'Geist-Medium',
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
    archiveAction: {
      backgroundColor: '#8E8E93',
    },
    deleteAction: {
      backgroundColor: '#E5484D',
    },
  });
}
