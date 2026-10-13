"use client";
import {useEffect,useMemo,useRef,useState,type CSSProperties,type TouchEvent} from "react";
import {Pencil} from "lucide-react";
import {counterValue,setCounterValue,type PlannedActivity,type TimedSession,type UnitPeriod,type UnitProgress} from "./local-store";
import {activeSeconds,checkpointSession,completeTimedRound,createTimedSession,finishSession as finishTimedSession,formatStopwatch as fmt,pauseSession,removeTimedAmount,resumeSession,summarizeSession,undoTimedRound} from "./activity-time-engine";
import WeekStrip from "./WeekStrip";

const ar=(value:number)=>value.toLocaleString("ar-SA",{useGrouping:true});

function RingGauge({totalRatio,activeRatio,totalDone,totalTarget,roundSeconds,showTimer}:{totalRatio:number;activeRatio:number;totalDone:number;totalTarget:number;roundSeconds:number;showTimer:boolean}){
 const dash=(ratio:number)=>`${Math.max(0,Math.min(1,ratio))*100} 100`;
 return <div className="gauge-ring-face"><svg viewBox="0 0 240 240" aria-hidden="true"><g transform="rotate(-90 120 120)"><circle className="gauge-ring-track gauge-ring-outer" cx="120" cy="120" r="94" pathLength="100"/><circle className="gauge-ring-day" cx="120" cy="120" r="94" pathLength="100" style={{strokeDasharray:dash(totalRatio)}}/><circle className="gauge-ring-track gauge-ring-inner" cx="120" cy="120" r="68" pathLength="100"/><circle className="gauge-ring-period" cx="120" cy="120" r="68" pathLength="100" style={{strokeDasharray:dash(activeRatio)}}/></g><text className="gauge-ring-label" x="120" y="92">تم إنجاز</text><text className="gauge-ring-value" x="120" y="121">{ar(totalDone)} / {ar(totalTarget)}</text>{showTimer&&<text className="gauge-ring-timer" x="120" y="145">{fmt(roundSeconds)} · زمن الجولة</text>}</svg></div>
}

type GaugeStyle="ring"|"semi";
type GaugeFeedback={amount:number;kind:"add"|"undo";id:number}|null;
function DhikrGauge({style,totalRatio,activeRatio,totalDone,totalTarget,roundSeconds,showTimer,totalPercent,feedback,idSuffix,className=""}:{style:GaugeStyle;totalRatio:number;activeRatio:number;totalDone:number;totalTarget:number;roundSeconds:number;showTimer:boolean;totalPercent:number;feedback:GaugeFeedback;idSuffix:string;className?:string}){
 const gaugeTicks=Array.from({length:9},(_,index)=>(index+1)/10),clipId=`gauge-shared-cut-${idSuffix}`,needleShadowId=`gauge-needle-soft-shadow-${idSuffix}`,dialShadowId=`gauge-dial-soft-shadow-${idSuffix}`;
 return <div className={`dhikr-gauge gauge-${style} ${className}`} aria-hidden={Boolean(className)}>
  <RingGauge totalRatio={totalRatio} activeRatio={activeRatio} totalDone={totalDone} totalTarget={totalTarget} roundSeconds={roundSeconds} showTimer={showTimer}/>
  <svg className="gauge-semi" viewBox="0 0 240 160" aria-hidden="true">
   <defs>
    <clipPath id={clipId}><rect x="0" y="0" width="240" height="132"/></clipPath>
    <filter id={needleShadowId} filterUnits="userSpaceOnUse" x="-20" y="-10" width="280" height="180"><feGaussianBlur in="SourceGraphic" stdDeviation="3.1" result="needleBlur"/><feOffset in="needleBlur" dx="1" dy="3.8"/></filter>
    <filter id={dialShadowId} filterUnits="userSpaceOnUse" x="-20" y="-20" width="280" height="220"><feGaussianBlur stdDeviation="3.8"/></filter>
   </defs>
   <g clipPath={`url(#${clipId})`}>
    <path className="gauge-track" pathLength="100" d="M220 132V118 A100 100 0 0 0 20 118V132"/>
    <path className="gauge-leg-fill" style={{opacity:totalDone>0?1:0}} d="M220 132V118"/>
    <path className="gauge-fill" pathLength="100" style={{strokeDasharray:`${totalPercent} 100`}} d="M220 118 A100 100 0 0 0 20 118"/>
    {totalPercent===100&&<path className="gauge-leg-fill" d="M20 118V132"/>}
    {gaugeTicks.map((ratio,index)=>{const angle=-Math.PI*ratio,x1=120+98*Math.cos(angle),y1=118+98*Math.sin(angle),x2=120+103*Math.cos(angle),y2=118+103*Math.sin(angle);return <line key={index} className="gauge-tick" x1={x1} y1={y1} x2={x2} y2={y2}/>})}
    <g className={feedback?["gauge-needle",feedback.kind].join(" "):"gauge-needle"} style={{transform:`rotate(${-totalRatio*180}deg)`}}>
     <line filter={`url(#${needleShadowId})`} className="gauge-needle-shadow" x1="120" y1="118" x2="226" y2="118"/>
     <line className="gauge-needle-face" x1="120" y1="118" x2="226" y2="118"/>
    </g>
    <g className="gauge-dial">
     <circle filter={`url(#${dialShadowId})`} className="gauge-dial-shadow" cx="120" cy="118" r="60"/>
     <circle className="gauge-dial-halo" cx="120" cy="118" r="63"/>
     <circle className="gauge-dial-face" cx="120" cy="118" r="56"/>
     <text className="gauge-dial-label" x="120" y="78">تم إنجاز</text>
     <text className={feedback?["gauge-dial-value","number-feedback",feedback.kind].join(" "):"gauge-dial-value"} x="120" y="102">{ar(totalDone)} / {ar(totalTarget)}</text>
     {showTimer&&<text className="gauge-dial-timer" x="120" y="122">{fmt(roundSeconds)} · زمن الجولة</text>}
    </g>
   </g>
  </svg>
 </div>
}

