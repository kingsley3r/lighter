import { EXERCISES } from './exercises'

export type Muscle =
  | 'chest' | 'front_delts' | 'side_delts' | 'rear_delts' | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques' | 'traps' | 'lats' | 'upper_back' | 'lower_back'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'calves'

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest', front_delts: 'Front shoulders', side_delts: 'Side shoulders', rear_delts: 'Rear shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  abs: 'Abs', obliques: 'Obliques', traps: 'Traps', lats: 'Lats', upper_back: 'Upper back', lower_back: 'Lower back',
  glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings', adductors: 'Inner thighs', calves: 'Calves',
}

/** Movement used by the animated figure */
export type Anim =
  | 'squat' | 'hinge' | 'swing' | 'bridge' | 'lunge' | 'stepup' | 'pushup' | 'floorpress' | 'press' | 'ohp' | 'pikepush'
  | 'row' | 'invrow' | 'pullup' | 'pulldown' | 'superman' | 'plank' | 'sideplank' | 'deadbug' | 'kneeraise' | 'climber'
  | 'walk' | 'jacks' | 'bike' | 'rower' | 'rope'

export interface Guide { primary: Muscle[]; secondary: Muscle[]; anim: Anim; steps: string[]; mistakes: string[]; breathe: string }

const G = (primary: Muscle[], secondary: Muscle[], anim: Anim, steps: string[], mistakes: string[], breathe = 'Breathe in on the way down, out as you push.'): Guide => ({ primary, secondary, anim, steps, mistakes, breathe })

const SQUAT = (hold: string) => G(['quads', 'glutes'], ['adductors', 'hamstrings', 'lower_back', 'abs'], 'squat', [
  `Stand with feet shoulder-width apart, toes turned out slightly. ${hold}`,
  'Brace your belly like you’re about to be poked, chest up.',
  'Sit down and back between your heels until thighs are at least parallel.',
  'Push the floor away and stand tall, squeezing your glutes at the top.',
], ['Knees caving inward', 'Heels lifting off the floor', 'Rounding the lower back at the bottom'])

