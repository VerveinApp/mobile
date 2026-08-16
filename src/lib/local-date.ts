/**
 * `Date.toISOString().slice(0, 10)` looks like a date-key helper but isn't
 * one — it reads UTC, not the device's local calendar day. Anywhere that
 * result gets compared against `Date.getDay()` (local) or shown to the user
 * as "today", the two silently disagree for part of the day (evening in
 * negative-UTC-offset zones, early morning in positive ones), e.g. a US
 * evening streak reads as broken because "today" rolled over in UTC hours
 * before it did locally. This is the local-calendar equivalent, used
 * everywhere a YYYY-MM-DD date key is meant to mean "today, here."
 */
export function localDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
