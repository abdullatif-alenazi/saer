"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { PlannedActivity, WorkoutExerciseResult, WorkoutSetResult } from "./local-store";

const ar = (value: number, pad = 1) => Math.max(0, Math.floor(value)).toLocaleString("ar-SA", { minimumIntegerDigits: pad, useGrouping: true });
const clock = (seconds: number) => `${ar(Math.floor(Math.max(0, seconds) / 60), 2)}:${ar(Math.floor(Math.max(0, seconds) % 60), 2)}`;
const endTime = (seconds: number) => new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" }).format(Date.now() + Math.max(0, seconds) * 1000);
type Mode = "ready" | "prepare" | "work" | "rest" | "paused" | "exerciseDone" | "sessionDone";
type ClockMode = "prepare" | "work" | "rest";
type PendingSet = { round: number; durationSeconds: number; targetRepetitions?: number; targetDurationSeconds?: number };
type WorkoutSnapshot = {
  activityId: string; date: string; exerciseIndex: number; setIndex: number; mode: Mode; pausedMode: ClockMode;
  phaseElapsedMs: number; phaseTargetSeconds: number; repetitionCount: number; restSeconds: number;
  restExpired: boolean; pendingSet: PendingSet | null; sessionElapsedMs: number; sessionStarted: boolean;
  results: Record<string, WorkoutExerciseResult>; expectedAdjustment: number;
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

export default function WorkoutRunner({ activity, date, onExit, onFinish, previousSessions = [] }: {
  activity: PlannedActivity;
  date: string;
  onExit: () => void;
  onFinish: (minutes: number, repetitions: number, durationSeconds?: number, exerciseResults?: WorkoutExerciseResult[], restDurationSeconds?: number) => void;
  previousSessions?: Array<{ durationSeconds?: number; exerciseResults?: WorkoutExerciseResult[] }>;
}) {
  const exercises = activity.exercises ?? [];
  const savedAtMount = useRef<WorkoutSnapshot | null>(typeof window === "undefined" ? null : readSnapshot(activity.id, date));
  const saved = savedAtMount.current;
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
  const pendingSetRef = useRef<PendingSet | null>(saved?.pendingSet ?? null);
  const restExpiredRef = useRef(saved?.restExpired ?? false);

  const exercise = exercises[exerciseIndex];
  const sets = exercise && Number.isFinite(exercise.sets) ? Math.max(0, Math.floor(exercise.sets)) : 0;
  const targetReps = exercise?.measurement === "repetitions" && Number.isFinite(exercise.reps) && (exercise.reps ?? 0) > 0 ? Math.floor(exercise.reps!) : null;
  const targetDuration = exercise?.measurement === "duration" && Number.isFinite(exercise.durationSeconds) && (exercise.durationSeconds ?? 0) > 0 ? Math.floor(exercise.durationSeconds!) : null;
  const automaticStart = activity.workoutStartMode === "automatic";

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { pendingSetRef.current = pendingSet; }, [pendingSet]);
  useEffect(() => { restExpiredRef.current = restExpired; }, [restExpired]);
  useEffect(() => { restored.current = true; }, []);

  const configuredEstimate = useMemo(() => {
    const configured = Number.isFinite(activity.expectedMinutes) && activity.expectedMinutes > 0 ? Math.round(activity.expectedMinutes * 60) : 0;
    const configuredExerciseTime = exercises.reduce((total, item) => {
      const itemSets = Number.isFinite(item.sets) ? Math.max(0, Math.floor(item.sets)) : 0;
      const targetTime = item.measurement === "duration" && Number.isFinite(item.durationSeconds) ? Math.max(0, item.durationSeconds ?? 0) * itemSets : 0;
      const restTime = Math.max(0, Number.isFinite(item.restSeconds) ? item.restSeconds : 0) * Math.max(0, itemSets - 1);
      return total + targetTime + restTime;
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
  const completionPercent = totalRounds ? Math.min(100, Math.round(completedRounds / totalRounds * 100)) : 0;
  const sessionRemaining = expectedTotalSeconds === null ? null : Math.max(0, expectedTotalSeconds + estimateAdjustmentSeconds.current - sessionElapsed);
  const expectedEnd = sessionRemaining === null ? null : endTime(sessionRemaining);
  const nextExercise = exercises[exerciseIndex + 1];
  const totalBreaks = exercises.reduce((sum, item) => sum + Math.max(0, (Number.isFinite(item.sets) ? Math.floor(item.sets) : 0) - 1), 0);
  const completedExerciseCount = exercises.filter(item => (results.current[item.id]?.completedSets ?? 0) >= (Number.isFinite(item.sets) ? item.sets : 0) && item.sets > 0).length;
  const totalRepetitions = Object.values(results.current).reduce((sum, item) => sum + item.repetitions, 0);
  const finalCountdown = (mode === "prepare" || mode === "rest" && automaticStart) && seconds > 0 && seconds <= 5;

  function enterMode(next: Mode) { modeRef.current = next; setMode(next); }
  function elapsedInPhase() { return phaseElapsedBase.current + (phaseAnchor.current === null ? 0 : Math.max(0, performance.now() - phaseAnchor.current)); }
  function elapsedSessionMs() { return sessionElapsedBaseMs.current + (sessionAnchor.current === null ? 0 : Math.max(0, Date.now() - sessionAnchor.current)); }
  function startPhase(next: ClockMode, durationSeconds: number) {
    phaseElapsedBase.current = 0;
    phaseAnchor.current = performance.now();
    phaseTarget.current = Math.max(0, durationSeconds);
    setSeconds(next === "work" && targetDuration === null ? 0 : Math.max(0, durationSeconds));
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
      sessionElapsedMs: sessionMs, sessionStarted, results: results.current, expectedAdjustment: estimateAdjustmentSeconds.current,
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
  function beginWorkDirect() {
    if (modeRef.current !== "rest") return;
    commitPhase("rest");
    startPhase("work", targetDuration ?? 0);
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
  function nextAfterExercise() {
    if (modeRef.current !== "exerciseDone") return;
    if (exerciseIndex >= exercises.length - 1) {
      sessionElapsedBaseMs.current = elapsedSessionMs();
      sessionAnchor.current = null;
      setSessionElapsed(Math.floor(sessionElapsedBaseMs.current / 1000));
      enterMode("sessionDone");
      return;
    }
    setExerciseIndex(index => index + 1);
    setSetIndex(1);
    setRepetitionCount(0);
    setSeconds(0);
    enterMode("ready");
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
      if (automaticStart) beginWorkDirect();
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
    startPhase("prepare", 5);
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
        startPhase("work", targetDuration ?? 0);
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
  const progress = mode === "rest" ? Math.max(0, Math.min(100, seconds / Math.max(1, exercise.restSeconds) * 100)) : mode === "work" && targetDuration ? Math.max(0, Math.min(100, seconds / targetDuration * 100)) : mode === "prepare" ? Math.max(0, Math.min(100, seconds / 5 * 100)) : 100;
  const status = mode === "ready" ? "جاهز" : mode === "prepare" ? "استعد" : mode === "work" ? "التمرين" : mode === "rest" ? restExpired ? "جاهز للجولة التالية" : "راحة بين الجولات" : mode === "paused" ? "متوقف مؤقتًا" : mode === "exerciseDone" ? "اكتمل التمرين" : "اكتملت الحصة";
  const cardRemaining = mode === "ready" ? expectedTotalSeconds : sessionRemaining;

  return <section className={`workout-runner workout-${mode}`} aria-live="polite">
    <header className="workout-head">
      <button type="button" aria-label="العودة" onClick={onExit}>×</button>
      <div className="workout-summary-head"><b>{`التمرين ${ar(exerciseIndex + 1)} من ${ar(exercises.length)}`}</b><span>{mode === "ready" ? "مدة الحصة المتوقعة" : "المتبقي تقديريًا"} <strong>{cardRemaining === null ? "غير محدد" : clock(cardRemaining)}</strong></span></div>
    </header>
    <div className="workout-session-progress" aria-label={`تقدم الحصة ${completionPercent}%`}>
      <div><span>تقدم الحصة</span><b>{ar(completedRounds)} / {ar(totalRounds)} جولات</b></div>
      <i><em style={{ width: `${completionPercent}%` }} /></i>
      {sessionStarted && <div className="workout-session-timing"><span>المنقضي <b>{clock(sessionElapsed)}</b></span>{expectedEnd && <span>الانتهاء نحو <b>{expectedEnd}</b></span>}</div>}
    </div>

    {mode !== "sessionDone" ? <>
      <section className="workout-current" aria-label="التمرين الحالي">
        <p className="workout-status">{status}</p>
        <h1>{exercise.name}</h1>
        <p className="set-label">الجولة <b>{ar(setIndex)}</b> من {sets ? ar(sets) : "غير محدد"}</p>
        {(mode === "ready" || mode === "work" || mode === "prepare" || mode === "rest" || mode === "paused") && <div className="workout-target"><strong>{exercise.measurement === "repetitions" ? targetReps === null ? "—" : ar(targetReps) : targetDuration === null ? "—" : clock(targetDuration)}</strong><span>{exercise.measurement === "repetitions" ? "عدة مستهدفة" : "مدة الجولة"}</span></div>}
        {(mode === "prepare" || mode === "work" || mode === "rest" || mode === "paused") && <div key={`${mode}-${pausedMode}`} className={`workout-clock ${finalCountdown ? "clock-pulse" : ""}`} style={{ "--timer-progress": `${mode === "prepare" ? seconds / 5 * 100 : progress}%` } as CSSProperties}>
          <div><strong>{mode === "prepare" ? ar(seconds) : mode === "work" && targetDuration === null ? clock(seconds) : clock(seconds)}</strong><span>{mode === "prepare" ? "وتبدأ الجولة" : mode === "paused" ? "المؤقت متوقف" : mode === "rest" ? restExpired ? "انتهت الراحة" : `راحة قبل الجولة ${ar(setIndex)}` : mode === "work" && exercise.measurement === "duration" ? targetDuration === null ? "الوقت المنقضي" : "زمن الجولة" : "زمن الجولة المنقضي"}</span></div>
        </div>}
        {mode === "ready" && <>
          {exercise.measurement === "repetitions" && targetReps === null && <p className="workout-plan-notice">لم يحدد هدف العدّات في الخطة. سجّل ما أنجزته أثناء الراحة.</p>}
          {exercise.measurement === "duration" && targetDuration === null && <p className="workout-plan-notice">لم تحدد مدة لهذه الجولة. سيعمل المؤقت تصاعديًا حتى تنهيها.</p>}
          {!sets && <p className="workout-plan-notice">لم يحدد عدد الجولات لهذا التمرين في الخطة. عدّل الخطة قبل البدء.</p>}
          <details className="workout-session-details"><summary>تفاصيل الجلسة <span>{ar(exercises.length)} تمارين · {ar(totalRounds)} جولات · {ar(totalBreaks)} راحات</span></summary><div>{exercises.map(item => <article key={item.id}><b>{item.name}</b><span>{ar(item.sets)} جولات × {item.measurement === "duration" ? `${ar(item.durationSeconds ?? 0)} ثانية` : `${ar(item.reps ?? 0)} تكرار`}</span><small>راحة {clock(Math.max(0, item.restSeconds))}</small></article>)}</div></details>
        </>}
      </section>

      <section className="workout-execution" aria-label="تنفيذ الجولة">
        {mode === "ready" && <button type="button" className="primary workout-main" onClick={startSet} disabled={!sets}>ابدأ الجولة</button>}
        {mode === "work" && <button type="button" className="primary workout-main" onClick={finishRound}>أنهيت الجولة</button>}
        {mode === "prepare" && <button type="button" className="soft workout-secondary" onClick={pauseClock}>إيقاف مؤقت</button>}
        {mode === "work" && <button type="button" className="soft workout-secondary" onClick={pauseClock}>إيقاف مؤقت</button>}
        {mode === "rest" && <>
          {pendingSet && <div className="workout-rep-confirm"><b>كم تكرارًا أنجزت؟</b><span>المستهدف: {targetReps === null ? "لم يحدد" : `${ar(targetReps)} تكرارًا`}</span><div><button type="button" aria-label="تقليل التكرارات" onClick={() => setRepetitionCount(count => Math.max(0, count - 1))}>−</button><strong>{ar(repetitionCount)}</strong><button type="button" aria-label="زيادة التكرارات" onClick={() => setRepetitionCount(count => count + 1)}>+</button></div><button type="button" className="primary workout-confirm" onClick={() => finalizePendingSet(repetitionCount)}>تأكيد</button></div>}
          {!restExpired && <div className="rest-actions"><button type="button" onClick={() => { if (modeRef.current !== "rest" || restExpiredRef.current) return; const remaining = Math.max(0, phaseTarget.current - elapsedInPhase() / 1000); estimateAdjustmentSeconds.current -= remaining; commitPhase("rest"); restExpiredRef.current = true; setRestExpired(true); setSeconds(0); afterRest(); }}>تخطي الراحة</button><button type="button" onClick={() => { if (modeRef.current !== "rest" || restExpiredRef.current) return; phaseTarget.current += 30; estimateAdjustmentSeconds.current += 30; setSeconds(value => value + 30); }}>+ ٣٠ ثانية</button></div>}
          {!restExpired && <button type="button" className="soft workout-secondary" onClick={pauseClock}>إيقاف مؤقت</button>}
        </>}
        {mode === "paused" && <>
          {pendingSet && <div className="workout-rep-confirm"><b>كم تكرارًا أنجزت؟</b><span>المستهدف: {targetReps === null ? "لم يحدد" : `${ar(targetReps)} تكرارًا`}</span><div><button type="button" aria-label="تقليل التكرارات" onClick={() => setRepetitionCount(count => Math.max(0, count - 1))}>−</button><strong>{ar(repetitionCount)}</strong><button type="button" aria-label="زيادة التكرارات" onClick={() => setRepetitionCount(count => count + 1)}>+</button></div><button type="button" className="primary workout-confirm" onClick={() => finalizePendingSet(repetitionCount)}>تأكيد</button></div>}
          <button type="button" className="primary workout-main" onClick={resumeClock}>استئناف</button>
        </>}
        {mode === "exerciseDone" && <div className="exercise-finish"><span>✓</span><b>اكتمل {exercise.name}</b><button type="button" className="primary workout-main" onClick={nextAfterExercise}>{nextExercise ? `التمرين التالي · ${nextExercise.name}` : "عرض ملخص الحصة"}</button></div>}
      </section>
      <nav className="workout-exercise-strip" aria-label="تمارين الحصة">{exercises.map((item, index) => {
        const result = results.current[item.id];
        const done = Boolean(item.sets && (result?.completedSets ?? 0) >= item.sets);
        return <div key={item.id} className={`${index === exerciseIndex ? "current" : ""} ${done ? "complete" : ""}`} aria-current={index === exerciseIndex ? "step" : undefined}><b>{done ? "✓" : ar(result?.completedSets ?? 0)}</b><span>{item.name}</span></div>;
      })}</nav>
    </> : <section className="session-finish">
      <span>✓</span><p>اكتملت الحصة</p><h1>{ar(completedExerciseCount)} من {ar(exercises.length)} تمارين</h1>
      <div className="session-finish-kpis"><b>{ar(completedRounds)} / {ar(totalRounds)}</b><small>الجولات المنجزة</small><b>{ar(totalRepetitions)}</b><small>التكرارات الفعلية</small><b>{clock(sessionElapsed)}</b><small>الزمن الإجمالي</small></div>
      <p className="workout-duration-comparison">{expectedTotalSeconds === null ? "لا توجد مدة سابقة للمقارنة" : `المتوقع ${clock(expectedTotalSeconds)} · الفعلي ${clock(sessionElapsed)} · ${sessionElapsed <= expectedTotalSeconds ? "أسرع" : "أطول"} بـ ${clock(Math.abs(sessionElapsed - expectedTotalSeconds))}`}</p>
      <div className="workout-result-list">{exercises.map(item => {
        const result = results.current[item.id];
        return <article key={item.id}><div><b>{item.name}</b><span>{ar(result?.completedSets ?? 0)} من {ar(item.sets)} جولات</span></div><strong>{item.measurement === "repetitions" ? `${ar(result?.repetitions ?? 0)} عدة` : clock(result?.durationSeconds ?? 0)}</strong>{result?.sets?.length ? <small>{result.sets.map(set => set.repetitions !== undefined ? `${ar(set.repetitions)} من ${set.targetRepetitions ? ar(set.targetRepetitions) : "—"} عدة` : `${clock(set.durationSeconds)} من ${set.targetDurationSeconds ? clock(set.targetDurationSeconds) : "—"}`).join(" · ")}</small> : null}</article>;
      })}</div>
      <button type="button" className="primary" onClick={finishSession} disabled={finished.current}>حفظ النتائج والإنهاء</button>
    </section>}
  </section>;
}
