import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import { clearStoredValue, readJsonList, writeJsonValue } from '@/lib/storage/json-storage';

const KEY = 'vervein.progressPhotos.v1';
const MAX_ENTRIES = 500;
const DIR_NAME = 'progress-photos';

// The most sensitive of everything Log added this session — actual photos of
// a person's body, not a number or a self-reported tag. Linked from
// Settings' DATA section and from Log, same accepted ahead-of-privacy-policy
// tradeoff as body-measurements.ts and condition-log.ts, one tier more
// cautious given what this one actually stores. Also deliberately EXCLUDED
// from data-backup.ts's export/restore —
// see that file's own header comment: its whole contract is a pasteable JSON
// blob, and base64-inlining photos into that would make an ordinary export
// balloon to megabytes for something meant to be shared as text. clearData
// below IS wired into clearAllLocalData, since leaving these files on disk
// after someone asks to delete their data would be a real privacy failure,
// independent of the export-format question.
export type ProgressPhotoEntry = {
  id: string;
  /** YYYY-MM-DD — the day the photo represents, not necessarily today (a
   * backfilled photo from the camera roll is honest the same way
   * log-past-session-sheet.tsx's backfill is). */
  date: string;
  /** File name only, relative to this module's own photos directory —
   * never a full path, so a restored/moved app sandbox can't break it. */
  fileName: string;
  /** ISO 8601 — when this record was added, distinct from `date`. */
  createdAt: string;
};

function photosDirectory(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** The real, displayable file:// URI for an entry — Image components read this directly. */
export function progressPhotoUri(entry: ProgressPhotoEntry): string {
  return new File(photosDirectory(), entry.fileName).uri;
}

/** Every stored photo, most recent date first. */
export async function getProgressPhotos(): Promise<ProgressPhotoEntry[]> {
  const entries = await readJsonList<ProgressPhotoEntry>(KEY);
  // Tie-broken by createdAt (newest first) for two photos on the same
  // date — without it, same-day photos kept whatever order they happened
  // to be stored in, which put a freshly-added one at the END of that
  // day's group instead of matching the newest-first order the screen's
  // own optimistic update already showed right after adding it.
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

/**
 * Copies the image picker's temporary asset into this app's own durable
 * storage and records it — the picker's own URI lives in a cache Expo/iOS
 * can reclaim at any time, so nothing here can just store that path and
 * read it back later. `id` is the caller's responsibility (expo-crypto's
 * randomUUID from the UI layer, same reasoning as notes.ts and
 * condition-log.ts — this keeps every lib/ module data-backup.ts touches
 * free of expo-crypto's native import, which breaks under Jest). Returns
 * null on any failure (permission revoked mid-copy, disk full, etc.) rather
 * than throwing, so the screen can show one honest "couldn't save that
 * photo" message instead of a crash.
 */
export async function addProgressPhoto(id: string, date: string, sourceUri: string): Promise<ProgressPhotoEntry | null> {
  try {
    const extension = sourceUri.split('.').pop()?.toLowerCase() || 'jpg';
    const destination = new File(photosDirectory(), `${id}.${extension}`);
    const source = new File(sourceUri);
    await source.copy(destination, { overwrite: true });
    const entry: ProgressPhotoEntry = { id, date, fileName: destination.name, createdAt: new Date().toISOString() };
    const entries = await readJsonList<ProgressPhotoEntry>(KEY);
    const next = [...entries, entry].slice(-MAX_ENTRIES);
    // Deliberately NOT writeJsonValue (storage/json-storage.ts) here, unlike
    // every other write in this file — that helper swallows a failed write
    // and returns as if it succeeded, which is exactly right for a
    // fire-and-forget log entry but wrong here: this function's whole
    // contract is "return null on ANY failure" so the screen can show one
    // honest error, and a photo record silently failing to persist while
    // still reporting success would leave the UI showing a photo that
    // vanishes on the next real load.
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return entry;
  } catch {
    return null;
  }
}

export async function deleteProgressPhoto(id: string) {
  const entries = await readJsonList<ProgressPhotoEntry>(KEY);
  const entry = entries.find((e) => e.id === id);
  if (entry) {
    try {
      new File(photosDirectory(), entry.fileName).delete();
    } catch {
      // Worst case the file lingers on disk unreferenced — the record
      // driving the UI is still removed either way.
    }
  }
  await writeJsonValue(KEY, entries.filter((e) => e.id !== id));
}

/** Wipes every photo file and record — Settings' "Delete My Data"/"Delete
 * Account" flows only. Deleting the whole directory rather than each file
 * individually so a photo added between the AsyncStorage read and this call
 * can't survive as an orphaned file nothing references. */
export async function clearProgressPhotos() {
  try {
    const dir = photosDirectory();
    if (dir.exists) dir.delete();
  } catch {
    // Best-effort — same as never having added a photo.
  }
  await clearStoredValue(KEY);
}

// Account switching (see account-switch.ts): when a different account signs
// in on this device, the previous account's photos are set aside under that
// account's id — never shown to the new account, never deleted — and moved
// back if that account signs in again. A rename, not a copy, so it's instant
// and never doubles the storage these full-resolution files take up.
function stashedPhotosDirectory(ownerId: string): Directory {
  return new Directory(Paths.document, `${DIR_NAME}-account-${ownerId}`);
}

function stashedIndexKey(ownerId: string): string {
  return `vervein.progressPhotosStash.${ownerId}.v1`;
}

export async function stashProgressPhotos(ownerId: string): Promise<void> {
  // Raw Directory, not photosDirectory() — that helper creates the folder
  // when missing, and move() below needs its destination NOT to exist (it
  // follows Unix semantics: moving onto an existing folder nests inside it).
  const current = new Directory(Paths.document, DIR_NAME);
  const stash = stashedPhotosDirectory(ownerId);
  try {
    if (stash.exists) stash.delete();
    if (current.exists) await current.move(stash);
  } catch {
    // Worst case the files stay where they are; clearAllLocalData removes them.
  }
  try {
    const index = await AsyncStorage.getItem(KEY);
    if (index) await AsyncStorage.setItem(stashedIndexKey(ownerId), index);
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Best-effort, same contract as every other store here.
  }
}

export async function restoreStashedProgressPhotos(ownerId: string): Promise<void> {
  const current = new Directory(Paths.document, DIR_NAME);
  const stash = stashedPhotosDirectory(ownerId);
  try {
    if (stash.exists) {
      if (current.exists) current.delete();
      await stash.move(current);
    }
  } catch {
    // Leave the stash in place rather than lose it.
  }
  try {
    const index = await AsyncStorage.getItem(stashedIndexKey(ownerId));
    if (index) await AsyncStorage.setItem(KEY, index);
    await AsyncStorage.removeItem(stashedIndexKey(ownerId));
  } catch {
    // Best-effort.
  }
}
