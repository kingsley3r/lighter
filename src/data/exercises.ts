import type { PlannedExercise, PlannedWorkout, WorkoutPlan } from '../lib/types'

export const EQUIPMENT: { id: string; label: string; emoji: string }[] = [
  { id: 'dumbbells', label: 'Dumbbells', emoji: '' },
  { id: 'kettlebell', label: 'Kettlebell', emoji: '' },
  { id: 'barbell', label: 'Barbell + rack', emoji: '' },
  { id: 'bench', label: 'Bench', emoji: '' },
  { id: 'pull_up_bar', label: 'Pull-up bar', emoji: '' },
  { id: 'bands', label: 'Resistance bands', emoji: '' },
  { id: 'cable', label: 'Cable machine', emoji: '' },
  { id: 'treadmill', label: 'Treadmill', emoji: '' },
  { id: 'bike', label: 'Exercise bike', emoji: '' },
  { id: 'rower', label: 'Rowing machine', emoji: '' },
  { id: 'jump_rope', label: 'Jump rope', emoji: '' },
  { id: 'mat', label: 'Yoga mat', emoji: '' },
]

type Slot = 'squat' | 'hinge' | 'push_h' | 'push_v' | 'pull_h' | 'pull_v' | 'lunge' | 'core' | 'cardio'

interface Exercise {
  id: string
  name: string
  slot: Slot
  needs: string[]
  sets: number
  reps: string
  cue: string
  rank: number
}

const E = (id: string, name: string, slot: Slot, needs: string[], sets: number, reps: string, cue: string, rank: number): Exercise => ({ id, name, slot, needs, sets, reps, cue, rank })

