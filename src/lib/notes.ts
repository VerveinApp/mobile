import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vervein.notes.v1';
const MAX_ENTRIES = 500; // plain text is cheap — generous, not unbounded

/**
 * Freeform, undated personal notes — deliberately separate from
 * session-history.ts's per-day `notes` field, which is always tied to a
 * specific training day. This is the general-purpose "write anything down"
 * store, same one-text-field-with-the-first-line-as-title convention as
 * Apple Notes: no separate title field, so there's nothing to keep in sync
 * when someone edits the first line.
 */
export type NoteEntry = {
  id: string;
  text: string;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601 — what the list sorts by. */
  updatedAt: string;
};

async function readAll(): Promise<NoteEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NoteEntry[]) : [];
  } catch {
    return [];
  }
}

/** Every stored note, most recently edited first. */
export async function getNotes(): Promise<NoteEntry[]> {
  const entries = await readAll();
  return [...entries].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getNote(id: string): Promise<NoteEntry | null> {
  const entries = await readAll();
  return entries.find((e) => e.id === id) ?? null;
}

/** Creates (first call for a given id) or updates (every call after)
 * a note — the editor screen calls this on a debounce while typing and
 * once more on the way out, same "safe to call repeatedly" contract as
 * every other save function in this app. */
export async function saveNote(id: string, text: string) {
  try {
    const entries = await readAll();
    const existing = entries.find((e) => e.id === id);
    const withoutId = entries.filter((e) => e.id !== id);
    const now = new Date().toISOString();
    const next = [
      ...withoutId,
      { id, text, createdAt: existing?.createdAt ?? now, updatedAt: now },
    ].slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Worst case this edit doesn't stick — never a crash.
  }
}

export async function deleteNote(id: string) {
  try {
    const entries = await readAll();
    await AsyncStorage.setItem(KEY, JSON.stringify(entries.filter((e) => e.id !== id)));
  } catch {
    // Worst case the note reappears next load — never a crash.
  }
}

/** Wipes every note — Settings' "Delete My Data"/"Delete Account" flows only. */
export async function clearNotes() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Best-effort — same as never having written a note.
  }
}

/** Overwrites the whole store wholesale — data-backup.ts's restore path only. */
export async function restoreNotes(entries: NoteEntry[]): Promise<void> {
  try {
    const trimmed = [...entries].slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // Worst case this one field doesn't restore — the rest of the backup still applies independently.
  }
}
