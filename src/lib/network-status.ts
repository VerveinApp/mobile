import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Real, live connectivity — not a one-time check. `isConnected` alone can
 * be `true` on a network with no actual internet path (captive portal,
 * airplane-mode-adjacent edge cases); `isInternetReachable` is NetInfo's
 * own deeper check for that, but starts `null` (unknown) until its first
 * real probe resolves — treated as "assume online" here rather than
 * flashing an offline banner on every cold start before that first probe
 * lands, matching this app's own "never a false claim, but don't invent
 * alarm from a temporarily-unknown state either" bias.
 */
// A dropped connection has to last this long before the app says so. On a
// weak signal (a gym, an elevator) NetInfo flips offline/online every few
// seconds, and the banner used to flicker in and out with every blip.
// Coming back online is reported immediately.
const OFFLINE_REPORT_DELAY_MS = 2000;

export function useIsOffline(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      if (pending) {
        clearTimeout(pending);
        pending = null;
      }
      if (offline) {
        pending = setTimeout(() => setIsOffline(true), OFFLINE_REPORT_DELAY_MS);
      } else {
        setIsOffline(false);
      }
    });
    return () => {
      if (pending) clearTimeout(pending);
      unsubscribe();
    };
  }, []);

  return isOffline;
}