export const EXERCISES: Exercise[] = [
  E('bw_squat', 'Bodyweight squat', 'squat', [], 3, '15–20', 'Sit back, chest up, knees track over toes.', 1),
  E('goblet_squat_db', 'Goblet squat (dumbbell)', 'squat', ['dumbbells'], 3, '10–12', 'Hold the dumbbell at your chest, elbows inside knees at the bottom.', 3),
  E('goblet_squat_kb', 'Goblet squat (kettlebell)', 'squat', ['kettlebell'], 3, '10–12', 'Hold the bell by the horns, squat between your heels.', 3),
  E('back_squat', 'Barbell back squat', 'squat', ['barbell'], 4, '6–8', 'Brace hard, break at hips and knees together.', 5),
  E('band_squat', 'Banded squat', 'squat', ['bands'], 3, '15', 'Stand on the band, handles at shoulders.', 2),
  E('glute_bridge', 'Glute bridge', 'hinge', [], 3, '15–20', 'Drive through heels, squeeze glutes at the top for 1 s.', 1),
  E('db_rdl', 'Dumbbell Romanian deadlift', 'hinge', ['dumbbells'], 3, '10–12', 'Soft knees, push hips back, flat back.', 3),
  E('kb_swing', 'Kettlebell swing', 'hinge', ['kettlebell'], 4, '15', 'Snap the hips, arms are just ropes.', 4),
  E('bb_deadlift', 'Barbell deadlift', 'hinge', ['barbell'], 3, '5', 'Bar over mid-foot, push the floor away.', 5),
  E('band_good_morning', 'Band good morning', 'hinge', ['bands'], 3, '15', 'Band behind neck, hinge at hips.', 2),
  E('reverse_lunge', 'Reverse lunge', 'lunge', [], 3, '10 / leg', 'Step back, both knees at 90°.', 1),
  E('db_lunge', 'Dumbbell walking lunge', 'lunge', ['dumbbells'], 3, '10 / leg', 'Long steps, torso upright.', 3),
  E('split_squat', 'Bulgarian split squat', 'lunge', ['bench'], 3, '8–10 / leg', 'Back foot on the bench, front knee over toes.', 3),
  E('step_up', 'Step-up', 'lunge', [], 3, '10 / leg', 'Use a sturdy chair or step, drive through the front heel.', 1),
  E('pushup', 'Push-up', 'push_h', [], 3, 'as many as clean', 'Body in one line. Knees down is fine.', 1),
  E('db_floor_press', 'Dumbbell floor press', 'push_h', ['dumbbells'], 3, '10–12', 'Lie on the floor, press up, elbows at 45°.', 2),
  E('db_bench', 'Dumbbell bench press', 'push_h', ['dumbbells', 'bench'], 3, '8–12', 'Shoulder blades pinched, control the lowering.', 4),
  E('bb_bench', 'Barbell bench press', 'push_h', ['barbell', 'bench'], 4, '6–8', 'Feet planted, bar to lower chest.', 5),
  E('band_chest_press', 'Band chest press', 'push_h', ['bands'], 3, '15', 'Band anchored behind you, press forward.', 2),
  E('cable_press', 'Cable chest press', 'push_h', ['cable'], 3, '10–12', 'Staggered stance, press and squeeze.', 3),
  E('pike_pushup', 'Pike push-up', 'push_v', [], 3, '8–10', 'Hips high, head moves toward the floor.', 1),
  E('db_ohp', 'Dumbbell shoulder press', 'push_v', ['dumbbells'], 3, '8–12', 'Ribs down, press straight up.', 3),
  E('kb_press', 'Kettlebell press', 'push_v', ['kettlebell'], 3, '8 / arm', 'Bell rests on forearm, press overhead.', 3),
  E('band_ohp', 'Band overhead press', 'push_v', ['bands'], 3, '12–15', 'Stand on band, press overhead.', 2),
  E('towel_row', 'Door-frame / table row', 'pull_h', [], 3, '10–12', 'Lean back holding a sturdy table edge, pull chest up.', 1),
  E('db_row', 'One-arm dumbbell row', 'pull_h', ['dumbbells'], 3, '10 / arm', 'Pull elbow to hip, flat back.', 3),
  E('kb_row', 'Kettlebell row', 'pull_h', ['kettlebell'], 3, '10 / arm', 'Hinge forward, row to the hip.', 3),
  E('band_row', 'Band row', 'pull_h', ['bands'], 3, '15', 'Anchor at chest height, squeeze shoulder blades.', 2),
  E('cable_row', 'Seated cable row', 'pull_h', ['cable'], 3, '10–12', 'Tall chest, pull to the belly.', 4),
  E('bb_row', 'Barbell row', 'pull_h', ['barbell'], 3, '8–10', 'Torso at 45°, pull to the belly button.', 4),
  E('pullup', 'Pull-up (or negatives)', 'pull_v', ['pull_up_bar'], 3, '5–8', 'Can’t do one yet? Jump up and lower slowly for 4 s.', 5),
  E('band_pulldown', 'Band lat pulldown', 'pull_v', ['bands'], 3, '15', 'Anchor high, pull elbows down to ribs.', 2),
  E('cable_pulldown', 'Lat pulldown', 'pull_v', ['cable'], 3, '10–12', 'Pull bar to upper chest, lean back slightly.', 4),
  E('superman', 'Superman hold', 'pull_v', [], 3, '30 s', 'Lift arms and legs, squeeze your back.', 1),
  E('plank', 'Plank', 'core', [], 3, '30–45 s', 'Squeeze glutes, don’t let hips sag.', 2),
  E('dead_bug', 'Dead bug', 'core', [], 3, '10 / side', 'Lower back stays glued to the floor.', 2),
  E('side_plank', 'Side plank', 'core', [], 2, '30 s / side', 'Stack hips, straight line head to feet.', 1),
  E('hanging_knee', 'Hanging knee raise', 'core', ['pull_up_bar'], 3, '10–12', 'No swinging, curl the pelvis up.', 3),
  E('mountain_climber', 'Mountain climbers', 'core', [], 3, '30 s', 'Fast knees, hips low.', 1),
  E('brisk_walk', 'Brisk walk', 'cardio', [], 1, '20–30 min', 'Pace where talking is possible but not singing.', 1),
  E('circuit_cardio', 'Jumping jacks + high knees', 'cardio', [], 5, '40 s on / 20 s off', 'Keep moving, low impact version is fine.', 1),
  E('treadmill_incline', 'Incline treadmill walk', 'cardio', ['treadmill'], 1, '20–30 min', '8–12 % incline, ~5 km/h, no holding the rails.', 4),
  E('bike_intervals', 'Bike intervals', 'cardio', ['bike'], 8, '30 s hard / 90 s easy', 'Hard = you can’t talk. Easy = fully recover.', 4),
  E('row_steady', 'Rowing steady', 'cardio', ['rower'], 1, '15–20 min', 'Legs, then body, then arms. Smooth.', 4),
  E('jump_rope', 'Jump rope intervals', 'cardio', ['jump_rope'], 6, '60 s on / 30 s off', 'Small jumps, wrists turn the rope.', 3),
]

