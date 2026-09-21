import * as Sentry from '@sentry/react-native';

/**
 * Crash/error reporting — added specifically because diagnosing a real
 * production crash without it (2026-09-14) meant working from a stripped
 * native `.ips` file alone: no JS stack trace, no file/line, just reasoning
 * about which async callback could plausibly race. Sentry's React Native SDK
 * catches both native crashes and JS exceptions (including ones inside async
 * callbacks that bypass React's own render-phase-only ErrorBoundary) and
 * reports the real stack trace, so a future crash like that one is a lookup,
 * not an investigation.
 *
 * No-ops entirely without a real DSN (EXPO_PUBLIC_SENTRY_DSN unset) rather
 * than throwing — same "under-triggering is the safe failure mode" rule
 * health-kit.ts and purchases.ts already follow for their own optional
 * integrations. `debug` is tied to `__DEV__` so local development doesn't
 * spam a production Sentry project with every warning while still logging
 * to the console for a developer actually watching for it.
 */
export function initErrorMonitoring(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    debug: __DEV__,
    tracesSampleRate: 1.0,
  });
}
