"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { ExecutionRecord, PlannedActivity, WorkoutExercise, WorkoutExerciseResult, WorkoutSetResult, WorkoutSessionSettings } from "./local-store";
import WorkoutSettings from "./WorkoutSettings";

const ar = (value: number, pad = 1) => Math.max(0, Math.floor(value)).toLocaleString("ar-SA", { minimumIntegerDigits: pad, useGrouping: true });
const clock = (seconds: number) => `${ar(Math.floor(Math.max(0, seconds) / 60), 2)}:${ar(Math.floor(Math.max(0, seconds) % 60), 2)}`;
type Mode = "ready" | "prepare" | "work" | "rest" | "paused" | "exerciseDone" | "sessionDone";
type ClockMode = "prepare" | "work" | "rest";
type PendingSet = { round: number; durationSeconds: number; targetRepetitions?: number; targetDurationSeconds?: number };
type WorkoutSnapshot = {
  activityId: string; date: string; exerciseIndex: number; setIndex: number; mode: Mode; pausedMode: ClockMode;
  phaseElapsedMs: number; phaseTargetSeconds: number; repetitionCount: number; restSeconds: number;
  restExpired: boolean; pendingSet: PendingSet | null; sessionElapsedMs: number; sessionStarted: boolean;
  results: Record<string, WorkoutExerciseResult>; expectedAdjustment: number; exercisePlan?: WorkoutExercise[]; workoutSessionSettings?: WorkoutSessionSettings; workoutStartMode?: "manual" | "automatic";
};

function exerciseResult(exercise: NonNullable<PlannedActivity["exercises"]>[number], targetSets: number): WorkoutExerciseResult {
  return { exerciseId: exercise.id, name: exercise.name, measurement: exercise.measurement, completedSets: 0, targetSets, repetitions: 0, durationSeconds: 0, sets: [] };
}
function snapshotKey(activityId: string, date: string) { return `sair.workout-session.v1:${activityId}:${date}`; }
function readSnapshot(activityId: string, date: string): WorkoutSnapshot | null {
  try {
    const value = sessionStorage.getItem(snapshotKey(activityId, date));
    if (!value) return null;
    const parsed = JSON.parse(value) as WorkoutSnapshot;
    if (parsed.activityId !== activityId || parsed.date !== date || !parsed.results || !Number.isFinite(parsed.sessionElapsedMs)) return null;
    return parsed;
  } catch { return null; }
}

