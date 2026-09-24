"use client";
import { useEffect, useMemo, useState } from "react";
import type { PlannedActivity } from "./local-store";
import WeekStrip from "./WeekStrip";

const ar=(value:number,pad=1)=>value.toLocaleString("ar-SA",{minimumIntegerDigits:pad,useGrouping:false});
const clock=(seconds:number)=>`${ar(Math.floor(seconds/60),2)}:${ar(seconds%60,2)}`;
type Mode="ready"|"prepare"|"work"|"rest"|"exerciseDone"|"sessionDone";

export default function WorkoutRunner({activity,date,today,calendarMode,onDateChange,onExit,onFinish}:{activity:PlannedActivity;date:string;today:string;calendarMode:"islamic"|"gregory";onDateChange:(date:string)=>void;onExit:()=>void;onFinish:(minutes:number,repetitions:number)=>void}){
 const exercises=activity.exercises??[];
 const [exerciseIndex,setExerciseIndex]=useState(0),[setIndex,setSetIndex]=useState(1),[mode,setMode]=useState<Mode>("ready"),[seconds,setSeconds]=useState(0),[workTotal,setWorkTotal]=useState(0),[restTotal,setRestTotal]=useState(0),[repetitions,setRepetitions]=useState(0);
 const exercise=exercises[exerciseIndex];
 const target=exercise?.measurement==="duration"?(exercise.durationSeconds??30):0;
 useEffect(()=>{if(mode!=="prepare"&&mode!=="work"&&mode!=="rest")return;const timer=window.setInterval(()=>{setSeconds(value=>mode==="work"&&exercise?.measurement==="repetitions"?value+1:Math.max(0,value-1));if(mode==="work")setWorkTotal(value=>value+1);if(mode==="rest")setRestTotal(value=>value+1)},1000);return()=>clearInterval(timer)},[mode,exercise?.measurement]);
 useEffect(()=>{if(seconds!==0)return;if(mode==="prepare"||mode==="rest")beginWork();if(mode==="work"&&exercise?.measurement==="duration")completeSet()},[seconds,mode]);
 const progress=useMemo(()=>{if(mode==="rest")return Math.max(0,Math.min(100,(seconds/(exercise?.restSeconds||1))*100));if(mode==="work"&&exercise?.measurement==="duration")return Math.max(0,Math.min(100,(seconds/(target||1))*100));return 100},[mode,seconds,exercise?.restSeconds,target]);
 if(!exercise)return <section className="workout-runner"><h1>لا توجد تمارين بعد.</h1><button className="primary" onClick={onExit}>عودة</button></section>;
 function completeSet(){
  if(exercise.measurement==="repetitions")setRepetitions(value=>value+(exercise.reps??0));
  if(setIndex>=exercise.sets){setMode("exerciseDone");setSeconds(0)}else{setSetIndex(value=>value+1);setSeconds(exercise.restSeconds);setMode("rest")}
 }
 function beginWork(){setSeconds(exercise.measurement==="duration"?(exercise.durationSeconds??30):0);setMode("work")}
 const startSet=()=>{setSeconds(5);setMode("prepare")};
 const nextExercise=()=>{if(exerciseIndex>=exercises.length-1){setMode("sessionDone");return}setExerciseIndex(value=>value+1);setSetIndex(1);setSeconds(0);setMode("ready")};
 const status=mode==="ready"?"جاهز":mode==="prepare"?"استعد":mode==="work"?"الجولة":mode==="rest"?"راحة":"تم";
 const isFinalPulse=(mode==="prepare"||mode==="rest")&&seconds>0&&seconds<=5;
 return <section className={`workout-runner workout-${mode} ${isFinalPulse?"is-counting-pulse":""}`} aria-live="polite">
  {isFinalPulse&&<span key={`${mode}-${seconds}`} className="second-pulse" aria-hidden="true"/>}
  {mode!=="sessionDone"?<>
   <div className="workout-head"><button onClick={onExit}>×</button><div><small>{activity.name}</small><b>{ar(exerciseIndex+1)} من {ar(exercises.length)}</b></div></div>
   {mode==="ready"&&<WeekStrip date={date} today={today} calendarMode={calendarMode} onChange={onDateChange}/>}
   <p className="workout-status">{status}</p><h1>{exercise.name}</h1>
   {mode!=="exerciseDone"&&<p className="set-label">الجولة <b>{ar(setIndex)}</b> من {ar(exercise.sets)}</p>}
   {(mode==="ready"||mode==="work")&&<div className="workout-target">{exercise.measurement==="repetitions"?<><strong>{ar(exercise.reps??0)}</strong><span>عدة</span></>:<><strong>{ar(exercise.durationSeconds??0)}</strong><span>ثانية</span></>}</div>}
   {(mode==="prepare"||mode==="work"||mode==="rest")&&<div key={isFinalPulse?`${mode}-${seconds}`:mode} className={`workout-clock ${isFinalPulse?"clock-pulse":""}`} style={{"--timer-progress":`${mode==="prepare"?(seconds/5)*100:progress}%`} as React.CSSProperties}><div><strong>{mode==="prepare"?ar(seconds):clock(seconds)}</strong><span>{mode==="prepare"?"وتبدأ الجولة":mode==="rest"?`راحة قبل الجولة ${ar(setIndex)}`:exercise.measurement==="duration"?"باقي من الجولة":"وقت الجولة"}</span></div></div>}
   {mode==="ready"&&<><p className="workout-message">خذ وضعك. الجولة لا تبدأ من دونك.</p><button className="primary workout-main" onClick={startSet}>ابدأ الجولة</button></>}
   {mode==="work"&&exercise.measurement==="repetitions"&&<button className="primary workout-main" onClick={completeSet}>أنهيت {ar(exercise.reps??0)} عدة</button>}
   {mode==="work"&&exercise.measurement==="duration"&&<button className="soft workout-secondary" onClick={completeSet}>إنهاء الجولة مبكرًا</button>}
   {mode==="rest"&&<div className="rest-actions"><button onClick={()=>setSeconds(value=>value+30)}>+ ٣٠ ثانية</button><button onClick={beginWork}>تخطي الراحة</button></div>}
   {mode==="exerciseDone"&&<div className="exercise-finish"><span>✓</span><h2>تم {exercise.name}.</h2><p>{ar(exercise.sets)} جولات{exercise.measurement==="repetitions"?` · ${ar(exercise.sets*(exercise.reps??0))} عدة`:""}</p><button className="primary" onClick={nextExercise}>{exerciseIndex<exercises.length-1?"التمرين التالي":"عرض ملخص الجلسة"}</button></div>}
  </>:<div className="session-finish"><span>✓</span><p>تمت الجلسة.</p><h1>{ar(exercises.length)} تمارين</h1><div><b>{clock(workTotal)}</b><small>وقت الأداء</small><b>{clock(restTotal)}</b><small>وقت الراحة</small><b>{ar(repetitions)}</b><small>عدة</small></div><button className="primary" onClick={()=>onFinish(Math.max(1,Math.round((workTotal+restTotal)/60)),repetitions)}>إنهاء الجلسة</button><p>أحسنت. انتهيت. استمتع بوقتك.</p></div>}
 </section>
}
