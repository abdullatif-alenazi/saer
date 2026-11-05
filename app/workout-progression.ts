import type { ExerciseProgressionPath, ExecutionRecord, PlannedActivity, ProgressionLevel, ProgressionStage, WorkoutProgressionPlan } from "./local-store";

const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const levelNames = (exercise: NonNullable<PlannedActivity["exercises"]>[number]) => {
  if (exercise.category === "دفع") return ["ضغط على الجدار", "ضغط مائل", "ضغط على الركبتين", "ضغط كامل", "ضغط متقدم"];
  if (exercise.category === "سحب") return ["سحب أسترالي", "عقلة بمساعدة", "عقلة", "عقلة بقبضة ضيقة", "عقلة متقدمة"];
  if (exercise.category === "أرجل") return ["جلوس وقيام من كرسي", "سكوات وزن الجسم", "سكوات بطيء", "سكوات بلغاري", "سكوات متقدم"];
  return exercise.measurement === "duration" ? ["ثبات أساسي", "بلانك", "ثبات ممتد", "بلانك جانبي", "ثبات متقدم"] : ["جذع أساسي", "تمرين جذع", "جذع متوسط", "جذع متقدم", "جذع متقدم"];
};
const currentLevelIndex = (level: WorkoutProgressionPlan["fitnessLevel"]) => level === "beginner" ? 1 : level === "intermediate" ? 2 : 3;
const targetValues = (exercise: NonNullable<PlannedActivity["exercises"]>[number]) => Array.from({ length: Math.max(1, exercise.sets) }, (_, index) => Math.max(0, Math.round(exercise.measurement === "duration" ? exercise.durationTargets?.[index] ?? exercise.durationSeconds ?? 0 : exercise.repetitionTargets?.[index] ?? exercise.reps ?? 0)));
const stageName = (index: number) => `المرحلة ${new Intl.NumberFormat("ar-SA").format(index + 1)}`;

function makePath(exercise: NonNullable<PlannedActivity["exercises"]>[number], mode: "ready" | "custom", fitnessLevel: WorkoutProgressionPlan["fitnessLevel"], goal: string): ExerciseProgressionPath {
  const base = targetValues(exercise), currentIndex = mode === "ready" ? currentLevelIndex(fitnessLevel) : 0;
  const suggestedNames = mode === "ready" ? levelNames(exercise) : [exercise.name];
  // The selected level is the user's existing movement and its first stage
  // preserves their current targets. The plan therefore does not silently
  // change the workout when it is first created.
  const names = suggestedNames.map((name, index) => index === currentIndex ? exercise.name : name);
  const stageFactors = mode === "ready" ? goal === "التحمل" ? [1, 1.15, 1.3, 1.45, 1.6] : goal === "القوة" ? [1, 1.1, 1.2, 1.3, 1.4] : [1, 1.12, 1.24, 1.36, 1.48] : [1, 1.15, 1.3, 1.45, 1.6];
  const levelScales = mode === "ready" ? names.map((_, index) => 1.15 ** (index - currentIndex)) : [1];
  const levels: ProgressionLevel[] = names.map((name, levelIndex) => ({ id: id(), name, stages: stageFactors.map((factor, stageIndex) => ({ id: id(), name: stageName(stageIndex), sets: Math.max(1, exercise.sets), targets: base.map(value => Math.max(1, Math.round(value * factor * (levelScales[levelIndex] ?? 1)))) })) }));
  const currentLevel = levels[currentIndex] ?? levels[0];
  return { exerciseId: exercise.id, exerciseName: exercise.name, measurement: exercise.measurement, levels, currentLevelId: currentLevel.id, currentStageId: currentLevel.stages[0].id, qualifyingSessionIds: [], processedSessionIds: [] };
}

export function createWorkoutProgression(activity: PlannedActivity, mode: "ready" | "custom", fitnessLevel: WorkoutProgressionPlan["fitnessLevel"], goal: string): PlannedActivity {
  const now = new Date().toISOString();
  const progressionPlan: WorkoutProgressionPlan = { version: 1, name: `خطة ${activity.name}`, mode, fitnessLevel, goal, requiredConsecutiveSessions: 2, requireAllSets: true, requireSameLevel: true, requireConfirmation: false, createdAt: now, updatedAt: now, paths: (activity.exercises ?? []).map(exercise => makePath(exercise, mode, fitnessLevel, goal)) };
  return applyWorkoutProgression({ ...activity, progressionPlan });
}

export function applyWorkoutProgression(activity: PlannedActivity): PlannedActivity {
  const plan = activity.progressionPlan;
  if (!plan) return activity;
  const exercises = (activity.exercises ?? []).map(exercise => {
    const path = plan.paths.find(item => item.exerciseId === exercise.id);
    const level = path?.levels.find(item => item.id === path.currentLevelId);
    const stage = path ? level?.stages.find(item => item.id === path.currentStageId) : undefined;
    if (!path || !level || !stage) return exercise;
    const values = Array.from({ length: stage.sets }, (_, index) => Math.max(0, stage.targets[index] ?? stage.targets.at(-1) ?? 0));
    return { ...exercise, name: level.name, sets: stage.sets, ...(path.measurement === "duration" ? { durationSeconds: values[0] ?? 0, durationTargets: values } : { reps: values[0] ?? 0, repetitionTargets: values }) };
  });
  return { ...activity, exercises };
}

