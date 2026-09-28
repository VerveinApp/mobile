#!/usr/bin/env node
/**
 * Builds src/lib/engine/data/exercise-equipment.json: for every exercise in
 * the library, what equipment it actually needs, so the engine can plan
 * around what someone owns rather than the library's own three-tier
 * `equipment` field (none / minimal / full_gym), which can't tell a
 * dumbbell move from a barbell one.
 *
 * Each entry is a list of alternatives, any one of which is enough; each
 * alternative is the set of items it needs together. `[]` (no entry) means
 * nothing at all. 'gym' stands for anything outside the home list below
 * (cables, machines, sleds, climbing walls, reformers…) — only a full gym
 * satisfies it.
 *
 *   goblet squat         → [["dumbbell"], ["kettlebell"]]
 *   incline dumbbell row → [["dumbbell", "bench"]]
 *
 * Names are read with ordered rules, then OVERRIDES settles everything a
 * name doesn't say plainly (reviewed by hand, exercise by exercise). An
 * equipped exercise the rules can't place and no override covers fails the
 * build, so a new library entry can never slip through untagged.
 *
 * Run: node scripts/tag-exercise-equipment.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIBRARY = path.join(ROOT, 'src/lib/engine/data/exercise-library.json');
const OUT = path.join(ROOT, 'src/lib/engine/data/exercise-equipment.json');

// Things that make a move doable with no kit at all — "(Bodyweight)" in a
// name wins over anything else the name mentions.
const BODYWEIGHT = /\bbodyweight\b|\(no load\)|chair-based|\bchair\b|\btowel\b|\bwall\b|doorway|\bstairs?\b|broomstick|\bpvc\b|dowel|\bstick\b|yoga (block|strap)|\bstrap\b|slider|gliding disc|valslide|partner/;

// Gym-only kit: naming any of these settles it, whatever else is named.
const GYM_KIT =
  /\bcable|pulley|machine|smith|belt squat|\bghd\b|t-bar|sled|prowler|\btire\b|\bkeg\b|atlas stone|\byoke\b|log (clean|press)|\baxle\b|slosh|sandbag|battle rope|heavy bag|speed bag|double-end bag|reformer|cadillac|pilates (chair|ring)|wunda|climbing|\bclimb\b|boulder|campus board|fingerboard|hangboard|peg ?board|agility ladder|reaction ball|\bpool\b|aqua|water (aerobics|walking|jogging|running)|swim|indian club|\bmace\b|clubbell|bulgarian bag|inversion table|vibration plate|balance board|wobble board|bosu|trampoline|rebounder|parallette|dip (station|bars?)|parallel bars?|\bdips?\b(?!.*(bench|chair|hip))|ab (wheel|roller)|weight(ed)? vest|ankle weights?|wrist weights?|\bchains?\b|bamboo bar|trap bar|hex bar|safety (squat )?bar|cambered|swiss bar|football bar|landmine|jammer|viking press|captain.?s chair|roman chair|power tower|isokinetic|leg sled|jacob.?s ladder|keiser|punching|boxing bag|\bmitts?\b|pads? drill|kick shield|rope climb|rope pull|tug-of-war|hand ?cycle|arm ergometer|upper body ergometer|massage table|physio table|plinth|blood flow restriction|\bbfr\b/;

// Moves usually done on gym stations — gym-only unless the name says what
// home kit does it instead ("Band Lat Pulldown", "Stability Ball Back
// Extension", "Band-Assisted Pull-Up").
const GYM_MOVES =
  /leg press|lat pull-?down|pec deck|hack squat|leg extension|(lying|seated|prone) (leg|hamstring) curl|reverse hyper|glute[- ]ham|preacher|assisted (pull|chin|dip)|hyperextension|back extension|45-degree|nordic|gymnastic|pommel|wheelchair/;

const CARDIO = /rower|rowing machine|\berg\b|ski ?erg|air bike|assault bike|stationary bike|spin bike|exercise bike|\bbike\b|\bcycling\b|treadmill|elliptical|stair ?(master|climber)|versaclimber|arc trainer|recumbent/;

const RULES = [
  // [pattern, requirement alternatives]
  [/dumbbell|\bdb\b/, [['dumbbell']]],
  [/kettlebell|\bkb\b/, [['kettlebell']]],
  [/barbell|\bbb\b|\bez[- ]?(bar|curl)|olympic (lift|bar)/, [['barbell']]],
  [/resistance band|\bbands?\b|\bbanded\b|mini-?band|loop band|\btubing\b/, [['band']]],
  [/pull-?up|chin-?up|\bhanging\b|dead ?hang|toes[- ]to[- ]bar|muscle-?up|knees to elbows|flexed[- ]arm hang|front lever|back lever|skin the cat|scapular pull/, [['pullup_bar']]],
  [/\btrx\b|suspension|\brings?\b(?! finger)|inverted row|australian pull/, [['suspension']]],
  [/medicine ball|med ball|slam ball|wall ball|ball slam|\bmb\b/, [['medball']]],
  [/stability ball|swiss ball|physio ball|exercise ball|stir the pot|ball (hamstring curl|pike|rollout|crunch|pass|wall squat)/, [['stability_ball']]],
  [/foam roll|lacrosse ball|massage ball|tennis ball|peanut ball|massage gun|percussion|\broller\b/, [['foam_roller']]],
  [/jump rope|skipping rope|double[- ]unders?|rope skip|skipping\b/, [['cardio']]],
  [/box jump|plyo box|depth (jump|drop|push)|box (squat|pistol|drop)|box jump over|single-leg box/, [['box']]],
  // A step-up just needs something sturdy to step onto.
  [/step-?ups?\b|step up|step-?downs?\b|\bbox\b(?! breathing|.*(jump|squat|pistol|drop))|platform/, [['box'], ['bench']]],
  // Implied loads (third element true): only when the name doesn't name one.
  [/goblet|farmer|suitcase carry|waiter.?s? (walk|carry)|overhead carry|rack(ed)? carry|front[- ]rack carry/, [['dumbbell'], ['kettlebell']], true],
  [/\bswings?\b(?!.*(leg|arm|pendulum))|turkish get|\bwindmill\b|halo\b/, [['kettlebell'], ['dumbbell']], true],
  [/power clean|hang clean|squat clean|muscle clean|block clean|clean (and|&) (jerk|press)|clean pull|clean high pull|snatch(?!.*(dumbbell|kettlebell))|\bjerk\b|push press(?!.*(dumbbell|kettlebell))|back squat|front squat|overhead squat|zercher|pendlay|yates row|meadows row|bradford press|guillotine press|jm press|good ?morning(?!.*band)|rack pull|pin press|floor press(?!.*(dumbbell|kettlebell))|sumo deadlift|conventional deadlift|deficit deadlift|speed (squat|row|pull|deadlift)|dynamic effort|isometric (mid-thigh|squat \(pins)/, [['barbell']], true],
];

const LOADS = /dumbbell|\bdb\b|kettlebell|\bkb\b|barbell|\bbb\b|\bez[- ]?(bar|curl)/;

// Requirement adders — combine with whatever else the name needs.
const PLUS_BENCH = /\bbench\b(?! dip)|incline|decline|chest-supported|seal row|prone (incline|row|y|t)|lying (dumbbell|db|barbell|tricep|triceps) (extension|fly|pullover)|pullover|skull ?crusher|hip thrust/;

/** Hand-reviewed decisions for names the rules can't read, and fixes where
 * a rule reads a name wrong. Keyed by exercise id; value as in the output. */
