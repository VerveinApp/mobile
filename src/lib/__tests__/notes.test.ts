import {
  clearNotes,
  deleteNote,
  getAllNotes,
  getArchivedNotes,
  getNote,
  getNotes,
  restoreNotes,
  saveNote,
  setNoteArchived,
  type NoteEntry,
} from '@/lib/notes';

describe('notes', () => {
  afterEach(async () => {
    await clearNotes();
  });

  it('returns an empty list when nothing has been written', async () => {
    expect(await getNotes()).toEqual([]);
  });

  it('saveNote (first call) creates a new note with real createdAt/updatedAt timestamps', async () => {
    await saveNote('note-1', 'hello world');
    const notes = await getNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ id: 'note-1', text: 'hello world' });
    expect(typeof notes[0].createdAt).toBe('string');
    expect(typeof notes[0].updatedAt).toBe('string');
  });

  it('saveNote (second call, same id) updates in place rather than creating a duplicate, preserving createdAt', async () => {
    await saveNote('note-1', 'first draft');
    const first = await getNote('note-1');
    await saveNote('note-1', 'second draft');
    const notes = await getNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe('second draft');
    expect(notes[0].createdAt).toBe(first?.createdAt);
  });

  it('getNote returns null for an id that was never saved', async () => {
    expect(await getNote('missing')).toBeNull();
  });

  it('getNotes excludes archived notes; getArchivedNotes returns only archived ones', async () => {
    await saveNote('note-1', 'active note');
    await saveNote('note-2', 'to be archived');
    await setNoteArchived('note-2', true);

    expect((await getNotes()).map((n) => n.id)).toEqual(['note-1']);
    expect((await getArchivedNotes()).map((n) => n.id)).toEqual(['note-2']);
  });

  it('getAllNotes returns every note regardless of archived status — REGRESSION GUARD: data-backup.ts must never silently drop archived notes from a full export', async () => {
    await saveNote('note-1', 'active note');
    await saveNote('note-2', 'archived note');
    await setNoteArchived('note-2', true);
    expect((await getAllNotes()).map((n) => n.id).sort()).toEqual(['note-1', 'note-2']);
  });

  it('setNoteArchived(false) restores an archived note back to the main list', async () => {
    await saveNote('note-1', 'a note');
    await setNoteArchived('note-1', true);
    await setNoteArchived('note-1', false);
    expect((await getNotes()).map((n) => n.id)).toEqual(['note-1']);
  });

  it('editing text after archiving does not silently un-archive the note', async () => {
    await saveNote('note-1', 'original');
    await setNoteArchived('note-1', true);
    await saveNote('note-1', 'edited while archived');
    const note = await getNote('note-1');
    expect(note?.archived).toBe(true);
    expect(note?.text).toBe('edited while archived');
  });

  it('getNotes/getArchivedNotes/getAllNotes all sort most-recently-updated first', async () => {
    // Real timers, not fake ones: saveNote stamps updatedAt via `new
    // Date().toISOString()` at call time, and jest's modern fake timers
    // freeze Date itself — advancing them wouldn't move that stamp forward,
    // it would just make every save race the exact same instant. A tiny
    // real delay between saves is the only way to guarantee distinct,
    // correctly-ordered timestamps here.
    await saveNote('note-1', 'oldest');
    await new Promise((r) => setTimeout(r, 2));
    await saveNote('note-2', 'newer');
    await new Promise((r) => setTimeout(r, 2));
    await saveNote('note-1', 'oldest, now edited last');
    expect((await getNotes()).map((n) => n.id)).toEqual(['note-1', 'note-2']);
  });

  it('deleteNote removes only the targeted note', async () => {
    await saveNote('note-1', 'keep');
    await saveNote('note-2', 'delete me');
    await deleteNote('note-2');
    expect((await getAllNotes()).map((n) => n.id)).toEqual(['note-1']);
  });

  it('clearNotes wipes every note', async () => {
    await saveNote('note-1', 'a note');
    await clearNotes();
    expect(await getAllNotes()).toEqual([]);
  });

  it('restoreNotes overwrites the whole store wholesale', async () => {
    const entries: NoteEntry[] = [
      { id: 'note-1', text: 'restored', createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z' },
    ];
    await restoreNotes(entries);
    expect(await getAllNotes()).toEqual(entries);
  });
});
