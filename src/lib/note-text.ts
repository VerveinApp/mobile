/** A note's title: its first line with any text — a note that starts with
 * a blank line still gets a readable title, never an empty row. */
export function noteTitle(text: string): string {
  return text.split('\n').find((line) => line.trim() !== '')?.trim() ?? '';
}

/** Everything after the title line, on one line, for the list preview. */
export function notePreview(text: string): string {
  const lines = text.split('\n');
  const titleIndex = lines.findIndex((line) => line.trim() !== '');
  return titleIndex === -1 ? '' : lines.slice(titleIndex + 1).join(' ').trim();
}
