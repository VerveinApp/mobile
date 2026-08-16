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

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { getCalibration, submitSessionFeedback } from '@/lib/calibration';
import { getLastCheckIn, recordCheckIn, type CheckInRecord } from '@/lib/check-in-history';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import type { FeedbackResponse, UserCalibration } from '@/lib/engine/types';
import { hapticImpactLight, hapticSelect, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import { useFadeInEntering } from '@/lib/screen-transitions';
import {
  getSessionFeedback,
  getSessionNote,
  recordSessionCompletion,
  saveSessionFeedback,
  saveSessionNote,
} from '@/lib/session-history';
import { getTodaySession, saveTodaySession } from '@/lib/today-session';
import { getProfile, type UserProfile } from '@/lib/user-profile';
import { saveWorkoutLog } from '@/lib/workout-log';
import { localDateStr } from '@/lib/local-date';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { ENERGY_LABELS, EnergyGauge, MOOD_COLORS, type EnergyScore } from '@/components/home/energy-gauge';
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
  // The one post-session question (M14-lite) — null until the user taps one
  // of the three buttons, then locked to whatever they picked (real feedback
  // isn't editable after the fact any more than the session itself is).
  const [feedbackGiven, setFeedbackGiven] = useState<FeedbackResponse | null>(null);

  const toggleExerciseDone = (name: string) => {
    hapticSelect();
    setCompletedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  useEffect(() => {
    (async () => {
      const [loadedProfile, loadedLastCheckIn, loadedTodaySession, loadedCalibration] = await Promise.all([
        getProfile(),
        getLastCheckIn(),
        getTodaySession(),
        getCalibration(),
      ]);
      setProfile(loadedProfile);
      setLastCheckIn(loadedLastCheckIn);
      setCalibration(loadedCalibration);
      if (loadedTodaySession) {
        setEnergy(loadedTodaySession.energy);
        setSessionState(loadedTodaySession.completed ? 'done' : 'resolved');
        if (loadedTodaySession.completed) {
          const [existingNote, existingFeedback] = await Promise.all([
            getSessionNote(localDateStr()),
            getSessionFeedback(localDateStr()),
          ]);
          if (existingNote) setNoteText(existingNote);
          if (existingFeedback) setFeedbackGiven(existingFeedback);
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
        ? computePlanPreview(profile ?? {}, energy, calibration ?? { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION })
        : null,
    [profile, energy, calibration]
  );
  // The baseline ("Good") session — comparing against it is what makes the
  // adaptation legible on the resolved view, not just implied by a sentence.
  const baseline = useMemo(
    () => computePlanPreview(profile ?? {}, 4, calibration ?? { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION }),
    [profile, calibration]
  );
  const exerciseDelta = preview ? baseline.exerciseCount - preview.exerciseCount : 0;
  const deltaText =
    preview && energy !== null
      ? exerciseDelta > 0
        ? `${exerciseDelta} exercise${exerciseDelta === 1 ? '' : 's'} trimmed — ${ENERGY_LABELS[energy].toLowerCase()} energy today.`
        : exerciseDelta < 0
          ? `${-exerciseDelta} extra exercise${-exerciseDelta === 1 ? '' : 's'} — pushing further today.`
          : 'Standard session today.'
      : null;
  const comparisonText =
    energy !== null && lastCheckIn
      ? energy === lastCheckIn.energy
        ? 'Same as last time.'
        : energy > lastCheckIn.energy
          ? 'Better than last time.'
          : 'Lower than last time.'
      : null;

  const handleStartSession = () => {
    if (energy === null) return;
    if (energy === 1) hapticWarning();
    else if (energy === 5) hapticSuccess();
    else hapticImpactLight();
    recordCheckIn(energy);
    saveTodaySession(energy, false);
    setSessionState('resolved');
  };

  const handleFinishSession = () => {
    if (energy === null || !preview) return;
    hapticSuccess();
    saveTodaySession(energy, true);
    recordSessionCompletion(true, energy);
    saveWorkoutLog(
      localDateStr(),
      preview.exercises.map((exercise) => ({
        name: exercise.name,
        bodyArea: exercise.bodyArea,
        completed: completedExercises.has(exercise.name),
      }))
    );
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
          >
            <Text style={styles.title} maxFontSizeMultiplier={1.3}>
              {"How's your "}
              <Text style={styles.titleAccent}>energy</Text>
              {' today?'}
            </Text>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>Your plan adapts to what you tell it.</Text>

            <View style={styles.gaugeWrap}>
              <EnergyGauge
                size={260}
                canvasScale={scale}
                value={energy}
                onChange={setEnergy}
                previousValue={lastCheckIn?.energy ?? null}
              />
            </View>

            {preview ? (
              <ReanimatedAnimated.View key={energy} entering={FadeIn.duration(220)} style={styles.explanationBlock}>
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

            <Pressable
              style={styles.primaryButtonHit}
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
          >
            <Text style={styles.title} maxFontSizeMultiplier={1.3}>Today&apos;s session</Text>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
              {deltaText}
            </Text>

            <View style={[styles.energyChip, { borderColor: MOOD_COLORS[energy] }]}>
              <Text style={styles.energyChipValue} maxFontSizeMultiplier={1.2}>
                {energy}
              </Text>
              <Text style={styles.energyChipLabel} maxFontSizeMultiplier={1.2}>
                {ENERGY_LABELS[energy]}
              </Text>
            </View>

            <View style={styles.exerciseCard}>
              <View pointerEvents="none" style={styles.exerciseCardSheen} />
              <Text style={styles.exerciseLogHint} maxFontSizeMultiplier={1.3}>
                Tap an exercise as you complete it
              </Text>
              {preview.exercises.map((exercise, index) => {
                const isDone = completedExercises.has(exercise.name);
                return (
                  <View key={exercise.name}>
                    {index > 0 ? <View style={styles.exerciseDivider} /> : null}
                    <Pressable
                      style={styles.exerciseRow}
                      onPress={() => toggleExerciseDone(exercise.name)}
                      hitSlop={4}
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
                    </Pressable>
                  </View>
                );
              })}
              <Text style={styles.equipmentNote} maxFontSizeMultiplier={1.3}>
                {preview.equipmentNote}
              </Text>
            </View>

            <Pressable
              style={styles.primaryButtonHit}
              onPress={handleFinishSession}
              onHoverIn={finishHover.onHoverIn}
              onHoverOut={finishHover.onHoverOut}
              onPressIn={finishPress.onPressIn}
              onPressOut={finishPress.onPressOut}
            >
              <Animated.View style={[styles.primaryButtonVisual, { transform: [{ scale: finishPress.scale }] }]}>
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
                <Text style={styles.primaryText} maxFontSizeMultiplier={1.15}>Finish session</Text>
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
              Nice work. See you tomorrow.
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
          </ReanimatedAnimated.View>
        )}
      </ReanimatedAnimated.View>
      </View>
    </KeyboardAvoidingView>
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
    // language over from the gauge itself.
    energyChip: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 288,
      alignSelf: 'center',
      width: 100,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 6,
      borderWidth: 2,
      borderRadius: 2,
      backgroundColor: colors.pillBg,
    },
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
    exerciseCard: {
      position: 'absolute',
      left: 25,
      top: 344,
      width: 325,
      paddingHorizontal: 18,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
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
    primaryButtonHit: {
      position: 'absolute',
      left: 46,
      top: 656,
      width: 285,
      height: 38,
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
