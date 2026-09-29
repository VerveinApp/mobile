import type { EnergyScore } from '@/components/home/energy-gauge';
import { localDateStr } from '@/lib/local-date';
import { clearStoredValue, readJsonValue, writeJsonValue } from '@/lib/storage/json-storage';

const HISTORY_KEY = 'vervein.lastCheckIn.v1';

/**
 * Only the single most recent check-in — enough to compare "how does today
 * feel against last time" and to show a ghost marker on the gauge. Not a
 * full log; that's real-engine territory, not a UI-modernization concern.
 */
export type CheckInRecord = {
  /** YYYY-MM-DD, local date the check-in was recorded. */
  date: string;
  energy: EnergyScore;
};

export async function getLastCheckIn(): Promise<CheckInRecord | null> {
  return readJsonValue<CheckInRecord | null>(HISTORY_KEY, null);
}

export async function recordCheckIn(energy: EnergyScore) {
  const record: CheckInRecord = { date: localDateStr(), energy };
  await writeJsonValue(HISTORY_KEY, record);
}

export async function clearCheckInHistory() {
  await clearStoredValue(HISTORY_KEY);
}

/** Overwrites the single stored record wholesale — data-backup.ts's restore
 * path only. A stale date restored from an old backup is still honest
 * (correctly reflects when the user last really checked in before a gap),
 * so this deliberately doesn't re-stamp today's date the way recordCheckIn
 * always does. */
export async function restoreLastCheckIn(record: CheckInRecord | null): Promise<void> {
  if (record === null) await clearStoredValue(HISTORY_KEY);
  else await writeJsonValue(HISTORY_KEY, record);
}