function stagePasses(path: ExerciseProgressionPath, stage: ProgressionStage, result: NonNullable<ExecutionRecord["exerciseResults"]>[number], requireAllSets: boolean) {
  if (result.exerciseId !== path.exerciseId || result.measurement !== path.measurement) return false;
  const targets = stage.targets;
  if (!result.sets?.length || result.completedSets < (requireAllSets ? stage.sets : 1)) return false;
  const earned = result.sets.map(set => path.measurement === "duration" ? set.durationSeconds >= (targets[set.round - 1] ?? targets.at(-1) ?? Infinity) : (set.repetitions ?? 0) >= (targets[set.round - 1] ?? targets.at(-1) ?? Infinity));
  return requireAllSets ? earned.filter(Boolean).length >= stage.sets : earned.some(Boolean);
}

export function advanceWorkoutProgress(activity: PlannedActivity, record: ExecutionRecord): { activity: PlannedActivity; messages: string[] } {
  const plan = activity.progressionPlan;
  if (!plan || !record.exerciseResults?.length) return { activity, messages: [] };
  const sessionId = record.sessionId ?? record.id ?? record.completedAt;
  let advanced = false;
  const messages: string[] = [];
  const paths = plan.paths.map(path => {
    const result = record.exerciseResults?.find(item => item.exerciseId === path.exerciseId);
    if (!result || path.processedSessionIds.includes(sessionId) || path.pendingPromotion) return path;
    const levelIndex = path.levels.findIndex(item => item.id === path.currentLevelId), level = path.levels[levelIndex];
    const stageIndex = level?.stages.findIndex(item => item.id === path.currentStageId) ?? -1, stage = level?.stages[stageIndex];
    if (!level || !stage) return path;
    if (plan.requireSameLevel && result.name !== level.name) return { ...path, processedSessionIds: [...path.processedSessionIds, sessionId].slice(-300), qualifyingSessionIds: [] };
    const processedSessionIds = [...path.processedSessionIds, sessionId].slice(-300);
    const passed = stagePasses(path, stage, result, plan.requireAllSets);
    const qualifyingSessionIds = passed ? [...path.qualifyingSessionIds, sessionId].slice(-Math.max(1, plan.requiredConsecutiveSessions)) : [];
    if (qualifyingSessionIds.length < Math.max(1, plan.requiredConsecutiveSessions)) return { ...path, processedSessionIds, qualifyingSessionIds };
    const nextStage = level.stages[stageIndex + 1], nextLevel = path.levels[levelIndex + 1], target = nextStage ?? nextLevel?.stages[0];
    if (!target) return { ...path, processedSessionIds, qualifyingSessionIds, lastAdvancedAt: record.completedAt, levels: path.levels.map(item => item.id === level.id ? { ...item, stages: item.stages.map(value => value.id === stage.id ? { ...value, completedAt: record.completedAt, evidenceSessionIds: qualifyingSessionIds } : value) } : item) };
    const pendingPromotion = plan.requireConfirmation ? { levelId: nextStage ? level.id : nextLevel!.id, stageId: target.id, sessionIds: qualifyingSessionIds, createdAt: record.completedAt } : undefined;
    const updatedPath: ExerciseProgressionPath = {
      ...path, processedSessionIds, qualifyingSessionIds: [], lastAdvancedAt: record.completedAt,
      ...(pendingPromotion ? { pendingPromotion } : { currentLevelId: nextStage ? level.id : nextLevel!.id, currentStageId: target.id }),
      levels: path.levels.map(item => item.id === level.id ? { ...item, stages: item.stages.map(value => value.id === stage.id ? { ...value, completedAt: record.completedAt, evidenceSessionIds: qualifyingSessionIds } : value) } : item),
    };
    advanced = !pendingPromotion;
    messages.push(pendingPromotion ? `اكتملت شروط ترقية ${path.exerciseName}` : `${path.exerciseName}: ${target.name}`);
    return updatedPath;
  });
  if (paths.every((path, index) => path === plan.paths[index])) return { activity, messages: [] };
  const updated = applyWorkoutProgression({ ...activity, progressionPlan: { ...plan, paths, updatedAt: record.completedAt } });
  return { activity: updated, messages: advanced ? messages : messages };
}

export function confirmWorkoutPromotion(activity: PlannedActivity, exerciseId: string): PlannedActivity {
  const plan = activity.progressionPlan;
  if (!plan) return activity;
  const paths = plan.paths.map(path => {
    if (path.exerciseId !== exerciseId || !path.pendingPromotion) return path;
    const pending = path.pendingPromotion;
    return { ...path, currentLevelId: pending.levelId, currentStageId: pending.stageId, pendingPromotion: undefined, qualifyingSessionIds: [] };
  });
  return applyWorkoutProgression({ ...activity, progressionPlan: { ...plan, paths, updatedAt: new Date().toISOString() } });
}
