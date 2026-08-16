import { router } from 'expo-router';

/**
 * Back navigation that's correct in both the common case and the resumed-
 * session edge case. `router.back()` plays the native pop animation (the
 * reverse of the push/swipe transition) and honors the in-progress swipe
 * gesture, but is a silent no-op when there's no navigation history —
 * which happens every time the app resumes mid-onboarding after being
 * killed, since that lands directly on the resumed screen with nothing
 * pushed before it in this process's lifetime (see (tabs)/index.tsx).
 * Falls back to an explicit replace (still fully deterministic, just
 * without the reverse-swipe animation) only in that situation.
 */
export function goBack(pathname: string, params: Record<string, string | undefined>) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace({ pathname, params } as never);
  }
}
