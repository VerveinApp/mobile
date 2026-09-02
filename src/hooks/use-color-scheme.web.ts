import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // queueMicrotask: react-hooks/set-state-in-effect flags a same-tick
    // setState-in-effect (can cascade an extra render) — deferring by a
    // microtask still hydrates on the same frame in practice.
    queueMicrotask(() => {
      setHasHydrated(true);
    });
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
