import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/ui/app-symbol';

import { Type } from '@/constants/theme';
import { useHoverFade } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { deleteNote, getNote, saveNote } from '@/lib/notes';
import { useAppColors } from '@/lib/theme-context';
import { SkeletonBlock } from '@/components/ui/skeleton';

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
  // BUG FIX: the cleanup effect below used to check textRef.current alone —
  // but textRef only gets the real note's text once the mount effect's
  // async getNote(id) actually resolves. Navigating away before that read
  // finishes left textRef still '', so the cleanup read that as "left
  // empty" and deleted the real, already-saved note on disk, even though
  // the user never saw or touched it. A ref (not the `loaded` state) since
  // the cleanup closure below only ever sees whatever `loaded` was at
  // mount — same staleness reason textRef itself exists instead of `text`.
  const loadedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const existing = id ? await getNote(id) : null;
      setText(existing?.text ?? '');
      textRef.current = existing?.text ?? '';
      loadedRef.current = true;
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
      if (!id || !loadedRef.current) return;
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
    // BUG FIX (found in a later full-app audit): this screen's note input
    // has no keyboard-avoidance at all — same fix as settings/index.tsx
    // already has.
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 8 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
          // BUG FIX (found in a later full-app audit): unlike every other
          // free-text field in this app (profile name: 25, referral code:
          // 6), this had no length limit at all — a very large pasted
          // block could hit AsyncStorage's own size ceiling on write, which
          // notes.ts's silent try/catch would swallow with zero indication
          // the note didn't actually save. Generous (several pages of
          // text), not restrictive — this is about ruling out a pathological
          // paste, not limiting a normal note.
          maxLength={20000}
          autoFocus={text.length === 0}
          textAlignVertical="top"
          maxFontSizeMultiplier={1.3}
        />
      ) : (
        <View style={styles.skeletonWrap}>
          <SkeletonBlock width="70%" height={18} borderRadius={4} />
          <SkeletonBlock width="100%" height={14} borderRadius={4} style={styles.skeletonLine} />
          <SkeletonBlock width="90%" height={14} borderRadius={4} style={styles.skeletonLine} />
          <SkeletonBlock width="60%" height={14} borderRadius={4} style={styles.skeletonLine} />
        </View>
      )}
    </KeyboardAvoidingView>
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
      fontSize: Type.bodyLarge,
      lineHeight: 22,
      fontFamily: 'Geist-Regular',
    },
    skeletonWrap: {
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    skeletonLine: {
      marginTop: 12,
    },
  });
}
