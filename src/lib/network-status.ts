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
export function useIsOffline(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return unsubscribe;
  }, []);

  return isOffline;
}