const GUIDES: Record<string, Guide> = {
  bw_squat: SQUAT('Arms reach forward for balance.'),
  goblet_squat_db: SQUAT('Hold one dumbbell vertically against your chest.'),
  goblet_squat_kb: SQUAT('Hold the kettlebell by the horns against your chest.'),
  back_squat: SQUAT('Bar rests on your upper back, not on your neck.'),
  band_squat: SQUAT('Stand on the band, handles at your shoulders.'),
  glute_bridge: G(['glutes'], ['hamstrings', 'lower_back', 'abs'], 'bridge', [
    'Lie on your back, knees bent, feet flat and hip-width apart.',
    'Press your lower back gently into the floor.',
    'Drive through your heels and lift your hips until knees, hips and shoulders line up.',
    'Squeeze your glutes for one second, then lower with control.',
  ], ['Arching the lower back at the top', 'Pushing through the toes', 'Rushing the lowering'], 'Breathe out as you lift, in as you lower.'),
  db_rdl: G(['hamstrings', 'glutes'], ['lower_back', 'forearms', 'upper_back'], 'hinge', [
    'Stand tall holding the dumbbells in front of your thighs.',
    'Unlock your knees slightly and keep them there.',
    'Push your hips back, sliding the weights down your legs with a flat back.',
    'Stop when you feel a strong stretch in the hamstrings, then drive the hips forward to stand.',
  ], ['Rounding the back', 'Turning it into a squat', 'Letting the weights drift away from the legs']),
  kb_swing: G(['glutes', 'hamstrings'], ['lower_back', 'abs', 'forearms', 'front_delts'], 'swing', [
    'Feet a bit wider than shoulders, bell on the floor in front of you.',
    'Hike the bell back between your legs like a football snap.',
    'Snap your hips forward hard so the bell floats to chest height.',
    'Let it fall back, hinge at the hips and repeat in a smooth rhythm.',
  ], ['Lifting with the arms', 'Squatting instead of hinging', 'Leaning back at the top'], 'Short sharp breath out at every hip snap.'),
  bb_deadlift: G(['glutes', 'hamstrings', 'lower_back'], ['quads', 'traps', 'forearms', 'lats'], 'hinge', [
    'Bar over your mid-foot, shins close to the bar.',
    'Grip just outside your legs, pull your shoulders down to tighten your back.',
    'Push the floor away, keeping the bar close to your legs.',
    'Stand tall, then lower by pushing the hips back first.',
  ], ['Jerking the bar off the floor', 'Rounding the back', 'Hyperextending at the top']),
  band_good_morning: G(['hamstrings', 'glutes'], ['lower_back'], 'hinge', [
    'Stand on the band and loop it behind your neck.',
    'Soft knees, tall chest.',
    'Hinge forward at the hips until your torso is nearly parallel to the floor.',
    'Drive the hips forward to stand.',
  ], ['Rounding the back', 'Bending the knees too much']),
  reverse_lunge: G(['quads', 'glutes'], ['hamstrings', 'adductors', 'calves'], 'lunge', [
    'Stand tall, feet hip-width apart.',
    'Take a long step back and lower until both knees are at about 90°.',
    'Keep most of your weight on the front heel.',
    'Push through the front foot to return to standing, then switch legs.',
  ], ['Front knee collapsing inward', 'Short steps', 'Leaning far forward']),
  db_lunge: G(['quads', 'glutes'], ['hamstrings', 'adductors', 'forearms'], 'lunge', [
    'Hold the dumbbells at your sides.',
    'Step forward with a long stride and drop the back knee toward the floor.',
    'Push through the front heel and bring the back foot forward into the next step.',
    'Keep the torso upright the whole time.',
  ], ['Back knee slamming the floor', 'Narrow, tightrope stance']),
  split_squat: G(['quads', 'glutes'], ['adductors', 'hamstrings'], 'lunge', [
    'Stand about a stride in front of a bench, back foot laces-down on it.',
    'Lower straight down until the front thigh is parallel.',
    'Keep the front heel planted.',
    'Drive up through the front leg. Finish all reps, then switch.',
  ], ['Standing too close to the bench', 'Pushing off the back foot']),
  step_up: G(['quads', 'glutes'], ['hamstrings', 'calves'], 'stepup', [
    'Place one whole foot on a sturdy step or chair.',
    'Lean slightly forward and push through that heel.',
    'Stand up fully on the step without pushing off the floor leg.',
    'Lower slowly. Finish one side, then switch.',
  ], ['Bouncing off the bottom foot', 'Using a wobbly surface']),
  pushup: G(['chest', 'triceps'], ['front_delts', 'abs'], 'pushup', [
    'Hands slightly wider than shoulders, body in one straight line from head to heels.',
    'Squeeze glutes and brace your belly.',
    'Lower your chest toward the floor, elbows at about 45° from your body.',
    'Press the floor away until arms are straight. Knees down is fine.',
  ], ['Hips sagging', 'Elbows flared straight out', 'Half reps']),
  db_floor_press: G(['chest', 'triceps'], ['front_delts'], 'floorpress', [
    'Lie on the floor, knees bent, a dumbbell in each hand above your chest.',
    'Lower until your upper arms touch the floor.',
    'Pause briefly without relaxing.',
    'Press back up and squeeze the chest.',
  ], ['Slamming elbows into the floor', 'Elbows flared at 90°']),
  db_bench: G(['chest', 'triceps'], ['front_delts'], 'floorpress', [
    'Lie on the bench, feet flat, shoulder blades pinched together.',
    'Start with the dumbbells above your chest.',
    'Lower them to the sides of your chest under control.',
    'Press up and slightly together.',
  ], ['Bouncing the weights', 'Lifting the hips off the bench']),
  bb_bench: G(['chest', 'triceps'], ['front_delts'], 'floorpress', [
    'Eyes under the bar, feet planted, shoulder blades pinched.',
    'Unrack and hold the bar over your shoulders.',
    'Lower to your lower chest with elbows at about 45°.',
    'Press up and back toward the rack position.',
  ], ['Bouncing off the chest', 'Wrists bent back']),
  band_chest_press: G(['chest', 'triceps'], ['front_delts'], 'press', [
    'Anchor the band behind you at chest height.',
    'Stagger your feet and hold the handles at your chest.',
    'Press forward until arms are straight.',
    'Return slowly.',
  ], ['Letting the band snap back', 'Shrugging the shoulders']),
  cable_press: G(['chest', 'triceps'], ['front_delts'], 'press', [
    'Set the cables at chest height, stand in a split stance.',
    'Handles at your chest, elbows slightly below shoulders.',
    'Press forward and slightly together.',
    'Return slowly.',
  ], ['Leaning far forward', 'Rushing the return']),
  pike_pushup: G(['front_delts', 'triceps'], ['side_delts', 'chest', 'abs'], 'pikepush', [
    'Start in a push-up position and walk your feet in so your hips are high.',
    'Hands shoulder-width, head between your arms.',
    'Bend the elbows and lower the top of your head toward the floor.',
    'Press back up.',
  ], ['Hips dropping', 'Elbows flaring wide']),
  db_ohp: G(['front_delts', 'side_delts', 'triceps'], ['traps', 'abs'], 'ohp', [
    'Stand tall, dumbbells at shoulder height, palms forward.',
    'Squeeze glutes and pull your ribs down.',
    'Press straight up until arms are locked out.',
    'Lower to the shoulders with control.',
  ], ['Leaning back', 'Pressing forward instead of up'], 'Breathe in at the bottom, out as you press.'),
  kb_press: G(['front_delts', 'side_delts', 'triceps'], ['traps', 'abs'], 'ohp', [
    'Bell resting on the back of your forearm at the shoulder.',
    'Brace and squeeze the handle.',
    'Press up until your arm is straight beside your ear.',
    'Lower back to the rack position.',
  ], ['Wrist bent back', 'Leaning sideways']),
  band_ohp: G(['front_delts', 'side_delts', 'triceps'], ['traps'], 'ohp', [
    'Stand on the band, handles at shoulder height.',
    'Brace your belly.',
    'Press overhead.',
    'Lower slowly.',
  ], ['Arching the lower back']),
  towel_row: G(['upper_back', 'lats', 'biceps'], ['rear_delts', 'forearms', 'abs'], 'invrow', [
    'Hold the edge of a sturdy table and slide underneath, body straight.',
    'Heels on the floor, hips up.',
    'Pull your chest to the table edge, squeezing your shoulder blades.',
    'Lower with control.',
  ], ['Hips sagging', 'Using an unstable table']),
  db_row: G(['lats', 'upper_back'], ['biceps', 'rear_delts', 'forearms'], 'row', [
    'One hand and knee on a bench or chair, flat back.',
    'Let the dumbbell hang under your shoulder.',
    'Pull the elbow back toward your hip.',
    'Lower slowly until the arm is straight.',
  ], ['Twisting the torso', 'Shrugging the shoulder up']),
  kb_row: G(['lats', 'upper_back'], ['biceps', 'rear_delts', 'forearms'], 'row', [
    'Hinge forward with a flat back.',
    'Kettlebell hangs under your shoulder.',
    'Row it to your hip.',
    'Lower with control.',
  ], ['Rounding the back']),
  band_row: G(['upper_back', 'lats'], ['biceps', 'rear_delts'], 'row', [
    'Anchor the band at chest height and step back.',
    'Arms straight, chest tall.',
    'Pull the handles to your ribs and squeeze your shoulder blades.',
    'Return slowly.',
  ], ['Leaning back to pull']),
  cable_row: G(['upper_back', 'lats'], ['biceps', 'rear_delts'], 'row', [
    'Sit tall with knees slightly bent.',
    'Reach forward without rounding.',
    'Pull the handle to your belly, elbows close.',
    'Return slowly.',
  ], ['Rocking the torso']),
  bb_row: G(['upper_back', 'lats'], ['biceps', 'rear_delts', 'lower_back'], 'row', [
    'Hinge to about 45° with a flat back.',
    'Bar hangs at arm’s length.',
    'Pull it to your belly button.',
    'Lower with control.',
  ], ['Standing up with each rep', 'Rounding the back']),
  pullup: G(['lats', 'biceps'], ['upper_back', 'rear_delts', 'forearms', 'abs'], 'pullup', [
    'Hang from the bar, hands just wider than shoulders.',
    'Pull your shoulder blades down first.',
    'Pull your chest toward the bar.',
    'Lower all the way. No pull-up yet? Jump to the top and lower for 4 s.',
  ], ['Kipping and swinging', 'Half reps'], 'Breathe out as you pull, in as you lower.'),
  band_pulldown: G(['lats'], ['biceps', 'upper_back'], 'pulldown', [
    'Anchor the band high and kneel or stand facing it.',
    'Arms straight up.',
    'Pull your elbows down to your ribs.',
    'Return slowly.',
  ], ['Pulling with the hands instead of the elbows']),
  cable_pulldown: G(['lats'], ['biceps', 'upper_back'], 'pulldown', [
    'Sit with thighs under the pad, grip wider than shoulders.',
    'Lean back slightly.',
    'Pull the bar to your upper chest.',
    'Let it rise slowly.',
  ], ['Pulling behind the neck', 'Leaning way back']),
  superman: G(['lower_back', 'glutes'], ['upper_back', 'hamstrings', 'rear_delts'], 'superman', [
    'Lie face down, arms stretched forward.',
    'Lift arms, chest and legs a few centimetres off the floor.',
    'Hold while squeezing glutes and back.',
    'Lower and relax briefly.',
  ], ['Cranking the neck up', 'Holding the breath'], 'Keep breathing slowly during the hold.'),
  plank: G(['abs'], ['obliques', 'front_delts', 'glutes'], 'plank', [
    'Forearms on the floor, elbows under shoulders.',
    'Step your feet back, body in one line.',
    'Squeeze your glutes and pull your belly button in.',
    'Hold without letting the hips sag or pike up.',
  ], ['Hips sagging', 'Looking up'], 'Keep breathing slowly during the hold.'),
  dead_bug: G(['abs'], ['obliques'], 'deadbug', [
    'Lie on your back, arms to the ceiling, knees bent at 90° above your hips.',
    'Press your lower back into the floor.',
    'Slowly extend the opposite arm and leg toward the floor.',
    'Return and switch sides.',
  ], ['Lower back lifting off the floor', 'Moving too fast'], 'Breathe out as you extend.'),
  side_plank: G(['obliques'], ['abs', 'glutes', 'side_delts'], 'sideplank', [
    'Lie on your side, elbow under your shoulder.',
    'Stack your feet and lift your hips.',
    'Make a straight line from head to feet.',
    'Hold, then switch sides.',
  ], ['Hips dropping', 'Rolling forward'], 'Keep breathing slowly during the hold.'),
  hanging_knee: G(['abs'], ['obliques', 'forearms', 'lats'], 'kneeraise', [
    'Hang from the bar with straight arms.',
    'Brace to stop swinging.',
    'Curl your knees and pelvis up toward your chest.',
    'Lower slowly.',
  ], ['Swinging', 'Only lifting the knees without curling the pelvis']),
  mountain_climber: G(['abs'], ['quads', 'front_delts', 'obliques'], 'climber', [
    'Start in a high plank, hands under shoulders.',
    'Drive one knee toward your chest.',
    'Switch legs quickly, like running in place.',
    'Keep the hips low and steady.',
  ], ['Hips bouncing high', 'Hands drifting forward'], 'Breathe steadily, don’t hold it.'),
  brisk_walk: G(['quads', 'calves', 'glutes'], ['hamstrings'], 'walk', [
    'Stand tall and look ahead.',
    'Swing your arms naturally.',
    'Walk at a pace where you can talk but not sing.',
    'Keep it going for the whole time.',
  ], ['Strolling too slowly']),
  circuit_cardio: G(['calves', 'quads'], ['side_delts', 'abs'], 'jacks', [
    'Jumping jacks: jump feet out while arms go overhead.',
    'Jump back together.',
    'Switch to high knees: run in place, knees to hip height.',
    'Low-impact option: step instead of jumping.',
  ], ['Landing on flat feet']),
  treadmill_incline: G(['glutes', 'calves', 'hamstrings'], ['quads'], 'walk', [
    'Set 8–12 % incline at about 5 km/h.',
    'Walk tall, let go of the rails.',
    'Short steps, push through the whole foot.',
    'Slow down if you need the rails.',
  ], ['Holding the rails']),
  bike_intervals: G(['quads', 'glutes'], ['calves', 'hamstrings'], 'bike', [
    'Set the seat so your knee is slightly bent at the bottom.',
    'Warm up 3–5 minutes easy.',
    'Hard: pedal fast against resistance so you can’t talk.',
    'Easy: spin lightly until you’ve fully recovered.',
  ], ['Seat too low', 'Hard parts not hard enough']),
  row_steady: G(['lats', 'quads', 'upper_back'], ['glutes', 'biceps', 'hamstrings'], 'rower', [
    'Feet strapped in, shins vertical, arms straight.',
    'Push with the legs first.',
    'Then lean back slightly and pull the handle to your lower ribs.',
    'Return: arms, body, then knees.',
  ], ['Pulling with the arms first', 'Hunching the back']),
  jump_rope: G(['calves'], ['quads', 'forearms', 'side_delts'], 'rope', [
    'Elbows close to your sides.',
    'Turn the rope with your wrists.',
    'Small jumps on the balls of your feet.',
    'Land softly.',
  ], ['Jumping too high', 'Big arm circles']),
}

export function guideFor(id: string): Guide | null {
  return GUIDES[id] ?? null
}

/** Find an exercise by its id or its exact name (logs only keep names). */
export function exerciseByName(name: string) {
  return EXERCISES.find((e) => e.id === name || e.name === name) ?? null
}
