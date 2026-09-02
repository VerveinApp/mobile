import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const KEY = 'vervein.progressPhotos.v1';
const MAX_ENTRIES = 500;
const DIR_NAME = 'progress-photos';

// The most sensitive of everything Log added this session — actual photos of
// a person's body, not a number or a self-reported tag. Deliberately built
// but NOT linked from any nav row yet, same "code ready, entry point hidden
// until the privacy policy is real" treatment as body-measurements.ts and
// condition-log.ts, one tier more cautious given what this one actually
// stores. Also deliberately EXCLUDED from data-backup.ts's export/restore —
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

async function readAll(): Promise<ProgressPhotoEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProgressPhotoEntry[]) : [];
  } catch {
    return [];
  }
}

/** Every stored photo, most recent date first. */
export async function getProgressPhotos(): Promise<ProgressPhotoEntry[]> {
  const entries = await readAll();
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
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
    const entries = await readAll();
    const next = [...entries, entry].slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return entry;
  } catch {
    return null;
  }
}

export async function deleteProgressPhoto(id: string) {
  try {
    const entries = await readAll();
    const entry = entries.find((e) => e.id === id);
    if (entry) {
      try {
        new File(photosDirectory(), entry.fileName).delete();
      } catch {
        // Worst case the file lingers on disk unreferenced — the record
        // driving the UI is still removed either way.
      }
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(entries.filter((e) => e.id !== id)));
  } catch {
    // Worst case the entry reappears next load — never a crash.
  }
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
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Best-effort.
  }
}