export default function DhikrRunner({activity,date,today,currentPeriodIndex,calendarMode,weekStartsOn,initialPeriod,initial,onExit,onEdit,onChange,onFinish,onDateChange,onGaugeStyleChange,onOpenAchievements}:{activity:PlannedActivity;date:string;today:string;currentPeriodIndex:number;calendarMode:"islamic"|"gregory"|"mixed";weekStartsOn:"saturday"|"sunday";initialPeriod?:string;initial?:UnitProgress;onExit:()=>void;onEdit:()=>void;onChange:(progress:UnitProgress,sync?:boolean)=>void;onFinish:(summary:{sessionId:string;total:number;durationSeconds:number;rounds:ReturnType<typeof summarizeSession>["rounds"];target:number;date:string})=>void;onDateChange:(offset:number)=>void;onGaugeStyleChange:(style:GaugeStyle)=>void;onOpenAchievements:()=>void}){
 const config=activity.unitTracking!;
 const showTimer=config.timing?.showTimer!==false;
 const configuredPeriods=config.periods.length?config.periods:[{id:"daily",label:activity.period,period:activity.period,target:config.target,unitCount:Math.max(1,Math.ceil(config.target/Math.max(1,config.pressValue))),unitValue:config.pressValue}];
 const basePeriods=configuredPeriods.filter((period,index,all)=>all.findIndex(item=>item.period===period.period)===index);
 const [selected,setSelected]=useState(()=>basePeriods.find(period=>period.period===initialPeriod)?.id??basePeriods[0].id);
 const [progress,setProgress]=useState<UnitProgress>(initial??{activityId:activity.id,date,counterByPeriod:{},completedUnitsByPeriod:{},updatedAt:new Date().toISOString()});
 const [operationHistory,setOperationHistory]=useState<Record<string,{counter:number;units:number[];roundId?:string;session?:TimedSession}[]>>({}),[feedback,setFeedback]=useState<{amount:number;kind:"add"|"undo";id:number}|null>(null);
 const [decrementMode,setDecrementMode]=useState(false),holdTimer=useRef<number|null>(null),longPressTriggered=useRef(false);
 const [gaugeTransition,setGaugeTransition]=useState<{from:GaugeStyle;direction:"left"|"right"}|null>(null),gaugeTouchStart=useRef<{x:number;y:number}|null>(null);
 const [celebration,setCelebration]=useState<{message:string;id:number}|null>(null);
 const [timerSession,setTimerSession]=useState<TimedSession|null>(null),[timerPulse,setTimerPulse]=useState({totalSeconds:0,roundSeconds:0}),[sessionSummary,setSessionSummary]=useState<ReturnType<typeof summarizeSession>|null>(null);
 const progressRef=useRef(progress),sessionRef=useRef<TimedSession|null>(null),totalAnchor=useRef(0),totalBase=useRef(0),roundAnchor=useRef(0),roundBase=useRef(0),lastRoundAction=useRef(0);
 useEffect(()=>{progressRef.current=progress},[progress]);useEffect(()=>{sessionRef.current=timerSession},[timerSession]);
 const periods=useMemo(()=>basePeriods.map(period=>{const target=progress.targetByPeriod?.[period.id]??period.target;return{...period,target,unitCount:Math.max(1,Math.ceil(target/period.unitValue))}}),[basePeriods,progress.targetByPeriod]);
 const active=periods.find(period=>period.id===selected)??periods[0];
 const doneFor=(period:UnitPeriod,source=progress)=>Math.max(counterValue(source,period.id),(source.completedUnitsByPeriod[period.id]?.length??0)*period.unitValue);
 const gaugeStyle=config.gaugeStyle??"ring";
 const totalTarget=periods.reduce((sum,period)=>sum+period.target,0),totalDone=periods.reduce((sum,period)=>sum+doneFor(period),0);
 const dailyRemaining=Math.max(0,totalTarget-totalDone);
 const roundRemaining=Math.max(0,(decrementMode?doneFor(active):active.target-doneFor(active)));
 const configuredRoundAmount=Math.max(1,Math.floor(config.timing?.roundSize??100));
 const roundAmount=Math.min(configuredRoundAmount,roundRemaining);
 const completedRounds=timerSession?.rounds.filter(round=>round.periodId===active.id&&round.status==="completed").length??0;
 const plannedRounds=Math.max(1,Math.ceil(active.target/configuredRoundAmount));
 const roundProgress=`${ar(Math.min(completedRounds,plannedRounds))} من ${ar(plannedRounds)} جولات`;
 const totalPercent=totalTarget?Math.min(100,Math.round(totalDone/totalTarget*100)):0;
 const totalRatio=totalTarget?Math.min(1,totalDone/totalTarget):0;
 // تدريجات بصرية محدودة؛ العداد العام للمنجز، وهدف الفترة يظهر كنص مستقل.
 const dayEnded=date<today;
 const persist=(next:UnitProgress,sync=true)=>{const nextPeriods=basePeriods.map(period=>({...period,target:next.targetByPeriod?.[period.id]??period.target}));const completed=nextPeriods.every(period=>doneFor(period,next)>=period.target);const saved={...next,updatedAt:new Date().toISOString(),completedAt:completed?(next.completedAt??new Date().toISOString()):undefined};progressRef.current=saved;setProgress(saved);onChange(saved,sync);return saved};
 const saveSession=(nextSession:TimedSession,sync=true,base=progressRef.current)=>{const sessions=[...(base.timedSessions??[]).filter(item=>item.id!==nextSession.id),nextSession].slice(-20),next=persist({...base,timedSessions:sessions,activeSessionId:nextSession.status==="finished"?undefined:nextSession.id},sync);sessionRef.current=nextSession;setTimerSession(nextSession);return next};
 const elapsedAt=(now=performance.now())=>{const current=sessionRef.current;if(!current)return 0;return current.status==="running"?Math.max(current.elapsedMs,totalBase.current+now-totalAnchor.current):current.elapsedMs};
 const roundElapsedAt=(now=performance.now())=>{const current=sessionRef.current;if(!current)return 0;return current.status==="running"?Math.max(current.roundElapsedMs,roundBase.current+now-roundAnchor.current):current.roundElapsedMs};
 const checkpoint=(sync=false)=>{const current=sessionRef.current;if(!current||current.status!=="running")return;const now=performance.now(),elapsed=elapsedAt(now),roundElapsed=roundElapsedAt(now),next=checkpointSession(current,elapsed,roundElapsed);totalBase.current=next.elapsedMs;roundBase.current=next.roundElapsedMs;totalAnchor.current=now;roundAnchor.current=now;saveSession(next,sync);setTimerPulse({totalSeconds:activeSeconds(next,next.elapsedMs),roundSeconds:Math.floor(next.roundElapsedMs/1000)})};
 const stopTimer=(interrupted=false)=>{const current=sessionRef.current;if(!current||current.status!=="running")return;const now=performance.now(),elapsed=elapsedAt(now),roundElapsed=roundElapsedAt(now),next=pauseSession(current,elapsed,roundElapsed,Date.now(),interrupted);totalAnchor.current=0;roundAnchor.current=0;totalBase.current=next.elapsedMs;roundBase.current=next.roundElapsedMs;saveSession(next,true);setTimerPulse({totalSeconds:activeSeconds(next,next.elapsedMs),roundSeconds:Math.floor(next.roundElapsedMs/1000)})};
 const startNewSession=()=>{const next=createTimedSession(activity.id,date);setSessionSummary(null);totalBase.current=0;roundBase.current=0;totalAnchor.current=performance.now();roundAnchor.current=totalAnchor.current;saveSession(next,true)};
 const resumeCurrentSession=()=>{const current=sessionRef.current;if(!current||current.status!=="paused")return;const next=resumeSession(current);totalBase.current=next.elapsedMs;roundBase.current=next.roundElapsedMs;totalAnchor.current=performance.now();roundAnchor.current=totalAnchor.current;saveSession(next,true);setTimerPulse({totalSeconds:activeSeconds(next,next.elapsedMs),roundSeconds:Math.floor(next.roundElapsedMs/1000)})};
 const endSession=(base=progressRef.current)=>{const current=sessionRef.current;if(!current||current.status==="finished")return;const next=finishTimedSession(current,elapsedAt(),roundElapsedAt()),summary=summarizeSession(next);totalAnchor.current=0;roundAnchor.current=0;totalBase.current=next.elapsedMs;roundBase.current=next.roundElapsedMs;saveSession(next,true,base);setSessionSummary(summary);if(summary.quantity>0)onFinish({sessionId:next.id,total:summary.quantity,durationSeconds:summary.elapsedSeconds,rounds:summary.rounds,target:totalTarget,date})};
 const add=(requestedAmount:number)=>{
  const before=doneFor(active),current=sessionRef.current;
  if(before===0&&decrementMode||!current||current.status!=="running")return;
  const amount=Math.min(Math.max(1,Math.floor(requestedAmount)),decrementMode?before:Math.max(0,active.target-before));
  if(!amount)return;
  const nowPerf=performance.now();if(nowPerf-lastRoundAction.current<180)return;lastRoundAction.current=nowPerf;
  const units=[...(progress.completedUnitsByPeriod[active.id]??[])],nextCount=decrementMode?Math.max(0,before-amount):before+amount,kind=decrementMode?"undo":"add";
  const nextProgress=setCounterValue(progress,active.id,nextCount,units.length*active.unitValue);
  nextProgress.completedUnitsByPeriod=decrementMode?{...progress.completedUnitsByPeriod,[active.id]:[]}:progress.completedUnitsByPeriod;
  setOperationHistory(value=>({...value,[active.id]:[...(value[active.id]??[]),{counter:before,units,...(decrementMode?{session:current}:{})}]}));
  setFeedback({amount,kind,id:Date.now()});
  let elapsed=elapsedAt(nowPerf),nextSession:TimedSession;
  if(decrementMode){
   const updated=removeTimedAmount(current,active.id,amount),beforeSeconds=current.rounds.filter(round=>round.status==="completed").reduce((sum,round)=>sum+round.durationSeconds,0),afterSeconds=updated.rounds.filter(round=>round.status==="completed").reduce((sum,round)=>sum+round.durationSeconds,0);
   elapsed=Math.max(0,elapsed-(beforeSeconds-afterSeconds)*1000);nextSession=checkpointSession(updated,elapsed,0);nextSession={...nextSession,roundElapsedMs:0,roundStartedAt:new Date().toISOString()};
  }else{
   const roundElapsed=roundElapsedAt(nowPerf),result=completeTimedRound(checkpointSession(current,elapsed,roundElapsed),active.id,amount,roundElapsed/1000,"counter");
   nextSession=result.session;setOperationHistory(value=>({...value,[active.id]:[...(value[active.id]??[]).slice(0,-1),{counter:before,units,roundId:result.round.id}]}));
  }
  totalBase.current=elapsed;roundBase.current=0;totalAnchor.current=nowPerf;roundAnchor.current=nowPerf;
  const saved=persist({...nextProgress,timedSessions:[...(progress.timedSessions??[]).filter(item=>item.id!==nextSession.id),nextSession],activeSessionId:nextSession.id});
  setTimerSession(saved.timedSessions?.find(item=>item.id===nextSession.id)??nextSession);sessionRef.current=nextSession;
  if(!decrementMode&&before<active.target&&nextCount>=active.target){const messages=["أحسنت صنعًا","رائع، لقد أنجزت","بارك الله فيك","كم أنت بطل"];setCelebration({message:messages[Math.floor(Math.random()*messages.length)],id:Date.now()})}
  if(!decrementMode&&basePeriods.every(period=>doneFor(period,saved)>=(saved.targetByPeriod?.[period.id]??period.target)))endSession(saved)
 };
 const toggleUnit=(unitIndex:number)=>{
  const current=timerSession;if(!current||current.status!=="running")return;
  const before=doneFor(active),targetIndexes=progress.completedUnitsByPeriod[active.id]??Array.from({length:Math.floor(before/active.unitValue)},(_,index)=>index),isDone=targetIndexes.includes(unitIndex),amount=isDone?Math.min(active.unitValue,before):Math.min(active.unitValue,Math.max(0,active.target-before));if(!amount)return;
  const units=isDone?targetIndexes.filter(index=>index!==unitIndex):[...targetIndexes,unitIndex].sort((a,b)=>a-b),nextCount=isDone?Math.max(0,before-amount):before+amount,nowPerf=performance.now();
  const roundElapsed=roundElapsedAt(nowPerf);let elapsed=elapsedAt(nowPerf),nextSession:TimedSession=current;
  if(isDone){const previous=[...current.rounds].reverse().find(round=>round.periodId===active.id&&round.unitIndex===unitIndex&&round.status==="completed");if(previous){nextSession=undoTimedRound(current,previous.id);elapsed=Math.max(0,elapsed-previous.durationSeconds*1000)}nextSession=checkpointSession(nextSession,elapsed,0);nextSession={...nextSession,roundElapsedMs:0,roundStartedAt:new Date().toISOString()}}
  else nextSession=completeTimedRound(checkpointSession(current,elapsed,roundElapsed),active.id,amount,roundElapsed/1000,"units",unitIndex).session;
  totalBase.current=elapsed;roundBase.current=0;totalAnchor.current=nowPerf;roundAnchor.current=nowPerf;
  const next=setCounterValue({...progress,completedUnitsByPeriod:{...progress.completedUnitsByPeriod,[active.id]:units}},active.id,nextCount,units.length*active.unitValue);
  next.completedUnitsByPeriod={...progress.completedUnitsByPeriod,[active.id]:units};
  const saved=persist({...next,timedSessions:[...(progress.timedSessions??[]).filter(item=>item.id!==nextSession.id),nextSession],activeSessionId:nextSession.id});
  setTimerSession(saved.timedSessions?.find(item=>item.id===nextSession.id)??nextSession);sessionRef.current=nextSession;
  if(!isDone&&nextCount>=active.target&&basePeriods.every(period=>doneFor(period,saved)>=(saved.targetByPeriod?.[period.id]??period.target)))endSession(saved)
 };
 const undo=()=>{const history=operationHistory[active.id]??[],last=history.at(-1);if(!last)return;const before=doneFor(active),restored=Math.max(last.counter,last.units.length*active.unitValue);setOperationHistory(value=>({...value,[active.id]:history.slice(0,-1)}));setFeedback({amount:Math.abs(restored-before),kind:restored>=before?"add":"undo",id:Date.now()});const next=setCounterValue(progress,active.id,restored,last.units.length*active.unitValue),current=sessionRef.current;let nextSession=current;if(last.session)nextSession=last.session;else if(current&&last.roundId)nextSession=undoTimedRound(current,last.roundId);if(nextSession&&current?.status==="running"){const now=performance.now(),currentSeconds=current.rounds.filter(round=>round.status==="completed").reduce((sum,round)=>sum+round.durationSeconds,0),restoredSeconds=nextSession.rounds.filter(round=>round.status==="completed").reduce((sum,round)=>sum+round.durationSeconds,0),elapsed=Math.max(0,elapsedAt(now)+(restoredSeconds-currentSeconds)*1000);nextSession=checkpointSession(nextSession,elapsed,0);nextSession={...nextSession,roundElapsedMs:0,roundStartedAt:new Date().toISOString()};totalBase.current=elapsed;roundBase.current=0;totalAnchor.current=now;roundAnchor.current=now}const savedProgress=persist({...next,completedAt:undefined,completedUnitsByPeriod:{...progress.completedUnitsByPeriod,[active.id]:last.units},...(nextSession?{timedSessions:[...(progress.timedSessions??[]).filter(item=>item.id!==nextSession!.id),nextSession],activeSessionId:nextSession.status==="finished"?undefined:nextSession.id}:{})});if(nextSession){sessionRef.current=nextSession;setTimerSession(nextSession)}setSessionSummary(null)};
 const startModeHold=()=>{if(holdTimer.current!==null)window.clearTimeout(holdTimer.current);longPressTriggered.current=false;holdTimer.current=window.setTimeout(()=>{longPressTriggered.current=true;setDecrementMode(value=>!value)},520)};
 const endModeHold=()=>{if(holdTimer.current!==null){window.clearTimeout(holdTimer.current);holdTimer.current=null}};
 const handleGaugeTouchStart=(event:TouchEvent<HTMLDivElement>)=>{const touch=event.touches[0];if(touch)gaugeTouchStart.current={x:touch.clientX,y:touch.clientY}};
 const handleGaugeTouchEnd=(event:TouchEvent<HTMLDivElement>)=>{const start=gaugeTouchStart.current,touch=event.changedTouches[0];gaugeTouchStart.current=null;if(!start||!touch)return;const dx=touch.clientX-start.x,dy=touch.clientY-start.y;if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.2)return;setGaugeTransition({from:gaugeStyle,direction:dx<0?"left":"right"});onGaugeStyleChange(gaugeStyle==="ring"?"semi":"ring")};
 useEffect(()=>{const saved=(progressRef.current.timedSessions??[]).find(item=>item.id===progressRef.current.activeSessionId)??[...(progressRef.current.timedSessions??[])].reverse().find(item=>item.date===date);if(saved?.status==="running"){const recovered=pauseSession(saved,saved.elapsedMs,saved.roundElapsedMs,Date.now(),true);totalBase.current=recovered.elapsedMs;roundBase.current=recovered.roundElapsedMs;saveSession(recovered,true);setTimerPulse({totalSeconds:activeSeconds(recovered,recovered.elapsedMs),roundSeconds:Math.floor(recovered.roundElapsedMs/1000)})}else if(saved){sessionRef.current=saved;setTimerSession(saved);totalBase.current=saved.elapsedMs;roundBase.current=saved.roundElapsedMs;setTimerPulse({totalSeconds:activeSeconds(saved,saved.elapsedMs),roundSeconds:Math.floor(saved.roundElapsedMs/1000)})}else{startNewSession()}const onVisibility=()=>{if(document.visibilityState==="hidden")stopTimer(true)};const onPageHide=()=>stopTimer(true);document.addEventListener("visibilitychange",onVisibility);window.addEventListener("pagehide",onPageHide);return()=>{document.removeEventListener("visibilitychange",onVisibility);window.removeEventListener("pagehide",onPageHide);stopTimer(true)}},[activity.id,date]);
 useEffect(()=>{if(timerSession?.status!=="running")return;const interval=window.setInterval(()=>checkpoint(false),1000);return()=>window.clearInterval(interval)},[timerSession?.status]);
 useEffect(()=>{if(!feedback)return;const timer=window.setTimeout(()=>setFeedback(null),760);return()=>window.clearTimeout(timer)},[feedback]);
 useEffect(()=>{if(!celebration)return;const timer=window.setTimeout(()=>setCelebration(null),3000);return()=>window.clearTimeout(timer)},[celebration]);
 useEffect(()=>{if(!gaugeTransition)return;const timer=window.setTimeout(()=>setGaugeTransition(null),460);return()=>window.clearTimeout(timer)},[gaugeTransition]);
 const adjustPeriodUnits=(period:UnitPeriod,change:number)=>{const target=Math.max(period.unitValue,period.target+(change*period.unitValue));persist({...progress,completedAt:undefined,targetByPeriod:{...(progress.targetByPeriod??{}),[period.id]:target}})};
 const periodOrder=["الصباح","الظهر","العصر","المغرب","الليل"];
 const isMissed=(period:UnitPeriod)=>date<today||(date===today&&periodOrder.indexOf(period.period)<currentPeriodIndex);
 return <section className="dhikr-runner">
  <header><button className="dhikr-exit" onClick={onExit} aria-label="العودة إلى رحلة اليوم" title="العودة إلى رحلة اليوم">↩</button><div><button className="dhikr-runner-title" onClick={onOpenAchievements}>{activity.name}</button></div><div className="dhikr-head-actions"><button onClick={onEdit} aria-label="تعديل الورد" title="تعديل الورد"><Pencil size={19} strokeWidth={2} aria-hidden="true"/></button></div></header>
  <WeekStrip date={date} today={today} calendarMode={calendarMode} weekStartsOn={weekStartsOn} onChange={next=>{const current=new Date(`${date}T12:00:00`),target=new Date(`${next}T12:00:00`);onDateChange(Math.round((target.getTime()-current.getTime())/86400000))}}/>
  <article className="dhikr-overview-card">
   <div className="dhikr-day-total dhikr-gauge-summary" aria-label="ملخص ورد اليوم">
    <div className="gauge-swipe-stage" onTouchStart={handleGaugeTouchStart} onTouchEnd={handleGaugeTouchEnd} onTouchCancel={()=>{gaugeTouchStart.current=null}} aria-label="اسحب لتغيير شكل العداد">
     {gaugeTransition&&<DhikrGauge key={`from-${gaugeTransition.from}`} style={gaugeTransition.from} totalRatio={totalRatio} activeRatio={active.target?Math.min(1,doneFor(active)/active.target):0} totalDone={totalDone} totalTarget={totalTarget} roundSeconds={timerPulse.roundSeconds} showTimer={showTimer} totalPercent={totalPercent} feedback={feedback} idSuffix={`${activity.id}-${gaugeTransition.from}-old`} className={`gauge-swipe-old gauge-out-${gaugeTransition.direction}`}/>}
     <DhikrGauge key={`current-${gaugeStyle}`} style={gaugeStyle} totalRatio={totalRatio} activeRatio={active.target?Math.min(1,doneFor(active)/active.target):0} totalDone={totalDone} totalTarget={totalTarget} roundSeconds={timerPulse.roundSeconds} showTimer={showTimer} totalPercent={totalPercent} feedback={feedback} idSuffix={`${activity.id}-${gaugeStyle}-current`} className={gaugeTransition?`gauge-swipe-new gauge-in-${gaugeTransition.direction}`:""}/>
    </div>
    <p className={`dhikr-goal-remaining ${dayEnded&&dailyRemaining>0?"late":""}`}>{dailyRemaining>0?<>تبقّى لإنجاز هدفك <b>{ar(dailyRemaining)}</b> ذكرًا</>:"أتممت هدفك اليوم"}</p>
   </div>
   <div className="dhikr-station-tracks">{periods.map(period=>{const done=doneFor(period),periodProgress=Math.min(100,period.target?Math.round(done/period.target*100):0),complete=done>=period.target,feedbackKind=selected===period.id?feedback?.kind:null;return <article key={period.id} className={`dhikr-station-row ${selected===period.id?"selected":""} ${complete?"complete":""} ${!complete&&isMissed(period)?"missed":""}`} onClick={()=>setSelected(period.id)}><button className="dhikr-station-main" onClick={()=>setSelected(period.id)} aria-label={`${period.label}: ${ar(done)} من ${ar(period.target)}، اختر للعمل عليها`}><span>{period.label.replace(/^بعد\s+/,"")}</span><i><b style={{"--period-progress":String(periodProgress/100)} as CSSProperties}/><em className={feedbackKind?["pulse",feedbackKind].join(" "):""} style={{right:`${periodProgress}%`}}>{ar(done)}</em></i></button><div className="dhikr-row-units" aria-label={`العدد المطلوب في ${period.label}`}><button className="dhikr-unit-step" onClick={event=>{event.stopPropagation();adjustPeriodUnits(period,-1)}} disabled={period.target<=period.unitValue} aria-label="إنقاص العدد المطلوب">−</button><b>{ar(period.target)}</b><button className="dhikr-unit-step" onClick={event=>{event.stopPropagation();adjustPeriodUnits(period,1)}} aria-label="زيادة العدد المطلوب">+</button></div></article>})}</div>
  </article>
  {config.method==="units"?<section className="dhikr-unit-grid" aria-label={`وحدات الذكر، ${ar(active.unitCount)} وحدة`}>{Array.from({length:active.unitCount},(_,index)=>{const doneIndexes=progress.completedUnitsByPeriod[active.id]??Array.from({length:Math.floor(doneFor(active)/active.unitValue)},(_unused,unitIndex)=>unitIndex),complete=doneIndexes.includes(index);return <button key={index} className={complete?"completed":""} disabled={timerSession?.status!=="running"||!complete&&doneFor(active)>=active.target} onClick={()=>toggleUnit(index)} aria-pressed={complete} aria-label={`${complete?"إلغاء إكمال":"إكمال"} الوحدة ${ar(index+1)}، ${ar(active.unitValue)} أذكار`}>{complete?"✓":ar(index+1)}</button>})}</section>:<section className={`dhikr-counter ${decrementMode?"decrement-mode":""}`} aria-label="تسجيل الذكر">
   {roundRemaining===0&&<p className="dhikr-period-complete">{decrementMode?"لا يوجد عدد لإنقاصه":"اكتمل هدف هذه الفترة"}</p>}
   {roundRemaining>0&&<button type="button" className={`dhikr-round-submit ${decrementMode?"decrement-mode":""}`} disabled={!roundAmount||timerSession?.status!=="running"} onClick={()=>add(roundAmount)} aria-label={`${decrementMode?"إنقاص":"أتممت"} ${ar(roundAmount)} ذكرًا`}>{decrementMode?"−":"＋"}{ar(roundAmount)}</button>}
  </section>}
  <div className="dhikr-session-tools" aria-label="أدوات الجلسة"><small className="dhikr-round-progress">{roundProgress}</small><button className={`dhikr-undo ${decrementMode?"decrement-mode":""} ${operationHistory[active.id]?.length?"":"undo-unavailable"}`} onPointerDown={startModeHold} onPointerUp={endModeHold} onPointerLeave={endModeHold} onPointerCancel={endModeHold} onKeyDown={event=>{if((event.key==="Enter"||event.key===" ")&&!event.repeat)startModeHold()}} onKeyUp={endModeHold} onBlur={endModeHold} onContextMenu={event=>event.preventDefault()} onClick={()=>{if(longPressTriggered.current){longPressTriggered.current=false;return}if(decrementMode){setDecrementMode(false);return}undo()}} aria-pressed={decrementMode} aria-label={decrementMode?"إيقاف وضع الإنقاص":"تراجع عن آخر ضغطة؛ اضغط مطولًا لتفعيل الإنقاص"} title={decrementMode?"اضغط للعودة إلى الزيادة":"اضغط للتراجع أو اضغط مطولًا لتفعيل الإنقاص"}><span className="undo-icon" aria-hidden="true">{decrementMode?<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5v14"/></svg>:<svg viewBox="0 0 24 24" fill="none"><path d="M8.2 8.4H4.5v-3.7M4.9 8.1a8 8 0 1 1-1 8.3"/><path d="M4.9 8.1 8.2 4.8"/></svg>}</span><small>{decrementMode?"إنقاص":"تراجع"}</small></button>{timerSession?.status==="running"?<button type="button" className="dhikr-session-tool" onClick={()=>stopTimer(false)}>إيقاف مؤقت</button>:timerSession?.status==="paused"?<button type="button" className="dhikr-session-tool" onClick={resumeCurrentSession}>{timerSession.interrupted?"استئناف":"استئناف"}</button>:<button type="button" className="dhikr-session-tool" onClick={startNewSession}>جلسة جديدة</button>}<button type="button" className="dhikr-session-tool finish-session" onClick={()=>endSession()} disabled={!timerSession||timerSession.status==="finished"}>إنهاء الجلسة</button></div>
  {totalDone>=totalTarget&&<div className="dhikr-complete"><b>تم ورد اليوم.</b><span>انتهيت. أكمل يومك بهدوء.</span></div>}
  {celebration&&<div key={celebration.id} className="dhikr-celebration" role="status" aria-live="polite"><div className="dhikr-celebration-card"><svg className="dhikr-celebration-art" viewBox="0 0 96 96" aria-hidden="true"><path className="celebration-rays" d="M48 5v10M48 81v10M5 48h10M81 48h10M17.6 17.6l7 7M71.4 71.4l7 7M78.4 17.6l-7 7M24.6 71.4l-7 7"/><circle className="celebration-medal" cx="48" cy="43" r="25"/><path className="celebration-ribbon" d="m33 63-4 20 19-9 19 9-4-20"/><path className="celebration-check" d="m37 43 8 8 15-17"/></svg><strong>{celebration.message}</strong><span>أتممت هدف هذه الفترة</span></div></div>}
  {sessionSummary&&<div className="dhikr-session-summary" role="dialog" aria-modal="true" aria-label="ملخص جلسة الذكر"><section><button className="summary-close" onClick={()=>setSessionSummary(null)} aria-label="إغلاق الملخص">×</button><span className="summary-mark">✓</span><h2>ملخص الجلسة</h2><p>أنجزت <b>{ar(sessionSummary.quantity)}</b> ذكرًا في <b>{fmt(Math.round(sessionSummary.elapsedSeconds))}</b></p><div className="session-summary-kpis"><span>{ar(sessionSummary.roundCount)} جولات</span><span>متوسط الجولة {fmt(Math.round(sessionSummary.averageRoundSeconds))}</span></div><div className="session-round-list">{sessionSummary.rounds.map((round,index)=><div key={round.id}><span>الجولة {ar(index+1)}</span><b>{ar(round.amount)} ذكر</b><time>{fmt(Math.round(round.durationSeconds))}</time></div>)}</div><button className="primary" onClick={()=>setSessionSummary(null)}>متابعة</button></section></div>}
 </section>
}
