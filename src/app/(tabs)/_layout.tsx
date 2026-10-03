import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

import AppTabs from '@/components/app-tabs';
import { useNotificationRedirect } from '@/lib/notification-redirect';
import { hasCompletedOnboarding } from '@/lib/onboarding-draft';
import { supabase } from '@/lib/supabase';

export default function TabsLayout() {
  // Real onboarding always ends in a real Supabase sign-in (email OTP or
  // Apple/Google — see create-account.tsx's own doc comment; there is no
  // guest/local-only path). The only way to land here without a session is
  // a stale screen left mounted underneath by a replace()-only navigation
  // (Sign Out / Delete Account / Delete My Data, all in settings/index.tsx)
  // reappearing via an edge-swipe-back — those three now call dismissAll()
  // first specifically to prevent that, but this check is the backstop:
  // useFocusEffect re-runs every time (tabs) becomes the visible screen
  // again, including via back-navigation, unlike a mount-only useEffect
  // which would miss exactly that case since (tabs) is never actually
  // unmounted by a sibling replace() in this app's single flat root Stack.
  //
  // Gated on hasCompletedOnboarding() too, not just session — (tabs) is
  // also this app's cold-launch default route (listed first in the root
  // Stack), and (tabs)/index.tsx's own mount effect already resumes an
  // in-progress onboarding draft or sends a brand-new user to Welcome. That
  // case has no session yet either (account creation hasn't happened), but
  // it's not this bug: without this check, a fresh install would race this
  // guard's redirect-to-create-account against Home's own redirect-to-the-
  // actual-right-step, and skip straight past whatever answers a draft
  // already had. Checking completion first scopes this guard to exactly
  // "had a real account, now doesn't" and leaves first-run/resume entirely
  // to Home's existing logic.
  //
  // Skipped only for the E2E test harness (e2e-seed.tsx), which
  // deliberately drops into (tabs) with a seeded local profile and no real
  // session — real device/CI distinction is the same
  // EXPO_PUBLIC_E2E_SEED_ENABLED flag that route itself checks, compiled to
  // a dead branch in every real build.
  //
  // BUG FIX: this used to run on every focus including the very first one —
  // (tabs) is the app's cold-launch default route, and at that exact moment
  // supabase.auth.getSession() can race the client's own restoration of a
  // real persisted session from storage and briefly report no session even
  // for a genuinely signed-in returning user. That's not a false negative
  // this guard needs to catch — a fresh cold launch can never be "swiping
  // back into a stale screen" (there's nothing to swipe back into yet), so
  // it was never the scenario this exists for. dismissAll()/replace() firing
  // from that false read, this early, on the app's very first screen before
  // the root navigator may even be fully attached, threw an error inside an
  // async callback — which bypasses the root ErrorBoundary entirely (it only
  // catches render-phase errors) and crashed the app outright in a release
  // build. isFirstFocus skips exactly the one case that was never real,
  // leaving every genuine re-entry (second focus onward) fully covered.
  // The try/catch is a hard backstop on top — this is defense-in-depth for
  // a bug class the primary fixes (dismissAll() at each real sign-out/
  // delete call site) already close; it must never be the thing that takes
  // the whole app down again if some future edge case slips past it.
  const isFirstFocus = useRef(true);
  useNotificationRedirect();
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (process.env.EXPO_PUBLIC_E2E_SEED_ENABLED === '1') return;
      (async () => {
        try {
          const completed = await hasCompletedOnboarding();
          if (!completed) return;
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();
          // BUG FIX: getSession() also returns session: null when the access
          // token has expired and refreshing it failed for a NETWORK reason
          // (see auth-js's own __loadSession) — an hour-plus offline, e.g. a
          // gym basement, then returning to the tabs from check-in bounced a
          // perfectly signed-in user to the sign-in screen. The session is
          // still in storage and refreshes once there's signal again; only a
          // real, non-network "no session" means signed out.
          if (!session && !isAuthRetryableFetchError(error)) {
            router.dismissAll();
            router.replace('/onboarding/create-account' as never);
          }
        } catch {
          // Defense-in-depth backstop — see comment above. Worst case a
          // stale screen stays reachable a moment longer, never a crash.
        }
      })();
    }, [])
  );

  return <AppTabs />;
}
