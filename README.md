# VerveIn

An adaptive fitness app built on a real, deterministic training engine —
not a template plan with cosmetic variety. Every session is recomputed from
today's actual check-in (energy score, acute symptom tags) against a frozen
Knowledge Graph of exercise data, so a bad day genuinely produces a
different, still-safe session instead of the same list at lower enthusiasm.

The product has one standing rule that shapes most of its UI decisions:
**no guilt framing.** No streaks, no "you're behind," no red numbers for a
missed day. A long gap since training a body area reads as *well-rested and
ready*, never as debt owed. See any file under `src/lib/engine/` or
`src/lib/plan-preview.ts` for where this shows up in actual logic, not just
copy.

## Stack

- **Expo SDK 57** / **React Native 0.86.2**, TypeScript (strict), Expo
  Router (file-based routing under `src/app/`)
- **Supabase** — Postgres, Auth, and Edge Functions (`supabase/`)
- **RevenueCat** — subscription entitlements ("VerveIn Plus")
- **Reanimated**, `react-native-gesture-handler`, `@gorhom/bottom-sheet`,
  `react-native-svg`
- **Jest** for unit tests, ESLint (`eslint-config-expo`) for linting

Expo has changed meaningfully across recent SDKs — see `AGENTS.md` for the
versioned-docs reminder before assuming an API from memory.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real values — see below
npx expo start --dev-client  # or: npm run ios
```

This app relies on native modules (HealthKit, Apple/Google Sign-In,
RevenueCat) that Expo Go cannot load — use a dev client
(`npx expo run:ios` once, then `npx expo start --dev-client` for
subsequent sessions), not `expo start` alone.

### Environment variables

Documented in full in `.env.example` (copy it to `.env.local`, which is
gitignored). Summary:

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase project connection. Public by design — protection is Row Level Security, not secrecy. Never put the `service_role` key here. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google Sign-In OAuth client IDs. |
| `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` | RevenueCat's public SDK key for the real App Store product. |
| `EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY_IOS` | RevenueCat Test Store key, used automatically in `__DEV__` builds so offerings resolve in the Simulator. |
| `EXPO_PUBLIC_E2E_SEED_ENABLED` | Leave unset locally — only CI's Maestro workflow sets this to seed a fake onboarded profile for E2E flows. |

### Scripts

```bash
npm run ios          # expo run:ios
npm run android       # expo run:android
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint (authoritative — matches CI)
npm test              # jest
npm run test:watch    # jest --watch
```

CI (`.github/workflows/ci.yml`) also runs `npx expo export --platform ios`
as a build-check — it catches bundler-level breakage (bad imports, a native
module that can't resolve) that typecheck/lint/tests don't.

## Project structure

```
src/
  app/            Expo Router screens (file-based routing)
    (tabs)/       Home, Train, Progress, Profile — the main tab bar
    onboarding/   Fixed-canvas (375×812) onboarding flow, step-2..7
    settings/     Settings sub-screens (history views, sheets, etc.)
    auth/         Email verification, account creation
  components/     Shared UI components, organized by the screen area
                  that owns them (home/, onboarding/, settings/, ui/)
  lib/            Business logic, storage wrappers, and the engine
    engine/       The ported adaptive-engine modules (see below)
    *.ts          Screen-adjacent logic: session-history, calibration,
                  purchases, profile sync, etc. — one file per concern
supabase/
  functions/      Edge Functions (delete-account, redeem-referral)
  migrations/     SQL migrations, applied via `supabase db push`
