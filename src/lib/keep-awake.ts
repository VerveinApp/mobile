import { useEffect } from 'react';

const TAG = 'vervein-session';

// Same crash guard as session-reminders.ts's getModule: a synchronous
// require inside try/catch, so a build without the native module (an old
// dev client) just keeps its normal auto-lock instead of failing to load.
let cachedModule: typeof import('expo-keep-awake') | null | undefined;
function getModule(): typeof import('expo-keep-awake') | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see session-reminders.ts's getModule for why this must be a synchronous require().
    cachedModule = require('expo-keep-awake');
  } catch {
    cachedModule = null;
  }
  return cachedModule ?? null;
}

/**
 * Keeps the screen on while `enabled` — a workout in progress, so the phone
 * doesn't lock mid-rest and ask for Face ID between sets. Released the
 * moment it's no longer enabled or the screen unmounts.
 */
export function useKeepAwakeWhile(enabled: boolean): void {
  useEffect(() => {
    const KeepAwake = getModule();
    if (!enabled || !KeepAwake) return;
    KeepAwake.activateKeepAwakeAsync(TAG).catch(() => {});
    return () => {
      KeepAwake.deactivateKeepAwake(TAG).catch(() => {});
    };
  }, [enabled]);
}