const OVERRIDES = require('./exercise-equipment-overrides.json');

function uniqSorted(list) {
  return [...new Set(list)].sort();
}

function combine(a, b) {
  // Cross product of two alternative lists: every way to satisfy both.
  const out = [];
  for (const x of a) for (const y of b) out.push(uniqSorted([...x, ...y]));
  return dedupe(out);
}

function dedupe(alts) {
  const seen = new Set();
  const out = [];
  for (const alt of alts) {
    const key = alt.join('+');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(alt);
    }
  }
  return out;
}

function tag(ex) {
  if (Object.prototype.hasOwnProperty.call(OVERRIDES, ex.id)) return { req: OVERRIDES[ex.id], how: 'override' };
  const name = ex.name.toLowerCase().replace(/\bit band\b/g, 'iliotibial');
  if (ex.equipment === 'none' && !/pull-?up|chin-?up/.test(name)) return { req: [], how: 'bodyweight tier' };
  if (CARDIO.test(name)) return { req: [['cardio']], how: 'cardio' };
  if (GYM_KIT.test(name)) return { req: [['gym']], how: 'gym' };

  let req = null;
  const namesALoad = LOADS.test(name);
  for (const [pattern, alts, implied] of RULES) {
    // A load the name spells out ("Dumbbell Goblet Squat") settles what's
    // lifted; the implied-load rules only speak for names that don't say.
    if (implied && namesALoad) continue;
    if (!pattern.test(name)) continue;
    req = req === null ? alts : combine(req, alts);
  }
  if (req !== null) {
    // Two weights named as options ("Dumbbell or Kettlebell Swing") are
    // either one, not both.
    if (/(dumbbell|kettlebell)( or |\/)(dumbbell|kettlebell)/.test(name)) req = [['dumbbell'], ['kettlebell']];
    if (PLUS_BENCH.test(name) && !req.some((alt) => alt.includes('bench') || alt.includes('box'))) req = combine(req, [['bench']]);
    return { req: dedupe(req), how: 'rules' };
  }
  if (GYM_MOVES.test(name)) return { req: [['gym']], how: 'gym move' };
  // Only once nothing above found kit: "(Bodyweight)", a wall, a chair, a
  // towel… — never for a name that's loaded.
  if (BODYWEIGHT.test(name) && !/weighted/.test(name)) return { req: [], how: 'bodyweight name' };
  return { req: null, how: 'unknown' };
}

function main() {
  const library = JSON.parse(fs.readFileSync(LIBRARY, 'utf8'));
  const out = {};
  const unknown = [];
  const report = process.argv.includes('--report');
  for (const ex of library) {
    const { req, how } = tag(ex);
    if (req === null) {
      unknown.push(`${ex.id}\t${ex.equipment}\t${ex.name}`);
      continue;
    }
    if (report) console.log(`${how}\t${ex.equipment}\t${ex.id}\t${ex.name}\t${JSON.stringify(req)}`);
    // Equipped-tier entries are written even when empty, so "reviewed: needs
    // nothing" and "never tagged" stay distinguishable at runtime.
    if (req.length > 0 || ex.equipment !== 'none') out[ex.id] = req;
  }
  if (unknown.length > 0) {
    console.error(`${unknown.length} equipped exercise(s) need an override:\n${unknown.join('\n')}`);
    process.exit(1);
  }
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"').replace(/^\{/, '{\n')}\n`);
  if (!report) console.log(`Wrote ${Object.keys(out).length} requirements to ${path.relative(ROOT, OUT)}`);
}

main();