```

## The adaptive engine

`src/lib/engine/` is a from-scratch React Native port of a separate
research project's adaptive-training engine (its own doc comments refer to
this as "the adaptive-engine research vault" — that vault is not part of
this repo; the ported modules are the source of truth here). Each file
carries an `M<number>` label matching that source project's own module
numbering, kept even though this app doesn't include every module —
useful when comparing logic against the original design docs.

`src/lib/plan-preview.ts` is the orchestrator. On every check-in it runs,
in order:

1. **Baseline plan** (`baseline-plan.ts`, M3) — map the user's onboarding
   profile into the engine's input shape and generate the standing plan.
2. **Constraint resolution** (`constraint-resolution.ts`, M5) — re-derive
   today's `EffectiveConstraintSet` from the check-in's energy score and
   any acute symptom tags, via **Most Restrictive Wins**: start from the
   loosest ceiling, only ever tighten it, never loosen.
3. **Exercise filtering** (`exercise-filtering.ts`, M6) — filter the
   baseline plan against today's constraints, gap-filling from the full
   library under the same rules.
4. **Fallback logic** (`fallback-logic.ts`, M7) — guarantees a session
   always exists: an empty filtered pool or Energy Score 1 always resolves
   to the same two always-available recovery exercises, never an invented
   minimum session. This is a hard invariant ("the user always gets a
   workout"), not a UX nicety.
5. **Volume scaling** (`volume-scaling.ts`, M8) — scale sets/duration per
   exercise by the real multiplier chain (energy × symptom-tag override ×
   personal calibration).
6. **Workout assembly** (`workout-assembly.ts`, M10) — assemble the final
   session and sum duration honestly, only over exercises that actually
   carry a real duration figure.
7. **Explanation string** (`explanation-string.ts`, M11) — build the
   on-screen "why this session" copy from real per-energy templates plus
   any firing symptom-tag lines, never a synthetic score or guilt framing.

Supporting modules, called elsewhere in the app rather than inline in this
pipeline:

- **Exercise library** (`exercise-library.ts`, M18) — the frozen,
  1,449-exercise Knowledge Graph (`engine/data/exercise-library.json`).
  Validates every entry's enum fields at load time and throws rather than
  silently accepting bad data (see `engine/__tests__/exercise-library.test.ts`
  for the standing data-integrity checks). `Object.freeze`s every record —
  no module may mutate a shared library entry mid-run.
- **Personal calibration** (`personal-calibration.ts`, M15) — the one
  learned, per-user state variable in the app, hard-clamped to `[0.5, 1.4]`.
- **Deload/pattern nudge** (`deload-nudge.ts`, M16) — a pure read-and-derive
  function; never writes state itself (see `lib/deload.ts` for the
  AsyncStorage-backed wrapper).
- **Training state compiler** (`engine/training-state.ts`, M20) — the
  longitudinal twin of M5: where M5 answers "what does *today* permit,"
  this answers "what does the *history* imply" (recency, consistency,
  trend), folding session history and decision traces into a single
  compiled state. Every derived field carries `{ value, basis, tier }` —
  a 2-day-old account never gets shown a confident trend claim off two data
  points. `src/lib/training-state-loader.ts` is the async I/O shell around
  it (reads the real logs, calls the pure compiler) — kept as a separate
  file from the pure `engine/training-state.ts` specifically so the fold
  logic itself stays synchronous and easy to unit test in isolation.
- **Policy orchestration** (`policy-orchestration.ts`, M9) — bookkeeps
  which governance policies (P1–P5) fired on a given run, so none can be
  silently marked "resolved" without a matching code change.

**A standing rule worth knowing before touching any of this:** an
unrecognized movement restriction or symptom tag is meant to throw, not be
silently ignored. Fail loud beats fail quiet here — see
`SYMPTOM_OVERRIDE_TABLE` in `engine/reference/symptom-override-table.ts`
(typed as `Record<SymptomTag, …>` specifically so the table itself must
cover every canonical tag at compile time).

## Backend

Supabase migrations live in `supabase/migrations/` and are applied with
`supabase db push` against the linked project (not run automatically by
this repo — that's a manual, deliberate step). Two Edge Functions
(`supabase/functions/delete-account`, `redeem-referral`) handle operations
that need the service role key and can't run client-side.

## Testing

```bash
npm test
```

Engine logic (`src/lib/engine/`) has the deepest coverage — each module's
own `__tests__` file exercises its real ported behavior, not a
reimplementation. Screen-adjacent storage logic (session history, weight
log, calibration, etc.) is tested against the real AsyncStorage jest mock,
not a hand-rolled fake, so a round-trip test is exercising the actual
serialization path the app uses.
