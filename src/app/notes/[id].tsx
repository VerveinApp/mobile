import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { useHoverFade } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { deleteNote, getNote, saveNote } from '@/lib/notes';
import { useAppColors } from '@/lib/theme-context';

const AUTOSAVE_DELAY_MS = 600;

/**
 * One freeform note — autosaves on a debounce while typing, same "no
 * explicit save button" feel as Apple Notes. A note that's empty (or only
 * whitespace) when this screen is left is deleted rather than kept as a
 * blank row — matches lib/notes.ts's own "never store a blank entry" rule,
 * covering both a note someone opened and immediately backed out of, and
 * one they deleted down to nothing.
 */
export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const deleteHover = useHoverFade();

  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const textRef = useRef('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const existing = id ? await getNote(id) : null;
      setText(existing?.text ?? '');
      textRef.current = existing?.text ?? '';
      setLoaded(true);
    })();
  }, [id]);

  // Flush on the way out — covers the header back button and the native
  // swipe-back gesture alike, neither of which otherwise triggers a save.
  // textRef (not `text`) so this always sees the latest keystroke, not
  // whatever `text` was when this effect's closure was created.
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (!id) return;
      const trimmed = textRef.current.trim();
      if (trimmed.length === 0) {
        deleteNote(id);
      } else {
        saveNote(id, textRef.current);
      }
    };
  }, [id]);

  const handleChangeText = (next: string) => {
    setText(next);
    textRef.current = next;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (id && next.trim().length > 0) saveNote(id, next);
    }, AUTOSAVE_DELAY_MS);
  };

  const handleDelete = () => {
    hapticImpactLight();
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    textRef.current = '';
    if (id) deleteNote(id);
    router.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
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
        <Pressable
          onPress={handleDelete}
          onHoverIn={deleteHover.onHoverIn}
          onHoverOut={deleteHover.onHoverOut}
          hitSlop={10}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Delete note"
        >
          <SymbolView name="trash" size={16} tintColor={colors.iconMuted} />
        </Pressable>
      </View>

      {loaded ? (
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleChangeText}
          placeholder="Note"
          placeholderTextColor={colors.textTertiary}
          multiline
          autoFocus={text.length === 0}
          textAlignVertical="top"
          maxFontSizeMultiplier={1.3}
        />
      ) : null}
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
      paddingBottom: 8,
    },
    headerButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 24,
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: 'Geist-Regular',
    },
  });
}
