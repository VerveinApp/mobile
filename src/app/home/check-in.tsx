import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { openBrowserAsync } from 'expo-web-browser';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { getCalibration, submitSessionFeedback } from '@/lib/calibration';
import { getLastCheckIn, recordCheckIn, type CheckInRecord } from '@/lib/check-in-history';
import { recordDecisionTrace } from '@/lib/decision-trace-log';
import { TAG_LINES } from '@/lib/engine/explanation-string';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import type { FeedbackResponse, UserCalibration } from '@/lib/engine/types';
import { formatTimerClock, getExerciseTimerSeconds } from '@/lib/exercise-timer';
import { hapticImpactLight, hapticSelect, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { getPostSessionNote } from '@/lib/momentum';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview, type PlanExercise } from '@/lib/plan-preview';
import { getTrainingState } from '@/lib/training-state';
import type { TrainingState } from '@/lib/engine/training-state';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { exerciseLibrary } from '@/lib/engine/exercise-library';
import {
  getSessionFeedback,
  getSessionNote,
  recordSessionCompletion,
  saveSessionFeedback,
  saveSessionNote,
} from '@/lib/session-history';
import { SYMPTOM_TAG_LABELS, SYMPTOM_TAGS } from '@/lib/symptom-tags';
import { getTodaySession, saveTodaySession } from '@/lib/today-session';
import { getProfile, type UserProfile } from '@/lib/user-profile';
import { saveWorkoutLog } from '@/lib/workout-log';
import { localDateStr } from '@/lib/local-date';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { ENERGY_LABELS, EnergyGauge, type EnergyScore } from '@/components/home/energy-gauge';
import { SuccessCheckmark } from '@/components/onboarding/success-checkmark';
import { useAppTheme } from '@/lib/theme-context';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;
const CROSS_FADE_MS = 180;

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// The only calibration signal this app collects (M14-lite) — confirms what
// actually happened, since the multiplier itself only shows up in a future
// session's explanation line, never retroactively on this one.
const FEEDBACK_CONFIRM_TEXT: Record<FeedbackResponse, string> = {
  too_easy: "Noted — tomorrow's session nudges up slightly.",
  just_right: 'Noted — keeping things as they are.',
  too_hard: "Noted — tomorrow's session eases back slightly.",
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

  const [energy, setEnergy] = useState<EnergyScore | null>(null);
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
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  // The post-session reflection note — starts empty for a freshly finished
  // session, prefilled from storage below if reopening an already-done day.
  const [noteText, setNoteText] = useState('');
  const [calibration, setCalibration] = useState<UserCalibration | null>(null);
  const [trainingState, setTrainingState] = useState<TrainingState | null>(null);
  // The one post-session question (M14-lite) — null until the user taps one
  // of the three buttons, then locked to whatever they picked (real feedback
  // isn't editable after the fact any more than the session itself is).
  const [feedbackGiven, setFeedbackGiven] = useState<FeedbackResponse | null>(null);
  // Symptom tags picked on the check-in screen (M2/M5's real acute-tag
  // input) — only editable here, in the 'checkin' branch; once "Start
  // session" is tapped it's fixed for the day, same as energy itself.
  const [symptomTags, setSymptomTags] = useState<Set<string>>(new Set());
  // The post-session counterpart to Home's weekly recap — same "only ever
  // earned, never a streak" rule.
  const [postSessionNote, setPostSessionNote] = useState<string | null>(null);
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
  };

  useEffect(() => {
    (async () => {
      const [loadedProfile, loadedLastCheckIn, loadedTodaySession, loadedCalibration, loadedTrainingState] =
        await Promise.all([getProfile(), getLastCheckIn(), getTodaySession(), getCalibration(), getTrainingState()]);
      setProfile(loadedProfile);
      setLastCheckIn(loadedLastCheckIn);
      setCalibration(loadedCalibration);
      setTrainingState(loadedTrainingState);
      if (loadedTodaySession) {
        setEnergy(loadedTodaySession.energy);
        setSessionState(loadedTodaySession.completed ? 'done' : 'resolved');
        // Restored regardless of completed/resolved — this feeds preview's
        // computation either way, not just the done-screen display fields.
        setSymptomTags(new Set(loadedTodaySession.symptomTags));
        if (loadedTodaySession.completed) {
          const [existingNote, existingFeedback] = await Promise.all([
            getSessionNote(localDateStr()),
            getSessionFeedback(localDateStr()),
          ]);
          if (existingNote) setNoteText(existingNote);
          if (existingFeedback) setFeedbackGiven(existingFeedback);
          setPostSessionNote(getPostSessionNote(loadedTodaySession.energy));
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
  const ctaHover = useHoverFade();
  const ctaPress = useLiquidPress();
  const finishHover = useHoverFade();
  const finishPress = useLiquidPress();

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
            trainingState ?? undefined
          )
        : null,
    [profile, energy, calibration, symptomTags, trainingState]
  );
  // The baseline ("Good") session — comparing against it is what makes the
  // adaptation legible on the resolved view, not just implied by a sentence.
  // Symptom tags are held constant against `preview` (only energy differs)
  // so the delta below isolates the energy effect, not a symptom effect too.
  const baseline = useMemo(
    () =>
      computePlanPreview(
        profile ?? {},
        4,
        calibration ?? { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION },
        Array.from(symptomTags)
      ),
    [profile, calibration, symptomTags]
  );
  const exerciseDelta = preview ? baseline.exerciseCount - preview.exerciseCount : 0;
  const deltaText =
    preview && energy !== null
      ? preview.trace.fallbackFired && preview.trace.fallbackTrigger
        ? FALLBACK_TRIGGER_TEXT[preview.trace.fallbackTrigger]
        : exerciseDelta > 0
          ? `${exerciseDelta} exercise${exerciseDelta === 1 ? '' : 's'} trimmed — ${ENERGY_LABELS[energy].toLowerCase()} energy today.`
          : exerciseDelta < 0
            ? `${-exerciseDelta} extra exercise${-exerciseDelta === 1 ? '' : 's'} — pushing further today.`
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
    energy !== null && lastCheckIn
      ? energy === lastCheckIn.energy
        ? 'Same as last time.'
        : energy > lastCheckIn.energy
          ? 'Better than last time.'
          : 'Lower than last time.'
      : null;

  const currentExercise = preview?.exercises[currentExerciseIndex] ?? null;
  const isLastExercise = preview ? currentExerciseIndex >= preview.exercises.length - 1 : false;
  // Derived, not separately tracked — completedExercises is already the
  // real source of truth for "is this one done," so there's no second copy
  // of that fact to keep in sync (and no reset-on-exercise-change effect
  // needed for it either).
  const currentExerciseTimerDone = currentExercise ? completedExercises.has(currentExercise.name) : false;

  // Called by ExerciseTimer's own effect when its countdown reaches 0 — a
  // plain callback, not itself inside an effect here, so setState here is
  // exactly the ordinary "handle a child's event" case, not the "derive
  // state from a dependency" one the set-state-in-effect rule is about.
  const handleExerciseTimerComplete = (exerciseName: string) => {
    hapticSuccess();
    setCompletedExercises((prev) => new Set(prev).add(exerciseName));
  };

  const handleNextExercise = () => {
    if (!currentExerciseTimerDone) return; // still gated — button should already be disabled, this is the safety check
    hapticImpactLight();
    setCurrentExerciseIndex((i) => i + 1);
  };

  const handleStartSession = () => {
    if (energy === null) return;
    setCurrentExerciseIndex(0);
    if (energy === 1) hapticWarning();
    else if (energy === 5) hapticSuccess();
    else hapticImpactLight();
    recordCheckIn(energy);
    saveTodaySession(energy, false, Array.from(symptomTags));
    setSessionState('resolved');
  };

  const handleFinishSession = async () => {
    if (energy === null || !preview || !currentExerciseTimerDone) return;
    hapticSuccess();
    // Re-passes the same tags picked at Start — saveTodaySession replaces
    // the whole record each call, so omitting this would silently wipe them.
    saveTodaySession(energy, true, Array.from(symptomTags));
    await recordSessionCompletion(true, energy);
    setPostSessionNote(getPostSessionNote(energy));
    saveWorkoutLog(
      localDateStr(),
      preview.exercises.map((exercise) => ({
        name: exercise.name,
        bodyArea: exercise.bodyArea,
        completed: completedExercises.has(exercise.name),
      }))
    );
    recordDecisionTrace(localDateStr(), preview.trace);
    setSessionState('done');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <View style={styles.logoMark} pointerEvents="none">
          <View style={styles.logoAccent}>
            <LogoMarkAccentGraphic width={67.98} height={78.47} color={colors.text} />
          </View>
          <View style={styles.logoCheck}>
            <LogoMarkGraphic width={50.99} height={67.13} color={colors.text} />
          </View>
        </View>

        {showRestDay ? (
          <ReanimatedAnimated.View
            key="rest-day"
            entering={FadeIn.duration(CROSS_FADE_MS)}
            exiting={FadeOut.duration(CROSS_FADE_MS)}
          >
            <Text style={styles.title} maxFontSizeMultiplier={1.3}>Rest day</Text>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
              No session scheduled today — recovery is part of the plan.
            </Text>

            <Pressable style={styles.restDayLinkHit} onPress={() => setShowAnyway(true)} hitSlop={12}>
              <ReanimatedAnimated.Text
                style={[styles.restDayLinkText, restLinkAnimatedStyle]}
                maxFontSizeMultiplier={1.3}
              >
                Check in anyway
              </ReanimatedAnimated.Text>
            </Pressable>
          </ReanimatedAnimated.View>
        ) : sessionState === 'checkin' ? (
          <ReanimatedAnimated.View
            key="check-in"
            entering={FadeIn.duration(CROSS_FADE_MS)}
            exiting={FadeOut.duration(CROSS_FADE_MS)}
            style={styles.checkinFlow}
          >
            <Text style={styles.checkinTitle} maxFontSizeMultiplier={1.3}>
              {"How's your "}
              <Text style={styles.titleAccent}>energy</Text>
              {' today?'}
            </Text>
            <Text style={styles.checkinSubtitle} maxFontSizeMultiplier={1.4}>Your plan adapts to what you tell it.</Text>

            <View style={styles.checkinGaugeWrap}>
              <EnergyGauge
                size={260}
                canvasScale={scale}
                value={energy}
                onChange={handleEnergyChange}
                previousValue={lastCheckIn?.energy ?? null}
              />
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

            {energy !== null && energy <= 2 ? (
              <View style={styles.symptomSection}>
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
          </ReanimatedAnimated.View>
        ) : sessionState === 'resolved' && preview && energy !== null ? (
          <ReanimatedAnimated.View
            key="resolved"
            entering={FadeIn.duration(CROSS_FADE_MS)}
            exiting={FadeOut.duration(CROSS_FADE_MS)}
            style={styles.resolvedFlow}
          >
            <Text style={styles.checkinTitle} maxFontSizeMultiplier={1.3}>Today&apos;s session</Text>
            <Text style={styles.checkinSubtitle} maxFontSizeMultiplier={1.4}>
              {deltaText}
            </Text>

            <View style={styles.resolvedEnergyChip}>
              <Text style={styles.energyChipValue} maxFontSizeMultiplier={1.2}>
                {energy}
              </Text>
              <Text style={styles.energyChipLabel} maxFontSizeMultiplier={1.2}>
                {ENERGY_LABELS[energy]}
              </Text>
            </View>

            {currentExercise && !currentExerciseTimerDone ? (
              <ExerciseTimer
                key={currentExerciseIndex}
                exercise={currentExercise}
                onComplete={() => handleExerciseTimerComplete(currentExercise.name)}
                styles={styles}
                colors={colors}
              />
            ) : currentExercise ? (
              <View style={styles.timerSection}>
                <Text style={styles.timerExerciseName} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                  {currentExercise.name}
                </Text>
                <Text style={styles.timerDoneText} maxFontSizeMultiplier={1.2}>
                  Done — {isLastExercise ? 'finish below' : 'next exercise unlocked'}
                </Text>
              </View>
            ) : null}

            <View style={styles.resolvedExerciseCard}>
              <View pointerEvents="none" style={styles.exerciseCardSheen} />
              <Text style={styles.exerciseLogHint} maxFontSizeMultiplier={1.3}>
                One at a time — the next exercise unlocks when the timer above finishes
              </Text>
              {preview.exercises.map((exercise, index) => {
                const isDone = completedExercises.has(exercise.name);
                const isCurrent = index === currentExerciseIndex && !isDone;
                const isUpcoming = index > currentExerciseIndex;
                return (
                  <View key={exercise.name}>
                    {index > 0 ? <View style={styles.exerciseDivider} /> : null}
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
                    </View>
                  </View>
                );
              })}
              <Text style={styles.equipmentNote} maxFontSizeMultiplier={1.3}>
                {preview.equipmentNote}
              </Text>
            </View>

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

            <Pressable
              style={styles.checkinPrimaryButtonHit}
              onPress={isLastExercise ? handleFinishSession : handleNextExercise}
              disabled={!currentExerciseTimerDone}
              onHoverIn={finishHover.onHoverIn}
              onHoverOut={finishHover.onHoverOut}
              onPressIn={finishPress.onPressIn}
              onPressOut={finishPress.onPressOut}
            >
              <Animated.View
                style={[
                  styles.primaryButtonVisual,
                  !currentExerciseTimerDone && styles.primaryButtonDisabled,
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
          </ReanimatedAnimated.View>
        ) : (
          <ReanimatedAnimated.View
            key="done"
            entering={FadeIn.duration(CROSS_FADE_MS)}
            exiting={FadeOut.duration(CROSS_FADE_MS)}
            style={styles.doneWrap}
          >
            <SuccessCheckmark size={110} />
            <Text style={styles.doneTitle} maxFontSizeMultiplier={1.3}>
              Session complete
            </Text>
            <Text style={styles.doneSubtitle} maxFontSizeMultiplier={1.4}>
              {postSessionNote ?? 'Nice work. See you tomorrow.'}
            </Text>

            <View style={styles.feedbackSection}>
              <Text style={styles.noteLabel} maxFontSizeMultiplier={1.3}>
                HOW DID THAT FEEL?
              </Text>
              {feedbackGiven ? (
                <Text style={styles.feedbackConfirmText} maxFontSizeMultiplier={1.3}>
                  {FEEDBACK_CONFIRM_TEXT[feedbackGiven]}
                </Text>
              ) : (
                <View style={styles.feedbackButtonRow}>
                  <Pressable style={styles.feedbackButton} onPress={() => handleSubmitFeedback('too_easy')}>
                    <Text style={styles.feedbackButtonText} maxFontSizeMultiplier={1.2}>Too easy</Text>
                  </Pressable>
                  <Pressable style={styles.feedbackButton} onPress={() => handleSubmitFeedback('just_right')}>
                    <Text style={styles.feedbackButtonText} maxFontSizeMultiplier={1.2}>Just right</Text>
                  </Pressable>
                  <Pressable style={styles.feedbackButton} onPress={() => handleSubmitFeedback('too_hard')}>
                    <Text style={styles.feedbackButtonText} maxFontSizeMultiplier={1.2}>Too hard</Text>
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

            <Pressable style={styles.doneBackButton} onPress={handleBackToHome} hitSlop={8}>
              <Text style={styles.doneBackButtonText} maxFontSizeMultiplier={1.2}>Back to Home</Text>
            </Pressable>
          </ReanimatedAnimated.View>
        )}
      </ReanimatedAnimated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * The guided countdown for a single exercise — deliberately its own
 * component, keyed by exercise index from the parent, rather than timer
 * state living in EnergyCheckInScreen with an effect to reset it on every
 * exercise change. Switching exercises remounts this with a fresh
 * `useState(() => getExerciseTimerSeconds(exercise))` instead, which is the
 * React-recommended way to reset state on a prop change — no "sync state to
 * a dependency" effect needed, and it's what keeps the tick/completion
 * effects below clean (setState only ever happens inside a timeout
 * callback or via the onComplete prop, never synchronously in an effect
 * body).
 */
function ExerciseTimer({
  exercise,
  onComplete,
  styles,
  colors,
}: {
  exercise: PlanExercise;
  onComplete: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => getExerciseTimerSeconds(exercise));
  const [active, setActive] = useState(true);

  // The tick — a chained setTimeout keyed on secondsLeft itself (rather
  // than a single setInterval) so it can't drift and self-corrects every
  // render; setState happens inside the timeout callback, not the effect
  // body itself.
  useEffect(() => {
    if (!active || secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [active, secondsLeft]);

  // Notifies the parent exactly once, the moment the countdown reaches 0 —
  // calling a prop function from an effect (not this component's own
  // setState) is the standard "tell my parent something happened" pattern.
  useEffect(() => {
    if (secondsLeft === 0) onComplete();
  }, [secondsLeft, onComplete]);

  const togglePause = () => {
    hapticSelect();
    setActive((a) => !a);
  };

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
    <View style={styles.timerSection}>
      <Text style={styles.timerExerciseName} maxFontSizeMultiplier={1.2} numberOfLines={1}>
        {exercise.name}
      </Text>
      <Pressable style={styles.timerWatchFormButton} onPress={handleWatchForm} hitSlop={8}>
        <SymbolView name="play.rectangle" size={12} tintColor={colors.textSecondary} />
        <Text style={styles.timerWatchFormText} maxFontSizeMultiplier={1.2}>
          Watch form
        </Text>
      </Pressable>
      <Text style={styles.timerClock} maxFontSizeMultiplier={1.1}>
        {formatTimerClock(secondsLeft)}
      </Text>
      {secondsLeft > 0 ? (
        <Pressable style={styles.timerPauseButton} onPress={togglePause} hitSlop={8}>
          <SymbolView name={active ? 'pause.fill' : 'play.fill'} size={12} tintColor={colors.text} />
          <Text style={styles.timerPauseText} maxFontSizeMultiplier={1.2}>
            {active ? 'Pause' : 'Resume'}
          </Text>
        </Pressable>
      ) : null}
    </View>
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
    logoMark: {
      position: 'absolute',
      left: 134.25,
      top: 68,
      width: 106.5,
      height: 88.37,
    },
    logoAccent: {
      position: 'absolute',
      left: 0,
      top: 9.92,
    },
    logoCheck: {
      position: 'absolute',
      left: 55.52,
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
    checkinFlow: {
      alignItems: 'center',
      paddingTop: 180,
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
    checkinPrimaryButtonHit: {
      marginTop: 28,
      width: 285,
      height: 38,
    },
    // Flow-based counterpart to title/subtitle/energyChip/exerciseCard,
    // same reasoning as checkinFlow above — this branch now needs to fit a
    // timer block whose presence/height doesn't change, but which sits
    // between two other blocks that do (deltaText's line count, the
    // exercise list's row count), so absolute pixel offsets aren't safe.
    resolvedFlow: {
      alignItems: 'center',
      paddingTop: 180,
    },
    // Fixed border color, not mood-dependent — brand elements shouldn't
    // change with user state, only content does (the number/label inside
    // already say what energy was picked; the chip's own color doesn't
    // need to repeat that). The gauge's 5-color dial is a different case
    // (a fixed, always-present legend showing all 5 positions at once, not
    // a single element whose own appearance shifts with state) and is
    // unaffected by this.
    resolvedEnergyChip: {
      marginTop: 24,
      alignSelf: 'center',
      width: 100,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 6,
      borderWidth: 2,
      borderColor: '#438C63',
      borderRadius: 2,
      backgroundColor: colors.pillBg,
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
    timerWatchFormButton: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    timerWatchFormText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: 'Geist-Medium',
    },
    timerClock: {
      marginTop: 6,
      color: colors.text,
      fontSize: 34,
      letterSpacing: -0.5,
      fontFamily: 'Geist-Black',
      fontVariant: ['tabular-nums'],
    },
    timerPauseButton: {
      marginTop: 8,
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
    timerDoneText: {
      marginTop: 8,
      color: '#5FBE84',
      fontSize: 11.5,
      fontFamily: 'Geist-SemiBold',
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
    doneWrap: {
      left: 0,
      right: 0,
      top: 260,
      position: 'absolute',
      alignItems: 'center',
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
    feedbackSection: {
      marginTop: 28,
      width: 325,
    },
    feedbackButtonRow: {
      flexDirection: 'row',
      gap: 8,
    },
    feedbackButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    feedbackButtonText: {
      color: colors.text,
      fontSize: 11.5,
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
