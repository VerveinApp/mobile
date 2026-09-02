import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { useHoverFade } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight } from '@/lib/haptics';
import { deleteNote, getNotes, type NoteEntry } from '@/lib/notes';
import { useAppColors } from '@/lib/theme-context';

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
 */
export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const addHover = useHoverFade();

  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    (async () => {
      setNotes(await getNotes());
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
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Notes</Text>
        <Pressable
          onPress={handleCompose}
          onHoverIn={addHover.onHoverIn}
          onHoverOut={addHover.onHoverOut}
          hitSlop={10}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="New note"
        >
          <SymbolView name="square.and.pencil" size={17} tintColor="#5FBE84" />
        </Pressable>
      </View>

      {!loaded ? null : (
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
                  renderRightActions={() => (
                    <Pressable
                      style={styles.deleteAction}
                      onPress={() => handleDelete(note.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Delete note"
                    >
                      <SymbolView name="trash.fill" size={15} tintColor="#ffffff" />
                    </Pressable>
                  )}
                  overshootRight={false}
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
      fontSize: 12.5,
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
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
    noteMetaRow: {
      flexDirection: 'row',
      gap: 6,
    },
    noteDate: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: 'Geist-Medium',
    },
    notePreview: {
      flex: 1,
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: 'Geist-Regular',
    },
    deleteAction: {
      width: 72,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#E5484D',
    },
  });
}
