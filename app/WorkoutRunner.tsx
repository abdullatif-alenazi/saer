"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PlannedActivity, WorkoutExerciseResult } from "./local-store";
import WeekStrip from "./WeekStrip";

const ar=(value:number,pad=1)=>value.toLocaleString("ar-SA",{minimumIntegerDigits:pad,useGrouping:false});
const clock=(seconds:number)=>`${ar(Math.floor(seconds/60),2)}:${ar(seconds%60,2)}`;
type Mode="ready"|"prepare"|"work"|"rest"|"paused"|"exerciseDone"|"sessionDone";

export default function WorkoutRunner({activity,date,today,calendarMode,weekStartsOn,onDateChange,onExit,onFinish,onOpenAchievements}:{activity:PlannedActivity;date:string;today:string;calendarMode:"islamic"|"gregory"|"mixed";weekStartsOn:"saturday"|"sunday";onDateChange:(date:string)=>void;onExit:()=>void;onFinish:(minutes:number,repetitions:number,durationSeconds?:number,exerciseResults?:WorkoutExerciseResult[])=>void;onOpenAchievements:()=>void}){
 const exercises=activity.exercises??[];
 const [exerciseIndex,setExerciseIndex]=useState(0),[setIndex,setSetIndex]=useState(1),[mode,setMode]=useState<Mode>("ready"),[pausedMode,setPausedMode]=useState<"prepare"|"work"|"rest">("work"),[seconds,setSeconds]=useState(0),[workTotal,setWorkTotal]=useState(0),[restTotal,setRestTotal]=useState(0),[repetitions,setRepetitions]=useState(0);
 const modeRef=useRef<Mode>(mode),phaseAnchor=useRef(0),phaseElapsedBase=useRef(0),phaseTarget=useRef(0),workElapsedMs=useRef(0),restElapsedMs=useRef(0),exerciseResults=useRef<Record<string,WorkoutExerciseResult>>({});
 const exercise=exercises[exerciseIndex];
 const target=exercise?.measurement==="duration"?(exercise.durationSeconds??30):0;
 useEffect(()=>{modeRef.current=mode},[mode]);
 useEffect(()=>{if(mode!=="prepare"&&mode!=="work"&&mode!=="rest")return;const clockMode=mode;const tick=()=>{const elapsed=phaseElapsedBase.current+Math.max(0,performance.now()-phaseAnchor.current);if(clockMode==="work"&&exercise?.measurement==="repetitions"){setSeconds(Math.floor(elapsed/1000));return}const remaining=Math.max(0,Math.ceil(phaseTarget.current-elapsed/1000));setSeconds(remaining);if(remaining===0){commitPhase(clockMode);if(clockMode==="prepare"||clockMode==="rest")beginWork(true);else if(clockMode==="work")completeSet(true)}};tick();const timer=window.setInterval(tick,200),visibility=()=>{if(document.visibilityState==="hidden"&&modeRef.current!=="paused")pauseClock()},pageHide=()=>pauseClock();document.addEventListener("visibilitychange",visibility);window.addEventListener("pagehide",pageHide);return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",pageHide)}},[mode,exercise?.measurement]);
 const progress=useMemo(()=>{if(mode==="rest")return Math.max(0,Math.min(100,(seconds/(exercise?.restSeconds||1))*100));if(mode==="work"&&exercise?.measurement==="duration")return Math.max(0,Math.min(100,(seconds/(target||1))*100));return 100},[mode,seconds,exercise?.restSeconds,target]);
 if(!exercise)return <section className="workout-runner"><h1>لا توجد تمارين بعد.</h1><button className="primary" onClick={onExit}>عودة</button></section>;
 function startPhase(next:"prepare"|"work"|"rest",durationSeconds:number){phaseElapsedBase.current=0;phaseAnchor.current=performance.now();phaseTarget.current=durationSeconds;modeRef.current=next;setSeconds(next==="work"&&exercise?.measurement==="repetitions"?0:durationSeconds);setMode(next)}
 function elapsedInPhase(){return phaseElapsedBase.current+Math.max(0,performance.now()-phaseAnchor.current)}
 function commitPhase(clockMode:"prepare"|"work"|"rest"){if(!phaseAnchor.current)return;const elapsed=elapsedInPhase();phaseElapsedBase.current=elapsed;phaseAnchor.current=0;if(clockMode==="work"){workElapsedMs.current+=elapsed;setWorkTotal(Math.floor(workElapsedMs.current/1000));if(exercise){const current=exerciseResults.current[exercise.id]??{exerciseId:exercise.id,name:exercise.name,measurement:exercise.measurement,completedSets:0,targetSets:exercise.sets,repetitions:0,durationSeconds:0};current.durationSeconds+=elapsed/1000;exerciseResults.current[exercise.id]=current}}if(clockMode==="rest"){restElapsedMs.current+=elapsed;setRestTotal(Math.floor(restElapsedMs.current/1000))}}
 function pauseClock(){if(modeRef.current!=="prepare"&&modeRef.current!=="work"&&modeRef.current!=="rest")return;setPausedMode(modeRef.current);phaseElapsedBase.current=elapsedInPhase();phaseAnchor.current=0;modeRef.current="paused";setMode("paused")}
 function resumeClock(){phaseAnchor.current=performance.now();modeRef.current=pausedMode;setMode(pausedMode)}
 function completeSet(alreadyCommitted=false){
  if(!alreadyCommitted)commitPhase("work");
  const result=exerciseResults.current[exercise.id]??{exerciseId:exercise.id,name:exercise.name,measurement:exercise.measurement,completedSets:0,targetSets:exercise.sets,repetitions:0,durationSeconds:0};result.completedSets+=1;if(exercise.measurement==="repetitions"){result.repetitions+=exercise.reps??0;setRepetitions(value=>value+(exercise.reps??0))}exerciseResults.current[exercise.id]=result;
  if(setIndex>=exercise.sets){phaseAnchor.current=0;modeRef.current="exerciseDone";setMode("exerciseDone");setSeconds(0)}else{setSetIndex(value=>value+1);startPhase("rest",exercise.restSeconds)}
 }
 function beginWork(alreadyCommitted=false){if(!alreadyCommitted&&(modeRef.current==="rest"||modeRef.current==="prepare"))commitPhase(modeRef.current);startPhase("work",exercise.measurement==="duration"?(exercise.durationSeconds??30):0)}
 const startSet=()=>startPhase("prepare",5);
 const nextExercise=()=>{if(exerciseIndex>=exercises.length-1){modeRef.current="sessionDone";setMode("sessionDone");return}setExerciseIndex(value=>value+1);setSetIndex(1);setSeconds(0);modeRef.current="ready";setMode("ready")};
 const status=mode==="ready"?"جاهز":mode==="prepare"?"استعد":mode==="work"?"الجولة":mode==="rest"?"راحة":mode==="paused"?"متوقف مؤقتًا":"تم";
 const isFinalPulse=(mode==="prepare"||mode==="rest")&&seconds>0&&seconds<=5;
 return <section className={`workout-runner workout-${mode} ${isFinalPulse?"is-counting-pulse":""}`} aria-live="polite">
  {isFinalPulse&&<span key={`${mode}-${seconds}`} className="second-pulse" aria-hidden="true"/>}
  {mode!=="sessionDone"?<>
   <div className="workout-head"><button onClick={onExit}>×</button><div><button className="workout-achievement-title" onClick={onOpenAchievements}>{activity.name}</button><b>{ar(exerciseIndex+1)} من {ar(exercises.length)}</b></div></div>
   {mode==="ready"&&<WeekStrip date={date} today={today} calendarMode={calendarMode} weekStartsOn={weekStartsOn} onChange={onDateChange}/>}
   <p className="workout-status">{status}</p><h1>{exercise.name}</h1>
   {mode!=="exerciseDone"&&<p className="set-label">الجولة <b>{ar(setIndex)}</b> من {ar(exercise.sets)}</p>}
   {(mode==="ready"||mode==="work")&&<div className="workout-target">{exercise.measurement==="repetitions"?<><strong>{ar(exercise.reps??0)}</strong><span>عدة</span></>:<><strong>{ar(exercise.durationSeconds??0)}</strong><span>ثانية</span></>}</div>}
   {(mode==="prepare"||mode==="work"||mode==="rest")&&<div key={isFinalPulse?`${mode}-${seconds}`:mode} className={`workout-clock ${isFinalPulse?"clock-pulse":""}`} style={{"--timer-progress":`${mode==="prepare"?(seconds/5)*100:progress}%`} as React.CSSProperties}><div><strong>{mode==="prepare"?ar(seconds):clock(seconds)}</strong><span>{mode==="prepare"?"وتبدأ الجولة":mode==="rest"?`راحة قبل الجولة ${ar(setIndex)}`:exercise.measurement==="duration"?"باقي من الجولة":"وقت الجولة"}</span></div></div>}
   {mode==="ready"&&<><p className="workout-message">خذ وضعك. الجولة لا تبدأ من دونك.</p><button className="primary workout-main" onClick={startSet}>ابدأ الجولة</button></>}
   {mode==="work"&&exercise.measurement==="repetitions"&&<button className="primary workout-main" onClick={()=>completeSet()}>أنهيت {ar(exercise.reps??0)} عدة</button>}
   {mode==="work"&&exercise.measurement==="duration"&&<button className="soft workout-secondary" onClick={()=>completeSet()}>إنهاء الجولة مبكرًا</button>}
   {(mode==="prepare"||mode==="work"||mode==="rest")&&<button className="soft workout-secondary" onClick={pauseClock}>إيقاف مؤقت</button>}
   {mode==="paused"&&<div className="rest-actions"><p>أوقفنا القياس عند مغادرة الصفحة، ولم نحتسب وقت الغياب.</p><button className="primary" onClick={resumeClock}>استئناف المؤقت</button></div>}
   {mode==="rest"&&<div className="rest-actions"><button onClick={()=>{phaseTarget.current+=30;setSeconds(value=>value+30)}}>+ ٣٠ ثانية</button><button onClick={()=>beginWork()}>تخطي الراحة</button></div>}
   {mode==="exerciseDone"&&<div className="exercise-finish"><span>✓</span><h2>تم {exercise.name}.</h2><p>{ar(exercise.sets)} جولات{exercise.measurement==="repetitions"?` · ${ar(exercise.sets*(exercise.reps??0))} عدة`:""}</p><button className="primary" onClick={nextExercise}>{exerciseIndex<exercises.length-1?"التمرين التالي":"عرض ملخص الجلسة"}</button></div>}
  </>:<div className="session-finish"><span>✓</span><p>تمت الجلسة.</p><h1>{ar(exercises.length)} تمارين</h1><div><b>{clock(workTotal)}</b><small>وقت الأداء</small><b>{clock(restTotal)}</b><small>وقت الراحة</small><b>{ar(repetitions)}</b><small>عدة</small></div><button className="primary" onClick={()=>{const seconds=(workElapsedMs.current+restElapsedMs.current)/1000;onFinish(Math.max(1,seconds/60),repetitions,seconds,Object.values(exerciseResults.current))}}>إنهاء الجلسة</button><p>أحسنت. انتهيت. استمتع بوقتك.</p></div>}
 </section>
}
