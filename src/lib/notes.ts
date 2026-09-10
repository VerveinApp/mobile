import { clearStoredValue, readJsonList, writeJsonValue } from '@/lib/storage/json-storage';

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
  /** Archived notes stay out of getNotes()'s main list and out of the count
   * anyone glancing at the screen sees, same "out of the way, not gone"
   * behavior as Apple Notes/Mail's own Archive — undefined and `false` both
   * mean "not archived," so every note written before this field existed
   * reads correctly with no migration. */
  archived?: boolean;
};

/** Every non-archived note, most recently edited first. */
export async function getNotes(): Promise<NoteEntry[]> {
  const entries = await readJsonList<NoteEntry>(KEY);
  return entries.filter((e) => !e.archived).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Every archived note, most recently edited first — same sort as getNotes,
 * kept as its own list rather than a filter flag on that one so the two
 * sections on screen never have to agree on a shared query shape. */
export async function getArchivedNotes(): Promise<NoteEntry[]> {
  const entries = await readJsonList<NoteEntry>(KEY);
  return entries.filter((e) => e.archived).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Every note regardless of archived status, most recently edited first —
 * data-backup.ts's export/backup path only. BUG FIX: that path used to call
 * getNotes() for its full-export payload, which silently excluded archived
 * notes the moment getNotes() itself became active-only (see this file's
 * own archived field comment) — a real data-loss bug, since restoring that
 * payload back would have wiped every archived note along with it. */
export async function getAllNotes(): Promise<NoteEntry[]> {
  const entries = await readJsonList<NoteEntry>(KEY);
  return entries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getNote(id: string): Promise<NoteEntry | null> {
  const entries = await readJsonList<NoteEntry>(KEY);
  return entries.find((e) => e.id === id) ?? null;
}

/** Creates (first call for a given id) or updates (every call after)
 * a note — the editor screen calls this on a debounce while typing and
 * once more on the way out, same "safe to call repeatedly" contract as
 * every other save function in this app. */
export async function saveNote(id: string, text: string) {
  const entries = await readJsonList<NoteEntry>(KEY);
  const existing = entries.find((e) => e.id === id);
  const withoutId = entries.filter((e) => e.id !== id);
  const now = new Date().toISOString();
  const next = [
    // Spreads `existing` first so archived (and any other field this
    // entry might already carry) survives an ordinary text edit — this
    // used to build a bare { id, text, createdAt, updatedAt } object,
    // which would have silently un-archived a note the moment its text
    // was edited.
    ...withoutId,
    { ...existing, id, text, createdAt: existing?.createdAt ?? now, updatedAt: now },
  ].slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, next);
}

export async function deleteNote(id: string) {
  const entries = await readJsonList<NoteEntry>(KEY);
  await writeJsonValue(KEY, entries.filter((e) => e.id !== id));
}

/** Archives or restores a note in place — same list, same id, just the
 * `archived` flag flipped, so nothing about the note itself (text, dates)
 * changes. Mirrors Apple Notes/Mail's own Archive: out of the main list,
 * not deleted, reversible from the Archive section. */
export async function setNoteArchived(id: string, archived: boolean) {
  const entries = await readJsonList<NoteEntry>(KEY);
  const now = new Date().toISOString();
  const next = entries.map((e) => (e.id === id ? { ...e, archived, updatedAt: now } : e));
  await writeJsonValue(KEY, next);
}

/** Wipes every note — Settings' "Delete My Data"/"Delete Account" flows only. */
export async function clearNotes() {
  await clearStoredValue(KEY);
}

/** Overwrites the whole store wholesale — data-backup.ts's restore path only. */
export async function restoreNotes(entries: NoteEntry[]): Promise<void> {
  const trimmed = [...entries].slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, trimmed);
}
