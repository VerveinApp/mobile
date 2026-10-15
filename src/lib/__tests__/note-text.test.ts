import { notePreview, noteTitle } from '@/lib/note-text';

describe('note text', () => {
  it('titles a note by its first line with text', () => {
    expect(noteTitle('Leg day\nfelt strong')).toBe('Leg day');
    expect(noteTitle('\n\n  Knee felt off \nrest tomorrow')).toBe('Knee felt off');
    expect(noteTitle('   \n ')).toBe('');
  });

  it('previews what follows the title line', () => {
    expect(notePreview('\nLeg day\nfelt\nstrong')).toBe('felt strong');
    expect(notePreview('Only a title')).toBe('');
  });
});
