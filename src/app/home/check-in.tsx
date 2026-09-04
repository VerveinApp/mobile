import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import ReanimatedAnimated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { openBrowserAsync } from 'expo-web-browser';
import { postAccessibilityScreenChanged } from 'expo-accessibility-rescan';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { getCalibration, submitSessionFeedback } from '@/lib/calibration';
import { getLastCheckIn, recordCheckIn, type CheckInRecord } from '@/lib/check-in-history';
import { getDecisionTraceLog, recordDecisionTrace } from '@/lib/decision-trace-log';
import { TAG_LINES } from '@/lib/engine/explanation-string';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import type { Exercise, FeedbackResponse, UserCalibration } from '@/lib/engine/types';
import { getCueFor, type ExerciseCue } from '@/lib/exercise-form-cues';
import { formatTimerClock, getExerciseIntervals } from '@/lib/exercise-timer';
import { buildSwapReplacement, getSwapCandidates } from '@/lib/exercise-swap';
import { hapticImpactLight, hapticSelect, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { getCoachingInsightNote } from '@/lib/coaching-insights';
import { getPlanFitNote } from '@/lib/plan-fit';
import { recordCheckInAndShouldShowPaywall } from '@/lib/paywall-trigger';
import { getLoadImprovementNote, getPacingTrendNote, getPostSessionNote } from '@/lib/momentum';
import { getLastPerformance, recordPerformance, type ExercisePerformance } from '@/lib/exercise-performance';
import { calculatePlates, formatKg, formatPlateBreakdown } from '@/lib/plate-calculator';
import { recordSessionForMilestones } from '@/lib/session-milestones';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { estimateCaloriesBurned } from '@/lib/calorie-estimate';
import { getHealthReadinessModifier, getHealthReadinessReasons, saveCompletedWorkout } from '@/lib/health-kit';
import { usePremiumEntitlement } from '@/lib/purchases';
import { computePlanPreview, type PlanExercise } from '@/lib/plan-preview';
import { getTrainingState } from '@/lib/training-state';
import type { TrainingState } from '@/lib/engine/training-state';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { exerciseLibrary } from '@/lib/engine/exercise-library';
import {
  getSessionFeedback,
  getSessionHistory,
  getSessionNote,
  recordSessionCompletion,
  saveSessionFeedback,
  saveSessionNote,
} from '@/lib/session-history';
import { SYMPTOM_TAG_LABELS, SYMPTOM_TAGS } from '@/lib/symptom-tags';
import { TIME_AVAILABLE_LABELS, TIME_AVAILABLE_OPTIONS } from '@/lib/time-available';
import { getTodaySession, saveTodaySession } from '@/lib/today-session';
import { getProfile, type UserProfile } from '@/lib/user-profile';
import {
  getBodyAreaBreakdown,
  getCompletionStatus,
  saveWorkoutLog,
  type BodyAreaBreakdown,
  type WorkoutLogExercise,
} from '@/lib/workout-log';
import { localDateStr } from '@/lib/local-date';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { ENERGY_LABELS, EnergyGauge, type EnergyScore } from '@/components/home/energy-gauge';
import { SuccessCheckmark } from '@/components/onboarding/success-checkmark';
import { PremiumGate } from '@/components/premium-gate';
import { useAppTheme } from '@/lib/theme-context';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;
const CROSS_FADE_MS = 180;
// Matches resolvedExerciseCard/timerSection's own fixed width, so the
// progress bar reads as part of the same column instead of a mismatched
// element with its own sizing logic.
const PROGRESS_TRACK_WIDTH = 325;

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// The only calibration signal this app collects (M14-lite) — confirms what
// actually happened, since the multiplier itself only shows up in a future
// session's explanation line, never retroactively on this one.
const FEEDBACK_CONFIRM_TEXT: Record<FeedbackResponse, string> = {
  much_too_easy: "Noted — tomorrow's session nudges up.",
  too_easy: "Noted — tomorrow's session nudges up slightly.",
  just_right: 'Noted — keeping things as they are.',
  too_hard: "Noted — tomorrow's session eases back slightly.",
  much_too_hard: "Noted — tomorrow's session eases back.",
};

/**
 * Discrete exercises show "3 × 10". Isometric holds carry a real sets count
 * but no rep count (base_reps is null by design — a plank doesn't have
 * reps), so those fall back to "3 × 1 min" using the real duration instead
 * of fabricating a rep number. Loaded carries can lack a sets count
 * entirely, falling back further to just the duration. Never invents a
 * number plan-preview.ts didn't actually produce — and a duration of
 * exactly 0 is treated the same as no duration at all, since that's volume-
 * scaling.ts's own documented rounding gap (5-minute rounding breaking a
 * short hold down to nothing), a known-wrong value, not real information.
 */
function formatExerciseStat(exercise: { sets: number | null; reps: number | string | null; durationMin: number | null }): string {
  if (exercise.sets !== null && exercise.reps !== null) return `${exercise.sets} × ${exercise.reps}`;
  if (exercise.sets !== null && exercise.durationMin) return `${exercise.sets} × ${exercise.durationMin} min`;
  if (exercise.sets !== null) return `${exercise.sets} set${exercise.sets === 1 ? '' : 's'}`;
  if (exercise.durationMin) return `${exercise.durationMin} min`;
  return '—';
}

// Friendly framing for M6/Gate 1's exclusion categories — 'inactive' is
// deliberately omitted: it's a library-data-hygiene fact (an exercise
// flagged inactive in the source library), not anything about the user's
// own plan, so surfacing it here would be real but not honest-in-context —
// it'd read as personalized reasoning when it isn't.
const EXCLUSION_REASON_LABELS: Partial<Record<string, string>> = {
  contraindication: 'excluded for a health condition you flagged',
  intensity: "too intense for today's energy",
  impact: "higher-impact than today's plan calls for",
  equipment: "needs equipment you don't have set",
  'body-area': "outside today's focus areas",
  restriction: 'excluded by a movement restriction you set',
  'non-trainable': 'a fitness test, not a training exercise',
};

// A fallback session isn't just "your usual plan, trimmed" — it's a
// structurally different, engine-picked safety pair. Distinct copy so it
// never reads the same as an ordinary low-exercise-count day, and so a
// schedule-driven rest day (see isRestDay above, decided before energy is
// even picked) never gets confused with this engine-triggered one either.
const FALLBACK_TRIGGER_TEXT: Record<string, string> = {
  'energy-1': "Very low energy today — here's a light, safe reset instead of your usual plan.",
  'empty-filter': "Today's conditions ruled out your usual exercises — here's a safe fallback instead.",
  'p5-stacking-transition': "A transition case in how today's plan stacks up — here's a safe fallback for now.",
};

// Same labels as Progress's own BODY_AREA_LABELS (src/app/(tabs)/progress.tsx)
// — kept as a separate copy rather than a shared import since this is a
// route file, not a lib, and the two screens' label needs may diverge.
const BODY_AREA_LABELS: Record<keyof BodyAreaBreakdown, string> = {
  upper: 'Upper body',
  lower: 'Legs',
  core: 'Core',
  full: 'Full body',
};

/**
 * A real, one-line reason to check the Progress tab — sourced from the same
 * getBodyAreaBreakdown data that tab's radar chart already renders, not a
 * fabricated stat. Cumulative across every logged session (that function has
 * no date-range filter), so this reads "so far," never "this week" — no
 * false claim about a time window the underlying data doesn't carry. Returns
 * null (never a "not enough data yet" placeholder) when there's nothing real
 * to say: no completed exercises at all, or a tie at the top, since a tie
 * isn't a real "most trained" signal.
 */
async function getBodyAreaInsight(): Promise<string | null> {
  const breakdown = await getBodyAreaBreakdown();
  const entries = (Object.keys(breakdown) as (keyof BodyAreaBreakdown)[])
    .map((area) => ({ area, completed: breakdown[area].completed }))
    .filter((entry) => entry.completed > 0)
    .sort((a, b) => b.completed - a.completed);
  if (entries.length === 0) return null;
  if (entries.length > 1 && entries[1].completed === entries[0].completed) return null;
  return `${BODY_AREA_LABELS[entries[0].area]} has gotten the most work so far.`;
}

/** Groups today's real gate-1 exclusions by reason, resolving real exercise
 * names via the library — never a fabricated or generic count. */
function summarizeExclusions(
  gate1Exclusions: { exerciseId: string; excludedBy: string }[]
): { reason: string; names: string[] }[] {
  const byReason = new Map<string, string[]>();
  for (const { exerciseId, excludedBy } of gate1Exclusions) {
    const label = EXCLUSION_REASON_LABELS[excludedBy];
    if (!label) continue;
    const exercise = exerciseLibrary.getById(exerciseId);
    if (!exercise) continue;
    const names = byReason.get(label) ?? [];
    names.push(exercise.name);
    byReason.set(label, names);
  }
  return Array.from(byReason.entries()).map(([reason, names]) => ({ reason, names }));
}

/**
 * The workout session flow — launched from the Summary dashboard's "Start
 * Workout" (see (tabs)/index.tsx), not a landing screen itself. Three
 * states, not a single form: check in, see today's resolved session, finish
 * it. Reopening the app the same day after checking in lands directly on
 * the resolved or done state instead of re-asking, via today-session.ts.
 */
export default function EnergyCheckInScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;
  const { colors, resolvedScheme } = useAppTheme();
  const hoverWashColor = resolvedScheme === 'dark' ? '#ffffff' : '#000000';
  const styles = useMemo(() => createStyles(colors, hoverWashColor), [colors, hoverWashColor]);
  const isPremium = usePremiumEntitlement();

  const [energy, setEnergy] = useState<EnergyScore | null>(null);
  // A second, independent input alongside energy — someone can have high
  // energy and 15 minutes, or low energy and an hour. null means no
  // constraint picked (the plan runs at full energy-driven length), not "0
  // minutes" — see plan-preview.ts's own timeAvailableMin param comment.
  const [timeAvailableMin, setTimeAvailableMin] = useState<number | null>(null);
  // Wires up BASE_TEMPLATES[5]'s own rhetorical question (explanation-
  // string.ts's verbatim M11 copy) to a real mechanism — see plan-preview.ts's
  // finisherAccepted param comment. Only ever meaningful at energy 5;
  // handleEnergyChange resets it the moment energy changes away from 5, same
  // "prevent the malformed state instead of validating around it" discipline
  // as the symptom-tag reset just below it.
  const [finisherAccepted, setFinisherAccepted] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<CheckInRecord | null>(null);
  const [sessionState, setSessionState] = useState<'checkin' | 'resolved' | 'done'>('checkin');
  // A rest day is real (driven by the days the user actually picked during
  // onboarding, not a fake toggle) — but always overridable, since recovery
  // is a default, not a lockout.
  const [showAnyway, setShowAnyway] = useState(false);
  // Which exercises the user actually checked off — real, honest per-exercise
  // completion, not the all-or-nothing boolean session-history.ts records.
  // Local-only until Finish Session persists it via workout-log.ts; not
  // required to be all-checked to finish, since a real session getting cut
  // short partway through is still an honest outcome, not an error state.
  // Keyed by index into preview.exercises, not exercise.name — the library
  // has no uniqueness guarantee on names within one assembled session (a
  // duplicate/near-duplicate entry would otherwise mark both "done" off a
  // single timer and hand React a duplicate list key).
  const [completedExercises, setCompletedExercises] = useState<Set<number>>(new Set());
  // Accordion, not independent toggles — one open row max, so the list
  // never becomes a wall of text. null = nothing expanded.
  const [expandedExerciseIndex, setExpandedExerciseIndex] = useState<number | null>(null);
  // Gates handleSkipExercise behind a confirm step — skipping is
  // irreversible for this exercise (no undo once the index advances), so a
  // stray tap shouldn't silently lose it.
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  // The post-session reflection note — starts empty for a freshly finished
  // session, prefilled from storage below if reopening an already-done day.
  const [noteText, setNoteText] = useState('');
  const [calibration, setCalibration] = useState<UserCalibration | null>(null);
  const [trainingState, setTrainingState] = useState<TrainingState | null>(null);
  const [healthReadinessModifier, setHealthReadinessModifier] = useState(1);
  const [healthReadinessReasons, setHealthReadinessReasons] = useState<
    { rhrElevated: boolean; sleepDeficit: boolean } | undefined
  >(undefined);
  // The HealthKit-informed trim is a VerveIn Plus benefit — a free user's
  // plan sees 1 (no adjustment), the same neutral default
  // healthReadinessModifier itself starts at above before the real signal
  // loads, rather than a second code path that skips reading HealthKit
  // altogether. isPremium === null (still checking) falls back to 1 too —
  // an unverified session should never silently get the paid trim.
  const effectiveHealthReadinessModifier = isPremium ? healthReadinessModifier : 1;
  const effectiveHealthReadinessReasons = isPremium ? healthReadinessReasons : undefined;
  // The one post-session question (M14-lite) — null until the user taps one
  // of the three buttons, then locked to whatever they picked (real feedback
  // isn't editable after the fact any more than the session itself is).
  const [feedbackGiven, setFeedbackGiven] = useState<FeedbackResponse | null>(null);
  // True only the very first time this user ever submits feedback — the
  // pacing-trend note (momentum.ts) can't fire for weeks, so without this,
  // whoever churns in the first sessions never feels any proof that "pacing
  // is a skill" is real, not just onboarding copy. This is that proof,
  // moved as early as it can possibly land.
  const [isFirstFeedback, setIsFirstFeedback] = useState(false);
  // Symptom tags picked on the check-in screen (M2/M5's real acute-tag
  // input) — only editable here, in the 'checkin' branch; once "Start
  // session" is tapped it's fixed for the day, same as energy itself.
  const [symptomTags, setSymptomTags] = useState<Set<string>>(new Set());
  // The post-session counterpart to Home's weekly recap — same "only ever
  // earned, never a streak" rule.
  const [postSessionNote, setPostSessionNote] = useState<string | null>(null);
  const [estimatedCalories, setEstimatedCalories] = useState<number | null>(null);
  // Entirely optional, per exercise — most sessions will log none of these.
  // Keyed by exercise index (same indexing preview.exercises/
  // completedExercises already use), raw string from the input so an
  // in-progress "12" vs "120" keystroke never gets coerced mid-typing.
  const [loggedWeightsKg, setLoggedWeightsKg] = useState<Record<number, string>>({});
  const [loadImprovementNote, setLoadImprovementNote] = useState<string | null>(null);
  // Keyed by exercise NAME (matching exercise-performance.ts's own store),
  // not index — a swap mid-session shouldn't carry the old exercise's last
  // weight into the new exercise's slot. Purely informational: this is what
  // was actually logged last time, not a computed "recommended" number —
  // inventing a progression formula (add X% because reps were hit) is
  // exactly the kind of new engine number the vault's own governance would
  // need to define, not something to freelance in a UI label. Populated
  // below, once sessionExercises is known.
  const [lastPerformanceByName, setLastPerformanceByName] = useState<Record<string, ExercisePerformance | null>>({});
  // Shows the plate breakdown for whatever's currently typed (or last
  // time's weight, if nothing's typed yet) — collapsed by default so this
  // stays out of the way for the majority of exercises/people who never
  // touch it. Keyed by exercise index, same as loggedWeightsKg, since it's
  // about "is this particular row's breakdown open," not persisted state.
  const [plateBreakdownOpenIndex, setPlateBreakdownOpenIndex] = useState<number | null>(null);
  // Mid-workout exercise swap (Vervein addition — see exercise-swap.ts's own
  // doc comment for scope). Keyed by index into preview.exercises, same
  // indexing as completedExercises/loggedWeightsKg — a same-session-only
  // substitution, never persisted, so a fresh open of this screen (or any
  // change to today's real inputs, which recomputes `preview` from scratch)
  // naturally starts clean again rather than needing an explicit reset.
  const [swappedExercises, setSwappedExercises] = useState<Record<number, PlanExercise>>({});
  // Which exercise index the swap picker is open for — null means closed.
  // Doubles as the sheet's visibility flag instead of a second boolean, since
  // the two states can never disagree (there's never a picker open for "no
  // particular exercise").
  const [swapModalIndex, setSwapModalIndex] = useState<number | null>(null);
  // Occasional, additive recognition when "how did that feel?" feedback has
  // genuinely trended toward "just right" — see momentum.ts's
  // getPacingTrendNote for why this is separate from postSessionNote rather
  // than competing with it (a low-energy day and an improving pacing trend
  // aren't mutually exclusive, so both should be able to show).
  const [pacingTrendNote, setPacingTrendNote] = useState<string | null>(null);
  // A rarer, retrospective cousin of pacingTrendNote — see
  // coaching-insights.ts's own doc comment. Ephemeral by design like
  // milestoneReached below: its own 14-day cooldown is what actually governs
  // repeat visibility, not this component's lifecycle, so not restoring it
  // on a same-day reopen is a feature of that design, not a gap.
  const [coachingInsightNote, setCoachingInsightNote] = useState<string | null>(null);
  // Same ephemeral-by-cooldown pattern as coachingInsightNote above — see
  // plan-fit.ts's own doc comment for what this actually detects (a specific
  // exercise recurrently excluded from recent sessions).
  const [planFitNote, setPlanFitNote] = useState<string | null>(null);
  const [doneInsight, setDoneInsight] = useState<string | null>(null);
  // Ephemeral by design, never restored on reopen (see
  // recordSessionForMilestones' own doc comment) — only ever set the one
  // time handleFinishSession itself just reached a new milestone.
  const [milestoneReached, setMilestoneReached] = useState<number | null>(null);
  // Re-entrancy guard for handleFinishSession — that handler spans several
  // awaited AsyncStorage writes before setSessionState('done') unmounts the
  // button, and currentExerciseTimerDone (the button's only other disabled
  // condition) doesn't change as a side effect of calling it. Without this,
  // a fast double-tap fires the whole async body twice — most visibly,
  // double-incrementing session-milestones.ts's lifetime counter, which has
  // no idempotency of its own against being called twice for one real
  // session. The ref is the actual synchronous gate (immune to two calls
  // landing in the same tick, before a state update would've committed);
  // the state twin only drives the button's visual disabled/dimmed style.
  // No need to ever reset either back to false: sessionState moves to
  // 'done' at the end and this component branch unmounts.
  const isFinishingSessionRef = useRef(false);
  const [isFinishingSession, setIsFinishingSession] = useState(false);
  // Same synchronous-ref + state-twin pattern as isFinishingSessionRef above,
  // for the same reason: recordCheckInAndShouldShowPaywall() unconditionally
  // increments a persistent counter on every call with no idempotency check,
  // so a double-tap landing before the first call's awaits resolve would
  // count one real session start as two toward the 3-check-in paywall
  // trigger — silently pulling the paywall a session earlier than intended.
  const isStartingSessionRef = useRef(false);
  // Real wall-clock start time for the HealthKit workout write at Finish —
  // see saveCompletedWorkout's own doc comment. Not persisted (same
  // simplification as currentExerciseIndex above not surviving an app
  // kill) — a resumed 'resolved' session just won't get a HealthKit entry,
  // which is an acceptable gap for a nice-to-have sync.
  const sessionStartedAtRef = useRef<Date | null>(null);
  // Guided per-exercise timer — exercises are worked one at a time, in
  // order; the next one only unlocks once the current one's timer reaches
  // 0 (the countdown itself lives in the ExerciseTimer subcomponent below,
  // keyed by this index so switching exercises remounts it with a fresh
  // timer rather than needing an effect to reset one). Doesn't persist
  // across an app kill mid-session (today-session.ts only remembers energy/
  // symptoms/completion, not workout progress) — reopening mid-'resolved'
  // restarts at exercise 0. A real, deliberate simplification, not an
  // oversight.
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [showReasoning, setShowReasoning] = useState(false);

  const toggleSymptomTag = (tag: string) => {
    hapticSelect();
    setSymptomTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  // Two-step disclosure, per the real engine's M4 contract: the symptom-tag
  // picker is only ever shown at energy 1-2, and a tag arriving alongside
  // energy >= 3 is treated as a malformed payload the engine would reject.
  // Clearing here (event-driven, on the actual energy change) rather than
  // just hiding the picker means that malformed state can never actually be
  // constructed in the first place — prevention instead of validation after
  // the fact.
  const handleEnergyChange = (value: EnergyScore) => {
    setEnergy(value);
    if (value > 2 && symptomTags.size > 0) setSymptomTags(new Set());
    // Same prevention-not-validation discipline as the symptom-tag reset
    // above — the finisher only means something at energy 5.
    if (value !== 5 && finisherAccepted) setFinisherAccepted(false);
  };

  const handleFinisherToggle = () => {
    hapticSelect();
    setFinisherAccepted((prev) => !prev);
  };

  const handleTimeAvailableChange = (value: number) => {
    hapticSelect();
    setTimeAvailableMin((prev) => (prev === value ? null : value));
  };

  useEffect(() => {
    (async () => {
      const [
        loadedProfile,
        loadedLastCheckIn,
        loadedTodaySession,
        loadedCalibration,
        loadedTrainingState,
        loadedReadinessModifier,
        loadedReadinessReasons,
      ] = await Promise.all([
        getProfile(),
        getLastCheckIn(),
        getTodaySession(),
        getCalibration(),
        getTrainingState(),
        getHealthReadinessModifier(),
        getHealthReadinessReasons(),
      ]);
      setProfile(loadedProfile);
      setLastCheckIn(loadedLastCheckIn);
      setCalibration(loadedCalibration);
      setTrainingState(loadedTrainingState);
      setHealthReadinessModifier(loadedReadinessModifier);
      setHealthReadinessReasons(loadedReadinessReasons);
      if (loadedTodaySession) {
        setEnergy(loadedTodaySession.energy);
        setTimeAvailableMin(loadedTodaySession.timeAvailableMin ?? null);
        // Same guard as handleEnergyChange's own reset — a stored `true`
        // alongside a non-5 energy (e.g. from before this reset existed)
        // should never load straight into computePlanPreview as accepted.
        setFinisherAccepted(loadedTodaySession.energy === 5 && (loadedTodaySession.finisherAccepted ?? false));
        setSessionState(loadedTodaySession.completed ? 'done' : 'resolved');
        // Restored regardless of completed/resolved — this feeds preview's
        // computation either way, not just the done-screen display fields.
        // Re-applies the same M4 two-step-disclosure rule handleEnergyChange
        // enforces live: a stored row from before that logic existed (or any
        // other path producing energy > 2 with real tags) should never load
        // straight into computePlanPreview as the "malformed payload" the
        // engine contract says can't exist — enforced here too, not just on
        // the live gauge-drag path.
        setSymptomTags(loadedTodaySession.energy <= 2 ? new Set(loadedTodaySession.symptomTags) : new Set());
        if (loadedTodaySession.completed) {
          const [existingNote, existingFeedback, insight] = await Promise.all([
            getSessionNote(localDateStr()),
            getSessionFeedback(localDateStr()),
            getBodyAreaInsight(),
          ]);
          if (existingNote) setNoteText(existingNote);
          if (existingFeedback) setFeedbackGiven(existingFeedback);
          setPostSessionNote(getPostSessionNote(loadedTodaySession.energy));
          // Two independent AsyncStorage reads (session-history.ts and
          // decision-trace-log.ts are separate keys, neither depends on the
          // other), then two independent note computations over them — was
          // four sequential round-trips stacked one after another, now two
          // parallel batches.
          const [history, traceLog] = await Promise.all([getSessionHistory(), getDecisionTraceLog()]);
          setPacingTrendNote(getPacingTrendNote(history));
          const [insightNote, fitNote] = await Promise.all([
            getCoachingInsightNote(history),
            getPlanFitNote(traceLog),
          ]);
          setCoachingInsightNote(insightNote);
          setPlanFitNote(fitNote);
          setDoneInsight(insight);
        }
      }
    })();
  }, []);

  const handleNoteChange = (text: string) => {
    setNoteText(text);
    saveSessionNote(localDateStr(), text);
  };

  const handleSubmitFeedback = async (response: FeedbackResponse) => {
    hapticSelect();
    const priorHistory = await getSessionHistory();
    setIsFirstFeedback(!priorHistory.some((e) => e.feedback !== undefined));
    setFeedbackGiven(response);
    saveSessionFeedback(localDateStr(), response);
    const updated = await submitSessionFeedback(response);
    setCalibration(updated);
  };

  // The only way off the "done" screen besides an edge-swipe gesture, which
  // has no visible affordance and is easy to miss right after a session
  // just ended — a real user got stuck here with no visible way out.
  // canGoBack() covers the rare case this screen was reached with nothing
  // pushed before it (e.g. a cold deep link), same guard as onboarding-nav's
  // goBack().
  const handleBackToHome = () => {
    hapticImpactLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as never);
    }
  };

  const today = WEEKDAY_NAMES[new Date().getDay()];
  const trainingDays = profile?.days ? profile.days.split(',') : null;
  const isRestDay = trainingDays !== null && !trainingDays.includes(today);
  // Rest-day framing only applies before a session's been resolved — it's
  // not retroactively overridden by a session already checked into today.
  const showRestDay = sessionState === 'checkin' && isRestDay && !showAnyway;

  const entering = useFadeInEntering();
  const reducedMotion = useReducedMotion();
  // Fourth attempt at the post-mount-reveal accessibility gap documented
  // below (showRestDay's own comment) — the first three (key-forced
  // remount, setAccessibilityFocus, sendAccessibilityEvent) all posted the
  // right native notification but had no durable effect, pointing at
  // Reanimated's FadeIn/FadeOut itself interfering with how iOS's
  // accessibility tree treats the wrapped hierarchy. This hypothesis was
  // tested directly this session by forcing screenReaderEnabled true and
  // removing the FadeIn/FadeOut wrapper below (see the rest-day
  // ReanimatedAnimated.View) — CONFIRMED INEFFECTIVE: Maestro's own
  // accessibility-tree query still can't find "Check in anyway" even with
  // the wrapper gone, an identical symptom to the original bug (visibly
  // rendered, absent from the queryable tree), reproduced live against a
  // real seeded rest-day state. So Reanimated's FadeIn/FadeOut is NOT the
  // actual cause, at least not on its own — the real mechanism is still
  // unknown. Kept anyway, gating on screenReaderEnabled: independent of
  // whether it closes this bug, skipping entrance/exit animation for actual
  // screen-reader users is a legitimate improvement on its own (animated
  // transitions can be disorienting when navigating by VoiceOver swipe),
  // and it has zero effect on sighted users. The underlying "Check in
  // anyway" tree-registration gap remains genuinely open.
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReaderEnabled);
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReaderEnabled);
    return () => subscription.remove();
  }, []);
  const ctaHover = useHoverFade();
  const ctaPress = useLiquidPress();
  const finishHover = useHoverFade();
  const finishPress = useLiquidPress();
  // Fluidity pass: every remaining real Pressable on this screen gets the
  // same hover/press feedback the CTA and Finish buttons already had —
  // declared individually (not via .map()) since these are fixed, one-off
  // buttons, not a dynamic list — same rules-of-hooks reasoning as
  // log-past-session-sheet.tsx's per-body-area hooks.
  const skipExerciseHover = useHoverFade();
  const skipExercisePress = useLiquidPress();
  const skipCancelHover = useHoverFade();
  const skipCancelPress = useLiquidPress();
  const skipConfirmHover = useHoverFade();
  const skipConfirmPress = useLiquidPress();
  const feedbackMuchTooEasyHover = useHoverFade();
  const feedbackMuchTooEasyPress = useLiquidPress();
  const feedbackTooEasyHover = useHoverFade();
  const feedbackTooEasyPress = useLiquidPress();
  const feedbackJustRightHover = useHoverFade();
  const feedbackJustRightPress = useLiquidPress();
  const feedbackTooHardHover = useHoverFade();
  const feedbackTooHardPress = useLiquidPress();
  const feedbackMuchTooHardHover = useHoverFade();
  const feedbackMuchTooHardPress = useLiquidPress();
  const backToHomeHover = useHoverFade();
  const backToHomePress = useLiquidPress();

  // A single, one-time pulse on the rest-day override link — not a loop —
  // so it announces itself as tappable once the screen has settled, without
  // permanently competing for attention against the headline.
  const restLinkPulse = useSharedValue(1);
  useEffect(() => {
    if (!showRestDay || reducedMotion) return;
    restLinkPulse.value = withDelay(
      700,
      withSequence(
        withTiming(0.4, { duration: 500, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.quad) })
      )
    );
  }, [reducedMotion, restLinkPulse, showRestDay]);
  const restLinkAnimatedStyle = useAnimatedStyle(() => ({ opacity: restLinkPulse.value }));

  // showRestDay flips true only after the async profile load resolves —
  // never on the very first render — and content that arrives that way
  // doesn't get picked up by iOS's accessibility tree on its own (same real,
  // narrow platform gap as handleOpenSwap's announcement below).
  //
  // Six different mechanisms have been tried and confirmed ineffective
  // against a clean app install / a real seeded rest-day state: (1) a
  // key-forced remount of the rest-day subtree; (2)
  // AccessibilityInfo.setAccessibilityFocus + findNodeHandle; (3) the
  // Fabric-correct sendAccessibilityEvent(ref.current, 'focus'), deferred two
  // animation frames past mount; (4) removing the Reanimated FadeIn/FadeOut
  // wrapper entirely (screenReaderEnabled, declared above — kept regardless,
  // see its own comment, since it's a real improvement independent of this
  // bug); (5) postAccessibilityScreenChanged (modules/expo-accessibility-
  // rescan, called from the effect below) — attempts 1–3 all route through
  // UIAccessibilityLayoutChangedNotification under the hood (confirmed by
  // reading RCTMountingManager.mm), which Apple documents as being for
  // content that MOVED or CHANGED on an already-known screen, not a node
  // newly ENTERING the tree; attempt 5 posts
  // UIAccessibilityScreenChangedNotification instead, Apple's own
  // notification for "re-derive this screen's hierarchy from scratch," and
  // is deferred two animation frames past the state flip on the theory that
  // Fabric's JS-side commit and the native mounting manager's actual
  // application of the new prop values are two distinct phases — kept since
  // it's a real, if partial, improvement (verified: the native call
  // executes, no thrown error) and independently justified by Apple's own
  // documented notification semantics, but confirmed via live Maestro
  // testing NOT to close the gap, with or without the defer; (6) the
  // structural fix that seemed most likely to actually work — mounting the
  // title/subtitle/link unconditionally from the very first render (hidden
  // via opacity/pointerEvents/importantForAccessibility) instead of only
  // inserting them into the tree once showRestDay flips true, so the state
  // flip only ever changes PROPS on an already-mounted node rather than
  // inserting a new one late. Tested live, combined with attempt 5's
  // notification (both fire on the same transition): identical symptom,
  // "Check in anyway" still not found. This was reverted rather than kept —
  // unlike attempt 4's screen-reader gating, it has no independent benefit
  // to justify the added structural complexity once it's confirmed not to
  // close the gap. Its full code is preserved in this issue's own comment
  // history if a future attempt wants to build on it. That every one of
  // late-insertion, notification-choice, and mount-timing theories has now
  // been tried and ruled out suggests the real mechanism is something else
  // entirely — plausibly related to this screen's fixed-canvas
  // `transform: [{ scale }]` wrapper (see the render below), untested by any
  // attempt so far, though other elements on the same transformed canvas
  // (onboarding's own identical convention) are reachable by Maestro fine,
  // so it isn't simply "anything under this transform is unreachable" either.
  // Genuinely needs Xcode's Accessibility Inspector attached to a real
  // device to make further progress from here, not more guesses from the JS
  // side.
  const wasRestDayRef = useRef(showRestDay);
  useEffect(() => {
    if (showRestDay && !wasRestDayRef.current) {
      AccessibilityInfo.announceForAccessibility(
        'Rest day. No session scheduled today — recovery is part of the plan.'
      );
      // Deferred two animation frames past the state flip — same technique
      // ATTEMPT 3 used for the identical reason: Fabric's JS-side commit and
      // the native mounting manager's actual insertion of the new rest-day
      // subtree are two distinct phases connected by an async queue, so
      // posting the rescan notification in the same tick as the state
      // change risks racing ahead of the native insertion it's supposed to
      // be telling VoiceOver to notice. (Tested both ways — undeferred and
      // deferred — neither closed the gap; see the comment above showRestDay.)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          postAccessibilityScreenChanged();
        });
      });
    }
    wasRestDayRef.current = showRestDay;
  }, [showRestDay]);

  // Guards against comparing today against itself: recordCheckIn overwrites
  // the single stored "last check-in" record the moment today's check-in is
  // submitted, so any path that re-reads it later the same day would
  // otherwise see today's own value as "last time." Shared by both
  // comparisonText below and the gauge's ghost marker. Computed here (not
  // just where it's used) so it's available before `preview`'s useMemo too.
  const realLastCheckIn = lastCheckIn && lastCheckIn.date !== localDateStr() ? lastCheckIn : null;
  // Feeds plan-preview.ts's daysSinceLastCheckIn param (Vervein addition —
  // see that param's own doc comment for why this only ever changes the
  // explanation's wording, never the plan itself). UTC midnight parsing,
  // same pattern engine/training-state.ts's own date math already uses, so
  // this can't drift by a day around a DST boundary the way plain `new
  // Date(dateStr)` local-time parsing sometimes does.
  const daysSinceLastCheckIn = realLastCheckIn
    ? Math.round(
        (Date.parse(`${localDateStr()}T00:00:00Z`) - Date.parse(`${realLastCheckIn.date}T00:00:00Z`)) / 86400000
      )
    : undefined;
  // Stricter than realLastCheckIn: computePlanPreview's yesterdayEnergy
  // param makes a specific factual claim ("yesterday") the engine's
  // explanation states as fact, not comparisonText's looser "last time"
  // framing — only pass it through when the record's date is literally
  // calendar-yesterday, never whenever the user last happened to check in.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDateStr(yesterday);
  const verifiedYesterdayEnergy =
    realLastCheckIn && realLastCheckIn.date === yesterdayStr ? realLastCheckIn.energy : undefined;
  // The forward half of the same thread plan-preview.ts's explanation
  // already closes backward (comparing today's picked energy against
  // yesterday's) — this greets the user with it BEFORE they've picked
  // anything today, using the same strict calendar-yesterday guard as that
  // sentence. Only shown pre-pick (energy === null); comparisonText below
  // takes over the moment a real value exists to compare against. Silent
  // (null) for a genuinely unremarkable yesterday (energy 3) or no verified
  // yesterday record at all — no filler sentence invented to fill the gap.
  const openingContinuityLine =
    energy === null && verifiedYesterdayEnergy !== undefined
      ? verifiedYesterdayEnergy <= 2
        ? 'Yesterday was a lighter day — see how today feels.'
        : verifiedYesterdayEnergy >= 4
          ? 'Yesterday you pushed harder — see how today compares.'
          : null
      : null;

  // Memoized — this now runs the real engine's filtering over the full
  // exercise library (see plan-preview.ts), not a cheap lookup. energy
  // changes on every drag step of the gauge below, so this matters more
  // here than anywhere else it's called.
  const preview = useMemo(
    () =>
      energy !== null
        ? computePlanPreview(
            profile ?? {},
            energy,
            calibration ?? { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION },
            Array.from(symptomTags),
            trainingState ?? undefined,
            effectiveHealthReadinessModifier,
            verifiedYesterdayEnergy,
            timeAvailableMin ?? undefined,
            daysSinceLastCheckIn,
            finisherAccepted,
            effectiveHealthReadinessReasons
          )
        : null,
    [
      profile,
      energy,
      calibration,
      symptomTags,
      trainingState,
      effectiveHealthReadinessModifier,
      verifiedYesterdayEnergy,
      timeAvailableMin,
      daysSinceLastCheckIn,
      finisherAccepted,
      effectiveHealthReadinessReasons,
    ]
  );
  // The baseline ("Good") session — comparing against it is what makes the
  // adaptation legible on the resolved view, not just implied by a sentence.
  // Symptom tags AND healthReadinessModifier are held constant against
  // `preview` (only energy differs) so the delta below isolates the energy
  // effect, not a symptom or health-signal effect too.
  const baseline = useMemo(
    () =>
      computePlanPreview(
        profile ?? {},
        4,
        calibration ?? { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION },
        Array.from(symptomTags),
        undefined,
        effectiveHealthReadinessModifier,
        undefined,
        undefined,
        undefined,
        undefined,
        effectiveHealthReadinessReasons
      ),
    [profile, calibration, symptomTags, effectiveHealthReadinessModifier, effectiveHealthReadinessReasons]
  );
  const exerciseDelta = preview ? baseline.exerciseCount - preview.exerciseCount : 0;
  // BUG FIX: exerciseDelta alone can't tell "genuinely standard" apart from
  // "same exercise count, but every set just got scaled down" — Energy 2's
  // real setsMultiplier is 0.6 (see ENERGY_MODIFIER_TABLE), which reduces
  // every exercise's sets without necessarily dropping the exercise count
  // itself. Without checking overallSetsPct too, a real 40% volume cut
  // could read as "Standard session today" — wrong on exactly the day the
  // label matters most for trust.
  const deltaText =
    preview && energy !== null
      ? preview.trace.fallbackFired && preview.trace.fallbackTrigger
        ? FALLBACK_TRIGGER_TEXT[preview.trace.fallbackTrigger]
        : exerciseDelta > 0
          ? `${exerciseDelta} exercise${exerciseDelta === 1 ? '' : 's'} trimmed — ${ENERGY_LABELS[energy].toLowerCase()} energy today.`
          : exerciseDelta < 0
            ? `${-exerciseDelta} extra exercise${-exerciseDelta === 1 ? '' : 's'} — pushing further today.`
            : preview.overallSetsPct < 100
              ? `Sets trimmed to ${preview.overallSetsPct}% — ${ENERGY_LABELS[energy].toLowerCase()} energy today.`
              : 'Standard session today.'
      : null;
  const exclusionSummary = useMemo(
    () => (preview ? summarizeExclusions(preview.trace.gate1Exclusions) : []),
    [preview]
  );
  // The full explanation (preview.explanation) already includes these same
  // TAG_LINES sentences, but only the pre-commit checkin screen renders that
  // full string — the resolved view's subtitle is the shorter deltaText.
  // Surfacing the real per-tag lines here too means "why does today look
  // like this" stays reviewable in one consistent place (this panel)
  // instead of only appearing transiently before the session starts.
  const symptomLines = useMemo(
    () => Array.from(symptomTags).map((tag) => TAG_LINES[tag]).filter((line): line is string => Boolean(line)),
    [symptomTags]
  );
  const comparisonText =
    energy !== null && realLastCheckIn
      ? energy === realLastCheckIn.energy
        ? 'Same as last time.'
        : energy > realLastCheckIn.energy
          ? 'Better than last time.'
          : 'Lower than last time.'
      : null;

  // Today's real plan with any mid-workout swaps laid over it by index —
  // every other read of "today's exercises" below uses this, not
  // preview.exercises directly, so a swap stays consistent everywhere it's
  // reflected (the live timer, the list below it, the workout log, the
  // calorie estimate) instead of some readers seeing the original and others
  // seeing the replacement.
  const sessionExercises = useMemo(
    () => (preview ? preview.exercises.map((ex, i) => swappedExercises[i] ?? ex) : []),
    [preview, swappedExercises]
  );
  const currentExercise = sessionExercises[currentExerciseIndex] ?? null;
  // Batch-fetched once per session-exercises set (a handful of cheap
  // AsyncStorage reads, not worth deferring per-exercise) — see
  // lastPerformanceByName's own declaration above for why this is
  // informational only, never a computed suggestion.
  useEffect(() => {
    if (sessionExercises.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        sessionExercises.map(async (ex) => [ex.name, await getLastPerformance(ex.name)] as const)
      );
      setLastPerformanceByName(Object.fromEntries(entries));
    })();
  }, [sessionExercises]);
  const isLastExercise = preview ? currentExerciseIndex >= preview.exercises.length - 1 : false;
  // Derived, not separately tracked — completedExercises is already the
  // real source of truth for "is this one done," so there's no second copy
  // of that fact to keep in sync (and no reset-on-exercise-change effect
  // needed for it either).
  const currentExerciseTimerDone = completedExercises.has(currentExerciseIndex);
  // "How much is left" — the one thing the resolved view didn't answer
  // before, which matters most exactly when energy is low and someone's
  // deciding whether to keep going. Clamped defensively even though
  // currentExerciseIndex should never exceed exercises.length in practice.
  const exerciseTotal = preview?.exercises.length ?? 0;
  const exerciseProgressPct = exerciseTotal > 0 ? Math.min(1, (currentExerciseIndex + 1) / exerciseTotal) : 0;
  // Animated in pixels, not as a '%' string — Reanimated's UI-thread
  // interpolation needs a numeric style value to tween smoothly.
  const exerciseProgressWidth = useSharedValue(0);
  useEffect(() => {
    exerciseProgressWidth.value = withTiming(exerciseProgressPct * PROGRESS_TRACK_WIDTH, { duration: 320 });
  }, [exerciseProgressPct, exerciseProgressWidth]);
  const exerciseProgressFillStyle = useAnimatedStyle(() => ({ width: exerciseProgressWidth.value }));

  // Shared by the incremental save below and handleFinishSession — one
  // definition of "what does today's workout-log entry look like right
  // now" from whichever completed-set is current, so the two call sites
  // can't drift into different shapes for the same data.
  const buildWorkoutLogExercises = (completed: Set<number>): WorkoutLogExercise[] =>
    sessionExercises.map((exercise, index) => ({
      name: exercise.name,
      bodyArea: exercise.bodyArea,
      completed: completed.has(index),
    }));

  // Called by ExerciseTimer's own effect when its countdown reaches 0 — a
  // plain callback, not itself inside an effect here, so setState here is
  // exactly the ordinary "handle a child's event" case, not the "derive
  // state from a dependency" one the set-state-in-effect rule is about.
  // Also where the completion signal actually gets its real granularity:
  // saved incrementally as each exercise finishes, not only once at the
  // very end — a session abandoned before "Finish session" still leaves a
  // real partial record instead of no record at all (see
  // getCompletionStatus in workout-log.ts).
  const handleExerciseTimerComplete = (index: number) => {
    hapticSuccess();
    const updated = new Set(completedExercises).add(index);
    setCompletedExercises(updated);
    saveWorkoutLog(localDateStr(), buildWorkoutLogExercises(updated));
  };

  const handleNextExercise = (force = false) => {
    if (!force && !currentExerciseTimerDone) return; // still gated — button should already be disabled, this is the safety check
    hapticImpactLight();
    setCurrentExerciseIndex((i) => i + 1);
  };

  // The one way to move past an exercise without running its timer at
  // all — deliberately never touches completedExercises, so a skipped
  // exercise stays honestly `completed: false` in the workout log (see
  // buildWorkoutLogExercises) instead of silently counting as done in the
  // completion signal getCompletionStatus computes. force=true bypasses
  // handleNextExercise/handleFinishSession's normal "timer must finish"
  // gate — that's the whole point of a skip. Only ever called after the
  // confirm modal below — the button itself opens that instead of calling
  // this directly.
  const handleSkipExercise = () => {
    hapticSelect();
    setShowSkipConfirm(false);
    if (isLastExercise) {
      handleFinishSession(true);
    } else {
      handleNextExercise(true);
    }
  };

  const handleSkipPress = () => {
    hapticSelect();
    setShowSkipConfirm(true);
  };

  const handleCancelSkip = () => {
    hapticImpactLight();
    setShowSkipConfirm(false);
  };

  // Candidates for whichever index the swap sheet is currently open for —
  // computed lazily (only while the sheet is actually up), not on every
  // render just to decide whether a "Swap" affordance should be visible;
  // the affordance itself is always shown while an exercise is unresolved,
  // and an empty result here just means the sheet's own empty state renders
  // instead of a picker list.
  const swapModalCandidates = useMemo(() => {
    if (swapModalIndex === null || !preview) return [];
    const target = sessionExercises[swapModalIndex];
    if (!target) return [];
    return getSwapCandidates(
      target,
      preview.constraints,
      sessionExercises.map((e) => e.id)
    );
  }, [swapModalIndex, preview, sessionExercises]);

  const handleOpenSwap = (index: number) => {
    hapticSelect();
    setSwapModalIndex(index);
    // The swap sheet's content is gated behind this state flip, which fires
    // well after this screen's initial mount — iOS's accessibility tree
    // doesn't pick up content added that way on its own (same real, narrow
    // platform gap as showRestDay's announcement above — setAccessibilityFocus
    // and a key-forced remount were both tried there and ruled out against a
    // clean app install, so this announcement is left as the one real, if
    // partial, improvement rather than repeating disproven attempts here).
    //
    // This Modal uses React Native's own animationType, not Reanimated.
    // showRestDay's parallel attempt at removing its Reanimated
    // FadeIn/FadeOut wrapper for screen-reader users was tested live this
    // session and confirmed NOT to fix that gap — Reanimated's animation
    // wrapper isn't actually the cause there, which weakens (without fully
    // ruling out, since this is a genuinely different mechanism) the same
    // theory applied here: the Modal's own JSX below still switches to
    // animationType="none" for screen-reader users on the chance iOS's
    // native modal-presentation animation is its own, separate
    // interference, but treat this as unverified, not a known fix.
    //
    // ATTEMPT 5 (postAccessibilityScreenChanged): same fix as showRestDay's
    // own ATTEMPT 5 above, for the same reason — see that comment. Posted
    // before the announcement so the tree is rebuilt first.
    postAccessibilityScreenChanged();
    AccessibilityInfo.announceForAccessibility('Swap this exercise');
  };

  const handleCloseSwap = () => {
    hapticImpactLight();
    setSwapModalIndex(null);
  };

  // Ratio-scales the chosen candidate against the ORIGINAL engine-delivered
  // exercise at this index (preview.exercises, never a prior swap already
  // sitting in swappedExercises) — see buildSwapReplacement's own doc
  // comment for why: re-deriving from the real adapted/base ratio every time
  // avoids compounding rounding error across more than one swap at the same
  // index.
  const handleSelectSwap = (candidate: Exercise) => {
    if (swapModalIndex === null || !preview) return;
    hapticSelect();
    const original = preview.exercises[swapModalIndex];
    const originalFull = exerciseLibrary.getById(original.id) ?? null;
    const replacement = buildSwapReplacement(candidate, original, originalFull);
    setSwappedExercises((prev) => ({ ...prev, [swapModalIndex]: replacement }));
    setSwapModalIndex(null);
  };

  const handleStartSession = async () => {
    if (energy === null || isStartingSessionRef.current) return;
    isStartingSessionRef.current = true;
    sessionStartedAtRef.current = new Date();
    setCurrentExerciseIndex(0);
    if (energy === 1) hapticWarning();
    else if (energy === 5) hapticSuccess();
    else hapticImpactLight();
    recordCheckIn(energy);
    saveTodaySession(energy, false, Array.from(symptomTags), timeAvailableMin ?? undefined, finisherAccepted);
    // The honest starting point for today's completion signal — a real
    // 'skipped' entry the moment the session begins (zero exercises done
    // yet), overwritten with the real status as exercises complete and
    // again at Finish. Without this, a session someone starts and then
    // abandons before finishing a single exercise would leave no entry at
    // all — indistinguishable from a day they never opened the app.
    // Awaited (not fire-and-forget) so this baseline entry is guaranteed
    // written before the UI moves on — otherwise backgrounding the app in
    // the instant right after tapping Start could lose it entirely.
    await saveWorkoutLog(localDateStr(), buildWorkoutLogExercises(new Set()));
    await recordSessionCompletion(false, energy, 'skipped');
    setSessionState('resolved');
    // Fires exactly once, at the real third check-in — see paywall-
    // trigger.ts's own doc comment for why this counts check-ins
    // specifically (not completions, not session-history.ts's log, which
    // also includes retroactively-logged past sessions). Pushed after
    // setSessionState so dismissing it lands right back on the resolved
    // session, ready to start — never blocking the workout itself.
    if (await recordCheckInAndShouldShowPaywall()) router.push('/paywall' as never);
  };

  const handleFinishSession = async (force = false) => {
    if (energy === null || !preview) return;
    if (!force && !currentExerciseTimerDone) return;
    if (isFinishingSessionRef.current) return;
    isFinishingSessionRef.current = true;
    setIsFinishingSession(true);
    hapticSuccess();
    // Re-passes the same tags/time/finisher choice picked at Start —
    // saveTodaySession replaces the whole record each call, so omitting any
    // of them would silently wipe them.
    saveTodaySession(energy, true, Array.from(symptomTags), timeAvailableMin ?? undefined, finisherAccepted);
    const finalExercises = buildWorkoutLogExercises(completedExercises);
    const status = getCompletionStatus(finalExercises);
    const completedSomething = status !== 'skipped';
    await recordSessionCompletion(completedSomething, energy, status);
    // Only a real session (done or partial) counts toward the lifetime
    // total — never a skipped one, so this can't be inflated by opening the
    // app or abandoning a session before doing anything.
    if (completedSomething) setMilestoneReached(await recordSessionForMilestones());
    // Same "real completion only" rule as the milestone above — a skipped
    // session never gets written to Apple Health. Fire-and-forget: this is
    // a nice-to-have sync (see saveCompletedWorkout's own doc comment), not
    // something worth making Finish wait on.
    if (completedSomething && sessionStartedAtRef.current) {
      // Only the exercises actually checked off, each with its own real
      // intensity/duration — see estimateCaloriesBurned's own doc comment
      // for why this isn't a single flat per-session number. Weight is the
      // only profile field this needs (not height/age — those feed a
      // different metric, daily BMR, not a single workout's active energy);
      // no honest estimate exists without it, so this stays undefined
      // rather than guessing a default bodyweight.
      const weightKg = Number(profile?.weightKg);
      const caloriesForSession =
        weightKg > 0
          ? estimateCaloriesBurned(
              sessionExercises
                .filter((_, index) => completedExercises.has(index))
                .map((ex) => ({ intensity: ex.intensity, durationMin: ex.durationMin })),
              weightKg
            )
          : null;
      setEstimatedCalories(caloriesForSession);
      saveCompletedWorkout(
        profile?.goal,
        sessionStartedAtRef.current,
        new Date(),
        caloriesForSession ?? undefined
      );
    }
    // Entirely separate from completedSomething above — a weight can be
    // logged against an exercise regardless of whether the session as a
    // whole reads as done/partial/skipped, since it's about that one
    // exercise, not the session. Only ever the exercises someone actually
    // typed a real, positive number for; everything else in
    // loggedWeightsKg (empty strings, exercises nobody touched) is
    // silently skipped, matching this being fully optional per exercise.
    const loggedEntries = Object.entries(loggedWeightsKg)
      .map(([indexStr, weightText]) => {
        const index = Number(indexStr);
        const exercise = sessionExercises[index];
        const weightKg = Number(weightText);
        const reps = exercise?.reps;
        if (!exercise || !(weightKg > 0) || typeof reps !== 'number') return null;
        return { exerciseName: exercise.name, weightKg, reps };
      })
      .filter((entry): entry is { exerciseName: string; weightKg: number; reps: number } => entry !== null);
    if (loggedEntries.length > 0) {
      const results = await Promise.all(
        loggedEntries.map(async ({ exerciseName, weightKg, reps }) => ({
          exerciseName,
          result: await recordPerformance(exerciseName, weightKg, reps),
        }))
      );
      setLoadImprovementNote(getLoadImprovementNote(results));
    }
    setPostSessionNote(getPostSessionNote(energy));
    // Same parallelization as the initial-load effect above — two
    // independent reads, then two independent note computations over them.
    const [historyForNotes, traceLogForNotes] = await Promise.all([getSessionHistory(), getDecisionTraceLog()]);
    setPacingTrendNote(getPacingTrendNote(historyForNotes));
    const [insightNote, fitNote] = await Promise.all([
      getCoachingInsightNote(historyForNotes),
      getPlanFitNote(traceLogForNotes),
    ]);
    setCoachingInsightNote(insightNote);
    setPlanFitNote(fitNote);
    // Awaited (unlike the old fire-and-forget) so today's exercises are
    // already in storage before getBodyAreaInsight reads the breakdown —
    // otherwise the done screen could render one save-cycle stale.
    await saveWorkoutLog(localDateStr(), finalExercises);
    recordDecisionTrace(localDateStr(), preview.trace);
    setDoneInsight(await getBodyAreaInsight());
    setSessionState('done');
  };

  // Flow-layout logo for the checkin/resolved/done ScrollViews — see
  // logoMarkFlow's style comment. marginBottom reproduces each branch's
  // original gap between the logo and its first line of content (was baked
  // into checkinFlow/resolvedFlow/doneWrap's paddingTop before those
  // branches scrolled).
  const renderLogoMark = (marginBottom: number) => (
    <View style={[styles.logoMarkFlow, { marginBottom }]} pointerEvents="none">
      <View style={styles.logoAccent}>
        {/* Width derived from the graphic's own viewBox ratio (28.6525:36.106)
            at this fixed height — the previous 57.78 stretched it off-ratio
            compared to every other rendering of this same mark in the app. */}
        <LogoMarkAccentGraphic width={52.93} height={66.7} color={colors.text} />
      </View>
      <View style={styles.logoCheck}>
        {/* Same fix, this graphic's own viewBox ratio is 21.8156:30.6813. */}
        <LogoMarkGraphic width={40.57} height={57.06} color={colors.text} />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        {showRestDay ? (
          <View style={styles.logoMark} pointerEvents="none">
            <View style={styles.logoAccent}>
              <LogoMarkAccentGraphic width={52.93} height={66.7} color={colors.text} />
            </View>
            <View style={styles.logoCheck}>
              <LogoMarkGraphic width={40.57} height={57.06} color={colors.text} />
            </View>
          </View>
        ) : null}

        {showRestDay ? (
          <ReanimatedAnimated.View
            key="rest-day"
            entering={screenReaderEnabled ? undefined : FadeIn.duration(CROSS_FADE_MS)}
            exiting={screenReaderEnabled ? undefined : FadeOut.duration(CROSS_FADE_MS)}
          >
            <Text style={styles.title} maxFontSizeMultiplier={1.3}>Rest day</Text>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
              No session scheduled today — recovery is part of the plan.
            </Text>

            <Pressable
              style={styles.restDayLinkHit}
              onPress={() => setShowAnyway(true)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Check in anyway"
            >
              <ReanimatedAnimated.Text
                style={[styles.restDayLinkText, restLinkAnimatedStyle]}
                maxFontSizeMultiplier={1.3}
              >
                Check in anyway
              </ReanimatedAnimated.Text>
            </Pressable>
          </ReanimatedAnimated.View>
        ) : sessionState === 'checkin' ? (
          <ReanimatedAnimated.ScrollView
            key="check-in"
            entering={FadeIn.duration(CROSS_FADE_MS)}
            exiting={FadeOut.duration(CROSS_FADE_MS)}
            style={styles.flowScroll}
            contentContainerStyle={styles.checkinFlow}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderLogoMark(24)}
            <Text style={styles.checkinTitle} maxFontSizeMultiplier={1.3}>
              {"How's your "}
              <Text style={styles.titleAccent}>energy</Text>
              {' today?'}
            </Text>
            <Text style={styles.checkinSubtitle} maxFontSizeMultiplier={1.4}>
              {openingContinuityLine ?? 'Your plan adapts to what you tell it.'}
            </Text>

            <View style={styles.checkinGaugeWrap}>
              <EnergyGauge
                size={260}
                canvasScale={scale}
                value={energy}
                onChange={handleEnergyChange}
                previousValue={realLastCheckIn?.energy ?? null}
              />
            </View>

            <View style={styles.timeAvailableSection}>
              <Text style={styles.noteLabel} maxFontSizeMultiplier={1.3}>
                HOW MUCH TIME DO YOU HAVE? (OPTIONAL)
              </Text>
              <View style={styles.symptomChipRow}>
                {TIME_AVAILABLE_OPTIONS.map((minutes) => {
                  const active = timeAvailableMin === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      style={[styles.timePill, active && styles.timePillActive]}
                      onPress={() => handleTimeAvailableChange(minutes)}
                      hitSlop={2}
                    >
                      <Text
                        style={[styles.timePillText, active && styles.timePillTextActive]}
                        maxFontSizeMultiplier={1.2}
                      >
                        {TIME_AVAILABLE_LABELS[minutes]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {preview ? (
              <ReanimatedAnimated.View key={energy} entering={FadeIn.duration(220)} style={styles.checkinExplanationBlock}>
                <Text style={styles.explanationText} maxFontSizeMultiplier={1.4}>
                  {preview.explanation}
                </Text>
                {comparisonText ? (
                  <Text style={styles.comparisonText} maxFontSizeMultiplier={1.4}>
                    {comparisonText}
                  </Text>
                ) : null}
              </ReanimatedAnimated.View>
            ) : null}

            {energy === 5 ? (
              <Pressable
                style={[styles.timePill, finisherAccepted && styles.timePillActive, styles.finisherPill]}
                onPress={handleFinisherToggle}
                hitSlop={4}
              >
                <Text
                  style={[styles.timePillText, finisherAccepted && styles.timePillTextActive]}
                  maxFontSizeMultiplier={1.2}
                >
                  {finisherAccepted ? 'Finisher added' : 'Add a finisher set'}
                </Text>
              </Pressable>
            ) : null}

            {energy !== null && energy <= 2 ? (
              <View style={styles.symptomSection}>
                <PremiumGate isPremium={isPremium} label="Symptom tracking">
                  <Text style={styles.noteLabel} maxFontSizeMultiplier={1.3}>
                    ANYTHING GOING ON TODAY? (OPTIONAL)
                  </Text>
                  <View style={styles.symptomChipRow}>
                    {SYMPTOM_TAGS.map((tag) => {
                      const active = symptomTags.has(tag);
                      return (
                        <Pressable
                          key={tag}
                          style={[styles.symptomChip, active && styles.symptomChipActive]}
                          onPress={() => toggleSymptomTag(tag)}
                          hitSlop={2}
                        >
                          <Text
                            style={[styles.symptomChipText, active && styles.symptomChipTextActive]}
                            maxFontSizeMultiplier={1.2}
                          >
                            {SYMPTOM_TAG_LABELS[tag]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </PremiumGate>
              </View>
            ) : null}

            <Pressable
              style={styles.checkinPrimaryButtonHit}
              onPress={handleStartSession}
              disabled={energy === null}
              onHoverIn={ctaHover.onHoverIn}
              onHoverOut={ctaHover.onHoverOut}
              onPressIn={ctaPress.onPressIn}
              onPressOut={ctaPress.onPressOut}
            >
              <Animated.View
                style={[
                  styles.primaryButtonVisual,
                  energy === null && styles.primaryButtonDisabled,
                  { transform: [{ scale: ctaPress.scale }] },
                ]}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    styles.hoverWash,
                    { opacity: ctaHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) },
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    styles.hoverWash,
                    { opacity: ctaPress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }) },
                  ]}
                />
                <Text style={styles.primaryText} maxFontSizeMultiplier={1.15}>Start session</Text>
                <View style={styles.buttonArrow}>
                  <ArrowUpIconGraphic size={24} />
                </View>
              </Animated.View>
            </Pressable>
          </ReanimatedAnimated.ScrollView>
        ) : sessionState === 'resolved' && preview && energy !== null ? (
          <ReanimatedAnimated.ScrollView
            key="resolved"
            entering={FadeIn.duration(CROSS_FADE_MS)}
            exiting={FadeOut.duration(CROSS_FADE_MS)}
            style={styles.flowScroll}
            contentContainerStyle={styles.resolvedFlow}
            showsVerticalScrollIndicator={false}
          >
            {renderLogoMark(24)}
            <Text style={styles.checkinTitle} maxFontSizeMultiplier={1.3}>Today&apos;s session</Text>
            <Text style={styles.checkinSubtitle} maxFontSizeMultiplier={1.4}>
              {deltaText}
            </Text>

            {/* Moved here from below the exercise list — the explanation is
                the primary differentiator (why today looks the way it does),
                not a footnote; burying it under a full exercise list
                undersold the one thing that makes the adaptation feel
                intentional instead of arbitrary. */}
            {exclusionSummary.length > 0 || symptomLines.length > 0 ? (
              <View style={styles.reasoningCard}>
                <Pressable
                  style={styles.reasoningToggleRow}
                  onPress={() => {
                    hapticSelect();
                    setShowReasoning((v) => !v);
                  }}
                  hitSlop={4}
                >
                  <Text style={styles.reasoningToggleText} maxFontSizeMultiplier={1.3}>
                    {showReasoning ? 'Hide full reasoning' : 'See full reasoning'}
                  </Text>
                  <SymbolView
                    name={showReasoning ? 'chevron.up' : 'chevron.down'}
                    size={11}
                    tintColor={colors.textSecondary}
                  />
                </Pressable>
                {showReasoning ? (
                  <ReanimatedAnimated.View entering={FadeIn.duration(160)} style={styles.reasoningBody}>
                    {symptomLines.map((line) => (
                      <Text key={line} style={styles.reasoningLine} maxFontSizeMultiplier={1.3}>
                        {line}
                      </Text>
                    ))}
                    {exclusionSummary.map(({ reason, names }) => (
                      <Text key={reason} style={styles.reasoningLine} maxFontSizeMultiplier={1.3}>
                        <Text style={styles.reasoningCount}>{names.length}</Text> {reason}: {names.join(', ')}
                      </Text>
                    ))}
                  </ReanimatedAnimated.View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.resolvedEnergyChip}>
              <Text style={styles.energyChipValue} maxFontSizeMultiplier={1.2}>
                {energy}
              </Text>
              <Text style={styles.energyChipLabel} maxFontSizeMultiplier={1.2}>
                {ENERGY_LABELS[energy]}
              </Text>
            </View>

            {exerciseTotal > 0 ? (
              <View style={styles.exerciseProgressWrap}>
                <Text style={styles.exerciseProgressText} maxFontSizeMultiplier={1.3}>
                  Exercise {Math.min(currentExerciseIndex + 1, exerciseTotal)} of {exerciseTotal}
                </Text>
                <View style={styles.exerciseProgressTrack}>
                  <ReanimatedAnimated.View style={[styles.exerciseProgressFill, exerciseProgressFillStyle]} />
                </View>
              </View>
            ) : null}

            {/* Keyed here (not on ExerciseTimer itself) so the fade covers
                both branches of the ternary below it — a key change still
                remounts the whole subtree underneath, including
                ExerciseTimer's own state reset, so this is a pure move, not
                a behavior change. Softens the cut when advancing to the
                next exercise instead of the card just swapping content
                mid-frame. */}
            {currentExercise ? (
              <ReanimatedAnimated.View
                // Includes the exercise id, not just the index — a swap
                // replaces the exercise AT this same index, and ExerciseTimer
                // computes its countdown intervals once, on mount
                // (getExerciseIntervals(exercise) inside a lazy useState
                // initializer) — without the id in the key, swapping mid-
                // exercise would leave it silently running the OLD
                // exercise's timer under the new one's name.
                key={`${currentExerciseIndex}-${currentExercise.id}`}
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(140)}
              >
                {!currentExerciseTimerDone ? (
                  <ExerciseTimer
                    exercise={currentExercise}
                    onComplete={() => handleExerciseTimerComplete(currentExerciseIndex)}
                    onSwap={() => handleOpenSwap(currentExerciseIndex)}
                    styles={styles}
                    colors={colors}
                  />
                ) : (
                  <View style={styles.timerSection}>
                    <Text style={styles.timerExerciseName} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                      {currentExercise.name}
                    </Text>
                    <Text style={styles.timerDoneText} maxFontSizeMultiplier={1.2}>
                      Done — {isLastExercise ? 'finish below' : 'next exercise unlocked'}
                    </Text>
                    {/* Entirely optional and skippable — see
                        loggedWeightsKg's own comment. Only shown for
                        exercises that actually take external load
                        (equipment !== 'none') with a real numeric rep
                        count (repStructure ranges/null reps can't feed
                        the Epley 1RM estimate honestly). Prescribed reps,
                        not a second input asking what was actually
                        done — one field is the deliberate friction
                        tradeoff here, matching how little else in this
                        app asks the user to type numbers in. */}
                    {exerciseLibrary.getById(currentExercise.id)?.equipment !== 'none' &&
                    typeof currentExercise.reps === 'number' ? (
                      <View>
                        {/* Purely informational — see lastPerformanceByName's
                            own comment above for why this isn't a computed
                            "try heavier" suggestion, just what actually
                            happened last time. */}
                        {lastPerformanceByName[currentExercise.name] ? (
                          <Text style={styles.lastPerformanceHint} maxFontSizeMultiplier={1.2}>
                            {`Last time: ${formatKg(lastPerformanceByName[currentExercise.name]!.weightKg)}kg × ${
                              lastPerformanceByName[currentExercise.name]!.reps
                            }`}
                          </Text>
                        ) : null}
                        <View style={styles.loadInputRow}>
                          <Text style={styles.loadInputLabel} maxFontSizeMultiplier={1.2}>
                            Weight used (optional)
                          </Text>
                          <TextInput
                            style={styles.loadInput}
                            value={loggedWeightsKg[currentExerciseIndex] ?? ''}
                            onChangeText={(text) =>
                              setLoggedWeightsKg((prev) => ({ ...prev, [currentExerciseIndex]: text }))
                            }
                            placeholder="kg"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="decimal-pad"
                            maxLength={5}
                          />
                          <Pressable
                            onPress={() => {
                              hapticSelect();
                              setPlateBreakdownOpenIndex((prev) =>
                                prev === currentExerciseIndex ? null : currentExerciseIndex
                              );
                            }}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Show plate breakdown"
                          >
                            <Text style={styles.plateToggleText} maxFontSizeMultiplier={1.2}>
                              Plates
                            </Text>
                          </Pressable>
                        </View>
                        {plateBreakdownOpenIndex === currentExerciseIndex ? (
                          <Text style={styles.plateBreakdownText} maxFontSizeMultiplier={1.2}>
                            {formatPlateBreakdown(
                              calculatePlates(
                                // Whatever's actually typed wins; falls back to
                                // last time's weight only when the field is
                                // still empty, so this always reflects intent
                                // rather than a stale number once someone
                                // starts typing a different target.
                                Number(loggedWeightsKg[currentExerciseIndex]) > 0
                                  ? Number(loggedWeightsKg[currentExerciseIndex])
                                  : (lastPerformanceByName[currentExercise.name]?.weightKg ?? 0)
                              )
                            )}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                )}
              </ReanimatedAnimated.View>
            ) : null}

            <View style={styles.resolvedExerciseCard}>
              <View pointerEvents="none" style={styles.exerciseCardSheen} />
              <Text style={styles.exerciseLogHint} maxFontSizeMultiplier={1.3}>
                One at a time — finish the timer above or skip it, whichever works today
              </Text>
              {sessionExercises.map((exercise, index) => {
                const isDone = completedExercises.has(index);
                const isCurrent = index === currentExerciseIndex && !isDone;
                const isUpcoming = index > currentExerciseIndex;
                const cue = getCueFor(exercise.id);
                const isExpanded = expandedExerciseIndex === index;
                const row = (
                  <View
                    style={[
                      styles.exerciseRow,
                      isCurrent && styles.exerciseRowCurrent,
                      isUpcoming && styles.exerciseRowUpcoming,
                    ]}
                  >
                    <View style={styles.exerciseNameRow}>
                      <View style={[styles.exerciseCheckbox, isDone && styles.exerciseCheckboxDone]}>
                        {isDone ? <SymbolView name="checkmark" size={10} tintColor="#ffffff" weight="bold" /> : null}
                      </View>
                      <Text
                        style={[styles.exerciseName, isDone && styles.exerciseNameDone]}
                        maxFontSizeMultiplier={1.3}
                      >
                        {exercise.name}
                      </Text>
                    </View>
                    <View style={styles.exerciseStatBlock}>
                      <Text style={styles.exerciseStatText} maxFontSizeMultiplier={1.2}>
                        {formatExerciseStat(exercise)}
                      </Text>
                    </View>
                    {/* Reuses the same chevron the reasoning panel above uses
                        for its own expand/collapse — one disclosure language
                        for the whole screen, not a hidden interaction a
                        brain-fog user has to discover on their own. Only
                        rendered when there's real content to show — see
                        getCueFor's own note on why "no cue yet" means no
                        affordance, not an empty expansion. */}
                    {cue ? (
                      <SymbolView
                        name={isExpanded ? 'chevron.up' : 'chevron.down'}
                        size={11}
                        tintColor={colors.textSecondary}
                        style={styles.exerciseChevron}
                      />
                    ) : null}
                  </View>
                );
                return (
                  // layout (not just entering/exiting on the child) is what
                  // makes THIS row's own height change smoothly as its cue
                  // body mounts/unmounts, and — since every row in the list
                  // carries the same prop — what makes every row below it
                  // slide to its new position instead of snapping when one
                  // row above it expands or collapses.
                  <ReanimatedAnimated.View
                    key={index}
                    layout={LinearTransition.springify(280).dampingRatio(0.8)}
                  >
                    {index > 0 ? <View style={styles.exerciseDivider} /> : null}
                    {cue ? (
                      <Pressable
                        onPress={() => {
                          hapticSelect();
                          setExpandedExerciseIndex((v) => (v === index ? null : index));
                        }}
                        hitSlop={4}
                      >
                        {row}
                      </Pressable>
                    ) : (
                      row
                    )}
                    {cue && isExpanded ? (
                      <ReanimatedAnimated.View
                        entering={FadeIn.duration(160)}
                        exiting={FadeOut.duration(120)}
                        style={styles.exerciseExpandedBody}
                      >
                        <CueContent cue={cue} styles={styles} />
                      </ReanimatedAnimated.View>
                    ) : null}
                  </ReanimatedAnimated.View>
                );
              })}
              <Text style={styles.equipmentNote} maxFontSizeMultiplier={1.3}>
                {preview.equipmentNote}
              </Text>
            </View>

            <Pressable
              style={styles.checkinPrimaryButtonHit}
              onPress={() => (isLastExercise ? handleFinishSession() : handleNextExercise())}
              disabled={!currentExerciseTimerDone || isFinishingSession}
              onHoverIn={finishHover.onHoverIn}
              onHoverOut={finishHover.onHoverOut}
              onPressIn={finishPress.onPressIn}
              onPressOut={finishPress.onPressOut}
            >
              <Animated.View
                style={[
                  styles.primaryButtonVisual,
                  (!currentExerciseTimerDone || isFinishingSession) && styles.primaryButtonDisabled,
                  { transform: [{ scale: finishPress.scale }] },
                ]}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    styles.hoverWash,
                    { opacity: finishHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) },
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    styles.hoverWash,
                    { opacity: finishPress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }) },
                  ]}
                />
                <Text style={styles.primaryText} maxFontSizeMultiplier={1.15}>
                  {isLastExercise ? 'Finish session' : 'Next exercise'}
                </Text>
                <View style={styles.buttonArrow}>
                  <ArrowUpIconGraphic size={24} />
                </View>
              </Animated.View>
            </Pressable>

            <Pressable
              style={styles.skipExerciseHit}
              onPress={handleSkipPress}
              hitSlop={8}
              onHoverIn={skipExerciseHover.onHoverIn}
              onHoverOut={skipExerciseHover.onHoverOut}
              onPressIn={skipExercisePress.onPressIn}
              onPressOut={skipExercisePress.onPressOut}
            >
              <Animated.Text
                style={[styles.skipExerciseText, textDimStyle(skipExerciseHover, skipExercisePress)]}
                maxFontSizeMultiplier={1.2}
              >
                Skip this exercise
              </Animated.Text>
            </Pressable>

            <Modal
              visible={showSkipConfirm}
              transparent
              animationType="fade"
              onRequestClose={handleCancelSkip}
              statusBarTranslucent
            >
              <Pressable style={styles.skipConfirmBackdrop} onPress={handleCancelSkip}>
                <Pressable style={styles.skipConfirmCard} onPress={() => {}}>
                  <Text style={styles.skipConfirmTitle} maxFontSizeMultiplier={1.3}>
                    Skip this exercise?
                  </Text>
                  <Text style={styles.skipConfirmBody} maxFontSizeMultiplier={1.4}>
                    It won&apos;t count as done today — you can always come back to it another time.
                  </Text>
                  <View style={styles.skipConfirmActions}>
                    <Pressable
                      style={styles.skipConfirmCancelHit}
                      onPress={handleCancelSkip}
                      hitSlop={8}
                      onHoverIn={skipCancelHover.onHoverIn}
                      onHoverOut={skipCancelHover.onHoverOut}
                      onPressIn={skipCancelPress.onPressIn}
                      onPressOut={skipCancelPress.onPressOut}
                    >
                      <PillWash hover={skipCancelHover} press={skipCancelPress} radius={14} styles={styles} />
                      <Text style={styles.skipConfirmCancelText} maxFontSizeMultiplier={1.2}>
                        Keep going
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.skipConfirmConfirmHit}
                      onPress={handleSkipExercise}
                      hitSlop={8}
                      onHoverIn={skipConfirmHover.onHoverIn}
                      onHoverOut={skipConfirmHover.onHoverOut}
                      onPressIn={skipConfirmPress.onPressIn}
                      onPressOut={skipConfirmPress.onPressOut}
                    >
                      <Animated.Text
                        style={[styles.skipConfirmConfirmText, textDimStyle(skipConfirmHover, skipConfirmPress)]}
                        maxFontSizeMultiplier={1.2}
                      >
                        Skip anyway
                      </Animated.Text>
                    </Pressable>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>

            <Modal
              visible={swapModalIndex !== null}
              transparent
              animationType={screenReaderEnabled ? 'none' : 'fade'}
              onRequestClose={handleCloseSwap}
              statusBarTranslucent
            >
              <Pressable style={styles.skipConfirmBackdrop} onPress={handleCloseSwap}>
                <Pressable style={styles.swapModalCard} onPress={() => {}}>
                  <Text style={styles.skipConfirmTitle} maxFontSizeMultiplier={1.3}>
                    Swap this exercise
                  </Text>
                  {swapModalCandidates.length === 0 ? (
                    <Text style={styles.skipConfirmBody} maxFontSizeMultiplier={1.4}>
                      No same-category alternative fits today&apos;s plan right now.
                    </Text>
                  ) : (
                    <ScrollView style={styles.swapModalList} showsVerticalScrollIndicator={false}>
                      {swapModalCandidates.map((candidate, index) => (
                        <Pressable
                          key={candidate.id}
                          style={[
                            styles.swapModalRow,
                            index < swapModalCandidates.length - 1 && styles.swapModalRowDivider,
                          ]}
                          onPress={() => handleSelectSwap(candidate)}
                        >
                          <Text style={styles.swapModalRowName} maxFontSizeMultiplier={1.3}>
                            {candidate.name}
                          </Text>
                          <Text style={styles.swapModalRowStat} maxFontSizeMultiplier={1.3}>
                            {formatExerciseStat({
                              sets: candidate.base_sets,
                              reps: candidate.base_reps,
                              durationMin: candidate.base_duration_min,
                            })}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                  <Pressable
                    style={styles.swapModalCancelHit}
                    onPress={handleCloseSwap}
                    hitSlop={8}
                  >
                    <Text style={styles.swapModalCancelText} maxFontSizeMultiplier={1.2}>
                      Cancel
                    </Text>
                  </Pressable>
                </Pressable>
              </Pressable>
            </Modal>
          </ReanimatedAnimated.ScrollView>
        ) : (
          <ReanimatedAnimated.ScrollView
            key="done"
            entering={FadeIn.duration(CROSS_FADE_MS)}
            exiting={FadeOut.duration(CROSS_FADE_MS)}
            style={styles.flowScroll}
            contentContainerStyle={styles.doneWrap}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderLogoMark(104)}
            {/* A cumulative lifetime total, not a streak — see
                session-milestones.ts's own doc comment on why that
                distinction is what keeps this inside the Anti-Roadmap's
                actual ban (a streak specifically). Plain observation, same
                register as momentum.ts's own copy — no exclamation mark, no
                "keep it going," and it can never appear as a discouraging
                or broken number since it only ever counts up. */}
            {milestoneReached ? (
              <ReanimatedAnimated.Text
                entering={FadeIn.duration(240)}
                style={styles.milestoneText}
                maxFontSizeMultiplier={1.2}
                accessibilityLabel={`${milestoneReached} session${milestoneReached === 1 ? '' : 's'} logged so far`}
              >
                {milestoneReached} session{milestoneReached === 1 ? '' : 's'} logged so far
              </ReanimatedAnimated.Text>
            ) : null}

            {/* The milestone moment, not signup, is where a referral ask
                actually lands — see session-milestones.ts's own MILESTONES
                list for what counts as one. Reuses doneInsightHit's exact
                pressable-sentence pattern for visual consistency with the
                "See Progress" link above/below it, and never appears on a
                session that isn't a real milestone (no separate nag). */}
            {milestoneReached ? (
              <Pressable
                style={styles.doneInsightHit}
                onPress={() => {
                  hapticSelect();
                  router.push('/referral' as never);
                }}
                hitSlop={6}
              >
                <Text style={styles.doneInsightText} maxFontSizeMultiplier={1.3}>
                  Bring a training partner along. <Text style={styles.doneInsightLink}>Invite a friend</Text>
                </Text>
              </Pressable>
            ) : null}
            <SuccessCheckmark size={110} />
            <Text style={styles.doneTitle} maxFontSizeMultiplier={1.3}>
              Session complete
            </Text>
            <Text style={styles.doneSubtitle} maxFontSizeMultiplier={1.4}>
              {postSessionNote ?? 'Nice work. See you tomorrow.'}
            </Text>

            {estimatedCalories !== null ? (
              <Text style={styles.calorieEstimateText} maxFontSizeMultiplier={1.3}>
                ~{estimatedCalories} cal · estimated
              </Text>
            ) : null}

            {doneInsight ? (
              <Pressable
                style={styles.doneInsightHit}
                onPress={() => {
                  hapticSelect();
                  router.push('/(tabs)/progress' as never);
                }}
                hitSlop={6}
              >
                <Text style={styles.doneInsightText} maxFontSizeMultiplier={1.3}>
                  {doneInsight} <Text style={styles.doneInsightLink}>See Progress</Text>
                </Text>
              </Pressable>
            ) : null}

            {pacingTrendNote ? (
              <ReanimatedAnimated.Text
                entering={FadeIn.duration(240)}
                style={styles.milestoneText}
                maxFontSizeMultiplier={1.2}
              >
                {pacingTrendNote}
              </ReanimatedAnimated.Text>
            ) : null}

            {/* Plus-gated, same tier as the earned insights below — the
                Progress tab's own Strength Progress card (which this same
                logged data also feeds) is gated the same way, so this
                shouldn't tease it for free right here. */}
            {isPremium && loadImprovementNote ? (
              <ReanimatedAnimated.Text
                entering={FadeIn.duration(240)}
                style={styles.milestoneText}
                maxFontSizeMultiplier={1.2}
              >
                {loadImprovementNote}
              </ReanimatedAnimated.Text>
            ) : null}

            {/* Earned insights are a VerveIn Plus benefit — gated the same
                way the cooldowns above already gate these notes to "not
                every session," rather than a locked teaser card. A free
                user simply doesn't see this note fire this time, matching
                this app's own "silence is valid" rule for exactly these
                two functions (coaching-insights.ts, plan-fit.ts) instead of
                announcing an absence. */}
            {isPremium && coachingInsightNote ? (
              <ReanimatedAnimated.Text
                entering={FadeIn.duration(240)}
                style={styles.milestoneText}
                maxFontSizeMultiplier={1.2}
              >
                {coachingInsightNote}
              </ReanimatedAnimated.Text>
            ) : null}

            {isPremium && planFitNote ? (
              <ReanimatedAnimated.Text
                entering={FadeIn.duration(240)}
                style={styles.milestoneText}
                maxFontSizeMultiplier={1.2}
              >
                {planFitNote}
              </ReanimatedAnimated.Text>
            ) : null}

            <View style={styles.feedbackSection}>
              <Text style={styles.noteLabel} maxFontSizeMultiplier={1.3}>
                HOW DID THAT FEEL?
              </Text>
              {feedbackGiven ? (
                <Text style={styles.feedbackConfirmText} maxFontSizeMultiplier={1.3}>
                  {isFirstFeedback
                    ? "That's your first pacing call — we'll get sharper together."
                    : FEEDBACK_CONFIRM_TEXT[feedbackGiven]}
                </Text>
              ) : (
                <View style={styles.feedbackButtonRow}>
                  <Pressable
                    style={styles.feedbackButton}
                    onPress={() => handleSubmitFeedback('much_too_easy')}
                    onHoverIn={feedbackMuchTooEasyHover.onHoverIn}
                    onHoverOut={feedbackMuchTooEasyHover.onHoverOut}
                    onPressIn={feedbackMuchTooEasyPress.onPressIn}
                    onPressOut={feedbackMuchTooEasyPress.onPressOut}
                  >
                    <PillWash hover={feedbackMuchTooEasyHover} press={feedbackMuchTooEasyPress} radius={8} styles={styles} />
                    <Text style={styles.feedbackButtonText} maxFontSizeMultiplier={1.2}>Way too easy</Text>
                  </Pressable>
                  <Pressable
                    style={styles.feedbackButton}
                    onPress={() => handleSubmitFeedback('too_easy')}
                    onHoverIn={feedbackTooEasyHover.onHoverIn}
                    onHoverOut={feedbackTooEasyHover.onHoverOut}
                    onPressIn={feedbackTooEasyPress.onPressIn}
                    onPressOut={feedbackTooEasyPress.onPressOut}
                  >
                    <PillWash hover={feedbackTooEasyHover} press={feedbackTooEasyPress} radius={8} styles={styles} />
                    <Text style={styles.feedbackButtonText} maxFontSizeMultiplier={1.2}>Too easy</Text>
                  </Pressable>
                  <Pressable
                    style={styles.feedbackButton}
                    onPress={() => handleSubmitFeedback('just_right')}
                    onHoverIn={feedbackJustRightHover.onHoverIn}
                    onHoverOut={feedbackJustRightHover.onHoverOut}
                    onPressIn={feedbackJustRightPress.onPressIn}
                    onPressOut={feedbackJustRightPress.onPressOut}
                  >
                    <PillWash hover={feedbackJustRightHover} press={feedbackJustRightPress} radius={8} styles={styles} />
                    <Text style={styles.feedbackButtonText} maxFontSizeMultiplier={1.2}>Just right</Text>
                  </Pressable>
                  <Pressable
                    style={styles.feedbackButton}
                    onPress={() => handleSubmitFeedback('too_hard')}
                    onHoverIn={feedbackTooHardHover.onHoverIn}
                    onHoverOut={feedbackTooHardHover.onHoverOut}
                    onPressIn={feedbackTooHardPress.onPressIn}
                    onPressOut={feedbackTooHardPress.onPressOut}
                  >
                    <PillWash hover={feedbackTooHardHover} press={feedbackTooHardPress} radius={8} styles={styles} />
                    <Text style={styles.feedbackButtonText} maxFontSizeMultiplier={1.2}>Too hard</Text>
                  </Pressable>
                  <Pressable
                    style={styles.feedbackButton}
                    onPress={() => handleSubmitFeedback('much_too_hard')}
                    onHoverIn={feedbackMuchTooHardHover.onHoverIn}
                    onHoverOut={feedbackMuchTooHardHover.onHoverOut}
                    onPressIn={feedbackMuchTooHardPress.onPressIn}
                    onPressOut={feedbackMuchTooHardPress.onPressOut}
                  >
                    <PillWash hover={feedbackMuchTooHardHover} press={feedbackMuchTooHardPress} radius={8} styles={styles} />
                    <Text style={styles.feedbackButtonText} maxFontSizeMultiplier={1.2}>Way too hard</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.noteSection}>
              <Text style={styles.noteLabel} maxFontSizeMultiplier={1.3}>
                ADD A NOTE (OPTIONAL)
              </Text>
              <TextInput
                style={styles.noteInput}
                value={noteText}
                onChangeText={handleNoteChange}
                placeholder="Anything worth remembering?"
                placeholderTextColor={colors.textTertiary}
                multiline
                maxFontSizeMultiplier={1.3}
              />
            </View>

            <Pressable
              style={styles.doneBackButton}
              onPress={handleBackToHome}
              hitSlop={8}
              onHoverIn={backToHomeHover.onHoverIn}
              onHoverOut={backToHomeHover.onHoverOut}
              onPressIn={backToHomePress.onPressIn}
              onPressOut={backToHomePress.onPressOut}
            >
              <PillWash hover={backToHomeHover} press={backToHomePress} radius={6} styles={styles} />
              <Text style={styles.doneBackButtonText} maxFontSizeMultiplier={1.2}>Back to Home</Text>
            </Pressable>
          </ReanimatedAnimated.ScrollView>
        )}
      </ReanimatedAnimated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * The dual hover-wash + press-glow overlay already used by the two primary
 * buttons (Start session/Finish session) — factored out so the smaller
 * secondary pill buttons wired up alongside them (Pause, Done early, Start
 * next set, Skip confirm, feedback pills, Back to Home) get the same feel
 * without copy-pasting the same two Animated.View blocks at every call
 * site. `radius` matches whatever borderRadius the pill itself uses —
 * hoverWash's own baked-in borderRadius is only ever right by coincidence
 * otherwise.
 */
function PillWash({
  hover,
  press,
  radius,
  styles,
}: {
  hover: ReturnType<typeof useHoverFade>;
  press: ReturnType<typeof useLiquidPress>;
  radius: number;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.hoverWash,
          { borderRadius: radius, opacity: hover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.hoverWash,
          { borderRadius: radius, opacity: press.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }) },
        ]}
      />
    </>
  );
}

/**
 * Same hover+press signal, lighter treatment for a plain text/underlined
 * link with no background of its own (Skip this exercise, Skip anyway,
 * Watch form, How to) — dims the text itself rather than washing a box
 * behind it, since there's no box to wash.
 */
function textDimStyle(hover: ReturnType<typeof useHoverFade>, press: ReturnType<typeof useLiquidPress>) {
  return {
    opacity: Animated.add(hover.anim, press.glow).interpolate({
      inputRange: [0, 1, 2],
      outputRange: [1, 0.7, 0.55],
    }),
  };
}

/**
 * Renders whichever cue tier getCueFor found — the full 4-part breakdown
 * for a moderate exercise, or the single line for a simple one. Shared by
 * the exercise-list tap-to-expand rows and ExerciseTimer's live "How to"
 * reveal, so the two surfaces can't drift into different formats for the
 * same content.
 */
function CueContent({ cue, styles }: { cue: ExerciseCue; styles: ReturnType<typeof createStyles> }) {
  if (cue.kind === 'simple') {
    return (
      <Text style={styles.cueSimpleText} maxFontSizeMultiplier={1.3}>
        {cue.cue}
      </Text>
    );
  }
  const { startingPosition, movement, keyCue, feelIt, regression } = cue.cue;
  return (
    <View>
      <Text style={styles.cueLabel} maxFontSizeMultiplier={1.2}>STARTING POSITION</Text>
      <Text style={styles.cueText} maxFontSizeMultiplier={1.3}>{startingPosition}</Text>
      <Text style={styles.cueLabel} maxFontSizeMultiplier={1.2}>THE MOVEMENT</Text>
      <Text style={styles.cueText} maxFontSizeMultiplier={1.3}>{movement}</Text>
      <Text style={styles.cueLabel} maxFontSizeMultiplier={1.2}>THE ONE THING THAT MATTERS</Text>
      <Text style={[styles.cueText, styles.cueKeyText]} maxFontSizeMultiplier={1.3}>{keyCue}</Text>
      <Text style={styles.cueLabel} maxFontSizeMultiplier={1.2}>HOW TO KNOW IT&apos;S RIGHT</Text>
      <Text style={styles.cueText} maxFontSizeMultiplier={1.3}>{feelIt}</Text>
      {regression ? (
        <Text style={[styles.cueText, styles.cueRegressionText]} maxFontSizeMultiplier={1.3}>{regression}</Text>
      ) : null}
    </View>
  );
}

/**
 * The guided countdown for a single exercise — deliberately its own
 * component, keyed by exercise index from the parent, rather than timer
 * state living in EnergyCheckInScreen with an effect to reset it on every
 * exercise change. Switching exercises remounts this with a fresh
 * `useState(() => getExerciseIntervals(exercise))` instead, which is the
 * React-recommended way to reset state on a prop change — no "sync state to
 * a dependency" effect needed, and it's what keeps the tick/completion
 * effects below clean (setState only ever happens inside a timeout
 * callback or via the onComplete prop, never synchronously in an effect
 * body).
 *
 * Runs as a real interval timer, not one flat countdown, and every phase
 * transition is an explicit tap — nothing cascades automatically. A set's
 * countdown reaching 0 (or being finished early — see handleFinishEarly)
 * doesn't start rest on its own; rest reaching 0 doesn't start the next
 * set on its own. handleStartNextPhase is the only thing that ever
 * advances phaseIndex. onComplete still fires the moment the very last
 * interval's countdown reaches 0, same contract as before.
 */
function ExerciseTimer({
  exercise,
  onComplete,
  onSwap,
  styles,
  colors,
}: {
  exercise: PlanExercise;
  onComplete: () => void;
  onSwap: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const [intervals] = useState(() => getExerciseIntervals(exercise));
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(() => intervals[0].seconds);
  const [active, setActive] = useState(true);
  // Collapsed by default here too — this is the "obvious tap" surface
  // (not automatic) for the live view, same disclosure language as the
  // exercise list and the reasoning panel. This is the moment a "surface
  // it via an obvious tap" call actually matters most: the user is about
  // to position their body, not browsing a list beforehand.
  const [showCue, setShowCue] = useState(false);
  const cue = getCueFor(exercise.id);

  const currentInterval = intervals[phaseIndex];
  const isLastInterval = phaseIndex === intervals.length - 1;
  const nextInterval = isLastInterval ? null : intervals[phaseIndex + 1];
  // Derived, not its own state: this interval finished (naturally or via
  // the early-finish bypass) and there's a next one queued up, waiting on
  // handleStartNextPhase's tap. True only in that gap — false again the
  // instant the next interval actually starts.
  const awaitingNextPhase = secondsLeft === 0 && nextInterval !== null;

  // The tick — a chained setTimeout keyed on secondsLeft itself (rather
  // than a single setInterval) so it can't drift and self-corrects every
  // render; setState happens inside the timeout callback, not the effect
  // body itself. Counts down whichever interval is current and stops dead
  // at 0 — it never advances phaseIndex itself, see handleStartNextPhase.
  useEffect(() => {
    if (!active || secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [active, secondsLeft]);

  // Notifies the parent exactly once, the moment the *last* interval's
  // countdown reaches 0 — whether it got there by ticking down naturally
  // or via the early-finish bypass below. Calling a prop function from an
  // effect (not this component's own setState) is the standard "tell my
  // parent something happened" pattern.
  useEffect(() => {
    if (secondsLeft === 0 && isLastInterval) onComplete();
  }, [secondsLeft, isLastInterval, onComplete]);

  // A visible beat under the existing haptic the instant a phase's
  // countdown reaches 0 — natural tick-out or the early-finish bypass both
  // land here. The final interval already gets hapticSuccess via onComplete
  // above (fired in the parent), so this only adds a NEW haptic for the
  // non-final "awaiting next phase" case; the pulse itself fires either way,
  // since both are "something just finished" moments. Mutating clockPulse
  // here, before the useAnimatedStyle below reads it, matters for the React
  // Compiler's immutability check — reading a shared value in a worklet
  // before its mutating effect (in source order) gets flagged as mutating
  // an already-captured value, even though Reanimated's .value contract is
  // exempt from that at runtime.
  const clockPulse = useSharedValue(1);
  useEffect(() => {
    if (secondsLeft !== 0) return;
    clockPulse.value = withSequence(withTiming(1.14, { duration: 110 }), withTiming(1, { duration: 180 }));
    if (!isLastInterval) hapticImpactLight();
  }, [secondsLeft, isLastInterval, clockPulse]);
  const clockPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: clockPulse.value }] }));

  // Fluidity pass: this cluster is tapped constantly during a real session
  // (every set, every rest, every "how to" check) and previously had zero
  // hover/press feedback — the biggest single gap the fluidity audit found.
  const watchFormHover = useHoverFade();
  const watchFormPress = useLiquidPress();
  const howToHover = useHoverFade();
  const howToPress = useLiquidPress();
  const swapHover = useHoverFade();
  const swapPress = useLiquidPress();
  const startNextHover = useHoverFade();
  const startNextPress = useLiquidPress();
  const pauseHover = useHoverFade();
  const pausePress = useLiquidPress();
  const doneEarlyHover = useHoverFade();
  const doneEarlyPress = useLiquidPress();

  const togglePause = () => {
    hapticSelect();
    setActive((a) => !a);
  };

  // Only ever shown for a bypassable work interval (discrete/countable
  // reps — see TimerInterval.bypassable). That countdown is a rough proxy
  // for "how long these reps probably take," not a real target the way an
  // isometric hold's duration is, so finishing the actual reps before the
  // estimate runs out shouldn't force a wait. Setting secondsLeft to 0
  // lands in exactly the same "awaiting next phase" state a natural
  // countdown reaching 0 would — no separate code path.
  const handleFinishEarly = () => {
    hapticSelect();
    setSecondsLeft(0);
  };

  // The only place phaseIndex ever advances — an explicit tap to start
  // rest after a set, or to start the next set's own timer. Plain event
  // handler, not an effect, so calling setState here directly is fine.
  const handleStartNextPhase = () => {
    if (!nextInterval) return;
    hapticSelect();
    setPhaseIndex((i) => i + 1);
    setSecondsLeft(nextInterval.seconds);
    setActive(true);
  };

  const isRest = currentInterval.kind === 'rest';
  // No label at all for a single-interval duration hold (totalSets:1,
  // nothing to count) — same plain-clock look as before for those.
  const phaseLabel = isRest
    ? `Rest before set ${currentInterval.setNumber + 1}`
    : currentInterval.totalSets > 1
      ? `Set ${currentInterval.setNumber} of ${currentInterval.totalSets}`
      : null;
  const nextPhaseButtonLabel = nextInterval
    ? nextInterval.kind === 'rest'
      ? 'Start rest'
      : `Start set ${nextInterval.setNumber}`
    : null;

  // No image/video/cue data exists anywhere in the exercise library (1,449
  // entries, taxonomy fields only — see engine/types.ts's Exercise type) and
  // there's no owned media to show instead, so an uncurated search hand-off
  // is the honest option: it never claims to have a demo we don't actually
  // have. Opens in-app (openBrowserAsync) rather than kicking the user out
  // of Vervein entirely.
  const handleWatchForm = () => {
    hapticImpactLight();
    const query = encodeURIComponent(`${exercise.name} form`);
    openBrowserAsync(`https://www.youtube.com/results?search_query=${query}`);
  };

  return (
    <ReanimatedAnimated.View
      style={styles.timerSection}
      layout={LinearTransition.springify(280).dampingRatio(0.8)}
    >
      <Text style={styles.timerExerciseName} maxFontSizeMultiplier={1.2} numberOfLines={1}>
        {exercise.name}
      </Text>
      <View style={styles.timerLinksRow}>
        <Pressable
          style={styles.timerWatchFormButton}
          onPress={handleWatchForm}
          hitSlop={8}
          onHoverIn={watchFormHover.onHoverIn}
          onHoverOut={watchFormHover.onHoverOut}
          onPressIn={watchFormPress.onPressIn}
          onPressOut={watchFormPress.onPressOut}
          accessibilityRole="button"
          accessibilityLabel="Watch form"
        >
          <Animated.View style={[styles.timerWatchFormButton, textDimStyle(watchFormHover, watchFormPress)]}>
            <SymbolView name="play.rectangle" size={12} tintColor={colors.textSecondary} />
            <Text style={styles.timerWatchFormText} maxFontSizeMultiplier={1.2}>
              Watch form
            </Text>
          </Animated.View>
        </Pressable>
        {cue ? (
          <Pressable
            style={styles.timerWatchFormButton}
            onPress={() => {
              hapticSelect();
              setShowCue((v) => !v);
            }}
            hitSlop={8}
            onHoverIn={howToHover.onHoverIn}
            onHoverOut={howToHover.onHoverOut}
            onPressIn={howToPress.onPressIn}
            onPressOut={howToPress.onPressOut}
            accessibilityRole="button"
            accessibilityLabel="How to"
          >
            <Animated.View style={[styles.timerWatchFormButton, textDimStyle(howToHover, howToPress)]}>
              <SymbolView name={showCue ? 'chevron.up' : 'info.circle'} size={12} tintColor={colors.textSecondary} />
              <Text style={styles.timerWatchFormText} maxFontSizeMultiplier={1.2}>
                How to
              </Text>
            </Animated.View>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.timerWatchFormButton}
          onPress={onSwap}
          hitSlop={8}
          onHoverIn={swapHover.onHoverIn}
          onHoverOut={swapHover.onHoverOut}
          onPressIn={swapPress.onPressIn}
          onPressOut={swapPress.onPressOut}
          accessibilityRole="button"
          accessibilityLabel="Swap"
        >
          <Animated.View style={[styles.timerWatchFormButton, textDimStyle(swapHover, swapPress)]}>
            <SymbolView name="arrow.triangle.2.circlepath" size={12} tintColor={colors.textSecondary} />
            <Text style={styles.timerWatchFormText} maxFontSizeMultiplier={1.2}>
              Swap
            </Text>
          </Animated.View>
        </Pressable>
      </View>
      {cue && showCue ? (
        <ReanimatedAnimated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={styles.timerCueBody}
        >
          <CueContent cue={cue} styles={styles} />
        </ReanimatedAnimated.View>
      ) : null}
      {phaseLabel ? (
        <Text
          style={[styles.timerPhaseLabel, isRest && styles.timerPhaseLabelRest]}
          maxFontSizeMultiplier={1.2}
        >
          {phaseLabel}
        </Text>
      ) : null}
      <ReanimatedAnimated.Text
        style={[styles.timerClock, isRest && styles.timerClockRest, clockPulseStyle]}
        maxFontSizeMultiplier={1.1}
      >
        {formatTimerClock(secondsLeft)}
      </ReanimatedAnimated.Text>
      {awaitingNextPhase ? (
        <Pressable
          style={styles.timerStartNextButton}
          onPress={handleStartNextPhase}
          hitSlop={8}
          onHoverIn={startNextHover.onHoverIn}
          onHoverOut={startNextHover.onHoverOut}
          onPressIn={startNextPress.onPressIn}
          onPressOut={startNextPress.onPressOut}
        >
          <PillWash hover={startNextHover} press={startNextPress} radius={16} styles={styles} />
          <SymbolView name="play.fill" size={12} tintColor="#ffffff" />
          <Text style={styles.timerStartNextText} maxFontSizeMultiplier={1.2}>
            {nextPhaseButtonLabel}
          </Text>
        </Pressable>
      ) : secondsLeft > 0 ? (
        <View style={styles.timerActionRow}>
          <Pressable
            style={styles.timerPauseButton}
            onPress={togglePause}
            hitSlop={8}
            onHoverIn={pauseHover.onHoverIn}
            onHoverOut={pauseHover.onHoverOut}
            onPressIn={pausePress.onPressIn}
            onPressOut={pausePress.onPressOut}
          >
            <PillWash hover={pauseHover} press={pausePress} radius={14} styles={styles} />
            <SymbolView name={active ? 'pause.fill' : 'play.fill'} size={12} tintColor={colors.text} />
            <Text style={styles.timerPauseText} maxFontSizeMultiplier={1.2}>
              {active ? 'Pause' : 'Resume'}
            </Text>
          </Pressable>
          {currentInterval.bypassable ? (
            <Pressable
              style={styles.timerDoneEarlyButton}
              onPress={handleFinishEarly}
              hitSlop={8}
              onHoverIn={doneEarlyHover.onHoverIn}
              onHoverOut={doneEarlyHover.onHoverOut}
              onPressIn={doneEarlyPress.onPressIn}
              onPressOut={doneEarlyPress.onPressOut}
            >
              <PillWash hover={doneEarlyHover} press={doneEarlyPress} radius={14} styles={styles} />
              <SymbolView name="checkmark" size={11} tintColor={colors.textSecondary} />
              <Text style={styles.timerDoneEarlyText} maxFontSizeMultiplier={1.2}>
                Done early?
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ReanimatedAnimated.View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], hoverWashColor: string) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    canvas: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    fadeLayer: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    },
    // 1.5x the mark used elsewhere (auth/onboarding screens) — same aspect
    // ratio, just a bigger presence for the screen a returning user actually
    // lives on.
    // Rest-day is the only branch that still doesn't scroll (short, fixed
    // content — see the file-level comment above the ternary), so it's the
    // only place this fixed/absolute logo variant is still used. checkin/
    // resolved/done render logoMarkFlow instead — see its comment below for
    // why (a fixed-position logo over scrolling content overlaps it).
    logoMark: {
      position: 'absolute',
      left: 145.65,
      top: 68,
      width: 83.7,
      height: 75.11,
    },
    // Same box, no position/top/left — a normal flow child, so it scrolls
    // away with the rest of the content instead of staying pinned over it.
    // Used by the checkin/resolved/done ScrollViews (see renderLogoMark
    // below); rest-day still uses the fixed logoMark above since it never
    // scrolls. Both are 15% smaller than the original 106.5x88.37 box —
    // logoAccent/logoCheck below and the Graphic width/height props at each
    // call site are scaled the same 0.85 to match.
    logoMarkFlow: {
      width: 83.7,
      height: 75.11,
    },
    logoAccent: {
      position: 'absolute',
      left: 0,
      top: 8.43,
    },
    logoCheck: {
      position: 'absolute',
      left: 43.13,
      top: 0,
    },
    title: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 180,
      paddingHorizontal: 44,
      color: colors.text,
      fontSize: 24,
      lineHeight: 30,
      letterSpacing: -0.3,
      textAlign: 'center',
      fontFamily: 'Geist-Bold',
    },
    titleAccent: {
      color: '#438C63',
    },
    subtitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 246,
      paddingHorizontal: 56,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    gaugeWrap: {
      position: 'absolute',
      left: (CANVAS_WIDTH - 260) / 2,
      top: 280,
      alignItems: 'center',
    },
    // The explanation is the hero of a completed check-in, not an afterthought
    // caption — larger and higher-contrast than a typical secondary line.
    explanationBlock: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 492,
      paddingHorizontal: 40,
      alignItems: 'center',
    },
    explanationText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      fontFamily: 'Geist-SemiBold',
    },
    comparisonText: {
      marginTop: 6,
      color: '#438C63',
      fontSize: 11,
      fontFamily: 'Geist-Medium',
    },
    // Flow-based counterparts of title/subtitle/gaugeWrap/explanationBlock,
    // used only by the 'checkin' branch — that branch now needs to fit a
    // variable amount of content (the symptom picker only appears once
    // energy is picked), which a stack of hand-tuned absolute positions
    // can't accommodate safely. The rest-day branch still uses the
    // original absolute-positioned title/subtitle above, untouched.
    // The three variable-content branches (checkin/resolved/done) render as
    // ScrollViews now, not plain Views — canvas is a fixed 375x812 box with
    // overflow:'hidden' (see CANVAS_WIDTH/HEIGHT above), so content taller
    // than that was previously clipped with no way to reach it (e.g. the
    // reasoning panel expanding, or several symptom chips wrapping to a
    // second row). flowScroll is the shared ScrollView `style` (sizes it to
    // the canvas); each branch keeps its own contentContainerStyle below.
    flowScroll: {
      flex: 1,
      width: CANVAS_WIDTH,
    },
    checkinFlow: {
      alignItems: 'center',
      paddingTop: 68,
      paddingBottom: 40,
    },
    checkinTitle: {
      paddingHorizontal: 44,
      color: colors.text,
      fontSize: 24,
      lineHeight: 30,
      letterSpacing: -0.3,
      textAlign: 'center',
      fontFamily: 'Geist-Bold',
    },
    checkinSubtitle: {
      marginTop: 8,
      paddingHorizontal: 56,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    checkinGaugeWrap: {
      marginTop: 24,
      alignItems: 'center',
    },
    checkinExplanationBlock: {
      marginTop: 16,
      paddingHorizontal: 40,
      alignItems: 'center',
    },
    symptomSection: {
      marginTop: 24,
      width: 325,
    },
    timeAvailableSection: {
      marginTop: 20,
      width: 325,
    },
    symptomChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    symptomChip: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    symptomChipActive: {
      borderColor: '#438C63',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    symptomChipText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: 'Geist-Medium',
    },
    symptomChipTextActive: {
      color: '#5FBE84',
      fontFamily: 'Geist-SemiBold',
    },
    // A distinct, more solid treatment than the symptom chips above —
    // selected reads as a real choice made (solid accent fill), not just a
    // tinted-border acknowledgment. Matches the pill selected-state design
    // already prototyped and approved before this went into the real app.
    timePill: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
      backgroundColor: colors.pillBg,
    },
    timePillActive: {
      borderColor: '#5FBE84',
      backgroundColor: '#5FBE84',
    },
    timePillText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: 'Geist-Medium',
    },
    timePillTextActive: {
      color: '#05130b',
      fontFamily: 'Geist-SemiBold',
    },
    // Standalone, not part of a row like timePill's own siblings — reuses
    // that pill's visual language (same border/fill/active treatment) since
    // it's the same "optional, tap to accept" interaction, just a single
    // choice instead of four.
    finisherPill: {
      alignSelf: 'center',
      marginTop: 12,
    },
    checkinPrimaryButtonHit: {
      marginTop: 28,
      width: 285,
      height: 38,
    },
    // Plain text, no box/border (see the "borders read as tacky" pass) —
    // deliberately quiet next to the primary button above it. Skipping
    // never touches completedExercises (see handleSkipExercise), so it
    // can't be mistaken for finishing the exercise in the completion
    // signal — this is "I'm not doing this one," not "done."
    skipExerciseHit: {
      marginTop: 14,
      paddingVertical: 4,
    },
    skipExerciseText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
      textDecorationLine: 'underline',
      textAlign: 'center',
    },
    skipConfirmBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    skipConfirmCard: {
      width: '100%',
      maxWidth: 320,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 22,
      paddingVertical: 22,
      gap: 8,
    },
    skipConfirmTitle: {
      color: colors.text,
      fontSize: 16,
      fontFamily: 'Geist-SemiBold',
      textAlign: 'center',
    },
    skipConfirmBody: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      fontFamily: 'Geist-Medium',
      textAlign: 'center',
    },
    skipConfirmActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    skipConfirmCancelHit: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: '#438C63',
      alignItems: 'center',
    },
    skipConfirmCancelText: {
      color: '#ffffff',
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    skipConfirmConfirmHit: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 14,
      alignItems: 'center',
    },
    skipConfirmConfirmText: {
      color: colors.textTertiary,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
      textDecorationLine: 'underline',
    },
    // Swap-picker sheet — same backdrop/card language as skipConfirm* above,
    // but a variable-length list rather than a fixed two-button choice, so
    // it gets its own card (bounded maxHeight + internal scroll) instead of
    // reusing skipConfirmCard's fixed-content sizing.
    swapModalCard: {
      width: '100%',
      maxWidth: 340,
      maxHeight: '72%',
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 22,
      paddingVertical: 22,
      gap: 8,
    },
    swapModalList: {
      marginTop: 4,
    },
    swapModalRow: {
      paddingVertical: 12,
    },
    swapModalRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    swapModalRowName: {
      color: colors.text,
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
    swapModalRowStat: {
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
    },
    swapModalCancelHit: {
      marginTop: 6,
      paddingVertical: 13,
      borderRadius: 14,
      alignItems: 'center',
    },
    swapModalCancelText: {
      color: colors.textTertiary,
      fontSize: 13,
      fontFamily: 'Geist-Medium',
      textDecorationLine: 'underline',
    },
    // Flow-based counterpart to title/subtitle/energyChip/exerciseCard,
    // same reasoning as checkinFlow above — this branch now needs to fit a
    // timer block whose presence/height doesn't change, but which sits
    // between two other blocks that do (deltaText's line count, the
    // exercise list's row count), so absolute pixel offsets aren't safe.
    resolvedFlow: {
      alignItems: 'center',
      paddingTop: 68,
      paddingBottom: 40,
    },
    // Was a boxed badge (2px green border, sharp corners) — the energy
    // number/label already say what was picked, so the callout-style box
    // around it was drawing more attention to "your energy is low" than
    // the low-pressure/no-badges direction the rest of this screen (and
    // app) has been moving toward. Plain text now, same as everything
    // around it.
    resolvedEnergyChip: {
      marginTop: 24,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: 6,
    },
    // "How much is left" — deliberately plain (no border/box) to match the
    // rest of this screen's low-pressure styling; only the filled track
    // itself carries color.
    exerciseProgressWrap: {
      marginTop: 18,
      width: PROGRESS_TRACK_WIDTH,
      alignItems: 'center',
      gap: 6,
    },
    exerciseProgressText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
    },
    exerciseProgressTrack: {
      width: '100%',
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.pillBg,
      overflow: 'hidden',
    },
    exerciseProgressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: '#438C63',
    },
    timerSection: {
      marginTop: 20,
      width: 325,
      alignItems: 'center',
      paddingVertical: 16,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    timerExerciseName: {
      paddingHorizontal: 20,
      color: colors.textSecondary,
      fontSize: 12.5,
      fontFamily: 'Geist-SemiBold',
    },
    timerLinksRow: {
      marginTop: 6,
      flexDirection: 'row',
      gap: 16,
    },
    timerWatchFormButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    // The timer card's own version of exerciseExpandedBody — same reasoning,
    // this is where CueContent renders when ExerciseTimer's "How to" toggle
    // is open. Left-aligned to match this card's own text, not centered
    // like the rest of the timer's contents.
    timerCueBody: {
      marginTop: 8,
      width: '100%',
      paddingHorizontal: 4,
    },
    timerWatchFormText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: 'Geist-Medium',
    },
    // Green for an active set, orange for rest — same shared brand literals
    // used elsewhere in this file (symptomChipTextActive, streak accents),
    // not new colors invented for this. Absent entirely for a single-
    // interval duration hold (see ExerciseTimer's phaseLabel) — nothing to
    // label there.
    timerPhaseLabel: {
      marginTop: 10,
      color: '#5FBE84',
      fontSize: 11,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontFamily: 'Geist-Bold',
    },
    timerPhaseLabelRest: {
      color: '#E8823C',
    },
    timerClock: {
      marginTop: 6,
      color: colors.text,
      fontSize: 34,
      letterSpacing: -0.5,
      fontFamily: 'Geist-Black',
      fontVariant: ['tabular-nums'],
    },
    timerClockRest: {
      color: '#E8823C',
    },
    timerActionRow: {
      marginTop: 8,
      flexDirection: 'row',
      gap: 8,
    },
    timerPauseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: colors.pillBg,
    },
    timerPauseText: {
      color: colors.text,
      fontSize: 11.5,
      fontFamily: 'Geist-SemiBold',
    },
    // Only ever shown next to Pause for a bypassable (discrete-reps) work
    // interval — see TimerInterval.bypassable. Same pill treatment as
    // Pause/Resume, deliberately not louder — finishing early is a normal
    // action, not a milestone the way completing the whole exercise is.
    timerDoneEarlyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: colors.pillBg,
    },
    timerDoneEarlyText: {
      color: colors.textSecondary,
      fontSize: 11.5,
      fontFamily: 'Geist-SemiBold',
    },
    // Shown instead of the pause/done-early row while awaiting the
    // explicit tap to start the next interval (rest, or the next set) —
    // same green as the app's real primary-button color (primaryButtonVisual
    // below), since this is the primary action at that moment, not a
    // secondary control like Pause.
    timerStartNextButton: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 16,
      backgroundColor: '#29563a',
    },
    timerStartNextText: {
      color: '#ffffff',
      fontSize: 12.5,
      fontFamily: 'Geist-Bold',
    },
    timerDoneText: {
      marginTop: 8,
      color: '#5FBE84',
      fontSize: 11.5,
      fontFamily: 'Geist-SemiBold',
    },
    lastPerformanceHint: {
      marginTop: 10,
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: 'Geist-Regular',
    },
    loadInputRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    loadInputLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: 'Geist-Regular',
    },
    loadInput: {
      width: 60,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 6,
      color: colors.text,
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
      textAlign: 'center',
    },
    plateToggleText: {
      color: '#438C63',
      fontSize: 11,
      fontFamily: 'Geist-SemiBold',
      textDecorationLine: 'underline',
    },
    plateBreakdownText: {
      marginTop: 6,
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: 'Geist-Medium',
    },
    resolvedExerciseCard: {
      marginTop: 16,
      width: 325,
      paddingHorizontal: 18,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    exerciseRowCurrent: {
      marginHorizontal: -18,
      paddingHorizontal: 18,
      backgroundColor: 'rgba(67,140,99,0.1)',
    },
    exerciseRowUpcoming: {
      opacity: 0.45,
    },
    restDayLinkHit: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 310,
      alignItems: 'center',
    },
    restDayLinkText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
      textDecorationLine: 'underline',
    },
    // The collapsed stand-in for the gauge once energy's locked in for the
    // day — same neobrutalist flat-block language as the trajectory bars and
    // the onboarding potential score, mood-colored border to carry the color
    // language over from the gauge itself. (Position comes from
    // resolvedEnergyChip above — this is just the shared value/label text.)
    energyChipValue: {
      color: colors.text,
      fontSize: 20,
      fontFamily: 'Geist-Black',
    },
    energyChipLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: 'Geist-SemiBold',
    },
    exerciseCardSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '30%',
      backgroundColor: colors.surfaceSheen,
    },
    exerciseLogHint: {
      paddingTop: 12,
      paddingBottom: 2,
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: 'Geist-Medium',
    },
    equipmentNote: {
      paddingTop: 10,
      paddingBottom: 12,
      color: colors.textTertiary,
      fontSize: 9.5,
      fontFamily: 'Geist-Regular',
    },
    reasoningCard: {
      marginTop: 10,
      width: 325,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    reasoningToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    reasoningToggleText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    reasoningBody: {
      paddingHorizontal: 16,
      paddingBottom: 14,
      gap: 8,
    },
    reasoningLine: {
      color: colors.textTertiary,
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Geist-Regular',
    },
    reasoningCount: {
      color: colors.textSecondary,
      fontFamily: 'Geist-SemiBold',
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
    },
    exerciseDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.surfaceDivider,
    },
    exerciseChevron: {
      marginLeft: 8,
    },
    // The expanded how-to content — sits directly below its row, inside
    // the same card. Reuses the reasoning-panel's own fade-in (see
    // reasoningBody) rather than inventing a second expand animation.
    exerciseExpandedBody: {
      paddingBottom: 12,
      paddingTop: 2,
    },
    cueLabel: {
      marginTop: 10,
      marginBottom: 3,
      color: colors.textTertiary,
      fontSize: 9.5,
      letterSpacing: 0.4,
      fontFamily: 'Geist-Medium',
    },
    cueText: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: 'Geist-Regular',
    },
    cueKeyText: {
      color: colors.text,
      fontFamily: 'Geist-Medium',
    },
    cueRegressionText: {
      marginTop: 10,
      fontStyle: 'italic',
    },
    cueSimpleText: {
      marginTop: 8,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: 'Geist-Regular',
    },
    exerciseNameRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    exerciseCheckbox: {
      width: 17,
      height: 17,
      borderRadius: 9,
      marginRight: 9,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    exerciseCheckboxDone: {
      borderColor: '#438C63',
      backgroundColor: '#438C63',
    },
    exerciseName: {
      flex: 1,
      color: colors.text,
      fontSize: 12.5,
      fontFamily: 'Geist-SemiBold',
    },
    exerciseNameDone: {
      color: colors.textTertiary,
      textDecorationLine: 'line-through',
    },
    exerciseStatBlock: {
      paddingHorizontal: 8,
      paddingVertical: 1,
      borderWidth: 1.5,
      borderRadius: 2,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.pillBg,
    },
    exerciseStatText: {
      color: colors.textSecondary,
      fontSize: 10.5,
      fontFamily: 'Geist-SemiBold',
    },
    // Was position:'absolute'/top:260 — moved to flow layout (paddingTop
    // reproduces the same visual offset) so it can live inside a
    // ScrollView's contentContainerStyle; see flowScroll's comment above.
    doneWrap: {
      alignItems: 'center',
      paddingTop: 68,
      paddingBottom: 40,
    },
    milestoneText: {
      marginTop: 4,
      color: colors.textTertiary,
      fontSize: 11,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      fontFamily: 'Geist-SemiBold',
    },
    doneTitle: {
      marginTop: 28,
      paddingHorizontal: 44,
      color: colors.text,
      fontSize: 24,
      lineHeight: 30,
      letterSpacing: -0.3,
      textAlign: 'center',
      fontFamily: 'Geist-Bold',
    },
    doneSubtitle: {
      marginTop: 8,
      paddingHorizontal: 56,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    // Deliberately quieter than doneSubtitle — an estimate, not the
    // headline of this screen (see estimateCaloriesBurned's own doc
    // comment on why this is never presented as measured).
    calorieEstimateText: {
      marginTop: 4,
      color: colors.textTertiary,
      fontSize: 11,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    doneInsightHit: {
      marginTop: 16,
      paddingHorizontal: 40,
      paddingVertical: 4,
    },
    doneInsightText: {
      color: colors.textTertiary,
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    doneInsightLink: {
      color: colors.textSecondary,
      textDecorationLine: 'underline',
      fontFamily: 'Geist-SemiBold',
    },
    feedbackSection: {
      marginTop: 28,
      width: 325,
    },
    feedbackButtonRow: {
      flexDirection: 'row',
      gap: 5,
    },
    feedbackButton: {
      flex: 1,
      minHeight: 44,
      paddingVertical: 6,
      paddingHorizontal: 2,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    feedbackButtonText: {
      color: colors.text,
      fontSize: 10,
      textAlign: 'center',
      fontFamily: 'Geist-SemiBold',
    },
    feedbackConfirmText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
    },
    noteSection: {
      marginTop: 20,
      width: 325,
    },
    noteLabel: {
      marginBottom: 8,
      color: colors.textTertiary,
      fontSize: 10.5,
      letterSpacing: 0.4,
      fontFamily: 'Geist-Medium',
    },
    noteInput: {
      minHeight: 84,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: 'Geist-Regular',
      textAlignVertical: 'top',
    },
    doneBackButton: {
      marginTop: 24,
      width: 325,
      paddingVertical: 12,
      borderRadius: 6,
      backgroundColor: '#29563a',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center',
    },
    doneBackButtonText: {
      color: '#ffffff',
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    primaryButtonVisual: {
      width: '100%',
      height: '100%',
      backgroundColor: '#29563a',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryText: {
      color: '#ffffff',
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    buttonArrow: {
      position: 'absolute',
      right: 14,
      top: 6,
      transform: [{ rotate: '90deg' }],
    },
    hoverWash: {
      borderRadius: 6,
      backgroundColor: hoverWashColor,
      zIndex: -1,
    },
  });
}