function available(ex: Exercise, equipment: string[]) {
  return ex.needs.every((n) => equipment.includes(n))
}

function pick(slot: Slot, equipment: string[], variant: number, exclude: Set<string>): Exercise | null {
  const opts = EXERCISES.filter((e) => e.slot === slot && available(e, equipment) && !exclude.has(e.id)).sort((a, b) => b.rank - a.rank)
  if (!opts.length) return null
  const top = opts.slice(0, Math.min(2, opts.length))
  return top[variant % top.length]
}

const TEMPLATES: Record<string, { title: string; focus: string; slots: Slot[] }> = {
  fullA: { title: 'Full body A', focus: 'Strength + cardio', slots: ['squat', 'push_h', 'pull_h', 'hinge', 'core', 'cardio'] },
  fullB: { title: 'Full body B', focus: 'Strength + cardio', slots: ['hinge', 'push_v', 'pull_v', 'lunge', 'core', 'cardio'] },
  upper: { title: 'Upper body', focus: 'Push + pull', slots: ['push_h', 'pull_h', 'push_v', 'pull_v', 'core'] },
  lower: { title: 'Lower body', focus: 'Legs + core', slots: ['squat', 'hinge', 'lunge', 'core', 'cardio'] },
  cardio: { title: 'Cardio + core', focus: 'Burn + move', slots: ['cardio', 'core', 'core'] },
}

const SCHEDULE: Record<number, { days: number[]; templates: string[] }> = {
  1: { days: [2], templates: ['fullA'] },
  2: { days: [0, 3], templates: ['fullA', 'fullB'] },
  3: { days: [0, 2, 4], templates: ['fullA', 'fullB', 'fullA'] },
  4: { days: [0, 1, 3, 4], templates: ['upper', 'lower', 'upper', 'lower'] },
  5: { days: [0, 1, 2, 3, 4], templates: ['upper', 'lower', 'cardio', 'upper', 'lower'] },
  6: { days: [0, 1, 2, 3, 4, 5], templates: ['fullA', 'cardio', 'fullB', 'cardio', 'fullA', 'cardio'] },
  7: { days: [0, 1, 2, 3, 4, 5, 6], templates: ['fullA', 'cardio', 'fullB', 'cardio', 'fullA', 'cardio', 'cardio'] },
}

export function generateWorkoutPlan(equipment: string[], trainingDays: number, minutes: number): WorkoutPlan {
  const n = Math.max(1, Math.min(7, trainingDays || 3))
  const sched = SCHEDULE[n]
  const workouts: PlannedWorkout[] = sched.days.map((weekday, i) => {
    const t = TEMPLATES[sched.templates[i]]
    const used = new Set<string>()
    const exercises: PlannedExercise[] = []
    const maxEx = minutes <= 20 ? 3 : minutes <= 30 ? 4 : minutes <= 45 ? 5 : 6
    for (const slot of t.slots) {
      const ex = pick(slot, equipment, i, used)
      if (!ex) continue
      used.add(ex.id)
      exercises.push({ id: ex.id, name: ex.name, sets: ex.sets, reps: ex.reps, cue: ex.cue, rest_s: slot === 'cardio' ? 0 : 60 })
    }
    while (exercises.length > maxEx) exercises.splice(exercises.length - 2, 1)
    return { weekday, title: t.title, focus: t.focus, minutes, exercises }
  })
  return { generated_at: new Date().toISOString(), workouts }
}