export default function WorkoutRunner({ activity, date, onExit, onFinish, previousSessions = [], executionRecords = [], settingsOpen = false, onCloseSettings, onSaveActivity, onSaveProgression, onDeleteActivity }: {
  activity: PlannedActivity;
  date: string;
  onExit: () => void;
  onFinish: (minutes: number, repetitions: number, durationSeconds?: number, exerciseResults?: WorkoutExerciseResult[], restDurationSeconds?: number) => void;
  previousSessions?: Array<{ durationSeconds?: number; exerciseResults?: WorkoutExerciseResult[] }>;
  executionRecords?: ExecutionRecord[];
  settingsOpen?: boolean; onCloseSettings?: () => void; onSaveActivity?: (activity: PlannedActivity) => void; onSaveProgression?: (activity: PlannedActivity) => void; onDeleteActivity?: () => void;
}) {
  const savedAtMount = useRef<WorkoutSnapshot | null>(typeof window === "undefined" ? null : readSnapshot(activity.id, date));
  const saved = savedAtMount.current;
  const exercisePlan = useRef<WorkoutExercise[]>(saved?.sessionStarted ? saved.exercisePlan ?? activity.exercises ?? [] : activity.exercises ?? []);
  const sessionSettings = useRef<WorkoutSessionSettings | undefined>(saved?.sessionStarted ? saved.workoutSessionSettings ?? activity.workoutSessionSettings : activity.workoutSessionSettings);
  const exercises = exercisePlan.current;
  const [exerciseIndex, setExerciseIndex] = useState(saved?.exerciseIndex ?? 0);
  const [setIndex, setSetIndex] = useState(saved?.setIndex ?? 1);
  const [mode, setMode] = useState<Mode>(saved ? (saved.mode === "prepare" || saved.mode === "work" || saved.mode === "rest" ? "paused" : saved.mode) : "ready");
  const [pausedMode, setPausedMode] = useState<ClockMode>(saved?.mode === "paused" ? saved.pausedMode : saved?.mode === "prepare" || saved?.mode === "work" || saved?.mode === "rest" ? saved.mode : "work");
  const [seconds, setSeconds] = useState(saved ? Math.max(0, Math.ceil(saved.phaseTargetSeconds - saved.phaseElapsedMs / 1000)) : 0);
  const [repetitionCount, setRepetitionCount] = useState(saved?.repetitionCount ?? 0);
  const [restSeconds, setRestSeconds] = useState(saved?.restSeconds ?? 0);
  const [restExpired, setRestExpired] = useState(saved?.restExpired ?? false);
  const [pendingSet, setPendingSet] = useState<PendingSet | null>(saved?.pendingSet ?? null);
  const [sessionElapsed, setSessionElapsed] = useState(Math.floor((saved?.sessionElapsedMs ?? 0) / 1000));
  const [sessionStarted, setSessionStarted] = useState(saved?.sessionStarted ?? false);
  const [endedEarly, setEndedEarly] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [resultsVersion, setResultsVersion] = useState(0);
  const modeRef = useRef<Mode>(mode);
  const phaseAnchor = useRef<number | null>(null);
  const phaseElapsedBase = useRef(saved?.phaseElapsedMs ?? 0);
  const phaseTarget = useRef(saved?.phaseTargetSeconds ?? 0);
  const sessionAnchor = useRef<number | null>(null);
  const sessionElapsedBaseMs = useRef(saved?.sessionElapsedMs ?? 0);
  const restElapsedMs = useRef((saved?.restSeconds ?? 0) * 1000);
  const results = useRef<Record<string, WorkoutExerciseResult>>(saved?.results ?? {});
  const estimateAdjustmentSeconds = useRef(saved?.expectedAdjustment ?? 0);
  const finished = useRef(false);
  const restored = useRef(false);
  const inTransition = useRef(false);
  const exerciseTrack = useRef<HTMLDivElement | null>(null);
  const detailTouchStart = useRef(0);
  const pendingSetRef = useRef<PendingSet | null>(saved?.pendingSet ?? null);
  const restExpiredRef = useRef(saved?.restExpired ?? false);
  if (!sessionStarted && !saved?.sessionStarted) { exercisePlan.current = activity.exercises ?? []; sessionSettings.current = activity.workoutSessionSettings; }

  const exercise = exercises[exerciseIndex];
  const sets = exercise && Number.isFinite(exercise.sets) ? Math.max(0, Math.floor(exercise.sets)) : 0;
  const targetRepsValue = exercise?.repetitionTargets?.[setIndex - 1] ?? exercise?.reps;
  const targetDurationValue = exercise?.durationTargets?.[setIndex - 1] ?? exercise?.durationSeconds;
  const targetReps = exercise?.measurement === "repetitions" && Number.isFinite(targetRepsValue) && (targetRepsValue ?? 0) > 0 ? Math.floor(targetRepsValue!) : null;
  const targetDuration = exercise?.measurement === "duration" && Number.isFinite(targetDurationValue) && (targetDurationValue ?? 0) > 0 ? Math.floor(targetDurationValue!) : null;
  const automaticStart = (sessionSettings.current?.startMode ?? (saved?.sessionStarted ? saved.workoutStartMode : activity.workoutStartMode)) === "automatic";
  const preparationSeconds = Math.max(0, Math.min(15, Math.floor(sessionSettings.current?.preparationSeconds ?? 5)));

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { pendingSetRef.current = pendingSet; }, [pendingSet]);
  useEffect(() => { restExpiredRef.current = restExpired; }, [restExpired]);
  useEffect(() => { restored.current = true; }, []);
  useEffect(() => {
    if (!expandedExerciseId && !settingsOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [expandedExerciseId, settingsOpen]);
  useEffect(() => {
    if (sessionStarted || saved?.sessionStarted) return;
    const nextExercises = activity.exercises ?? [];
    exercisePlan.current = nextExercises;
    setExerciseIndex(index => Math.min(index, Math.max(0, nextExercises.length - 1)));
    setSetIndex(1);
  }, [activity.exercises, sessionStarted, saved?.sessionStarted]);
  useEffect(() => {
    const settings = sessionSettings.current;
    const countdown = mode === "prepare" || mode === "rest" && automaticStart && seconds > 0 && seconds <= 5;
    if (!countdown || seconds <= 0 || (!settings?.sound && !settings?.vibration)) return;
    if (settings.sound) {
      try {
        const AudioContextClass = window.AudioContext;
        if (AudioContextClass) {
          const context = new AudioContextClass();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = seconds === 1 ? 760 : 620;
          gain.gain.setValueAtTime(0.035, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
          oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.09);
          window.setTimeout(() => void context.close(), 150);
        }
      } catch { /* audio is optional and may be unavailable */ }
    }
    if (settings.vibration && "vibrate" in navigator) navigator.vibrate(18);
  }, [mode, seconds, automaticStart, sessionStarted]);
  useEffect(() => {
    if (!exerciseTrack.current || !exercise) return;
    const active = exerciseTrack.current.querySelector<HTMLElement>(`[data-exercise-id="${CSS.escape(exercise.id)}"]`);
    if (!active) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    active.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest", inline: "center" });
  }, [exercise?.id]);

  const configuredEstimate = useMemo(() => {
    const configured = Number.isFinite(activity.expectedMinutes) && activity.expectedMinutes > 0 ? Math.round(activity.expectedMinutes * 60) : 0;
    const configuredExerciseTime = exercises.reduce((total, item) => {
      const itemSets = Number.isFinite(item.sets) ? Math.max(0, Math.floor(item.sets)) : 0;
      const targetTime = item.measurement === "duration" ? Array.from({ length: itemSets }, (_, index) => Math.max(0, item.durationTargets?.[index] ?? item.durationSeconds ?? 0)).reduce((sum, value) => sum + value, 0) : 0;
      const restTime = Math.max(0, Number.isFinite(item.restSeconds) ? item.restSeconds : 0) * Math.max(0, itemSets - 1);
      return total + targetTime + restTime + Math.max(0, item.restAfterSeconds ?? 0);
    }, 0);
    if (configured > 0) return Math.max(configured, configuredExerciseTime + 5);
    const containsRepetitionExercise = exercises.some(item => item.measurement === "repetitions");
    return !containsRepetitionExercise && configuredExerciseTime > 0 ? configuredExerciseTime + 5 : null;
  }, [activity.expectedMinutes, exercises]);
  const previousDuration = useMemo(() => {
    const recent = previousSessions.filter(item => Number.isFinite(item.durationSeconds) && (item.durationSeconds ?? 0) > 0).slice(0, 3);
    return recent.length ? Math.round(recent.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0) / recent.length) : null;
  }, [previousSessions]);
  const expectedTotalSeconds = previousDuration ?? configuredEstimate;
  const totalRounds = exercises.reduce((total, item) => total + (Number.isFinite(item.sets) ? Math.max(0, Math.floor(item.sets)) : 0), 0);
  const completedRounds = Object.values(results.current).reduce((total, item) => total + item.completedSets, 0);
  const nextExercise = exercises[exerciseIndex + 1];
  const completedExerciseCount = exercises.filter(item => (results.current[item.id]?.completedSets ?? 0) >= (Number.isFinite(item.sets) ? item.sets : 0) && item.sets > 0).length;
  const totalRepetitions = Object.values(results.current).reduce((sum, item) => sum + item.repetitions, 0);
  const finalCountdown = (mode === "prepare" || mode === "rest" && automaticStart) && seconds > 0 && seconds <= 5;

  function enterMode(next: Mode) { modeRef.current = next; setMode(next); }
  function elapsedInPhase() { return phaseElapsedBase.current + (phaseAnchor.current === null ? 0 : Math.max(0, performance.now() - phaseAnchor.current)); }
  function elapsedSessionMs() { return sessionElapsedBaseMs.current + (sessionAnchor.current === null ? 0 : Math.max(0, Date.now() - sessionAnchor.current)); }
  function startPhase(next: ClockMode, durationSeconds: number, countUp = false) {
    phaseElapsedBase.current = 0;
    phaseAnchor.current = performance.now();
    phaseTarget.current = Math.max(0, durationSeconds);
    setSeconds(next === "work" && countUp ? 0 : Math.max(0, durationSeconds));
    enterMode(next);
  }
  function commitPhase(clockMode: ClockMode) {
    if (modeRef.current !== clockMode || phaseAnchor.current === null) return phaseElapsedBase.current / 1000;
    const elapsed = elapsedInPhase();
    phaseElapsedBase.current = elapsed;
    phaseAnchor.current = null;
    if (clockMode === "rest") {
      restElapsedMs.current += elapsed;
      setRestSeconds(Math.floor(restElapsedMs.current / 1000));
    }
    return elapsed / 1000;
  }
  function persistSnapshot(forceMode?: Mode, forcedPausedMode?: ClockMode) {
    if (typeof window === "undefined" || !restored.current) return;
    const currentMode = forceMode ?? modeRef.current;
    const clockMode = currentMode === "paused" ? forcedPausedMode ?? pausedMode : currentMode === "prepare" || currentMode === "work" || currentMode === "rest" ? currentMode : null;
    const elapsedMs = clockMode && phaseAnchor.current !== null ? elapsedInPhase() : phaseElapsedBase.current;
    const sessionMs = elapsedSessionMs();
    const snapshot: WorkoutSnapshot = {
      activityId: activity.id, date, exerciseIndex, setIndex,
      mode: currentMode === "prepare" || currentMode === "work" || currentMode === "rest" ? "paused" : currentMode,
      pausedMode: clockMode ?? pausedMode, phaseElapsedMs: elapsedMs, phaseTargetSeconds: phaseTarget.current,
      repetitionCount, restSeconds, restExpired: restExpiredRef.current, pendingSet: pendingSetRef.current,
      sessionElapsedMs: sessionMs, sessionStarted, results: results.current, expectedAdjustment: estimateAdjustmentSeconds.current, exercisePlan: exercises, workoutSessionSettings: sessionSettings.current, workoutStartMode: saved?.sessionStarted ? saved.workoutStartMode ?? activity.workoutStartMode : activity.workoutStartMode,
    };
    try { sessionStorage.setItem(snapshotKey(activity.id, date), JSON.stringify(snapshot)); } catch { /* session may be unavailable */ }
  }
  function startSessionClock() {
    if (sessionAnchor.current !== null) return;
    sessionAnchor.current = Date.now();
    setSessionStarted(true);
  }
  function pauseClock() {
    const activeMode = modeRef.current;
    if (activeMode !== "prepare" && activeMode !== "work" && activeMode !== "rest") return;
    setPausedMode(activeMode);
    phaseElapsedBase.current = elapsedInPhase();
    phaseAnchor.current = null;
    sessionElapsedBaseMs.current = elapsedSessionMs();
    sessionAnchor.current = null;
    enterMode("paused");
    persistSnapshot("paused", activeMode);
  }
  function resumeClock() {
    if (modeRef.current !== "paused") return;
    sessionAnchor.current = Date.now();
    phaseAnchor.current = performance.now();
    enterMode(pausedMode);
  }
  function requestExit() {
    if (!sessionStarted || modeRef.current === "sessionDone") { onExit(); return; }
    const currentMode = modeRef.current;
    const activeClockMode: ClockMode | null = currentMode === "paused" ? pausedMode : currentMode === "prepare" || currentMode === "work" || currentMode === "rest" ? currentMode : null;
    if (currentMode === "prepare" || currentMode === "work" || currentMode === "rest") commitPhase(currentMode);
    else if (currentMode === "paused" && pausedMode === "rest") {
      restElapsedMs.current += phaseElapsedBase.current;
      setRestSeconds(Math.floor(restElapsedMs.current / 1000));
    }
    if (activeClockMode) phaseAnchor.current = null;
    sessionElapsedBaseMs.current = elapsedSessionMs();
    sessionAnchor.current = null;
    setSessionElapsed(Math.floor(sessionElapsedBaseMs.current / 1000));
    setEndedEarly(true);
    persistSnapshot("sessionDone");
    enterMode("sessionDone");
  }
  function durationTargetForRound(targetExercise: NonNullable<PlannedActivity["exercises"]>[number] | undefined, round: number) {
    if (!targetExercise || targetExercise.measurement !== "duration") return null;
    const value = targetExercise.durationTargets?.[round - 1] ?? targetExercise.durationSeconds;
    return Number.isFinite(value) && (value ?? 0) > 0 ? Math.floor(value!) : null;
  }
  function beginWorkDirect(round = setIndex) {
    if (modeRef.current !== "rest") return;
    commitPhase("rest");
    const duration = durationTargetForRound(exercise, round);
    startPhase("work", duration ?? 0, duration === null);
  }
  function afterRest() {
    if (pendingSetRef.current) return;
    if (automaticStart) beginWorkDirect();
    else enterMode("ready");
  }
  function finishSession() {
    if (finished.current || modeRef.current !== "sessionDone") return;
    finished.current = true;
    const duration = Math.floor(elapsedSessionMs() / 1000);
    const completedResults = Object.values(results.current);
    const totalRest = Math.floor(restElapsedMs.current / 1000);
    try { sessionStorage.removeItem(snapshotKey(activity.id, date)); } catch { /* session may be unavailable */ }
    onFinish(Math.max(1, duration / 60), totalRepetitions, duration, completedResults, totalRest);
  }
  function restartSession() {
    savedAtMount.current = null;
    exercisePlan.current = activity.exercises ?? [];
    sessionSettings.current = activity.workoutSessionSettings;
    try { sessionStorage.removeItem(snapshotKey(activity.id, date)); } catch { /* session storage may be unavailable */ }
    results.current = {};
    estimateAdjustmentSeconds.current = 0;
    phaseAnchor.current = null;
    phaseElapsedBase.current = 0;
    phaseTarget.current = 0;
    sessionAnchor.current = null;
    sessionElapsedBaseMs.current = 0;
    restElapsedMs.current = 0;
    pendingSetRef.current = null;
    restExpiredRef.current = false;
    inTransition.current = false;
    finished.current = false;
    setExerciseIndex(0);
    setSetIndex(1);
    setPausedMode("work");
    setSeconds(0);
    setRepetitionCount(0);
    setRestSeconds(0);
    setRestExpired(false);
    setPendingSet(null);
    setSessionElapsed(0);
    setSessionStarted(false);
    setEndedEarly(false);
    setExpandedExerciseId(null);
    setResultsVersion(version => version + 1);
    enterMode("ready");
    setRestartConfirmOpen(false);
  }
  function nextAfterExercise() {
    if (modeRef.current !== "exerciseDone") return;
    if (exerciseIndex >= exercises.length - 1) {
      sessionElapsedBaseMs.current = elapsedSessionMs();
      sessionAnchor.current = null;
      setSessionElapsed(Math.floor(sessionElapsedBaseMs.current / 1000));
      enterMode("sessionDone");
      return;
    }
    const nextIndex = exerciseIndex + 1;
    setExerciseIndex(nextIndex);
    setSetIndex(1);
    setRepetitionCount(0);
    setSeconds(0);
    const rest = Math.max(0, exercise.restAfterSeconds ?? 0);
    restExpiredRef.current = rest === 0;
    setRestExpired(rest === 0);
    if (rest > 0) startPhase("rest", rest);
    else enterMode("ready");
  }

  function finalizePendingSet(value: number) {
    if (inTransition.current || !pendingSetRef.current || !exercise) return;
    inTransition.current = true;
    const pending = pendingSetRef.current;
    const result = results.current[exercise.id] ?? exerciseResult(exercise, sets);
    const actualRepetitions = exercise.measurement === "repetitions" ? Math.max(0, Math.floor(value)) : undefined;
    if (actualRepetitions !== undefined) result.repetitions += actualRepetitions;
    result.completedSets += 1;
    result.durationSeconds += pending.durationSeconds;
    const setResult: WorkoutSetResult = {
      round: pending.round,
      repetitions: actualRepetitions,
      targetRepetitions: pending.targetRepetitions,
      durationSeconds: pending.durationSeconds,
      targetDurationSeconds: pending.targetDurationSeconds,
      completedAt: new Date().toISOString(),
    };
    result.sets = [...(result.sets ?? []), setResult];
    results.current[exercise.id] = result;
    pendingSetRef.current = null;
    setPendingSet(null);
    setResultsVersion(version => version + 1);
    setRepetitionCount(0);
    const nextSet = pending.round + 1;
    if (nextSet > sets) {
      inTransition.current = false;
      enterMode("exerciseDone");
      return;
    }
    setSetIndex(nextSet);
    inTransition.current = false;
    if (restExpiredRef.current) {
      if (automaticStart) beginWorkDirect(nextSet);
      else enterMode("ready");
    }
  }
  function finishRound() {
    if (inTransition.current || modeRef.current !== "work" || !exercise) return;
    inTransition.current = true;
    const actualWorkSeconds = commitPhase("work");
    if (targetDuration !== null) estimateAdjustmentSeconds.current += actualWorkSeconds - targetDuration;
    const pending: PendingSet = { round: setIndex, durationSeconds: actualWorkSeconds, targetRepetitions: targetReps ?? undefined, targetDurationSeconds: targetDuration ?? undefined };
    if (exercise.measurement === "repetitions") {
      pendingSetRef.current = pending;
      setPendingSet(pending);
      setRepetitionCount(targetReps ?? 0);
      const rest = setIndex < sets && Number.isFinite(exercise.restSeconds) ? Math.max(0, exercise.restSeconds) : 0;
      restExpiredRef.current = false;
      setRestExpired(false);
      inTransition.current = false;
      startPhase("rest", rest);
      return;
    }
    const result = results.current[exercise.id] ?? exerciseResult(exercise, sets);
    result.completedSets += 1;
    result.durationSeconds += actualWorkSeconds;
    result.sets = [...(result.sets ?? []), { round: setIndex, durationSeconds: actualWorkSeconds, targetDurationSeconds: targetDuration ?? undefined, completedAt: new Date().toISOString() }];
    results.current[exercise.id] = result;
    setResultsVersion(version => version + 1);
    if (setIndex >= sets) {
      inTransition.current = false;
      enterMode("exerciseDone");
      return;
    }
    setSetIndex(current => current + 1);
    restExpiredRef.current = false;
    setRestExpired(false);
    inTransition.current = false;
    startPhase("rest", Number.isFinite(exercise.restSeconds) ? Math.max(0, exercise.restSeconds) : 0);
  }
  function startSet() {
    if (modeRef.current !== "ready" || sets < 1 || !exercise) return;
    startSessionClock();
    inTransition.current = false;
    setRepetitionCount(0);
    if (preparationSeconds > 0) startPhase("prepare", preparationSeconds);
    else startPhase("work", targetDuration ?? 0, targetDuration === null);
  }

  useEffect(() => {
    const clockMode = mode as ClockMode;
    if (mode !== "prepare" && mode !== "work" && mode !== "rest") return;
    const tick = () => {
      if (modeRef.current !== clockMode) return;
      const elapsedMs = elapsedInPhase();
      if (clockMode === "work" && (exercise?.measurement === "repetitions" || targetDuration === null)) {
        setSeconds(Math.floor(elapsedMs / 1000));
        return;
      }
      const remaining = Math.max(0, Math.ceil(phaseTarget.current - elapsedMs / 1000));
      setSeconds(remaining);
      if (remaining !== 0) return;
      if (clockMode === "prepare") {
        commitPhase("prepare");
        startPhase("work", targetDuration ?? 0, targetDuration === null);
      } else if (clockMode === "rest") {
        if (!restExpiredRef.current) {
          commitPhase("rest");
          restExpiredRef.current = true;
          setRestExpired(true);
          setSeconds(0);
          afterRest();
        }
      } else if (clockMode === "work") {
        finishRound();
      }
    };
    tick();
    const timer = window.setInterval(tick, 180);
    const visibility = () => { if (document.visibilityState === "hidden") pauseClock(); };
    const pageHide = () => pauseClock();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageHide);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", pageHide); };
  }, [mode, exercise?.id, exercise?.measurement, targetDuration]);

  useEffect(() => {
    if (!sessionStarted || mode === "sessionDone") return;
    const update = () => setSessionElapsed(Math.floor(elapsedSessionMs() / 1000));
    update();
    const timer = window.setInterval(update, 400);
    return () => clearInterval(timer);
  }, [mode, sessionStarted]);
  useEffect(() => {
    if (!restored.current) return;
    persistSnapshot();
    const timer = window.setInterval(() => persistSnapshot(), 1000);
    const save = () => persistSnapshot();
    window.addEventListener("pagehide", save);
    return () => { clearInterval(timer); window.removeEventListener("pagehide", save); persistSnapshot(); };
  }, [activity.id, date, mode, exerciseIndex, setIndex, repetitionCount, restSeconds, restExpired, pendingSet, sessionStarted, resultsVersion]);

  if (!exercise) return <section className="workout-runner"><h1>لا توجد تمارين في الخطة.</h1><button className="primary" onClick={onExit}>عودة</button></section>;
  const progress = mode === "rest" ? Math.max(0, Math.min(100, seconds / Math.max(1, phaseTarget.current) * 100)) : mode === "work" && targetDuration ? Math.max(0, Math.min(100, seconds / targetDuration * 100)) : mode === "prepare" ? Math.max(0, Math.min(100, seconds / Math.max(1, preparationSeconds) * 100)) : 100;
  const status = mode === "ready" ? "جاهز" : mode === "prepare" ? "استعد" : mode === "work" ? "التمرين" : mode === "rest" ? restExpired ? "جاهز للجولة التالية" : "راحة بين الجولات" : mode === "paused" ? "متوقف مؤقتًا" : mode === "exerciseDone" ? "اكتمل التمرين" : "اكتملت الحصة";
  const cardExpected = expectedTotalSeconds;

  return <section className={`workout-runner workout-${mode}`} aria-live="polite" style={{ "--workout-accent": activity.workoutColor ?? "#73b8ce" } as CSSProperties}>
    <div className="workout-session-meta">
      <div className="workout-exercise-track" ref={exerciseTrack} aria-label={`تمارين الحصة، ${ar(completedRounds)} من ${ar(totalRounds)} جولات مكتملة`}>
        {exercises.map((item, index) => {
          const result = results.current[item.id];
          const done = Boolean(item.sets && (result?.completedSets ?? 0) >= item.sets);
          const targetTotal = item.measurement === "repetitions"
            ? Array.from({ length: Math.max(0, Math.floor(item.sets || 0)) }, (_, roundIndex) => item.repetitionTargets?.[roundIndex] ?? item.reps ?? 0).reduce((sum, value) => sum + Math.max(0, value), 0)
            : Array.from({ length: Math.max(0, Math.floor(item.sets || 0)) }, (_, roundIndex) => item.durationTargets?.[roundIndex] ?? item.durationSeconds ?? 0).reduce((sum, value) => sum + Math.max(0, value), 0);
          const actualTotal = item.measurement === "repetitions" ? result?.repetitions ?? 0 : result?.durationSeconds ?? 0;
          const historicalDurations = previousSessions.map(session => session.exerciseResults?.find(entry => entry.exerciseId === item.id || entry.name === item.name)?.durationSeconds).filter((value): value is number => Number.isFinite(value) && (value ?? 0) > 0).slice(0, 3);
          const configuredDuration = item.measurement === "duration"
            ? Array.from({ length: Math.max(0, Math.floor(item.sets || 0)) }, (_, roundIndex) => Math.max(0, item.durationTargets?.[roundIndex] ?? item.durationSeconds ?? 0)).reduce((sum, value) => sum + value, 0) + Math.max(0, item.restSeconds ?? 0) * Math.max(0, Math.floor(item.sets || 0) - 1) + Math.max(0, item.restAfterSeconds ?? 0)
            : 0;
          const expectedExerciseSeconds = historicalDurations.length ? Math.round(historicalDurations.reduce((sum, value) => sum + value, 0) / historicalDurations.length) : configuredDuration > 0 ? configuredDuration : null;
          const activeExerciseSeconds = index === exerciseIndex && mode === "work" ? seconds : index === exerciseIndex && mode === "paused" && pausedMode === "work" ? Math.floor(phaseElapsedBase.current / 1000) : 0;
          const actualExerciseSeconds = (result?.durationSeconds ?? 0) + (index === exerciseIndex && pendingSet ? pendingSet.durationSeconds : 0) + activeExerciseSeconds;
          return <button key={item.id} type="button" data-exercise-id={item.id} className={`workout-exercise-card ${index === exerciseIndex ? "current" : ""} ${done ? "complete" : ""} ${expandedExerciseId === item.id ? "expanded" : ""}`} aria-current={index === exerciseIndex ? "step" : undefined} aria-expanded={expandedExerciseId === item.id} onClick={() => setExpandedExerciseId(current => current === item.id ? null : item.id)}>
            <span className="workout-exercise-card-head"><b>{item.name}</b><small className="workout-exercise-total-inline">{ar(actualTotal)} / {targetTotal > 0 ? ar(targetTotal) : "—"} {item.measurement === "repetitions" ? "عدة" : "ث"}</small></span>
            <span className="workout-exercise-card-rounds">{Array.from({ length: Math.max(0, Math.floor(item.sets || 0)) }, (_, roundIndex) => {
              const round = roundIndex + 1;
              const savedSet = result?.sets?.find(set => set.round === round);
              const target = item.measurement === "repetitions" ? item.repetitionTargets?.[roundIndex] ?? item.reps ?? 0 : item.durationTargets?.[roundIndex] ?? item.durationSeconds ?? 0;
              const isPendingRepetitions = index === exerciseIndex && mode === "rest" && pendingSet?.round === round && item.measurement === "repetitions";
              const isActiveDuration = index === exerciseIndex && item.measurement === "duration" && (mode === "work" || mode === "paused" && pausedMode === "work") && setIndex === round;
              const activeDuration = targetDuration === null ? Math.floor(seconds) : Math.max(0, Math.floor(targetDuration - seconds));
              const actual = item.measurement === "repetitions"
                ? isPendingRepetitions ? repetitionCount : savedSet?.repetitions ?? 0
                : isActiveDuration ? activeDuration : savedSet?.durationSeconds ?? 0;
              const durationUnit = item.measurement === "duration" ? 5 : 1;
              const visualCount = target > 0 ? Math.min(36, item.measurement === "duration" ? Math.ceil(target / durationUnit) : Math.floor(target)) : 0;
              const filledUnits = item.measurement === "duration" ? actual / durationUnit : actual;
              const unitLabel = item.measurement === "duration" ? "ث" : "عدة";
              return <span className="workout-round-dots-row" key={round} aria-label={`الجولة ${ar(round)}: ${ar(actual)} من ${target > 0 ? ar(target) : "—"} ${unitLabel}`}>
                <small className="workout-round-index">{ar(round)}</small>
                <span className="workout-rep-dots">{Array.from({ length: visualCount }, (_, dotIndex) => {
                  const fill = Math.max(0, Math.min(1, filledUnits - dotIndex));
                  return <i key={dotIndex} className={fill >= 1 ? "done" : fill > 0 ? "partial" : ""} style={fill > 0 && fill < 1 ? { "--dot-fill": `${fill * 100}%` } as CSSProperties : undefined} />;
                })}{target > 0 && (item.measurement === "duration" ? Math.ceil(target / durationUnit) : Math.floor(target)) > visualCount && <small className="workout-dots-overflow">+{ar((item.measurement === "duration" ? Math.ceil(target / durationUnit) : Math.floor(target)) - visualCount)}</small>}</span>
                <small className="workout-round-count">{target > 0 ? `${ar(actual)} / ${ar(target)} ${unitLabel}` : "لم يحدد الهدف"}</small>
              </span>;
            })}</span>
            <span className="workout-exercise-card-times"><small>متوقع {expectedExerciseSeconds === null ? "—" : clock(expectedExerciseSeconds)}</small><small>فعلي {clock(actualExerciseSeconds)}</small></span>
          </button>;
        })}
      </div>
      <div className="workout-duration-summary has-actual" aria-label="مجموع الزمن المتوقع والفعلي للحصة">
        <div><small>مجموع الوقت المتوقع</small><strong>{cardExpected === null ? "غير محدد" : clock(cardExpected)}</strong></div>
        <div><small>مجموع الوقت الفعلي</small><strong>{clock(sessionElapsed)}</strong></div>
      </div>
      {expandedExerciseId && (() => {
        const item = exercises.find(candidate => candidate.id === expandedExerciseId);
        if (!item) return null;
        const result = results.current[item.id];
        const targetTotal = Array.from({ length: Math.max(0, Math.floor(item.sets || 0)) }, (_, roundIndex) => item.measurement === "repetitions" ? item.repetitionTargets?.[roundIndex] ?? item.reps ?? 0 : item.durationTargets?.[roundIndex] ?? item.durationSeconds ?? 0).reduce((sum, value) => sum + Math.max(0, value), 0);
        const actualTotal = item.measurement === "repetitions" ? result?.repetitions ?? 0 : result?.durationSeconds ?? 0;
        const percent = targetTotal > 0 ? Math.min(100, Math.round(actualTotal / targetTotal * 100)) : null;
        return typeof document === "undefined" ? null : createPortal(<div className="workout-detail-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setExpandedExerciseId(null); }}><section className="workout-exercise-expanded" role="dialog" aria-modal="true" aria-label={`تفاصيل ${item.name}`} onTouchStart={event => { detailTouchStart.current = event.touches[0]?.clientY ?? 0; }} onTouchEnd={event => { if ((event.changedTouches[0]?.clientY ?? detailTouchStart.current) - detailTouchStart.current > 90) setExpandedExerciseId(null); }}>
          <header><b>{item.name}</b><button type="button" aria-label="إغلاق تفاصيل التمرين" onClick={() => setExpandedExerciseId(null)}>×</button></header>
          <div className="workout-set-table"><div className="workout-set-table-head"><span>الجولة</span><span>المستهدف</span><span>المنجز</span><span>الراحة</span></div>
            {Array.from({ length: Math.max(0, Math.floor(item.sets || 0)) }, (_, roundIndex) => {
              const round = roundIndex + 1;
              const savedSet = result?.sets?.find(set => set.round === round);
              const target = item.measurement === "repetitions" ? item.repetitionTargets?.[roundIndex] ?? item.reps ?? 0 : item.durationTargets?.[roundIndex] ?? item.durationSeconds ?? 0;
              const targetLabel = item.measurement === "repetitions" ? `${ar(target)} عدة` : `${ar(target)} ث`;
              const actualLabel = savedSet ? item.measurement === "repetitions" ? `${ar(savedSet.repetitions ?? 0)} عدة` : `${ar(savedSet.durationSeconds)} ث` : "—";
              return <div className="workout-set-table-row" key={round}><b>{ar(round)}</b><span>{targetLabel}</span><strong>{actualLabel}</strong><small>{round < item.sets ? `${ar(Math.max(0, item.restSeconds))} ث` : item.restAfterSeconds ? `${ar(item.restAfterSeconds)} ث` : "—"}</small></div>;
            })}
          </div>
          <footer><span>الإجمالي <b>{ar(actualTotal)} من {targetTotal > 0 ? ar(targetTotal) : "—"} {item.measurement === "repetitions" ? "عدة" : "ثانية"}</b></span><span>تحقيق المستهدف <b>{percent === null ? "—" : `${ar(percent)}٪`}</b></span></footer>
        </section></div>, document.body);
      })()}
    </div>

    {mode !== "sessionDone" ? <>
      <section className="workout-current" aria-label="التمرين الحالي">
        {mode !== "ready" && <><p className="workout-status">{status}</p><h1>{exercise.name}</h1></>}
        {(mode === "prepare" || mode === "work" || mode === "rest" || mode === "paused") && <div key={`${mode}-${pausedMode}`} className={`workout-clock ${finalCountdown ? "clock-pulse" : ""}`} style={{ "--timer-progress": `${mode === "prepare" ? seconds / Math.max(1, preparationSeconds) * 100 : progress}%` } as CSSProperties}>
          <div><strong>{mode === "prepare" ? ar(seconds) : clock(seconds)}</strong><span>{mode === "prepare" ? "وتبدأ الجولة" : mode === "paused" ? "المؤقت متوقف" : mode === "rest" ? restExpired ? "انتهت الراحة" : "استراحة" : mode === "work" && exercise.measurement === "duration" ? targetDuration === null ? "الوقت المنقضي" : "زمن الجولة" : "زمن الجولة المنقضي"}</span>{mode === "work" && <small>{exercise.measurement === "repetitions" ? targetReps === null ? "هدف التكرار غير محدد" : `${ar(targetReps)} تكرار مستهدف` : targetDuration === null ? "مدة مستهدفة غير محددة" : `المستهدف ${clock(targetDuration)}`}</small>}{mode === "rest" && !restExpired && <small>{`راحة قبل الجولة ${ar(setIndex)}`}</small>}</div>
        </div>}
        {mode === "ready" && <div className="workout-clock workout-ready-clock"><div><span className="workout-clock-label">هدف الجولة</span><strong>{exercise.measurement === "repetitions" ? targetReps === null ? "—" : ar(targetReps) : targetDuration === null ? "—" : clock(targetDuration)}</strong><span>{exercise.measurement === "repetitions" ? `عدات ${exercise.name}` : `مدة ${exercise.name}`}</span></div></div>}
        {mode === "ready" && <>
          {exercise.measurement === "repetitions" && targetReps === null && <p className="workout-plan-notice">لم يحدد هدف العدّات في الخطة. سجّل ما أنجزته أثناء الراحة.</p>}
          {exercise.measurement === "duration" && targetDuration === null && <p className="workout-plan-notice">لم تحدد مدة لهذه الجولة. سيعمل المؤقت تصاعديًا حتى تنهيها.</p>}
          {!sets && <p className="workout-plan-notice">لم يحدد عدد الجولات لهذا التمرين في الخطة. عدّل الخطة قبل البدء.</p>}
        </>}
      </section>

      <section className="workout-execution" aria-label="تنفيذ الجولة">
          {mode === "ready" && <button type="button" className="primary workout-main" onClick={startSet} disabled={!sets}>ابدأ الجولة</button>}
        {mode === "work" && <button type="button" className="primary workout-main" onClick={finishRound}>أنهيت الجولة</button>}
        {mode === "prepare" && <button type="button" className="soft workout-secondary" onClick={pauseClock}>إيقاف مؤقت</button>}
        {mode === "work" && <button type="button" className="soft workout-secondary" onClick={pauseClock}>إيقاف مؤقت</button>}
        {mode === "rest" && <>
          {pendingSet && <div className="workout-rep-confirm"><b>كم تكرارًا أنجزت؟</b><span>المستهدف: {pendingSet.targetRepetitions === undefined ? "لم يحدد" : `${ar(pendingSet.targetRepetitions)} تكرارًا`}</span><div><button type="button" aria-label="تقليل التكرارات" onClick={() => setRepetitionCount(count => Math.max(0, count - 1))}>−</button><strong>{ar(repetitionCount)}</strong><button type="button" aria-label="زيادة التكرارات" onClick={() => setRepetitionCount(count => count + 1)}>+</button></div><button type="button" className="primary workout-confirm" onClick={() => finalizePendingSet(repetitionCount)}>تأكيد</button></div>}
          {!restExpired && <div className="rest-actions"><button type="button" onClick={() => { if (modeRef.current !== "rest" || restExpiredRef.current) return; const remaining = Math.max(0, phaseTarget.current - elapsedInPhase() / 1000); estimateAdjustmentSeconds.current -= remaining; commitPhase("rest"); restExpiredRef.current = true; setRestExpired(true); setSeconds(0); afterRest(); }}>تخطي الراحة</button><button type="button" onClick={() => { if (modeRef.current !== "rest" || restExpiredRef.current) return; phaseTarget.current += 30; estimateAdjustmentSeconds.current += 30; setSeconds(value => value + 30); }}>+ ٣٠ ثانية</button></div>}
          {!restExpired && <button type="button" className="soft workout-secondary" onClick={pauseClock}>إيقاف مؤقت</button>}
        </>}
        {mode === "paused" && <>
          {pendingSet && <div className="workout-rep-confirm"><b>كم تكرارًا أنجزت؟</b><span>المستهدف: {pendingSet.targetRepetitions === undefined ? "لم يحدد" : `${ar(pendingSet.targetRepetitions)} تكرارًا`}</span><div><button type="button" aria-label="تقليل التكرارات" onClick={() => setRepetitionCount(count => Math.max(0, count - 1))}>−</button><strong>{ar(repetitionCount)}</strong><button type="button" aria-label="زيادة التكرارات" onClick={() => setRepetitionCount(count => count + 1)}>+</button></div><button type="button" className="primary workout-confirm" onClick={() => finalizePendingSet(repetitionCount)}>تأكيد</button></div>}
          <button type="button" className="primary workout-main" onClick={resumeClock}>استئناف</button>
        </>}
        {mode === "exerciseDone" && <div className="exercise-finish"><span>✓</span><b>اكتمل {exercise.name}</b><button type="button" className="primary workout-main" onClick={nextAfterExercise}>{nextExercise ? `التمرين التالي · ${nextExercise.name}` : "عرض ملخص الحصة"}</button></div>}
        {sessionStarted && mode !== "sessionDone" && <button type="button" className="workout-end-session" onClick={requestExit}>إنهاء الجلسة</button>}
      </section>
    </> : <section className="session-finish">
      <span>✓</span><p>{endedEarly ? "ملخص الجلسة" : "اكتملت الحصة"}</p><h1>{ar(completedExerciseCount)} من {ar(exercises.length)} تمارين</h1>
      <div className="session-finish-kpis"><article><b>{ar(completedRounds)} / {ar(totalRounds)}</b><small>الجولات المنجزة</small></article><article><b>{ar(totalRepetitions)}</b><small>التكرارات الفعلية</small></article><article><b>{clock(sessionElapsed)}</b><small>الزمن الإجمالي</small></article></div>
      <p className="workout-duration-comparison">{expectedTotalSeconds === null ? "لا توجد مدة سابقة للمقارنة" : `المتوقع ${clock(expectedTotalSeconds)} · الفعلي ${clock(sessionElapsed)} · ${sessionElapsed <= expectedTotalSeconds ? "أسرع" : "أطول"} بـ ${clock(Math.abs(sessionElapsed - expectedTotalSeconds))}`}</p>
      <div className="workout-result-list">{exercises.map(item => {
        const result = results.current[item.id];
        return <article key={item.id}><div><b>{item.name}</b><span>{ar(result?.completedSets ?? 0)} من {ar(item.sets)} جولات</span></div><strong>{item.measurement === "repetitions" ? `${ar(result?.repetitions ?? 0)} عدة` : clock(result?.durationSeconds ?? 0)}</strong>{result?.sets?.length ? <small>{result.sets.map(set => set.repetitions !== undefined ? `${ar(set.repetitions)} من ${set.targetRepetitions ? ar(set.targetRepetitions) : "—"} عدة` : `${clock(set.durationSeconds)} من ${set.targetDurationSeconds ? clock(set.targetDurationSeconds) : "—"}`).join(" · ")}</small> : null}</article>;
      })}</div>
      <div className="session-finish-actions">
        <button type="button" className="primary" onClick={finishSession} disabled={finished.current}>حفظ النتائج والعودة إلى اليوم</button>
        <button type="button" className="session-restart-button" onClick={() => setRestartConfirmOpen(true)}>إعادة الجلسة</button>
      </div>
    </section>}
    {restartConfirmOpen && typeof document !== "undefined" && createPortal(<div className="workout-confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setRestartConfirmOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="workout-restart-title"><h3 id="workout-restart-title">إعادة الجلسة؟</h3><p>ستبدأ من التمرين الأول، ولن تُحفظ نتائج الجلسة الحالية. اختر «حفظ النتائج والعودة إلى اليوم» للاحتفاظ بها.</p><div><button type="button" onClick={() => setRestartConfirmOpen(false)}>إلغاء</button><button type="button" className="danger" onClick={restartSession}>ابدأ من جديد</button></div></section></div>, document.body)}
    {settingsOpen && onCloseSettings && onSaveActivity && onDeleteActivity && typeof document !== "undefined" && createPortal(<WorkoutSettings activity={activity} records={executionRecords} onClose={onCloseSettings} onSave={onSaveActivity} onSaveProgression={onSaveProgression} onDelete={onDeleteActivity}/>, document.body)}
  </section>;
}
