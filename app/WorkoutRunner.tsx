"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { PlannedActivity, WorkoutExerciseResult, WorkoutSetResult } from "./local-store";
import WeekStrip from "./WeekStrip";

const ar = (value: number, pad = 1) => Math.max(0, Math.floor(value)).toLocaleString("ar-SA", { minimumIntegerDigits: pad, useGrouping: true });
const clock = (seconds: number) => `${ar(Math.floor(Math.max(0, seconds) / 60), 2)}:${ar(Math.floor(Math.max(0, seconds) % 60), 2)}`;
const endTime = (seconds: number) => new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" }).format(Date.now() + Math.max(0, seconds) * 1000);
type Mode = "ready" | "prepare" | "work" | "rest" | "paused" | "exerciseDone" | "sessionDone";
type ClockMode = "prepare" | "work" | "rest";

function exerciseResult(exercise: NonNullable<PlannedActivity["exercises"]>[number], targetSets: number): WorkoutExerciseResult {
  return { exerciseId: exercise.id, name: exercise.name, measurement: exercise.measurement, completedSets: 0, targetSets, repetitions: 0, durationSeconds: 0, sets: [] };
}

export default function WorkoutRunner({ activity, date, today, calendarMode, weekStartsOn, onDateChange, onExit, onFinish, onOpenAchievements }: {
  activity: PlannedActivity;
  date: string;
  today: string;
  calendarMode: "islamic" | "gregory" | "mixed";
  weekStartsOn: "saturday" | "sunday";
  onDateChange: (date: string) => void;
  onExit: () => void;
  onFinish: (minutes: number, repetitions: number, durationSeconds?: number, exerciseResults?: WorkoutExerciseResult[], restDurationSeconds?: number) => void;
  onOpenAchievements: () => void;
}) {
  const exercises = activity.exercises ?? [];
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(1);
  const [mode, setMode] = useState<Mode>("ready");
  const [pausedMode, setPausedMode] = useState<ClockMode>("work");
  const [seconds, setSeconds] = useState(0);
  const [repetitionCount, setRepetitionCount] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const modeRef = useRef<Mode>(mode);
  const phaseAnchor = useRef<number | null>(null);
  const phaseElapsedBase = useRef(0);
  const phaseTarget = useRef(0);
  const restElapsedMs = useRef(0);
  const results = useRef<Record<string, WorkoutExerciseResult>>({});
  const sessionStartMs = useRef<number | null>(null);
  const pausedTotalMs = useRef(0);
  const pausedAtMs = useRef<number | null>(null);
  const estimateAdjustmentSeconds = useRef(0);
  const finished = useRef(false);

  const exercise = exercises[exerciseIndex];
  const sets = exercise && Number.isFinite(exercise.sets) ? Math.max(0, Math.floor(exercise.sets)) : 0;
  const targetReps = exercise?.measurement === "repetitions" && Number.isFinite(exercise.reps) && (exercise.reps ?? 0) > 0 ? Math.floor(exercise.reps!) : null;
  const targetDuration = exercise?.measurement === "duration" && Number.isFinite(exercise.durationSeconds) && (exercise.durationSeconds ?? 0) > 0 ? Math.floor(exercise.durationSeconds!) : null;

  useEffect(() => { modeRef.current = mode; }, [mode]);

  const expectedTotalSeconds = useMemo(() => {
    const configured = Number.isFinite(activity.expectedMinutes) && activity.expectedMinutes > 0 ? Math.round(activity.expectedMinutes * 60) : 0;
    const configuredExerciseTime = exercises.reduce((total, item) => {
      const itemSets = Number.isFinite(item.sets) ? Math.max(0, Math.floor(item.sets)) : 0;
      const targetTime = item.measurement === "duration" && Number.isFinite(item.durationSeconds) ? Math.max(0, item.durationSeconds ?? 0) * itemSets : 0;
      const restTime = Math.max(0, Number.isFinite(item.restSeconds) ? item.restSeconds : 0) * Math.max(0, itemSets - 1);
      return total + targetTime + restTime + itemSets * 5;
    }, 0);
    const containsRepetitionExercise = exercises.some(item => item.measurement === "repetitions");
    if (configured > 0) return Math.max(configured, configuredExerciseTime);
    if (!containsRepetitionExercise && configuredExerciseTime > 0) return configuredExerciseTime;
    return null;
  }, [activity.expectedMinutes, exercises]);

  const totalRounds = exercises.reduce((total, item) => total + (Number.isFinite(item.sets) ? Math.max(0, Math.floor(item.sets)) : 0), 0);
  const completedRounds = Object.values(results.current).reduce((total, item) => total + item.completedSets, 0);
  const completionPercent = totalRounds ? Math.min(100, Math.round(completedRounds / totalRounds * 100)) : 0;
  const sessionRemaining = expectedTotalSeconds === null ? null : Math.max(0, expectedTotalSeconds + estimateAdjustmentSeconds.current - sessionElapsed);

  useEffect(() => {
    if (mode !== "prepare" && mode !== "work" && mode !== "rest") return;
    const clockMode = mode as ClockMode;
    const tick = () => {
      // Ignore a stale interval immediately after a synchronous phase transition.
      if (modeRef.current !== clockMode) return;
      const elapsedMs = phaseElapsedBase.current + (phaseAnchor.current === null ? 0 : Math.max(0, performance.now() - phaseAnchor.current));
      if (clockMode === "work" && (exercise?.measurement === "repetitions" || targetDuration === null)) {
        setSeconds(Math.floor(elapsedMs / 1000));
        return;
      }
      const remaining = Math.max(0, Math.ceil(phaseTarget.current - elapsedMs / 1000));
      setSeconds(remaining);
      if (remaining !== 0) return;
      if (clockMode === "prepare") {
        commitPhase("prepare");
        beginWork(true);
      } else if (clockMode === "rest") {
        commitPhase("rest");
        enterMode("ready");
      } else if (clockMode === "work") {
        commitPhase("work");
        completeSet(true);
      }
    };
    tick();
    const timer = window.setInterval(tick, 200);
    const visibility = () => { if (document.visibilityState === "hidden") pauseClock(); };
    const pageHide = () => pauseClock();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pageHide);
    };
  }, [mode, exercise?.id, exercise?.measurement, targetDuration]);

  useEffect(() => {
    if (sessionStartMs.current === null || mode === "sessionDone") return;
    const update = () => setSessionElapsed(Math.floor(elapsedSessionMs() / 1000));
    update();
    const timer = window.setInterval(update, 500);
    return () => clearInterval(timer);
  }, [mode, sessionStartedAt]);

  const progress = useMemo(() => {
    if (mode === "rest") return Math.max(0, Math.min(100, seconds / Math.max(1, exercise?.restSeconds ?? 1) * 100));
    if (mode === "work" && targetDuration) return Math.max(0, Math.min(100, seconds / targetDuration * 100));
    if (mode === "prepare") return Math.max(0, Math.min(100, seconds / 5 * 100));
    return 100;
  }, [mode, seconds, exercise?.restSeconds, targetDuration]);

  if (!exercise) return <section className="workout-runner"><h1>لا توجد تمارين في الخطة.</h1><button className="primary" onClick={onExit}>عودة</button></section>;

  function enterMode(next: Mode) {
    modeRef.current = next;
    setMode(next);
  }
  function elapsedInPhase() {
    return phaseElapsedBase.current + (phaseAnchor.current === null ? 0 : Math.max(0, performance.now() - phaseAnchor.current));
  }
  function startPhase(next: ClockMode, durationSeconds: number) {
    phaseElapsedBase.current = 0;
    phaseAnchor.current = performance.now();
    phaseTarget.current = Math.max(0, durationSeconds);
    setSeconds(next === "work" && (!targetDuration) ? 0 : Math.max(0, durationSeconds));
    enterMode(next);
  }
  function commitPhase(clockMode: ClockMode) {
    if (modeRef.current !== clockMode || phaseAnchor.current === null) return 0;
    const elapsed = elapsedInPhase();
    phaseElapsedBase.current = elapsed;
    phaseAnchor.current = null;
    if (clockMode === "work") {
      const current = results.current[exercise.id] ?? exerciseResult(exercise, sets);
      current.durationSeconds += elapsed / 1000;
      results.current[exercise.id] = current;
    } else if (clockMode === "rest") {
      restElapsedMs.current += elapsed;
      setRestSeconds(Math.floor(restElapsedMs.current / 1000));
    }
    return elapsed / 1000;
  }
  function elapsedSessionMs() {
    if (sessionStartMs.current === null) return 0;
    const now = pausedAtMs.current ?? Date.now();
    return Math.max(0, now - sessionStartMs.current - pausedTotalMs.current);
  }
  function startSet() {
    if (modeRef.current !== "ready" || sets < 1) return;
    if (sessionStartMs.current === null) {
      sessionStartMs.current = Date.now();
      setSessionStartedAt(sessionStartMs.current);
    }
    setRepetitionCount(0);
    startPhase("prepare", 5);
  }
  function beginWork(alreadyCommitted = false) {
    if (alreadyCommitted) {
      if (modeRef.current !== "prepare") return;
    } else {
      if (modeRef.current !== "rest") return;
      const restLeft = Math.max(0, phaseTarget.current - elapsedInPhase() / 1000);
      estimateAdjustmentSeconds.current -= restLeft;
      commitPhase("rest");
    }
    startPhase("work", targetDuration ?? 0);
  }
  function pauseClock() {
    if (modeRef.current !== "prepare" && modeRef.current !== "work" && modeRef.current !== "rest") return;
    const currentMode = modeRef.current as ClockMode;
    setPausedMode(currentMode);
    phaseElapsedBase.current = elapsedInPhase();
    phaseAnchor.current = null;
    pausedAtMs.current = Date.now();
    enterMode("paused");
  }
  function resumeClock() {
    if (modeRef.current !== "paused") return;
    if (pausedAtMs.current !== null) pausedTotalMs.current += Date.now() - pausedAtMs.current;
    pausedAtMs.current = null;
    phaseAnchor.current = performance.now();
    enterMode(pausedMode);
  }
  function completeSet(alreadyCommitted = false) {
    if (modeRef.current !== "work") return;
    const actualWorkSeconds = alreadyCommitted ? phaseElapsedBase.current / 1000 : commitPhase("work");
    if (targetDuration !== null) estimateAdjustmentSeconds.current += actualWorkSeconds - targetDuration;
    // Lock the transition before updating React state so a double tap cannot record this set twice.
    const nextSet = setIndex + 1;
    const result = results.current[exercise.id] ?? exerciseResult(exercise, sets);
    result.completedSets += 1;
    const actualRepetitions = exercise.measurement === "repetitions" ? repetitionCount : undefined;
    if (actualRepetitions !== undefined) result.repetitions += actualRepetitions;
    const setResult: WorkoutSetResult = {
      round: setIndex,
      repetitions: actualRepetitions,
      targetRepetitions: targetReps ?? undefined,
      durationSeconds: Math.max(0, elapsedInPhase() / 1000),
      targetDurationSeconds: targetDuration ?? undefined,
      completedAt: new Date().toISOString(),
    };
    result.sets = [...(result.sets ?? []), setResult];
    results.current[exercise.id] = result;
    setRepetitionCount(0);
    if (nextSet > sets) {
      phaseAnchor.current = null;
      setSeconds(0);
      enterMode("exerciseDone");
    } else {
      setSetIndex(nextSet);
      const plannedRest = Number.isFinite(exercise.restSeconds) ? Math.max(0, exercise.restSeconds) : 0;
      startPhase("rest", plannedRest);
    }
  }
  function goToNextExercise() {
    if (modeRef.current !== "exerciseDone") return;
    if (exerciseIndex >= exercises.length - 1) {
      phaseAnchor.current = null;
      setSessionElapsed(Math.floor(elapsedSessionMs() / 1000));
      enterMode("sessionDone");
      return;
    }
    setExerciseIndex(index => index + 1);
    setSetIndex(1);
    setRepetitionCount(0);
    setSeconds(0);
    enterMode("ready");
  }
  function finishSession() {
    if (finished.current || modeRef.current !== "sessionDone") return;
    finished.current = true;
    const duration = Math.floor(elapsedSessionMs() / 1000);
    const completedResults = Object.values(results.current);
    const totalRepetitions = completedResults.reduce((sum, item) => sum + item.repetitions, 0);
    const totalRest = Math.floor(restElapsedMs.current / 1000);
    onFinish(Math.max(1, duration / 60), totalRepetitions, duration, completedResults, totalRest);
  }

  const status = mode === "ready" ? "استعداد" : mode === "prepare" ? "استعد" : mode === "work" ? "التمرين" : mode === "rest" ? "راحة بين الجولات" : mode === "paused" ? "متوقف مؤقتًا" : "اكتمل التمرين";
  const isFinalPulse = (mode === "prepare" || mode === "rest") && seconds > 0 && seconds <= 5;
  const expectedRemaining = mode === "ready" ? expectedTotalSeconds : sessionRemaining;
  const expectedEnd = expectedRemaining === null ? null : endTime(expectedRemaining);
  const nextExerciseItem = exercises[exerciseIndex + 1];
  const totalBreaks = exercises.reduce((sum, item) => sum + Math.max(0, (Number.isFinite(item.sets) ? Math.floor(item.sets) : 0) - 1), 0);

  return <section className={`workout-runner workout-${mode} ${isFinalPulse ? "is-counting-pulse" : ""}`} aria-live="polite">
    {isFinalPulse && <span key={`${mode}-${seconds}`} className="second-pulse" aria-hidden="true" />}
    {mode !== "sessionDone" ? <>
      <div className="workout-head">
        <button type="button" aria-label="العودة" onClick={onExit}>×</button>
        <div><button type="button" className="workout-achievement-title" onClick={onOpenAchievements}>{activity.name}</button><b>التمرين {ar(exerciseIndex + 1)} من {ar(exercises.length)}</b></div>
      </div>
      <div className="workout-session-progress" aria-label={`تقدم الحصة ${completionPercent}%`}>
        <div><span>تقدم الحصة</span><b>{ar(completedRounds)} / {ar(totalRounds)} جولات</b></div>
        <i><em style={{ width: `${completionPercent}%` }} /></i>
        <div className="workout-session-timing"><span>المنقضي <b>{clock(sessionElapsed)}</b></span><span>المتبقي تقديريًا <b>{expectedRemaining === null ? "غير محدد" : clock(expectedRemaining)}</b></span>{sessionStartedAt !== null && expectedEnd && <span>الانتهاء نحو <b>{expectedEnd}</b></span>}</div>
      </div>
      {mode === "ready" && <WeekStrip date={date} today={today} calendarMode={calendarMode} weekStartsOn={weekStartsOn} onChange={onDateChange} />}
      <p className="workout-status">{status}</p>
      <h1>{exercise.name}</h1>
      {mode !== "exerciseDone" && <p className="set-label">الجولة <b>{ar(setIndex)}</b> من {sets ? ar(sets) : "غير محدد"}</p>}
      {(mode === "ready" || mode === "work" || mode === "prepare") && <div className="workout-target">
        {exercise.measurement === "repetitions" ? <><strong>{targetReps === null ? "—" : ar(targetReps)}</strong><span>عدة مستهدفة</span></> : <><strong>{targetDuration === null ? "—" : ar(targetDuration)}</strong><span>ثانية مستهدفة</span></>}
      </div>}
      {(mode === "prepare" || mode === "work" || mode === "rest") && <div key={mode} className={`workout-clock ${isFinalPulse ? "clock-pulse" : ""}`} style={{ "--timer-progress": `${mode === "prepare" ? seconds / 5 * 100 : progress}%` } as CSSProperties}>
        <div><strong>{mode === "prepare" ? ar(seconds) : mode === "work" && targetDuration === null ? clock(seconds) : clock(seconds)}</strong><span>{mode === "prepare" ? "وتبدأ الجولة" : mode === "rest" ? (setIndex <= sets ? `راحة قبل الجولة ${ar(setIndex)}` : "راحة") : mode === "work" && exercise.measurement === "duration" ? targetDuration === null ? "الوقت المنقضي" : "باقي من الجولة" : "زمن الجولة"}</span></div>
      </div>}

      {mode === "ready" && <>
        {exercise.measurement === "repetitions" && targetReps === null && <p className="workout-plan-notice">لم يحدد هدف العدّات في الخطة. سجّل ما أنجزته وأنهِ الجولة يدويًا.</p>}
        {exercise.measurement === "duration" && targetDuration === null && <p className="workout-plan-notice">لم تحدد مدة لهذه الجولة. سيعمل المؤقت تصاعديًا حتى تنهيها.</p>}
        {!sets && <p className="workout-plan-notice">لم يحدد عدد الجولات لهذا التمرين في الخطة. عدّل الخطة قبل البدء.</p>}
        <div className="workout-before-card">
          <div><span>عدد التمارين</span><b>{ar(exercises.length)}</b><span>الجولات</span><b>{ar(totalRounds)}</b><span>فترات الراحة</span><b>{ar(totalBreaks)}</b></div>
          <div><span>مدة الحصة المتوقعة</span><b>{expectedTotalSeconds === null ? "غير محددة في الخطة" : clock(expectedTotalSeconds)}</b><span>الانتهاء المتوقع</span><b>{expectedEnd ?? "يتحدد بعد ضبط مدة الحصة"}</b></div>
          <p>{nextExerciseItem ? <>التمرين التالي: <b>{nextExerciseItem.name}</b></> : "هذا آخر تمرين في الخطة."}</p>
        </div>
        <button type="button" className="primary workout-main" onClick={startSet} disabled={!sets}>ابدأ الجولة</button>
      </>}

      {mode === "work" && exercise.measurement === "repetitions" && <div className="workout-rep-counter">
        <span>العدات المنجزة</span><div><button type="button" aria-label="تقليل العدات" onClick={() => setRepetitionCount(count => Math.max(0, count - 1))}>−</button><strong>{ar(repetitionCount)}</strong><button type="button" aria-label="زيادة العدات" onClick={() => setRepetitionCount(count => count + 1)}>+</button></div>
        <button type="button" className="primary workout-main" onClick={() => completeSet()}>أنهيت الجولة</button>
      </div>}
      {mode === "work" && exercise.measurement === "duration" && <button type="button" className="primary workout-main" onClick={() => completeSet()}>إنهاء الجولة</button>}
      {(mode === "prepare" || mode === "work" || mode === "rest") && <button type="button" className="soft workout-secondary" onClick={pauseClock}>إيقاف مؤقت</button>}
      {mode === "paused" && <div className="workout-paused-actions"><p>توقف المؤقت أثناء إخفاء الصفحة ولم يُحتسب وقت الغياب.</p><button type="button" className="primary" onClick={resumeClock}>استئناف</button></div>}
      {mode === "rest" && <div className="rest-actions">
        <button type="button" onClick={() => { if (modeRef.current !== "rest") return; phaseTarget.current += 30; estimateAdjustmentSeconds.current += 30; setSeconds(value => value + 30); }}>+ ٣٠ ثانية</button>
        <button type="button" onClick={() => beginWork()}>تخطي الراحة</button>
      </div>}
      {mode === "exerciseDone" && <div className="exercise-finish"><span>✓</span><h2>اكتمل {exercise.name}</h2><p>{ar(results.current[exercise.id]?.completedSets ?? 0)} من {sets ? ar(sets) : "—"} جولات · {exercise.measurement === "repetitions" ? `${ar(results.current[exercise.id]?.repetitions ?? 0)} عدة فعلية` : `${clock(results.current[exercise.id]?.durationSeconds ?? 0)} أداء فعلي`}</p><button type="button" className="primary" onClick={goToNextExercise}>{nextExerciseItem ? "التمرين التالي" : "عرض ملخص الحصة"}</button></div>}
    </> : <div className="session-finish">
      <span>✓</span><p>اكتملت الحصة</p><h1>{ar(exercises.length)} تمارين</h1>
      <div className="session-finish-kpis"><b>{clock(sessionElapsed)}</b><small>المدة الإجمالية</small><b>{clock(restSeconds)}</b><small>الراحة الفعلية</small><b>{ar(completedRounds)} / {ar(totalRounds)}</b><small>الجولات المنجزة</small></div>
      <div className="workout-result-list">{exercises.map(item => {
        const result = results.current[item.id];
        return <article key={item.id}><div><b>{item.name}</b><span>{ar(result?.completedSets ?? 0)} من {ar(Number.isFinite(item.sets) ? item.sets : 0)} جولات</span></div><strong>{item.measurement === "repetitions" ? `${ar(result?.repetitions ?? 0)} عدة` : clock(result?.durationSeconds ?? 0)}</strong>{result?.sets?.length ? <small>{result.sets.map(set => set.repetitions !== undefined ? `${ar(set.repetitions)} من ${set.targetRepetitions ? ar(set.targetRepetitions) : "—"} عدة` : `${clock(set.durationSeconds)} من ${set.targetDurationSeconds ? clock(set.targetDurationSeconds) : "—"}`).join(" · ")}</small> : null}</article>;
      })}</div>
      <button type="button" className="primary" onClick={finishSession} disabled={finished.current}>حفظ النتائج والإنهاء</button>
      <p>ستُحفظ تفاصيل الجولات ضمن سجل التمرين والإنجازات.</p>
    </div>}
  </section>;
}
