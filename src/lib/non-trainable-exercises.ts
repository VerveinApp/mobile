// Vervein-only addition, not in the vault — same "separate, additive layer
// keyed by exercise id" shape as exercise-form-cues.ts, for the same reason:
// exercise-library.json is the vault's frozen fixture and stays untouched.
//
// The vault's Exercise schema (src/lib/engine/types.ts) has no field
// distinguishing a fitness-ASSESSMENT protocol (measure your current 1RM,
// run a timed 12-minute test, etc.) from a real trainable exercise — both
// carry the same ordinary type/intensity/equipment/body_area values, so
// nothing in the vault-ported Gate 1 filter (exercise-filtering.ts's
// passesConstraints, ported verbatim from the vault) excludes them. Left
// unaddressed, a heavily-constrained user's onboarding baseline or a daily
// gap-fill could land on "Bench Press 1RM Test" or "Cooper 12-Minute Run
// Test" as an actual assigned exercise for the day — a real product bug,
// not a vault design tradeoff, since these are one-off measurement
// protocols to run occasionally with a coach or stopwatch, not something to
// perform for sets/reps as a day's training exercise.
//
// This list was built by scanning the real exercise-library.json for names
// matching genuine assessment/test patterns (`\bTest\b`, `1RM`, `One-Rep
// Max`, `Max\)`, `Assessment`) and manually reviewing every one of the 30
// matches — not a runtime string heuristic against exercise.name, so it
// can't misfire on some future or unreviewed exercise whose name happens to
// share a word. See isTrainableExercise's callers (exercise-filtering.ts)
// for where this is actually applied.
export const NON_TRAINABLE_EXERCISE_IDS: ReadonlySet<string> = new Set([
  'ex_668', // Y-Balance Reach Test (Single-Leg)
  'ex_1206', // Beep Test (Multi-Stage Fitness Test)
  'ex_1389', // 40-Yard Dash (Sprint Test)
  'ex_1390', // Vertical Jump Test (Standing Reach)
  'ex_1391', // T-Test (Agility Test)
  'ex_1392', // Illinois Agility Test
  'ex_1393', // Sit and Reach Test (Flexibility Assessment)
  'ex_1394', // Cooper 12-Minute Run Test
  'ex_1395', // Push-Up Test (Max Reps, 1-Minute)
  'ex_1396', // Grip Strength Test (Dynamometer)
  'ex_1397', // Sit-Up Test (Max Reps, 1-Minute)
  'ex_1398', // Pull-Up Test (Max Reps)
  'ex_1399', // Wall Sit Test (Max Hold Time)
  'ex_1400', // Single-Leg Stance Test (Static Balance)
  'ex_1401', // Bench Press 1RM Test (One-Rep Max)
  'ex_1402', // Back Squat 1RM Test (One-Rep Max)
  'ex_1403', // Deadlift 1RM Test (One-Rep Max)
  'ex_1404', // Harvard Step Test
  'ex_1405', // Rockport 1-Mile Walk Test
  'ex_1406', // Yo-Yo Intermittent Recovery Test
  'ex_1416', // 30-Second Chair Stand Test
  'ex_1417', // Timed Up and Go (TUG) Test
  'ex_1419', // Knee-to-Wall Ankle Dorsiflexion Test
  'ex_1420', // Side Plank Endurance Test (Max Hold Time)
  'ex_1435', // Single-Leg Hop Test (Distance)
  'ex_1436', // Triple Hop Test (Distance)
  'ex_1437', // Crossover Hop Test (Distance)
  'ex_1505', // Y-Balance Test (Lower Quarter)
  'ex_1509', // Diastasis Recti Check (Self-Assessment)
  'ex_1541', // Sitting-Rising Test (Floor-to-Stand)
]);

export function isTrainableExercise(exerciseId: string): boolean {
  return !NON_TRAINABLE_EXERCISE_IDS.has(exerciseId);
}
