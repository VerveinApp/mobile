// Vervein-only form-cue content for the exercise library. Not part of the
// ported vault engine — exercise-library.json is the vault's frozen
// fixture and has no cue/description field, and stays untouched; this is
// a separate, additive layer keyed by exercise id, so exercise-library.ts's
// "byte-for-byte" claim about that fixture stays true.
//
// Two tiers, matching the writing spec: FORM_CUES (below) is the full
// 4-part breakdown for `complexity:'moderate'` exercises — where the app
// has no visual demo at all (see the complexity-bias work in
// baseline-plan.ts / exercise-filtering.ts, which routes true beginners
// toward `complexity:'simple'` exercises for exactly this reason), this
// text is the entire demonstration for anything still moderate, whether
// shown to a non-beginner by default or to a beginner when the constraint
// stack leaves nothing simpler. SIMPLE_CUES (further below) is a one-line
// confirming cue per `complexity:'simple'` exercise — the name already
// conveys those movements, so a full breakdown would clutter the screen.
//
// Coverage: a large majority of the library now — well past halfway across
// both tiers, spanning every major movement pattern, equipment type, and
// skill level, but not yet literally every exercise (~929 moderate, ~520
// simple total). Writing every single one at this level of care in one pass
// isn't realistic without becoming templated; this is the format and
// quality bar to extend from, exercise by exercise.

export type FormCue = {
  /** Where the body begins — concrete enough to assemble from zero. */
  startingPosition: string;
  /** What moves, and the path it travels. Verb-first. */
  movement: string;
  /** The single cue that prevents the most common mistake or injury. Show this first if there's real injury risk. */
  keyCue: string;
  /** The target sensation — how to self-correct without a mirror or coach. */
  feelIt: string;
  /** An easier variant, only included when the exercise is genuinely hard. */
  regression?: string;
};

export const FORM_CUES: Record<string, FormCue> = {
  // Barbell Back Squat — squat
  ex_101: {
    startingPosition: 'Stand with feet shoulder-width apart, bar resting across the top of your shoulders, held in place with both hands.',
    movement: 'Push your hips back and bend your knees to lower down, keeping your chest up, until your thighs are at least parallel to the floor, then drive through your heels to stand back up.',
    keyCue: 'Knees track out over your toes the whole way down — don’t let them cave inward.',
    feelIt: 'You should feel this in your quads and glutes, not your lower back or knees.',
    regression: 'If this is too much, try a goblet squat with a dumbbell held at your chest instead — same movement, lighter and easier to control.',
  },
  // Conventional Deadlift (Barbell) — hinge
  ex_103: {
    startingPosition: 'Stand with feet hip-width apart, bar over your midfoot, and bend down to grip it just outside your knees.',
    movement: 'Stand up by pushing the floor away with your legs and driving your hips forward, keeping the bar close to your shins the whole way up.',
    keyCue: 'Your back stays flat from start to finish — it never rounds, even a little.',
    feelIt: 'You should feel this in your hamstrings and glutes, not a strain in your lower back.',
    regression: 'If it’s too much load or too hard to keep your back flat, try a Romanian deadlift with dumbbells instead — smaller range of motion, easier to control.',
  },
  // Flat Barbell Bench Press — push
  ex_106: {
    startingPosition: 'Lie on the bench with your eyes under the bar, feet flat on the floor, and grip the bar slightly wider than shoulder-width.',
    movement: 'Lower the bar slowly to your mid-chest, then press it back up until your arms are straight.',
    keyCue: 'Keep your elbows at roughly a 45-degree angle to your body, not flared straight out to the sides.',
    feelIt: 'You should feel this across your chest and the front of your shoulders, not a pinch in your shoulder joints.',
    regression: 'If this is too much, try a push-up instead — same pressing pattern, uses your bodyweight so it’s easier to control.',
  },
  // Standing Barbell Overhead Press — overhead
  ex_105: {
    startingPosition: 'Stand with feet hip-width apart, bar resting at your collarbones, hands just outside shoulder-width.',
    movement: 'Press the bar straight up overhead until your arms are fully extended, then lower it back to your collarbones with control.',
    keyCue: 'Keep your ribs pulled down and don’t arch your lower back to get the bar up.',
    feelIt: 'You should feel this in your shoulders and triceps, not a strain in your lower back.',
    regression: 'If this is too much, try a seated dumbbell press instead — the bench supports your back so it’s harder to compensate with an arch.',
  },
  // Pull-Up — pull
  ex_205: {
    startingPosition: 'Hang from the bar with your arms fully straight, hands slightly wider than shoulder-width, palms facing away from you.',
    movement: 'Pull yourself up by driving your elbows down toward your hips until your chin clears the bar, then lower back down with control.',
    keyCue: 'Keep your body still and controlled — don’t swing or kick your legs to get momentum.',
    feelIt: 'You should feel this in your back and biceps, not a strain in your shoulders.',
    regression: 'If this is too much, try an assisted pull-up with a resistance band looped under your feet, or a lat pulldown instead.',
  },
  // Bent-Over Barbell Row — pull
  ex_107: {
    startingPosition: 'Stand with feet hip-width apart, hinge forward from your hips until your torso is close to parallel with the floor, and hold the bar with both hands, arms hanging straight down.',
    movement: 'Pull the bar up toward your lower stomach by driving your elbows back, then lower it back down with control.',
    keyCue: 'Keep your back flat and your torso still — don’t round your spine or jerk the weight up.',
    feelIt: 'You should feel this in your upper back and lats, not your lower back.',
    regression: 'If holding the hinged position is too hard, try a chest-supported row on an incline bench instead — it takes your lower back out of the equation.',
  },
  // Romanian Deadlift (Barbell) — hinge
  ex_104: {
    startingPosition: 'Stand holding the bar at your thighs, feet hip-width apart, with a slight bend in your knees.',
    movement: 'Push your hips straight back while lowering the bar down your legs, keeping it close to your body, until you feel a deep stretch in your hamstrings, then drive your hips forward to stand back up.',
    keyCue: 'Your back stays flat the entire time — it never rounds as you lower the bar.',
    feelIt: 'You should feel a deep stretch in your hamstrings, not your lower back.',
    regression: 'If it’s hard to keep your back flat through the full range, only lower the bar as far as you can control — a shorter range with good form beats a deeper one that rounds your back.',
  },
  // Walking Lunge (Bodyweight) — squat (lunge)
  ex_121: {
    startingPosition: 'Stand tall with your feet together and hands on your hips or holding light weights at your sides.',
    movement: 'Step forward into a long stride and lower your body until both knees are bent to about 90 degrees, then push off your front foot to bring your back leg forward into the next step.',
    keyCue: 'Your front knee stays lined up over your ankle — it doesn’t drift forward past your toes or collapse inward.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If balance is the issue, try a stationary reverse lunge instead — you step back to one spot instead of walking forward, which is easier to control.',
  },
  // Front Squat (Barbell) — squat
  ex_167: {
    startingPosition: 'Rest the bar across the front of your shoulders, elbows lifted high and pointing forward, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Keep your elbows up the whole time — if they drop, the bar rolls forward and you lose the rack position.',
    feelIt: 'You should feel this in your quads and upper back, not your wrists or lower back.',
    regression: 'If keeping your elbows up is hard, try a goblet squat instead — same squat pattern, easier to hold.',
  },
  // Sumo Deadlift (Barbell) — hinge
  ex_173: {
    startingPosition: 'Stand with feet wider than shoulder-width, toes turned out, and grip the bar with hands inside your knees.',
    movement: 'Stand up by pushing the floor away and driving your hips forward, keeping the bar close to your body the whole way up.',
    keyCue: 'Keep your back flat and your knees pushed out in line with your toes — don’t let them cave inward.',
    feelIt: 'You should feel this in your glutes and inner thighs, not your lower back or knees.',
    regression: 'If this is too much load, try a Romanian deadlift with dumbbells instead — smaller range of motion, easier to control.',
  },
  // Incline Barbell Bench Press — push
  ex_158: {
    startingPosition: 'Lie back on an inclined bench with your eyes under the bar, feet flat on the floor, and grip the bar slightly wider than shoulder-width.',
    movement: 'Lower the bar slowly to your upper chest, then press it back up until your arms are straight.',
    keyCue: 'Keep your elbows at roughly a 45-degree angle to your body, not flared straight out to the sides.',
    feelIt: 'You should feel this in your upper chest and shoulders, not a pinch in your shoulder joints.',
    regression: 'If this is too much, try an incline push-up instead — same angle, uses your bodyweight so it’s easier to control.',
  },
  // Barbell Hip Thrust — hinge
  ex_169: {
    startingPosition: 'Sit on the ground with your upper back against a bench, a bar resting across your hips, feet flat and knees bent.',
    movement: 'Drive your hips straight up until your body forms a straight line from shoulders to knees, then lower back down with control.',
    keyCue: 'Keep your chin tucked and your eyes forward — don’t crank your neck back to look up as you thrust.',
    feelIt: 'You should feel this in your glutes, not your lower back.',
    regression: 'If the bar is too much, try a bodyweight glute bridge instead — same movement, no added load.',
  },
  // Bulgarian Split Squat (Dumbbell) — squat, unilateral
  ex_120: {
    startingPosition: 'Stand a couple feet in front of a bench, rest one foot behind you on top of it, and hold a dumbbell in each hand.',
    movement: 'Lower your back knee straight down toward the floor by bending your front leg, then push through your front foot to stand back up.',
    keyCue: 'Your front knee stays lined up over your ankle — it doesn’t drift forward past your toes.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If balance is the issue, try it without weights first, holding onto something for support.',
  },
  // Chin-Up — pull
  ex_206: {
    startingPosition: 'Hang from the bar with your arms fully straight, hands shoulder-width apart, palms facing toward you.',
    movement: 'Pull yourself up by driving your elbows down toward your hips until your chin clears the bar, then lower back down with control.',
    keyCue: 'Keep your body still and controlled — don’t swing or kick your legs to get momentum.',
    feelIt: 'You should feel this in your back and biceps, not a strain in your shoulders.',
    regression: 'If this is too much, try an assisted chin-up with a resistance band looped under your feet, or a lat pulldown instead.',
  },
  // Seated Cable Row (Wide Grip) — pull
  ex_510: {
    startingPosition: 'Sit at the cable row station with knees slightly bent, feet braced on the platform, and grip the wide handle with arms extended.',
    movement: 'Pull the handle toward your stomach by driving your elbows back, keeping your torso upright, then extend back out with control.',
    keyCue: 'Keep your torso still — don’t rock backward and forward to help pull the weight.',
    feelIt: 'You should feel this in your upper back, not your lower back or arms.',
    regression: 'If keeping your torso still is hard, try a lighter weight until you can do it with good control.',
  },
  // Kettlebell Swing (Two-Handed, Hardstyle) — hinge, power
  ex_266: {
    startingPosition: 'Stand with feet shoulder-width apart, kettlebell on the floor a short reach in front of you.',
    movement: 'Hinge at your hips to grab the bell, then snap your hips forward hard to swing it up to chest height, letting your arms just guide it.',
    keyCue: 'This is a hip snap, not a squat and not an arm lift — your arms should stay relaxed the whole time.',
    feelIt: 'You should feel this in your glutes and hamstrings from the hip snap, not your shoulders or lower back.',
    regression: 'If the hip-hinge timing feels off, practice the hinge alone first without the kettlebell until it feels natural.',
  },
  // Turkish Get-Up — full body, multi-stage
  ex_416: {
    startingPosition: 'Lie on your back holding a light weight straight up over one shoulder, that same-side knee bent with your foot flat on the floor.',
    movement: 'Keeping your arm locked straight overhead the entire time, push through your foot and opposite elbow to sit up, then work your way up to standing.',
    keyCue: 'Keep your eyes on the weight overhead the whole way up — if you lose sight of it, you’ve lost the position.',
    feelIt: 'You should feel this as full-body control and balance, not a strain in your shoulder.',
    regression: 'If this is too much, break it into pieces first — just practice getting from lying to sitting while holding the weight up, before adding the rest.',
  },
  // Box Jump — squat/jump, power
  ex_263: {
    startingPosition: 'Stand facing a sturdy box with feet shoulder-width apart, a comfortable distance away.',
    movement: 'Swing your arms back, bend your knees, then jump up and land softly on top of the box with both feet, knees slightly bent.',
    keyCue: 'Land soft and quiet, knees bent to absorb the impact — never land with straight, locked knees.',
    feelIt: 'You should feel this in your glutes and thighs from absorbing the landing, not a jolt in your knees.',
    regression: 'If this feels risky, try a step-up onto the box instead — same height gain, no jumping or landing impact.',
  },
  // Bird Dog — core, plank pattern
  ex_137: {
    startingPosition: 'Start on your hands and knees, hands under your shoulders and knees under your hips.',
    movement: 'Reach one arm straight forward and extend the opposite leg straight back at the same time, then return and switch sides.',
    keyCue: 'Keep your hips level and facing the floor — don’t let them rotate open as you reach back.',
    feelIt: 'You should feel this in your core and glutes, not your lower back.',
    regression: 'If balance is hard, try moving just one limb at a time instead of the arm and leg together.',
  },
  // Nordic Hamstring Curl — hinge, eccentric, bodyweight
  ex_346: {
    startingPosition: 'Kneel on a padded surface with your ankles anchored under something sturdy (or held by a partner), torso upright.',
    movement: 'Slowly lower your torso toward the floor by letting your knees bend, keeping your hips straight, then catch yourself with your hands and push back up.',
    keyCue: 'Lower as slowly as you can control — this movement is about resisting the fall, not just letting yourself drop.',
    feelIt: 'You should feel this in the back of your thighs, not your lower back.',
    regression: 'If this is too much, try a slider or towel hamstring curl lying on your back instead — much easier to control.',
  },
  // Single-Leg Romanian Deadlift (Dumbbell) — hinge, unilateral
  ex_124: {
    startingPosition: 'Stand on one leg holding a dumbbell in the opposite hand, a slight bend in your standing knee.',
    movement: 'Hinge forward at your hips, letting your free leg extend straight back for balance, until your torso is roughly parallel to the floor, then return to standing.',
    keyCue: 'Keep your back flat and your hips square to the floor — don’t let them rotate open.',
    feelIt: 'You should feel a stretch in the hamstring of your standing leg, not your lower back.',
    regression: 'If balance is hard, try it holding onto something light for support, or do it without weight first.',
  },
  // Zercher Squat — squat, front-loaded
  ex_330: {
    startingPosition: 'Cradle the bar in the crooks of your elbows, arms crossed in front of your chest, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Keep your torso upright and your core braced — if you lean forward, the bar will roll off your arms.',
    feelIt: 'You should feel this in your quads, glutes, and core, not a sharp pain in your elbows.',
    regression: 'If holding the bar there is too uncomfortable, try a goblet squat instead — similar front-loaded position, easier to hold.',
  },
  // Single-Arm Dumbbell Row — pull, unilateral
  ex_152: {
    startingPosition: 'Place one knee and hand on a bench for support, holding a dumbbell in the other hand with your arm hanging straight down.',
    movement: 'Pull the dumbbell up toward your hip by driving your elbow back, then lower it back down with control.',
    keyCue: 'Keep your back flat and your torso still — don’t twist or rotate to help lift the weight.',
    feelIt: 'You should feel this in your back and lat, not your shoulder.',
    regression: 'If balance on the bench is hard, try it standing, hinged forward with your free hand braced on a sturdy surface.',
  },
  // Farmer's Carry (Dumbbell) — carry, full body
  ex_188: {
    startingPosition: 'Stand tall holding a heavy dumbbell in each hand at your sides.',
    movement: 'Walk forward at a steady pace, keeping your posture tall and your steps controlled, for the set distance or time.',
    keyCue: 'Keep your shoulders back and down — don’t let the weight pull you into a hunch.',
    feelIt: 'You should feel this in your grip, traps, and core from staying upright, not a strain in your lower back.',
    regression: 'If the weight is too much to hold that long, use lighter dumbbells or shorten the distance rather than rounding your posture.',
  },
  // Cable Woodchop — core, rotation
  ex_128: {
    startingPosition: 'Stand sideways to the cable machine with the handle set high, feet shoulder-width apart, and grip it with both hands.',
    movement: 'Pull the handle down and across your body toward your opposite hip, rotating through your torso, then return with control.',
    keyCue: 'Rotate from your core and hips — don’t just yank with your arms.',
    feelIt: 'You should feel this in your obliques and core, not your lower back.',
    regression: 'If this is too much, try it without any weight first, just practicing the rotation pattern.',
  },
  // Ab Wheel Rollout — core, kneeling
  ex_474: {
    startingPosition: 'Kneel on the floor holding the ab wheel handles, wheel positioned just in front of your knees.',
    movement: 'Roll the wheel forward, extending your body out as far as you can control, then pull back to the starting position using your core.',
    keyCue: 'Keep your core braced the whole time — don’t let your lower back sag toward the floor.',
    feelIt: 'You should feel this in your abs, not your lower back.',
    regression: 'If this is too much, only roll out a short distance — a smaller range with a tight core beats a longer one that sags.',
  },
  // Push Jerk — full body, overhead, power
  ex_651: {
    startingPosition: 'Hold the bar racked at your shoulders, feet shoulder-width apart, elbows up.',
    movement: 'Dip slightly by bending your knees, then drive up hard and punch the bar overhead while dropping your body slightly under it, catching it with straight arms.',
    keyCue: 'Keep the bar path close to your body — don’t let it drift forward as you drive it up.',
    feelIt: 'You should feel this as an explosive full-body effort, not an isolated arm press.',
    regression: 'If the timing feels off, practice a strict overhead press first to build the overhead position before adding the leg drive.',
  },
  // Deficit Deadlift — hinge, elevated stance
  ex_335: {
    startingPosition: 'Stand on a small platform (1-2 inches high) with the bar over your midfoot, and bend down to grip it just outside your knees.',
    movement: 'Stand up by pushing the floor away with your legs and driving your hips forward, keeping the bar close to your shins the whole way up.',
    keyCue: 'Your back stays flat from start to finish — the extra range makes it easier to round, so be extra deliberate about this.',
    feelIt: 'You should feel this in your hamstrings and glutes, not a strain in your lower back.',
    regression: 'If keeping your back flat through the extra range is hard, drop the platform or do a regular deadlift from the floor instead.',
  },
  // Snatch-Grip Deadlift — hinge, wide grip
  ex_331: {
    startingPosition: 'Stand with feet hip-width apart, gripping the bar much wider than shoulder-width, arms straight.',
    movement: 'Stand up by pushing the floor away and driving your hips forward, keeping the bar close to your body the whole way up.',
    keyCue: 'Your back stays flat the entire time — the wide grip pulls your torso lower, which makes rounding easier, so stay deliberate.',
    feelIt: 'You should feel this in your hamstrings, glutes, and upper back, not your lower back.',
    regression: 'If the wide grip feels unstable, use a slightly narrower grip until you build the mobility for the full-width version.',
  },
  // Renegade Row — full body, plank + pull
  ex_477: {
    startingPosition: 'Start in a push-up position with a dumbbell in each hand, feet a bit wider than usual for stability.',
    movement: 'Row one dumbbell up toward your hip while balancing on the other arm, then lower and switch sides.',
    keyCue: 'Keep your hips square and still — don’t let them rotate open as you row.',
    feelIt: 'You should feel this in your back and core from resisting the rotation, not your lower back.',
    regression: 'If balance is hard, widen your feet further or drop to your knees to reduce the plank demand.',
  },
  // Man Maker — full body, complex, power
  ex_1012: {
    startingPosition: 'Start in a push-up position holding a pair of dumbbells.',
    movement: 'Do a push-up, row each dumbbell up one at a time, then jump your feet up to your hands and stand up, pressing the dumbbells overhead.',
    keyCue: 'Move through each part deliberately — this is several exercises chained together, not a single fast motion.',
    feelIt: 'You should feel this as a full-body effort — if one part feels unstable, slow down on that part specifically.',
    regression: 'If this is too much, break it into pieces first — practice the push-up-to-row and the stand-to-press separately before chaining them.',
  },
  // Curtsy Lunge (Dumbbell) — squat/lunge, unilateral
  ex_715: {
    startingPosition: 'Stand tall holding a dumbbell in each hand, feet hip-width apart.',
    movement: 'Step one leg diagonally behind and across your body, bending both knees to lower down, then push through your front foot to stand back up.',
    keyCue: 'Keep your front knee tracking over your ankle — don’t let it cave inward as you cross behind.',
    feelIt: 'You should feel this in your glutes and outer thigh, not a strain in your knee.',
    regression: 'If balance is the issue, try it without weights first, holding onto something for support.',
  },
  // Barbell Rollout — core, kneeling
  ex_1183: {
    startingPosition: 'Kneel on the floor holding a barbell with both hands, positioned just in front of your knees.',
    movement: 'Roll the bar forward, extending your body out as far as you can control, then pull back using your core.',
    keyCue: 'Keep your core braced the whole time — don’t let your lower back sag toward the floor.',
    feelIt: 'You should feel this in your abs, not your lower back.',
    regression: 'If this is too much, only roll out a short distance, or use an ab wheel instead — it’s easier to control than a bar.',
  },
  // Cable Pull-Through — hinge
  ex_508: {
    startingPosition: 'Stand facing away from the cable machine, rope handle between your legs, feet shoulder-width apart.',
    movement: 'Hinge forward at your hips, letting the rope pull back between your legs, then drive your hips forward to stand tall.',
    keyCue: 'Keep your back flat the whole time — this is a hip hinge, not a squat or a back bend.',
    feelIt: 'You should feel this in your glutes and hamstrings, not your lower back.',
    regression: 'If the hip hinge feels unfamiliar, practice it bodyweight first, without the cable, until the pattern feels natural.',
  },
  // Barbell Floor Press — push
  ex_337: {
    startingPosition: 'Lie on the floor with knees bent, feet flat, and grip the bar slightly wider than shoulder-width, arms extended above your chest.',
    movement: 'Lower the bar until your upper arms touch the floor, then press it back up until your arms are straight.',
    keyCue: 'Keep your elbows at roughly a 45-degree angle to your body, not flared straight out to the sides.',
    feelIt: 'You should feel this across your chest and triceps, not a pinch in your shoulder joints.',
    regression: 'If this is too much, try a push-up instead — same pressing pattern, uses your bodyweight.',
  },
  // Landmine Press (Single-Arm) — push, unilateral
  ex_283: {
    startingPosition: 'Stand holding one end of a landmine-anchored bar at your shoulder, feet staggered for stability.',
    movement: 'Press the bar up and forward until your arm is straight, then lower it back to your shoulder with control.',
    keyCue: 'Keep your core braced and avoid arching your lower back to get the bar up.',
    feelIt: 'You should feel this in your shoulder and chest, not a strain in your lower back.',
    regression: 'If this is too much, try a seated dumbbell press instead — a bench supports your back.',
  },
  // Landmine Anti-Rotation Press — core/stability
  ex_481: {
    startingPosition: 'Stand sideways to a landmine-anchored bar, holding the end at your chest with both hands.',
    movement: 'Press the bar straight out in front of you until your arms are extended, then bring it back to your chest.',
    keyCue: 'Keep your hips and shoulders square — the whole point is resisting the bar’s pull to rotate you, so don’t let it twist you.',
    feelIt: 'You should feel this in your core working to stay still, not your arms doing all the work.',
    regression: 'If staying square is hard, use a lighter load or a shorter press range until you can control it.',
  },
  // Barbell Landmine Squat (Single-Arm) — squat
  ex_507: {
    startingPosition: 'Stand holding one end of a landmine-anchored bar at your chest with both hands, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Keep your chest up and the bar close to your body — don’t let it pull you forward as you squat.',
    feelIt: 'You should feel this in your quads and glutes, not your lower back.',
    regression: 'If this is too much, try a goblet squat instead — same front-loaded position, easier to hold steady.',
  },
  // Parallel Bar Dip — push, bodyweight
  ex_208: {
    startingPosition: 'Support yourself on parallel bars with your arms straight, body hanging below.',
    movement: 'Lower your body by bending your elbows until your shoulders are about level with your elbows, then press back up to straight arms.',
    keyCue: 'Don’t drop lower than your shoulders reaching elbow height — going deeper puts real strain on the front of your shoulder.',
    feelIt: 'You should feel this in your chest and triceps, not a pinch in the front of your shoulder.',
    regression: 'If this is too much, try a bench dip with your feet on the floor instead — much easier to control the depth.',
  },
  // Single-Arm Lat Pulldown — pull, unilateral
  ex_123: {
    startingPosition: 'Sit at the lat pulldown station, gripping a single handle attachment overhead with one hand.',
    movement: 'Pull the handle down toward your shoulder by driving your elbow down and back, then let it return with control.',
    keyCue: 'Keep your torso still — don’t lean back or twist to help pull the weight down.',
    feelIt: 'You should feel this in your back and lat, not your shoulder.',
    regression: 'If keeping your torso still is hard, use both hands on a normal lat pulldown bar instead.',
  },
  // Flat Dumbbell Bench Press — push
  ex_160: {
    startingPosition: 'Lie on a flat bench holding a dumbbell in each hand at chest level, feet flat on the floor.',
    movement: 'Press the dumbbells straight up until your arms are extended, then lower them back down with control.',
    keyCue: 'Keep your wrists stacked directly over your elbows — don’t let them bend backward under the weight.',
    feelIt: 'You should feel this across your chest and shoulders, not a strain in your wrists.',
    regression: 'If this is too much, try a push-up instead — same pressing pattern, uses your bodyweight.',
  },
  // Single-Arm Dumbbell Bench Press — push, unilateral
  ex_945: {
    startingPosition: 'Lie on a flat bench holding one dumbbell at chest level, your other arm resting at your side or braced on the bench.',
    movement: 'Press the dumbbell straight up until your arm is extended, then lower it back down with control.',
    keyCue: 'Keep your hips and shoulders square to the ceiling — don’t let the unweighted side twist up.',
    feelIt: 'You should feel this in your chest and core from resisting the rotation, not just your pressing arm.',
    regression: 'If staying square is hard, use a lighter weight until you can control the rotation.',
  },
  // Close-Grip Barbell Bench Press — push
  ex_181: {
    startingPosition: 'Lie on the bench with your eyes under the bar, hands just inside shoulder-width.',
    movement: 'Lower the bar to your lower chest, keeping your elbows tucked close to your body, then press it back up.',
    keyCue: 'Keep your elbows tucked in, not flared out — a narrow grip with flared elbows is hard on your wrists and elbows.',
    feelIt: 'You should feel this mostly in your triceps, with your chest assisting, not a strain in your wrists.',
    regression: 'If this is too much, try close-grip push-ups instead — same tucked-elbow pattern, uses your bodyweight.',
  },
  // Chest-Supported T-Bar Row — pull
  ex_163: {
    startingPosition: 'Lie chest-down on the angled pad, gripping the handles below you with arms extended.',
    movement: 'Pull the handles up toward your chest by driving your elbows back, then lower with control.',
    keyCue: 'Keep your chest pressed into the pad — don’t lift your torso off it to help pull the weight.',
    feelIt: 'You should feel this in your upper back, not your lower back or shoulders.',
    regression: 'If the weight is too heavy to control smoothly, drop it down until your form stays clean through every rep.',
  },
  // Hanging Leg Raise (Straight-Leg) — core, hanging
  ex_718: {
    startingPosition: 'Hang from a pull-up bar with your arms straight, legs extended below you.',
    movement: 'Keeping your legs straight, raise them up until they’re at least parallel to the floor, then lower with control.',
    keyCue: 'Move with control, not momentum — swinging your body to throw your legs up takes the work away from your abs.',
    feelIt: 'You should feel this in your lower abs, not your hip flexors straining or your grip giving out first.',
    regression: 'If this is too much, try bent-knee hanging leg raises instead — same movement, shorter lever, much easier.',
  },
  // Barbell Reverse Lunge — lunge, loaded
  ex_340: {
    startingPosition: 'Stand with the bar racked across your upper back, feet hip-width apart.',
    movement: 'Step one leg back and lower your body until both knees are bent to about 90 degrees, then push through your front foot to return to standing.',
    keyCue: 'Keep your front knee tracking over your ankle — don’t let it drift forward past your toes.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If balance with the bar is hard, try a bodyweight reverse lunge first, or hold light dumbbells at your sides instead.',
  },
  // Dumbbell Step-Up — lunge/squat, unilateral
  ex_580: {
    startingPosition: 'Stand facing a sturdy box or bench, holding a dumbbell in each hand.',
    movement: 'Step one foot fully onto the box and drive through it to stand up on top, then step back down with control.',
    keyCue: 'Push through your whole foot on the box, not just your toes — and don’t let your back knee do the work by pushing off the floor.',
    feelIt: 'You should feel this in the thigh and glute of the leg stepping up, not a strain in your knee.',
    regression: 'If balance is the issue, use a lower box or try it without weights first.',
  },
  // Barbell Clean and Press — full body, technical, power
  ex_976: {
    startingPosition: 'Stand with the bar on the floor over your midfoot, feet hip-width apart, gripping just outside your knees.',
    movement: 'Pull the bar up explosively and catch it racked at your shoulders in one motion, then press it overhead until your arms are straight.',
    keyCue: 'Keep the bar close to your body the whole way up — if it drifts forward, you’ll lose control of the catch.',
    feelIt: 'You should feel this as a coordinated full-body effort, not an isolated arm pull.',
    regression: 'If the timing feels off, practice the clean and the overhead press separately before combining them.',
  },
  // Kettlebell Clean — pull/power, technical
  ex_414: {
    startingPosition: 'Stand with feet shoulder-width apart, kettlebell on the floor between your feet.',
    movement: 'Hike the bell back slightly, then pull it up close to your body and rotate your wrist through so it lands softly in the rack position at your shoulder.',
    keyCue: 'Keep the bell close to your body the whole way up — letting it swing out and away is what causes it to bang into your wrist.',
    feelIt: 'You should feel this as a smooth pull from your hips and legs, not a yank with your arm.',
    regression: 'If the wrist rotation feels awkward, practice slowly with a lighter kettlebell until the catch feels natural.',
  },
  // Cossack Squat (Bodyweight) — squat, lateral
  ex_714: {
    startingPosition: 'Stand with feet wider than shoulder-width, toes turned slightly out.',
    movement: 'Shift your weight to one side and bend that knee to lower down, keeping your other leg straight with its foot flat, then push back to center and repeat on the other side.',
    keyCue: 'Keep the heel of your bent leg flat on the floor — don’t let it lift as you sink down.',
    feelIt: 'You should feel this in your inner thighs and glutes, not your knees.',
    regression: 'If balance or mobility is limiting you, hold onto something sturdy for support, or don’t go as deep.',
  },
  // Devil Press — full body, high intensity
  ex_642: {
    startingPosition: 'Stand over a pair of dumbbells on the floor.',
    movement: 'Drop into a burpee with your hands on the dumbbells, kick your feet back and do a push-up, jump your feet back in, then stand up and swing both dumbbells overhead in one motion.',
    keyCue: 'Move through each part deliberately, especially the overhead swing — don’t rush it just because the rest of the movement is fast.',
    feelIt: 'You should feel this as an intense full-body effort — if the overhead part feels unstable, slow down there specifically.',
    regression: 'If this is too much, break it apart — do the burpee and the dumbbell swing as two separate movements first.',
  },
  // Dumbbell Thruster — full body, squat + press
  ex_584: {
    startingPosition: 'Stand holding a dumbbell at each shoulder, feet shoulder-width apart.',
    movement: 'Squat down until your thighs are at least parallel to the floor, then stand up explosively and use that momentum to press the dumbbells overhead.',
    keyCue: 'Keep your core braced through the whole movement — don’t let your lower back arch as you press overhead.',
    feelIt: 'You should feel this as one connected effort from your legs into your shoulders, not two separate movements.',
    regression: 'If this is too much, do the squat and the overhead press as two separate exercises first.',
  },
  // Barbell Overhead Squat — squat, overhead
  ex_341: {
    startingPosition: 'Hold the bar overhead with a wide grip, arms locked out, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to squat down while keeping the bar directly overhead, then stand back up.',
    keyCue: 'Keep the bar stacked directly over your midfoot the whole way down — if it drifts forward, you’ll lose the position.',
    feelIt: 'You should feel this as a whole-body balancing effort, not just a squat with weight on your back.',
    regression: 'If this is too much, practice holding the overhead position without squatting first, or use a lighter bar or dowel.',
  },
  // Standing Dumbbell Shoulder Press — overhead
  ex_154: {
    startingPosition: 'Stand with feet shoulder-width apart, holding a dumbbell at each shoulder.',
    movement: 'Press the dumbbells straight up until your arms are extended, then lower them back to your shoulders with control.',
    keyCue: 'Keep your ribs pulled down and your core braced — don’t arch your lower back to get the weight up.',
    feelIt: 'You should feel this in your shoulders and triceps, not a strain in your lower back.',
    regression: 'If this is too much, try a seated version instead — the bench back supports you and makes it harder to arch.',
  },
  // Seated Dumbbell Shoulder Press — overhead, seated
  ex_185: {
    startingPosition: 'Sit on a bench with back support, holding a dumbbell at each shoulder.',
    movement: 'Press the dumbbells straight up until your arms are extended, then lower them back to your shoulders with control.',
    keyCue: 'Keep your wrists stacked over your elbows — don’t let them bend backward under the load.',
    feelIt: 'You should feel this in your shoulders and triceps, not your wrists or lower back.',
    regression: 'If this is too much, try a lighter weight or a resistance band overhead press instead.',
  },
  // Band-Assisted Pull-Up — pull
  ex_207: {
    startingPosition: 'Loop a resistance band around the pull-up bar and place one foot (or knee) in the loop, then hang from the bar with arms straight.',
    movement: 'Pull yourself up by driving your elbows down toward your hips until your chin clears the bar, then lower back down with control.',
    keyCue: 'Keep your body still and controlled — don’t swing or kick your legs to get momentum.',
    feelIt: 'You should feel this in your back and biceps, not your shoulders.',
    regression: 'If this is still too much, use a thicker band for more assistance, or try a lat pulldown machine instead.',
  },
  // Band Shoulder Dislocate — mobility, shoulder
  ex_443: {
    startingPosition: 'Stand holding a resistance band or light stick with both hands, wider than shoulder-width, arms straight in front of you.',
    movement: 'Slowly raise the band overhead and continue rotating it behind your body, then reverse back to the front.',
    keyCue: 'Keep your arms straight and grip wide enough that your shoulders never feel pinched — widen your grip if it does.',
    feelIt: 'You should feel a stretch through your shoulders and chest, never a sharp pinch.',
    regression: 'If this feels tight or pinches at all, use a wider grip or a longer band until it moves smoothly.',
  },
  // Good Morning (Barbell) — hinge, back-loaded
  ex_172: {
    startingPosition: 'Stand with the bar racked across your upper back, feet hip-width apart, knees slightly bent.',
    movement: 'Hinge forward at your hips, keeping your back flat, until your torso is close to parallel with the floor, then drive your hips forward to stand back up.',
    keyCue: 'Your back stays flat the entire time — this is a hip hinge, not a way to round forward under load.',
    feelIt: 'You should feel a stretch in your hamstrings, not your lower back.',
    regression: 'If this is too much, try a Romanian deadlift with dumbbells instead — same hinge pattern, easier to keep in view and control.',
  },
  // Standing Cable Chest Press — push, cable
  ex_131: {
    startingPosition: 'Stand facing away from the cable machine in a staggered stance, holding a handle at chest height in each hand.',
    movement: 'Press both handles forward until your arms are extended, then return with control.',
    keyCue: 'Keep your core braced and your torso still — don’t lean into the press to help move the weight.',
    feelIt: 'You should feel this across your chest, not a strain in your lower back.',
    regression: 'If staying stable is hard, use one arm at a time with your other hand braced on something sturdy.',
  },
  // Goblet Squat (Dumbbell) — squat
  ex_102: {
    startingPosition: 'Hold a dumbbell vertically against your chest with both hands, feet just outside shoulder-width.',
    movement: 'Push your hips back and bend your knees to squat down until your elbows brush the inside of your knees, then drive through your heels to stand.',
    keyCue: 'Keep your chest up and elbows pointed down — don’t let the weight pull you forward.',
    feelIt: 'You should feel this in your quads and glutes, not your lower back.',
    regression: 'If depth is hard, only squat as low as you can keep your heels flat and chest up.',
  },
  // Push-Up — push, bodyweight
  ex_133: {
    startingPosition: 'Start in a high plank with hands slightly wider than shoulder-width, body in a straight line from head to heels.',
    movement: 'Lower your chest toward the floor by bending your elbows, then press back up until your arms are straight.',
    keyCue: 'Keep your body in one straight line the whole way — don’t let your hips sag or pike up.',
    feelIt: 'You should feel this across your chest, shoulders, and triceps, not a strain in your lower back.',
    regression: 'If this is too much, drop to your knees, or push up against an elevated surface like a bench.',
  },
  // Incline Dumbbell Press — push
  ex_159: {
    startingPosition: 'Lie back on an incline bench holding a dumbbell in each hand at shoulder level.',
    movement: 'Press the dumbbells up and slightly back until your arms are extended, then lower with control.',
    keyCue: 'Keep your wrists stacked over your elbows and your shoulder blades pulled back into the bench.',
    feelIt: 'You should feel this in your upper chest and shoulders, not your wrists.',
    regression: 'If this is too much, try an incline push-up instead — same angle, uses your bodyweight.',
  },
  // Decline Barbell Bench Press — push
  ex_161: {
    startingPosition: 'Lie on a decline bench with your feet secured, gripping the bar slightly wider than shoulder-width.',
    movement: 'Lower the bar to your lower chest, then press it back up until your arms are straight.',
    keyCue: 'Keep your elbows at roughly a 45-degree angle — don’t flare them straight out.',
    feelIt: 'You should feel this in your lower chest, not a pinch in your shoulders.',
    regression: 'If this is too much, try a flat bench press instead — easier to set up and control.',
  },
  // Pendlay Row — pull
  ex_164: {
    startingPosition: 'Hinge forward until your torso is parallel to the floor, gripping the bar on the ground just outside your knees.',
    movement: 'Pull the bar explosively off the floor up to your lower chest, then lower it back down to a dead stop each rep.',
    keyCue: 'Keep your back flat and torso still — the power comes from your back, not from jerking your torso up.',
    feelIt: 'You should feel this in your upper back, not your lower back.',
    regression: 'If holding the parallel-torso position is hard, try a chest-supported row on an incline bench instead.',
  },
  // Dumbbell Romanian Deadlift (Bilateral) — hinge
  ex_186: {
    startingPosition: 'Stand holding a dumbbell in each hand at your thighs, feet hip-width apart, slight bend in your knees.',
    movement: 'Push your hips straight back while lowering the dumbbells down your legs, keeping them close to your body, until you feel a deep hamstring stretch, then drive your hips forward to stand.',
    keyCue: 'Your back stays flat the entire time — it never rounds as you lower.',
    feelIt: 'You should feel a deep stretch in your hamstrings, not your lower back.',
    regression: 'If it’s hard to keep your back flat through the full range, only lower as far as you can control.',
  },
  // Farmer's Carry (Kettlebell) — carry
  ex_189: {
    startingPosition: 'Stand tall holding a heavy kettlebell in each hand at your sides.',
    movement: 'Walk forward at a steady pace, keeping your posture tall, for the set distance or time.',
    keyCue: 'Keep your shoulders back and down — don’t let the weight pull you into a hunch.',
    feelIt: 'You should feel this in your grip, traps, and core, not a strain in your lower back.',
    regression: 'If the weight is too much, use lighter kettlebells or shorten the distance.',
  },
  // Suitcase Carry (Single-Arm Dumbbell) — carry, anti-lateral-flexion
  ex_190: {
    startingPosition: 'Stand tall holding one dumbbell at your side, other hand free.',
    movement: 'Walk forward at a steady pace, keeping your torso upright and level, for the set distance or time.',
    keyCue: 'Don’t let your torso lean or tilt toward the weighted side — resisting that pull is the whole point.',
    feelIt: 'You should feel this in your obliques and core working to stay upright, not your lower back.',
    regression: 'If staying upright is hard, use a lighter dumbbell or shorten the distance.',
  },
  // Overhead Carry (Single-Arm Dumbbell) — carry, overhead stability
  ex_191: {
    startingPosition: 'Press one dumbbell overhead until your arm is locked straight, other hand free at your side.',
    movement: 'Walk forward at a steady pace, keeping the dumbbell locked overhead, for the set distance or time.',
    keyCue: 'Keep your ribs down and core braced — don’t let your lower back arch to keep the weight up.',
    feelIt: 'You should feel this in your shoulder and core from staying stacked, not a strain in your lower back.',
    regression: 'If this is too much, use a lighter dumbbell, or hold it in the rack position at your shoulder instead of overhead.',
  },
  // Single-Arm Kettlebell Row (Unsupported) — pull
  ex_195: {
    startingPosition: 'Hinge forward at your hips with a flat back, kettlebell hanging in one hand, other hand free or resting on your thigh.',
    movement: 'Pull the kettlebell up toward your hip by driving your elbow back, then lower with control.',
    keyCue: 'Keep your back flat and hips still — don’t twist your torso to help lift the weight.',
    feelIt: 'You should feel this in your back, not your lower back.',
    regression: 'If holding the unsupported hinge is hard, try it with one hand braced on a bench instead.',
  },
  // Single-Arm Kettlebell Overhead Press — overhead
  ex_196: {
    startingPosition: 'Stand holding a kettlebell racked at one shoulder, feet shoulder-width apart.',
    movement: 'Press the kettlebell straight up until your arm is locked out overhead, then lower it back to your shoulder with control.',
    keyCue: 'Keep your ribs pulled down — don’t arch your lower back to get the weight up.',
    feelIt: 'You should feel this in your shoulder and triceps, not your lower back.',
    regression: 'If this is too much, try a seated dumbbell press instead — the bench supports your back.',
  },
  // Kettlebell Single-Leg Romanian Deadlift — hinge, unilateral
  ex_197: {
    startingPosition: 'Stand on one leg holding a kettlebell in the opposite hand, slight bend in your standing knee.',
    movement: 'Hinge forward at your hips, letting your free leg extend back for balance, until your torso is roughly parallel to the floor, then return to standing.',
    keyCue: 'Keep your hips square to the floor — don’t let them rotate open.',
    feelIt: 'You should feel a stretch in the hamstring of your standing leg, not your lower back.',
    regression: 'If balance is hard, hold onto something light for support, or do it without weight first.',
  },
  // Inverted Row (Bodyweight) — pull
  ex_209: {
    startingPosition: 'Lie under a bar set at hip height, gripping it with both hands, body in a straight line with heels on the floor.',
    movement: 'Pull your chest up toward the bar by driving your elbows back, then lower with control.',
    keyCue: 'Keep your body rigid in a straight line the whole time — don’t let your hips sag.',
    feelIt: 'You should feel this in your back and biceps, not your lower back.',
    regression: 'If this is too much, raise the bar higher so your body is more upright — the more vertical you are, the easier it gets.',
  },
  // Pistol Squat (Single-Leg Bodyweight) — squat, high skill
  ex_210: {
    startingPosition: 'Stand on one leg, other leg extended straight out in front of you, arms out for balance.',
    movement: 'Bend your standing knee to lower down as far as you can control, keeping your extended leg off the floor, then push back up to standing.',
    keyCue: 'Go only as deep as you can control without your knee caving inward or losing balance.',
    feelIt: 'You should feel this in your standing thigh and glute, not a strain in your knee.',
    regression: 'If this is too much, hold onto something for support, or squat down to a low box or bench instead of going all the way down.',
  },
  // Archer Push-Up — push, high skill
  ex_213: {
    startingPosition: 'Start in a wide push-up position, hands well outside shoulder-width.',
    movement: 'Lower your body by bending one elbow while keeping the other arm straight, shifting your weight toward the bending side, then push back up and repeat on the other side.',
    keyCue: 'Keep your body in a straight line — don’t let your hips twist or sag as you shift your weight.',
    feelIt: 'You should feel this heavily in the chest and triceps of the bending-arm side, not a strain in your shoulder.',
    regression: 'If this is too much, try a regular push-up first and build strength there before adding the single-side shift.',
  },
  // TRX Row — pull
  ex_217: {
    startingPosition: 'Hold the TRX handles and lean back with arms extended, feet planted, body in a straight line.',
    movement: 'Pull your chest up toward the handles by driving your elbows back, then lower with control.',
    keyCue: 'Keep your body rigid in a straight line — don’t let your hips sag or pike.',
    feelIt: 'You should feel this in your back and biceps, not your lower back.',
    regression: 'If this is too much, walk your feet forward to a more upright angle — the more vertical you are, the easier it gets.',
  },
  // TRX Chest Press — push
  ex_218: {
    startingPosition: 'Hold the TRX handles facing away from the anchor point, body leaning forward at an angle, arms extended.',
    movement: 'Bend your elbows to lower your chest toward your hands, then press back to straight arms.',
    keyCue: 'Keep your body rigid in a straight line — don’t let your hips sag.',
    feelIt: 'You should feel this across your chest and shoulders, not your lower back.',
    regression: 'If this is too much, stand more upright, leaning less — a shallower angle makes it easier.',
  },
  // Medicine Ball Squat-to-Press — full body
  ex_244: {
    startingPosition: 'Stand holding a medicine ball at your chest, feet shoulder-width apart.',
    movement: 'Squat down until your thighs are at least parallel to the floor, then stand up and press the ball overhead in one motion.',
    keyCue: 'Keep your core braced through the whole movement — don’t let your lower back arch as you press.',
    feelIt: 'You should feel this as one connected effort from your legs into your shoulders.',
    regression: 'If this is too much, do the squat and the overhead press as two separate movements first.',
  },
  // Depth Jump (Drop Jump) — jump, power
  ex_264: {
    startingPosition: 'Stand on top of a sturdy box, feet shoulder-width apart, near the edge.',
    movement: 'Step off the box, land softly with both feet, and immediately jump straight up as high as you can the instant you touch down.',
    keyCue: 'Land soft with bent knees before exploding back up — this is a fast landing-to-jump reaction, not a slow controlled squat.',
    feelIt: 'You should feel this as an explosive reflex in your legs, not a jolt in your knees on landing.',
    regression: 'If this is too much, use a lower box, or practice just the soft landing without the jump first.',
  },
  // Barbell Power Clean — full body, technical, power
  ex_268: {
    startingPosition: 'Stand with the bar over your midfoot, feet hip-width apart, gripping just outside your knees.',
    movement: 'Pull the bar up explosively off the floor, extending through your hips, then drop under it to catch it racked at your shoulders.',
    keyCue: 'Keep the bar close to your body the entire pull — if it drifts away from your shins, you’ll lose the catch.',
    feelIt: 'You should feel this as an explosive pull from your hips and legs, not an arm curl.',
    regression: 'If the timing feels off, practice the hip-extension pull without the catch first, or work with a coach on the movement before adding real weight.',
  },
  // Barbell Push Press — overhead, power
  ex_269: {
    startingPosition: 'Hold the bar racked at your shoulders, feet shoulder-width apart, elbows slightly forward.',
    movement: 'Dip slightly by bending your knees, then drive up through your legs and press the bar overhead until your arms are straight.',
    keyCue: 'Keep the bar path close and vertical — use your legs to start the drive, not just your arms.',
    feelIt: 'You should feel your legs doing the initial work, with your shoulders finishing the lockout.',
    regression: 'If the leg-drive timing feels off, practice a strict overhead press first to build the overhead lockout.',
  },
  // Trap Bar Deadlift — hinge
  ex_279: {
    startingPosition: 'Stand inside the trap bar with feet hip-width apart, gripping the handles at your sides.',
    movement: 'Stand up by pushing the floor away with your legs and driving your hips forward, keeping your chest up the whole way.',
    keyCue: 'Keep your back flat and your weight balanced through your whole foot — don’t let it shift onto your toes.',
    feelIt: 'You should feel this in your quads, hamstrings, and glutes, not your lower back.',
    regression: 'If this is too much, reduce the weight until you can keep your chest up and back flat through the full lift.',
  },
  // Barbell Walking Lunge — lunge, loaded
  ex_339: {
    startingPosition: 'Stand with the bar racked across your upper back, feet hip-width apart.',
    movement: 'Step forward into a long stride and lower until both knees are bent to about 90 degrees, then push off your front foot to bring your back leg forward into the next step.',
    keyCue: 'Keep your front knee tracking over your ankle — don’t let it drift forward past your toes.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your knee.',
    regression: 'If balance with the bar is hard, try a bodyweight walking lunge first, or hold light dumbbells at your sides instead.',
  },
  // Handstand Push-Up (Wall-Assisted) — push/overhead, high skill
  ex_343: {
    startingPosition: 'Kick up into a handstand against a wall, hands shoulder-width apart, body facing the wall.',
    movement: 'Lower your head slowly toward the floor by bending your elbows, then press back up to straight arms.',
    keyCue: 'Move slow and controlled — never let yourself drop faster than you can catch, and keep your core braced so your back doesn’t arch.',
    feelIt: 'You should feel this in your shoulders and triceps, not a strain in your neck or lower back.',
    regression: 'If this is too much, try a pike push-up on the floor instead — feet elevated, hips high, same overhead pressing pattern with less load.',
  },
  // Muscle-Up (Bar) — pull/push, high skill and injury risk
  ex_345: {
    startingPosition: 'Hang from the bar with an active grip, arms straight.',
    movement: 'Pull explosively up and forward, transitioning your chest over the bar as your elbows come up, then press up to straight arms above the bar.',
    keyCue: 'This transition is a real fall risk if you’re not ready for it — build a strong pull-up and dip first before attempting the full movement.',
    feelIt: 'You should feel this as one continuous pull-to-press motion, not a stall in the middle.',
    regression: 'If this is too much, practice pull-ups and dips separately, and try the transition with a resistance band assisting until it clicks.',
  },
  // L-Sit (Parallettes) — core, high skill
  ex_347: {
    startingPosition: 'Support your body on parallettes or bars with straight arms, legs extended straight out in front of you.',
    movement: 'Hold this position, keeping your legs raised parallel to the floor, for the set time.',
    keyCue: 'Keep your shoulders pressed down away from your ears — don’t let them shrug up to compensate.',
    feelIt: 'You should feel this in your core and hip flexors, not your shoulders straining upward.',
    regression: 'If this is too much, bend your knees into a tuck position instead of extending your legs straight — much easier to hold.',
  },
  // Dragon Flag — core, high skill and injury risk
  ex_349: {
    startingPosition: 'Lie on a bench, gripping something sturdy behind your head for support, body straight.',
    movement: 'Lift your entire body off the bench, keeping it in one straight line, pivoting only at your shoulders, then lower slowly with control.',
    keyCue: 'Keep your whole body rigid as one straight line — if your hips bend or sag, you’ve lost the position and should stop there.',
    feelIt: 'You should feel this intensely through your entire core, not your lower back.',
    regression: 'If this is too much, bend your knees and only lower partway — a smaller controlled range beats a full range that breaks form.',
  },
  // Burpees — full body, conditioning
  ex_357: {
    startingPosition: 'Stand with feet shoulder-width apart.',
    movement: 'Drop into a squat, place your hands on the floor, kick your feet back into a plank, do a push-up, jump your feet back in, then jump straight up.',
    keyCue: 'Keep your core braced through the floor portion — don’t let your hips sag when your feet kick back.',
    feelIt: 'You should feel this as a fast full-body effort, not a jolt in your lower back.',
    regression: 'If this is too much, step your feet back and forward instead of jumping, and skip the push-up and final jump.',
  },
  // Barbell Snatch — full body, highest technical/injury risk
  ex_364: {
    startingPosition: 'Stand with the bar over your midfoot, feet hip-width apart, gripping very wide.',
    movement: 'Pull the bar up explosively in one continuous motion, extending through your hips, then drop underneath it and catch it overhead with straight arms.',
    keyCue: 'This is the most technical lift in the library — the bar must stay close to your body the entire way, and the catch demands real shoulder mobility. Learn it from a coach before loading it heavy.',
    feelIt: 'You should feel this as one explosive, coordinated pull, not a series of separate arm movements.',
    regression: 'If the technique isn’t there yet, practice a hang snatch from the hip first, or break it down into a snatch pull and an overhead squat separately.',
  },
  // Hang Clean — full body, technical
  ex_366: {
    startingPosition: 'Stand holding the bar at your thighs, feet hip-width apart, slight bend in your knees.',
    movement: 'Explosively extend your hips to pull the bar up, then drop under it to catch it racked at your shoulders.',
    keyCue: 'Keep the bar close to your body the whole way up — if it swings away from your legs, the catch won’t work.',
    feelIt: 'You should feel this as an explosive hip snap, not an arm curl.',
    regression: 'If the catch feels unfamiliar, practice the hip-extension pull without catching the bar first.',
  },
  // Split Jerk — overhead/squat, technical
  ex_368: {
    startingPosition: 'Hold the bar racked at your shoulders, feet hip-width apart, elbows up.',
    movement: 'Dip slightly, then drive the bar overhead while quickly splitting one foot forward and one foot back to catch it with straight arms.',
    keyCue: 'Land in a stable, balanced split stance — if your front knee caves in or you can’t find your balance, stop and reset rather than fighting for the rep.',
    feelIt: 'You should feel this as an explosive full-body effort with a stable landing, not a wobble you have to save.',
    regression: 'If the footwork feels unfamiliar, practice the split-stance landing empty-handed first, then add a push press once the footwork is automatic.',
  },
  // Plyo Push-Up (Clap Push-Up) — push, power
  ex_374: {
    startingPosition: 'Start in a standard push-up position, body in a straight line.',
    movement: 'Lower down as in a regular push-up, then push up explosively hard enough that your hands leave the floor, and land softly back in the push-up position.',
    keyCue: 'Land with soft, bent elbows to absorb the impact — never land with locked-out arms.',
    feelIt: 'You should feel this as an explosive effort through your chest and shoulders, not a jolt in your wrists on landing.',
    regression: 'If this is too much, try a regular push-up with an explosive (but feet-stay-down) press instead, building power without the airborne landing.',
  },
  // Yoke Carry — carry, strongman
  ex_379: {
    startingPosition: 'Stand under the loaded yoke frame with it resting across your upper back, feet under your hips.',
    movement: 'Lift the yoke by standing up tall, then walk forward with short, controlled steps for the set distance.',
    keyCue: 'Keep your core braced and torso upright — don’t let the load round your back forward as you walk.',
    feelIt: 'You should feel this as heavy full-body bracing through your core and legs, not a strain in your lower back.',
    regression: 'If this is too much, use a lighter load or try a farmer’s carry instead — similar bracing demand, easier to control.',
  },
  // Sandbag Carry — carry
  ex_383: {
    startingPosition: 'Lift the sandbag and hold it against your chest or over one shoulder, whichever feels more secure.',
    movement: 'Walk forward at a steady pace, keeping your posture tall, for the set distance or time.',
    keyCue: 'Keep your core braced the whole way — the bag shifts as you move, so staying tight keeps it from throwing off your balance.',
    feelIt: 'You should feel this in your core and grip from controlling the shifting weight, not a strain in your lower back.',
    regression: 'If the bag is too heavy or unstable, use a lighter one or hold it lower against your chest for more control.',
  },
  // Pallof Press (Cable) — core, anti-rotation
  ex_127: {
    startingPosition: 'Stand sideways to the cable machine, handle set at chest height, holding it with both hands at your sternum.',
    movement: 'Press the handle straight out in front of you until your arms are extended, then bring it back to your chest.',
    keyCue: 'Keep your hips and shoulders square the whole time — the cable is trying to rotate you, and your job is to resist that, not to move with it.',
    feelIt: 'You should feel this in your core working to stay still, not your arms doing the work.',
    regression: 'If staying square is hard, use a lighter weight or a shorter press range until you can control it.',
  },
  // Hindu Push-Up (Dive Bomber Push-Up) — push, mobility flow
  ex_606: {
    startingPosition: 'Start in a downward-dog position, hips high, hands and feet on the floor.',
    movement: 'Dive your chest forward and down in a swooping arc, sweeping close to the floor, then rise up into an upward-dog position with your hips low and chest up, and reverse the arc back to the start.',
    keyCue: 'Keep the movement smooth and continuous — this is one flowing arc, not two separate push-ups.',
    feelIt: 'You should feel this across your chest, shoulders, and lower back from the smooth arch, not a strain in your neck.',
    regression: 'If this is too much, try a regular push-up first and add the flowing arc once you’re comfortable with basic pressing strength.',
  },
  // Bulgarian Split Squat (Bodyweight, No Load) — squat, unilateral
  ex_608: {
    startingPosition: 'Stand a couple feet in front of a bench, rest one foot behind you on top of it, hands on your hips.',
    movement: 'Lower your back knee straight down toward the floor by bending your front leg, then push through your front foot to stand back up.',
    keyCue: 'Your front knee stays lined up over your ankle — it doesn’t drift forward past your toes.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If balance is the issue, hold onto something sturdy for support.',
  },
  // Plank-to-Push-Up (Up-Down Plank) — core/push
  ex_609: {
    startingPosition: 'Start in a forearm plank, body in a straight line.',
    movement: 'Push up one arm at a time into a high plank on straight arms, then lower back down one arm at a time to your forearms.',
    keyCue: 'Keep your hips still and square the whole time — don’t let them rock side to side as you change arm positions.',
    feelIt: 'You should feel this in your shoulders, chest, and core working to stay stable, not your lower back.',
    regression: 'If this is too much, drop to your knees to reduce the plank demand while you build the arm-to-arm transition.',
  },
  // Kettlebell Clean and Press (Single-Arm) — full body, technical
  ex_614: {
    startingPosition: 'Stand with feet shoulder-width apart, kettlebell on the floor between your feet.',
    movement: 'Clean the bell up to the rack position at your shoulder in one pull, then press it straight overhead until your arm is locked out.',
    keyCue: 'Keep the bell close to your body on the clean — letting it swing out and away is what causes it to bang into your wrist.',
    feelIt: 'You should feel this as a smooth pull into a controlled press, not a yank followed by a strain.',
    regression: 'If the timing feels off, practice the clean and the overhead press as two separate movements first.',
  },
  // Suitcase Carry (Single-Arm Kettlebell) — carry, anti-lateral-flexion
  ex_615: {
    startingPosition: 'Stand tall holding one kettlebell at your side, other hand free.',
    movement: 'Walk forward at a steady pace, keeping your torso upright and level, for the set distance or time.',
    keyCue: 'Don’t let your torso lean or tilt toward the weighted side — resisting that pull is the whole point.',
    feelIt: 'You should feel this in your obliques and core working to stay upright, not your lower back.',
    regression: 'If staying upright is hard, use a lighter kettlebell or shorten the distance.',
  },
  // Kettlebell High Pull — hinge, power
  ex_616: {
    startingPosition: 'Stand with feet shoulder-width apart, kettlebell hanging in front of you with both hands.',
    movement: 'Hike the bell back slightly, then explosively extend your hips and pull the bell up toward chest height, leading with your elbow.',
    keyCue: 'The power comes from your hips snapping forward, not your arm yanking the bell up.',
    feelIt: 'You should feel this in your hips and upper back, not a strain in your shoulder.',
    regression: 'If the hip-hinge timing feels off, practice a kettlebell swing first to build the hip snap.',
  },
  // Kettlebell Swing (Single-Arm) — hinge, power
  ex_617: {
    startingPosition: 'Stand with feet shoulder-width apart, kettlebell on the floor a short reach in front of you, gripping it with one hand.',
    movement: 'Hinge at your hips to grab the bell, then snap your hips forward hard to swing it up to chest height, letting your arm just guide it.',
    keyCue: 'This is a hip snap, not an arm lift — your gripping arm should stay relaxed the whole time.',
    feelIt: 'You should feel this in your glutes and hamstrings from the hip snap, not your shoulder or lower back.',
    regression: 'If the hip-hinge timing feels off, practice the hinge alone first without the kettlebell.',
  },
  // Double Kettlebell Front Squat (Bilateral) — squat
  ex_618: {
    startingPosition: 'Clean both kettlebells to the rack position at your shoulders, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Keep your elbows up and chest tall — if your elbows drop, the bells pull your torso forward.',
    feelIt: 'You should feel this in your quads and glutes, not your wrists or lower back.',
    regression: 'If holding two bells in the rack is too much, try a single kettlebell goblet squat instead.',
  },
  // Kettlebell Goblet Pistol Squat — squat, high skill
  ex_619: {
    startingPosition: 'Stand on one leg holding a kettlebell at your chest, other leg extended out in front of you.',
    movement: 'Bend your standing knee to lower down as far as you can control, then push back up to standing.',
    keyCue: 'Go only as deep as you can control without your knee caving inward or losing balance.',
    feelIt: 'You should feel this in your standing thigh and glute, not a strain in your knee.',
    regression: 'If this is too much, hold onto something for support, or squat to a low box instead of going all the way down.',
  },
  // Kettlebell Reverse Lunge (Front-Rack) — lunge
  ex_620: {
    startingPosition: 'Hold a kettlebell racked at one shoulder, feet hip-width apart.',
    movement: 'Step one leg back and lower your body until both knees are bent to about 90 degrees, then push through your front foot to return to standing.',
    keyCue: 'Keep your torso upright — don’t let the front-rack weight pull you into a forward lean.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If balance is hard, try it without weight first, or hold the kettlebell at your side instead of racked.',
  },
  // Kettlebell Single-Arm Thruster (Squat to Press) — full body
  ex_621: {
    startingPosition: 'Hold a kettlebell racked at one shoulder, feet shoulder-width apart.',
    movement: 'Squat down until your thighs are at least parallel to the floor, then stand up explosively and use that momentum to press the kettlebell overhead.',
    keyCue: 'Keep your core braced through the whole movement — don’t let your lower back arch as you press.',
    feelIt: 'You should feel this as one connected effort from your legs into your shoulder, not two separate movements.',
    regression: 'If this is too much, do the squat and the overhead press as two separate movements first.',
  },
  // Hollow Body Rock — core
  ex_632: {
    startingPosition: 'Lie on your back, arms extended overhead and legs extended straight, lower back pressed into the floor.',
    movement: 'Rock gently back and forth along your spine while holding this hollow shape, keeping your lower back from arching off the floor.',
    keyCue: 'Keep your lower back pinned to the floor the entire time — if it arches up, your legs or arms have dropped too low.',
    feelIt: 'You should feel this deep in your abs, not your lower back or hip flexors.',
    regression: 'If this is too much, bend your knees and keep your arms at your sides instead of overhead — a smaller shape is easier to control.',
  },
  // Power Snatch — full body, highest technical/injury risk
  ex_650: {
    startingPosition: 'Stand with the bar over your midfoot, feet hip-width apart, gripping very wide.',
    movement: 'Pull the bar up explosively in one continuous motion, extending through your hips, then catch it overhead in a partial squat with straight arms.',
    keyCue: 'This is one of the most technical lifts in the library — the bar must stay close to your body the entire way, and the catch demands real shoulder mobility. Learn it from a coach before loading it heavy.',
    feelIt: 'You should feel this as one explosive, coordinated pull, not a series of separate arm movements.',
    regression: 'If the technique isn’t there yet, practice a hang power snatch from the hip first, or work the overhead squat position separately.',
  },
  // Tall Clean (No Dip) — technical drill
  ex_654: {
    startingPosition: 'Stand tall holding the bar at your hips, feet hip-width apart, no knee bend.',
    movement: 'From a standing position, pull the bar up by shrugging and pulling your elbows high, then drop under it to catch it racked at your shoulders.',
    keyCue: 'Keep the bar close to your body the whole way — this drill is about the catch, so focus on dropping fast and stable underneath it.',
    feelIt: 'You should feel this as a fast catch, not a heavy pull — the point is speed getting under the bar, not lifting it high.',
    regression: 'If the catch feels unfamiliar, practice just the front-rack catch position holding an empty bar first.',
  },
  // Single-Leg Hip Thrust (Barbell) — hinge, unilateral
  ex_678: {
    startingPosition: 'Sit on the ground with your upper back against a bench, a bar resting across your hips, one foot flat on the floor and the other leg extended or lifted.',
    movement: 'Drive your hips straight up through your planted foot until your body forms a straight line from shoulders to knee, then lower back down with control.',
    keyCue: 'Keep your hips level — don’t let the unsupported side dip or rotate as you press up.',
    feelIt: 'You should feel this in the glute of your planted leg, not your lower back.',
    regression: 'If this is too much, try a bodyweight single-leg glute bridge instead — same movement, no added load.',
  },
  // Ring Row — pull
  ex_699: {
    startingPosition: 'Hold the gymnastic rings and lean back with arms extended, feet planted, body in a straight line.',
    movement: 'Pull your chest up toward the rings by driving your elbows back, then lower with control.',
    keyCue: 'Keep your body rigid in a straight line — don’t let your hips sag or pike.',
    feelIt: 'You should feel this in your back and biceps, not your lower back.',
    regression: 'If this is too much, walk your feet forward to a more upright angle — the more vertical you are, the easier it gets.',
  },
  // Ring Push-Up — push, unstable
  ex_700: {
    startingPosition: 'Hold the rings just above the floor in a high plank position, body in a straight line.',
    movement: 'Lower your chest toward the rings by bending your elbows, then press back up until your arms are straight.',
    keyCue: 'Keep the rings from wobbling by controlling the movement slowly — the instability is what makes this harder than a regular push-up.',
    feelIt: 'You should feel this across your chest and shoulders, plus extra stabilizing work, not a strain in your wrists.',
    regression: 'If the instability is too much, try a regular push-up on the floor first and build strength there before adding the rings.',
  },
  // Ring Muscle-Up — pull/push, high skill and injury risk
  ex_701: {
    startingPosition: 'Hang from the rings with an active grip, arms straight.',
    movement: 'Pull explosively up and lean your body forward as your hands rotate under the rings, transitioning to a supported position, then press up to straight arms.',
    keyCue: 'This transition is a real fall and wrist-strain risk if you’re not ready — build a strong ring pull-up and ring dip first before attempting the full movement.',
    feelIt: 'You should feel this as one continuous pull-to-press motion, not a stall in the middle.',
    regression: 'If this is too much, practice ring pull-ups and ring dips separately, and try the transition with a resistance band assisting until it clicks.',
  },
  // Trap Bar Jump (Power) — jump, power
  ex_705: {
    startingPosition: 'Stand inside the trap bar with feet hip-width apart, gripping the handles, knees slightly bent.',
    movement: 'Explosively extend your hips, knees, and ankles to jump as high as you can with the bar in hand, then land softly and reset.',
    keyCue: 'Land soft with bent knees to absorb the impact — never land with straight, locked knees.',
    feelIt: 'You should feel this as an explosive full-body effort, not a jolt in your knees on landing.',
    regression: 'If this is too much, use a lighter load or practice the jump without any weight first.',
  },
  // Seal Row (Chest-Supported Barbell Row) — pull
  ex_712: {
    startingPosition: 'Lie face-down on a raised, elevated bench with a bar underneath you, gripping it with both hands, arms extended.',
    movement: 'Pull the bar up toward the bench by driving your elbows back, then lower with control.',
    keyCue: 'Keep your chest pressed into the bench — don’t lift your torso to help pull the weight.',
    feelIt: 'You should feel this in your upper back, not your lower back or shoulders.',
    regression: 'If the weight is too heavy to control smoothly, drop it down until your form stays clean through every rep.',
  },
  // V-Up — core
  ex_719: {
    startingPosition: 'Lie on your back with arms extended overhead and legs straight.',
    movement: 'Simultaneously lift your legs and torso, reaching your hands toward your feet to form a V-shape, then lower back down with control.',
    keyCue: 'Move with control, not momentum — swinging your arms and legs to meet in the middle takes the work away from your abs.',
    feelIt: 'You should feel this in your abs, not your lower back or hip flexors straining.',
    regression: 'If this is too much, try a bent-knee version instead — bring your knees toward your chest rather than keeping legs straight.',
  },
  // Wide-Grip Pull-Up — pull
  ex_720: {
    startingPosition: 'Hang from the bar with arms fully straight, hands well wider than shoulder-width, palms facing away from you.',
    movement: 'Pull yourself up by driving your elbows down and out toward your hips until your chin clears the bar, then lower back down with control.',
    keyCue: 'Keep your body still and controlled — don’t swing or kick your legs to get momentum.',
    feelIt: 'You should feel this across your upper back and lats, not a strain in your shoulders.',
    regression: 'If this is too much, try a regular shoulder-width pull-up or an assisted version with a resistance band.',
  },
  // Shrimp Squat — squat, high skill
  ex_721: {
    startingPosition: 'Stand on one leg, holding your other foot up behind you with the same-side hand.',
    movement: 'Bend your standing knee to lower down, letting your back knee travel toward the floor behind you, then push back up to standing.',
    keyCue: 'Go only as deep as you can control without losing your balance or letting your standing knee cave inward.',
    feelIt: 'You should feel this in your standing thigh and glute, not a strain in your knee.',
    regression: 'If this is too much, try a Bulgarian split squat instead — similar single-leg demand, easier to balance with a bench behind you.',
  },
  // Flat Dumbbell Fly — push, isolation
  ex_722: {
    startingPosition: 'Lie on a flat bench holding a dumbbell in each hand above your chest, palms facing each other, a slight bend in your elbows.',
    movement: 'Lower the dumbbells out to the sides in a wide arc until you feel a stretch across your chest, then bring them back together above your chest.',
    keyCue: 'Keep that slight elbow bend locked in place the whole time — straightening your arms turns this into a shoulder-strain risk instead of a chest stretch.',
    feelIt: 'You should feel a stretch across your chest, not a pinch in the front of your shoulder.',
    regression: 'If this is too much, only lower the dumbbells partway — a smaller range with good control beats a deeper stretch that strains your shoulder.',
  },
  // Block Clean — full body, technical
  ex_749: {
    startingPosition: 'Stand with the bar resting on elevated blocks at about knee height, feet hip-width apart, gripping just outside your knees.',
    movement: 'Pull the bar up explosively off the blocks, extending through your hips, then drop under it to catch it racked at your shoulders.',
    keyCue: 'Keep the bar close to your body the entire pull — this drill starts from a shortened range, so the timing of the catch happens faster than from the floor.',
    feelIt: 'You should feel this as an explosive pull from your hips and legs, not an arm curl.',
    regression: 'If the timing feels off, practice the pull without the catch first, or lower the blocks gradually as your technique improves.',
  },
  // Kettlebell Arm Bar — floor/overhead, stability
  ex_750: {
    startingPosition: 'Lie on your back holding a kettlebell straight up over one shoulder with that arm locked out.',
    movement: 'Keeping your arm locked straight overhead, roll onto your side and then your stomach, using your free arm and legs to help, then reverse back to lying on your back.',
    keyCue: 'Keep your eyes on the kettlebell the whole time — if you lose sight of it, you’ve lost the position.',
    feelIt: 'You should feel this as controlled shoulder stability work, not a strain in your shoulder joint.',
    regression: 'If this is too much, practice with just your arm (no kettlebell) or a very light weight until the rolling pattern feels natural.',
  },
  // Stability Ball Squat (Overhead Hold) — full body, balance
  ex_798: {
    startingPosition: 'Place a stability ball between your lower back and a wall, feet shoulder-width apart, holding a light weight overhead with arms locked out.',
    movement: 'Bend your knees to squat down, letting the ball roll with your back, then drive through your heels to stand while keeping the weight overhead.',
    keyCue: 'Keep your core braced and the weight stacked overhead — don’t let your lower back arch to hold it up.',
    feelIt: 'You should feel this as a whole-body balancing effort in your legs and core, not a strain in your shoulders.',
    regression: 'If holding weight overhead is too much, do the ball squat with your hands empty or on your hips first.',
  },
  // Tuck Front Lever — core/back, high skill
  ex_838: {
    startingPosition: 'Hang from a bar with an overhand grip, arms straight.',
    movement: 'Pull your knees up to your chest and lean your body back until it’s roughly parallel to the floor, holding that tucked horizontal position.',
    keyCue: 'Keep your arms straight throughout — this is a shoulder and core hold, not a pulling exercise, so don’t let your elbows bend to compensate.',
    feelIt: 'You should feel this intensely through your lats and core, not a strain in your elbows.',
    regression: 'If this is too much, practice a hollow body hold on the floor first to build the core strength this position demands.',
  },
  // Front Lever (Full) — core/back, advanced skill
  ex_840: {
    startingPosition: 'Hang from a bar with an overhand grip, arms straight.',
    movement: 'Keeping your entire body straight, lean back and lift until your whole body is horizontal, parallel to the floor, holding that position.',
    keyCue: 'This is an advanced strength hold — if your hips sag or you can’t keep a straight line, you’re not ready for the full version yet. Build through the tuck and advanced-tuck progressions first rather than forcing this position.',
    feelIt: 'You should feel this intensely through your entire back, lats, and core, not a strain in your lower back or shoulders.',
    regression: 'If this is too much, work the tuck front lever or advanced tuck front lever instead — same hold, bent knees reduce the leverage demand.',
  },
  // Human Flag — full body, advanced skill
  ex_843: {
    startingPosition: 'Grip a vertical pole with one hand high and one hand low, body facing sideways to the pole.',
    movement: 'Lift your entire body sideways until it’s horizontal, parallel to the floor, supported only by your grip on the pole.',
    keyCue: 'This demands serious grip and core strength before it’s remotely safe to attempt — build extensive core and pulling strength through simpler holds first, and expect a long progression before this is achievable.',
    feelIt: 'You should feel this intensely through your entire side body, obliques, and shoulders, not a strain in your lower back.',
    regression: 'If this is far out of reach, practice side planks and windshield wipers on the floor to build the oblique strength this requires, well before attempting the pole version.',
  },
  // Tuck Planche — push, advanced skill
  ex_844: {
    startingPosition: 'Start in a crouched position on the floor, hands planted shoulder-width apart, fingers spread.',
    movement: 'Lean your shoulders forward past your hands and lift your feet off the floor, tucking your knees to your chest, balancing your whole bodyweight on your hands.',
    keyCue: 'Keep your shoulders actively pushed away from your hands the whole time — a passive, sunken shoulder position under this much load is a real strain risk.',
    feelIt: 'You should feel this intensely through your shoulders, chest, and core, not a strain in your wrists.',
    regression: 'If this is too much, build wrist and shoulder strength with planche lean holds (feet still on the floor) before lifting your feet at all.',
  },
  // Freestanding Handstand Hold — overhead, balance
  ex_846: {
    startingPosition: 'Kick up into a handstand in open space, hands shoulder-width apart, no wall for support.',
    movement: 'Balance on your hands, making small adjustments with your fingers and wrists to stay upright, for the set time.',
    keyCue: 'Practice near a wall or with a spotter until your balance is reliable — a freestanding handstand can tip over without warning.',
    feelIt: 'You should feel constant small corrections through your wrists and shoulders, not a locked, rigid hold.',
    regression: 'If this is too much, practice against a wall first, either facing it or with your back to it, until your balance and shoulder strength build up.',
  },
  // Handstand Walk — overhead, balance
  ex_847: {
    startingPosition: 'Kick up into a freestanding handstand, hands shoulder-width apart.',
    movement: 'Shift your weight slightly to one hand and take a small step forward with the other, alternating hands to travel forward while staying balanced.',
    keyCue: 'Keep your core braced and hips stacked over your shoulders — over-arching your lower back to stay balanced puts real strain on your spine.',
    feelIt: 'You should feel this as controlled balance shifting through your shoulders and wrists, not a strain in your lower back.',
    regression: 'If this is too much, master a freestanding handstand hold first before adding any movement.',
  },
  // Pause Squat (Barbell) — squat, tempo
  ex_852: {
    startingPosition: 'Stand with feet shoulder-width apart, bar resting across the top of your shoulders.',
    movement: 'Squat down until your thighs are at least parallel to the floor, pause and hold that position for a full 2-3 seconds, then drive through your heels to stand.',
    keyCue: 'Stay tight through the pause — don’t let your hips sink lower or your torso lean forward while you hold.',
    feelIt: 'You should feel constant tension in your quads and glutes through the pause, not a relaxing rest at the bottom.',
    regression: 'If holding the pause breaks your form, shorten it to 1 second, or reduce the weight until you can hold it solidly.',
  },
  // Dead Stop Deadlift (Barbell) — hinge, tempo
  ex_854: {
    startingPosition: 'Stand with feet hip-width apart, bar over your midfoot, and bend down to grip it just outside your knees.',
    movement: 'Stand up by pushing the floor away and driving your hips forward, then lower the bar back to a complete dead stop on the floor before starting the next rep — no bounce.',
    keyCue: 'Reset your full setup — brace, flat back — before every single rep, since there’s no stretch-reflex momentum to rely on here.',
    feelIt: 'You should feel this in your hamstrings and glutes, not a strain in your lower back.',
    regression: 'If resetting fully each rep breaks your form under load, reduce the weight until every rep looks identical to the first.',
  },
  // Smith Machine Squat — squat, fixed path
  ex_113: {
    startingPosition: 'Position the bar across your upper back on the smith machine, feet slightly forward of your hips, unrack it.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Set your feet forward of the bar’s fixed path, since the machine only moves straight up and down, not in the natural slight arc your body wants.',
    feelIt: 'You should feel this in your quads and glutes, not your knees or lower back.',
    regression: 'If finding the right foot position is tricky, try a free-weight goblet squat instead — no fixed path to work around.',
  },
  // Hanging Knee Raise — core, hanging
  ex_182: {
    startingPosition: 'Hang from a pull-up bar with your arms straight.',
    movement: 'Raise your knees up toward your chest by curling your hips under, then lower them back down with control.',
    keyCue: 'Move with control, not momentum — swinging your body to throw your knees up takes the work away from your abs.',
    feelIt: 'You should feel this in your lower abs, not your hip flexors straining or your grip giving out first.',
    regression: 'If this is too much, try it with your knees already bent less deeply, raising them just partway.',
  },
  // Jump Rope — conditioning, coordination
  ex_204: {
    startingPosition: 'Stand tall holding the rope handles, rope behind your heels.',
    movement: 'Swing the rope overhead and jump just high enough to clear it as it passes under your feet, landing softly on the balls of your feet.',
    keyCue: 'Keep your jumps small and quick — bouncing high wastes energy and increases impact on your knees.',
    feelIt: 'You should feel this in your calves and shoulders from the steady rhythm, not a jolt in your knees.',
    regression: 'If timing the rope is hard, practice the jumping motion alone first without a rope, then add it back in.',
  },
  // Bear Crawl — full body, floor
  ex_351: {
    startingPosition: 'Start on your hands and feet, knees hovering just above the floor, hips roughly level with your shoulders.',
    movement: 'Move one hand and the opposite foot forward at the same time, then repeat with the other side, keeping your knees low the whole way.',
    keyCue: 'Keep your hips level and low — don’t let them pop up into a downward-dog shape as you move.',
    feelIt: 'You should feel this in your shoulders, core, and legs from staying low and controlled, not a strain in your lower back.',
    regression: 'If keeping your hips low is hard, take smaller steps or crawl for a shorter distance until your control improves.',
  },
  // Wall Walk — push/overhead, high skill
  ex_353: {
    startingPosition: 'Start in a push-up position with your feet against the base of a wall.',
    movement: 'Walk your feet up the wall while walking your hands in toward the wall, until your body is close to vertical, then reverse back down.',
    keyCue: 'Move slowly and keep your core braced the whole way — this puts real load on your shoulders as you get more vertical, so rushing risks losing control near the top.',
    feelIt: 'You should feel this in your shoulders and core, not a strain in your lower back or neck.',
    regression: 'If this is too much, only walk partway up the wall and build from there rather than going all the way to vertical.',
  },
  // Single-Arm Push-Up (Progression) — push, high skill
  ex_354: {
    startingPosition: 'Start in a push-up position with feet wide for stability, one hand behind your back or on your hip.',
    movement: 'Lower your chest toward the floor using only the one supporting arm, then press back up to straight arms.',
    keyCue: 'Keep your hips square to the floor — don’t let them twist or rotate to help you push up.',
    feelIt: 'You should feel this intensely in the chest, shoulder, and triceps of the working arm, not a strain in your lower back.',
    regression: 'If this is too much, try an archer push-up first — same single-side emphasis, but the other arm still helps.',
  },
  // Clean and Jerk — full body, highest technical/injury risk
  ex_367: {
    startingPosition: 'Stand with the bar over your midfoot, feet hip-width apart, gripping just outside your knees.',
    movement: 'Pull the bar up and catch it racked at your shoulders (the clean), stand up fully, then dip and drive it overhead, splitting or squatting under it to catch it with straight arms (the jerk).',
    keyCue: 'This combines two of the most technical lifts in the library back to back — get each half solid on its own with a coach before linking them under real weight.',
    feelIt: 'You should feel this as two distinct explosive efforts, not one continuous motion — reset your breath and brace between the clean and the jerk.',
    regression: 'If this is too much, practice the power clean and the push press or split jerk separately before combining them.',
  },
  // Tuck Jump — jump, power
  ex_372: {
    startingPosition: 'Stand with feet shoulder-width apart, knees slightly bent.',
    movement: 'Jump straight up and pull both knees up toward your chest at the peak, then land softly with bent knees.',
    keyCue: 'Land soft and quiet with bent knees to absorb the impact — never land with straight, locked knees.',
    feelIt: 'You should feel this as an explosive effort in your legs and core, not a jolt in your knees on landing.',
    regression: 'If this is too much, try a regular squat jump instead — same explosive jump, without pulling your knees up.',
  },
  // Plyo Lunge (Jumping Lunges) — lunge, power
  ex_378: {
    startingPosition: 'Start in a lunge position, one foot forward and one back, both knees bent to about 90 degrees.',
    movement: 'Jump straight up and switch your legs in the air, landing in a lunge with the opposite leg forward, then repeat.',
    keyCue: 'Land soft with bent knees on each switch — this is a real knee-stress movement if you land stiff.',
    feelIt: 'You should feel this as an explosive effort in your thighs and glutes, not a jolt in your knees on landing.',
    regression: 'If this is too much, try a regular walking lunge or reverse lunge instead — same muscles, no jumping impact.',
  },
  // Kettlebell Swing (Russian) — hinge, power
  ex_409: {
    startingPosition: 'Stand with feet shoulder-width apart, kettlebell on the floor a short reach in front of you, both hands on the handle.',
    movement: 'Hinge at your hips to grab the bell, then snap your hips forward to swing it up to about shoulder height, letting your arms just guide it.',
    keyCue: 'This is a hip snap, not a squat and not an arm lift — the bell should only rise to shoulder height, not overhead.',
    feelIt: 'You should feel this in your glutes and hamstrings from the hip snap, not your shoulders or lower back.',
    regression: 'If the hip-hinge timing feels off, practice the hinge alone first without the kettlebell until it feels natural.',
  },
  // Kettlebell Snatch — pull/power, technical
  ex_415: {
    startingPosition: 'Stand with feet shoulder-width apart, kettlebell on the floor between your feet, gripping the handle with one hand.',
    movement: 'Hike the bell back slightly, then pull it up explosively in one continuous motion, punching your hand through so the bell lands softly locked out overhead.',
    keyCue: 'Keep the bell close to your body on the way up and let your hand rotate through the bell smoothly — a late or rushed rotation is what causes it to bang into your wrist or forearm.',
    feelIt: 'You should feel this as one smooth, explosive pull-to-lockout, not a series of separate jerky movements.',
    regression: 'If the wrist rotation feels awkward, practice slowly with a lighter kettlebell, or work the kettlebell high pull first to build the pull pattern.',
  },
  // Kettlebell Windmill — hinge/overhead, mobility and stability
  ex_419: {
    startingPosition: 'Stand holding a kettlebell locked out overhead in one hand, feet wider than shoulder-width, turned slightly away from that arm.',
    movement: 'Keeping your arm locked straight overhead and your eyes on the bell, hinge and rotate at your hips to lower your other hand down toward the floor, then reverse back up.',
    keyCue: 'Keep the overhead arm locked and stacked the entire time — this is a hip and hamstring stretch under overhead stability, not a shoulder movement.',
    feelIt: 'You should feel a stretch in your hamstring and side body, not a strain in your overhead shoulder.',
    regression: 'If this is too much, practice the hip hinge and rotation without any weight overhead first.',
  },
  // Medicine Ball Wall Ball — full body, squat + throw
  ex_424: {
    startingPosition: 'Stand holding a medicine ball at your chest, facing a wall, feet shoulder-width apart.',
    movement: 'Squat down until your thighs are at least parallel to the floor, then stand up explosively and throw the ball against the wall at a target above head height, catching it as it comes back down.',
    keyCue: 'Use your legs to generate the throw, not just your arms — the squat drive should do most of the work.',
    feelIt: 'You should feel this as one connected effort from your legs into the throw, not just your shoulders.',
    regression: 'If this is too much, do the squat and an overhead press with the ball as two separate movements first.',
  },
  // RKC Plank — core, max-tension hold
  ex_469: {
    startingPosition: 'Start in a forearm plank position, elbows under your shoulders.',
    movement: 'Hold the plank while actively squeezing your glutes, quads, and abs as hard as possible, pulling your elbows toward your toes without actually moving.',
    keyCue: 'This is a maximum-tension hold, not a relaxed hold — you should be gripping the floor and bracing everything, which is why it’s held for a much shorter time than a regular plank.',
    feelIt: 'You should feel this as full-body tension everywhere, not just your abs.',
    regression: 'If holding max tension the whole time is too much, try a regular plank first and build up to adding the extra full-body squeeze.',
  },
  // Reverse Plank — full body
  ex_482: {
    startingPosition: 'Sit on the floor with legs extended, hands placed behind your hips, fingers pointing toward your feet.',
    movement: 'Press through your hands and heels to lift your hips up until your body forms a straight line, then hold.',
    keyCue: 'Keep your hips lifted high — don’t let them sag toward the floor partway through the hold.',
    feelIt: 'You should feel this in your glutes, hamstrings, and the backs of your shoulders, not your wrists.',
    regression: 'If this is too much, bend your knees with feet flat on the floor instead of legs extended straight — much easier to hold.',
  },
  // Single-Arm Dumbbell Snatch — pull/power, technical
  ex_490: {
    startingPosition: 'Stand with feet shoulder-width apart, dumbbell on the floor between your feet.',
    movement: 'Hike the dumbbell back slightly, then pull it up explosively close to your body, punching your arm straight up so it locks out overhead in one motion.',
    keyCue: 'Keep the dumbbell close to your body on the way up — swinging it out away from you makes the overhead catch unpredictable.',
    feelIt: 'You should feel this as one explosive, coordinated pull, not an arm curl followed by a press.',
    regression: 'If the timing feels off, practice a dumbbell high pull first (same movement, no overhead catch) to build the pulling pattern.',
  },
  // Single-Leg RDL (Barbell, Symmetric Load) — hinge, unilateral
  ex_496: {
    startingPosition: 'Stand on one leg holding the bar at your thighs with both hands, slight bend in your standing knee.',
    movement: 'Hinge forward at your hips, letting your free leg extend back for balance, until your torso is roughly parallel to the floor, then return to standing.',
    keyCue: 'Keep the bar close to your body and your hips square — don’t let them rotate open as you hinge.',
    feelIt: 'You should feel a stretch in the hamstring of your standing leg, not your lower back.',
    regression: 'If balance is hard, try it with a dumbbell in one hand instead — easier to reset your grip between reps.',
  },
  // TRX Pistol Squat — squat, high skill, assisted
  ex_504: {
    startingPosition: 'Hold the TRX handles for support, standing on one leg, other leg extended out in front of you.',
    movement: 'Bend your standing knee to lower down as far as you can control, using the straps for balance, then push back up to standing.',
    keyCue: 'Use the straps for balance, not to pull yourself up — let your leg do the actual work of standing back up.',
    feelIt: 'You should feel this in your standing thigh and glute, not your arms pulling on the straps.',
    regression: 'If this is too much, only squat down partway, or use a lower box to sit back onto instead of going all the way down.',
  },
  // Glute Ham Raise (GHR) — hinge, eccentric
  ex_511: {
    startingPosition: 'Kneel on the GHR pad with your ankles secured behind the footplate, torso upright.',
    movement: 'Slowly lower your torso toward the floor by letting your knees bend, then use your hamstrings and glutes to pull yourself back up to upright.',
    keyCue: 'Control the descent the entire way down — this is an eccentric-strength movement, and dropping too fast is where hamstring strains happen.',
    feelIt: 'You should feel this in the back of your thighs and glutes, not your lower back.',
    regression: 'If this is too much, try a Nordic hamstring curl on the floor instead, or only lower partway on the GHR machine.',
  },
  // Behind-the-Neck Press (Barbell) — overhead, high mobility demand
  ex_512: {
    startingPosition: 'Stand with feet shoulder-width apart, bar resting behind your neck across your upper traps, hands wide.',
    movement: 'Press the bar straight up overhead until your arms are extended, then lower it back behind your neck with control.',
    keyCue: 'This demands real shoulder mobility — only go as high as you can press without your neck craning forward or your shoulder pinching. If it doesn’t feel clean, stop and use a front press instead.',
    feelIt: 'You should feel this in your shoulders, not a pinch at the front or back of your shoulder joint.',
    regression: 'If this doesn’t feel comfortable at all, use a standard front-loaded overhead press instead — same muscles, far less shoulder-mobility demand.',
  },
  // Reverse Nordic Curl (Quadriceps) — squat, eccentric
  ex_516: {
    startingPosition: 'Kneel upright with your ankles anchored or held, torso and thighs in one straight line.',
    movement: 'Lean your torso back as one straight unit from your knees, going as far as you can control, then pull yourself back up to kneeling.',
    keyCue: 'Keep your hips extended the whole time — this is a straight-line lean from the knees, not a hip hinge.',
    feelIt: 'You should feel a deep stretch and burn in your quads, not your lower back.',
    regression: 'If this is too much, only lean back a small amount — a shorter, controlled range beats a deeper one you can’t pull back from.',
  },
  // Sissy Squat — squat, knee-dominant
  ex_517: {
    startingPosition: 'Stand holding onto something for balance, feet hip-width apart, rising onto your toes.',
    movement: 'Keeping your hips extended and your body leaning back as one straight line, bend your knees to lower down, then use your quads to pull yourself back up.',
    keyCue: 'Keep your hips pushed forward and extended the whole time — this is a knee-dominant lean, not a hip-back squat.',
    feelIt: 'You should feel an intense stretch and burn in your quads, not your knees.',
    regression: 'If this is too much, only lower down a small amount, holding on with both hands for support the whole time.',
  },
  // Belt Squat — squat, hip-loaded
  ex_519: {
    startingPosition: 'Attach the belt around your hips and stand on the platform, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Keep your torso upright — since the load hangs from your hips rather than sitting on your back, don’t fight it by leaning forward.',
    feelIt: 'You should feel this in your quads and glutes, with none of the spinal loading of a barbell squat.',
    regression: 'If a belt squat machine isn’t available, a goblet squat gives a similar torso-upright squat pattern.',
  },
  // Weighted Pull-Up — pull
  ex_522: {
    startingPosition: 'Attach a weight belt or hold a dumbbell between your feet, then hang from the bar with arms fully straight.',
    movement: 'Pull yourself up by driving your elbows down toward your hips until your chin clears the bar, then lower back down with control.',
    keyCue: 'Only add weight once your bodyweight pull-ups are clean and controlled — extra load on a breaking-down pull-up is how shoulders get hurt.',
    feelIt: 'You should feel this in your back and biceps, not a strain in your shoulders.',
    regression: 'If the added weight breaks your form, drop it and build more bodyweight pull-up volume first.',
  },
  // Neutral-Grip Pull-Up — pull
  ex_523: {
    startingPosition: 'Hang from parallel handles with your palms facing each other, arms fully straight.',
    movement: 'Pull yourself up by driving your elbows down toward your hips until your chin clears the handles, then lower back down with control.',
    keyCue: 'Keep your body still and controlled — don’t swing or kick your legs to get momentum.',
    feelIt: 'You should feel this in your back and biceps, not a strain in your shoulders.',
    regression: 'If this is too much, try an assisted version with a resistance band looped under your feet.',
  },
  // Weighted Dip — push
  ex_527: {
    startingPosition: 'Attach a weight belt or hold a dumbbell between your feet, then support yourself on parallel bars with arms straight.',
    movement: 'Lower your body by bending your elbows until your shoulders are about level with your elbows, then press back up to straight arms.',
    keyCue: 'Only add weight once your bodyweight dips are clean and controlled to full depth without shoulder discomfort — extra load makes any existing form break worse.',
    feelIt: 'You should feel this in your chest and triceps, not a pinch in the front of your shoulder.',
    regression: 'If the added weight breaks your depth or control, drop it and build more bodyweight dip volume first.',
  },
  // Ring Dip — push, unstable
  ex_528: {
    startingPosition: 'Support yourself on gymnastic rings with arms straight, body hanging below.',
    movement: 'Lower your body by bending your elbows until your shoulders are about level with your elbows, then press back up to straight arms.',
    keyCue: 'Keep the rings from turning out or wobbling by actively pressing them down and slightly in — the instability is what makes this harder than a fixed-bar dip.',
    feelIt: 'You should feel this in your chest and triceps, plus extra stabilizing work, not a pinch in the front of your shoulder.',
    regression: 'If the instability or depth is too much, try a fixed parallel bar dip first and build strength there before moving to rings.',
  },
  // Barbell Z-Press — overhead, core demand
  ex_567: {
    startingPosition: 'Sit on the floor with legs extended straight out in front of you, bar racked at your shoulders.',
    movement: 'Press the bar straight up overhead until your arms are extended, then lower it back to your shoulders with control.',
    keyCue: 'Sit up tall through your core the whole time — with no leg drive or back support available, your torso alone controls the bar’s balance.',
    feelIt: 'You should feel this in your shoulders and core working together, not a strain in your lower back.',
    regression: 'If sitting upright with the bar overhead is too much, try a seated dumbbell press with back support instead.',
  },
  // Barbell Box Squat — squat, controlled depth
  ex_573: {
    startingPosition: 'Stand in front of a box or bench at or below parallel height, bar racked across your upper back.',
    movement: 'Push your hips back and bend your knees to lower down until you sit lightly on the box, then drive through your heels to stand back up.',
    keyCue: 'Sit back onto the box under control — don’t just drop and bounce off it, which turns this into a jarring impact instead of a controlled squat.',
    feelIt: 'You should feel this in your quads and glutes, not a jolt through your tailbone or lower back.',
    regression: 'If sitting back onto a low box is hard, use a higher box until your hip mobility and control improve.',
  },
  // Barbell Anderson Squat (Dead-Stop, Pin Squat) — squat, dead-stop strength
  ex_574: {
    startingPosition: 'Set safety pins in a squat rack at the bottom of your squat depth, bar resting on the pins.',
    movement: 'Unrack the bar from a dead stop at the bottom, then drive through your heels to stand up without any downward momentum to start.',
    keyCue: 'Brace hard before you start each rep — there’s no stretch-reflex bounce to help here, so your setup and bracing do all the work of getting the bar moving.',
    feelIt: 'You should feel this in your quads and glutes as pure starting strength, not a strain in your lower back.',
    regression: 'If starting from a dead stop is too much, reduce the weight until you can drive up cleanly without your torso collapsing forward.',
  },
  // Dumbbell Deadlift (Conventional Stance) — hinge
  ex_588: {
    startingPosition: 'Stand with feet hip-width apart, a dumbbell in each hand in front of your thighs.',
    movement: 'Push your hips back and lower the dumbbells down your legs while keeping your back flat, then drive your hips forward to stand back up.',
    keyCue: 'Your back stays flat from start to finish — it never rounds, even a little.',
    feelIt: 'You should feel this in your hamstrings and glutes, not a strain in your lower back.',
    regression: 'If it’s hard to keep your back flat through the full range, only lower the dumbbells as far as you can control.',
  },
  // Single-Leg Cable Romanian Deadlift — hinge, unilateral
  ex_883: {
    startingPosition: 'Stand on one leg facing the cable machine, holding the low handle with both hands, slight bend in your standing knee.',
    movement: 'Hinge forward at your hips, letting your free leg extend back for balance, until your torso is roughly parallel to the floor, then return to standing.',
    keyCue: 'Keep your hips square to the floor — don’t let them rotate open.',
    feelIt: 'You should feel a stretch in the hamstring of your standing leg, not your lower back.',
    regression: 'If balance is hard, hold onto something light for support, or do it without the cable first.',
  },
  // Single-Leg Deadlift (Bodyweight) — hinge, unilateral
  ex_886: {
    startingPosition: 'Stand on one leg, hands at your sides or reaching toward the floor, slight bend in your standing knee.',
    movement: 'Hinge forward at your hips, letting your free leg extend straight back for balance, until your torso is roughly parallel to the floor, then return to standing.',
    keyCue: 'Keep your hips square to the floor — don’t let them rotate open as you reach down.',
    feelIt: 'You should feel a stretch in the hamstring of your standing leg, not your lower back.',
    regression: 'If balance is hard, hold onto something light for support, or only hinge partway down.',
  },
  // Alternating Kettlebell Swing — hinge, power, coordination
  ex_890: {
    startingPosition: 'Stand with feet shoulder-width apart, kettlebell on the floor a short reach in front of you.',
    movement: 'Hinge at your hips to grab the bell, then snap your hips forward to swing it up to chest height, switching hands at the top of each swing.',
    keyCue: 'The hand switch happens at the top, not mid-air on the way up or down — grab cleanly with the new hand only once the bell is at its highest point.',
    feelIt: 'You should feel this in your glutes and hamstrings from the hip snap, not your shoulder from the switch.',
    regression: 'If the hand switch feels risky, master a two-handed swing first before adding the switch.',
  },
  // 1.5 Rep Squat (Barbell) — squat, time under tension
  ex_895: {
    startingPosition: 'Stand with feet shoulder-width apart, bar resting across the top of your shoulders.',
    movement: 'Squat down to full depth, rise halfway up, lower back down to full depth again, then drive all the way up to standing — that’s one rep.',
    keyCue: 'Keep your core braced through the entire sequence — the extra time under tension at depth is what makes this harder, so don’t rush the halfway pulse.',
    feelIt: 'You should feel constant tension in your quads and glutes throughout, more than a regular squat.',
    regression: 'If the extra pulse breaks your form, reduce the weight until you can complete the full sequence with control.',
  },
  // 1.5 Rep Bench Press (Barbell) — push, time under tension
  ex_896: {
    startingPosition: 'Lie on the bench with your eyes under the bar, feet flat on the floor, grip slightly wider than shoulder-width.',
    movement: 'Lower the bar to your chest, press halfway up, lower back to your chest again, then press all the way to straight arms — that’s one rep.',
    keyCue: 'Keep your elbows at roughly a 45-degree angle throughout — the extra time under tension at the bottom is what makes this harder, so don’t rush the halfway pulse.',
    feelIt: 'You should feel constant tension across your chest throughout, more than a regular bench press.',
    regression: 'If the extra pulse breaks your form, reduce the weight until you can complete the full sequence with control.',
  },
  // Pilates Hundred — core, sustained hold
  ex_897: {
    startingPosition: 'Lie on your back with knees bent to tabletop, upper back and shoulders curled slightly off the floor, arms extended by your sides.',
    movement: 'Pump your arms up and down in small, quick pulses while breathing in for 5 pulses and out for 5, extending your legs out at whatever angle you can hold with a flat lower back.',
    keyCue: 'Keep your lower back pressed into the floor the entire time — if it arches up, lower your legs to a higher angle until you can maintain contact.',
    feelIt: 'You should feel this deep in your abs from the sustained hold, not your neck straining.',
    regression: 'If this is too much, keep your knees bent at tabletop instead of extending your legs, and hold for fewer total pulses.',
  },
  // Pilates Jackknife — core, spinal roll
  ex_907: {
    startingPosition: 'Lie on your back with legs extended straight up toward the ceiling, arms flat at your sides.',
    movement: 'Roll your hips off the floor and swing your legs up and slightly back overhead, then reverse with control, rolling back down through your spine.',
    keyCue: 'Move through your spine slowly and with control — this is a demanding roll for your neck and lower back if rushed.',
    feelIt: 'You should feel this deep in your abs controlling the roll, not a strain in your neck.',
    regression: 'If this is too much, try a Pilates roll-up instead — same spinal-control idea, without the overhead leg swing.',
  },
  // Suitcase Squat (Offset Load) — squat, anti-lateral-flexion
  ex_918: {
    startingPosition: 'Stand holding a dumbbell in just one hand at your side, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Keep your torso upright and resist leaning toward the loaded side — the offset weight is trying to pull you off-balance.',
    feelIt: 'You should feel this in your quads and glutes, plus extra core work resisting the sideways pull, not a strain in your lower back.',
    regression: 'If staying upright is hard, use a lighter dumbbell or hold it with both hands centered instead.',
  },
  // Typewriter Pull-Up — pull, high skill
  ex_923: {
    startingPosition: 'Hang from the bar with arms straight, hands wider than shoulder-width.',
    movement: 'Pull yourself up so your chin is over one hand, then shift your body sideways to bring your chin over the other hand while staying up, before lowering back down.',
    keyCue: 'Keep your pull-up height steady while you shift sideways — dropping down mid-shift defeats the point of the drill.',
    feelIt: 'You should feel this in your back and biceps, with extra single-side emphasis as you shift, not a strain in your shoulders.',
    regression: 'If this is too much, master a strong regular pull-up first before adding the sideways shift at the top.',
  },
  // Commando Pull-Up — pull, high skill
  ex_924: {
    startingPosition: 'Hang from the bar with one hand in front of the other, gripping it like a ladder rung, body facing sideways to the bar.',
    movement: 'Pull yourself up so your head passes to one side of the bar, then alternate sides on the next rep.',
    keyCue: 'Keep your body from swinging side to side — control the alternating pattern rather than using momentum to swap sides.',
    feelIt: 'You should feel this in your back and biceps on each side as you alternate, not a strain in your shoulders.',
    regression: 'If this is too much, try a regular pull-up first and add the sideways head position once your pulling strength is solid.',
  },
  // L-Sit Pull-Up — pull/core, high skill
  ex_925: {
    startingPosition: 'Hang from the bar with arms straight, legs extended straight out in front of you in an L-shape.',
    movement: 'Keeping your legs raised the entire time, pull yourself up until your chin clears the bar, then lower back down with control.',
    keyCue: 'Keep your legs up throughout the whole pull — letting them drop turns this into a regular pull-up and defeats the point.',
    feelIt: 'You should feel this intensely in your back, biceps, and core together, not just your arms.',
    regression: 'If this is too much, master an L-sit hold and a regular pull-up separately first, then combine them once both are solid on their own.',
  },
  // Pseudo Planche Push-Up — push, high skill
  ex_926: {
    startingPosition: 'Start in a push-up position with your hands turned out and positioned further back than usual, near your hips.',
    movement: 'Lean your shoulders forward past your hands, then lower your chest toward the floor and press back up, keeping that forward lean the whole time.',
    keyCue: 'Keep your shoulders actively pushed away from your hands — a sunken shoulder position under this forward-leaning load is a real strain risk.',
    feelIt: 'You should feel this intensely in your shoulders and chest, not a strain in your wrists.',
    regression: 'If this is too much, try a regular push-up first and gradually walk your hands back toward your hips over time.',
  },
  // Windshield Wiper (Hanging) — core, rotation
  ex_936: {
    startingPosition: 'Hang from a pull-up bar with your legs raised up in front of you.',
    movement: 'Keeping your legs together, rotate them side to side like a windshield wiper, using your core to control the swing.',
    keyCue: 'Move slowly and with control — this rotational movement puts real torque through your lower back if you swing too fast.',
    feelIt: 'You should feel this in your obliques and core, not a strain in your lower back or shoulders.',
    regression: 'If this is too much, bend your knees to shorten the lever, or only rotate a small distance to each side.',
  },
  // Burpee Broad Jump — full body, conditioning
  ex_939: {
    startingPosition: 'Stand with feet shoulder-width apart.',
    movement: 'Drop into a squat, kick your feet back into a plank, do a push-up, jump your feet back in, then immediately jump forward as far as you can and land softly.',
    keyCue: 'Land the broad jump with bent knees and reset your balance before starting the next rep — landing off-balance while fatigued is where ankle and knee rolls happen.',
    feelIt: 'You should feel this as a fast full-body effort, not a jolt in your knees or ankles on landing.',
    regression: 'If this is too much, do a regular burpee first, or step instead of jump for the forward broad jump portion.',
  },
  // Burpee Pull-Up — full body, conditioning
  ex_940: {
    startingPosition: 'Stand under a pull-up bar with feet shoulder-width apart.',
    movement: 'Drop into a squat, kick your feet back into a plank, do a push-up, jump your feet back in, then jump up and pull yourself up until your chin clears the bar.',
    keyCue: 'Reset your grip solidly before pulling — grabbing the bar off-balance while fatigued from the burpee portion is how shoulders get tweaked.',
    feelIt: 'You should feel this as a fast full-body effort transitioning into a controlled pull, not a jerky grab at the bar.',
    regression: 'If this is too much, do a regular burpee with a jump to touch the bar instead of a full pull-up.',
  },
  // Single-Arm Dumbbell Overhead Press — overhead, unilateral
  ex_946: {
    startingPosition: 'Stand with feet shoulder-width apart, holding one dumbbell at your shoulder, other hand free or on your hip.',
    movement: 'Press the dumbbell straight up until your arm is extended, then lower it back to your shoulder with control.',
    keyCue: 'Keep your core braced and your torso upright — don’t let the offset weight pull you into a side lean.',
    feelIt: 'You should feel this in your shoulder and triceps, plus extra core work staying upright, not a strain in your lower back.',
    regression: 'If staying upright is hard, use a lighter weight or try a seated version instead.',
  },
  // Eccentric-Only Pull-Up — pull, tempo
  ex_951: {
    startingPosition: 'Jump or step up to the top position of a pull-up, chin over the bar, arms bent.',
    movement: 'Lower yourself down as slowly as you can control, taking several seconds to reach a full hang, then reset at the top for the next rep.',
    keyCue: 'Fight the descent the whole way down — the value of this drill is entirely in resisting gravity slowly, not letting yourself drop.',
    feelIt: 'You should feel this as a long, building burn in your back and biceps, not a quick drop.',
    regression: 'If holding the slow lower is too much, use a resistance band for a little assistance, or shorten the lowering time as you build strength.',
  },
  // Eccentric-Only Squat (Barbell) — squat, tempo
  ex_953: {
    startingPosition: 'Stand with feet shoulder-width apart, bar racked across your upper back.',
    movement: 'Lower down into the squat as slowly as you can control, taking several seconds to reach depth, then either rerack the bar or have a spotter/rack help you back up.',
    keyCue: 'Keep your core braced and back flat through the whole slow descent — the point is resisting the weight, not just riding it down.',
    feelIt: 'You should feel constant, building tension in your quads and glutes through the descent, not a fast drop.',
    regression: 'If this is too much, use a lighter weight, or do a regular-tempo squat first and only add the slow eccentric once your form is solid.',
  },
  // Barbell Bulgarian Split Squat — squat, unilateral, loaded
  ex_957: {
    startingPosition: 'Stand a couple feet in front of a bench, rest one foot behind you on top of it, bar racked across your upper back.',
    movement: 'Lower your back knee straight down toward the floor by bending your front leg, then push through your front foot to stand back up.',
    keyCue: 'Keep your front knee tracking over your ankle — don’t let it drift forward past your toes.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If balance with the bar is hard, use dumbbells at your sides instead — easier to drop if you lose balance.',
  },
  // Warrior II Pose — squat, mobility hold
  ex_970: {
    startingPosition: 'Stand with feet wide apart, front foot pointing forward and back foot turned out to the side.',
    movement: 'Bend your front knee to about 90 degrees while keeping your back leg straight, arms extended out to the sides at shoulder height, and hold.',
    keyCue: 'Keep your front knee tracking directly over your ankle — don’t let it drift inward or past your toes.',
    feelIt: 'You should feel this in your front thigh and both inner thighs, not a strain in your front knee.',
    regression: 'If holding a deep front bend is too much, shorten your stance or bend your front knee less.',
  },
  // Chain Squat (Barbell) — squat, accommodating resistance
  ex_973: {
    startingPosition: 'Stand with feet shoulder-width apart, bar racked across your upper back, chains hanging from each end of the bar.',
    movement: 'Squat down until your thighs are at least parallel to the floor, then drive through your heels to stand — the chains lift off the floor as you rise, adding resistance at the top.',
    keyCue: 'Drive through the top of the lift with the same control as the bottom — the load actually increases as you stand up, so don’t ease off at lockout.',
    feelIt: 'You should feel this in your quads and glutes throughout, with noticeably more resistance near the top than a regular squat.',
    regression: 'If the changing resistance feels unpredictable, try a regular barbell squat first without chains.',
  },
  // Stiff-Leg Deadlift (Barbell) — hinge
  ex_986: {
    startingPosition: 'Stand holding the bar at your thighs, feet hip-width apart, knees nearly straight with only a very slight bend.',
    movement: 'Push your hips straight back while lowering the bar down your legs, keeping it close to your body, until you feel a deep stretch in your hamstrings, then drive your hips forward to stand back up.',
    keyCue: 'Your back stays flat the entire time — with straighter knees than a regular Romanian deadlift, there’s more temptation to round to reach depth, so stop before that happens.',
    feelIt: 'You should feel a deep stretch in your hamstrings, not your lower back.',
    regression: 'If keeping your back flat with nearly straight knees is hard, allow a bit more knee bend like a Romanian deadlift instead.',
  },
  // Jefferson Deadlift — hinge, asymmetric stance
  ex_988: {
    startingPosition: 'Straddle the bar with one foot forward and one foot back, gripping it with one hand in front of your body and one behind.',
    movement: 'Stand up by pushing the floor away with your legs and driving your hips forward, keeping your torso as upright as the straddled stance allows.',
    keyCue: 'Keep your weight balanced between both feet — the asymmetric stance and grip make this easy to pull unevenly if you’re not deliberate.',
    feelIt: 'You should feel this in your quads, hamstrings, and glutes on both sides, not a twist through your lower back.',
    regression: 'If the asymmetric stance feels awkward, try a trap bar deadlift instead — similar upright torso position, more symmetric setup.',
  },
  // Heels-Elevated Squat (Barbell) — squat
  ex_989: {
    startingPosition: 'Stand on a small wedge or plates under your heels, feet shoulder-width apart, bar racked across your upper back.',
    movement: 'Squat down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'The elevated heels let your torso stay more upright, but don’t let that turn into leaning forward from your hips instead — keep the same braced core.',
    feelIt: 'You should feel this more in your quads than a flat-footed squat, not a strain in your lower back.',
    regression: 'If balance on the wedge feels unstable, use a lower heel elevation or go back to a flat-footed squat.',
  },
  // Meadows Row — pull, landmine
  ex_992: {
    startingPosition: 'Stand sideways to a landmine-anchored bar, hinge forward at your hips, and grip the end of the bar with one hand.',
    movement: 'Pull the bar up toward your hip by driving your elbow back, then lower it back down with control.',
    keyCue: 'Keep your back flat and your torso still in the hinge — don’t twist or jerk to help lift the weight.',
    feelIt: 'You should feel this in your upper back and lat, not your lower back.',
    regression: 'If holding the hinge is hard, try a chest-supported single-arm row on an incline bench instead.',
  },
  // Standing T-Bar Row — pull, landmine
  ex_993: {
    startingPosition: 'Straddle the landmine bar, hinge forward at your hips, and grip the handles with both hands, arms extended.',
    movement: 'Pull the handles up toward your chest by driving your elbows back, then lower with control.',
    keyCue: 'Keep your back flat and your torso still — don’t jerk your body up to help lift the weight.',
    feelIt: 'You should feel this in your upper back, not your lower back.',
    regression: 'If holding the hinge is hard, try a chest-supported T-bar row on an angled pad instead.',
  },
  // Spanish Squat — squat, band-assisted quad emphasis
  ex_997: {
    startingPosition: 'Loop a resistance band around a sturdy anchor and around the backs of your knees, standing facing away from the anchor with the band taut.',
    movement: 'Squat down by bending your knees while keeping your torso upright, leaning back slightly into the band’s tension, then stand back up.',
    keyCue: 'Lean into the band and keep your shins as vertical as possible — the band lets you load your quads without your knees traveling forward.',
    feelIt: 'You should feel an intense burn in your quads, not your lower back or knees.',
    regression: 'If this is too much, reduce the band tension or shorten how deep you squat.',
  },
  // B-Stance Romanian Deadlift (Dumbbell) — hinge, semi-unilateral
  ex_1005: {
    startingPosition: 'Stand holding a dumbbell in each hand, one foot slightly staggered behind the other with just the toes of the back foot touching down.',
    movement: 'Push your hips straight back while lowering the dumbbells down your legs, keeping them close to your body, until you feel a stretch in your hamstrings, then drive your hips forward to stand back up.',
    keyCue: 'Keep most of your weight on your front leg — the back foot is just there for light balance support, not to share the load.',
    feelIt: 'You should feel a stretch in the hamstring of your front leg, not your lower back.',
    regression: 'If balance is still hard, stagger your stance less, or go back to a regular two-foot Romanian deadlift.',
  },
  // Archer Pull-Up — pull, high skill
  ex_1028: {
    startingPosition: 'Hang from the bar with hands wider than shoulder-width, arms straight.',
    movement: 'Pull yourself up toward one hand, keeping the other arm mostly straight out to the side, then lower and repeat toward the other hand.',
    keyCue: 'Keep your body from twisting — pull straight up toward the working side rather than rotating your torso to fake the range.',
    feelIt: 'You should feel this heavily in the back and bicep of the pulling-side arm, not a strain in your shoulder.',
    regression: 'If this is too much, try a regular pull-up first and build strength there before adding the single-side emphasis.',
  },
  // Skater Squat — squat, unilateral, high skill
  ex_1029: {
    startingPosition: 'Stand on one leg, other leg bent and held behind you, arms out for balance.',
    movement: 'Bend your standing knee to lower down as far as you can control, letting your back knee lightly tap the floor behind you, then push back up to standing.',
    keyCue: 'Go only as deep as you can control without losing your balance or letting your standing knee cave inward.',
    feelIt: 'You should feel this in your standing thigh and glute, not a strain in your knee.',
    regression: 'If this is too much, hold onto something for support, or don’t go all the way down to a light tap.',
  },
  // Toes-to-Bar — core, hanging
  ex_1037: {
    startingPosition: 'Hang from a pull-up bar with your arms straight, legs extended below you.',
    movement: 'Keeping your legs together, raise them up until your toes touch the bar, then lower back down with control.',
    keyCue: 'Move with control on the way down as well as up — swinging wildly to generate momentum is a real shoulder-strain risk over many reps.',
    feelIt: 'You should feel this in your abs, not your shoulders straining or your grip giving out first.',
    regression: 'If this is too much, try a hanging knee raise instead — same hanging core pattern, shorter lever.',
  },
  // Wheel Pose (Urdhva Dhanurasana) — full body, backbend
  ex_1086: {
    startingPosition: 'Lie on your back with knees bent, feet flat near your hips, hands planted by your ears with fingers pointing toward your shoulders.',
    movement: 'Press through your hands and feet to lift your entire body into a backbend, straightening your arms as much as you comfortably can.',
    keyCue: 'This is a significant spinal extension — only go as far as feels open and supported, and never force your arms straight if your shoulders or back resist.',
    feelIt: 'You should feel an even stretch through your whole front body, not a pinch concentrated in one spot of your lower back.',
    regression: 'If this is too much, try a bridge pose instead — same backbend direction, hips lifted with your head and shoulders staying on the floor.',
  },
  // Shoulder Stand (Sarvangasana) — full body, inversion
  ex_1095: {
    startingPosition: 'Lie on your back, then lift your legs and hips up, supporting your lower back with your hands, elbows on the floor.',
    movement: 'Extend your legs straight up toward the ceiling, balancing your weight on your shoulders and upper arms, and hold.',
    keyCue: 'Never turn your head side to side while in this position — with your bodyweight loading your neck, that twisting motion is a real neck-injury risk.',
    feelIt: 'You should feel this as a supported balance through your shoulders and core, not pressure or strain in your neck.',
    regression: 'If this is too much, try Legs Up The Wall instead — a similar inverted-leg benefit with none of the neck loading.',
  },
  // Deficit Push-Up — push, extended range
  ex_1115: {
    startingPosition: 'Place your hands on two elevated platforms (like blocks or dumbbells), body in a straight line, feet on the floor.',
    movement: 'Lower your chest down below the level of your hands into the gap between the platforms, then press back up to straight arms.',
    keyCue: 'Lower only as deep as your shoulders comfortably allow — the extra range is valuable, but forcing past a comfortable stretch risks the front of your shoulder.',
    feelIt: 'You should feel a deeper stretch across your chest than a regular push-up, not a pinch in your shoulder.',
    regression: 'If this is too much, try a regular push-up on the floor first and build strength there before adding the extra depth.',
  },
  // Zombie Squat — squat, counterbalance drill
  ex_1120: {
    startingPosition: 'Stand with feet shoulder-width apart, arms extended straight out in front of you at shoulder height.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, keeping your arms extended forward the whole time, then drive through your heels to stand.',
    keyCue: 'Keep your arms up and extended — they’re there to counterbalance your torso and keep you from leaning too far forward.',
    feelIt: 'You should feel this in your quads and glutes, plus your shoulders holding the arm position, not a strain in your lower back.',
    regression: 'If holding your arms up the whole time is tiring, try a regular bodyweight squat first.',
  },
  // B-Stance Squat — squat, semi-unilateral
  ex_1122: {
    startingPosition: 'Stand with one foot forward and most of your weight on it, other foot staggered slightly back with just the toes touching down.',
    movement: 'Bend your front knee to squat down, letting your back leg assist lightly for balance, then drive through your front foot to stand back up.',
    keyCue: 'Keep the majority of your weight on your front leg — the back foot is there for light balance support, not to share the load.',
    feelIt: 'You should feel this mostly in your front thigh and glute, not your lower back.',
    regression: 'If balance is hard, stagger your stance less, or go back to a regular two-foot squat.',
  },
  // Yates Row — pull
  ex_1123: {
    startingPosition: 'Stand with feet hip-width apart, hinge forward at your hips to about a 45-degree torso angle, and grip the bar with an underhand grip.',
    movement: 'Pull the bar up toward your lower stomach by driving your elbows back, then lower it back down with control.',
    keyCue: 'Keep your torso at that same angle throughout — don’t stand up taller to help lift the weight.',
    feelIt: 'You should feel this in your upper back and lats, not your lower back.',
    regression: 'If holding the more upright hinge angle is hard, try a regular bent-over row at a deeper angle instead.',
  },
  // Kroc Row — pull, loose-form heavy row
  ex_1124: {
    startingPosition: 'Place one knee and hand on a bench for support, holding a heavy dumbbell in the other hand with your arm hanging straight down.',
    movement: 'Pull the dumbbell up toward your hip with some body English allowed, using a bit of hip drive and torso rotation to move heavier weight than a strict row.',
    keyCue: 'Even with the extra body motion, keep your back flat throughout — this is a controlled heave, not an uncontrolled yank.',
    feelIt: 'You should feel this in your back and grip, with a bit of assist from your hips, not a strain in your lower back.',
    regression: 'If this feels too loose or uncontrolled, go back to a strict single-arm dumbbell row instead.',
  },
  // Kettlebell Overhead Squat (Single-Arm) — squat/overhead, balance
  ex_1136: {
    startingPosition: 'Press a kettlebell overhead until your arm is locked out, feet shoulder-width apart.',
    movement: 'Keeping the kettlebell locked overhead, push your hips back and bend your knees to squat down, then drive through your heels to stand.',
    keyCue: 'Keep your eyes on the kettlebell and your arm locked out directly overhead — if it drifts forward, you’ll lose the position.',
    feelIt: 'You should feel this as a whole-body balancing effort in your legs, core, and shoulder, not a strain in your lower back.',
    regression: 'If this is too much, practice holding the kettlebell overhead without squatting first, or use a lighter weight.',
  },
  // Double Kettlebell Swing — hinge, power, coordination
  ex_1137: {
    startingPosition: 'Stand with feet shoulder-width apart, a kettlebell in each hand hanging in front of you.',
    movement: 'Hinge at your hips to swing the bells back slightly, then snap your hips forward hard to swing them up to chest height, letting your arms just guide them.',
    keyCue: 'This is a hip snap, not an arm lift — keep both arms relaxed and let your hips do the work.',
    feelIt: 'You should feel this in your glutes and hamstrings from the hip snap, not your shoulders or lower back.',
    regression: 'If coordinating two bells at once is hard, master a single kettlebell swing first.',
  },
  // American Hip Thrust — hinge, extended range
  ex_1141: {
    startingPosition: 'Sit on the ground with your upper back against a bench, a bar resting across your hips, feet flat and knees bent.',
    movement: 'Drive your hips up and continue into a slight overextension at the top, pushing your hips higher than a standard hip thrust, then lower back down with control.',
    keyCue: 'Only add the extra top-end extension once your standard hip thrust is clean — the added range is where extra lower-back strain can creep in if you’re not ready for it.',
    feelIt: 'You should feel this in your glutes with a bit more stretch and squeeze than a regular hip thrust, not a strain in your lower back.',
    regression: 'If the extra extension causes any lower-back discomfort, go back to a standard hip thrust stopping at the straight-line top position.',
  },
  // Mixed-Grip Pull-Up — pull
  ex_1146: {
    startingPosition: 'Hang from the bar with one palm facing toward you and one facing away, arms straight.',
    movement: 'Pull yourself up by driving your elbows down toward your hips until your chin clears the bar, then lower back down with control.',
    keyCue: 'Alternate which hand is in which grip position between sets so you’re not always loading one shoulder the same way.',
    feelIt: 'You should feel this in your back and biceps, not a strain in your shoulders.',
    regression: 'If this is too much, try a regular pull-up with both palms facing the same direction first.',
  },
  // Half-Kneeling Landmine Press — push, core stability
  ex_1157: {
    startingPosition: 'Kneel on one knee with the other foot planted in front, holding the end of a landmine-anchored bar at your shoulder.',
    movement: 'Press the bar up and forward until your arm is straight, then lower it back to your shoulder with control.',
    keyCue: 'Keep your torso upright and core braced — the half-kneeling position removes the ability to lean back and use momentum, so don’t try to fake it.',
    feelIt: 'You should feel this in your shoulder and chest, plus core stability from the kneeling position, not a strain in your lower back.',
    regression: 'If balance in the half-kneeling position is hard, try a standing single-arm landmine press instead.',
  },
  // Reverse Grip Bench Press — push
  ex_1167: {
    startingPosition: 'Lie on the bench, gripping the bar with your palms facing toward your feet (underhand), hands just outside shoulder-width.',
    movement: 'Lower the bar to your upper chest, then press it back up until your arms are straight.',
    keyCue: 'Keep your elbows tucked closer to your body than a regular bench press — the underhand grip changes the natural bar path, so let your elbows follow it.',
    feelIt: 'You should feel this more in your upper chest and triceps than a regular bench press, not a strain in your wrists.',
    regression: 'If the grip feels unfamiliar or uncomfortable, go back to a regular overhand-grip bench press.',
  },
  // Weighted Jump Squat (Dumbbell) — squat, power
  ex_1178: {
    startingPosition: 'Stand holding a dumbbell in each hand at your sides, feet shoulder-width apart.',
    movement: 'Squat down partway, then explosively jump straight up, and land softly with bent knees.',
    keyCue: 'Land soft with bent knees to absorb the impact — never land with straight, locked knees, especially with added weight.',
    feelIt: 'You should feel this as an explosive effort in your legs, not a jolt in your knees on landing.',
    regression: 'If this is too much, try a bodyweight squat jump first, without any added weight.',
  },
  // Tempo Squat (Barbell) — squat, tempo
  ex_1180: {
    startingPosition: 'Stand with feet shoulder-width apart, bar resting across the top of your shoulders.',
    movement: 'Lower down slowly over a controlled count (like 3-4 seconds), then drive through your heels to stand up at a normal pace.',
    keyCue: 'Stay tight and controlled through the entire slow descent — don’t let your torso lean forward as you fight the tempo.',
    feelIt: 'You should feel constant, building tension in your quads and glutes through the slow lowering, more than a regular-tempo squat.',
    regression: 'If the slow tempo breaks your form, reduce the weight until you can control the full count.',
  },
  // Death March (Walking Single-Leg RDL) — hinge, unilateral, traveling
  ex_1181: {
    startingPosition: 'Stand holding a dumbbell in each hand at your sides, feet together.',
    movement: 'Hinge forward at your hips while stepping one leg forward through the movement, then stand tall and step into the next hinge on the opposite leg, walking forward rep by rep.',
    keyCue: 'Keep your back flat and hips square on each hinge — moving forward makes it easy to rush and let your form slip between reps.',
    feelIt: 'You should feel a stretch in your hamstrings on the standing leg each rep, not your lower back.',
    regression: 'If this is too much, try a stationary single-leg RDL instead — same hinge, without adding the walking transition.',
  },
  // Tempo Deadlift (Barbell) — hinge, tempo
  ex_1197: {
    startingPosition: 'Stand with feet hip-width apart, bar over your midfoot, and bend down to grip it just outside your knees.',
    movement: 'Stand up by pushing the floor away and driving your hips forward, then lower the bar back down slowly over a controlled count (like 3-4 seconds).',
    keyCue: 'Keep your back flat through the entire slow lowering — the extra time under tension is where rounding tends to creep in if you’re not deliberate.',
    feelIt: 'You should feel constant tension in your hamstrings and glutes through the slow lowering, more than a regular-tempo deadlift.',
    regression: 'If the slow tempo breaks your form, reduce the weight until you can control the full count.',
  },
  // One-Arm Push-Up — push, high skill
  ex_1204: {
    startingPosition: 'Start in a push-up position with feet wide for stability, one hand behind your back.',
    movement: 'Lower your chest toward the floor using only the one supporting arm, then press back up to straight arms.',
    keyCue: 'Keep your hips square to the floor — don’t let them twist or rotate to help you push up.',
    feelIt: 'You should feel this intensely in the chest, shoulder, and triceps of the working arm, not a strain in your lower back.',
    regression: 'If this is too much, build up through single-arm push-up progressions (like an archer push-up) first.',
  },
  // Squat Clean (Barbell) — full body, technical
  ex_1211: {
    startingPosition: 'Stand with the bar over your midfoot, feet hip-width apart, gripping just outside your knees.',
    movement: 'Pull the bar up explosively off the floor, then drop into a full squat to catch it racked at your shoulders, before standing up to finish.',
    keyCue: 'Keep the bar close to your body the entire pull — if it drifts away from your shins, the catch in a full squat becomes much harder to control.',
    feelIt: 'You should feel this as an explosive pull into a controlled catch, not an arm curl.',
    regression: 'If catching in a full squat feels unfamiliar, practice a power clean (catching higher, in a partial squat) first.',
  },
  // Zercher Deadlift — hinge
  ex_1214: {
    startingPosition: 'Stand over the bar with feet hip-width apart, squat down and cradle the bar in the crooks of your elbows.',
    movement: 'Stand up by pushing the floor away with your legs and driving your hips forward, keeping the bar held at your elbows the whole way.',
    keyCue: 'Keep your torso upright and core braced — if you lean forward, the bar pulls uncomfortably on your elbows.',
    feelIt: 'You should feel this in your quads, hamstrings, and glutes, not a sharp pain in your elbows.',
    regression: 'If holding the bar at your elbows is too uncomfortable, try a trap bar deadlift instead — similar upright torso position, easier to hold.',
  },
  // Zercher Press — overhead
  ex_1223: {
    startingPosition: 'Cradle the bar in the crooks of your elbows, arms crossed in front of your chest, feet shoulder-width apart.',
    movement: 'Press the bar up and slightly forward and over your head until your arms are extended, then lower it back to the Zercher position with control.',
    keyCue: 'Keep your core tightly braced — pressing overhead from this front-loaded starting position pulls hard on your lower back if you’re not tight.',
    feelIt: 'You should feel this in your shoulders and core, not a strain in your lower back.',
    regression: 'If this is too much, try a standard front-rack overhead press instead — same pressing pattern, more comfortable starting hold.',
  },
  // Goblet Lunge — lunge
  ex_1226: {
    startingPosition: 'Hold a dumbbell vertically against your chest with both hands, feet hip-width apart.',
    movement: 'Step forward into a lunge and lower until both knees are bent to about 90 degrees, then push through your front foot to return to standing.',
    keyCue: 'Keep your chest up and the weight close to your body — don’t let it pull you forward as you lunge.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If balance is the issue, try a bodyweight lunge first, without the added weight.',
  },
  // Single-Leg Good Morning — hinge, unilateral, bodyweight
  ex_1246: {
    startingPosition: 'Stand on one leg, hands behind your head or extended for balance, slight bend in your standing knee.',
    movement: 'Hinge forward at your hips, letting your free leg extend back for balance, until your torso is roughly parallel to the floor, then return to standing.',
    keyCue: 'Keep your back flat and your hips square — don’t let them rotate open as you hinge.',
    feelIt: 'You should feel a stretch in the hamstring of your standing leg, not your lower back.',
    regression: 'If balance is hard, hold onto something light for support, or only hinge partway down.',
  },
  // Tempo Bench Press (Barbell) — push, tempo
  ex_1251: {
    startingPosition: 'Lie on the bench with your eyes under the bar, feet flat on the floor, grip slightly wider than shoulder-width.',
    movement: 'Lower the bar slowly over a controlled count (like 3-4 seconds) to your chest, then press it back up at a normal pace.',
    keyCue: 'Keep your elbows at a consistent 45-degree angle through the entire slow lowering — don’t let them flare out as you fight the tempo.',
    feelIt: 'You should feel constant tension across your chest through the slow lowering, more than a regular-tempo bench press.',
    regression: 'If the slow tempo breaks your form, reduce the weight until you can control the full count.',
  },
  // Tempo Pull-Up — pull, tempo
  ex_1256: {
    startingPosition: 'Hang from the bar with arms fully straight, hands slightly wider than shoulder-width.',
    movement: 'Pull yourself up at a normal pace until your chin clears the bar, then lower yourself back down slowly over a controlled count (like 3-4 seconds).',
    keyCue: 'Fight the descent the whole way down — resisting gravity slowly is what makes this harder than a regular pull-up.',
    feelIt: 'You should feel a long, building burn in your back and biceps through the slow lowering.',
    regression: 'If holding the slow lowering is too much, shorten the count, or use a resistance band for a little assistance.',
  },
  // Freestanding Handstand Push-Up — push/overhead, highest skill
  ex_1275: {
    startingPosition: 'Kick up into a freestanding handstand in open space, hands shoulder-width apart, no wall for support.',
    movement: 'Lower your head slowly toward the floor by bending your elbows, then press back up to straight arms, all while maintaining your balance.',
    keyCue: 'This combines two hard skills at once — balance and pressing strength — so only attempt it once both are solid separately. Losing balance mid-rep is a real fall risk.',
    feelIt: 'You should feel this in your shoulders and triceps, with constant small balance corrections, not a strain in your neck.',
    regression: 'If this is too much, master a wall-assisted handstand push-up first before removing the wall.',
  },
  // Planche (Full) — push, most advanced skill
  ex_1299: {
    startingPosition: 'Start in a crouched or plank position, hands planted, fingers spread.',
    movement: 'Lean your shoulders forward past your hands and lift your entire body until it’s fully horizontal, parallel to the floor, balancing only on your hands.',
    keyCue: 'This is one of the most advanced bodyweight skills there is — it demands years of progressive shoulder, wrist, and core strength work. Don’t attempt the full version without building through the tuck, advanced tuck, and straddle planche progressions first.',
    feelIt: 'You should feel this intensely through your shoulders, chest, and core, not a strain in your wrists.',
    regression: 'If this is far out of reach, work the tuck planche and advanced tuck planche progressions instead — same hold, bent knees reduce the leverage demand substantially.',
  },
  // Single-Leg Romanian Deadlift (Barbell) — hinge, unilateral
  ex_1308: {
    startingPosition: 'Stand on one leg holding the bar at your thighs with both hands, slight bend in your standing knee.',
    movement: 'Hinge forward at your hips, letting your free leg extend back for balance, until your torso is roughly parallel to the floor, then return to standing.',
    keyCue: 'Keep the bar close to your body and your hips square — don’t let them rotate open as you hinge.',
    feelIt: 'You should feel a stretch in the hamstring of your standing leg, not your lower back.',
    regression: 'If balance with a bar is hard, try it with a dumbbell in one hand instead — easier to reset your grip between reps.',
  },
  // Chest to Bar Pull-Up — pull, extended range
  ex_1364: {
    startingPosition: 'Hang from the bar with arms fully straight, hands slightly wider than shoulder-width.',
    movement: 'Pull yourself up until your chest, not just your chin, touches the bar, then lower back down with control.',
    keyCue: 'Drive your elbows down and back further than a regular pull-up to reach the extra height — don’t crane your neck forward to fake the contact.',
    feelIt: 'You should feel this intensely in your back and lats, not a strain in your neck.',
    regression: 'If this is too much, master a regular chin-over-bar pull-up first before chasing the extra range.',
  },
  // Knees to Elbows — core, hanging
  ex_1365: {
    startingPosition: 'Hang from a pull-up bar with your arms straight, legs extended below you.',
    movement: 'Raise your knees up toward your elbows by curling your hips under, then lower back down with control.',
    keyCue: 'Move with control, not momentum — swinging your body to throw your knees up takes the work away from your abs.',
    feelIt: 'You should feel this in your abs, not your hip flexors straining or your grip giving out first.',
    regression: 'If this is too much, try a hanging knee raise instead — same pattern, doesn’t require reaching all the way to your elbows.',
  },
  // Low-Bar Back Squat — squat
  ex_1377: {
    startingPosition: 'Position the bar lower on your back, across your rear deltoids rather than your traps, feet slightly wider than shoulder-width.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'This bar position naturally pushes your torso forward more than a high-bar squat — let your hips travel back further to compensate, rather than letting your back round.',
    feelIt: 'You should feel this more in your glutes and hamstrings than a high-bar squat, not your lower back.',
    regression: 'If finding the low-bar position on your back is uncomfortable, use a high-bar squat instead — bar rests higher on your traps, more upright torso.',
  },
  // Dumbbell Hip Thrust — hinge
  ex_1471: {
    startingPosition: 'Sit on the ground with your upper back against a bench, a dumbbell resting across your hips, feet flat and knees bent.',
    movement: 'Drive your hips straight up until your body forms a straight line from shoulders to knees, then lower back down with control.',
    keyCue: 'Keep your chin tucked and your eyes forward — don’t crank your neck back to look up as you thrust.',
    feelIt: 'You should feel this in your glutes, not your lower back.',
    regression: 'If the dumbbell feels awkward to hold in place, try a bodyweight glute bridge instead — same movement, no added load.',
  },
  // Barbell Thruster (Front Squat to Press) — full body
  ex_1542: {
    startingPosition: 'Hold the bar racked at your shoulders in a front-rack position, feet shoulder-width apart.',
    movement: 'Squat down until your thighs are at least parallel to the floor, then stand up explosively and use that momentum to press the bar overhead.',
    keyCue: 'Keep your core braced through the whole movement — don’t let your lower back arch as you press overhead.',
    feelIt: 'You should feel this as one connected effort from your legs into your shoulders, not two separate movements.',
    regression: 'If this is too much, do a front squat and an overhead press as two separate movements first.',
  },
  // Dumbbell Clean and Press (Single-Arm) — full body, technical
  ex_1543: {
    startingPosition: 'Stand with feet shoulder-width apart, a dumbbell on the floor between your feet.',
    movement: 'Clean the dumbbell up to your shoulder in one pull, then press it straight overhead until your arm is locked out.',
    keyCue: 'Keep the dumbbell close to your body on the clean — letting it swing out and away makes the catch at your shoulder unpredictable.',
    feelIt: 'You should feel this as a smooth pull into a controlled press, not a yank followed by a strain.',
    regression: 'If the timing feels off, practice the clean and the overhead press as two separate movements first.',
  },
  // Squat Jerk — full body, highest technical/injury risk
  ex_1546: {
    startingPosition: 'Hold the bar racked at your shoulders, feet hip-width apart, elbows up.',
    movement: 'Dip slightly, then drive the bar overhead while dropping into a full squat underneath it to catch it with straight arms, then stand up to finish.',
    keyCue: 'This demands serious overhead mobility and squat depth under load — get comfortable with a split jerk and an overhead squat separately before combining them into this.',
    feelIt: 'You should feel this as an explosive full-body effort with a deep, stable catch, not a wobble you have to save.',
    regression: 'If this is too much, practice a split jerk instead — same overhead drive, easier catch position to stabilize.',
  },
  // Tire Flip — full body, strongman
  ex_270: {
    startingPosition: 'Squat down and grip the underside of the tire with both hands, chest close to it.',
    movement: 'Drive through your legs to lift and push the tire up and over, following through with your hands as it flips forward.',
    keyCue: 'Keep your back flat as you lift — this is a deadlift-like drive from your legs, not a lift with a rounded spine.',
    feelIt: 'You should feel this in your legs, glutes, and back working together, not a strain in your lower back.',
    regression: 'If this is too much, use a lighter tire, or practice the lifting portion against a wall or heavy bag first.',
  },
  // Safety Squat Bar Squat — squat
  ex_280: {
    startingPosition: 'Position the padded, cambered bar across your upper back, gripping the front handles, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Keep your torso a bit more upright than a straight-bar squat — the bar’s design shifts the balance point forward, so let your torso adjust rather than fighting it.',
    feelIt: 'You should feel this in your quads and glutes, not a strain in your shoulders.',
    regression: 'If the bar feels unfamiliar, try a regular barbell back squat instead.',
  },
  // Skin the Cat (Rings or Bar) — full body, mobility skill
  ex_355: {
    startingPosition: 'Hang from rings or a bar with arms straight.',
    movement: 'Tuck your knees and roll your hips up and over, bringing your legs through your arms until you’re inverted, then reverse back to the starting hang.',
    keyCue: 'Move slowly and with control, especially on the way back — this is a real shoulder-mobility demand, so stop short of a range that pinches.',
    feelIt: 'You should feel a stretch through your shoulders and a controlled roll through your core, not a pinch in your shoulder joint.',
    regression: 'If this is too much, practice a hanging tuck (just pulling your knees to your chest) first, without the full roll-through.',
  },
  // Lateral Bounds (Skater Jumps) — jump, power
  ex_371: {
    startingPosition: 'Stand on one leg, knee slightly bent.',
    movement: 'Push off sideways and land on the other leg, absorbing the landing with a bent knee, then immediately bound back the other direction.',
    keyCue: 'Land soft and stick each landing for a moment before bounding again while you’re building control — don’t chain them faster than you can stabilize.',
    feelIt: 'You should feel this as an explosive effort in your glutes and outer hips, not a jolt in your knee on landing.',
    regression: 'If this is too much, try a smaller lateral step instead of a full bound, or practice sticking single landings before chaining them.',
  },
  // Atlas Stone Lift (to Platform) — full body, strongman
  ex_380: {
    startingPosition: 'Squat down and wrap both arms around the stone, pulling it into your lap.',
    movement: 'Roll the stone up your thighs and stand up, using your hips and legs to drive it, then lift it onto the platform.',
    keyCue: 'Keep the stone close to your body the entire lift — this is a full-body hug-and-drive, not a lift with your arms held away from you.',
    feelIt: 'You should feel this in your legs, back, and grip together, not a strain isolated in your lower back.',
    regression: 'If this is too much, practice with a lighter sandbag or medicine ball first to learn the lap-and-drive pattern.',
  },
  // World's Greatest Stretch — full body, mobility flow
  ex_400: {
    startingPosition: 'Start in a push-up position, then step one foot forward outside your same-side hand into a deep lunge.',
    movement: 'Rotate your torso and reach that same-side arm up toward the ceiling, following it with your eyes, then return your hand to the floor and reset.',
    keyCue: 'Keep your back knee off the floor and your front knee tracking over your ankle throughout the rotation.',
    feelIt: 'You should feel a stretch through your hip, hamstring, and upper back as you rotate, not a strain in your front knee.',
    regression: 'If this is too much, skip the torso rotation and just hold the lunge stretch.',
  },
  // Single-Leg Hip Thrust (Bench Supported) — hinge, unilateral
  ex_484: {
    startingPosition: 'Sit on the ground with your upper back against a bench, one foot flat on the floor and the other leg extended or lifted.',
    movement: 'Drive your hips straight up through your planted foot until your body forms a straight line from shoulders to knee, then lower back down with control.',
    keyCue: 'Keep your hips level — don’t let the unsupported side dip or rotate as you press up.',
    feelIt: 'You should feel this in the glute of your planted leg, not your lower back.',
    regression: 'If this is too much, try a two-foot glute bridge first and build single-leg strength gradually.',
  },
  // Single-Leg Step-Down (Eccentric, Box) — squat, tempo
  ex_491: {
    startingPosition: 'Stand on one leg on top of a box or step, other leg hanging free in front of you.',
    movement: 'Slowly lower your free leg down toward the floor by bending your standing knee, tapping your heel lightly, then push back up to standing on the box.',
    keyCue: 'Control the descent the entire way down — this is an eccentric-strength drill for your knee, and dropping fast defeats the purpose.',
    feelIt: 'You should feel this in your standing thigh and glute, not a strain in your knee.',
    regression: 'If this is too much, use a lower step, or only lower partway down.',
  },
  // Single-Leg Balance Reach (Airplane) — hinge, balance
  ex_502: {
    startingPosition: 'Stand on one leg, slight bend in your standing knee, arms out to your sides.',
    movement: 'Hinge forward at your hips while extending your free leg straight back, forming a T-shape with your body, then return to standing.',
    keyCue: 'Move slowly and keep your hips square to the floor — this is a balance and control drill, not a stretch to force further than you can hold.',
    feelIt: 'You should feel this in your standing leg and glute working to balance, not your lower back.',
    regression: 'If balance is hard, hold onto something light for support, or only hinge partway.',
  },
  // Sandbag Clean and Press — full body, technical
  ex_518: {
    startingPosition: 'Squat down and grip the sandbag with both hands, close to your body.',
    movement: 'Pull the bag up and catch it at your chest in one motion, then press it overhead until your arms are extended.',
    keyCue: 'Keep the bag close to your body on the pull — sandbags shift and are less predictable than a barbell, so a tight grip and close path matter even more.',
    feelIt: 'You should feel this as a smooth pull into a controlled press, not a yank followed by a strain.',
    regression: 'If this is too much, practice the pull to your chest and the overhead press as two separate movements first.',
  },
  // Bulgarian Split Squat (Kettlebell, Front-Rack) — squat, unilateral
  ex_529: {
    startingPosition: 'Stand a couple feet in front of a bench, rest one foot behind you on top of it, kettlebell racked at one shoulder.',
    movement: 'Lower your back knee straight down toward the floor by bending your front leg, then push through your front foot to stand back up.',
    keyCue: 'Keep your torso upright — don’t let the front-rack weight pull you into a forward lean.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If balance is the issue, hold the kettlebell at your side instead of racked, or try it without weight first.',
  },
  // Sandbag Get-Up — full body, coordination
  ex_546: {
    startingPosition: 'Lie on the floor with the sandbag hugged against your chest.',
    movement: 'Roll to one side, use your arms and legs to work your way up through a half-kneeling position, and stand up while keeping the bag held close to your chest.',
    keyCue: 'Keep the bag hugged tight to your body the entire way up — the further it drifts away from you, the harder it is to control your balance.',
    feelIt: 'You should feel this as a full-body coordinated effort, not a strain isolated in your lower back.',
    regression: 'If this is too much, practice the same standing-up sequence without any weight first.',
  },
  // Dumbbell Arnold Press — overhead, rotational
  ex_578: {
    startingPosition: 'Sit or stand holding a dumbbell in each hand at shoulder height, palms facing your body.',
    movement: 'As you press the dumbbells overhead, rotate your palms to face forward, then reverse the rotation as you lower back down.',
    keyCue: 'Keep the rotation smooth and continuous with the press — don’t pause partway through the twist.',
    feelIt: 'You should feel this working your shoulders through a fuller range than a regular overhead press, not a strain in your wrists.',
    regression: 'If the rotation feels awkward, try a regular dumbbell shoulder press instead — same muscles, simpler path.',
  },
  // Dumbbell Lateral Lunge — lunge, frontal plane
  ex_579: {
    startingPosition: 'Stand tall holding a dumbbell in each hand, feet together.',
    movement: 'Step one leg out to the side and bend that knee to lower down, keeping your other leg straight, then push back to center.',
    keyCue: 'Keep your bending knee tracking over your ankle — don’t let it cave inward as you sink into the side lunge.',
    feelIt: 'You should feel this in your inner thighs and glute of the bending leg, not a strain in your knee.',
    regression: 'If balance is the issue, try it without weights first, holding onto something for support.',
  },
  // Cable Reverse Lunge (Anti-Rotation Hold) — lunge, core stability
  ex_590: {
    startingPosition: 'Stand facing away from the cable machine, holding the handle at your chest with both hands.',
    movement: 'Step one leg back into a reverse lunge, keeping the cable pulling you toward the machine, then push through your front foot to return to standing.',
    keyCue: 'Keep your torso square and resist the cable’s pull to rotate you — that resistance is the whole point of the exercise.',
    feelIt: 'You should feel this in your front thigh and glute, plus extra core work resisting the pull, not a twist in your lower back.',
    regression: 'If resisting the rotation is hard, use less cable weight or try a bodyweight reverse lunge first.',
  },
  // Copenhagen Plank (Adductor Side Plank) — core, adductor
  ex_605: {
    startingPosition: 'Lie on your side with your top leg resting on a bench, bottom leg free, propped up on your forearm.',
    movement: 'Lift your hips and bottom leg up so your body forms a straight line, using your inner thigh on the bench to support you, then hold.',
    keyCue: 'Keep your hips lifted and square the entire hold — this places heavy, real demand on your inner thigh, so start with shorter holds.',
    feelIt: 'You should feel this intensely in your inner thigh (adductor), not your lower back.',
    regression: 'If this is too much, bend your bottom knee and rest it on the floor for support, or shorten the hold time.',
  },
  // Side Plank Reach-Under (Thread the Needle) — core, rotation
  ex_637: {
    startingPosition: 'Hold a side plank with your top arm reaching straight up toward the ceiling.',
    movement: 'Rotate your torso and thread your top arm underneath your body, then reverse and return it back up toward the ceiling.',
    keyCue: 'Keep your hips lifted throughout the rotation — don’t let them drop toward the floor as you reach through.',
    feelIt: 'You should feel this in your obliques and core controlling the rotation, not your shoulder.',
    regression: 'If this is too much, hold a regular side plank first without adding the reach-through rotation.',
  },
  // Snatch Balance — squat/overhead, highest technical drill
  ex_652: {
    startingPosition: 'Stand holding the bar overhead with a wide grip, arms locked out, feet hip-width apart.',
    movement: 'Dip your knees slightly, then drop quickly into a full overhead squat while keeping the bar locked overhead, catching yourself in a stable, deep position.',
    keyCue: 'This is a technical drill for the snatch catch — the bar must stay directly over your midfoot the entire drop, or you’ll lose the position.',
    feelIt: 'You should feel this as a fast, controlled drop into a stable overhead squat, not a slow lower.',
    regression: 'If this is too much, practice holding a static overhead squat position first, without the fast drop.',
  },
  // Muscle Snatch — pull/overhead, technical
  ex_653: {
    startingPosition: 'Stand with the bar over your midfoot, feet hip-width apart, gripping very wide.',
    movement: 'Pull the bar up in one continuous motion and press it out to full lockout overhead without dropping under it, keeping your elbows high and outside throughout the pull.',
    keyCue: 'Keep your elbows high and pulling outside the bar path the entire time — letting them drop low turns this into a regular row instead of building the snatch pull pattern.',
    feelIt: 'You should feel this as one continuous pull-to-lockout in your upper back and shoulders, not a series of separate arm movements.',
    regression: 'If locking out overhead without dropping under feels too demanding, use a lighter bar to build the pattern first.',
  },
  // Husafell Carry — carry, strongman
  ex_658: {
    startingPosition: 'Bear-hug the Husafell stone against your chest, gripping around its sides.',
    movement: 'Walk forward at a steady pace, keeping the stone held tight against your chest, for the set distance or time.',
    keyCue: 'Keep your core braced and the stone held tight the entire walk — a loose hold lets it shift and throws off your balance.',
    feelIt: 'You should feel this in your core, grip, and upper back from holding it tight, not a strain in your lower back.',
    regression: 'If this is too much, try a sandbag bear-hug carry instead — similar hold, more adjustable weight.',
  },
  // Fat Gripz Deadlift (Thick-Grip Barbell) — hinge, grip
  ex_669: {
    startingPosition: 'Stand with feet hip-width apart, bar over your midfoot fitted with thick grip attachments, and bend down to grip it just outside your knees.',
    movement: 'Stand up by pushing the floor away with your legs and driving your hips forward, keeping the bar close to your shins the whole way up.',
    keyCue: 'Your grip will fatigue faster than usual — keep your back flat and don’t let your form break down chasing extra reps once your grip starts to slip.',
    feelIt: 'You should feel extra grip and forearm demand on top of the usual hamstring and glute effort, not a strain in your lower back.',
    regression: 'If the thick grip is too limiting, use a regular bar grip and add the thick attachments only for lighter accessory sets.',
  },
  // Towel Grip Pull-Up — pull, grip
  ex_673: {
    startingPosition: 'Drape a towel over the pull-up bar and grip one end in each hand, arms straight.',
    movement: 'Pull yourself up by driving your elbows down toward your hips until your chin clears the bar, then lower back down with control.',
    keyCue: 'Grip the towel firmly with your whole hand — this demands significantly more grip strength than gripping the bar directly, so expect fewer reps than usual.',
    feelIt: 'You should feel extra grip and forearm burn on top of your back and biceps working, not a strain in your wrists.',
    regression: 'If the grip is too limiting, hold the towel with just one hand and the bar directly with the other, or go back to a regular pull-up.',
  },
  // BOSU Squat (Dome Up) — squat, balance
  ex_684: {
    startingPosition: 'Stand on top of the BOSU ball, dome side up, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to squat down while balancing on the unstable surface, then drive through your heels to stand.',
    keyCue: 'Move slower than a regular squat and keep your core braced — the unstable surface demands constant small balance corrections throughout.',
    feelIt: 'You should feel this in your quads and glutes, plus extra stabilizing work through your ankles and core, not a strain in your lower back.',
    regression: 'If balance is too hard, hold onto something for support, or do a regular squat on stable ground first.',
  },
  // BOSU Push-Up (Hands on Dome) — push, unstable
  ex_685: {
    startingPosition: 'Place your hands on top of the BOSU ball, dome side up, body in a straight line, feet on the floor.',
    movement: 'Lower your chest toward the ball by bending your elbows, then press back up until your arms are straight.',
    keyCue: 'Keep the ball from wobbling by controlling the movement slowly — the instability is what makes this harder than a regular push-up.',
    feelIt: 'You should feel this across your chest and shoulders, plus extra stabilizing work, not a strain in your wrists.',
    regression: 'If the instability is too much, try a regular push-up on the floor first and build strength there before adding the ball.',
  },
  // Bodyweight Reverse Hyper (Bench-Supported) — hinge
  ex_693: {
    startingPosition: 'Lie face-down on a bench with your hips at the edge, legs hanging off, holding the bench for support.',
    movement: 'Squeeze your glutes and hamstrings to swing your legs up until they’re in line with your torso, then lower back down with control.',
    keyCue: 'Use your glutes and hamstrings to lift, not momentum from swinging — a controlled swing protects your lower back.',
    feelIt: 'You should feel this in your glutes and hamstrings, not your lower back.',
    regression: 'If this is too much, try a glute bridge march instead — similar glute activation, no hanging-leg component.',
  },
  // Standing Ab Wheel Rollout — core, advanced
  ex_694: {
    startingPosition: 'Stand tall holding the ab wheel handles, feet together.',
    movement: 'Hinge forward and roll the wheel out along the floor, extending your body as far as you can control while staying standing, then pull back to standing.',
    keyCue: 'Keep your core braced hard the entire time — this is a significantly harder variation than the kneeling version, since your hips have no floor support.',
    feelIt: 'You should feel this intensely in your abs, not your lower back.',
    regression: 'If this is too much, go back to a kneeling ab wheel rollout instead — much easier to control.',
  },
  // Stability Ball Push-Up (Feet on Ball) — push, unstable
  ex_695: {
    startingPosition: 'Place your feet on top of a stability ball, hands on the floor in a push-up position, body in a straight line.',
    movement: 'Lower your chest toward the floor by bending your elbows, then press back up until your arms are straight.',
    keyCue: 'Keep your core braced to stop the ball from rolling out from under you — the instability is what makes this harder than a regular push-up.',
    feelIt: 'You should feel this across your chest and shoulders, plus extra core stabilizing work, not a strain in your lower back.',
    regression: 'If the instability is too much, try a regular push-up on the floor first and build strength there before adding the ball.',
  },
  // Sandbag Rotational Throw (Ballistic) — core, power
  ex_704: {
    startingPosition: 'Stand sideways to your throwing target, holding the sandbag at your hip.',
    movement: 'Rotate through your hips and torso to swing the bag across your body and release it toward the target, following through with the rotation.',
    keyCue: 'Generate the power from your hips rotating, not just your arms swinging — and make sure your throwing area is clear before releasing.',
    feelIt: 'You should feel this as an explosive rotational effort through your core and hips, not a strain in your shoulder.',
    regression: 'If this is too much, practice the rotational movement with a lighter medicine ball first.',
  },
  // Zercher Good Morning — hinge
  ex_710: {
    startingPosition: 'Cradle the bar in the crooks of your elbows, arms crossed in front of your chest, feet hip-width apart.',
    movement: 'Hinge forward at your hips, keeping your back flat, until your torso is close to parallel with the floor, then drive your hips forward to stand back up.',
    keyCue: 'Your back stays flat the entire time — the front-loaded bar position makes rounding especially uncomfortable, so let that discomfort be your signal to stop.',
    feelIt: 'You should feel a stretch in your hamstrings, not your lower back or a sharp pain in your elbows.',
    regression: 'If holding the bar at your elbows is uncomfortable, try a regular barbell good morning instead.',
  },
  // Suitcase Deadlift (Single-Arm Dumbbell) — hinge, anti-lateral-flexion
  ex_713: {
    startingPosition: 'Stand with a dumbbell on the floor next to one foot, feet hip-width apart.',
    movement: 'Hinge down and grip the dumbbell with the same-side hand, then stand up by driving through your legs and hips, keeping your torso from tilting toward the weight.',
    keyCue: 'Resist leaning or rotating toward the loaded side — keeping your torso upright and square is the whole point of this variation.',
    feelIt: 'You should feel this in your hamstrings and glutes, plus extra core work staying square, not a strain in your lower back.',
    regression: 'If staying square is hard, use a lighter dumbbell or go back to a regular two-handed deadlift.',
  },
  // Cable Hip Thrust — hinge, cable
  ex_725: {
    startingPosition: 'Sit on the ground in front of a low cable machine with a strap around your hips, upper back against a bench, feet flat and knees bent.',
    movement: 'Drive your hips straight up against the cable’s resistance until your body forms a straight line from shoulders to knees, then lower back down with control.',
    keyCue: 'Keep your chin tucked and eyes forward — don’t crank your neck back to look up as you thrust.',
    feelIt: 'You should feel this in your glutes, not your lower back.',
    regression: 'If the cable setup feels awkward, try a barbell or dumbbell hip thrust instead — same movement, more familiar setup.',
  },
  // Double Kettlebell Overhead Press — overhead
  ex_726: {
    startingPosition: 'Clean both kettlebells to the rack position at your shoulders, feet shoulder-width apart.',
    movement: 'Press both kettlebells straight up until your arms are extended, then lower them back to your shoulders with control.',
    keyCue: 'Keep your core braced and press both sides evenly — don’t let one side lag or lean to compensate.',
    feelIt: 'You should feel this in both shoulders and triceps evenly, not a strain in your lower back.',
    regression: 'If pressing two bells together is too much, try a single kettlebell overhead press instead.',
  },
  // Double Kettlebell Clean — pull/power, coordination
  ex_727: {
    startingPosition: 'Stand with feet shoulder-width apart, a kettlebell on the floor at each foot.',
    movement: 'Hike both bells back slightly, then pull them up together close to your body, rotating your wrists through so they land softly in the rack position at your shoulders.',
    keyCue: 'Keep both bells close to your body the whole way up — letting either one swing out and away is what causes it to bang into your wrist.',
    feelIt: 'You should feel this as a smooth, coordinated pull with both arms, not a yank followed by a strain.',
    regression: 'If coordinating two bells is hard, master a single kettlebell clean first before doubling up.',
  },
  // EZ-Bar Close-Grip Bench Press — push
  ex_814: {
    startingPosition: 'Lie on the bench with your eyes under the bar, hands on the angled part of the EZ-bar just inside shoulder-width.',
    movement: 'Lower the bar to your lower chest, keeping your elbows tucked close to your body, then press it back up.',
    keyCue: 'Keep your elbows tucked in, not flared out — the close grip is hard on your wrists and elbows if they flare.',
    feelIt: 'You should feel this mostly in your triceps, with your chest assisting, not a strain in your wrists.',
    regression: 'If this is too much, try close-grip push-ups instead — same tucked-elbow pattern, uses your bodyweight.',
  },
  // Weighted Vest Burpee — full body, added load
  ex_829: {
    startingPosition: 'Stand with feet shoulder-width apart, wearing a weighted vest.',
    movement: 'Drop into a squat, kick your feet back into a plank, do a push-up, jump your feet back in, then jump straight up.',
    keyCue: 'The extra vest weight adds real impact to every landing — keep your knees soft and don’t rush the pace just to hit a number.',
    feelIt: 'You should feel this as a demanding full-body effort, not a jolt in your knees or lower back.',
    regression: 'If this is too much, remove the vest and do a regular bodyweight burpee first.',
  },
  // Weighted Vest Box Jump — jump, added load
  ex_831: {
    startingPosition: 'Stand facing a sturdy box with feet shoulder-width apart, wearing a weighted vest.',
    movement: 'Swing your arms back, bend your knees, then jump up and land softly on top of the box with both feet, knees slightly bent.',
    keyCue: 'The added vest weight increases landing impact significantly — use a lower box than you’d use unweighted, and step down rather than jumping down.',
    feelIt: 'You should feel this in your glutes and thighs absorbing the landing, not a jolt in your knees.',
    regression: 'If this is too much, remove the vest and do a regular bodyweight box jump, or step up instead of jumping.',
  },
  // Medicine Ball Push-Up (Hands on Ball) — push, unstable
  ex_832: {
    startingPosition: 'Place both hands on top of a medicine ball, body in a straight line, feet on the floor.',
    movement: 'Lower your chest toward the ball by bending your elbows, then press back up until your arms are straight.',
    keyCue: 'Keep your core braced to stop the ball from rolling out from under you — the instability is what makes this harder than a regular push-up.',
    feelIt: 'You should feel this across your chest and shoulders, plus extra core stabilizing work, not a strain in your wrists.',
    regression: 'If the instability is too much, try a regular push-up on the floor first and build strength there before adding the ball.',
  },
  // Medicine Ball Lunge (Overhead Hold) — lunge, overhead stability
  ex_834: {
    startingPosition: 'Stand holding a medicine ball locked out overhead with both arms, feet hip-width apart.',
    movement: 'Step forward into a lunge and lower until both knees are bent to about 90 degrees, keeping the ball overhead, then push through your front foot to return to standing.',
    keyCue: 'Keep your core braced and the ball stacked overhead — don’t let your lower back arch to hold it up.',
    feelIt: 'You should feel this in your front thigh and glute, plus your shoulders and core holding the overhead position, not a strain in your lower back.',
    regression: 'If holding the ball overhead is too much, hold it at your chest instead, or try a bodyweight lunge first.',
  },
  // Straddle Planche — push, advanced skill
  ex_845: {
    startingPosition: 'Start in a crouched position with legs spread wide in a straddle, hands planted shoulder-width apart.',
    movement: 'Lean your shoulders forward past your hands and lift your entire body until it’s horizontal, parallel to the floor, balancing only on your hands.',
    keyCue: 'Keep your shoulders actively pushed away from your hands the entire hold — a sunken shoulder position under this load is a real strain risk.',
    feelIt: 'You should feel this intensely through your shoulders, chest, and core, not a strain in your wrists.',
    regression: 'If this is too much, build through the tuck and advanced tuck planche progressions first — same hold, bent knees reduce the leverage demand.',
  },
  // Crow Pose (Bakasana) — full body, balance
  ex_848: {
    startingPosition: 'Squat down with your hands planted on the floor shoulder-width apart, knees resting against the backs of your upper arms.',
    movement: 'Lean your weight forward onto your hands and lift your feet off the floor, balancing your bodyweight on your arms.',
    keyCue: 'Keep your gaze slightly forward, not straight down — looking down tends to tip you forward too far and out of balance.',
    feelIt: 'You should feel this as a controlled balance through your arms and core, not a strain in your wrists.',
    regression: 'If this is too much, practice just leaning your weight forward onto your hands with your feet still on the floor first.',
  },
  // Pause Bench Press (Barbell) — push, tempo
  ex_853: {
    startingPosition: 'Lie on the bench with your eyes under the bar, feet flat on the floor, grip slightly wider than shoulder-width.',
    movement: 'Lower the bar to your chest, pause and hold it there for a full 2-3 seconds without touching for support, then press it back up until your arms are straight.',
    keyCue: 'Stay tight through the pause — don’t let the bar sink into your chest or your shoulder blades lose their set position while you hold.',
    feelIt: 'You should feel constant tension across your chest through the pause, not a relaxing rest at the bottom.',
    regression: 'If holding the pause breaks your form, shorten it to 1 second, or reduce the weight until you can hold it solidly.',
  },
  // Cable Lunge (Front-Loaded) — lunge, cable resistance
  ex_856: {
    startingPosition: 'Stand facing away from the cable machine, holding the handle at your chest with both hands, feet hip-width apart.',
    movement: 'Step forward into a lunge and lower until both knees are bent to about 90 degrees, then push through your front foot to return to standing.',
    keyCue: 'Keep your torso upright and resist the cable’s pull — it’s trying to pull you backward off-balance as you lunge.',
    feelIt: 'You should feel this in your front thigh and glute, plus extra core work resisting the cable, not a strain in your lower back.',
    regression: 'If resisting the cable is hard, use less weight or try a bodyweight lunge first.',
  },
  // Landmine Rotation (Standing 180 Twist) — core, rotation
  ex_862: {
    startingPosition: 'Stand holding the end of a landmine-anchored bar with both hands, arms extended in front of you.',
    movement: 'Rotate your torso and hips together to swing the bar from one side of your body to the other, following through with control.',
    keyCue: 'Rotate from your hips and core together, not just your arms — your feet can pivot slightly to allow the full turn.',
    feelIt: 'You should feel this in your obliques and core, not a strain in your lower back or shoulders.',
    regression: 'If this is too much, try it without any weight first, just practicing the rotation pattern.',
  },
  // Landmine Rainbow (Half-Kneeling Arc Press) — full body, core stability
  ex_863: {
    startingPosition: 'Kneel on one knee with the other foot planted in front, holding the end of a landmine-anchored bar at one shoulder.',
    movement: 'Press the bar up and across your body in an arcing path from one hip to overhead on the opposite side, then reverse back down.',
    keyCue: 'Keep your torso stable and let the arc come from your shoulder and core, not from twisting your lower back.',
    feelIt: 'You should feel this in your shoulder and core through the arcing path, not a strain in your lower back.',
    regression: 'If this is too much, try a standard half-kneeling landmine press instead — same starting position, without the arcing path.',
  },
  // Sandbag Zercher Squat — squat
  ex_864: {
    startingPosition: 'Cradle the sandbag in the crooks of your elbows, arms crossed in front of your chest, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Keep your torso upright and core braced — if you lean forward, the bag pulls uncomfortably on your elbows.',
    feelIt: 'You should feel this in your quads, glutes, and core, not a sharp pain in your elbows.',
    regression: 'If holding the bag at your elbows is too uncomfortable, try a sandbag bear-hug squat instead — held against your chest, easier to hold.',
  },
  // Kettlebell Renegade Row — full body, plank + pull
  ex_869: {
    startingPosition: 'Start in a push-up position with a kettlebell in each hand, feet a bit wider than usual for stability.',
    movement: 'Row one kettlebell up toward your hip while balancing on the other arm, then lower and switch sides.',
    keyCue: 'Keep your hips square and still — don’t let them rotate open as you row.',
    feelIt: 'You should feel this in your back and core from resisting the rotation, not your lower back.',
    regression: 'If balance is hard, widen your feet further or drop to your knees to reduce the plank demand.',
  },
  // Kettlebell Thruster — full body
  ex_870: {
    startingPosition: 'Hold a kettlebell racked at each shoulder, feet shoulder-width apart.',
    movement: 'Squat down until your thighs are at least parallel to the floor, then stand up explosively and use that momentum to press both kettlebells overhead.',
    keyCue: 'Keep your core braced through the whole movement — don’t let your lower back arch as you press overhead.',
    feelIt: 'You should feel this as one connected effort from your legs into your shoulders, not two separate movements.',
    regression: 'If this is too much, do the squat and the overhead press as two separate movements first.',
  },
  // Double Kettlebell Push Press — overhead, power
  ex_871: {
    startingPosition: 'Hold a kettlebell racked at each shoulder, feet shoulder-width apart.',
    movement: 'Dip slightly by bending your knees, then drive up through your legs and press both kettlebells overhead until your arms are straight.',
    keyCue: 'Keep the drive even on both sides — use your legs to start the movement, not just your arms.',
    feelIt: 'You should feel your legs doing the initial work, with your shoulders finishing the lockout on both sides evenly.',
    regression: 'If pressing two bells together is too much, try a single kettlebell push press instead.',
  },
  // Kettlebell Suitcase Deadlift — hinge, anti-lateral-flexion
  ex_872: {
    startingPosition: 'Stand with a kettlebell on the floor next to one foot, feet hip-width apart.',
    movement: 'Hinge down and grip the kettlebell with the same-side hand, then stand up by driving through your legs and hips, keeping your torso from tilting toward the weight.',
    keyCue: 'Resist leaning or rotating toward the loaded side — keeping your torso upright and square is the whole point of this variation.',
    feelIt: 'You should feel this in your hamstrings and glutes, plus extra core work staying square, not a strain in your lower back.',
    regression: 'If staying square is hard, use a lighter kettlebell or go back to a regular two-handed deadlift.',
  },
  // Barbell Larsen Press (Feet-Up Bench Press) — push
  ex_874: {
    startingPosition: 'Lie on the bench with your feet lifted off the floor, knees bent or legs extended, gripping the bar slightly wider than shoulder-width.',
    movement: 'Lower the bar to your chest, then press it back up until your arms are straight.',
    keyCue: 'With your feet up, you lose the ability to leg-drive or arch to help the lift — keep your core braced and expect to move less weight than usual.',
    feelIt: 'You should feel this purely across your chest and shoulders, not a strain in your lower back from arching.',
    regression: 'If this is too much, go back to a regular bench press with your feet flat on the floor.',
  },
  // Ring Pull-Up — pull, unstable
  ex_875: {
    startingPosition: 'Hang from gymnastic rings with an active grip, arms straight.',
    movement: 'Pull yourself up by driving your elbows down toward your hips until your chin clears the rings, then lower back down with control.',
    keyCue: 'Keep the rings from turning out or wobbling by actively controlling your grip — the instability is what makes this harder than a fixed-bar pull-up.',
    feelIt: 'You should feel this in your back and biceps, plus extra grip and stabilizing work, not a strain in your shoulders.',
    regression: 'If the instability is too much, try a regular fixed-bar pull-up first and build strength there before moving to rings.',
  },
  // Ring L-Sit — core, unstable
  ex_877: {
    startingPosition: 'Support your body on gymnastic rings at your sides with straight arms, legs extended straight out in front of you.',
    movement: 'Hold this position, keeping your legs raised parallel to the floor and the rings steady, for the set time.',
    keyCue: 'Keep your shoulders pressed down away from your ears and the rings from turning out — both the hold and the ring stability demand real control.',
    feelIt: 'You should feel this in your core, hip flexors, and shoulders working to stay stable, not your shoulders straining upward.',
    regression: 'If this is too much, try an L-sit on parallettes or a fixed bar first — less instability to manage while you build the hold.',
  },
  // Box Jump Over — jump, power
  ex_878: {
    startingPosition: 'Stand facing a sturdy box with feet shoulder-width apart.',
    movement: 'Swing your arms back, bend your knees, then jump up and over the box, landing softly on the other side with both feet.',
    keyCue: 'Land soft with bent knees on the far side — this is a jump over, not onto, so plan for the landing to be on the ground, not the box.',
    feelIt: 'You should feel this in your glutes and thighs from the explosive jump and landing, not a jolt in your knees.',
    regression: 'If this is too much, try a regular box jump onto the box first, or step over a lower obstacle instead.',
  },
  // Duck Walk — squat, mobility
  ex_884: {
    startingPosition: 'Squat down into a deep bodyweight squat, hands on your hips or in front of you for balance.',
    movement: 'Stay low in the squat position and walk forward, taking small steps while keeping your hips down.',
    keyCue: 'Keep your chest up and stay as low as you can control the whole way — don’t let your hips rise up between steps.',
    feelIt: 'You should feel this intensely in your quads and glutes from staying low, not a strain in your knees.',
    regression: 'If this is too much, don’t squat as deep, or take a break to stand between shorter walking bouts.',
  },
  // Half-Kneeling Cable Chop — core, rotation
  ex_888: {
    startingPosition: 'Kneel on one knee with the other foot planted in front, facing sideways to the cable machine set high, gripping the handle with both hands.',
    movement: 'Pull the handle down and across your body toward your outside hip, rotating through your torso, then return with control.',
    keyCue: 'Rotate from your core, not your arms — the half-kneeling position also removes your hips from helping, so the work stays in your torso.',
    feelIt: 'You should feel this in your obliques and core, not your lower back or shoulders.',
    regression: 'If this is too much, try it without any weight first, just practicing the rotation pattern.',
  },
  // Half-Kneeling Cable Lift — core, rotation
  ex_889: {
    startingPosition: 'Kneel on one knee with the other foot planted in front, facing sideways to the cable machine set low, gripping the handle with both hands.',
    movement: 'Pull the handle up and across your body toward your opposite shoulder, rotating through your torso, then return with control.',
    keyCue: 'Rotate from your core, not your arms — the half-kneeling position also removes your hips from helping, so the work stays in your torso.',
    feelIt: 'You should feel this in your obliques and core, not your lower back or shoulders.',
    regression: 'If this is too much, try it without any weight first, just practicing the rotation pattern.',
  },
  // Pilates Roll-Up — core, spinal control
  ex_898: {
    startingPosition: 'Lie on your back with legs extended and arms reaching overhead.',
    movement: 'Slowly curl your spine up off the floor one vertebra at a time, reaching forward toward your feet, then reverse the roll back down with control.',
    keyCue: 'Move through your spine slowly and evenly — resist the urge to just sit straight up, which skips the segmented rolling this exercise is built around.',
    feelIt: 'You should feel this as a controlled wave through your abs, not a strain in your lower back or neck.',
    regression: 'If this is too much, bend your knees with feet flat on the floor instead of legs extended — much easier to roll up.',
  },
  // Pilates Single-Leg Stretch — core, sustained hold
  ex_901: {
    startingPosition: 'Lie on your back with your upper body curled slightly off the floor, one knee pulled into your chest and the other leg extended out.',
    movement: 'Switch legs, pulling the extended leg in and extending the other one out, alternating with control.',
    keyCue: 'Keep your lower back pressed into the floor and your upper body steady the whole time — don’t let your torso rock as you switch legs.',
    feelIt: 'You should feel this deep in your abs from the sustained curl, not your neck straining.',
    regression: 'If this is too much, keep your upper body resting on the floor instead of curled up, and just alternate your legs.',
  },
  // Animal Flow Ape Reach — full body, floor flow
  ex_916: {
    startingPosition: 'Start in a low squat position, hands on the floor in front of you.',
    movement: 'Reach one hand forward and shift your weight onto it, moving into a low crawling reach, then repeat with the other hand, traveling forward.',
    keyCue: 'Stay low the entire time — resist the urge to let your hips rise up as you reach and shift your weight forward.',
    feelIt: 'You should feel this in your legs, shoulders, and core from staying low and controlled, not a strain in your lower back.',
    regression: 'If staying low is too demanding, take smaller reaches or move for a shorter distance until your control improves.',
  },
  // Burpee Box Jump Over — full body, conditioning
  ex_942: {
    startingPosition: 'Stand facing a sturdy box with feet shoulder-width apart.',
    movement: 'Drop into a squat, kick your feet back into a plank, do a push-up, jump your feet back in, then jump up and over the box, landing on the other side.',
    keyCue: 'Reset your balance on the landing before starting the next rep — chaining reps too fast while fatigued is where ankle and knee rolls happen on the box landing.',
    feelIt: 'You should feel this as a fast full-body effort, not a jolt in your knees or ankles on landing.',
    regression: 'If this is too much, do a regular burpee, then step over the box instead of jumping.',
  },
  // Behind-the-Neck Lat Pulldown — pull, high mobility demand
  ex_959: {
    startingPosition: 'Sit at the lat pulldown station, gripping the bar wide, positioned to pull down behind your head and neck.',
    movement: 'Pull the bar down behind your neck to about shoulder level, then let it return with control.',
    keyCue: 'This demands real shoulder mobility — only go as far as you can pull without craning your neck forward or feeling a pinch. If it doesn’t feel clean, pull to the front of your chest instead.',
    feelIt: 'You should feel this in your back and lats, not a pinch in the front of your shoulder or strain in your neck.',
    regression: 'If this doesn’t feel comfortable, use a standard front lat pulldown instead — same muscles, far less shoulder-mobility demand.',
  },
  // Slider Reverse Lunge — lunge, sliding surface
  ex_963: {
    startingPosition: 'Stand with one foot on a slider disc, feet hip-width apart.',
    movement: 'Slide the disc foot straight back along the floor, lowering into a lunge, then use your front leg to pull yourself back to standing.',
    keyCue: 'Keep your front knee tracking over your ankle and control the slide at a steady pace — sliding too fast makes the return harder to control.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If this is too much, try a regular bodyweight reverse lunge instead — same pattern, without the sliding surface.',
  },
  // Curtsy Lunge (Bodyweight) — squat/lunge, unilateral
  ex_980: {
    startingPosition: 'Stand tall with feet hip-width apart, hands on your hips.',
    movement: 'Step one leg diagonally behind and across your body, bending both knees to lower down, then push through your front foot to stand back up.',
    keyCue: 'Keep your front knee tracking over your ankle — don’t let it cave inward as you cross behind.',
    feelIt: 'You should feel this in your glutes and outer thigh, not a strain in your knee.',
    regression: 'If balance is the issue, hold onto something for support, or shorten how far you step behind.',
  },
  // Sumo Romanian Deadlift (Barbell) — hinge
  ex_987: {
    startingPosition: 'Stand with feet wider than shoulder-width, toes turned out, holding the bar at your thighs with hands inside your knees.',
    movement: 'Push your hips straight back while lowering the bar down your legs, keeping it close to your body, until you feel a stretch in your inner thighs and hamstrings, then drive your hips forward to stand back up.',
    keyCue: 'Your back stays flat the entire time — the wide stance changes where you feel the stretch, but the flat-back requirement doesn’t change.',
    feelIt: 'You should feel a stretch in your inner thighs and hamstrings, not your lower back.',
    regression: 'If keeping your back flat through the full range is hard, only lower the bar as far as you can control.',
  },
  // Split Squat (Bodyweight) — squat, unilateral
  ex_996: {
    startingPosition: 'Stand in a staggered stance, one foot forward and one foot back, both feet flat on the floor.',
    movement: 'Lower straight down by bending both knees until your back knee nearly touches the floor, then push through your front foot to stand back up.',
    keyCue: 'Keep your front knee tracking over your ankle and your torso upright — this is a straight up-and-down movement, not a forward lunge.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If balance is the issue, hold onto something sturdy for support.',
  },
  // Hill Sprints — conditioning, power
  ex_998: {
    startingPosition: 'Stand at the base of a hill or incline, feet shoulder-width apart.',
    movement: 'Sprint up the hill at maximum effort, then walk back down to recover before the next rep.',
    keyCue: 'Walk, don’t jog, back down to recover — the incline demands real effort, and rushing the recovery just degrades the quality of your next sprint.',
    feelIt: 'You should feel this as an intense effort in your legs and lungs, not a strain in your calves or hamstrings from pushing off too hard.',
    regression: 'If this is too much, use a gentler incline, or do the same effort on flat ground instead.',
  },
  // Decline Dumbbell Press — push
  ex_1001: {
    startingPosition: 'Lie on a decline bench with your feet secured, holding a dumbbell in each hand at chest level.',
    movement: 'Press the dumbbells straight up until your arms are extended, then lower them back down with control.',
    keyCue: 'Keep your wrists stacked over your elbows — don’t let them bend backward under the weight.',
    feelIt: 'You should feel this in your lower chest, not a strain in your wrists.',
    regression: 'If getting into position feels awkward, try a flat dumbbell bench press instead.',
  },
  // Kettlebell Jerk (Single-Arm) — overhead, power
  ex_1003: {
    startingPosition: 'Hold a kettlebell racked at one shoulder, feet hip-width apart.',
    movement: 'Dip slightly by bending your knees, then drive up and punch the bell overhead while dropping your body slightly under it, catching it with a straight arm.',
    keyCue: 'Keep the bell path close and vertical — use your legs to start the drive, not just your arm.',
    feelIt: 'You should feel your legs doing the initial work, with your shoulder finishing the lockout.',
    regression: 'If the timing feels off, practice a single-arm push press first to build the overhead lockout before adding the leg-drop-under.',
  },
  // Stability Ball Stir the Pot — core, unstable
  ex_1004: {
    startingPosition: 'Start in a forearm plank with your forearms resting on a stability ball.',
    movement: 'Keeping your body rigid, make small circular motions with your forearms on the ball, stirring in one direction, then reverse.',
    keyCue: 'Keep your hips level and still — the circular motion should come from your core resisting the ball’s wobble, not your hips swaying.',
    feelIt: 'You should feel this intensely in your abs from resisting the instability, not your lower back.',
    regression: 'If this is too much, try a regular stability ball plank first without adding the circular motion.',
  },
  // Dumbbell Push Press (Two-Arm) — overhead, power
  ex_1006: {
    startingPosition: 'Stand holding a dumbbell at each shoulder, feet shoulder-width apart.',
    movement: 'Dip slightly by bending your knees, then drive up through your legs and press both dumbbells overhead until your arms are straight.',
    keyCue: 'Keep the dumbbells’ path close and vertical — use your legs to start the drive, not just your arms.',
    feelIt: 'You should feel your legs doing the initial work, with your shoulders finishing the lockout.',
    regression: 'If the leg-drive timing feels off, practice a strict dumbbell shoulder press first.',
  },
  // Z Press (Barbell) — overhead, core demand
  ex_1007: {
    startingPosition: 'Sit on the floor with legs extended straight out in front of you, bar racked at your shoulders.',
    movement: 'Press the bar straight up overhead until your arms are extended, then lower it back to your shoulders with control.',
    keyCue: 'Sit up tall through your core the whole time — with no leg drive or back support available, your torso alone controls the bar’s balance.',
    feelIt: 'You should feel this in your shoulders and core working together, not a strain in your lower back.',
    regression: 'If sitting upright with the bar overhead is too much, try a seated dumbbell press with back support instead.',
  },
  // Pause Deadlift (Barbell) — hinge, tempo
  ex_1010: {
    startingPosition: 'Stand with feet hip-width apart, bar over your midfoot, and bend down to grip it just outside your knees.',
    movement: 'Stand up by pushing the floor away and driving your hips forward, pausing for a full 1-2 seconds just above your knees, then continue to full lockout.',
    keyCue: 'Stay tight through the pause — don’t let your back round or your hips shift while you hold that position.',
    feelIt: 'You should feel constant tension in your hamstrings and glutes through the pause, not a relaxing rest partway up.',
    regression: 'If holding the pause breaks your form, shorten it, or reduce the weight until you can hold it solidly.',
  },
  // TRX Single-Arm Row — pull, unilateral
  ex_1013: {
    startingPosition: 'Hold one TRX handle and lean back with your arm extended, feet planted, body in a straight line.',
    movement: 'Pull your chest up toward the handle by driving your elbow back, then lower with control.',
    keyCue: 'Keep your hips square — don’t let them rotate open to help pull the weight.',
    feelIt: 'You should feel this in your back and bicep on the working side, plus extra core work resisting the rotation, not your lower back.',
    regression: 'If this is too much, walk your feet forward to a more upright angle, or use both hands on a regular TRX row instead.',
  },
  // T Push-Up — push/core, rotation
  ex_1025: {
    startingPosition: 'Start in a push-up position, hands shoulder-width apart.',
    movement: 'Do a push-up, then as you press up, rotate your body and reach one arm straight up toward the ceiling, forming a T-shape, then return to the push-up position and repeat on the other side.',
    keyCue: 'Keep your hips square during the rotation — don’t let them sag or twist out of line as you reach up.',
    feelIt: 'You should feel this across your chest and shoulders from the push-up, plus your obliques and core from the rotation, not a strain in your lower back.',
    regression: 'If this is too much, do a regular push-up first, then add the rotation without a full push-up until your core control improves.',
  },
  // Spiderman Push-Up — push/core
  ex_1026: {
    startingPosition: 'Start in a push-up position, hands shoulder-width apart.',
    movement: 'As you lower into the push-up, bring one knee up toward the same-side elbow, then return it as you press back up, alternating sides each rep.',
    keyCue: 'Keep your hips level — don’t let them twist or drop as you bring your knee up.',
    feelIt: 'You should feel this across your chest and shoulders, plus your obliques and hip flexors, not a strain in your lower back.',
    regression: 'If this is too much, do a regular push-up first and add the knee drive once your form is solid.',
  },
  // Lateral Lunge (Bodyweight) — lunge, frontal plane
  ex_1027: {
    startingPosition: 'Stand tall with feet together, hands together at your chest or out for balance.',
    movement: 'Step one leg out to the side and bend that knee to lower down, keeping your other leg straight, then push back to center.',
    keyCue: 'Keep your bending knee tracking over your ankle — don’t let it cave inward as you sink into the side lunge.',
    feelIt: 'You should feel this in your inner thighs and glute of the bending leg, not a strain in your knee.',
    regression: 'If balance is the issue, hold onto something for support, or don’t step out as far.',
  },
  // Weighted Chin-Up — pull
  ex_1036: {
    startingPosition: 'Attach a weight belt or hold a dumbbell between your feet, then hang from the bar with palms facing toward you, arms fully straight.',
    movement: 'Pull yourself up by driving your elbows down toward your hips until your chin clears the bar, then lower back down with control.',
    keyCue: 'Only add weight once your bodyweight chin-ups are clean and controlled — extra load on a breaking-down chin-up is how shoulders get hurt.',
    feelIt: 'You should feel this in your back and biceps, not a strain in your shoulders.',
    regression: 'If the added weight breaks your form, drop it and build more bodyweight chin-up volume first.',
  },
  // Isometric Mid-Thigh Pull — full body, maximal strength test
  ex_1050: {
    startingPosition: 'Stand inside a rack with a bar set at mid-thigh height, gripping it as if starting a deadlift.',
    movement: 'Pull up against the fixed bar as hard as you can without it actually moving, holding maximum effort for the set time.',
    keyCue: 'Keep your back flat and brace hard the entire hold — this is a maximum-effort strength test, so ease into full intensity over the first second or two rather than yanking instantly.',
    feelIt: 'You should feel this as intense, whole-body tension through your legs, back, and grip, not a strain isolated in one spot.',
    regression: 'If pulling against a fixed bar isn’t available, a regular deadlift with a brief pause near lockout gives a similar effort.',
  },
  // Sots Press — overhead, high mobility demand
  ex_1051: {
    startingPosition: 'Hold the bar overhead with a wide grip, arms locked out, then squat down into the bottom of an overhead squat position.',
    movement: 'From that deep squat, lower the bar to your shoulders, then press it back up to lockout overhead without standing up.',
    keyCue: 'Keep your torso upright and the bar stacked over your midfoot throughout — this demands serious shoulder and hip mobility, so only go as deep as you can control.',
    feelIt: 'You should feel this in your shoulders and upper back, with your legs holding the deep squat position, not a strain in your lower back.',
    regression: 'If holding the deep squat while pressing is too much, practice a regular standing overhead press and a deep squat hold separately first.',
  },
  // Sumo Deadlift High Pull (Dumbbell) — hinge/pull, power
  ex_1052: {
    startingPosition: 'Stand with feet wider than shoulder-width, toes turned out, holding a dumbbell with both hands between your legs.',
    movement: 'Stand up by pushing the floor away and driving your hips forward, then continue pulling the dumbbell up toward your chin by driving your elbows high and out.',
    keyCue: 'The pull to your chin comes from your elbows leading high and wide — don’t just curl the weight up with your arms.',
    feelIt: 'You should feel this in your glutes and hamstrings from the deadlift portion, and your upper back and shoulders from the pull, not a strain in your lower back.',
    regression: 'If this is too much, do a sumo deadlift and a separate upright row instead of combining them.',
  },
  // Reeves Deadlift — hinge, grip
  ex_1053: {
    startingPosition: 'Stand over the bar with feet close together, and grip the actual plates instead of the bar itself.',
    movement: 'Stand up by pushing the floor away and driving your hips forward, keeping your grip on the plates the whole way.',
    keyCue: 'Expect to use significantly less weight than a normal deadlift — gripping the plates demands more forward lean and grip strength, so don’t chase your usual numbers.',
    feelIt: 'You should feel extra grip and upper-back demand on top of the usual hamstring and glute effort, not a strain in your lower back.',
    regression: 'If gripping the plates is too limiting, go back to a regular deadlift gripping the bar.',
  },
  // Hex Press (Dumbbell Squeeze Press) — push, isolation
  ex_1054: {
    startingPosition: 'Lie on a flat bench holding two dumbbells pressed together in front of your chest, palms facing each other.',
    movement: 'Press the dumbbells straight up while squeezing them together the entire time, then lower back down with control, still squeezing.',
    keyCue: 'Keep constant inward pressure squeezing the dumbbells together throughout the whole set — that squeeze is the entire point of this exercise.',
    feelIt: 'You should feel this intensely across your inner chest from the squeeze, not a strain in your wrists.',
    regression: 'If squeezing throughout is fatiguing, use lighter dumbbells and focus on maintaining the squeeze rather than the weight.',
  },
  // Clubbell Swing (Single-Arm) — shoulder, control
  ex_1055: {
    startingPosition: 'Stand holding a clubbell in one hand at your shoulder, feet shoulder-width apart.',
    movement: 'Swing the clubbell down and around in a controlled arc, letting it pass behind your shoulder, then swing it back up to the starting position.',
    keyCue: 'Move slowly and with control, especially as you build familiarity — an off-balance clubbell swings with real momentum, so don’t rush the arc.',
    feelIt: 'You should feel this in your shoulder and rotator cuff from controlling the arc, not a strain from fighting the momentum.',
    regression: 'If this is too much, practice with a very light clubbell or a similar-weight object first to learn the arc pattern.',
  },
  // Bulgarian Bag Swing — hinge, power
  ex_1057: {
    startingPosition: 'Stand holding the bag by its handles at your hips, feet shoulder-width apart.',
    movement: 'Hinge at your hips to swing the bag back slightly, then snap your hips forward to swing it up, letting your arms guide it.',
    keyCue: 'This is a hip snap, not an arm lift — keep your arms relaxed and let your hips do the work.',
    feelIt: 'You should feel this in your glutes and hamstrings from the hip snap, not your shoulders or lower back.',
    regression: 'If the hip-hinge timing feels off, practice a kettlebell swing first — same pattern, more common shape to learn on.',
  },
  // Boat Pose (Navasana) — core, balance hold
  ex_1060: {
    startingPosition: 'Sit on the floor with knees bent, feet flat, hands behind your thighs for support.',
    movement: 'Lean back slightly and lift your feet off the floor, extending your legs if you can, balancing on your sitting bones with arms extended forward, and hold.',
    keyCue: 'Keep your spine long and chest lifted — rounding your back to hold the position defeats the point and strains your lower back.',
    feelIt: 'You should feel this in your abs and hip flexors, not your lower back.',
    regression: 'If this is too much, keep your knees bent and hands on the floor or your thighs for extra support.',
  },
  // Warrior I Pose — squat, mobility hold
  ex_1064: {
    startingPosition: 'Stand with feet split front to back, front foot pointing forward and back foot angled slightly in.',
    movement: 'Bend your front knee to about 90 degrees while keeping your back leg straight and heel grounded, raising both arms overhead, and hold.',
    keyCue: 'Keep your front knee tracking directly over your ankle — don’t let it drift inward or past your toes.',
    feelIt: 'You should feel this in your front thigh and a stretch through your back hip, not a strain in your front knee.',
    regression: 'If keeping your back heel down is too much of a stretch, let it lift slightly, or shorten your stance.',
  },
  // Warrior III Pose — hinge, balance
  ex_1065: {
    startingPosition: 'Stand on one leg, slight bend in your standing knee, arms extended forward.',
    movement: 'Hinge forward at your hips while extending your free leg straight back, forming a T-shape with your body parallel to the floor, and hold.',
    keyCue: 'Keep your hips square to the floor — don’t let them rotate open as you extend your leg back.',
    feelIt: 'You should feel this in your standing leg and glute working to balance, not your lower back.',
    regression: 'If balance is hard, hold onto something light for support, or only hinge partway.',
  },
  // Chair Pose (Utkatasana) — squat, hold
  ex_1075: {
    startingPosition: 'Stand with feet together or hip-width apart.',
    movement: 'Bend your knees and sit your hips back as if sitting into a chair, raising your arms overhead, and hold.',
    keyCue: 'Keep your weight in your heels and your knees behind your toes — don’t let them drift forward as you sink down.',
    feelIt: 'You should feel this in your quads and glutes, not a strain in your knees.',
    regression: 'If holding this is too much, don’t sit back as deep, or shorten the hold time.',
  },
  // Bow Pose (Dhanurasana) — full body, backbend
  ex_1078: {
    startingPosition: 'Lie face-down, bend your knees, and reach back to hold your ankles with your hands.',
    movement: 'Kick your feet up and away from your hands, lifting your chest and thighs off the floor into a backbend, and hold.',
    keyCue: 'This is a real spinal extension — only lift as high as feels open and supported, and never force it if your lower back feels pinched.',
    feelIt: 'You should feel a stretch through your chest and the front of your thighs, not a pinch concentrated in your lower back.',
    regression: 'If this is too much, try a single-leg version, holding just one ankle and lifting one side at a time.',
  },
  // Reverse Warrior Pose — squat, side bend
  ex_1088: {
    startingPosition: 'Start in Warrior II with your front knee bent to about 90 degrees, arms extended out to the sides.',
    movement: 'Reach your back arm down along your back leg and your front arm up and back, arching your torso into a side bend, and hold.',
    keyCue: 'Keep your front knee tracking over your ankle throughout the side bend — don’t let it drift inward as your torso arches back.',
    feelIt: 'You should feel a stretch along your side body, plus your front thigh working to hold the lunge, not a strain in your front knee.',
    regression: 'If holding the deep front-knee bend and the side bend together is too much, shorten your stance or bend less deeply.',
  },
  // Dancer Pose (Natarajanasana) — full body, balance
  ex_1089: {
    startingPosition: 'Stand on one leg, holding your other foot behind you with the same-side hand.',
    movement: 'Hinge your torso forward while kicking your held foot up and back, reaching your free arm forward, and hold.',
    keyCue: 'Move slowly into the pose and only go as far as you can control — this demands real balance, and rushing into the deepest position risks losing it.',
    feelIt: 'You should feel a stretch through the front of your held leg and a balancing effort through your standing leg, not a strain in your lower back.',
    regression: 'If balance is hard, hold onto something for support, or don’t kick your leg back as far.',
  },
  // Crescent Lunge (High Lunge) — squat, mobility hold
  ex_1091: {
    startingPosition: 'Step one foot forward into a deep lunge, back heel lifted off the floor.',
    movement: 'Raise both arms overhead, keeping your front knee bent and back leg straight, and hold.',
    keyCue: 'Keep your front knee tracking over your ankle — don’t let it drift forward past your toes.',
    feelIt: 'You should feel this in your front thigh and glute, plus a stretch through your back hip flexor, not a strain in your front knee.',
    regression: 'If holding the balance is hard, drop your back knee to the floor to turn this into a kneeling lunge stretch instead.',
  },
  // Plow Pose (Halasana) — full body, inversion
  ex_1094: {
    startingPosition: 'Lie on your back, then lift your legs and hips up, supporting your lower back with your hands.',
    movement: 'Continue lowering your legs over your head until your toes reach (or approach) the floor behind you, and hold.',
    keyCue: 'Never turn your head side to side while in this position — with your bodyweight loading your neck, that twisting motion is a real neck-injury risk.',
    feelIt: 'You should feel a stretch through your back and hamstrings, not pressure or strain in your neck.',
    regression: 'If your toes can’t reach the floor, that’s fine — hold at whatever height keeps your neck comfortable, or try Legs Up The Wall instead.',
  },
  // Standing Split — hinge, flexibility/balance
  ex_1096: {
    startingPosition: 'Stand on one leg, hinging forward at your hips with your hands on the floor or a block.',
    movement: 'Lift your free leg straight up behind you as high as your hamstring flexibility allows, and hold.',
    keyCue: 'Keep your standing leg only slightly bent, not locked — and only lift your back leg as high as you can while keeping your hips square.',
    feelIt: 'You should feel a deep stretch in the hamstring of your standing leg, not a strain in your lower back.',
    regression: 'If this is too much, keep your lifted leg lower, or hold onto something for balance support.',
  },
  // Monkey Pose (Hanumanasana) — full body, deep flexibility
  ex_1108: {
    startingPosition: 'Kneel with one leg forward and one leg back, hands on the floor for support.',
    movement: 'Slowly slide your front leg forward and back leg backward, lowering into a full front-to-back split as far as you can control.',
    keyCue: 'This is one of the deepest common flexibility poses — ease in slowly and stop well before any sharp or pulling sensation, never bounce into it.',
    feelIt: 'You should feel a deep, steady stretch through both hamstrings and hip flexors, never a sharp pain.',
    regression: 'If a full split is far out of reach, use blocks or blankets under your hips for support and only go as far as feels like a stretch, not strain.',
  },
  // Blood Flow Restriction Cable Triceps Pushdown — push, specialized protocol
  ex_1600: {
    startingPosition: 'With a BFR cuff fitted snugly around the top of your working arm at the pressure your protocol specifies, stand at the cable machine gripping the attachment with elbows tucked to your sides.',
    movement: 'Extend your arms down until straight, then let the attachment return with control, using light weight and high reps.',
    keyCue: 'BFR training uses much lighter loads than normal — the restricted blood flow, not the weight, creates the training effect, so don’t add weight to compensate. Stop immediately if you feel numbness, tingling, or sharp pain rather than the expected deep burn.',
    feelIt: 'You should feel an intense burning pump in your triceps at a light weight, not numbness or sharp pain from the cuff.',
    regression: 'If you’re unfamiliar with BFR training, learn the proper cuff pressure and timing protocol from a professional before using it — it’s not just a regular exercise with a band added.',
  },
  // Overhead Lunge — lunge, overhead stability
  ex_1134: {
    startingPosition: 'Hold a light weight locked out overhead with both arms, feet hip-width apart.',
    movement: 'Step forward into a lunge and lower until both knees are bent to about 90 degrees, keeping the weight overhead, then push through your front foot to return to standing.',
    keyCue: 'Keep your core braced and the weight stacked directly overhead — don’t let your lower back arch to hold it up.',
    feelIt: 'You should feel this in your front thigh and glute, plus your shoulders and core holding the overhead position, not a strain in your lower back.',
    regression: 'If holding weight overhead is too much, hold it at your chest instead, or try a bodyweight lunge first.',
  },
  // Deficit Reverse Lunge — lunge, extended range
  ex_1135: {
    startingPosition: 'Stand on a small raised platform (a plate or low step), feet hip-width apart.',
    movement: 'Step one leg back and down off the platform into a lunge, lowering until both knees are bent to about 90 degrees, then push through your front foot to return to standing on the platform.',
    keyCue: 'The extra height increases the range of motion — control the step down deliberately rather than letting gravity drop you into the bottom.',
    feelIt: 'You should feel this in your front thigh and glute through a deeper range than a regular reverse lunge, not a strain in your front knee.',
    regression: 'If the extra range is too much, lower the platform height, or go back to a regular reverse lunge on flat ground.',
  },
  // B-Stance Hip Thrust — hinge, semi-unilateral
  ex_1139: {
    startingPosition: 'Sit on the ground with your upper back against a bench, a bar resting across your hips, one foot flat on the floor slightly ahead and the other foot staggered back with just the toes touching down.',
    movement: 'Drive your hips straight up mostly through your front foot until your body forms a straight line from shoulders to knees, then lower back down with control.',
    keyCue: 'Keep most of your weight driving through your front foot — the back foot is there for light balance support, not to share the load.',
    feelIt: 'You should feel this mostly in the glute of your front leg, not your lower back.',
    regression: 'If this is too much, go back to a regular two-foot hip thrust first.',
  },
  // Feet-Elevated Hip Thrust — hinge, extended range
  ex_1142: {
    startingPosition: 'Sit on the ground with your upper back against a bench, feet elevated on a second bench or box, a bar resting across your hips.',
    movement: 'Drive your hips straight up until your body forms a straight line from shoulders to knees, then lower back down with control.',
    keyCue: 'The elevated feet increase your range of motion — keep your core braced through the extra stretch at the bottom rather than letting your lower back take over.',
    feelIt: 'You should feel this in your glutes through a deeper stretch than a regular hip thrust, not your lower back.',
    regression: 'If the extra range is too much, go back to a regular hip thrust with your feet on the floor.',
  },
  // Hanging Oblique Knee Raise — core, hanging rotation
  ex_1145: {
    startingPosition: 'Hang from a pull-up bar with your arms straight, legs extended below you.',
    movement: 'Raise your knees up and across toward one side of your body, then lower and repeat toward the other side.',
    keyCue: 'Move with control, not momentum — swinging your body to throw your knees up takes the work away from your obliques.',
    feelIt: 'You should feel this in your obliques, not your hip flexors straining or your grip giving out first.',
    regression: 'If this is too much, try a regular hanging knee raise straight up first before adding the diagonal angle.',
  },
  // Fat Grip Pull-Up — pull, grip
  ex_1147: {
    startingPosition: 'Fit thick grip attachments onto the pull-up bar and hang with arms straight.',
    movement: 'Pull yourself up by driving your elbows down toward your hips until your chin clears the bar, then lower back down with control.',
    keyCue: 'Grip the thick bar firmly with your whole hand — this demands significantly more grip strength than a regular bar, so expect fewer reps than usual.',
    feelIt: 'You should feel extra grip and forearm burn on top of your back and biceps working, not a strain in your wrists.',
    regression: 'If the thick grip is too limiting, use a regular bar grip and add the thick attachments only for lighter accessory sets.',
  },
  // Cambered Bar Squat — squat
  ex_1148: {
    startingPosition: 'Position the cambered bar across your upper back, gripping the bent portions, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'The bar’s curve makes it swing side to side more than a straight bar — keep your core tightly braced to control that extra oscillation.',
    feelIt: 'You should feel this in your quads and glutes, plus extra core stability work controlling the bar’s sway, not a strain in your lower back.',
    regression: 'If the bar’s movement feels unfamiliar, try a regular barbell back squat instead.',
  },
  // Ring Support Hold — push, unstable
  ex_1149: {
    startingPosition: 'Support yourself on gymnastic rings with arms straight, body hanging below.',
    movement: 'Hold this straight-arm support position, keeping the rings steady and turned out slightly, for the set time.',
    keyCue: 'Actively press the rings down and slightly outward to keep them from turning in — a passive hold lets them wobble and puts more strain on your shoulders.',
    feelIt: 'You should feel this in your shoulders, triceps, and core working to stay stable, not a strain in your wrists.',
    regression: 'If this is too much, try a support hold on parallel bars instead — same position, without the ring instability.',
  },
  // Half-Kneeling Cable Row — pull, core stability
  ex_1168: {
    startingPosition: 'Kneel on one knee with the other foot planted in front, facing the cable machine, gripping the handle with one hand.',
    movement: 'Pull the handle toward your ribs by driving your elbow back, then extend back out with control.',
    keyCue: 'Keep your torso upright and still — the half-kneeling position removes your hips from helping, so the work stays in your back.',
    feelIt: 'You should feel this in your back and lat, not your lower back or shoulder.',
    regression: 'If balance in the half-kneeling position is hard, try a standing single-arm cable row instead.',
  },
  // Half-Kneeling Face Pull — pull, core stability
  ex_1169: {
    startingPosition: 'Kneel on one knee with the other foot planted in front, facing the cable machine set at face height, gripping the rope with both hands.',
    movement: 'Pull the rope toward your face, leading with your elbows high and wide, then return with control.',
    keyCue: 'Keep your torso upright and still — the half-kneeling position also removes momentum from your hips, so keep the pull deliberate.',
    feelIt: 'You should feel this in your rear shoulders and upper back, not your neck or lower back.',
    regression: 'If balance in the half-kneeling position is hard, try a standing face pull instead.',
  },
  // Crossover Step-Up — lunge/squat, lateral
  ex_1186: {
    startingPosition: 'Stand beside a box, facing sideways to it.',
    movement: 'Cross your near leg over in front of your body and step it up onto the box, driving through it to stand up on top, then step back down with control.',
    keyCue: 'Push through your whole foot on the box, not just your toes — and keep your hips square as you cross over.',
    feelIt: 'You should feel this in the outer thigh and glute of the stepping leg, not a strain in your knee.',
    regression: 'If the crossing motion feels awkward, try a regular box step-up straight on instead.',
  },
  // Jefferson Squat — squat, asymmetric stance
  ex_1187: {
    startingPosition: 'Straddle the bar with one foot forward and one foot back, gripping it with one hand in front of your body and one behind.',
    movement: 'Squat down by bending both knees, keeping your torso as upright as the straddled stance allows, then drive through your feet to stand back up.',
    keyCue: 'Keep your weight balanced between both feet — the asymmetric stance makes it easy to load unevenly if you’re not deliberate.',
    feelIt: 'You should feel this in your quads and glutes on both sides, not a twist through your lower back.',
    regression: 'If the asymmetric stance feels awkward, try a regular barbell back squat instead.',
  },
  // Sprawl — full body, conditioning
  ex_1192: {
    startingPosition: 'Stand with feet shoulder-width apart.',
    movement: 'Drop into a squat, place your hands on the floor, and kick your feet back into a plank position in one fast motion, then jump your feet back in to stand.',
    keyCue: 'Keep your core braced through the floor portion — don’t let your hips sag when your feet kick back.',
    feelIt: 'You should feel this as a fast, explosive full-body effort, not a jolt in your lower back.',
    regression: 'If this is too much, step your feet back and forward instead of kicking them explosively.',
  },
  // McGill Curl-Up — core, spine-sparing
  ex_1196: {
    startingPosition: 'Lie on your back with one knee bent and foot flat, the other leg straight, hands placed under your lower back for support.',
    movement: 'Brace your core and lift your head and shoulders slightly off the floor, keeping your lower back pressed into your hands, then lower back down.',
    keyCue: 'Lift only a small amount — this is a low-range, spine-sparing core exercise, not a full sit-up, so more range isn’t the goal.',
    feelIt: 'You should feel this as tension through your abs, not a strain in your neck or lower back.',
    regression: 'If even a small lift is uncomfortable, just practice bracing your core without lifting at all first.',
  },
  // Pilates Teaser — core, advanced balance
  ex_1198: {
    startingPosition: 'Lie on your back with knees bent and arms extended overhead.',
    movement: 'Simultaneously curl your torso up and extend your legs to a V-shape, reaching your arms toward your feet, then lower back down with control.',
    keyCue: 'Move slowly and keep your lower back from arching as you balance in the V-shape — this is a demanding, advanced core movement.',
    feelIt: 'You should feel this deep in your abs from the balance, not your lower back or hip flexors straining.',
    regression: 'If this is too much, keep your knees bent throughout instead of extending your legs straight — much easier to balance.',
  },
  // Mixed Grip Deadlift — hinge, grip
  ex_1208: {
    startingPosition: 'Stand with feet hip-width apart, bar over your midfoot, gripping it with one palm facing you and one facing away.',
    movement: 'Stand up by pushing the floor away with your legs and driving your hips forward, keeping the bar close to your shins the whole way up.',
    keyCue: 'Alternate which hand is over and which is under between sets — a mixed grip loads your shoulders and spine asymmetrically, so switching sides balances that out over time.',
    feelIt: 'You should feel this in your hamstrings and glutes, not a twist through your lower back.',
    regression: 'If this is too much, use a double-overhand grip with lifting straps instead.',
  },
  // Clean High Pull — pull, power
  ex_1212: {
    startingPosition: 'Stand with the bar over your midfoot, feet hip-width apart, gripping just outside your knees.',
    movement: 'Pull the bar up explosively by extending your hips, then continue pulling it high toward your chest by driving your elbows up and out, without catching it in a rack position.',
    keyCue: 'Keep the bar close to your body the entire pull — this drill builds the pulling power for the clean without adding the catch.',
    feelIt: 'You should feel this as an explosive pull from your hips and legs, not an arm curl.',
    regression: 'If the full extension feels unfamiliar, practice a regular deadlift first to build the base pulling strength.',
  },
  // Muscle Clean — full body, technical
  ex_1213: {
    startingPosition: 'Stand with the bar over your midfoot, feet hip-width apart, gripping just outside your knees.',
    movement: 'Pull the bar up in one continuous motion and pull yourself under it just enough to catch it racked at your shoulders without dropping into a squat.',
    keyCue: 'Keep your elbows moving fast and turning over quickly at the top — a slow elbow turnover is what causes the bar to catch awkwardly on your wrists.',
    feelIt: 'You should feel this as one continuous pull-to-catch in your upper back and shoulders, not a series of separate arm movements.',
    regression: 'If the fast elbow turnover feels unfamiliar, practice with a lighter bar to build the pattern first.',
  },
  // Side Crow Pose (Parsva Bakasana) — full body, balance
  ex_1220: {
    startingPosition: 'Squat down with your knees together, rotate your torso to one side, and plant your hands on the floor on that side.',
    movement: 'Lean your weight forward onto your hands and lift your feet off the floor, balancing your rotated body on your arms.',
    keyCue: 'Keep your gaze slightly forward and your core engaged — this asks for more rotation control than a regular crow pose, so ease into the lift gradually.',
    feelIt: 'You should feel this as a controlled balance through your arms and obliques, not a strain in your wrists.',
    regression: 'If this is too much, master a regular crow pose first before adding the side rotation.',
  },
  // Zercher Lunge — lunge
  ex_1221: {
    startingPosition: 'Cradle a bar or sandbag in the crooks of your elbows, arms crossed in front of your chest, feet hip-width apart.',
    movement: 'Step forward into a lunge and lower until both knees are bent to about 90 degrees, then push through your front foot to return to standing.',
    keyCue: 'Keep your torso upright and core braced — if you lean forward, the load pulls uncomfortably on your elbows.',
    feelIt: 'You should feel this in your front thigh and glute, not a sharp pain in your elbows.',
    regression: 'If holding the load at your elbows is uncomfortable, try a goblet lunge instead — held at your chest, easier to hold.',
  },
  // Suitcase Lunge (Dumbbell) — lunge, anti-lateral-flexion
  ex_1225: {
    startingPosition: 'Stand tall holding one dumbbell at your side, other hand free.',
    movement: 'Step forward into a lunge and lower until both knees are bent to about 90 degrees, keeping your torso upright and resisting the pull toward the weighted side, then push through your front foot to return to standing.',
    keyCue: 'Resist leaning or tilting toward the loaded side — keeping your torso upright and square is the whole point of this variation.',
    feelIt: 'You should feel this in your front thigh and glute, plus extra core work staying square, not a strain in your lower back.',
    regression: 'If staying square is hard, use a lighter dumbbell or hold weights in both hands instead.',
  },
  // Landmine Single-Leg RDL — hinge, unilateral
  ex_1229: {
    startingPosition: 'Stand on one leg holding the end of a landmine-anchored bar with both hands, slight bend in your standing knee.',
    movement: 'Hinge forward at your hips, letting your free leg extend back for balance, until your torso is roughly parallel to the floor, then return to standing.',
    keyCue: 'Keep your hips square and the bar close to your body — don’t let your hips rotate open as you hinge.',
    feelIt: 'You should feel a stretch in the hamstring of your standing leg, not your lower back.',
    regression: 'If balance is hard, hold onto something light for support, or do it without weight first.',
  },
  // Landmine Sumo Deadlift — hinge
  ex_1230: {
    startingPosition: 'Straddle the landmine bar with feet wider than shoulder-width, toes turned out, gripping the end with both hands between your legs.',
    movement: 'Stand up by pushing the floor away and driving your hips forward, keeping the bar close to your body the whole way up.',
    keyCue: 'Keep your back flat and your knees pushed out in line with your toes — don’t let them cave inward.',
    feelIt: 'You should feel this in your glutes and inner thighs, not your lower back or knees.',
    regression: 'If this is too much load, try a bodyweight sumo squat instead to practice the stance and depth.',
  },
  // Long Lever Plank — core, extended lever
  ex_1237: {
    startingPosition: 'Start in a forearm plank position, but walk your elbows forward slightly past where they’d normally be, further from your feet.',
    movement: 'Hold this extended-lever plank position, keeping your body in a straight line, for the set time.',
    keyCue: 'Keep your core braced hard the entire hold — the longer lever significantly increases the demand compared to a regular plank, so expect a much shorter hold time.',
    feelIt: 'You should feel this intensely in your abs, not your lower back or shoulders.',
    regression: 'If this is too much, go back to a regular forearm plank with your elbows under your shoulders.',
  },
  // Counterweight Pistol Squat — squat, assisted balance
  ex_1240: {
    startingPosition: 'Stand on one leg holding a light weight out in front of you with both hands, other leg extended out in front of you.',
    movement: 'Bend your standing knee to lower down as far as you can control, using the weight out front as a counterbalance, then push back up to standing.',
    keyCue: 'Keep the weight extended out in front the whole time — it’s there to help you balance by shifting your center of gravity, not to add resistance.',
    feelIt: 'You should feel this in your standing thigh and glute, not a strain in your knee.',
    regression: 'If this is too much, hold onto something for support instead, or try a box pistol squat to a raised surface.',
  },
  // Trap Bar Deadlift (High Handle) — hinge, reduced range
  ex_1245: {
    startingPosition: 'Stand inside the trap bar with feet hip-width apart, gripping the higher set of handles.',
    movement: 'Stand up by pushing the floor away with your legs and driving your hips forward, keeping your chest up the whole way.',
    keyCue: 'The high handles shorten your range of motion and let you stay more upright — a good option if a full-range deadlift bothers your lower back.',
    feelIt: 'You should feel this in your quads, hamstrings, and glutes, not your lower back.',
    regression: 'If this still feels like too much load, reduce the weight until your form stays clean through the full lift.',
  },
  // V-Sit (Parallettes) — core, advanced hold
  ex_1257: {
    startingPosition: 'Support your body on parallettes with straight arms, legs extended in an L-shape in front of you.',
    movement: 'Raise your legs from the L-shape up higher into a V-shape, bringing them closer to your torso, and hold.',
    keyCue: 'Keep your shoulders pressed down away from your ears — don’t let them shrug up to compensate for the extra leg height.',
    feelIt: 'You should feel this intensely in your core and hip flexors, not your shoulders straining upward.',
    regression: 'If this is too much, master an L-sit first before working toward the higher V-shape.',
  },
  // Cross-Arm Front Squat (Barbell) — squat
  ex_1265: {
    startingPosition: 'Rest the bar across the front of your shoulders, arms crossed in front of your chest to hold it in place, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Keep your elbows up and pointed forward — this crossed-arm grip is an alternative to the clean grip, but the same elbow-up cue keeps the bar from rolling forward.',
    feelIt: 'You should feel this in your quads and upper back, not your wrists or lower back.',
    regression: 'If this cross-arm grip feels unfamiliar, try a goblet squat instead — same front-loaded position, easier to hold.',
  },
  // Kas Glute Bridge — hinge, partial range
  ex_1269: {
    startingPosition: 'Lie on your back with knees bent, feet flat, bar resting across your hips.',
    movement: 'Drive your hips up to the top of a glute bridge, then lower only partway back down before driving back up again, staying within the top half of the range for the whole set.',
    keyCue: 'Keep the reps short and constant — never lowering all the way down is what keeps continuous tension on your glutes.',
    feelIt: 'You should feel a deep, constant burn in your glutes from the partial range, not your lower back.',
    regression: 'If this is too much, do regular full-range glute bridges instead.',
  },
  // Handstand Shoulder Taps — overhead, balance
  ex_1276: {
    startingPosition: 'Kick up into a handstand against a wall, hands shoulder-width apart.',
    movement: 'Shift your weight onto one hand and tap the opposite shoulder with your free hand, then alternate sides while staying balanced.',
    keyCue: 'Keep your core tightly braced and hips stacked over your shoulders — the single-arm weight shift is a real balance and core-stability test.',
    feelIt: 'You should feel this in your shoulders and core working to stay stable, not a strain in your lower back.',
    regression: 'If this is too much, master a solid handstand hold first before adding the shoulder taps.',
  },
  // Ring Fly (Suspended Chest Fly) — push, isolation
  ex_1277: {
    startingPosition: 'Hold gymnastic rings with arms extended out to your sides, body leaning forward at an angle, feet planted.',
    movement: 'Bring your hands together in front of your chest by squeezing your chest muscles, then let the rings return out to the sides with control.',
    keyCue: 'Keep a slight bend in your elbows throughout — locking them straight puts unwanted strain on your elbow joints under this leaning bodyweight load.',
    feelIt: 'You should feel this across your chest, not a strain in your elbows.',
    regression: 'If this is too much, stand more upright to reduce the lean, or try a regular dumbbell fly instead.',
  },
  // Squat Thrust — full body, conditioning
  ex_1278: {
    startingPosition: 'Stand with feet shoulder-width apart.',
    movement: 'Drop into a squat, place your hands on the floor, kick your feet back into a plank, then jump your feet back in to stand — no push-up or jump at the top.',
    keyCue: 'Keep your core braced through the floor portion — don’t let your hips sag when your feet kick back.',
    feelIt: 'You should feel this as a fast full-body effort, not a jolt in your lower back.',
    regression: 'If this is too much, step your feet back and forward instead of kicking them out quickly.',
  },
  // Split Jump (Alternating Lunge Jump) — lunge, power
  ex_1280: {
    startingPosition: 'Start in a lunge position, one foot forward and one back, both knees bent to about 90 degrees.',
    movement: 'Jump straight up and switch your legs in the air, landing in a lunge with the opposite leg forward, then repeat continuously.',
    keyCue: 'Land soft with bent knees on each switch — landing stiff repeatedly is a real knee-stress risk over multiple reps.',
    feelIt: 'You should feel this as an explosive effort in your thighs and glutes, not a jolt in your knees on landing.',
    regression: 'If this is too much, try a regular walking lunge or reverse lunge instead — same muscles, no jumping impact.',
  },
  // Sandbag Overhead Carry (Bear Hug Press Hold) — carry, overhead
  ex_1300: {
    startingPosition: 'Clean the sandbag to your chest, then press it overhead until your arms are locked out.',
    movement: 'Walk forward at a steady pace, keeping the bag locked overhead, for the set distance or time.',
    keyCue: 'Keep your ribs down and core braced — don’t let your lower back arch to keep the bag up.',
    feelIt: 'You should feel this in your shoulders and core from staying stacked, not a strain in your lower back.',
    regression: 'If this is too much, hold the bag at your chest instead of overhead, or use a lighter bag.',
  },
  // Box Pistol Squat — squat, assisted
  ex_1309: {
    startingPosition: 'Stand on one leg in front of a box or bench, other leg extended out in front of you.',
    movement: 'Bend your standing knee to lower down and sit lightly onto the box, then push back up to standing.',
    keyCue: 'Sit down under control rather than dropping onto the box — this is a controlled squat with a safety net, not a fall.',
    feelIt: 'You should feel this in your standing thigh and glute, not a strain in your knee.',
    regression: 'If this is too much, use a higher box, or hold onto something for balance support.',
  },
  // Plank Shoulder Taps — core, anti-rotation
  ex_1310: {
    startingPosition: 'Start in a high plank position, hands under your shoulders.',
    movement: 'Tap one hand to the opposite shoulder, then return it to the floor and repeat with the other hand, alternating.',
    keyCue: 'Keep your hips as still as possible — resisting the urge to rock side to side is the whole point of the exercise.',
    feelIt: 'You should feel this in your core working to stay still, not your shoulders doing all the work.',
    regression: 'If this is too much, widen your feet for more stability, or drop to your knees.',
  },
  // Plank Walkout — full body
  ex_1311: {
    startingPosition: 'Stand tall with feet hip-width apart.',
    movement: 'Hinge forward and walk your hands out along the floor into a high plank, then walk them back to your feet and stand up.',
    keyCue: 'Keep your core braced the entire time your hands are walking out — don’t let your hips sag once you reach the plank.',
    feelIt: 'You should feel this in your core and shoulders, not a strain in your lower back.',
    regression: 'If reaching a full plank is too much, only walk your hands out partway before walking them back.',
  },
  // Chest Dip (Wide Grip, Forward Lean) — push
  ex_1315: {
    startingPosition: 'Support yourself on wide-set parallel bars, arms straight, leaning your torso forward.',
    movement: 'Lower your body by bending your elbows until your shoulders are about level with your elbows, then press back up to straight arms.',
    keyCue: 'Don’t drop lower than your shoulders reaching elbow height — going deeper puts real strain on the front of your shoulder, especially with the forward lean.',
    feelIt: 'You should feel this across your chest, not a pinch in the front of your shoulder.',
    regression: 'If this is too much, try a regular parallel bar dip with a more upright torso instead — less chest emphasis, easier on your shoulders.',
  },
  // Tuck Dragon Flag — core, high skill
  ex_1317: {
    startingPosition: 'Lie on a bench, gripping something sturdy behind your head for support, knees bent toward your chest.',
    movement: 'Lift your hips and lower back off the bench, keeping your knees tucked, pivoting only at your shoulders, then lower slowly with control.',
    keyCue: 'Keep your whole body rigid as one unit — if your hips sag or bend independently, you’ve lost the position and should stop there.',
    feelIt: 'You should feel this intensely through your entire core, not your lower back.',
    regression: 'If this is too much, try a reverse crunch instead — smaller range, same general direction of effort.',
  },
  // One-Arm Pull-Up (Assisted, Band) — pull, high skill
  ex_1318: {
    startingPosition: 'Loop a resistance band around the pull-up bar and hold one end in your working hand for extra support, hang with that arm mostly straight.',
    movement: 'Pull yourself up using mostly one arm, letting the band assist, until your chin clears the bar, then lower back down with control.',
    keyCue: 'Keep your body from twisting — pull as straight up as you can rather than rotating your torso to fake the range.',
    feelIt: 'You should feel this heavily in the back and bicep of the working arm, not a strain in your shoulder.',
    regression: 'If this is too much even with a band, build up through archer pull-ups and weighted single-arm rows first.',
  },
  // Plank Up-Down (Plank to Push-Up) — core/push
  ex_1321: {
    startingPosition: 'Start in a forearm plank, body in a straight line.',
    movement: 'Push up one arm at a time into a high plank on straight arms, then lower back down one arm at a time to your forearms.',
    keyCue: 'Keep your hips still and square the whole time — don’t let them rock side to side as you change arm positions.',
    feelIt: 'You should feel this in your shoulders, chest, and core working to stay stable, not your lower back.',
    regression: 'If this is too much, drop to your knees to reduce the plank demand while you build the arm-to-arm transition.',
  },
  // Reverse Plank Leg Lift — full body
  ex_1324: {
    startingPosition: 'Sit on the floor with legs extended, hands placed behind your hips, and lift your hips into a reverse plank.',
    movement: 'Keeping your hips lifted, raise one leg straight up a few inches, then lower it and repeat with the other leg.',
    keyCue: 'Keep your hips level and lifted the entire time — don’t let them dip as you lift each leg.',
    feelIt: 'You should feel this in your glutes, hamstrings, and core, not your wrists.',
    regression: 'If this is too much, hold a regular reverse plank first without lifting either leg.',
  },
  // Bird Dog Crunch — core
  ex_1325: {
    startingPosition: 'Start on your hands and knees, hands under your shoulders and knees under your hips.',
    movement: 'Extend one arm and the opposite leg out straight, then crunch them together underneath your body by bringing your elbow and knee toward each other, and repeat.',
    keyCue: 'Keep your hips level and facing the floor throughout — don’t let them rotate open as you extend and crunch.',
    feelIt: 'You should feel this in your core and obliques, not your lower back.',
    regression: 'If this is too much, try a regular bird dog first — hold the extended position without adding the crunch.',
  },
  // Barbell Hip Thrust March — hinge, unilateral stability
  ex_1328: {
    startingPosition: 'Sit on the ground with your upper back against a bench, a bar resting across your hips, feet flat and knees bent.',
    movement: 'Drive your hips up into a hip thrust, then while holding that top position, lift one foot off the floor and march it up, alternating legs without letting your hips drop.',
    keyCue: 'Keep your hips level and lifted the entire time you’re marching — don’t let the working side dip as your foot comes up.',
    feelIt: 'You should feel this in your glutes, with extra stability demand from the marching, not your lower back.',
    regression: 'If this is too much, master a regular barbell hip thrust first before adding the single-leg march at the top.',
  },
  // Weighted L-Sit — core, high skill
  ex_1330: {
    startingPosition: 'Support your body on parallettes or a bar with straight arms, a light weight held between your ankles, legs extended straight out in front of you.',
    movement: 'Hold this position, keeping your legs raised parallel to the floor with the added weight, for the set time.',
    keyCue: 'Only add weight once your bodyweight L-sit is solid — extra load on a breaking-down hold just teaches poor positioning.',
    feelIt: 'You should feel this in your core and hip flexors, not your shoulders straining upward.',
    regression: 'If this is too much, remove the added weight and go back to a bodyweight L-sit first.',
  },
  // Weighted Single-Leg Glute Bridge — hinge, unilateral
  ex_1331: {
    startingPosition: 'Lie on your back with one foot flat on the floor, other leg extended, a dumbbell resting on your hips.',
    movement: 'Drive your hips straight up through your planted foot, keeping the dumbbell steady, then lower back down with control.',
    keyCue: 'Keep your hips level — don’t let the unsupported side dip or rotate as you press up.',
    feelIt: 'You should feel this in the glute of your planted leg, not your lower back.',
    regression: 'If the dumbbell feels awkward to balance, remove it and do a bodyweight single-leg glute bridge instead.',
  },
  // Lateral Step Down (Eccentric Knee Control) — squat, tempo
  ex_1337: {
    startingPosition: 'Stand on one leg on top of a box or step, other leg hanging free out to the side.',
    movement: 'Slowly lower your free leg down and out to the side toward the floor by bending your standing knee, tapping lightly, then push back up to standing on the box.',
    keyCue: 'Control the descent the entire way down — this is an eccentric-strength drill for your knee, and dropping fast defeats the purpose.',
    feelIt: 'You should feel this in your standing thigh and glute, not a strain in your knee.',
    regression: 'If this is too much, use a lower step, or only lower partway down.',
  },
  // Tall-Kneeling Pallof Press — core, anti-rotation
  ex_1339: {
    startingPosition: 'Kneel upright with both knees on the floor, sideways to the cable machine, holding the handle at your chest with both hands.',
    movement: 'Press the handle straight out in front of you until your arms are extended, then bring it back to your chest.',
    keyCue: 'Keep your hips and shoulders square — without your feet to help stabilize, resisting the cable’s pull to rotate you is entirely on your core.',
    feelIt: 'You should feel this in your core working to stay still, not your arms doing the work.',
    regression: 'If staying square in the tall-kneeling position is hard, try a standing Pallof press instead.',
  },
  // Superman Push-Up — push, plyometric
  ex_1342: {
    startingPosition: 'Start in a push-up position with your hands and feet spread wider than usual.',
    movement: 'Lower into the push-up, then explosively push up hard enough that your hands and feet both leave the floor briefly, extending into a superman-like shape, then land and reset.',
    keyCue: 'Land with soft, bent joints to absorb the impact — this is a high-power, high-impact movement, so never rush into it without a solid regular push-up base.',
    feelIt: 'You should feel this as an explosive full-body effort, not a jolt in your wrists or shoulders on landing.',
    regression: 'If this is too much, try a regular plyo push-up (hands only leaving the floor) first before adding the feet.',
  },
  // Kettlebell Long Cycle (Double Clean and Jerk) — full body, highest technical
  ex_1357: {
    startingPosition: 'Stand with feet shoulder-width apart, a kettlebell on the floor at each foot.',
    movement: 'Clean both bells to the rack position at your shoulders, then dip and drive them overhead in a jerk, catching them locked out, then lower back to the rack for the next rep.',
    keyCue: 'Reset your breath and re-brace between the clean and the jerk — this combines two demanding lifts back to back, so don’t rush from one into the other.',
    feelIt: 'You should feel this as two distinct explosive efforts joined together, not one continuous blur.',
    regression: 'If this is too much, practice the double clean and the double jerk as separate movements first.',
  },
  // 1.5 Rep Dip — push, time under tension
  ex_1367: {
    startingPosition: 'Support yourself on parallel bars with your arms straight.',
    movement: 'Lower to the bottom of a dip, rise halfway up, lower back to the bottom again, then press all the way up to straight arms — that’s one rep.',
    keyCue: 'Keep your shoulders stable through the whole sequence — the extra time under tension at the bottom is where shoulder strain can creep in if you rush the halfway pulse.',
    feelIt: 'You should feel constant tension in your chest and triceps throughout, more than a regular dip.',
    regression: 'If the extra pulse breaks your form or depth control, do regular dips instead until your strength builds.',
  },
  // Speed Bench Press (Dynamic Effort) — push, power
  ex_1378: {
    startingPosition: 'Lie on the bench with your eyes under the bar, feet flat on the floor, grip slightly wider than shoulder-width, using a lighter weight than your normal working sets.',
    movement: 'Lower the bar under control to your chest, then press it back up as explosively as possible while keeping your form clean.',
    keyCue: 'Keep your elbows and bar path consistent even as you move fast — speed work is about explosive intent with light weight, not sloppy form.',
    feelIt: 'You should feel this as a fast, powerful effort across your chest and triceps, not a strain from moving too heavy a weight too fast.',
    regression: 'If moving explosively breaks your form, slow down and treat it as a regular-tempo bench press until your control catches up.',
  },
  // Speed Squat (Dynamic Effort) — squat, power
  ex_1379: {
    startingPosition: 'Stand with feet shoulder-width apart, bar resting across the top of your shoulders, using a lighter weight than your normal working sets.',
    movement: 'Squat down under control to full depth, then drive up as explosively as possible while keeping your form clean.',
    keyCue: 'Keep your chest up and knees tracking properly even as you move fast — the goal is bar speed with clean technique, not a sloppy rush.',
    feelIt: 'You should feel this as a fast, powerful drive through your legs, not a strain from moving too heavy a weight too fast.',
    regression: 'If moving explosively breaks your form, slow down and treat it as a regular-tempo squat until your control catches up.',
  },
  // Speed Deadlift (Dynamic Effort) — hinge, power
  ex_1380: {
    startingPosition: 'Stand with feet hip-width apart, bar over your midfoot, using a lighter weight than your normal working sets, and bend down to grip it just outside your knees.',
    movement: 'Stand up as explosively as possible while keeping your back flat and the bar close to your shins.',
    keyCue: 'Keep your back flat even as you move fast — speed work is about explosive intent with light weight and clean technique, not rushing through bad form.',
    feelIt: 'You should feel this as a fast, powerful drive through your hips and legs, not a strain from moving too heavy a weight too fast.',
    regression: 'If moving explosively breaks your form, slow down and treat it as a regular-tempo deadlift until your control catches up.',
  },
  // Vertical Jump Test (Standing Reach) — jump, max effort test
  ex_1390: {
    startingPosition: 'Stand next to a wall or jump-measuring device, reach up and mark your standing reach height.',
    movement: 'Dip down and jump straight up as high as you can, touching or marking the highest point you reach, then land softly.',
    keyCue: 'Land soft with bent knees to absorb the impact — this is a maximal effort test, so warm up properly before attempting your best jump.',
    feelIt: 'You should feel this as one maximal, explosive effort, not a jolt in your knees on landing.',
    regression: 'If jumping at full effort feels risky without a proper warm-up, build up with a few submaximal jumps first before testing your best.',
  },
  // Bench Press 1RM Test (One-Rep Max) — push, max effort test
  ex_1401: {
    startingPosition: 'Lie on the bench with your eyes under the bar, feet flat on the floor, grip slightly wider than shoulder-width, with a spotter present.',
    movement: 'After a proper warm-up building up in weight, lower the bar to your chest and press it up for a single maximal-effort rep at your test weight.',
    keyCue: 'Always have a spotter for a true 1-rep max attempt — if the bar stalls, you need someone there to help rerack it safely.',
    feelIt: 'You should feel this as pure maximal effort across your chest, shoulders, and triceps, not a strain from skipping the warm-up buildup.',
    regression: 'If you don’t have a spotter available, test a heavy-but-submaximal set of 3-5 reps instead and estimate your max from that.',
  },
  // Back Squat 1RM Test (One-Rep Max) — squat, max effort test
  ex_1402: {
    startingPosition: 'Stand with feet shoulder-width apart, bar resting across your upper back, safety pins or a spotter set at an appropriate height.',
    movement: 'After a proper warm-up building up in weight, squat down to full depth and drive back up for a single maximal-effort rep at your test weight.',
    keyCue: 'Always have safety pins set or a spotter present for a true 1-rep max attempt — a failed heavy squat needs a way out that doesn’t involve dumping the bar unsafely.',
    feelIt: 'You should feel this as pure maximal effort through your legs and glutes, not a strain from skipping the warm-up buildup.',
    regression: 'If safety pins or a spotter aren’t available, test a heavy-but-submaximal set of 3-5 reps instead and estimate your max from that.',
  },
  // Deadlift 1RM Test (One-Rep Max) — hinge, max effort test
  ex_1403: {
    startingPosition: 'Stand with feet hip-width apart, bar over your midfoot, and bend down to grip it just outside your knees.',
    movement: 'After a proper warm-up building up in weight, stand up with a single maximal-effort rep at your test weight, keeping your back flat throughout.',
    keyCue: 'Your back stays flat even at maximal effort — a heavy attempt with a rounded back is exactly how deadlift injuries happen, so a failed rep with good form beats a completed rep with a rounded back.',
    feelIt: 'You should feel this as pure maximal effort through your hamstrings, glutes, and back, not a strain from skipping the warm-up buildup.',
    regression: 'If you’re unsure about your form under maximal load, test a heavy-but-submaximal set of 3-5 reps instead and estimate your max from that.',
  },
  // ATG Split Squat (Heel-Elevated, Deep Knee Travel) — squat
  ex_1407: {
    startingPosition: 'Stand with your front foot on a small wedge or plate, back foot behind you, feet in a split stance.',
    movement: 'Lower straight down, allowing your front knee to travel forward past your toes as far as comfortable, until your back knee nearly touches the floor, then push through your front foot to stand back up.',
    keyCue: 'Go only as deep and as far forward with your knee as feels genuinely comfortable — this exercise deliberately allows more forward knee travel than usual, so build into it gradually rather than forcing full depth immediately.',
    feelIt: 'You should feel this in your front thigh and a deep stretch in your ankle, not a sharp pain in your knee.',
    regression: 'If this is too much, try a regular split squat without the heel elevation or the deep knee travel first.',
  },
  // B-Stance Deadlift (Barbell) — hinge, semi-unilateral
  ex_1409: {
    startingPosition: 'Stand with feet hip-width apart, one foot slightly staggered behind the other with just the toes touching down, bar over your midfoot.',
    movement: 'Bend down and grip the bar just outside your knees, then stand up by pushing the floor away mostly through your front leg.',
    keyCue: 'Keep most of your weight on your front leg — the back foot is there for light balance support, not to share the load.',
    feelIt: 'You should feel this mostly in the hamstring and glute of your front leg, not your lower back.',
    regression: 'If balance is hard, stagger your stance less, or go back to a regular two-foot deadlift.',
  },
  // Iron Cross (Gymnastics Rings) — push, most advanced ring skill
  ex_1415: {
    startingPosition: 'Support yourself on rings held out to your sides at shoulder height, arms straight.',
    movement: 'Hold this cross position, keeping your arms locked straight out to the sides and your body upright, for the set time.',
    keyCue: 'This is one of the most demanding static holds in gymnastics — it places enormous strain on your shoulders and elbows, and should only be attempted after years of progressive ring strength work, never as an early goal.',
    feelIt: 'You should feel this intensely through your shoulders and chest, not a sharp pain in your elbows.',
    regression: 'If this is far out of reach, work ring support holds and ring dips with a wider turn-out first — the cross is a long-term progression, not a near-term target.',
  },
  // Weighted Push-Up (Plate-Loaded) — push
  ex_1418: {
    startingPosition: 'Start in a push-up position with a weight plate placed on your upper back, body in a straight line.',
    movement: 'Lower your chest toward the floor by bending your elbows, then press back up until your arms are straight.',
    keyCue: 'Have someone place the plate on your back once you’re already in position, and keep your core extra tight — the added weight increases the demand on your lower back staying flat.',
    feelIt: 'You should feel this across your chest, shoulders, and triceps, not a strain in your lower back.',
    regression: 'If the added weight breaks your form, remove it and do regular bodyweight push-ups first.',
  },
  // Weighted Handstand Push-Up — push/overhead, high skill and risk
  ex_1439: {
    startingPosition: 'Kick up into a handstand against a wall with a weighted vest on, hands shoulder-width apart.',
    movement: 'Lower your head slowly toward the floor by bending your elbows, then press back up to straight arms.',
    keyCue: 'Only add weight once your bodyweight handstand push-ups are clean and controlled through a full range — extra load on a shaky handstand push-up is a real fall and neck-injury risk.',
    feelIt: 'You should feel this in your shoulders and triceps, not a strain in your neck or lower back.',
    regression: 'If the added weight breaks your control, remove it and build more bodyweight handstand push-up volume first.',
  },
  // Weighted Pistol Squat (Dumbbell) — squat, high skill
  ex_1441: {
    startingPosition: 'Stand on one leg holding a dumbbell at your chest, other leg extended out in front of you.',
    movement: 'Bend your standing knee to lower down as far as you can control, then push back up to standing.',
    keyCue: 'Only add weight once your bodyweight pistol squat is clean and controlled — extra load on a wobbly single-leg squat is a real balance and knee risk.',
    feelIt: 'You should feel this in your standing thigh and glute, not a strain in your knee.',
    regression: 'If the added weight breaks your balance, remove it and build more bodyweight pistol squat control first.',
  },
  // Hook Grip Deadlift — hinge, grip technique
  ex_1499: {
    startingPosition: 'Stand with feet hip-width apart, bar over your midfoot, and grip it by wrapping your fingers around your thumb rather than over it.',
    movement: 'Stand up by pushing the floor away with your legs and driving your hips forward, keeping the bar close to your shins the whole way up.',
    keyCue: 'The hook grip will feel uncomfortable on your thumbs at first — that’s normal and it fades with practice, but expect it to feel odd for the first several sessions.',
    feelIt: 'You should feel a secure, slip-free grip that doesn’t fatigue as fast as a regular overhand grip, alongside the usual hamstring and glute effort.',
    regression: 'If the discomfort is too much to focus through, use a regular double-overhand grip with lifting straps instead.',
  },
  // Cartwheel — full body, coordination skill
  ex_1502: {
    startingPosition: 'Stand tall with your arms raised overhead, facing the direction you’ll cartwheel sideways.',
    movement: 'Reach down and place one hand, then the other, on the floor while kicking your legs up and over in a sideways rotation, landing on your feet one at a time.',
    keyCue: 'Practice on a soft, open surface with plenty of space — this is a full-body coordination skill, and a bad landing can turn an ankle if the space is cramped.',
    feelIt: 'You should feel this as a fun, coordinated full-body rotation, not a strain in your wrists on the landing hands.',
    regression: 'If this is too much, practice the individual pieces first — a handstand kick-over against a wall, or just the hand-to-floor reach without the full rotation.',
  },
  // Downhill Sprint (Overspeed Training) — conditioning, power
  ex_1408: {
    startingPosition: 'Stand at the top of a very gentle downhill slope, feet shoulder-width apart.',
    movement: 'Sprint down the slope at a pace faster than you could manage on flat ground, focusing on quick turnover.',
    keyCue: 'Use only a slight decline — too steep a slope changes your mechanics dangerously and increases fall risk, so this is about a gentle assist, not a steep hill.',
    feelIt: 'You should feel this as an unusually fast leg turnover, not a loss of control or a jarring stride.',
    regression: 'If a controlled fast turnover feels hard to maintain, use a gentler slope or practice sprint mechanics on flat ground first.',
  },
  // Bird Dog Row (Dumbbell) — full body, core stability
  ex_1410: {
    startingPosition: 'Start on your hands and knees with a dumbbell in one hand, that arm’s hand on the floor.',
    movement: 'Extend the opposite leg straight back while rowing the dumbbell up toward your hip, then lower both and repeat.',
    keyCue: 'Keep your hips level and facing the floor — don’t let them rotate open as you row and extend.',
    feelIt: 'You should feel this in your back and glutes together, not your lower back.',
    regression: 'If this is too much, try a regular bird dog first without the added row, or remove the weight.',
  },
  // Isometric Deadlift (Pins) — hinge, maximal hold
  ex_1425: {
    startingPosition: 'Stand inside a rack with a bar set on pins at a fixed height, gripping it as if starting a deadlift.',
    movement: 'Pull up against the fixed bar as hard as you can without it actually moving, holding maximum effort for the set time.',
    keyCue: 'Keep your back flat and brace hard the entire hold — ease into full intensity over the first second rather than yanking instantly.',
    feelIt: 'You should feel this as intense, whole-body tension through your legs, back, and grip, not a strain isolated in one spot.',
    regression: 'If pulling against a fixed bar isn’t available, a regular deadlift with a brief pause near lockout gives a similar effort.',
  },
  // Isometric Overhead Press (Pins) — overhead, maximal hold
  ex_1426: {
    startingPosition: 'Stand in a rack with a bar set on pins just above shoulder height, gripping it as if starting an overhead press.',
    movement: 'Push up against the fixed bar as hard as you can without it moving, holding maximum effort for the set time.',
    keyCue: 'Keep your core braced and ribs down through the hold — don’t let your lower back arch to add more force.',
    feelIt: 'You should feel this as intense tension through your shoulders and triceps, not a strain in your lower back.',
    regression: 'If pins aren’t available, a regular overhead press with a pause just below lockout gives a similar effort.',
  },
  // Isometric Row (Mid-Pull Hold) — pull, sustained hold
  ex_1427: {
    startingPosition: 'Set up at a cable row station and pull the handle to the midpoint of your row.',
    movement: 'Hold that midpoint position, keeping your shoulder blades squeezed together, for the set time.',
    keyCue: 'Keep your torso still and upright throughout — don’t lean back to help maintain the hold.',
    feelIt: 'You should feel this as a sustained squeeze in your upper back, not your lower back.',
    regression: 'If holding the mid-pull position is too much, reduce the weight until you can hold it with good posture.',
  },
  // Isometric Face Pull (Cable, Peak Hold) — pull, sustained hold
  ex_1433: {
    startingPosition: 'Set up at a cable station with the rope at face height, pulling it to your face with your elbows high.',
    movement: 'Hold that peak position, squeezing your shoulder blades together, for the set time.',
    keyCue: 'Keep your elbows high and wide the whole hold — don’t let them drop as your shoulders fatigue.',
    feelIt: 'You should feel this as a sustained squeeze in your rear shoulders and upper back, not your neck.',
    regression: 'If holding the peak position is too much, reduce the weight until you can hold it with good posture.',
  },
  // Kettlebell Plank Drag — core, anti-rotation
  ex_1434: {
    startingPosition: 'Start in a high plank position with a kettlebell placed to one side, just outside your hand.',
    movement: 'Reach under your body with the opposite hand and drag the kettlebell across to the other side, then switch and drag it back.',
    keyCue: 'Keep your hips square and still — don’t let them rotate as you reach and drag.',
    feelIt: 'You should feel this in your core resisting the rotation, not your shoulder doing the dragging.',
    regression: 'If this is too much, widen your feet for stability, or drop to your knees.',
  },
  // Weighted Nordic Hamstring Curl — hinge, eccentric
  ex_1440: {
    startingPosition: 'Kneel on a padded surface with your ankles anchored, holding a light weight against your chest, torso upright.',
    movement: 'Slowly lower your torso toward the floor by letting your knees bend, keeping your hips straight, then catch yourself with your hands.',
    keyCue: 'Only add weight once your bodyweight Nordic curl is fully controlled — extra load on an uncontrolled lower is a real hamstring-strain risk.',
    feelIt: 'You should feel this in the back of your thighs, not your lower back.',
    regression: 'If the added weight breaks your control, remove it and build more bodyweight Nordic curl strength first.',
  },
  // Weighted Hanging Leg Raise — core, hanging
  ex_1442: {
    startingPosition: 'Hang from a pull-up bar with a light dumbbell held between your feet, arms straight.',
    movement: 'Keeping your legs straight, raise them up until they’re at least parallel to the floor, then lower with control.',
    keyCue: 'Move with control, not momentum — the added weight makes swinging a bigger strain risk than usual.',
    feelIt: 'You should feel this in your lower abs, not your hip flexors straining or your grip giving out first.',
    regression: 'If the added weight breaks your control, remove it and build more bodyweight hanging leg raise strength first.',
  },
  // Weighted Shrimp Squat (Dumbbell) — squat, high skill
  ex_1443: {
    startingPosition: 'Stand on one leg holding a dumbbell at your chest, other foot held up behind you with the same-side hand.',
    movement: 'Bend your standing knee to lower down, letting your back knee travel toward the floor behind you, then push back up to standing.',
    keyCue: 'Only add weight once your bodyweight shrimp squat is clean and balanced — extra load on a wobbly single-leg squat is a real balance risk.',
    feelIt: 'You should feel this in your standing thigh and glute, not a strain in your knee.',
    regression: 'If the added weight breaks your balance, remove it and build more bodyweight shrimp squat control first.',
  },
  // Pilates Criss-Cross — core, rotation
  ex_1444: {
    startingPosition: 'Lie on your back with hands behind your head, knees bent to tabletop, shoulders curled slightly off the floor.',
    movement: 'Rotate your torso to bring one elbow toward the opposite knee while extending the other leg out, then switch sides.',
    keyCue: 'Rotate from your torso, not by yanking your neck with your hands — your hands just lightly support your head.',
    feelIt: 'You should feel this in your obliques, not your neck straining.',
    regression: 'If this is too much, keep both knees bent at tabletop instead of extending one leg out.',
  },
  // Pilates Leg Pull Front — full body, plank
  ex_1448: {
    startingPosition: 'Start in a high plank position, arms straight.',
    movement: 'Lift one leg straight up behind you a few inches, keeping your hips square, then lower and repeat with the other leg.',
    keyCue: 'Keep your hips level and square the whole time — don’t let them rotate as you lift each leg.',
    feelIt: 'You should feel this in your glutes and core working to stay stable, not your lower back.',
    regression: 'If this is too much, hold a regular plank first without lifting either leg.',
  },
  // Pilates Leg Pull Back — full body, reverse plank
  ex_1449: {
    startingPosition: 'Sit with hands behind your hips, legs extended, and lift into a reverse plank position.',
    movement: 'Lift one leg straight up a few inches, keeping your hips lifted and level, then lower and repeat with the other leg.',
    keyCue: 'Keep your hips lifted and level the entire time — don’t let them dip as you lift each leg.',
    feelIt: 'You should feel this in your glutes, hamstrings, and core, not your wrists.',
    regression: 'If this is too much, hold a regular reverse plank first without lifting either leg.',
  },
  // Football Bar Bench Press — push, neutral grip
  ex_1461: {
    startingPosition: 'Lie on the bench gripping the football bar’s neutral handles, palms facing each other.',
    movement: 'Lower the bar to your chest, then press it back up until your arms are straight.',
    keyCue: 'This neutral grip is often easier on the shoulders than a straight bar — still keep your elbows at a moderate angle, not flared straight out.',
    feelIt: 'You should feel this across your chest and triceps, without the shoulder discomfort a straight bar sometimes causes.',
    regression: 'If this bar isn’t available, a dumbbell bench press gives a similar neutral-ish grip option.',
  },
  // Depth Push-Up (Box Drop) — push, plyometric
  ex_1463: {
    startingPosition: 'Support yourself on two low blocks or platforms in a push-up position, hands wider than shoulder-width.',
    movement: 'Remove one hand’s support so you drop slightly, absorbing the landing by bending your elbow, then press back up.',
    keyCue: 'Only drop a small distance and land with a bent, absorbing elbow — this is a real shoulder-strain risk if the drop is too far or you land stiff.',
    feelIt: 'You should feel this as an explosive absorb-and-press effort through your chest and shoulders, not a jolt in your elbow.',
    regression: 'If this is too much, try a regular plyo push-up on flat ground first before adding any drop height.',
  },
  // Single-Leg Depth Jump — jump, power
  ex_1465: {
    startingPosition: 'Stand on one leg on top of a low box, near the edge.',
    movement: 'Step off the box, land softly on the same leg, and immediately jump straight up as high as you can the instant you touch down.',
    keyCue: 'Use a low box and land with a bent, absorbing knee — single-leg landings carry more force per leg, so this deserves real caution and a gradual buildup.',
    feelIt: 'You should feel this as an explosive reflex in your leg, not a jolt in your knee on landing.',
    regression: 'If this is too much, master a two-leg depth jump first, or practice just the single-leg soft landing without the jump.',
  },
  // BOSU Glute Bridge (Feet on Dome) — hinge, balance
  ex_1478: {
    startingPosition: 'Lie on your back with your feet resting on top of the BOSU ball, dome side up, knees bent.',
    movement: 'Drive your hips up by squeezing your glutes, balancing your feet on the unstable dome, then lower back down with control.',
    keyCue: 'Move slower than a regular glute bridge — the unstable surface demands small balance corrections throughout the lift.',
    feelIt: 'You should feel this in your glutes, plus extra stabilizing work through your feet and core, not your lower back.',
    regression: 'If balance is too hard, do a regular glute bridge with your feet on stable ground first.',
  },
  // One-Arm Chin-Up (Assisted, Band) — pull, high skill
  ex_1486: {
    startingPosition: 'Loop a resistance band around the pull-up bar and hold one end in your working hand, hang with palm facing toward you.',
    movement: 'Pull yourself up using mostly one arm, letting the band assist, until your chin clears the bar, then lower back down with control.',
    keyCue: 'Keep your body from twisting — pull as straight up as you can rather than rotating your torso to fake the range.',
    feelIt: 'You should feel this heavily in the back and bicep of the working arm, not a strain in your shoulder.',
    regression: 'If this is too much even with a band, build up through archer chin-ups and weighted single-arm rows first.',
  },
  // Weighted Ring Dip — push, unstable
  ex_1488: {
    startingPosition: 'Attach a weight belt or hold a dumbbell between your feet, then support yourself on gymnastic rings with arms straight.',
    movement: 'Lower your body by bending your elbows until your shoulders are about level with your elbows, then press back up to straight arms.',
    keyCue: 'Only add weight once your bodyweight ring dips are clean and stable — extra load on wobbly rings is a real shoulder-strain risk.',
    feelIt: 'You should feel this in your chest and triceps, not a pinch in the front of your shoulder.',
    regression: 'If the added weight breaks your control, remove it and build more bodyweight ring dip volume first.',
  },
  // Clapping Pull-Up — pull, power
  ex_1490: {
    startingPosition: 'Hang from the bar with arms fully straight.',
    movement: 'Pull yourself up explosively hard enough that your hands can leave the bar briefly for a clap, then catch the bar again and lower with control.',
    keyCue: 'Only attempt this once your regular pull-ups are strong and explosive — releasing the bar mid-rep and catching it again is a real fall risk if your base strength isn’t there yet.',
    feelIt: 'You should feel this as an explosive, powerful pull, not a strain from forcing a release you can’t control.',
    regression: 'If this is too much, build explosive pulling power with fast (but bar-staying) pull-ups first.',
  },
  // Pause Front Squat (Barbell) — squat, tempo
  ex_1506: {
    startingPosition: 'Rest the bar across the front of your shoulders, elbows lifted high, feet shoulder-width apart.',
    movement: 'Squat down until your thighs are at least parallel to the floor, pause and hold that position for a full 2-3 seconds, then drive through your heels to stand.',
    keyCue: 'Keep your elbows up through the pause — if they drop while you’re holding, the bar rolls forward and you lose the rack position.',
    feelIt: 'You should feel constant tension in your quads through the pause, not a relaxing rest at the bottom.',
    regression: 'If holding the pause breaks your elbow position, shorten it to 1 second, or reduce the weight.',
  },
  // Deficit Sumo Deadlift — hinge, extended range
  ex_1510: {
    startingPosition: 'Stand on a small platform, feet wider than shoulder-width, toes turned out, bar over your midfoot.',
    movement: 'Stand up by pushing the floor away and driving your hips forward, keeping the bar close to your body the whole way up.',
    keyCue: 'Your back stays flat from start to finish — the extra range from standing elevated makes it easier to round, so be extra deliberate about this.',
    feelIt: 'You should feel this in your glutes and inner thighs, not a strain in your lower back.',
    regression: 'If keeping your back flat through the extra range is hard, drop the platform or do a regular sumo deadlift from the floor instead.',
  },
  // Half-Kneeling Single-Arm Dumbbell Overhead Press — overhead, core stability
  ex_1512: {
    startingPosition: 'Kneel on one knee with the other foot planted in front, holding a dumbbell at one shoulder.',
    movement: 'Press the dumbbell straight up until your arm is extended, then lower it back to your shoulder with control.',
    keyCue: 'Keep your torso upright and core braced — the half-kneeling position removes your ability to lean back and use momentum.',
    feelIt: 'You should feel this in your shoulder and core, not a strain in your lower back.',
    regression: 'If balance in the half-kneeling position is hard, try a standing single-arm dumbbell press instead.',
  },
  // Feet-Elevated Ring Row — pull, unstable
  ex_1515: {
    startingPosition: 'Hold gymnastic rings and lean back with arms extended, feet elevated on a bench, body in a straight line.',
    movement: 'Pull your chest up toward the rings by driving your elbows back, then lower with control.',
    keyCue: 'Keep your body rigid in a straight line — the elevated feet make this significantly harder than a regular ring row, so don’t let your hips sag.',
    feelIt: 'You should feel this in your back and biceps, not your lower back.',
    regression: 'If this is too much, go back to a regular ring row with your feet on the floor.',
  },
  // Archer Ring Row — pull, high skill
  ex_1516: {
    startingPosition: 'Hold gymnastic rings with a wide grip and lean back, feet planted, body in a straight line.',
    movement: 'Pull your chest up toward one ring while keeping the other arm mostly straight out to the side, then lower and repeat toward the other side.',
    keyCue: 'Keep your body from twisting — pull straight up toward the working side rather than rotating your torso to fake the range.',
    feelIt: 'You should feel this heavily in the back and bicep of the pulling-side arm, not a strain in your shoulder.',
    regression: 'If this is too much, try a regular two-arm ring row first and build strength there before adding the single-side emphasis.',
  },
  // Tall Snatch (No Dip) — overhead, technical drill
  ex_1544: {
    startingPosition: 'Stand tall holding the bar at your hips, feet hip-width apart, gripping very wide, no knee bend.',
    movement: 'From a standing position, pull the bar up explosively and punch your arm underneath to catch it locked out overhead.',
    keyCue: 'Keep the bar close to your body the whole way — this drill is about the catch, so focus on dropping fast and stable underneath it.',
    feelIt: 'You should feel this as a fast catch, not a heavy pull — the point is speed getting under the bar, not lifting it high.',
    regression: 'If the catch feels unfamiliar, practice just the overhead catch position holding an empty bar first.',
  },
  // Drop Snatch — overhead, technical drill
  ex_1545: {
    startingPosition: 'Stand tall holding the bar overhead with a wide grip, arms locked out.',
    movement: 'Quickly drop your body down into a deep squat while punching the bar overhead and keeping your arms locked, catching yourself in a stable position.',
    keyCue: 'The bar stays essentially still while your body drops fast underneath it — the speed and stability of the drop is the entire point of this drill.',
    feelIt: 'You should feel this as a fast, controlled drop into a stable overhead squat, not a slow lower.',
    regression: 'If this is too much, practice holding a static overhead squat position first, without the fast drop.',
  },
  // Tempo Bent-Over Row (Barbell) — pull, tempo
  ex_1549: {
    startingPosition: 'Stand with feet hip-width apart, hinge forward from your hips, and hold the bar with both hands, arms hanging straight down.',
    movement: 'Pull the bar up toward your lower stomach at a normal pace, then lower it back down slowly over a controlled count (like 3-4 seconds).',
    keyCue: 'Keep your back flat and torso still through the entire slow lowering — the extra time under tension is where rounding tends to creep in if you’re not deliberate.',
    feelIt: 'You should feel constant tension in your upper back through the slow lowering, more than a regular-tempo row.',
    regression: 'If the slow tempo breaks your form, reduce the weight until you can control the full count.',
  },
  // Tempo Overhead Press (Barbell) — overhead, tempo
  ex_1550: {
    startingPosition: 'Stand with feet hip-width apart, bar resting at your collarbones, hands just outside shoulder-width.',
    movement: 'Press the bar up at a normal pace until your arms are extended, then lower it back down slowly over a controlled count (like 3-4 seconds).',
    keyCue: 'Keep your ribs pulled down through the entire slow lowering — don’t let your lower back arch as you fight the tempo.',
    feelIt: 'You should feel constant tension in your shoulders through the slow lowering, more than a regular-tempo press.',
    regression: 'If the slow tempo breaks your form, reduce the weight until you can control the full count.',
  },
  // Deficit Pull-Up (Parallettes) — pull, extended range
  ex_1551: {
    startingPosition: 'Set parallettes or blocks under a pull-up bar, hang from the bar with your feet elevated off the floor, arms straight, going lower than a normal dead hang would allow.',
    movement: 'Pull yourself up until your chin clears the bar, then lower back down through the extended range with control.',
    keyCue: 'Keep your shoulders engaged even at the very bottom of the extended hang — a fully passive, disengaged shoulder at that extra depth is a real strain risk.',
    feelIt: 'You should feel a deeper stretch in your lats at the bottom than a regular pull-up, not a strain in your shoulder joint.',
    regression: 'If this extra range is too much, go back to a regular pull-up from a normal dead hang.',
  },
  // Eccentric Bench Press (Slow Negative) — push, tempo
  ex_1555: {
    startingPosition: 'Lie on the bench with your eyes under the bar, feet flat on the floor, grip slightly wider than shoulder-width.',
    movement: 'Lower the bar to your chest as slowly as you can control, taking several seconds, then press it back up at a normal pace (or with a spotter’s help if the weight is heavy).',
    keyCue: 'Have a spotter present if you’re using extra weight for this — controlling a slow lower doesn’t mean you can necessarily press it back up on your own.',
    feelIt: 'You should feel constant, building tension across your chest through the slow lower, not a fast drop.',
    regression: 'If the slow lower is too much to control, reduce the weight until you can manage the full count.',
  },
  // Pause Overhead Press (Barbell) — overhead, tempo
  ex_1561: {
    startingPosition: 'Stand with feet hip-width apart, bar resting at your collarbones, hands just outside shoulder-width.',
    movement: 'Press the bar to about halfway up, pause and hold that position for a full 1-2 seconds, then continue pressing to full lockout overhead.',
    keyCue: 'Stay tight through the pause — don’t let your lower back arch or your core loosen while you hold that mid-range position.',
    feelIt: 'You should feel constant tension in your shoulders through the pause, not a relaxing rest partway up.',
    regression: 'If holding the pause breaks your form, shorten it, or reduce the weight until you can hold it solidly.',
  },
  // Crane Stance (One-Legged Balance) — lower body, balance
  ex_1596: {
    startingPosition: 'Stand on one leg, other foot resting lightly against your standing calf or ankle, hands at your chest.',
    movement: 'Hold this balanced position, keeping your standing leg steady and your gaze fixed on a point ahead, for the set time.',
    keyCue: 'Fix your eyes on a still point ahead of you — looking around or down is what usually breaks a balance hold like this.',
    feelIt: 'You should feel small, constant corrections through your standing ankle and foot, not a locked, rigid stillness.',
    regression: 'If this is too much, hold onto something light for support, or rest your foot lower against your shin instead of higher up.',
  },
  // Rowing Machine (Erg) — pull, full body, technical
  ex_202: {
    startingPosition: 'Sit on the rower with feet strapped in, knees bent, gripping the handle with arms extended.',
    movement: 'Push through your legs first, then lean back slightly and pull the handle to your ribs, then reverse the sequence to return to the start.',
    keyCue: 'Drive with your legs first, then your back, then your arms — pulling with your arms before your legs finish is the most common mistake and wastes power.',
    feelIt: 'You should feel this in your legs first, then your back and arms, not your arms starting the pull.',
    regression: 'If the sequencing feels confusing, slow down and practice each phase separately before linking them at speed.',
  },
  // Wall Handstand Hold — overhead, balance
  ex_216: {
    startingPosition: 'Kick up into a handstand against a wall, hands shoulder-width apart, facing the wall or with your back to it.',
    movement: 'Hold this position, keeping your body straight and core braced, for the set time.',
    keyCue: 'Keep your core braced and hips stacked over your shoulders — over-arching your lower back to stay up puts real strain on your spine.',
    feelIt: 'You should feel this in your shoulders and core from holding steady, not a strain in your lower back or wrists.',
    regression: 'If holding a full handstand is too much, practice a pike position with your feet still on an elevated surface first.',
  },
  // TRX Triceps Extension — push, isolation
  ex_219: {
    startingPosition: 'Hold the TRX handles facing away from the anchor point, body leaning forward, elbows bent and pointed forward.',
    movement: 'Extend your arms straight by pressing your forearms forward, then bend your elbows to return to the start.',
    keyCue: 'Keep your upper arms still and close to your head — only your forearms should move.',
    feelIt: 'You should feel this in your triceps, not your shoulders.',
    regression: 'If this is too much, stand more upright, leaning less — a shallower angle makes it easier.',
  },
  // TRX Bicep Curl — pull, isolation
  ex_220: {
    startingPosition: 'Hold the TRX handles facing the anchor point, body leaning back, arms extended.',
    movement: 'Curl your body up by bending your elbows, then extend back down with control.',
    keyCue: 'Keep your elbows in place and your body rigid — the curl should come from your elbows bending, not your body swinging.',
    feelIt: 'You should feel this in your biceps, not your lower back.',
    regression: 'If this is too much, stand more upright, leaning less — a shallower angle makes it easier.',
  },
  // TRX Pike — core, unstable
  ex_221: {
    startingPosition: 'Start in a push-up position with your feet in the TRX straps, body in a straight line.',
    movement: 'Pull your hips up toward the ceiling by drawing your knees toward your chest, keeping your legs straight, then lower back to the plank.',
    keyCue: 'Keep your arms straight and your core braced — the movement comes from your hips folding, not your arms bending.',
    feelIt: 'You should feel this intensely in your abs, not your shoulders.',
    regression: 'If this is too much, try a TRX knee tuck instead — bend your knees rather than keeping legs straight, much easier.',
  },
  // TRX Hamstring Curl — hinge, unstable
  ex_222: {
    startingPosition: 'Lie on your back with your heels in the TRX straps, legs extended, hips lifted slightly off the floor.',
    movement: 'Pull your heels toward your hips by bending your knees, lifting your hips higher as you curl, then extend back out.',
    keyCue: 'Keep your hips lifted throughout — don’t let them drop toward the floor as your legs extend back out.',
    feelIt: 'You should feel this in your hamstrings and glutes, not your lower back.',
    regression: 'If this is too much, keep your hips on the floor instead of lifted, reducing the range and demand.',
  },
  // TRX Y-Raise (Rear Delt) — pull, isolation
  ex_224: {
    startingPosition: 'Hold the TRX handles facing the anchor point, body leaning back, arms extended down in front of you.',
    movement: 'Raise your arms up and out into a Y-shape above your head, then lower back down with control.',
    keyCue: 'Keep your arms straight and lead with your thumbs turning up — this targets your rear shoulders more than a bent-elbow row would.',
    feelIt: 'You should feel this in your rear shoulders and upper back, not your lower back.',
    regression: 'If this is too much, stand more upright, leaning less — a shallower angle makes it easier.',
  },
  // Band Standing Overhead Press — overhead
  ex_229: {
    startingPosition: 'Stand on the band with feet shoulder-width apart, holding the handles at your shoulders.',
    movement: 'Press the handles straight up until your arms are extended, then lower back to your shoulders with control.',
    keyCue: 'Keep your ribs pulled down and don’t arch your lower back to get the band up.',
    feelIt: 'You should feel this in your shoulders and triceps, not your lower back.',
    regression: 'If this is too much, use a lighter band or try a seated dumbbell press instead.',
  },
  // Band Woodchop — core, rotation
  ex_230: {
    startingPosition: 'Anchor the band high and stand sideways to it, gripping the handle with both hands.',
    movement: 'Pull the handle down and across your body toward your opposite hip, rotating through your torso, then return with control.',
    keyCue: 'Rotate from your core and hips — don’t just yank with your arms.',
    feelIt: 'You should feel this in your obliques and core, not your lower back.',
    regression: 'If this is too much, try it without the band first, just practicing the rotation pattern.',
  },
  // Medicine Ball Overhead Carry — carry, overhead stability
  ex_243: {
    startingPosition: 'Press a medicine ball overhead until your arms are locked out.',
    movement: 'Walk forward at a steady pace, keeping the ball locked overhead, for the set distance or time.',
    keyCue: 'Keep your ribs down and core braced — don’t let your lower back arch to keep the ball up.',
    feelIt: 'You should feel this in your shoulders and core from staying stacked, not a strain in your lower back.',
    regression: 'If this is too much, hold the ball at your chest instead, or use a lighter ball.',
  },
  // Medicine Ball Woodchop — core, rotation
  ex_245: {
    startingPosition: 'Stand sideways with a medicine ball, holding it at one hip.',
    movement: 'Rotate through your torso to swing the ball up and across your body to the opposite shoulder, then return with control.',
    keyCue: 'Rotate from your core and hips — don’t just swing with your arms.',
    feelIt: 'You should feel this in your obliques and core, not your lower back.',
    regression: 'If this is too much, use a lighter ball or practice the rotation pattern without one first.',
  },
  // Swiss Bar Bench Press — push, neutral grip
  ex_281: {
    startingPosition: 'Lie on the bench gripping the Swiss bar’s neutral handles, palms facing each other.',
    movement: 'Lower the bar to your chest, then press it back up until your arms are straight.',
    keyCue: 'This neutral grip is often easier on the shoulders than a straight bar — still keep your elbows at a moderate angle, not flared straight out.',
    feelIt: 'You should feel this across your chest and triceps, without the shoulder discomfort a straight bar sometimes causes.',
    regression: 'If this bar isn’t available, a dumbbell bench press gives a similar neutral-ish grip option.',
  },
  // Football Bar Overhead Press — overhead, neutral grip
  ex_282: {
    startingPosition: 'Stand holding the football bar’s neutral handles at your shoulders, feet hip-width apart.',
    movement: 'Press the bar straight up overhead until your arms are extended, then lower it back to your shoulders with control.',
    keyCue: 'Keep your ribs pulled down and don’t arch your lower back to get the bar up.',
    feelIt: 'You should feel this in your shoulders and triceps, without the wrist strain a straight bar sometimes causes.',
    regression: 'If this bar isn’t available, a dumbbell overhead press gives a similar neutral-grip option.',
  },
  // Zottman Curl (Dumbbell) — pull, isolation
  ex_324: {
    startingPosition: 'Stand holding a dumbbell in each hand at your sides, palms facing forward.',
    movement: 'Curl the dumbbells up with palms facing you, then rotate your wrists to face down at the top, and lower them back down in that reversed grip.',
    keyCue: 'Keep the rotation deliberate at the top — this hits your forearms differently on the way down than a regular curl would.',
    feelIt: 'You should feel this in your biceps on the way up and your forearms on the way down, not your wrists straining.',
    regression: 'If the wrist rotation feels awkward, try a regular dumbbell curl instead.',
  },
  // Dumbbell Cuban Press — overhead, shoulder health
  ex_327: {
    startingPosition: 'Stand holding a dumbbell in each hand at your sides, arms slightly out from your body.',
    movement: 'Raise your elbows to shoulder height with your forearms hanging down, rotate your forearms up so the dumbbells point overhead, then press to full lockout.',
    keyCue: 'Move through each phase deliberately — this is a slow, controlled shoulder-health exercise, not one to rush through.',
    feelIt: 'You should feel this working your shoulders through a full range, not a pinch at any point.',
    regression: 'If the sequence feels awkward, use very light dumbbells or practice with no weight first to learn the movement.',
  },
  // Spoto Press — push, technique
  ex_332: {
    startingPosition: 'Lie on the bench with your eyes under the bar, feet flat on the floor, grip slightly wider than shoulder-width.',
    movement: 'Lower the bar until it’s just an inch or two above your chest, pause there without touching, then press it back up.',
    keyCue: 'Stay tight through the pause and don’t let the bar drift or your shoulder blades lose their set position while you hold just above your chest.',
    feelIt: 'You should feel constant tension across your chest through the pause, not a relaxing rest.',
    regression: 'If holding the pause just above your chest breaks your form, reduce the weight until you can hold it solidly.',
  },
  // JM Press — push, hybrid triceps
  ex_333: {
    startingPosition: 'Lie on the bench with a close grip, elbows tucked, bar starting above your chest.',
    movement: 'Lower the bar toward your neck/upper chest by bending your elbows in a hybrid between a skull crusher and a close-grip press, then press it back up.',
    keyCue: 'Keep your elbows tucked and control the bar path carefully — this brings the bar closer to your neck than a regular press, so precision matters more here.',
    feelIt: 'You should feel this heavily in your triceps, not a strain near your neck.',
    regression: 'If this hybrid path feels risky, try a close-grip bench press instead — similar triceps emphasis, more familiar bar path.',
  },
  // Pin Press — push, dead-stop strength
  ex_334: {
    startingPosition: 'Lie on the bench with pins set in the rack at a fixed height, bar resting on the pins at your chest.',
    movement: 'Press the bar up from a dead stop on the pins until your arms are straight.',
    keyCue: 'Brace hard before you start each rep — there’s no stretch-reflex bounce to help here, so your setup does all the work of getting the bar moving.',
    feelIt: 'You should feel this in your chest and triceps as pure starting strength, not a strain in your shoulders.',
    regression: 'If starting from a dead stop is too much, reduce the weight until you can press up cleanly.',
  },
  // Barbell Hack Squat (Behind-the-Back) — squat
  ex_342: {
    startingPosition: 'Stand with the bar behind you, gripping it with both hands behind your legs, feet shoulder-width apart.',
    movement: 'Squat down by bending your knees, keeping the bar close behind your calves, then drive through your heels to stand back up.',
    keyCue: 'Keep the bar close to your legs the whole time — letting it drift away pulls you off balance.',
    feelIt: 'You should feel this in your quads, not a strain in your lower back or wrists.',
    regression: 'If holding the bar behind you feels awkward, try a regular goblet squat instead.',
  },
  // Shuttle Runs (Suicides) — conditioning, agility
  ex_361: {
    startingPosition: 'Stand at a starting line with markers set at increasing distances ahead of you.',
    movement: 'Sprint to the first marker and back, then the second and back, continuing to the furthest marker, touching each line before turning around.',
    keyCue: 'Decelerate under control before each turn — cutting hard at full speed repeatedly is a real ankle and knee strain risk if your footwork gets sloppy as you fatigue.',
    feelIt: 'You should feel this as a demanding sprint-and-change-direction effort in your legs and lungs, not a jolt in your joints on the turns.',
    regression: 'If this is too much, shorten the distances or reduce the number of markers.',
  },
  // Jump Rope Double-Unders — conditioning, coordination
  ex_362: {
    startingPosition: 'Stand tall holding the rope handles, rope behind your heels.',
    movement: 'Jump higher than a regular single jump and spin the rope twice under your feet before landing, timing your wrist speed to match the extra height.',
    keyCue: 'Jump a bit higher and spin faster with your wrists, not your whole arms — the timing takes practice, so expect some missed reps while you build it.',
    feelIt: 'You should feel this in your calves and forearms from the faster spin, not a jolt in your shins from mistimed landings.',
    regression: 'If this is too much, practice single-unders first and build your jump height and wrist speed gradually.',
  },
  // Stair Sprints — conditioning, power
  ex_363: {
    startingPosition: 'Stand at the base of a staircase, feet shoulder-width apart.',
    movement: 'Sprint up the stairs at maximum effort, taking one or two steps at a time, then walk back down to recover.',
    keyCue: 'Walk, don’t jog, back down to recover, and watch your footing carefully — stairs are an unforgiving surface for a misstep at speed.',
    feelIt: 'You should feel this as an intense effort in your legs and lungs, not a jolt in your ankles from missed steps.',
    regression: 'If this is too much, use a shorter staircase or take single steps instead of two at a time.',
  },
  // Hang Snatch — full body, technical
  ex_365: {
    startingPosition: 'Stand holding the bar at your thighs, feet hip-width apart, gripping very wide.',
    movement: 'Explosively extend your hips to pull the bar up, then drop under it to catch it locked out overhead.',
    keyCue: 'Keep the bar close to your body the whole way up — if it swings away from your legs, the overhead catch won’t work.',
    feelIt: 'You should feel this as an explosive hip snap into a stable catch, not an arm pull.',
    regression: 'If the catch feels unfamiliar, practice the hip-extension pull without catching the bar first.',
  },
  // Clean Pull — pull, power
  ex_369: {
    startingPosition: 'Stand with the bar over your midfoot, feet hip-width apart, gripping just outside your knees.',
    movement: 'Pull the bar up explosively by extending your hips, shrugging hard at the top, without catching it in a rack position.',
    keyCue: 'Keep the bar close to your body the entire pull — this drill builds the pulling power for the clean without adding the catch.',
    feelIt: 'You should feel this as an explosive pull from your hips and legs, not an arm curl.',
    regression: 'If the full extension feels unfamiliar, practice a regular deadlift first to build the base pulling strength.',
  },
  // Snatch Pull — pull, power
  ex_370: {
    startingPosition: 'Stand with the bar over your midfoot, feet hip-width apart, gripping very wide.',
    movement: 'Pull the bar up explosively by extending your hips, shrugging hard at the top, without catching it overhead.',
    keyCue: 'Keep the bar close to your body the entire pull — this drill builds the pulling power for the snatch without adding the overhead catch.',
    feelIt: 'You should feel this as an explosive pull from your hips and legs, not an arm curl.',
    regression: 'If the full extension feels unfamiliar, practice a regular deadlift first to build the base pulling strength.',
  },
  // Single-Leg Box Jump — jump, power
  ex_375: {
    startingPosition: 'Stand on one leg facing a low box, a comfortable distance away.',
    movement: 'Swing your arms and drive off your single leg, jumping up and landing softly on top of the box with the same leg, knee slightly bent.',
    keyCue: 'Use a low box and land soft — single-leg landings carry more force per leg than a two-leg jump, so build up the height gradually.',
    feelIt: 'You should feel this as an explosive effort in your standing leg, not a jolt in your knee on landing.',
    regression: 'If this is too much, try a two-leg box jump first, or step up onto the box with one leg instead of jumping.',
  },
  // Bounding (Repeated Broad Jumps) — jump, power
  ex_376: {
    startingPosition: 'Stand with feet shoulder-width apart.',
    movement: 'Jump forward as far as you can, landing softly with bent knees, then immediately jump forward again without pausing, chaining several jumps in a row.',
    keyCue: 'Land soft and absorb each jump before immediately driving into the next — this is a repeated-impact movement, so your landing mechanics matter every single rep.',
    feelIt: 'You should feel this as an explosive, repeated effort in your legs, not a jolt in your knees or ankles on any single landing.',
    regression: 'If this is too much, do single broad jumps with a full reset and pause between each one instead of chaining them.',
  },
  // Depth Drop (Landing Mechanics Only) — jump, landing technique
  ex_377: {
    startingPosition: 'Stand on top of a low box, feet shoulder-width apart, near the edge.',
    movement: 'Step off the box and land softly with both feet, absorbing the landing with bent knees, without jumping back up.',
    keyCue: 'Land soft and quiet with bent knees to absorb the impact fully — this drill is purely about the landing mechanics, so there’s no rush to do anything after it.',
    feelIt: 'You should feel this as a controlled absorption through your legs, not a jolt in your knees.',
    regression: 'If this is too much, use a lower box until your landing feels soft and controlled every time.',
  },
  // Log Press — overhead, strongman
  ex_381: {
    startingPosition: 'Clean the log to your chest, gripping the neutral handles.',
    movement: 'Dip slightly by bending your knees, then drive up through your legs and press the log overhead until your arms are extended.',
    keyCue: 'Keep the log’s path close and vertical — use your legs to start the drive, not just your arms.',
    feelIt: 'You should feel your legs doing the initial work, with your shoulders finishing the lockout.',
    regression: 'If the log feels unfamiliar, try a barbell push press instead — same movement pattern, more common implement.',
  },
  // Axle Bar Deadlift — hinge, grip
  ex_382: {
    startingPosition: 'Stand with feet hip-width apart, gripping the thick axle bar just outside your knees.',
    movement: 'Stand up by pushing the floor away with your legs and driving your hips forward, keeping the bar close to your shins the whole way up.',
    keyCue: 'Grip the thick bar firmly with your whole hand — this demands significantly more grip strength than a regular bar, so expect to move less weight.',
    feelIt: 'You should feel extra grip and forearm demand on top of the usual hamstring and glute effort, not a strain in your lower back.',
    regression: 'If the thick grip is too limiting, use a regular bar grip instead.',
  },
  // Sledgehammer Slam (Tire Strike) — full body, power
  ex_384: {
    startingPosition: 'Stand facing a large tire, feet shoulder-width apart, holding a sledgehammer with both hands.',
    movement: 'Raise the hammer overhead and swing it down forcefully to strike the tire, letting it bounce back up naturally, then repeat.',
    keyCue: 'Keep your core braced and let your hips rotate into the swing — this is a full-body movement, not just an arm swing, and controlling the follow-through protects your lower back.',
    feelIt: 'You should feel this as an explosive full-body effort through your core and shoulders, not a jolt in your lower back.',
    regression: 'If this is too much, use a lighter hammer or shorten the swing range.',
  },
  // Keg Carry (Bear-Hug) — carry, strongman
  ex_385: {
    startingPosition: 'Bear-hug the keg against your chest, gripping around its sides.',
    movement: 'Walk forward at a steady pace, keeping the keg held tight against your chest, for the set distance or time.',
    keyCue: 'Keep your core braced and the keg held tight the entire walk — a loose hold lets the liquid inside shift and throws off your balance.',
    feelIt: 'You should feel this in your core, grip, and upper back from holding it tight, not a strain in your lower back.',
    regression: 'If this is too much, try a sandbag bear-hug carry instead — similar hold, more predictable weight.',
  },
  // Kettlebell Figure-8 — core, coordination
  ex_420: {
    startingPosition: 'Stand with feet wider than shoulder-width, knees slightly bent, kettlebell in one hand.',
    movement: 'Pass the kettlebell between and around your legs in a figure-8 pattern, switching hands behind each leg.',
    keyCue: 'Keep a slight hinge at your hips and let the movement flow smoothly — don’t rush the hand switches behind your legs.',
    feelIt: 'You should feel this in your core and grip from the smooth figure-8 control, not a strain in your lower back.',
    regression: 'If this is too much, practice passing the bell from hand to hand in front of your body first, without the figure-8 pattern.',
  },
  // Zercher Carry (Front-Loaded) — carry
  ex_451: {
    startingPosition: 'Cradle a bar or sandbag in the crooks of your elbows, arms crossed in front of your chest.',
    movement: 'Walk forward at a steady pace, keeping the load held tight at your elbows, for the set distance or time.',
    keyCue: 'Keep your torso upright and core braced — if you lean forward, the load pulls uncomfortably on your elbows.',
    feelIt: 'You should feel this in your core and upper back from staying upright, not a sharp pain in your elbows.',
    regression: 'If holding the load at your elbows is uncomfortable, try a front-rack carry instead — held at your shoulders.',
  },
  // Sled Lateral Drag (Side Shuffle) — carry, lateral
  ex_452: {
    startingPosition: 'Attach a harness or handle to the sled and stand sideways to it, knees slightly bent.',
    movement: 'Shuffle sideways, dragging the sled with you, keeping your hips low and steps controlled.',
    keyCue: 'Stay low and keep your steps small and controlled — crossing your feet or standing too tall reduces control over the sled’s momentum.',
    feelIt: 'You should feel this in your glutes and outer hips from staying low, not a strain in your lower back.',
    regression: 'If this is too much, use a lighter sled load or shorten the distance.',
  },
  // Sled Sprint (Resisted) — conditioning, power
  ex_453: {
    startingPosition: 'Attach a harness to the sled, lean forward slightly, feet set to drive.',
    movement: 'Sprint forward against the sled’s resistance, driving hard through your legs with quick, powerful steps.',
    keyCue: 'Keep your steps short and powerful rather than overstriding — the resistance changes your normal sprint mechanics, so drive down and back.',
    feelIt: 'You should feel this as an intense effort in your legs and lungs, not a strain in your hamstrings from overstriding.',
    regression: 'If this is too much, use a lighter sled load or a shorter sprint distance.',
  },
  // Prone Y-Raise — pull, shoulder health
  ex_459: {
    startingPosition: 'Lie face-down on an incline bench or the floor, arms extended overhead in a Y-shape, thumbs pointed up.',
    movement: 'Raise your arms up off the surface a few inches, squeezing your shoulder blades, then lower with control.',
    keyCue: 'Keep your neck relaxed and in line with your spine — don’t crane it up to help lift your arms.',
    feelIt: 'You should feel this in your rear shoulders and upper back, not your neck.',
    regression: 'If this is too much, do the movement with no weight, just your arms, and build the range gradually.',
  },
  // Prone T-Raise — pull, shoulder health
  ex_460: {
    startingPosition: 'Lie face-down on an incline bench or the floor, arms extended straight out to your sides in a T-shape.',
    movement: 'Raise your arms up off the surface a few inches, squeezing your shoulder blades together, then lower with control.',
    keyCue: 'Keep your neck relaxed and in line with your spine — don’t crane it up to help lift your arms.',
    feelIt: 'You should feel this in your rear shoulders and upper back, not your neck.',
    regression: 'If this is too much, do the movement with no weight, just your arms, and build the range gradually.',
  },
  // 90/90 External Rotation (Arm Elevated) — pull, rotator cuff
  ex_461: {
    startingPosition: 'Lie on your side or stand with your upper arm raised to shoulder height, elbow bent 90 degrees, forearm pointing down.',
    movement: 'Rotate your forearm up until it points toward the ceiling, keeping your elbow at 90 degrees and in place, then lower with control.',
    keyCue: 'Keep your elbow fixed in place the whole time — only your forearm should rotate, not your whole arm swinging.',
    feelIt: 'You should feel this in the back of your shoulder (rotator cuff), not your neck or upper trap.',
    regression: 'If this is too much, use a very light weight or no weight, focusing purely on the rotation pattern.',
  },
  // Side Plank with Hip Dip — core
  ex_467: {
    startingPosition: 'Hold a side plank position, propped up on your forearm, body in a straight line.',
    movement: 'Lower your hip toward the floor a few inches, then lift it back up to the straight-line position, repeating.',
    keyCue: 'Control the dip — don’t let your hip drop all the way to the floor or drop too fast.',
    feelIt: 'You should feel this in your obliques from the up-and-down control, not your shoulder.',
    regression: 'If this is too much, hold a regular static side plank first without adding the dip.',
  },
  // Plank with Shoulder Taps — core, anti-rotation
  ex_468: {
    startingPosition: 'Start in a high plank position, hands under your shoulders.',
    movement: 'Tap one hand to the opposite shoulder, then return it to the floor and repeat with the other hand, alternating.',
    keyCue: 'Keep your hips as still as possible — resisting the urge to rock side to side is the whole point of the exercise.',
    feelIt: 'You should feel this in your core working to stay still, not your shoulders doing all the work.',
    regression: 'If this is too much, widen your feet for more stability, or drop to your knees.',
  },
  // Half-Kneeling Pallof Hold — core, anti-rotation
  ex_473: {
    startingPosition: 'Kneel on one knee with the other foot planted in front, sideways to the cable machine, holding the handle at your chest.',
    movement: 'Press the handle straight out in front of you and hold that extended position for the set time.',
    keyCue: 'Keep your hips and shoulders square the whole hold — the cable is trying to rotate you, and your job is to resist that.',
    feelIt: 'You should feel this in your core working to stay still, not your arms doing the work.',
    regression: 'If staying square in the half-kneeling position is hard, try a standing Pallof hold instead.',
  },
  // Weighted Dead Bug (Dumbbell) — core
  ex_476: {
    startingPosition: 'Lie on your back holding a light dumbbell straight up over your chest, knees bent to tabletop.',
    movement: 'Slowly extend one leg out straight while keeping the dumbbell steady overhead, then return and repeat with the other leg.',
    keyCue: 'Keep your lower back pressed into the floor the entire time — if it arches up, your leg has extended too far or too fast.',
    feelIt: 'You should feel this deep in your abs, not your lower back or hip flexors.',
    regression: 'If the dumbbell feels awkward to hold steady, remove it and do a regular bodyweight dead bug instead.',
  },
  // Stir-the-Pot (Stability Ball Plank) — core, unstable
  ex_478: {
    startingPosition: 'Start in a forearm plank with your forearms resting on a stability ball.',
    movement: 'Keeping your body rigid, make small circular motions with your forearms on the ball, stirring in one direction, then reverse.',
    keyCue: 'Keep your hips level and still — the circular motion should come from your core resisting the ball’s wobble, not your hips swaying.',
    feelIt: 'You should feel this intensely in your abs from resisting the instability, not your lower back.',
    regression: 'If this is too much, try a regular stability ball plank first without adding the circular motion.',
  },
  // Single-Leg Box Squat — squat, assisted
  ex_483: {
    startingPosition: 'Stand on one leg in front of a box or bench, other leg extended out in front of you.',
    movement: 'Bend your standing knee to lower down and sit lightly onto the box, then push back up to standing.',
    keyCue: 'Sit down under control rather than dropping onto the box — this is a controlled squat with a safety net, not a fall.',
    feelIt: 'You should feel this in your standing thigh and glute, not a strain in your knee.',
    regression: 'If this is too much, use a higher box, or hold onto something for balance support.',
  },
  // Single-Arm Cable Chest Press (Standing) — push, core stability
  ex_487: {
    startingPosition: 'Stand facing away from the cable machine in a staggered stance, holding one handle at chest height.',
    movement: 'Press the handle forward until your arm is extended, then return with control.',
    keyCue: 'Keep your core braced and torso still — don’t rotate or lean into the press to help move the weight.',
    feelIt: 'You should feel this across your chest, plus extra core work resisting the rotation, not a strain in your lower back.',
    regression: 'If staying stable is hard, use a lighter weight or a wider staggered stance.',
  },
  // Single-Arm Cable Lat Pulldown (Half-Kneeling) — pull, core stability
  ex_488: {
    startingPosition: 'Kneel on one knee with the other foot planted in front, facing the cable machine, gripping a single handle overhead with one hand.',
    movement: 'Pull the handle down toward your shoulder by driving your elbow down and back, then let it return with control.',
    keyCue: 'Keep your torso upright and still — the half-kneeling position removes your hips from helping, so the work stays in your back.',
    feelIt: 'You should feel this in your back and lat, not your shoulder.',
    regression: 'If balance in the half-kneeling position is hard, use both hands on a regular lat pulldown instead.',
  },
  // Single-Arm Dumbbell Incline Press — push, core stability
  ex_493: {
    startingPosition: 'Lie back on an incline bench holding one dumbbell at shoulder level, other hand resting on your leg or braced on the bench.',
    movement: 'Press the dumbbell up and slightly back until your arm is extended, then lower with control.',
    keyCue: 'Keep your hips and shoulders square to the ceiling — don’t let the unweighted side twist up.',
    feelIt: 'You should feel this in your upper chest and core from resisting the rotation, not just your pressing arm.',
    regression: 'If staying square is hard, use a lighter weight until you can control the rotation.',
  },
  // Single-Leg Wall Sit — squat, unilateral hold
  ex_494: {
    startingPosition: 'Sit against a wall with your knees at about 90 degrees, as in a regular wall sit.',
    movement: 'Lift one foot off the floor and hold that single-leg position, keeping your other knee bent, for the set time.',
    keyCue: 'Keep your hips level — don’t let one side sag lower as your standing leg fatigues.',
    feelIt: 'You should feel this intensely in the standing thigh, not a strain in your knee.',
    regression: 'If this is too much, go back to a regular two-leg wall sit first.',
  },
  // Single-Arm Kettlebell Push Press — overhead, power
  ex_495: {
    startingPosition: 'Hold a kettlebell racked at one shoulder, feet shoulder-width apart.',
    movement: 'Dip slightly by bending your knees, then drive up through your legs and press the kettlebell overhead until your arm is straight.',
    keyCue: 'Keep the bell path close and vertical — use your legs to start the drive, not just your arm.',
    feelIt: 'You should feel your legs doing the initial work, with your shoulder finishing the lockout.',
    regression: 'If the leg-drive timing feels off, practice a strict single-arm kettlebell press first.',
  },
  // Sandbag Shouldering — full body, power
  ex_505: {
    startingPosition: 'Squat down and grip the sandbag with both hands, close to your body.',
    movement: 'Pull the bag up explosively and rotate it onto one shoulder in a single motion, then lower it back down and repeat, alternating shoulders.',
    keyCue: 'Keep the bag close to your body on the pull, and let your hips drive the power — don’t try to muscle it up with just your arms.',
    feelIt: 'You should feel this as an explosive full-body effort, not a strain isolated in your arms.',
    regression: 'If this is too much, practice lifting the bag to your chest first (a sandbag clean) before adding the shoulder rotation.',
  },
  // Sandbag Bear Hug Squat — squat
  ex_506: {
    startingPosition: 'Bear-hug the sandbag against your chest, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Keep the bag held tight against your chest — a loose hold lets it shift and pulls you off balance mid-squat.',
    feelIt: 'You should feel this in your quads and glutes, plus your core and grip holding the bag tight, not a strain in your lower back.',
    regression: 'If holding the bag is too much, try a goblet squat with a dumbbell instead.',
  },
  // Jefferson Curl — core/hinge, spinal flexibility
  ex_513: {
    startingPosition: 'Stand on a raised platform holding a light weight, feet hip-width apart.',
    movement: 'Slowly round your spine forward one vertebra at a time, letting the weight pull you down toward your feet, then reverse the roll back up to standing.',
    keyCue: 'Use very light weight and move slowly — this is a controlled spinal-flexibility exercise, not a heavy strength movement, and rushing it or overloading it is a real back-injury risk.',
    feelIt: 'You should feel a deep, even stretch down your entire spine and hamstrings, never a sharp or pinching pain.',
    regression: 'If this is too much, practice the same rounding motion with no weight at all first.',
  },
  // Board Press (Barbell) — push, partial range
  ex_521: {
    startingPosition: 'Lie on the bench with boards stacked on your chest, gripping the bar at your normal bench press width.',
    movement: 'Lower the bar until it touches the boards, pause briefly, then press it back up until your arms are straight.',
    keyCue: 'Keep your elbows at a consistent angle and pause fully on the boards each rep — this trains the top portion of your press, so don’t bounce off the boards.',
    feelIt: 'You should feel this in your chest and triceps at the top-range portion of the lift, not a jolt from bouncing off the boards.',
    regression: 'If boards aren’t available, a partial-range bench press with a spotter calling the depth gives a similar effect.',
  },
  // Barbell Snatch-Grip High Pull — pull, power
  ex_525: {
    startingPosition: 'Stand with the bar over your midfoot, feet hip-width apart, gripping very wide.',
    movement: 'Pull the bar up explosively by extending your hips, then continue pulling it high toward your chin by driving your elbows up and out.',
    keyCue: 'Keep the bar close to your body the entire pull — this builds pulling power for the snatch without the overhead catch.',
    feelIt: 'You should feel this as an explosive pull from your hips and legs, not an arm curl.',
    regression: 'If the wide grip feels unstable, use a slightly narrower grip until your mobility improves.',
  },
  // Standing Cable Woodchop (High-to-Low) — core, rotation
  ex_530: {
    startingPosition: 'Stand sideways to the cable machine with the handle set high, feet shoulder-width apart.',
    movement: 'Pull the handle down and across your body toward your opposite hip, rotating through your torso, then return with control.',
    keyCue: 'Rotate from your core and hips — don’t just yank with your arms.',
    feelIt: 'You should feel this in your obliques and core, not your lower back.',
    regression: 'If this is too much, try it without any weight first, just practicing the rotation pattern.',
  },
  // Smith Machine Bench Press — push, fixed path
  ex_533: {
    startingPosition: 'Lie on a bench positioned under the smith machine bar, feet flat on the floor, grip slightly wider than shoulder-width.',
    movement: 'Lower the bar to your chest, then press it back up until your arms are straight.',
    keyCue: 'Position the bench so the bar’s fixed vertical path lines up with your natural chest position, since the machine only moves straight up and down.',
    feelIt: 'You should feel this across your chest and triceps, not a strain in your shoulders from a mismatched path.',
    regression: 'If finding the right position is tricky, try a free-weight dumbbell bench press instead — no fixed path to work around.',
  },
  // Smith Machine Bulgarian Split Squat — squat, fixed path
  ex_535: {
    startingPosition: 'Position the bar across your upper back on the smith machine, rest one foot behind you on a bench.',
    movement: 'Lower your back knee straight down toward the floor by bending your front leg, then push through your front foot to stand back up.',
    keyCue: 'Set your front foot forward of the bar’s fixed path, since the machine only moves straight up and down.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If finding the right position is tricky, try a free-weight dumbbell Bulgarian split squat instead.',
  },
  // Smith Machine Romanian Deadlift — hinge, fixed path
  ex_537: {
    startingPosition: 'Stand under the smith machine bar, gripping it at your thighs, feet hip-width apart.',
    movement: 'Push your hips straight back while lowering the bar down your legs, keeping it close to your body, then drive your hips forward to stand back up.',
    keyCue: 'The fixed vertical path means you can’t shift the bar around your knees like free weight — stand close enough to the bar that it can travel straight down without hitting you.',
    feelIt: 'You should feel a deep stretch in your hamstrings, not your lower back.',
    regression: 'If the fixed path feels awkward, try a free-weight dumbbell Romanian deadlift instead.',
  },
  // Smith Machine Hip Thrust — hinge, fixed path
  ex_540: {
    startingPosition: 'Sit on the ground with your upper back against a bench positioned under the smith machine bar, bar resting across your hips.',
    movement: 'Drive your hips straight up until your body forms a straight line from shoulders to knees, then lower back down with control.',
    keyCue: 'The fixed path keeps the bar traveling straight up and down, which some people find more comfortable on their hips than a free bar — position the bench so that path lines up cleanly.',
    feelIt: 'You should feel this in your glutes, not your lower back.',
    regression: 'If positioning feels awkward, try a free-weight barbell hip thrust instead.',
  },
  // D-Ball Over-Shoulder Throw — full body, power
  ex_547: {
    startingPosition: 'Stand holding a D-ball (soft medicine ball) at your hips, feet shoulder-width apart, facing away from your throwing direction.',
    movement: 'Squat down and swing the ball back between your legs, then explosively extend your hips and throw the ball up and back over one shoulder.',
    keyCue: 'Generate the power from your hips extending, not just your arms swinging — and make sure the space behind you is clear before throwing.',
    feelIt: 'You should feel this as an explosive hip-driven effort through your posterior chain, not a strain in your shoulder.',
    regression: 'If this is too much, practice a kettlebell swing first to build the hip-hinge power pattern.',
  },
  // Crab Walk — full body, coordination
  ex_551: {
    startingPosition: 'Sit on the floor, hands behind you, feet flat, and lift your hips into a reverse tabletop position.',
    movement: 'Walk your hands and feet in a coordinated pattern to move forward or sideways, keeping your hips lifted the whole time.',
    keyCue: 'Keep your hips lifted throughout the walk — don’t let them sag toward the floor between steps.',
    feelIt: 'You should feel this in your glutes, triceps, and core, not your wrists.',
    regression: 'If this is too much, hold a static reverse tabletop position first without adding the walking.',
  },
  // Tug-of-War Rope Pull (Partner/Anchor Resisted) — full body, pull
  ex_552: {
    startingPosition: 'Grip a thick rope anchored or held by a partner, feet staggered, leaning back slightly.',
    movement: 'Pull the rope toward you hand over hand, driving through your legs and back, walking backward as you pull.',
    keyCue: 'Keep your back flat and drive with your legs, not just your arms — this is a full-body pulling effort.',
    feelIt: 'You should feel this in your back, grip, and legs together, not a strain isolated in your arms.',
    regression: 'If this is too much, use a lighter resistance or a shorter pulling distance.',
  },
  // Barbell Step-Up — lunge/squat, unilateral
  ex_572: {
    startingPosition: 'Stand facing a sturdy box, bar racked across your upper back, feet shoulder-width apart.',
    movement: 'Step one foot fully onto the box and drive through it to stand up on top, then step back down with control.',
    keyCue: 'Push through your whole foot on the box, not just your toes — and don’t let your back leg push off the floor to help.',
    feelIt: 'You should feel this in the thigh and glute of the leg stepping up, not a strain in your knee.',
    regression: 'If balance with the bar is hard, try a bodyweight step-up or hold light dumbbells at your sides instead.',
  },
  // Barbell Windmill — hinge/overhead, mobility
  ex_575: {
    startingPosition: 'Stand holding the bar locked out overhead with one arm, feet wider than shoulder-width, turned slightly away from that arm.',
    movement: 'Keeping your arm locked straight overhead and your eyes on the bar, hinge and rotate at your hips to lower your other hand down toward the floor, then reverse back up.',
    keyCue: 'Keep the overhead arm locked and stacked the entire time — this is a hip and hamstring stretch under overhead stability, not a shoulder movement.',
    feelIt: 'You should feel a stretch in your hamstring and side body, not a strain in your overhead shoulder.',
    regression: 'If this is too much, practice the hip hinge and rotation without any weight overhead first, or use a kettlebell windmill instead — smaller, easier-to-control implement.',
  },
  // Barbell Seated Good Morning — hinge, seated
  ex_576: {
    startingPosition: 'Sit on a bench with the bar racked across your upper back, feet flat on the floor.',
    movement: 'Hinge forward at your hips, keeping your back flat, lowering your torso as far as you can control, then sit back up to the starting position.',
    keyCue: 'Your back stays flat the entire time — without your legs able to help drive you back up like the standing version, staying tight through your core matters even more.',
    feelIt: 'You should feel a stretch in your hamstrings and lower back muscles working, not a strain from rounding.',
    regression: 'If this is too much, try a standing barbell good morning instead — your legs can assist more.',
  },
  // Dumbbell Single-Arm Push Press — overhead, power
  ex_587: {
    startingPosition: 'Stand holding one dumbbell at your shoulder, feet shoulder-width apart.',
    movement: 'Dip slightly by bending your knees, then drive up through your legs and press the dumbbell overhead until your arm is straight.',
    keyCue: 'Keep the dumbbell’s path close and vertical — use your legs to start the drive, not just your arm.',
    feelIt: 'You should feel your legs doing the initial work, with your shoulder finishing the lockout.',
    regression: 'If the leg-drive timing feels off, practice a strict single-arm dumbbell press first.',
  },
  // Standing Plate-Loaded Shoulder Press Machine — overhead
  ex_603: {
    startingPosition: 'Sit or stand at the machine, gripping the handles at shoulder height.',
    movement: 'Press the handles straight up until your arms are extended, then lower back to your shoulders with control.',
    keyCue: 'Keep your core braced — don’t arch your lower back to help finish the press.',
    feelIt: 'You should feel this in your shoulders and triceps, not your lower back.',
    regression: 'If this is too much, reduce the weight or try a seated dumbbell press instead.',
  },
  // Kettlebell Around-the-Body Pass — core, coordination
  ex_612: {
    startingPosition: 'Stand with feet shoulder-width apart, kettlebell in one hand.',
    movement: 'Pass the kettlebell around your waist from one hand to the other, circling your body continuously.',
    keyCue: 'Keep your core braced and your torso upright as you pass the bell around — don’t let your lower back arch to compensate.',
    feelIt: 'You should feel this in your core and grip from the controlled passing motion, not a strain in your lower back.',
    regression: 'If this is too much, use a lighter kettlebell or slow the pace down.',
  },
  // Kettlebell Bottoms-Up Press (Single-Arm) — overhead, grip/stability
  ex_613: {
    startingPosition: 'Hold a kettlebell upside down (bottoms-up) at your shoulder, gripping the handle tightly.',
    movement: 'Press the kettlebell straight up until your arm is extended, keeping it balanced upside down, then lower back to your shoulder with control.',
    keyCue: 'Grip the handle as tightly as you can the entire time — a loose grip is what lets the bell tip over.',
    feelIt: 'You should feel intense forearm and grip demand alongside your shoulder working, not a strain in your wrist.',
    regression: 'If the bell keeps tipping, use a much lighter kettlebell until your grip and wrist stability improve.',
  },
  // Resisted Bear Crawl (Band-Anchored) — full body
  ex_623: {
    startingPosition: 'Attach a band around your hips, anchored behind you, and start on your hands and feet in a bear crawl position.',
    movement: 'Crawl forward against the band’s resistance, moving one hand and the opposite foot at a time, keeping your hips low.',
    keyCue: 'Keep your hips low and level — the added resistance makes it tempting to pop your hips up for leverage, which defeats the point.',
    feelIt: 'You should feel this in your shoulders, core, and legs from staying low against the resistance, not a strain in your lower back.',
    regression: 'If this is too much, remove the band and do a regular bear crawl first.',
  },
  // Landmine 180 (Rotational Core) — core, rotation
  ex_634: {
    startingPosition: 'Stand holding the end of a landmine-anchored bar with both hands at your hip, arms extended.',
    movement: 'Rotate your torso and hips to swing the bar in a wide arc from one hip all the way to the other side, pivoting your feet as needed.',
    keyCue: 'Rotate from your hips and core together, letting your feet pivot naturally — don’t force the rotation through your lower back alone.',
    feelIt: 'You should feel this in your obliques and core, not a strain in your lower back.',
    regression: 'If this is too much, try it without any weight first, just practicing the rotation pattern.',
  },
  // Ski Erg (Nordic Ski Machine) — pull, full body
  ex_639: {
    startingPosition: 'Stand facing the machine, gripping the handles overhead, feet shoulder-width apart.',
    movement: 'Pull the handles down and back by hinging at your hips and driving your arms down, then let them return overhead with control.',
    keyCue: 'Drive the pull from your hips and core, not just your arms — a slight hinge and hip snap generates most of the power.',
    feelIt: 'You should feel this in your core, back, and triceps together, not just your arms pulling.',
    regression: 'If the hip drive feels unfamiliar, practice a slower pace first to get the timing before pushing for speed.',
  },
  // Rope Climb (Gym Class Style) — pull, grip
  ex_640: {
    startingPosition: 'Stand or sit below a hanging rope, gripping it with both hands above your head.',
    movement: 'Pull yourself up hand over hand, using your legs to help grip and push if possible, then climb back down with control.',
    keyCue: 'Control your descent — sliding down too fast is a real rope-burn and fall risk, so lower yourself deliberately.',
    feelIt: 'You should feel this in your back, biceps, and grip, not a burn on your hands from sliding.',
    regression: 'If this is too much, practice hanging holds and pull-ups first to build the base pulling strength.',
  },
  // TRX Fallout (Rollout) — core, unstable
  ex_645: {
    startingPosition: 'Hold the TRX handles and kneel or stand facing the anchor point, arms extended in front of you.',
    movement: 'Lean your body forward, extending your arms further out while keeping your core braced, then pull yourself back to the starting position.',
    keyCue: 'Keep your core braced hard the whole time — don’t let your lower back sag as you extend forward.',
    feelIt: 'You should feel this intensely in your abs, not your lower back.',
    regression: 'If this is too much, only extend out a small amount, or do a regular TRX plank first.',
  },
  // TRX Reverse Lunge — lunge, assisted
  ex_647: {
    startingPosition: 'Hold the TRX handles lightly for balance, feet hip-width apart.',
    movement: 'Step one leg back into a reverse lunge, lowering until both knees are bent to about 90 degrees, then push through your front foot to return to standing.',
    keyCue: 'Use the straps for light balance support, not to pull yourself up — let your leg do the actual work of standing back up.',
    feelIt: 'You should feel this in your front thigh and glute, not your arms pulling on the straps.',
    regression: 'If balance is still hard even with the straps, try a regular bodyweight reverse lunge holding onto something sturdy instead.',
  },
  // TRX Side Plank — core, unstable
  ex_648: {
    startingPosition: 'Place one foot in the TRX strap and hold a side plank position, propped up on your forearm.',
    movement: 'Hold this position, keeping your body in a straight line and your hips lifted, for the set time.',
    keyCue: 'Keep your suspended foot from swinging — the instability of the strap demands constant small corrections.',
    feelIt: 'You should feel this in your obliques, plus extra stabilizing work from the suspended leg, not your shoulder.',
    regression: 'If this is too much, try a regular side plank on the floor first without the suspended leg.',
  },
  // TRX Bulgarian Split Squat (Rear-Foot-Elevated) — squat, unstable
  ex_649: {
    startingPosition: 'Place one foot behind you in the TRX strap, other foot planted in front, standing tall.',
    movement: 'Lower your back knee straight down toward the floor by bending your front leg, then push through your front foot to stand back up.',
    keyCue: 'Keep your front knee tracking over your ankle — the suspended back foot demands extra balance, so move slower than a bench-supported version.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If balance with the suspended foot is hard, use a bench for your back foot instead.',
  },
  // Log Clean — pull/power, strongman
  ex_655: {
    startingPosition: 'Squat down and grip the log’s neutral handles, close to your body.',
    movement: 'Pull the log up explosively and catch it at your chest in one motion, using your hips and legs to drive it.',
    keyCue: 'Keep the log close to your body the entire pull — an implement this bulky is much harder to control if it drifts away from you.',
    feelIt: 'You should feel this as an explosive pull from your hips and legs, not an arm curl.',
    regression: 'If the log feels unfamiliar, practice a barbell clean instead — same movement pattern, more common implement.',
  },
  // Atlas Stone to Shoulder — full body, strongman
  ex_656: {
    startingPosition: 'Squat down and wrap both arms around the stone, pulling it into your lap.',
    movement: 'Roll the stone up your body and use your hips and legs to drive it up onto one shoulder in a continuous motion.',
    keyCue: 'Keep the stone close to your body the entire lift — this is a full-body hug-and-drive, not a lift with your arms held away from you.',
    feelIt: 'You should feel this in your legs, back, and grip together, not a strain isolated in your lower back.',
    regression: 'If this is too much, practice with a lighter sandbag first to learn the lap-and-drive-to-shoulder pattern.',
  },
  // Axle Bar Clean and Press — full body, grip/technical
  ex_659: {
    startingPosition: 'Stand with the thick axle bar over your midfoot, feet hip-width apart, gripping just outside your knees.',
    movement: 'Pull the bar up and catch it racked at your shoulders, then press it overhead until your arms are extended.',
    keyCue: 'Grip the thick bar firmly with your whole hand — this demands significantly more grip strength than a regular bar, so expect to move less weight.',
    feelIt: 'You should feel extra grip demand on top of the usual explosive pull-to-press effort, not a strain in your wrists.',
    regression: 'If the thick grip is too limiting, practice a regular barbell clean and press first.',
  },
  // Single-Leg Broad Jump (Bound to Stick) — jump, power
  ex_660: {
    startingPosition: 'Stand on one leg, knee slightly bent.',
    movement: 'Jump forward as far as you can on that single leg, landing softly and holding the landing (‘sticking’ it) without an extra hop.',
    keyCue: 'Land soft with a bent knee and hold the landing still for a moment — sticking the landing is the whole point, not just covering distance.',
    feelIt: 'You should feel this as an explosive effort in your jumping leg, not a jolt in your knee or ankle on landing.',
    regression: 'If this is too much, try a two-leg broad jump first, or practice a smaller single-leg hop before going for distance.',
  },
  // 180-Degree Jump (Rotational Plyo) — jump, power
  ex_661: {
    startingPosition: 'Stand with feet shoulder-width apart, knees slightly bent.',
    movement: 'Jump straight up while rotating your body a full 180 degrees in the air, landing softly facing the opposite direction.',
    keyCue: 'Land soft with bent knees and your body under control — spot your landing before you jump so the rotation doesn’t leave you off-balance.',
    feelIt: 'You should feel this as an explosive, coordinated rotation, not a jolt in your knees on an off-balance landing.',
    regression: 'If this is too much, try a smaller rotation (like 90 degrees) first, or practice the rotation standing without jumping.',
  },
  // Rolling Thunder Deadlift (Single-Handle Max Grip) — hinge, grip
  ex_671: {
    startingPosition: 'Stand over a single rotating handle loaded with weight, feet hip-width apart, gripping it with both hands.',
    movement: 'Stand up by pushing the floor away with your legs and driving your hips forward, relying entirely on your grip to hold the rotating handle.',
    keyCue: 'This tests pure grip strength — the handle rotates freely, so there’s no wrist-curl assistance like a regular bar allows. Expect to lift significantly less than your regular deadlift.',
    feelIt: 'You should feel intense grip and forearm demand, not a strain in your lower back from trying to muscle through a failing grip.',
    regression: 'If the rotating handle is too limiting, practice on a regular thick-bar deadlift first to build grip strength.',
  },
  // Bear Hug Sled Push — carry/push
  ex_675: {
    startingPosition: 'Bear-hug the sled’s upright post against your chest, feet set to drive.',
    movement: 'Push the sled forward by driving through your legs, taking short, powerful steps.',
    keyCue: 'Keep your core braced and the sled held tight against your chest — a loose hold makes it harder to transfer your leg drive into the push.',
    feelIt: 'You should feel this in your legs and core from driving and holding tight, not a strain in your arms.',
    regression: 'If this is too much, use a lighter sled load or push with handles instead of a bear hug.',
  },
  // Single-Arm Sled Row — pull, unilateral
  ex_676: {
    startingPosition: 'Attach a handle to the sled and face it, feet staggered, gripping the handle with one hand.',
    movement: 'Pull the sled toward you by driving your elbow back, then release tension and reset for the next pull.',
    keyCue: 'Keep your core braced and resist twisting toward the pulling side — a single-arm pull creates real rotational demand.',
    feelIt: 'You should feel this in your back and bicep, plus extra core work resisting the rotation, not a strain in your lower back.',
    regression: 'If resisting the rotation is hard, use a lighter sled load or pull with both hands instead.',
  },
  // Single-Arm Cable Pull-Through — hinge, anti-rotation
  ex_677: {
    startingPosition: 'Stand facing away from the cable machine, handle set low, gripping it with one hand between your legs.',
    movement: 'Hinge forward at your hips, letting the cable pull back between your legs, then drive your hips forward to stand tall.',
    keyCue: 'Keep your back flat and resist rotating toward the working side — this is a hip hinge with an added anti-rotation demand.',
    feelIt: 'You should feel this in your glutes and hamstrings, plus extra core work staying square, not your lower back.',
    regression: 'If resisting the rotation is hard, use both hands on the handle instead.',
  },
  // Mace 360 (Rotational Swing) — full body, control
  ex_679: {
    startingPosition: 'Stand holding the mace with both hands near the head, feet shoulder-width apart.',
    movement: 'Swing the mace in a continuous circular path around your body, letting it flow from one side to the other.',
    keyCue: 'Move slowly and with control as you learn the pattern — an off-balance mace has real momentum, and hitting yourself with it is a genuine risk while you’re still learning the swing.',
    feelIt: 'You should feel this in your shoulders, core, and grip controlling the arc, not a strain from fighting the momentum.',
    regression: 'If this is too much, practice with a much lighter mace or a similar-weight stick first to learn the pattern.',
  },
  // Mace Front Rack Squat — squat
  ex_681: {
    startingPosition: 'Hold the mace racked at your chest with both hands, feet shoulder-width apart.',
    movement: 'Push your hips back and bend your knees to lower down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Keep your elbows up and the mace close to your chest — an off-balance mace pulls you forward if you let it drift.',
    feelIt: 'You should feel this in your quads and glutes, plus your core and grip holding the mace steady, not a strain in your lower back.',
    regression: 'If holding the mace at your chest is unfamiliar, try a goblet squat with a dumbbell instead.',
  },
  // Clubbell Swing (Two-Handed) — shoulder, control
  ex_683: {
    startingPosition: 'Stand holding a clubbell with both hands at your shoulder, feet shoulder-width apart.',
    movement: 'Swing the clubbell down and around in a controlled arc, letting it pass behind your shoulder, then swing it back up to the starting position.',
    keyCue: 'Move slowly and with control, especially as you build familiarity — an off-balance clubbell swings with real momentum, so don’t rush the arc.',
    feelIt: 'You should feel this in your shoulders and core from controlling the arc, not a strain from fighting the momentum.',
    regression: 'If this is too much, practice with a very light clubbell or a similar-weight object first to learn the arc pattern.',
  },
  // BOSU Step-Up (Dome Up) — squat, balance
  ex_688: {
    startingPosition: 'Stand facing a BOSU ball, dome side up, feet shoulder-width apart.',
    movement: 'Step one foot onto the center of the dome and drive through it to stand up, balancing on the unstable surface, then step back down with control.',
    keyCue: 'Move slower than a regular step-up and keep your core braced — the unstable dome demands constant small balance corrections.',
    feelIt: 'You should feel this in your thigh and glute of the stepping leg, plus extra stabilizing work through your ankle, not a strain in your knee.',
    regression: 'If balance is too hard, do a regular step-up onto a stable box first.',
  },
  // Weighted Vest Push-Up — push, added load
  ex_689: {
    startingPosition: 'Wear a weighted vest and start in a high plank position, hands slightly wider than shoulder-width.',
    movement: 'Lower your chest toward the floor by bending your elbows, then press back up until your arms are straight.',
    keyCue: 'Keep your body in one straight line the whole way — the extra vest weight makes any sag in your hips more pronounced and harder to correct.',
    feelIt: 'You should feel this across your chest, shoulders, and triceps, not a strain in your lower back.',
    regression: 'If the added weight breaks your form, remove the vest and do regular bodyweight push-ups first.',
  },
  // GHD Sit-Up — core, extended range
  ex_692: {
    startingPosition: 'Sit on the GHD machine with your feet secured under the footplate, hips resting on the pad, torso starting slightly reclined.',
    movement: 'Curl your torso all the way up until you’re leaning forward past vertical, then lower back down with control, going as far back as your mobility allows.',
    keyCue: 'Control the bottom range especially — the GHD allows a much deeper hyperextension than a floor sit-up, and dropping fast into that range is where lower-back strain happens.',
    feelIt: 'You should feel this in your abs and hip flexors through a full range, not a strain in your lower back at the bottom.',
    regression: 'If the extended range is too much, only go back as far as feels controlled, or do a regular floor sit-up instead.',
  },
  // Stability Ball Pike — core, unstable
  ex_698: {
    startingPosition: 'Place your feet on top of a stability ball, hands on the floor in a push-up position, body in a straight line.',
    movement: 'Pull your hips up toward the ceiling by rolling the ball toward your hands with your feet, keeping your legs straight, then roll back out to the plank.',
    keyCue: 'Keep your core braced the whole time — the ball adds instability on top of the already-demanding pike movement.',
    feelIt: 'You should feel this intensely in your abs, not your shoulders.',
    regression: 'If this is too much, try a stability ball rollout instead — smaller range, less demanding.',
  },
  // Sandbag Lunge — lunge
  ex_703: {
    startingPosition: 'Hold a sandbag at your chest or in a front-rack position, feet hip-width apart.',
    movement: 'Step forward into a lunge and lower until both knees are bent to about 90 degrees, then push through your front foot to return to standing.',
    keyCue: 'Keep your torso upright and the bag held close — a loose or shifting hold pulls you off balance mid-lunge.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If holding the bag is too much, try a bodyweight lunge first.',
  },
  // Trap Bar High Pull — pull, power
  ex_706: {
    startingPosition: 'Stand inside the trap bar with feet hip-width apart, gripping the handles.',
    movement: 'Pull the bar up explosively by extending your hips, then continue pulling it high toward your chest by driving your elbows up and out.',
    keyCue: 'Keep the bar close to your body the entire pull — this drill builds explosive pulling power, so let your hips and legs generate most of the force.',
    feelIt: 'You should feel this as an explosive pull from your hips and legs, not an arm curl.',
    regression: 'If the full extension feels unfamiliar, practice a regular trap bar deadlift first to build the base pulling strength.',
  },
  // Landmine Romanian Deadlift (Single-Arm) — hinge, unilateral hold
  ex_707: {
    startingPosition: 'Stand holding the end of a landmine-anchored bar with one hand, feet hip-width apart, slight bend in your knees.',
    movement: 'Hinge forward at your hips, letting the bar travel down close to your legs, until you feel a stretch in your hamstrings, then drive your hips forward to stand back up.',
    keyCue: 'Keep your back flat and hips square — don’t let them rotate open as you hinge with a single-arm hold.',
    feelIt: 'You should feel a stretch in your hamstrings, not your lower back.',
    regression: 'If the single-arm hold feels unstable, hold the bar with both hands instead.',
  },
  // Barbell Bench Press with Bands (Accommodating Resistance) — push
  ex_711: {
    startingPosition: 'Lie on the bench with bands anchored to the floor and looped over each end of the bar, grip slightly wider than shoulder-width.',
    movement: 'Lower the bar to your chest, then press it back up — the bands add extra resistance as you approach lockout.',
    keyCue: 'Drive hard through the top of the lift with the same control as the bottom — the load actually increases as you press up, so don’t ease off near lockout.',
    feelIt: 'You should feel this across your chest throughout, with noticeably more resistance near the top than a regular bench press.',
    regression: 'If the changing resistance feels unpredictable, try a regular barbell bench press first without bands.',
  },
  // Stability Ball Rollout — core
  ex_794: {
    startingPosition: 'Kneel on the floor with your forearms resting on top of a stability ball in front of you.',
    movement: 'Roll the ball forward by extending your arms and torso, then pull back to the starting position using your core.',
    keyCue: 'Keep your core braced the whole time — don’t let your lower back sag toward the floor as you extend.',
    feelIt: 'You should feel this in your abs, not your lower back.',
    regression: 'If this is too much, only roll out a short distance — a smaller range with a tight core beats a longer one that sags.',
  },
  // Stability Ball Back Extension — hinge
  ex_795: {
    startingPosition: 'Lie face-down over a stability ball with your hips resting on top, feet braced against a wall or held by a partner.',
    movement: 'Lower your torso down over the ball, then raise it back up until your body forms a straight line, squeezing your glutes and lower back.',
    keyCue: 'Don’t hyperextend past a straight line at the top — this is a controlled range exercise, not a maximum backbend.',
    feelIt: 'You should feel this in your glutes and lower back muscles, not a pinch or strain from overextending.',
    regression: 'If balancing on the ball is hard, try a bodyweight back extension on the floor instead.',
  },
  // Single-Arm Cable Row — pull, unilateral
  ex_122: {
    startingPosition: 'Sit or stand facing the cable machine, gripping a single handle with one hand, arm extended.',
    movement: 'Pull the handle toward your ribs by driving your elbow back, then extend back out with control.',
    keyCue: 'Keep your torso still — don’t rotate or lean back to help pull the weight.',
    feelIt: 'You should feel this in your back and lat, not your lower back.',
    regression: 'If staying still is hard, use a lighter weight or brace your other hand on something sturdy.',
  },
  // Single-Arm Machine Chest Press — push, unilateral
  ex_125: {
    startingPosition: 'Sit at the machine, gripping one handle at chest height, other hand resting or braced.',
    movement: 'Press the handle forward until your arm is extended, then return with control.',
    keyCue: 'Keep your torso square to the machine — don’t twist to help push the weight.',
    feelIt: 'You should feel this in your chest, not a strain in your shoulder from twisting.',
    regression: 'If staying square is hard, use both handles for a regular two-arm press instead.',
  },
  // Cable Seated Row — pull
  ex_130: {
    startingPosition: 'Sit at the cable row station with knees slightly bent, feet braced on the platform, arms extended.',
    movement: 'Pull the handle toward your stomach by driving your elbows back, keeping your torso upright, then extend back out with control.',
    keyCue: 'Keep your torso still — don’t rock backward and forward to help pull the weight.',
    feelIt: 'You should feel this in your upper back, not your lower back or arms.',
    regression: 'If keeping your torso still is hard, use a lighter weight until you can do it with good control.',
  },
  // Bent-Over Dumbbell Rear Delt Fly — pull, isolation
  ex_175: {
    startingPosition: 'Hinge forward at your hips holding a dumbbell in each hand, arms hanging straight down.',
    movement: 'Raise the dumbbells out to your sides with a slight elbow bend, squeezing your shoulder blades, then lower with control.',
    keyCue: 'Keep your back flat in the hinge the whole time — don’t round it to help swing the weights up.',
    feelIt: 'You should feel this in your rear shoulders and upper back, not your lower back.',
    regression: 'If holding the hinge is hard, try a seated or chest-supported version instead.',
  },
  // Barbell Upright Row — pull
  ex_176: {
    startingPosition: 'Stand holding the bar with hands just inside shoulder-width, arms extended down.',
    movement: 'Pull the bar straight up toward your chin, leading with your elbows, keeping it close to your body, then lower with control.',
    keyCue: 'Only raise the bar to about chest or chin height — pulling higher than that is where shoulder pinching tends to happen.',
    feelIt: 'You should feel this in your shoulders and upper traps, not a pinch in your shoulder joint.',
    regression: 'If this causes any shoulder discomfort, try a wider grip or switch to a cable upright row instead.',
  },
  // Front-Rack Carry (Kettlebell, Bilateral) — carry
  ex_192: {
    startingPosition: 'Clean two kettlebells to the rack position at your shoulders.',
    movement: 'Walk forward at a steady pace, keeping both bells racked at your shoulders, for the set distance or time.',
    keyCue: 'Keep your elbows up and core braced — if your elbows drop, the bells pull your torso forward.',
    feelIt: 'You should feel this in your core and upper back from staying upright, not a strain in your lower back.',
    regression: 'If this is too much, try a single kettlebell front-rack carry instead.',
  },
  // Kettlebell Halo — core, control
  ex_198: {
    startingPosition: 'Hold a kettlebell upside down by the horns at your chest, feet shoulder-width apart.',
    movement: 'Circle the kettlebell around your head, passing it close to your skull, then reverse direction.',
    keyCue: 'Keep your core braced and move slowly — the bell passing close behind your head demands real control.',
    feelIt: 'You should feel this in your shoulders and core from the controlled circling, not a strain in your neck.',
    regression: 'If this is too much, use a lighter kettlebell or move the circle further from your head.',
  },
  // Glute Bridge March — hinge, unilateral stability
  ex_390: {
    startingPosition: 'Lie on your back with knees bent, feet flat, and drive your hips up into a glute bridge.',
    movement: 'Holding that top position, lift one foot off the floor and march it up, alternating legs without letting your hips drop.',
    keyCue: 'Keep your hips level and lifted the entire time you’re marching — don’t let the working side dip.',
    feelIt: 'You should feel this in your glutes, with extra stability demand from the marching, not your lower back.',
    regression: 'If this is too much, master a regular glute bridge first before adding the single-leg march.',
  },
  // Medicine Ball Rotational Slam (Side-to-Side) — core, power
  ex_422: {
    startingPosition: 'Stand sideways to your target, holding a medicine ball at one hip.',
    movement: 'Rotate through your torso and hips to raise the ball up and across your body, then slam it down forcefully to the other side.',
    keyCue: 'Generate the power from your hips rotating, not just your arms swinging.',
    feelIt: 'You should feel this as an explosive rotational effort through your core and hips, not a strain in your shoulder.',
    regression: 'If this is too much, use a lighter ball or practice the rotation pattern without slamming first.',
  },
  // Medicine Ball Overhead Throw (Backward) — full body, power
  ex_425: {
    startingPosition: 'Stand facing away from your target, holding a medicine ball with both hands, feet shoulder-width apart.',
    movement: 'Squat down and swing the ball back between your legs, then explosively extend your hips and throw the ball up and back overhead.',
    keyCue: 'Generate the power from your hips extending, not just your arms swinging — and make sure the space behind you is clear before throwing.',
    feelIt: 'You should feel this as an explosive hip-driven effort, not a strain in your shoulder.',
    regression: 'If this is too much, practice a kettlebell swing first to build the hip-hinge power pattern.',
  },
  // Medicine Ball Sit-Up Throw — core, power
  ex_427: {
    startingPosition: 'Lie on your back holding a medicine ball at your chest, knees bent, a partner or wall in front of you.',
    movement: 'Curl up into a sit-up and throw the ball explosively toward your target at the top, then catch it (or pick it up) as you lower back down.',
    keyCue: 'Use the momentum from your sit-up to power the throw — don’t just throw with your arms at the top.',
    feelIt: 'You should feel this in your abs powering the throw, not a strain in your neck.',
    regression: 'If this is too much, do a regular sit-up first, or a medicine ball chest pass without the sit-up.',
  },
  // Medicine Ball Single-Arm Slam — full body, power
  ex_428: {
    startingPosition: 'Stand holding a medicine ball in one hand overhead, feet shoulder-width apart.',
    movement: 'Slam the ball down to the floor forcefully using your arm and core together, then pick it up and repeat.',
    keyCue: 'Use your core and hips to help drive the slam, not just your shoulder — a pure arm slam puts more strain on your shoulder joint.',
    feelIt: 'You should feel this as an explosive full-body effort, not an isolated strain in your shoulder.',
    regression: 'If this is too much, use a lighter ball or switch to a two-handed slam instead.',
  },
  // Weighted Side Plank — core
  ex_480: {
    startingPosition: 'Hold a side plank position, propped up on your forearm, a light weight plate resting on your hip.',
    movement: 'Hold this position, keeping your body in a straight line and the plate steady, for the set time.',
    keyCue: 'Only add weight once your bodyweight side plank is solid — extra load on a sagging hold just teaches poor positioning.',
    feelIt: 'You should feel this in your obliques, not your shoulder.',
    regression: 'If the added weight breaks your form, remove it and go back to a bodyweight side plank first.',
  },
  // Single-Arm Face Pull (Cable) — pull, unilateral
  ex_497: {
    startingPosition: 'Set up at a cable station with the handle at face height, gripping it with one hand.',
    movement: 'Pull the handle toward your face, leading with your elbow high, then return with control.',
    keyCue: 'Keep your elbow high and your torso still — don’t rotate to help pull the weight.',
    feelIt: 'You should feel this in your rear shoulder and upper back, not your neck.',
    regression: 'If this is too much, use both hands on a regular face pull instead.',
  },
  // Single-Leg Hamstring Curl (Stability Ball) — hinge, unilateral
  ex_499: {
    startingPosition: 'Lie on your back with one heel on top of a stability ball, other leg raised, hips lifted slightly.',
    movement: 'Pull your heel toward your hips by bending your knee, rolling the ball toward you, then extend back out.',
    keyCue: 'Keep your hips lifted and level throughout — don’t let them drop toward the floor as your leg extends.',
    feelIt: 'You should feel this in the hamstring of your working leg, not your lower back.',
    regression: 'If this is too much, use both feet on the ball for a regular two-leg version first.',
  },
  // TRX Chest Fly — push, isolation
  ex_503: {
    startingPosition: 'Hold the TRX handles facing away from the anchor point, arms extended out to your sides, body leaning forward.',
    movement: 'Bring your hands together in front of your chest by squeezing your chest muscles, then let the straps return out to the sides.',
    keyCue: 'Keep a slight bend in your elbows throughout — locking them straight strains your elbow joints under this leaning bodyweight load.',
    feelIt: 'You should feel this across your chest, not a strain in your elbows.',
    regression: 'If this is too much, stand more upright to reduce the lean, or try a regular dumbbell fly instead.',
  },
  // Standing Cable Crunch — core
  ex_515: {
    startingPosition: 'Stand facing away from a high cable, gripping the rope behind your head.',
    movement: 'Crunch forward by curling your torso down, bringing your elbows toward your knees, then return to standing with control.',
    keyCue: 'Curl from your abs, not by bending at your hips — this should feel like a crunch, not a hip hinge.',
    feelIt: 'You should feel this in your abs, not your lower back or hip flexors.',
    regression: 'If this is too much, try a kneeling cable crunch instead — less range, easier to control.',
  },
  // Smith Machine Overhead Press — overhead, fixed path
  ex_534: {
    startingPosition: 'Stand under the smith machine bar, gripping it just outside shoulder-width at your collarbones.',
    movement: 'Press the bar straight up until your arms are extended, then lower it back to your collarbones with control.',
    keyCue: 'Position yourself so the bar’s fixed vertical path lines up with your natural pressing position, since the machine only moves straight up and down.',
    feelIt: 'You should feel this in your shoulders and triceps, not your lower back.',
    regression: 'If the fixed path feels awkward, try a free-weight dumbbell overhead press instead.',
  },
  // Smith Machine Reverse Lunge — lunge, fixed path
  ex_536: {
    startingPosition: 'Position the bar across your upper back on the smith machine, feet hip-width apart.',
    movement: 'Step one leg back into a reverse lunge, lowering until both knees are bent to about 90 degrees, then push through your front foot to return to standing.',
    keyCue: 'Stand at a distance from the bar that lets your front knee track properly under its fixed vertical path.',
    feelIt: 'You should feel this in your front thigh and glute, not a strain in your front knee.',
    regression: 'If the fixed path feels awkward, try a free-weight dumbbell reverse lunge instead.',
  },
  // Smith Machine Front Squat — squat, fixed path
  ex_541: {
    startingPosition: 'Position the bar across the front of your shoulders on the smith machine, elbows lifted high.',
    movement: 'Squat down until your thighs are at least parallel to the floor, then drive through your heels to stand.',
    keyCue: 'Keep your elbows up throughout — if they drop, the bar rolls forward off the fixed path and you lose control.',
    feelIt: 'You should feel this in your quads and upper back, not your wrists.',
    regression: 'If the fixed path feels awkward, try a free-weight goblet squat instead.',
  },
  // Agility Ladder Quick Feet — conditioning, coordination
  ex_548: {
    startingPosition: 'Stand at one end of the ladder, feet just outside the first rung.',
    movement: 'Quickly step in and out of each rung with fast, light steps, moving down the length of the ladder.',
    keyCue: 'Stay light on your feet and keep your steps quick and precise — this is about foot speed and coordination, not power.',
    feelIt: 'You should feel this as a fast, coordinated effort in your calves and feet, not a jolt in your ankles from clipping the rungs.',
    regression: 'If this is too much, slow the pace down and focus on clean footwork before speeding up.',
  },
  // Heavy Bag Punching (Conditioning) — full body, rotation
  ex_549: {
    startingPosition: 'Stand in a boxing stance in front of a heavy bag, hands up near your chin.',
    movement: 'Throw a combination of punches at the bag, rotating your hips and pivoting your feet with each strike.',
    keyCue: 'Rotate your hips and turn your fist over on impact — punching with just your arm both reduces power and increases wrist strain.',
    feelIt: 'You should feel this as a full-body rotational effort through your hips and core, not a jolt in your wrist on contact.',
    regression: 'If this is too much, practice your form shadow-boxing without the bag first.',
  },
  // Wheelbarrow Walk (Partner-Assisted) — full body, push
  ex_550: {
    startingPosition: 'Get into a high plank position while a partner holds your legs up at the ankles.',
    movement: 'Walk forward on your hands while your partner walks behind holding your legs steady.',
    keyCue: 'Keep your core braced and body in a straight line — don’t let your hips sag as you walk.',
    feelIt: 'You should feel this in your shoulders, chest, and core, not a strain in your lower back.',
    regression: 'If this is too much, have your partner hold higher up (at your thighs instead of ankles) for more support.',
  },
  // Barbell Seated Overhead Press — overhead, seated
  ex_566: {
    startingPosition: 'Sit on a bench with back support, bar resting at your collarbones, hands just outside shoulder-width.',
    movement: 'Press the bar straight up overhead until your arms are extended, then lower it back to your collarbones with control.',
    keyCue: 'Keep your wrists stacked over your elbows — don’t let them bend backward under the weight.',
    feelIt: 'You should feel this in your shoulders and triceps, not your wrists or lower back.',
    regression: 'If this is too much, try a seated dumbbell press instead — easier to balance and control.',
  },
  // Dumbbell Floor Press — push
  ex_577: {
    startingPosition: 'Lie on the floor with knees bent, feet flat, holding a dumbbell in each hand above your chest.',
    movement: 'Lower the dumbbells until your upper arms touch the floor, then press them back up until your arms are straight.',
    keyCue: 'Keep your elbows at roughly a 45-degree angle to your body, not flared straight out to the sides.',
    feelIt: 'You should feel this across your chest and triceps, not a pinch in your shoulder joints.',
    regression: 'If this is too much, try a push-up instead — same pressing pattern, uses your bodyweight.',
  },
  // Cable Deadlift (Standing, Low Pulley) — hinge
  ex_589: {
    startingPosition: 'Stand facing the low cable pulley, feet hip-width apart, gripping the handle with both hands.',
    movement: 'Hinge forward at your hips to lower toward the handle, keeping your back flat, then drive your hips forward to stand back up.',
    keyCue: 'Keep your back flat the whole time — this is a hip hinge, not a squat or a back bend.',
    feelIt: 'You should feel this in your glutes and hamstrings, not your lower back.',
    regression: 'If the hip hinge feels unfamiliar, practice it bodyweight first, without the cable.',
  },
  // Swimming (Freestyle, Continuous) — full body, conditioning
  ex_643: {
    startingPosition: 'Start in the water in a horizontal position, face down, arms extended.',
    movement: 'Alternate reaching arms overhead and pulling through the water while kicking your legs in a steady flutter, rotating your body slightly with each stroke.',
    keyCue: 'Keep a steady, relaxed rhythm between your arm strokes and your breathing — rushing the stroke rate usually breaks your breathing pattern first.',
    feelIt: 'You should feel this as a smooth, full-body rhythm, not a strain in your neck from lifting your head to breathe.',
    regression: 'If continuous freestyle is too much, break it into shorter intervals with rest between, or use a kickboard to isolate your legs first.',
  },
  // TRX Mountain Climber — core, unstable
  ex_644: {
    startingPosition: 'Place your feet in the TRX straps and hold a high plank position, hands under your shoulders.',
    movement: 'Drive your knees toward your chest one at a time, alternating quickly while keeping your hips level.',
    keyCue: 'Keep your hips level and core braced — the suspended feet add real instability compared to a floor mountain climber.',
    feelIt: 'You should feel this in your core and hip flexors, plus extra stabilizing work, not a strain in your lower back.',
    regression: 'If this is too much, try a regular mountain climber with your feet on the floor first.',
  },
  // Circus Dumbbell Press — overhead, unconventional implement
  ex_657: {
    startingPosition: 'Clean an oddly-weighted, thick-handled dumbbell to your shoulder with one hand.',
    movement: 'Press it overhead using a slight push-press leg drive, then lower it back to your shoulder with control.',
    keyCue: 'Grip the thick handle firmly and let your legs help start the drive — this implement is deliberately awkward, so don’t force a strict press.',
    feelIt: 'You should feel extra grip and stabilizing demand on top of the usual pressing effort, not a strain in your wrist.',
    regression: 'If this odd implement isn’t available, a regular thick-grip dumbbell push press gives a similar challenge.',
  },
  // Skater Bound to Stick (Lateral Landing Control) — jump, power
  ex_662: {
    startingPosition: 'Stand on one leg, knee slightly bent.',
    movement: 'Push off sideways and land on the other leg, absorbing the landing with a bent knee, holding that landing still (‘sticking’ it) before the next bound.',
    keyCue: 'Land soft and hold each landing still for a moment before bounding again — sticking the landing is the whole point here, not chaining fast reps.',
    feelIt: 'You should feel this as an explosive effort in your glutes and outer hips, not a jolt in your knee on landing.',
    regression: 'If this is too much, try a smaller lateral step instead of a full bound.',
  },
  // Mace 10-to-2 (Diagonal Swing) — shoulder, control
  ex_680: {
    startingPosition: 'Stand holding the mace with both hands near the head, feet shoulder-width apart.',
    movement: 'Swing the mace in a diagonal path from over one shoulder down and across to the opposite hip, like the hands of a clock moving from 10 to 2, then reverse.',
    keyCue: 'Move slowly and with control as you learn the pattern — an off-balance mace has real momentum, so don’t rush the diagonal path.',
    feelIt: 'You should feel this in your shoulders, core, and grip controlling the arc, not a strain from fighting the momentum.',
    regression: 'If this is too much, practice with a much lighter mace or a similar-weight stick first to learn the pattern.',
  },
  // Weighted Vest Step-Up — lunge/squat, added load
  ex_690: {
    startingPosition: 'Wear a weighted vest and stand facing a sturdy box, feet shoulder-width apart.',
    movement: 'Step one foot fully onto the box and drive through it to stand up on top, then step back down with control.',
    keyCue: 'Push through your whole foot on the box, not just your toes — the added vest weight makes any imbalance more noticeable.',
    feelIt: 'You should feel this in the thigh and glute of the leg stepping up, not a strain in your knee.',
    regression: 'If the added weight breaks your form, remove the vest and do a regular bodyweight step-up first.',
  },
  // Stability Ball Hip Bridge (Feet on Ball) — hinge, balance
  ex_696: {
    startingPosition: 'Lie on your back with your feet resting on top of a stability ball, knees bent.',
    movement: 'Drive your hips up by squeezing your glutes, balancing your feet on the ball, then lower back down with control.',
    keyCue: 'Move slower than a regular glute bridge — the unstable ball demands small balance corrections throughout the lift.',
    feelIt: 'You should feel this in your glutes, plus extra stabilizing work through your feet and core, not your lower back.',
    regression: 'If balance is too hard, do a regular glute bridge with your feet on stable ground first.',
  },
};

/**
 * One-line confirming cues for `complexity:'simple'` exercises — per the
 * writing spec, the name already conveys the movement here, so a full
 * FormCue breakdown would clutter the screen for someone who doesn't need
 * it. Still present for every exercise this covers, so the app reads as
 * consistent and the rare true beginner routed here by the complexity bias
 * (see baseline-plan.ts) isn't left guessing entirely.
 */
export const SIMPLE_CUES: Record<string, string> = {
  ex_134: 'Push your hips back and keep your chest up as you lower — drive through your heels to stand.', // Bodyweight Squat
  ex_136: 'Squeeze your glutes at the top and keep your lower back from arching too much.', // Glute Bridge
  ex_228: 'Keep your arms straight and pull the band apart by squeezing your shoulder blades together.', // Band Pull-Apart
  ex_928: 'Keep a straight line from your head to your knees — don’t let your hips sag.', // Knee Push-Up
  ex_386: 'Press your lower back into the floor and move slow enough that it never lifts off.', // Dead Bug
  ex_118: 'Rise up onto your toes slowly and lower back down with control, not a bounce.', // Standing Calf Raise
  ex_607: 'Keep your knees at about 90 degrees and your back flat against the wall.', // Wall Sit
  ex_466: 'Stack your hips and shoulders in a straight line — don’t let your hips sag toward the floor.', // Side Plank
  ex_138: 'Lift your arms and legs a few inches off the floor and squeeze your lower back and glutes.', // Superman Hold
  ex_117: 'Keep your elbows pinned to your sides and curl with control, no swinging.', // Standing Dumbbell Bicep Curl
  ex_116: 'Raise the dumbbells out to the sides with a slight bend in your elbows, only up to shoulder height.', // Dumbbell Lateral Raise
  ex_246: 'Move slowly between arching and rounding your back, following your breath.', // Cat-Cow Stretch
  ex_251: 'Rotate slowly through the full range of the ankle, both directions.', // Ankle Circles
  ex_1116: 'Keep your body in a straight line and lower until your chest is close to the floor.', // Wide-Grip Push-Up
  ex_215: 'Keep your body in a straight line and lower your chest toward the raised surface.', // Incline Push-Up
  ex_115: 'Curl your heels toward the seat with control, then let the pad back up slowly.', // Seated Leg Curl
  ex_114: 'Extend your legs until they’re straight, then lower back down slowly — don’t kick.', // Leg Extension
  ex_212: 'Keep your elbows close to your body as you lower — expect it to hit your triceps harder than a regular push-up.', // Diamond Push-Up
  ex_109: 'Pull the bar down to your upper chest by driving your elbows down, then let it back up with control.', // Lat Pulldown (Machine)
  ex_165: 'Pull the bar down to your upper chest with a wide grip, leading with your elbows, not your hands.', // Wide-Grip Lat Pulldown
  ex_303: 'Keep your torso upright and lower until your elbows hit about 90 degrees, then press back up.', // Assisted Dip Machine
  ex_314: 'Keep your elbows close to your body and press down through your palms with control.', // Seated Dip Machine (Triceps-Focused)
  ex_1218: 'Keep a slight bend in your elbow and bring your hand across your body in a wide arc.', // Single-Arm Cable Fly
  ex_524: 'Keep your elbows pinned to your sides and curl with control, no swinging your back.', // Barbell Curl (Standing)
  ex_180: 'Keep your upper arms still and only bend at the elbow, lowering the bar toward your forehead.', // Lying EZ-Bar Skull Crusher
  ex_285: 'Keep your elbows pointed forward and extend your arms fully without flaring them out.', // Cable Overhead Triceps Extension (Rope)
  ex_932: 'Curl up leading with your chest, not by yanking your neck forward.', // Sit-Up (Bodyweight)
  ex_211: 'Push through your whole foot on the box, not just your toes.', // Box Step-Up
  ex_171: 'Push your legs outward against the pads with control, then let them back in slowly.', // Hip Abduction Machine
  ex_601: 'Squeeze your legs together against the pads with control, then let them back out slowly.', // Hip Adduction Machine
  ex_238: 'Pull the handles to your stomach by driving your elbows back, keeping your torso upright.', // Seated Row Machine (Plate-Loaded)
  ex_111: 'Press the handles forward until your arms are extended, without shrugging your shoulders up.', // Machine Chest Press
  ex_110: 'Press straight up without arching your lower back off the seat.', // Machine Shoulder Press
  ex_239: 'Pull your chin toward the bar with control, then lower back down slowly.', // Assisted Pull-Up Machine
  ex_225: 'Push your hips back and keep tension on the band the whole way down and up.', // Band Squat
  ex_438: 'Pull your elbows back and squeeze your shoulder blades together at the end.', // Band Row
  ex_241: 'Kick your leg straight back and squeeze your glute at the top, without arching your back.', // Cable Kickback (Glutes)
  ex_306: 'Rotate through your torso with control, not your arms pulling the handle.', // Torso Rotation Machine
  ex_139: 'Rise up onto your toes slowly and lower back down with control, not a bounce.', // Seated Calf Raise Machine
  ex_236: 'Keep your upper arms flat on the pad and curl with control, no swinging.', // Preacher Curl Machine
  ex_129: 'Keep a slight bend in your elbows and bring your hands together in a wide arc.', // Cable Standing Chest Fly
  ex_144: 'Reach toward your toes and hold, breathing steadily, without bouncing.', // Seated Hamstring Stretch
  ex_145: 'Pull your heel gently toward your glute and hold, keeping your knees close together.', // Standing Quad Stretch
  ex_287: 'Pull the ropes apart and back, squeezing your shoulder blades together.', // Cable Reverse Fly (Rope, Rear Delt)
  ex_226: 'Hinge at your hips with a flat back, keeping tension on the band the whole time.', // Band Good Morning
  ex_108: 'Push through your whole foot and stop just short of locking your knees out at the top.', // Seated Leg Press (Machine)
  ex_112: 'Keep your chest pressed into the pad and pull your elbows back without shrugging.', // Chest-Supported Machine Row
  ex_119: 'Pull the band toward your face, leading with your elbows high and squeezing your shoulder blades together.', // Face Pull (Resistance Band)
  ex_126: 'Keep your elbows pinned to your sides and only move at the elbow.', // Cable Triceps Pushdown
  ex_135: 'Keep a straight line from your head to your heels — don’t let your hips sag or pike up.', // Plank
  ex_140: 'Keep your upper arms still against the pad and curl with control.', // Machine Bicep Curl
  ex_141: 'Curl forward using your abs, not by yanking with your arms on the handles.', // Machine Ab Crunch
  ex_162: 'Keep a slight bend in your elbows and bring your hands together in front of your chest in a wide arc.', // Cable Crossover
  ex_168: 'Push through your whole foot and keep your lower back flat against the pad.', // Hack Squat (Machine)
  ex_170: 'Curl your heels toward your glutes with control, then let the pad back down slowly.', // Lying Leg Curl (Machine)
  ex_174: 'Raise your arm out to the side with a slight elbow bend, only up to shoulder height.', // Cable Lateral Raise
  ex_177: 'Keep your palms facing each other the whole time and curl with control, no swinging.', // Hammer Curl (Dumbbell)
  ex_183: 'Rotate your torso side to side with control, keeping your chest up rather than rounding forward.', // Russian Twist
  ex_193: 'Hold the kettlebell at your chest and keep your chest up as you squat down and back up.', // Kettlebell Goblet Squat
  ex_194: 'Keep your back flat and push the floor away with your legs to stand up.', // Kettlebell Deadlift (Bilateral)
  ex_223: 'Hold the handles for balance and sit your hips back as you squat down.', // TRX Squat
  ex_231: 'Keep your arms extended and drive through your legs with short, powerful steps.', // Sled Push
  ex_237: 'Keep a slight bend in your elbows and bring the pads together in front of your chest with control.', // Pec Deck Fly (Machine)
  ex_249: 'Hinge forward from your hips and let your arms hang, without bouncing.', // Standing Hamstring Stretch (Toe Touch)
  ex_265: 'Swing your arms back, then jump forward and land softly with both feet, knees bent.', // Standing Broad Jump
  ex_360: 'Drive your knees up toward your waist quickly, landing lightly on the balls of your feet.', // High Knees
  ex_373: 'Squat down then jump straight up, landing softly with bent knees.', // Squat Jump (Bodyweight)
  ex_387: 'Lie on your side with knees bent and open your top knee like a clamshell, keeping your feet together.', // Clamshell
  ex_389: 'Keep your arms and lower back against the wall as you slide your arms up and down.', // Wall Slide (Scapular)
  ex_401: 'Rest your back shin on the couch or bench behind you and gently sink your hips forward.', // Couch Stretch
  ex_412: 'Hinge forward with a flat back and pull the kettlebell up toward your hip.', // Kettlebell Single-Arm Row
  ex_435: 'Keep tension on the band and take small controlled steps sideways, staying low.', // Band Lateral Walk (Monster Walk)
  ex_520: 'Keep your chest pressed into the bench and pull your elbows back without shrugging.', // Chest-Supported Dumbbell Row
  ex_557: 'Stand up from the chair using your legs, then lower back down with control until you just touch the seat.', // Chair Squat (Sit-to-Stand)
  ex_569: 'Keep your upper arms still and only bend at the elbow, lowering the bar toward your forehead.', // Barbell Skull Crusher (Lying Triceps Extension)
  ex_570: 'Keep your upper arms flat on the pad and curl with control, no swinging.', // Barbell Preacher Curl
  ex_582: 'Raise the dumbbells out to the sides with a slight elbow bend, only up to shoulder height.', // Dumbbell Seated Lateral Raise
  ex_594: 'Pull the bar down to your upper chest, driving your elbows down and back.', // Cable V-Bar Pulldown (Close Grip)
  ex_602: 'Pull the handle to your stomach by driving your elbows back, keeping your torso upright.', // Seated Row Machine (Wide Grip)
  ex_610: 'Hang from the bar and pull your shoulder blades down and together without bending your elbows.', // Scapular Pull-Up (Hang Shrug)
  ex_611: 'Bring the soles of your feet together, knees out wide, and squeeze your glutes as you lift your hips.', // Frog Pump (Bodyweight Glute Bridge, Wide Stance)
  ex_635: 'Curl your hips up toward your chest using your lower abs, not by swinging your legs.', // Reverse Crunch (Floor)
  ex_636: 'Keep your lower back pressed into the floor as you kick your legs in small, quick alternating movements.', // Flutter Kicks
  ex_709: 'Push through your whole foot and stop just short of locking your knee out at the top.', // Single-Leg Press (Machine)
  ex_733: 'Push your hips up and back, keeping your arms straight and heels reaching toward the floor.', // Downward Dog
  ex_132: 'Pull the rope toward your face, leading with your elbows high and squeezing your shoulder blades together.', // Cable Face Pull
  ex_214: 'Keep your body in a straight line and lower your chest toward the floor with your feet elevated.', // Decline Push-Up
  ex_240: 'Curl your torso down toward your knees using your abs, not by pulling with your arms.', // Kneeling Cable Crunch
  ex_242: 'Rotate your torso side to side with control, tapping the ball down near your hip each side.', // Medicine Ball Russian Twist
  ex_248: 'Place your forearm on the doorframe and gently lean forward until you feel a stretch across your chest.', // Doorway Chest Stretch
  ex_267: 'Raise the ball overhead and slam it down hard into the floor, using your whole body, then pick it up and repeat.', // Medicine Ball Slam
  ex_272: 'Hang from the bar with arms straight and shoulders relaxed, just holding your bodyweight.', // Dead Hang (Bar)
  ex_284: 'Hinge forward with a flat back and pull the end of the bar up toward your hip.', // Landmine Row (Single-Arm)
  ex_301: 'Push through your whole foot and stop just short of locking your knees out at the top.', // Vertical Leg Press
  ex_336: 'Keep your back flat and stand up by driving your hips forward from the raised starting position.', // Rack Pull (Partial Deadlift)
  ex_338: 'Squeeze your glutes to drive your hips up, keeping the bar steady across your hips.', // Barbell Glute Bridge
  ex_344: 'Keep your hips high and lower the top of your head toward the floor between your hands.', // Pike Push-Up
  ex_348: 'Press your lower back into the floor and hold your arms and legs slightly raised, without letting your back arch.', // Hollow Body Hold
  ex_350: 'Keep your hips level and squeeze the glute of your planted leg to lift your hips.', // Single-Leg Glute Bridge
  ex_352: 'Walk your hands out to a plank, then walk your feet up to meet them, keeping your legs as straight as comfortable.', // Inchworm
  ex_356: 'Keep your knees soft and whip the ropes in steady waves, driving the motion from your shoulders.', // Battle Ropes
  ex_358: 'Keep your hips level in a plank position and drive your knees toward your chest one at a time.', // Mountain Climbers
  ex_359: 'Jump your feet out while raising your arms overhead, then jump back to start.', // Jumping Jacks
  ex_402: 'Bring one knee forward and angle your shin across your body, then sink your hips down and forward.', // Pigeon Pose
  ex_437: 'Stand on the band with feet hip-width apart and hinge down to grip the handles, then stand up by driving your hips forward.', // Band Deadlift
  ex_865: 'Hinge forward from your hips over the pad, then squeeze your glutes to raise your torso back to level.', // GHD Hip Extension
  ex_868: 'Rotate your torso side to side with control, keeping your hips facing forward.', // Rotary Torso Machine
  ex_881: 'Sink into a deep squat with your heels flat and hold, letting your elbows gently press your knees out.', // Deep Squat Hold (Bodyweight)
  ex_894: 'Hold a squat position and make small controlled pulses up and down without standing all the way up.', // Isometric Squat Pulse
  ex_933: 'Curl your shoulders up off the floor using your abs, keeping your lower back down.', // Crunch (Bodyweight, Floor)
  ex_934: 'Keep your lower back pressed into the floor as you raise and lower your straight legs.', // Lying Leg Raise (Bodyweight, Floor)
  ex_935: 'Bend sideways at your waist, letting the dumbbell pull you down, then return to standing.', // Standing Side Bend (Dumbbell)
  ex_961: 'Keep a straight line from your head to your heels, hands under your shoulders.', // High Plank
  ex_962: 'Sit with the soles of your feet together and gently press your knees toward the floor.', // Butterfly Stretch (Groin)
  ex_983: 'Keep your elbows pointed back and lower your hips straight down, not out away from the bench.', // Bench Dip
  ex_984: 'Step sideways onto the box, pushing through the whole foot on top, then step back down with control.', // Lateral Step-Up
  ex_1000: 'Keep your back flat against the pad and push through your whole foot as you squat.', // Pendulum Squat (Machine)
  ex_1009: 'Keep your back against the pad and raise your knees using your abs, not by swinging.', // Captain's Chair Leg Raise
  ex_1015: 'Keep your arms straight and make small controlled circles, both directions.', // Arm Circles
  ex_1021: 'Rotate through your torso with control, keeping your hips relatively still.', // Standing Torso Twist
  ex_1031: 'Curl your shoulder toward your hip on one side using your obliques, not by pulling your neck.', // Side Crunch (Oblique Crunch)
  ex_1034: 'Pull the bar down to your upper chest, driving your elbows down and back.', // Neutral-Grip Lat Pulldown
  ex_1076: 'Squat down with your feet slightly wider than hip-width and press your elbows against your inner knees.', // Garland Pose (Malasana)
  ex_1082: 'Lie on your back with your legs resting straight up against a wall, relaxing completely.', // Legs Up The Wall (Viparita Karani)
  ex_1090: 'Step one foot forward into a deep lunge and gently sink your hips down and forward.', // Low Lunge (Anjaneyasana)
  ex_1105: 'Lie on your side with your arm at 90 degrees, and gently press your forearm down toward the floor.', // Sleeper Stretch
  ex_1113: 'Scrunch a towel toward you using only your toes, one small pull at a time.', // Towel Scrunch
  ex_1143: 'Reach your hands toward your raised feet, curling your shoulders off the floor with your abs.', // Toe Touch Crunch
  ex_1144: 'Bring your knees and chest together at the same time, curling from both ends.', // Suitcase Crunch
  ex_1156: 'Hinge forward with a flat back and pull the end of the bar up toward your chest with both hands.', // Landmine Row (Two-Arm)
  ex_1193: 'Stand on the slanted board and squat down, keeping your heels flat against the incline.', // Slant Board Squat
  ex_1216: 'Keep your elbow pinned to your side and curl with control, no swinging.', // Single-Arm Cable Curl
  ex_1219: 'Keep your chest pressed into the pad and pull your elbow back without shrugging.', // Single-Arm Chest-Supported Machine Row
  ex_1271: 'Keep your lower back pressed into the floor as you cross your legs in small, controlled scissors.', // Scissor Kick
  ex_1272: 'Curl your torso up leading with your chest, keeping your feet secured at the top of the bench.', // Decline Sit-Up
  ex_1279: 'Jump up spreading your arms and legs out wide like a star, then land softly and reset.', // Star Jump
  ex_1291: 'Hold a lunge position with both knees bent to about 90 degrees, staying tall through your torso.', // Static Lunge Hold (Isometric)
  ex_1312: 'From a side plank, dip your hip toward the floor and back up with control.', // Plank Hip Dips (Rocking Plank)
  ex_1313: 'Hold a side plank and raise your top arm straight up, keeping your hips lifted.', // T-Plank (Side Plank, Arm Raised)
  ex_1322: 'Hold a plank position and lift one foot slightly off the floor, keeping your hips level.', // Single-Leg Plank
  ex_1326: 'Hold a weight on your thighs while sitting against the wall with knees at about 90 degrees.', // Weighted Wall Sit
  ex_1332: 'Rest your feet on a bench and drive your hips up by squeezing your glutes.', // Feet-Elevated Glute Bridge
  ex_1374: 'Keep your elbows pinned to your sides and curl with control using a wide grip.', // Wide-Grip Barbell Curl
  ex_1375: 'Keep your elbows pinned to your sides and curl with control using a narrow grip.', // Close-Grip Barbell Curl
  ex_1517: 'Sink into a wide, low squat stance and hold, keeping your back straight and weight centered.', // Horse Stance (Măbù)
  ex_200: 'Keep a steady, relaxed pace with a slight forward lean, letting your arms swing naturally.', // Treadmill Running (Jogging)
  ex_247: 'Kneel with one leg forward and gently push your hips forward until you feel a stretch in the front of your back hip.', // Kneeling Hip Flexor Stretch
  ex_271: 'Pinch two plates together between your fingers and thumb and hold for time.', // Plate Pinch Hold
  ex_276: 'Stand tall holding heavy weights at your sides and hold, keeping your shoulders back and down.', // Farmer's Hold (Heavy, Static)
  ex_304: 'Hinge forward at your hips over the pad, then squeeze your glutes and hamstrings to raise back to level.', // 45-Degree Back Extension Machine
  ex_312: 'Let your legs hang and swing them up using your glutes and hamstrings, keeping your lower back still.', // Reverse Hyperextension Machine
  ex_319: 'Keep a slight bend in your elbows and lower the dumbbell behind your head, then pull it back over your chest.', // Dumbbell Pullover
  ex_388: 'Keep tension on the band and take small controlled steps, staying low the whole time.', // Banded Monster Walk
  ex_397: 'Lie on your side and lift your top leg straight up, keeping it in line with your body.', // Side-Lying Hip Abduction (Bodyweight)
  ex_408: 'Sit with legs extended and hinge forward from your hips, reaching toward your feet without bouncing.', // Seated Forward Fold
  ex_454: 'Stand tall holding weights at your sides and hold still, keeping your shoulders back and down.', // Farmer's Carry Hold (Isometric)
  ex_475: 'Keep a straight line from your head to your heels with the plate balanced steady on your back.', // Weighted Plank (Plate on Back)
  ex_531: 'Stand tall inside the trap bar and walk forward with steady, controlled steps.', // Trap Bar Farmer's Walk
  ex_545: 'Raise both ropes overhead together and slam them down hard into the floor at the same time.', // Battle Ropes (Double Slam)
  ex_599: 'Push through your whole foot and stop just short of locking your knees out at the top.', // Horizontal Leg Press Machine
  ex_633: 'Hold the plate at your chest and curl your torso up leading with your chest, not your neck.', // Weighted Sit-Up (Plate-Loaded)
  ex_672: 'Attach extra weight and hang from the bar with arms straight and shoulders relaxed.', // Weighted Dead Hang
  ex_730: 'Sit back onto your heels and reach your arms forward, relaxing your chest toward the floor.', // Child's Pose
  ex_781: 'Lie face down with the roller under your thighs and slowly roll from your hips to your knees.', // Foam Roller Quad Roll
  ex_793: 'Lie back over the ball and curl your shoulders up using your abs, keeping your lower back supported.', // Stability Ball Crunch
  ex_808: 'Keep your elbows pinned to your sides and curl with control, no swinging your back.', // EZ-Bar Curl (Standing)
  ex_826: 'Keep your chest up and squat down until your thighs are at least parallel, then stand back up.', // Weighted Vest Squat
  ex_828: 'Keep a straight line from your head to your heels, bracing your core against the extra weight.', // Weighted Vest Plank
  ex_833: 'Pass the ball around your waist in a circle, keeping your core braced and torso upright.', // Medicine Ball Around the World
  ex_835: 'Keep your back flat and stand up by driving your hips forward as you lift the ball.', // Medicine Ball Deadlift
  ex_849: 'Punch your arm straight out and push your shoulder blade forward at the very end of the reach.', // Serratus Punch (Standing)
  ex_855: 'Pull the rope toward your face, leading with your elbows high and wide.', // Cable Rear Delt Row (Rope)
  ex_860: 'Stand tall inside the trap bar and shrug your shoulders straight up toward your ears.', // Trap Bar Shrug
  ex_866: 'Hinge forward at your hips over the pad, then rise back to level using your lower back and glutes.', // GHD Back Raise
  ex_882: 'Lie on your side with knees bent and open your top arm across your body like a book.', // Open Book Stretch (Thoracic Rotation)
  ex_893: 'Kneel upright and gently arch your back, reaching your hands toward your heels.', // Camel Pose (Ustrasana)
  ex_903: 'Sit tall with legs extended and roll forward through your spine, reaching toward your feet.', // Pilates Spine Stretch Forward
  ex_930: 'From a push-up top position, push your upper back up and round it slightly without bending your elbows.', // Push-Up Plus (Scapular Protraction)
  ex_944: 'Keep an upright posture and step at a steady pace, without leaning on the handrails.', // Step Mill (Stairmaster)
  ex_954: 'Keep your upper arm still and parallel to the floor, extending only at the elbow.', // Dumbbell Triceps Kickback
  ex_960: 'Keep a slight bend in your elbows and bring your hands up and together in front of your face.', // Cable Crossover (Low-to-High)
  ex_968: 'Extend one leg until it’s straight, then lower back down slowly without kicking.', // Single-Leg Leg Extension (Machine)
  ex_977: 'Keep your elbow pinned to your side and curl one arm at a time with control.', // Alternating Dumbbell Curl
  ex_985: 'Stand on one leg off the edge of a step and drop your other hip down, then lift it back up using your standing-side hip.', // Hip Hike
  ex_990: 'Keep a slight bend in your elbows and lower the bar behind your head, then pull it back over your chest.', // Barbell Pullover
  ex_1002: 'Press two plates together at your chest, then extend your arms straight out and back, keeping the squeeze the whole time.', // Svend Press (Plate Press)
  ex_1016: 'Hold something for balance and swing one leg forward and back in a controlled arc.', // Leg Swing (Front-to-Back)
  ex_1020: 'Kick one leg straight up in front of you, reaching the opposite hand toward your toes, then alternate.', // High Kicks (Standing)
  ex_1022: 'Lie face down and alternate raising opposite arm and leg in a small, steady flutter.', // Swimmers
  ex_1030: 'Stand sideways to the cable and bend at your waist away from the machine, then return to upright.', // Cable Side Bend
  ex_1032: 'Keep your arms straight and raise the plate in front of you to about shoulder height, then lower with control.', // Plate Front Raise
  ex_1035: 'Grip the handles with palms facing you and pull your chin over the bar with control.', // Assisted Chin-Up Machine
  ex_1038: 'Sit on the ball and roll slowly over your glute, pausing on any tender spots.', // Lacrosse Ball Glute Release
  ex_1044: 'Keep your leg straight and lift it a few inches off the floor, then lower with control.', // Ankle Weight Straight Leg Raise (Lying)
  ex_1061: 'Prop up on your forearms with your hips down, gently lifting your chest.', // Sphinx Pose
  ex_1077: 'Lie face down and lift your chest and legs slightly off the floor, squeezing your glutes and back.', // Locust Pose (Salabhasana)
  ex_1080: 'Rest on your forearms and push your hips up and back, keeping your head relaxed between your arms.', // Dolphin Pose
  ex_1081: 'Lie on your back and hold the outsides of your feet, gently pulling your knees toward the floor.', // Happy Baby Pose
  ex_1083: 'Lie flat on your back with arms and legs relaxed, breathing slowly and staying still.', // Corpse Pose (Savasana)
  ex_1084: 'Step one foot outside your same-side hand and sink your hips down and forward.', // Lizard Pose
  ex_1098: 'Stand with feet wide apart and hinge forward from your hips, letting your head hang.', // Wide-Legged Forward Fold
  ex_1100: 'Kneel and sit back between your heels, keeping your spine tall.', // Hero Pose (Virasana)
  ex_1110: 'Gently draw your chin straight back, like making a double chin, without tilting your head.', // Chin Tuck (Cervical Retraction)
  ex_1112: 'Press your toes down and draw the ball of your foot toward your heel, without curling your toes.', // Short Foot Exercise
  ex_1114: 'Use your toes to pick up small objects one at a time and place them in a cup.', // Marble Pickup
  ex_1130: 'Hold a plate out in front of you with both hands and rotate it side to side like a steering wheel.', // Bus Driver
  ex_1131: 'Pull the cable across your body and up to shoulder height with a slight elbow bend.', // Cross-Body Lateral Raise (Cable)
  ex_1132: 'Lie on the bench and lower the dumbbells to touch over your chest with your elbows flared, then press back up.', // Tate Press
  ex_1133: 'Keep your elbows close to your body and press down through the handles with control.', // Triceps Press Machine
  ex_1138: 'Keeping the weight locked overhead, push through your opposite elbow to prop yourself halfway up from lying down.', // Turkish Get-Up (Half, To Elbow)
  ex_1172: 'Inhale for a count of four, hold for four, exhale for four, hold for four, and repeat.', // Box Breathing
  ex_1194: 'Let your arms hang straight down from the incline bench and curl with control, no swinging.', // Incline Dumbbell Curl
  ex_1199: 'Stand with knees slightly bent on the plate and hold steady, letting the vibration work through your legs.', // Vibration Plate Standing Hold
  ex_1203: 'Sit with legs spread wide and hinge forward from your hips, reaching toward the floor.', // Wide-Angle Seated Forward Bend
  ex_1215: 'Keep your elbows pinned to your sides and curl with an overhand grip, no swinging.', // Cable Reverse Curl
  ex_1217: 'Keep your elbow pinned to your side and extend your arm straight down with control.', // Single-Arm Cable Triceps Pushdown
  ex_1235: 'Lie on your back with one leg raised and trace slow, controlled circles with your foot.', // Pilates Leg Circle
  ex_1238: 'Lie on your back with heels on sliders and pull your heels toward your hips, then slide them back out.', // Sliding Leg Curl
  ex_1239: 'Squeeze a ball between your knees and hold, keeping your hips still.', // Adductor Ball Squeeze (Isometric)
  ex_1261: 'Bend your back knee slightly while leaning into a wall, keeping your heel flat on the floor.', // Bent-Knee Calf Stretch (Soleus Focus)
  ex_1266: 'Lie on your back and pull one knee into your chest, holding it with both hands.', // Wind-Removing Pose (Pavanamuktasana)
  ex_1267: 'Kneel and sit back on your heels, keeping your spine tall and hands resting on your thighs.', // Thunderbolt Pose (Vajrasana)
  ex_1282: 'Kneel with one foot forward and gently rock your knee over your toes without lifting your heel.', // Ankle Rock (Half-Kneeling Dorsiflexion)
  ex_1284: 'Roll a golf ball under your foot with light pressure, working from heel to toes.', // Golf Ball Plantar Fascia Roll
  ex_1294: 'Lower into the bottom of a push-up and hold that position, keeping your body in a straight line.', // Push-Up Bottom Hold (Isometric)
  ex_1319: 'Raise your arm out and slightly forward with your thumb pointing down, only up to shoulder height.', // Empty Can Raise
  ex_1323: 'Rest your feet on a bench and hold a straight line from your head to your heels.', // Feet-Elevated Plank (Decline Plank)
  ex_1333: 'Press the back of your knee into the floor and tighten your thigh muscle, holding for a few seconds.', // Quad Set (Isometric Quadriceps Contraction)
  ex_1336: 'Lie on your back and slide your heel toward your hips by bending your knee, then slide it back out.', // Heel Slide (Supine Active Knee Flexion)
  ex_1338: 'Lean forward and let your arm hang loose, gently swinging it in small circles.', // Codman's Pendulum (Passive Shoulder Swing)
  ex_1344: 'Row the dumbbells up and hold your shoulder blades squeezed together at the top.', // Batwing Row (Isometric Hold)
  ex_1373: 'Hold a dumbbell in each hand at your sides and squat down until your thighs are at least parallel.', // Dumbbell Squat (Sides Hold)
  ex_1376: 'Place your feet wide on the platform and push through your whole foot without locking your knees.', // Leg Press (Wide Stance)
  ex_1387: 'Stand on the plate with knees slightly bent and hold a shallow squat as it vibrates.', // Vibration Plate Squat
  ex_1399: 'Slide down the wall until your knees are at about 90 degrees and hold as long as you can.', // Wall Sit Test (Max Hold Time)
  ex_1411: 'Lie on your back and gently flatten your lower back into the floor by tilting your pelvis.', // Pelvic Tilt (Supine, Posterior)
  ex_1413: 'Close one nostril and inhale, then switch and exhale through the other, alternating slowly.', // Alternate Nostril Breathing
  ex_1416: 'Stand up and sit back down from the chair as many times as you can in 30 seconds.', // 30-Second Chair Stand Test
  ex_1420: 'Hold a side plank with your hips lifted for as long as you can with good form.', // Side Plank Endurance Test (Max Hold Time)
  ex_1451: 'Cradle the bar in the crooks of your elbows and hold it steady against your torso.', // Zercher Hold (Static)
  ex_1452: 'Hold the kettlebell racked at your shoulder and keep your torso upright without leaning.', // Front-Rack Hold (Kettlebell, Static)
  ex_1453: 'Lock the dumbbell out overhead and hold it steady, keeping your ribs down.', // Overhead Hold (Single-Arm Dumbbell, Static)
  ex_1469: 'Hold a plate with both hands and curl it up toward your chest, keeping your elbows steady.', // Plate Curl
  ex_1470: 'Press the plate straight overhead until your arms are extended, then lower with control.', // Plate Overhead Press
  ex_1513: 'Rise onto your toes and hold at the very top, squeezing your calves.', // Isometric Calf Raise (Peak Hold)
  ex_199: 'Walk at a steady, comfortable pace with your posture upright, without leaning on the handrails.', // Treadmill Walking
  ex_201: 'Pedal at a steady cadence with a slight bend in your knee at the bottom of each stroke.', // Stationary Cycling
  ex_203: 'Step at a steady pace using your legs to drive each step, without leaning on the handrails.', // Stair Climber Machine
  ex_233: 'Keep a smooth, steady stride and let your arms move naturally with the handles.', // Elliptical Trainer
  ex_235: 'Pedal and push the handles together at a steady pace, picking up intensity for harder intervals.', // Assault Bike (Air Bike)
  ex_157: 'Shrug your shoulders straight up toward your ears, then lower with control, no rolling.', // Dumbbell Shrug
  ex_187: 'Shrug your shoulders straight up toward your ears, then lower with control, no rolling.', // Barbell Shrug
  ex_178: 'Brace your elbow against your inner thigh and curl the dumbbell up with control.', // Concentration Curl (Dumbbell)
  ex_179: 'Keep your elbows pinned to your sides and curl with control, no swinging.', // Cable Bicep Curl
  ex_156: 'Keep your elbows pointed up and close to your head, lowering the dumbbell behind you with control.', // Dumbbell Overhead Triceps Extension
  ex_142: 'Raise your arms out to the sides only up to shoulder height, then lower with control.', // Seated Machine Lateral Raise
  ex_143: 'Keep a slight bend in your elbows and pull your arms back and apart, squeezing your shoulder blades.', // Reverse Pec Deck (Rear Delt Machine)
  ex_250: 'Cross one ankle over the opposite knee and gently pull that leg toward your chest.', // Figure-4 Glute Stretch
  ex_274: 'Roll the handle with alternating wrist motions to wind the weight up, then control it back down.', // Wrist Roller
  ex_275: 'Squeeze the gripper closed with your whole hand, then release with control.', // Hand Gripper Crush
  ex_290: 'Keep your arm straight and raise the handle in front of you to about shoulder height.', // Cable Front Raise
  ex_302: 'Rise up onto your toes slowly and lower back down with control, not a bounce.', // Standing Calf Raise Machine (Plate-Loaded)
  ex_320: 'Keep a slight bend in your elbow and raise the dumbbell in front of you to about shoulder height.', // Standing Dumbbell Front Raise
  ex_392: 'Lie with the roller across your upper back and gently arch backward over it.', // Thoracic Extension (Foam Roller)
  ex_399: 'Sit with both knees bent at 90 degrees, one in front and one to the side, and lean forward gently.', // 90/90 Hip Stretch
  ex_405: 'Place your hands on the wall and step one foot back, keeping that heel flat and knee straight.', // Standing Calf Stretch (Wall)
  ex_406: 'Pull one arm across your chest with the other arm, holding just above the elbow.', // Cross-Body Shoulder Stretch
  ex_407: 'Reach one arm overhead and bend your elbow, gently pulling it back with your other hand.', // Triceps Overhead Stretch
  ex_421: 'Push the ball explosively from your chest straight out to a wall or partner, then catch it back.', // Medicine Ball Chest Pass
  ex_433: 'Stand on the band and keep your elbows pinned to your sides as you curl with control.', // Band Bicep Curl
  ex_434: 'Anchor the band high and extend your arms straight down, keeping your elbows at your sides.', // Band Triceps Pushdown
  ex_442: 'Face away from the anchor and hinge forward, letting the band pull back between your legs, then drive your hips forward to stand.', // Band Pull-Through
  ex_448: 'Sit or kneel facing the sled and pull the rope hand over hand toward you.', // Sled Row (Rope Pull)
  ex_485: 'Balance on one foot and rise up onto your toes, then lower back down with control.', // Single-Leg Calf Raise (Standing, Bodyweight)
  ex_532: 'Hold the cable handle at your chest for counterbalance and squat down, keeping your heels flat.', // Cable Squat (Counterbalanced)
  ex_558: 'Sit with the band around your feet and pull the handles toward your ribs, squeezing your shoulder blades.', // Seated Resistance Band Row
  ex_560: 'Sit tall with back support and press the dumbbells straight up, then lower with control.', // Seated Dumbbell Overhead Press (Chair-Supported)
  ex_563: 'Sit back in the seat and pedal at a steady, comfortable pace.', // Recumbent Bike Cycling
  ex_591: 'Pull the bar straight up toward your chin, leading with your elbows, keeping it close to your body.', // Cable Upright Row
  ex_597: 'Pull the rope toward your chest at a high angle, driving your elbows back and slightly up.', // Cable High Row (Standing, Rope)
  ex_622: 'Hold the band overhead and pull it apart by squeezing your shoulder blades together.', // Band Overhead Pull-Apart
  ex_625: 'Raise your arms up and out into a Y-shape against the band’s resistance, then lower with control.', // Band Y-Raise (Standing)
  ex_629: 'Loop the band above your knees and drive your hips up while gently pressing your knees outward.', // Band Glute Bridge (Hip Abduction Resisted)
  ex_641: 'Pedal at maximum effort for the sprint interval, then ease off to recover before the next one.', // Bike Sprints (Intervals, Stationary)
  ex_691: 'Walk at a steady pace with the vest on, keeping your posture upright.', // Weighted Vest Walking (Rucking)
  ex_724: 'Press the handles up and forward until your arms are extended, without shrugging your shoulders.', // Incline Chest Press Machine
  ex_728: 'Rotate your wrists slowly in full circles, both directions.', // Wrist Circles (Mobility)
  ex_731: 'Kneel with knees spread wide and gently rock your hips back to stretch your inner thighs.', // Frog Stretch
  ex_734: 'Reach one arm overhead and lean sideways, holding onto something stable if needed.', // Standing Lat Stretch
  ex_736: 'Tilt your head to one side and gently pull it down with your hand, looking toward your armpit.', // Upper Trap Stretch (Levator Scapulae)
  ex_744: 'Turn the hand cranks at a steady pace, keeping your posture upright.', // Arm Ergometer (Hand Cycle)
  ex_746: 'Jog in place, kicking your heels up to touch your glutes each step.', // Butt Kicks
  ex_751: 'Stand on the band and raise your arms out to the sides only up to shoulder height.', // Band Lateral Raise
  ex_765: 'Loop the band above your knees and step up onto the box, keeping tension on the band.', // Band Step-Up
  ex_770: 'On hands and knees with a band above your knees, lift one knee out to the side against the band.', // Band Fire Hydrant
  ex_776: 'Loop the band around a low anchor in front of you and squat down, letting it help pull you into depth.', // Band-Assisted Squat
  ex_782: 'Sit on the roller with legs extended and slowly roll from your glutes to just above your knees.', // Foam Roller Hamstring Roll
  ex_785: 'Lie on your side with the roller under your armpit and slowly roll along your lat.', // Foam Roller Lat Roll
  ex_786: 'Sit on the roller on one glute and slowly roll over the muscle, pausing on tender spots.', // Foam Roller Glute Roll
  ex_790: 'Lie face down with the roller under your hip and slowly roll over the front of your hip.', // Foam Roller Hip Flexor Roll
  ex_819: 'Whip both ropes side to side together in a snake-like wave.', // Battle Rope Snake Waves (Side-to-Side)
  ex_830: 'Wear the vest and drive your knees toward your chest one at a time in a plank position.', // Weighted Vest Mountain Climber
  ex_836: 'Turn your head to one side while gently resisting with your hand, then switch sides.', // Neck Rotation (Manual Resistance)
  ex_904: 'Sit tall with legs apart and rotate your torso, reaching one hand toward the opposite foot.', // Pilates Saw
  ex_949: 'Hold the band and tilt your wrist toward your pinky side, then return with control.', // Wrist Ulnar Deviation (Band)
  ex_1017: 'Hold something for balance and swing one leg side to side across your body.', // Leg Swing (Lateral)
  ex_1023: 'Lie on your back with one hand on your belly and breathe so your belly rises, not your chest.', // Supine Diaphragmatic Breathing
  ex_1024: 'Place your palm flat on the wall behind you and gently turn your body away.', // Biceps Stretch (Wall)
  ex_1039: 'Lie on the ball between your shoulder blades and gently roll, pausing on tight spots.', // Lacrosse Ball Upper Back Release
  ex_1040: 'Stand and roll the ball under your foot with light pressure, from heel to toes.', // Lacrosse Ball Plantar Release
  ex_1043: 'Lie on your side and lift your top leg straight up against the ankle weight.', // Ankle Weight Side-Lying Hip Abduction
  ex_1046: 'Stand tall and lift your knee up in front of you against the ankle weight, then lower with control.', // Ankle Weight Standing Hip Flexion
  ex_1048: 'Keep a smooth, steady stride and let your arms move naturally with the handles.', // Arc Trainer
  ex_1072: 'Walk through the water at a steady pace, letting the resistance work your legs.', // Water Walking (Pool)
  ex_1074: 'Jump your feet out and arms up in the water, then back to start, using the resistance.', // Water Aerobics Jumping Jacks
  ex_1085: 'Stack one shin on top of the other, sitting tall, and lean forward gently.', // Fire Log Pose
  ex_1092: 'Kneel and extend one leg out to the side, then reach overhead and lean toward your extended leg.', // Gate Pose
  ex_1099: 'Keep your hips over your knees and walk your hands forward, lowering your chest toward the floor.', // Puppy Pose
  ex_1103: 'Lie on your back with the soles of your feet together and knees relaxed open.', // Reclining Bound Angle Pose
  ex_1107: 'Sit and hold one ankle and knee, gently rocking your leg like a cradle.', // Cradle Stretch
  ex_1109: 'Lie back over a cushion or block under your shoulder blades, letting your chest open.', // Supported Fish Pose
  ex_1111: 'Spread your toes apart, then lift just your big toe while keeping the others down.', // Toe Yoga (Toe Splay and Extension)
  ex_1127: 'Hinge forward slightly and shrug your shoulders back and down, squeezing your shoulder blades.', // Kelso Shrug
  ex_1129: 'Pull your elbows down and back into a W shape, then press up slightly, squeezing your shoulder blades.', // W Press
  ex_955: 'Keep your upper arm still and parallel to the floor, extending only at the elbow.', // Cable Triceps Kickback
  ex_146: 'Gently tilt your head to one side and let your opposite shoulder drop, holding the stretch.', // Neck and Shoulder Release
  ex_147: 'Sit tall with one hand on your belly and breathe so your belly rises, not your chest.', // Seated Diaphragmatic Breathing
  ex_148: 'Sit tall and rotate your torso to one side, holding onto the chair for a gentle twist.', // Seated Spinal Twist
  ex_149: 'Reach one arm overhead and lean sideways at your waist, feeling a stretch along your side.', // Standing Side Reach
  ex_150: 'Anchor the band behind you and lift your knee up in front against the resistance.', // Standing Band Hip Flexion
  ex_151: 'Rest your forearm on your thigh and curl the dumbbell up using just your wrist.', // Dumbbell Wrist Curl
  ex_153: 'Anchor the band behind you and press your hands forward until your arms are extended.', // Standing Resistance Band Chest Press
  ex_155: 'Hold a dumbbell and balance on one foot, rising onto your toes with control.', // Single-Leg Dumbbell Calf Raise
  ex_166: 'Keep your arms straight and pull the bar down toward your thighs using your lats.', // Straight-Arm Cable Pulldown
  ex_184: 'Rise up onto your toes slowly and lower back down with control, not a bounce.', // Standing Barbell Calf Raise (Machine)
  ex_227: 'Anchor the band overhead and pull it down toward your chest, driving your elbows down and back.', // Band Lat Pulldown
  ex_232: 'Face the sled, grip the straps, and walk backward, pulling it toward you with steady steps.', // Sled Drag (Reverse)
  ex_234: 'Walk at a steady pace on the incline, keeping your posture upright without holding the rails.', // Incline Treadmill Walk
  ex_252: 'Keep your elbow at your side and rotate your forearm outward against the cable.', // Cable External Rotation
  ex_256: 'Raise the dumbbells at an angle between the front and side, thumbs up, only to shoulder height.', // Dumbbell Scaption (Y-Raise)
  ex_257: 'Lean against the wall and lift your toes up toward your shins, keeping your heels down.', // Standing Wall Tibialis Raise
  ex_260: 'Place your hand on your forehead and gently nod forward against your own resistance.', // Manual Resistance Neck Flexion
  ex_262: 'Sit tall and tilt your ear toward your shoulder, gently pulling with your hand.', // Seated Neck Lateral Flexion Stretch
  ex_273: 'Drape a towel over the bar and hang from it, gripping with your whole hand.', // Towel Pull-Up Hang
  ex_255: 'Lie on your side with your elbow tucked and rotate the dumbbell up, keeping your elbow at your ribs.', // Side-Lying Dumbbell External Rotation
};

export type ExerciseCue = { kind: 'full'; cue: FormCue } | { kind: 'simple'; cue: string };

/**
 * The one lookup both the exercise-list tap-to-expand rows and the live
 * ExerciseTimer view use — checks FORM_CUES first, then SIMPLE_CUES, and
 * returns null (not a placeholder) when neither has this id yet. Callers
 * use null to hide the expand affordance entirely rather than showing an
 * empty or "coming soon" expansion — given current coverage (a first
 * batch of each tier, not the full library), most exercises don't have
 * cue content yet, and that should read as no affordance, never a broken one.
 */
export function getCueFor(id: string): ExerciseCue | null {
  const full = FORM_CUES[id];
  if (full) return { kind: 'full', cue: full };
  const simple = SIMPLE_CUES[id];
  if (simple) return { kind: 'simple', cue: simple };
  return null;
}
