"use client";
import {useEffect,useMemo,useRef,useState,type CSSProperties,type MouseEvent as ReactMouseEvent,type PointerEvent as ReactPointerEvent,type TouchEvent} from "react";
import {Pencil,Pause,Play,Square} from "lucide-react";
import {counterValue,setCounterValue,type GaugeStyle,type PlannedActivity,type TimedSession,type UnitPeriod,type UnitProgress} from "./local-store";
import {activeSeconds,checkpointSession,completePendingRound,createTimedSession,finishSession as finishTimedSession,formatStopwatch as fmt,pauseSession,removeTimedAmount,resumeSession,summarizeSession,undoTimedRound,undoTimedUnit} from "./activity-time-engine";
import WeekStrip from "./WeekStrip";

const ar=(value:number)=>value.toLocaleString("ar-SA",{useGrouping:true});

function RingGauge({totalRatio,activeRatio,totalDone,activeDone,activeLabel}:{totalRatio:number;activeRatio:number;totalDone:number;activeDone:number;activeLabel:string}){
 const dash=(ratio:number)=>`${Math.max(0,Math.min(1,ratio))*100} 100`;
 return <div className="gauge-ring-face"><svg viewBox="0 0 240 240" aria-hidden="true"><g transform="rotate(-90 120 120)"><circle className="gauge-ring-track gauge-ring-outer" cx="120" cy="120" r="94" pathLength="100"/><circle className="gauge-ring-day" cx="120" cy="120" r="94" pathLength="100" style={{strokeDasharray:dash(totalRatio)}}/><circle className="gauge-ring-track gauge-ring-inner" cx="120" cy="120" r="68" pathLength="100"/><circle className="gauge-ring-period" cx="120" cy="120" r="68" pathLength="100" style={{strokeDasharray:dash(activeRatio)}}/></g><text className="gauge-ring-label" x="120" y="99">تم إنجاز</text><text className="gauge-ring-value" x="120" y="129">{ar(totalDone)}</text><text className="gauge-ring-period-label" x="120" y="153">{activeLabel.replace(/^بعد\s+/,"")} · {ar(activeDone)}</text></svg></div>
}

type GaugeFeedback={amount:number;kind:"add"|"undo";id:number}|null;
function DhikrGauge({style,totalRatio,activeRatio,totalDone,activeDone,activeLabel,totalPercent,periodMarkers,feedback,idSuffix,className=""}:{style:GaugeStyle;totalRatio:number;activeRatio:number;totalDone:number;activeDone:number;activeLabel:string;totalPercent:number;periodMarkers:{ratio:number;label:string;state:string}[];feedback:GaugeFeedback;idSuffix:string;className?:string}){
 const gaugeTicks=style==="periods"?periodMarkers.map(marker=>marker.ratio):Array.from({length:9},(_,index)=>(index+1)/10),clipId=`gauge-shared-cut-${idSuffix}`,needleShadowId=`gauge-needle-soft-shadow-${idSuffix}`,dialShadowId=`gauge-dial-soft-shadow-${idSuffix}`;
 return <div className={`dhikr-gauge gauge-${style} ${className}`} aria-hidden={Boolean(className)}>
  <RingGauge totalRatio={totalRatio} activeRatio={activeRatio} totalDone={totalDone} activeDone={activeDone} activeLabel={activeLabel}/>
  <svg className="gauge-semi" viewBox="0 0 240 160" aria-hidden="true">
   <defs>
    <clipPath id={clipId}><rect x={style==="periods"?"-16":"0"} y={style==="periods"?"-18":"0"} width={style==="periods"?"272":"240"} height={style==="periods"?"168":"132"}/></clipPath>
    <filter id={needleShadowId} filterUnits="userSpaceOnUse" x="-20" y="-10" width="280" height="180"><feGaussianBlur in="SourceGraphic" stdDeviation="3.1" result="needleBlur"/><feOffset in="needleBlur" dx="1" dy="3.8"/></filter>
    <filter id={dialShadowId} filterUnits="userSpaceOnUse" x="-20" y="-20" width="280" height="220"><feGaussianBlur stdDeviation="3.8"/></filter>
   </defs>
   <g transform={style==="periods"?"translate(0 18)":undefined} clipPath={`url(#${clipId})`}>
    <path className="gauge-track" pathLength="100" d="M220 132V118 A100 100 0 0 0 20 118V132"/>
    <path className="gauge-leg-fill" style={{opacity:totalDone>0?1:0}} d="M220 132V118"/>
    <path className="gauge-fill" pathLength="100" style={{strokeDasharray:`${totalPercent} 100`}} d="M220 118 A100 100 0 0 0 20 118"/>
    {totalPercent===100&&<path className="gauge-leg-fill" d="M20 118V132"/>}
    {gaugeTicks.map((ratio,index)=>{const angle=-Math.PI*ratio,x1=120+98*Math.cos(angle),y1=118+98*Math.sin(angle),x2=120+103*Math.cos(angle),y2=118+103*Math.sin(angle);return <line key={index} className="gauge-tick" x1={x1} y1={y1} x2={x2} y2={y2}/>})}
    <g className={feedback?["gauge-needle",feedback.kind].join(" "):"gauge-needle"} style={{transform:`rotate(${-totalRatio*180}deg)`}}>
     <line filter={`url(#${needleShadowId})`} className="gauge-needle-shadow" x1="120" y1="118" x2="226" y2="118"/>
     <line className="gauge-needle-face" x1="120" y1="118" x2="226" y2="118"/>
    </g>
    {style==="periods"&&periodMarkers.map((marker,index)=>{const angle=-Math.PI*marker.ratio,isEnd=marker.ratio<=0||marker.ratio>=1,x=isEnd?(marker.ratio>=1?0:240):Math.max(12,Math.min(228,120+124*Math.cos(angle))),y=isEnd?118:118+124*Math.sin(angle);return <g key={`period-bubble-${index}`} className={`gauge-period-marker ${marker.state}`}><rect x={x-12} y={y-10} width="24" height="20" rx="10"/><text x={x} y={y+3}>{marker.label}</text></g>})}
    <g className="gauge-dial">
     <circle filter={`url(#${dialShadowId})`} className="gauge-dial-shadow" cx="120" cy="118" r="60"/>
     <circle className="gauge-dial-halo" cx="120" cy="118" r="63"/>
     <circle className="gauge-dial-face" cx="120" cy="118" r="56"/>
     <text className="gauge-dial-label" x="120" y="84">تم إنجاز</text>
     <text className={feedback?["gauge-dial-value","number-feedback",feedback.kind].join(" "):"gauge-dial-value"} x="120" y="116">{ar(totalDone)}</text>
    </g>
   </g>
  </svg>
 </div>
}

function DhikrStopwatch({session,pulse,showTime,onStart,onPause,onResume,onFinish}:{session:TimedSession|null;pulse:{totalSeconds:number;roundSeconds:number};showTime:boolean;onStart:()=>void;onPause:()=>void;onResume:()=>void;onFinish:()=>void}){
 const status=session?.status??"idle",rounds=session?.rounds.filter(round=>round.status==="completed")??[],savedQuantity=rounds.reduce((sum,round)=>sum+round.amount,0),pendingQuantity=Object.values(session?.pendingRoundAmounts??{}).reduce((sum,value)=>sum+value,session?.pendingRoundAmount??0),liveQuantity=savedQuantity+pendingQuantity,liveRounds=rounds.length+(pendingQuantity>0?1:0),elapsed=status==="finished"?summarizeSession(session!).elapsedSeconds:pulse.totalSeconds,quantity=status==="finished"?savedQuantity:liveQuantity,roundCount=status==="finished"?rounds.length:liveRounds,rate=elapsed>0?quantity/(elapsed/60):0;
 const [resultsExpanded,setResultsExpanded]=useState(status!=="finished");
 useEffect(()=>{setResultsExpanded(status!=="finished")},[status,session?.id]);
 return <section className={`dhikr-session-clock session-${status} ${showTime?"timer-show-time":"timer-hide-time"}`} aria-label="مؤقت الذكر والجولات">
  <div className="dhikr-stopwatch-actions" aria-label="التحكم بالجلسة">{status==="idle"?<button type="button" className="stopwatch-start" onClick={onStart}><Play size={16} fill="currentColor"/>بدء الجلسة</button>:status==="running"?<><button type="button" className="stopwatch-finish" onClick={onFinish}><Square size={14}/>إنهاء الجلسة</button>{showTime&&<strong className="stopwatch-digital" dir="ltr">{fmt(pulse.totalSeconds)}</strong>}<button type="button" onClick={onPause}><Pause size={15}/>إيقاف مؤقت</button></>:status==="paused"?<>{showTime&&<strong className="stopwatch-digital" dir="ltr">{fmt(pulse.totalSeconds)}</strong>}<button type="button" onClick={onResume}><Play size={15}/>استئناف</button><button type="button" className="stopwatch-finish" onClick={onFinish}><Square size={14}/>إنهاء الجلسة</button></>:<><strong className="stopwatch-digital" dir="ltr">{fmt(elapsed)}</strong><button type="button" className="stopwatch-start" onClick={onStart}><Play size={16} fill="currentColor"/>جلسة جديدة</button></>}</div>
  {session&&status==="finished"&&<button type="button" className="stopwatch-results-toggle" onClick={()=>setResultsExpanded(value=>!value)} aria-expanded={resultsExpanded} aria-controls="stopwatch-finished-results"><span><b>{resultsExpanded?"إخفاء نتائج الجلسة":"عرض نتائج الجلسة"}</b><small>{ar(quantity)} ذكر · {fmt(elapsed)} · {ar(roundCount)} جولات</small></span><span className={`stopwatch-results-chevron ${resultsExpanded?"expanded":""}`} aria-hidden="true">⌄</span></button>}
  {session&&(status!=="finished"||resultsExpanded)&&<div id={status==="finished"?"stopwatch-finished-results":undefined} className="stopwatch-finished-results"><div className="stopwatch-round-results"><h3>نتائج الجولات</h3>{rounds.length?rounds.map((round,index)=><div className="stopwatch-round-row" key={round.id}><b>الجولة {ar(index+1)}</b><span>{ar(round.amount)} ذكر</span><time dir="ltr">{fmt(Math.round(round.durationSeconds))}</time></div>):<p className="stopwatch-empty">تظهر هنا الجولات التي أتممتها</p>}{status!=="finished"&&<p className="stopwatch-current-round">الجولة الحالية {ar(rounds.length+1)} · {ar(pendingQuantity)} ذكر · {fmt(pulse.roundSeconds)}</p>}</div><div className="stopwatch-session-total"><h3>إجمالي الجلسة</h3><div><span><b>{ar(quantity)}</b><small>ذكرًا</small></span>{(showTime||status==="finished")&&<span><b dir="ltr">{fmt(elapsed)}</b><small>الزمن الفعلي</small></span>}<span><b>{ar(roundCount)}</b><small>جولات</small></span><span><b>{ar(Math.round(rate))}</b><small>ذكر/دقيقة</small></span></div></div></div>}
 </section>
}

export default function DhikrRunner({activity,date,today,currentPeriodIndex,calendarMode,weekStartsOn,initialPeriod,initial,onExit,onEdit,onChange,onFinish,onDateChange,onGaugeStyleChange,onOpenAchievements}:{activity:PlannedActivity;date:string;today:string;currentPeriodIndex:number;calendarMode:"islamic"|"gregory"|"mixed";weekStartsOn:"saturday"|"sunday";initialPeriod?:string;initial?:UnitProgress;onExit:()=>void;onEdit:()=>void;onChange:(progress:UnitProgress,sync?:boolean)=>void;onFinish:(summary:{sessionId:string;total:number;durationSeconds:number;rounds:ReturnType<typeof summarizeSession>["rounds"];target:number;date:string})=>void;onDateChange:(offset:number)=>void;onGaugeStyleChange:(style:GaugeStyle)=>void;onOpenAchievements:()=>void}){
 const config=activity.unitTracking!;
 const timingEnabled=Boolean(config.timing)&&config.timing?.enabled!==false,showTimer=config.timing?.showTimer!==false;
 const configuredPeriods=config.periods.length?config.periods:[{id:"daily",label:activity.period,period:activity.period,target:config.target,unitCount:Math.max(1,Math.ceil(config.target/Math.max(1,config.pressValue))),unitValue:config.pressValue}];
 const basePeriods=configuredPeriods.filter((period,index,all)=>all.findIndex(item=>item.period===period.period)===index);
 const [selected,setSelected]=useState(()=>basePeriods.find(period=>period.period===initialPeriod)?.id??basePeriods[0].id);
 const [progress,setProgress]=useState<UnitProgress>(initial??{activityId:activity.id,date,counterByPeriod:{},completedUnitsByPeriod:{},updatedAt:new Date().toISOString()});
 const [operationHistory,setOperationHistory]=useState<{periodId:string;counter:number;units:number[];roundId?:string;session?:TimedSession}[]>([]),[feedback,setFeedback]=useState<{amount:number;kind:"add"|"undo";id:number;periodId?:string}|null>(null);
 const [decrementMode,setDecrementMode]=useState(false),holdTimer=useRef<number|null>(null),longPressTriggered=useRef(false);
 const [gaugeTransition,setGaugeTransition]=useState<{from:GaugeStyle;direction:"left"|"right"}|null>(null),gaugeTouchStart=useRef<{x:number;y:number}|null>(null);
 const [celebration,setCelebration]=useState<{message:string;id:number}|null>(null);
 const [timerSession,setTimerSession]=useState<TimedSession|null>(null),[timerPulse,setTimerPulse]=useState({totalSeconds:0,roundSeconds:0});
 const progressRef=useRef(progress),sessionRef=useRef<TimedSession|null>(null),totalAnchor=useRef(0),totalBase=useRef(0),roundAnchor=useRef(0),roundBase=useRef(0),handledPressEvents=useRef(new WeakSet<Event>());
 useEffect(()=>{progressRef.current=progress},[progress]);useEffect(()=>{sessionRef.current=timerSession},[timerSession]);
 const periods=useMemo(()=>basePeriods.map(period=>{const target=progress.targetByPeriod?.[period.id]??period.target;return{...period,target,unitCount:Math.max(1,Math.ceil(target/period.unitValue))}}),[basePeriods,progress.targetByPeriod]);
 const active=periods.find(period=>period.id===selected)??periods[0];
 const doneFor=(period:UnitPeriod,source=progress)=>Math.max(counterValue(source,period.id),(source.completedUnitsByPeriod[period.id]?.length??0)*period.unitValue);
 const periodOrder=["الصباح","الظهر","العصر","المغرب","الليل"];
 const isMissed=(period:UnitPeriod)=>date<today||(date===today&&periodOrder.indexOf(period.period)<currentPeriodIndex);
 const gaugeStyle=config.gaugeStyle??"ring";
 const totalTarget=periods.reduce((sum,period)=>sum+period.target,0),totalDone=periods.reduce((sum,period)=>sum+doneFor(period),0);
 const periodMarkers=periods.reduce<{ratio:number;label:string;state:string}[]>((markers,period,index)=>{const boundary=periods.slice(0,index+1).reduce((sum,item)=>sum+item.target,0),labels:Record<string,string>={الصباح:"ص",الظهر:"ظ",العصر:"ع",المغرب:"م",الليل:"ل"},done=doneFor(period),state=done>=period.target?"complete":isMissed(period)?"missed":period.id===active.id?"selected":"";if(totalTarget>0)markers.push({ratio:boundary/totalTarget,label:labels[period.period]??period.period.slice(0,1),state});return markers},[]);
 const dailyRemaining=Math.max(0,totalTarget-totalDone);
 const roundRemaining=decrementMode?doneFor(active):Number.POSITIVE_INFINITY;
 const configuredRoundAmount=Math.max(1,Math.floor(config.timing?.roundSize??100));
 const roundAmount=decrementMode?Math.min(configuredRoundAmount,roundRemaining):configuredRoundAmount;
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
 const startNewSession=()=>{const next=createTimedSession(activity.id,date);totalBase.current=0;roundBase.current=0;totalAnchor.current=performance.now();roundAnchor.current=totalAnchor.current;setTimerPulse({totalSeconds:0,roundSeconds:0});saveSession(next,true)};
 const resumeCurrentSession=()=>{const current=sessionRef.current;if(!current||current.status!=="paused")return;const next=resumeSession(current);totalBase.current=next.elapsedMs;roundBase.current=next.roundElapsedMs;totalAnchor.current=performance.now();roundAnchor.current=totalAnchor.current;saveSession(next,true);setTimerPulse({totalSeconds:activeSeconds(next,next.elapsedMs),roundSeconds:Math.floor(next.roundElapsedMs/1000)})};
 const captureRound=()=>{const current=sessionRef.current;if(!current||current.status==="finished")return current;const now=performance.now(),elapsed=elapsedAt(now),roundElapsed=roundElapsedAt(now),checkpointed=checkpointSession(current,elapsed,roundElapsed),next=completePendingRound(checkpointed,roundElapsed/1000,config.method==="units"?"units":"counter",Date.now());if(next.rounds.length===checkpointed.rounds.length)return current;totalBase.current=elapsed;roundBase.current=0;totalAnchor.current=current.status==="running"?now:0;roundAnchor.current=current.status==="running"?now:0;const saved=saveSession(next,true);setTimerPulse({totalSeconds:activeSeconds(saved.timedSessions?.find(item=>item.id===next.id)??next,elapsed),roundSeconds:0});return next};
 const endSession=(base=progressRef.current)=>{let current=sessionRef.current;if(!current||current.status==="finished")return;if(Object.values(current.pendingRoundAmounts??{}).some(value=>value>0)||current.pendingRoundAmount)captureRound();current=sessionRef.current;if(!current)return;const elapsed=elapsedAt(),next=finishTimedSession(current,elapsed,current.roundElapsedMs),summary=summarizeSession(next);totalAnchor.current=0;roundAnchor.current=0;totalBase.current=next.elapsedMs;roundBase.current=next.roundElapsedMs;saveSession(next,true,base);setTimerPulse({totalSeconds:summary.elapsedSeconds,roundSeconds:0});if(summary.quantity>0)onFinish({sessionId:next.id,total:summary.quantity,durationSeconds:summary.elapsedSeconds,rounds:summary.rounds,target:totalTarget,date})};
 const add=(requestedAmount:number)=>{
  const currentProgress=progressRef.current,before=doneFor(active,currentProgress),current=sessionRef.current;
  const timedCurrent=current?.status==="running";
  if(decrementMode&&before===0||timingEnabled&&!timedCurrent)return;
  const amount=decrementMode?Math.min(Math.max(1,Math.floor(requestedAmount)),before):Math.max(1,Math.floor(requestedAmount));
  if(!amount)return;
  const nowPerf=performance.now();
  const units=[...(currentProgress.completedUnitsByPeriod[active.id]??[])],nextCount=decrementMode?Math.max(0,before-amount):before+amount,kind=decrementMode?"undo":"add";
  const nextProgress=setCounterValue(currentProgress,active.id,nextCount,units.length*active.unitValue);
  nextProgress.completedUnitsByPeriod=decrementMode?{...currentProgress.completedUnitsByPeriod,[active.id]:[]}:currentProgress.completedUnitsByPeriod;
  setOperationHistory(value=>[...value,{periodId:active.id,counter:before,units,...(timedCurrent&&current?{session:current}:{})}]);
  setFeedback({amount,kind,id:Date.now(),periodId:active.id});
  if(timedCurrent&&current){
   const elapsed=elapsedAt(nowPerf),roundElapsed=roundElapsedAt(nowPerf);let nextSession:TimedSession;
   if(decrementMode){
    const updated=removeTimedAmount(current,active.id,amount),beforeSeconds=current.rounds.filter(round=>round.status==="completed").reduce((sum,round)=>sum+round.durationSeconds,0),afterSeconds=updated.rounds.filter(round=>round.status==="completed").reduce((sum,round)=>sum+round.durationSeconds,0),adjustedElapsed=Math.max(0,elapsed-(beforeSeconds-afterSeconds)*1000);nextSession=checkpointSession(updated,adjustedElapsed,roundElapsed);
   }else{
    const base=checkpointSession(current,elapsed,roundElapsed),pendingRoundAmounts={...(base.pendingRoundAmounts??{}),[active.id]:(base.pendingRoundAmounts?.[active.id]??0)+amount},pending={...base,pendingRoundAmount:Object.values(pendingRoundAmounts).reduce((sum,value)=>sum+value,0),pendingRoundAmounts,pendingRoundPeriodId:active.id};nextSession=completePendingRound(pending,roundElapsed/1000,"counter",Date.now());roundBase.current=0;roundAnchor.current=nowPerf;setTimerPulse({totalSeconds:activeSeconds(nextSession,elapsed),roundSeconds:0});
   }
   totalBase.current=nextSession.elapsedMs;roundBase.current=nextSession.roundElapsedMs;totalAnchor.current=nowPerf;roundAnchor.current=nowPerf;
   const saved=persist({...nextProgress,timedSessions:[...(currentProgress.timedSessions??[]).filter(item=>item.id!==nextSession.id),nextSession],activeSessionId:nextSession.id});
   setTimerSession(saved.timedSessions?.find(item=>item.id===nextSession.id)??nextSession);sessionRef.current=nextSession;
  }else persist(nextProgress);
 if(!decrementMode&&before<active.target&&nextCount>=active.target){const messages=["أحسنت صنعًا","رائع، لقد أنجزت","بارك الله فيك","كم أنت بطل"];setCelebration({message:messages[Math.floor(Math.random()*messages.length)],id:Date.now()})}
 };
 const handleCounterPointerUp=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(!event.isPrimary||event.button!==0||handledPressEvents.current.has(event.nativeEvent))return;handledPressEvents.current.add(event.nativeEvent);event.preventDefault();add(roundAmount)};
 const handleCounterClick=(event:ReactMouseEvent<HTMLButtonElement>)=>{if(event.detail!==0||handledPressEvents.current.has(event.nativeEvent))return;handledPressEvents.current.add(event.nativeEvent);add(roundAmount)};
 const toggleUnit=(unitIndex:number)=>{
  const currentProgress=progressRef.current,current=sessionRef.current,timedCurrent=current?.status==="running";
  if(timingEnabled&&!timedCurrent)return;
  const before=doneFor(active,currentProgress),targetIndexes=currentProgress.completedUnitsByPeriod[active.id]??Array.from({length:Math.floor(before/active.unitValue)},(_,index)=>index),isDone=targetIndexes.includes(unitIndex),amount=isDone?Math.min(active.unitValue,before):before<active.target?Math.min(active.unitValue,active.target-before):active.unitValue;if(!amount)return;
  const units=isDone?targetIndexes.filter(index=>index!==unitIndex):[...targetIndexes,unitIndex].sort((a,b)=>a-b),nextCount=isDone?Math.max(0,before-amount):before+amount,nowPerf=performance.now();
  setOperationHistory(value=>[...value,{periodId:active.id,counter:before,units:targetIndexes,...(timedCurrent&&current?{session:current}:{})}]);
  let nextSession=current,elapsed=timedCurrent?elapsedAt(nowPerf):0;
  if(timedCurrent&&current){
   const roundElapsed=roundElapsedAt(nowPerf),base=checkpointSession(current,elapsed,roundElapsed),pendingRoundAmounts={...(base.pendingRoundAmounts??{})},pendingUnitIndexesByPeriod={...(base.pendingUnitIndexesByPeriod??{})},pendingForPeriod=pendingRoundAmounts[active.id]??0,indexes=pendingUnitIndexesByPeriod[active.id]??[];
   if(isDone&&indexes.includes(unitIndex)){pendingRoundAmounts[active.id]=Math.max(0,pendingForPeriod-amount);pendingUnitIndexesByPeriod[active.id]=indexes.filter(index=>index!==unitIndex);nextSession={...base,pendingRoundAmounts,pendingRoundAmount:Object.values(pendingRoundAmounts).reduce((sum,value)=>sum+value,0),pendingRoundPeriodId:Object.keys(pendingRoundAmounts).find(key=>(pendingRoundAmounts[key]??0)>0),pendingUnitIndexesByPeriod,pendingUnitIndexes:pendingUnitIndexesByPeriod[active.id]}}
   else if(isDone)nextSession=undoTimedUnit(base,active.id,unitIndex,amount);
   else{pendingRoundAmounts[active.id]=pendingForPeriod+amount;pendingUnitIndexesByPeriod[active.id]=[...indexes,unitIndex];const pending={...base,pendingRoundAmounts,pendingRoundAmount:Object.values(pendingRoundAmounts).reduce((sum,value)=>sum+value,0),pendingRoundPeriodId:active.id,pendingUnitIndexesByPeriod,pendingUnitIndexes:pendingUnitIndexesByPeriod[active.id]};nextSession=completePendingRound(pending,roundElapsed/1000,"units",Date.now());roundBase.current=0;roundAnchor.current=nowPerf;setTimerPulse({totalSeconds:activeSeconds(nextSession,elapsed),roundSeconds:0})}
   totalBase.current=nextSession.elapsedMs;roundBase.current=nextSession.roundElapsedMs;totalAnchor.current=nowPerf;roundAnchor.current=nowPerf;
  }
  const next=setCounterValue({...currentProgress,completedUnitsByPeriod:{...currentProgress.completedUnitsByPeriod,[active.id]:units}},active.id,nextCount,units.length*active.unitValue);
  next.completedUnitsByPeriod={...currentProgress.completedUnitsByPeriod,[active.id]:units};
  const saved=timedCurrent&&nextSession?persist({...next,timedSessions:[...(currentProgress.timedSessions??[]).filter(item=>item.id!==nextSession!.id),nextSession],activeSessionId:nextSession.id}):persist(next);
  if(timedCurrent&&nextSession){setTimerSession(saved.timedSessions?.find(item=>item.id===nextSession!.id)??nextSession);sessionRef.current=nextSession}
  if(!isDone&&before<active.target&&nextCount>=active.target){const messages=["أحسنت صنعًا","رائع، لقد أنجزت","بارك الله فيك","كم أنت بطل"];setCelebration({message:messages[Math.floor(Math.random()*messages.length)],id:Date.now()})}
 };
 const undo=()=>{
  const last=operationHistory.at(-1),currentProgress=progressRef.current;
  if(!last){
   const targetPeriod=active,before=doneFor(targetPeriod,currentProgress);if(before<=0)return;
   const requested=config.method==="units"?targetPeriod.unitValue:roundAmount,amount=Math.min(before,Math.max(1,Math.floor(requested))),restored=before-amount;
   const previousUnits=currentProgress.completedUnitsByPeriod[targetPeriod.id]??[],units=config.method==="units"?previousUnits.slice(0,Math.floor(restored/targetPeriod.unitValue)):previousUnits;
   let next=setCounterValue(currentProgress,targetPeriod.id,restored,config.method==="units"?units.length*targetPeriod.unitValue:0);next.completedUnitsByPeriod={...currentProgress.completedUnitsByPeriod,[targetPeriod.id]:units};
   const current=sessionRef.current;
   if(current&&current.status!=="finished"){
    const updated=removeTimedAmount(current,targetPeriod.id,amount),beforeSeconds=current.rounds.filter(round=>round.status==="completed").reduce((sum,round)=>sum+round.durationSeconds,0),afterSeconds=updated.rounds.filter(round=>round.status==="completed").reduce((sum,round)=>sum+round.durationSeconds,0),now=performance.now(),elapsed=Math.max(0,elapsedAt(now)-(beforeSeconds-afterSeconds)*1000),roundElapsed=roundElapsedAt(now),nextSession=checkpointSession(updated,elapsed,roundElapsed);
    totalBase.current=nextSession.elapsedMs;roundBase.current=nextSession.roundElapsedMs;totalAnchor.current=current.status==="running"?now:0;roundAnchor.current=current.status==="running"?now:0;
    next={...next,timedSessions:[...(currentProgress.timedSessions??[]).filter(item=>item.id!==nextSession.id),nextSession],activeSessionId:nextSession.status==="finished"?undefined:nextSession.id};sessionRef.current=nextSession;setTimerSession(nextSession);
   }
   setFeedback({amount,kind:"undo",id:Date.now(),periodId:targetPeriod.id});persist(next);return;
  }
  const targetPeriod=periods.find(period=>period.id===last.periodId);if(!targetPeriod)return;
  const before=doneFor(targetPeriod,currentProgress),restored=Math.max(last.counter,last.units.length*targetPeriod.unitValue);
  setOperationHistory(value=>value.slice(0,-1));setFeedback({amount:Math.abs(restored-before),kind:restored>=before?"add":"undo",id:Date.now(),periodId:last.periodId});
  const next=setCounterValue(currentProgress,last.periodId,restored,last.units.length*targetPeriod.unitValue),current=sessionRef.current;let nextSession=current;
  if(last.session)nextSession=last.session;else if(current&&last.roundId)nextSession=undoTimedRound(current,last.roundId);
  if(nextSession&&current){
   const now=performance.now(),currentSeconds=current.rounds.filter(round=>round.status==="completed").reduce((sum,round)=>sum+round.durationSeconds,0),restoredSeconds=nextSession.rounds.filter(round=>round.status==="completed").reduce((sum,round)=>sum+round.durationSeconds,0),elapsed=Math.max(0,elapsedAt(now)+(restoredSeconds-currentSeconds)*1000),roundElapsed=roundElapsedAt(now);
   nextSession=checkpointSession({...nextSession,status:current.status,interrupted:current.interrupted},elapsed,roundElapsed);totalBase.current=nextSession.elapsedMs;roundBase.current=nextSession.roundElapsedMs;totalAnchor.current=current.status==="running"?now:0;roundAnchor.current=current.status==="running"?now:0;
  }
  const updated:UnitProgress={...next,completedAt:undefined,completedUnitsByPeriod:{...currentProgress.completedUnitsByPeriod,[last.periodId]:last.units}};
  if(nextSession){updated.timedSessions=[...(currentProgress.timedSessions??[]).filter(item=>item.id!==nextSession.id),nextSession];updated.activeSessionId=nextSession.status==="finished"?undefined:nextSession.id;}
  const savedProgress=persist(updated);if(nextSession){sessionRef.current=nextSession;setTimerSession(savedProgress.timedSessions?.find(item=>item.id===nextSession.id)??nextSession)}
 };
 const startModeHold=()=>{if(holdTimer.current!==null)window.clearTimeout(holdTimer.current);longPressTriggered.current=false;holdTimer.current=window.setTimeout(()=>{longPressTriggered.current=true;setDecrementMode(value=>!value)},520)};
 const endModeHold=()=>{if(holdTimer.current!==null){window.clearTimeout(holdTimer.current);holdTimer.current=null}};
 const handleGaugeTouchStart=(event:TouchEvent<HTMLDivElement>)=>{const touch=event.touches[0];if(touch)gaugeTouchStart.current={x:touch.clientX,y:touch.clientY}};
 const handleGaugeTouchEnd=(event:TouchEvent<HTMLDivElement>)=>{const start=gaugeTouchStart.current,touch=event.changedTouches[0];gaugeTouchStart.current=null;if(!start||!touch)return;const dx=touch.clientX-start.x,dy=touch.clientY-start.y;if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.2)return;const styles:GaugeStyle[]=["ring","semi","periods"],nextStyle=styles[(styles.indexOf(gaugeStyle)+(dx<0?1:styles.length-1))%styles.length];setGaugeTransition({from:gaugeStyle,direction:dx<0?"left":"right"});onGaugeStyleChange(nextStyle)};
 useEffect(()=>{setOperationHistory([]);const saved=(progressRef.current.timedSessions??[]).find(item=>item.id===progressRef.current.activeSessionId)??[...(progressRef.current.timedSessions??[])].reverse().find(item=>item.date===date);if(saved?.status==="running"){const recovered=pauseSession(saved,saved.elapsedMs,saved.roundElapsedMs,Date.now(),true);totalBase.current=recovered.elapsedMs;roundBase.current=recovered.roundElapsedMs;saveSession(recovered,true);setTimerPulse({totalSeconds:activeSeconds(recovered,recovered.elapsedMs),roundSeconds:Math.floor(recovered.roundElapsedMs/1000)})}else if(saved){sessionRef.current=saved;setTimerSession(saved);totalBase.current=saved.elapsedMs;roundBase.current=saved.roundElapsedMs;setTimerPulse({totalSeconds:activeSeconds(saved,saved.elapsedMs),roundSeconds:Math.floor(saved.roundElapsedMs/1000)})}else{sessionRef.current=null;setTimerSession(null);totalBase.current=0;roundBase.current=0;setTimerPulse({totalSeconds:0,roundSeconds:0})}const onVisibility=()=>{if(document.visibilityState==="hidden")stopTimer(true)};const onPageHide=()=>stopTimer(true);document.addEventListener("visibilitychange",onVisibility);window.addEventListener("pagehide",onPageHide);return()=>{document.removeEventListener("visibilitychange",onVisibility);window.removeEventListener("pagehide",onPageHide);stopTimer(true)}},[activity.id,date]);
 useEffect(()=>{if(timerSession?.status!=="running")return;const interval=window.setInterval(()=>checkpoint(false),1000);return()=>window.clearInterval(interval)},[timerSession?.status]);
 useEffect(()=>{if(!feedback)return;const timer=window.setTimeout(()=>setFeedback(null),760);return()=>window.clearTimeout(timer)},[feedback]);
 useEffect(()=>{if(!celebration)return;const timer=window.setTimeout(()=>setCelebration(null),3000);return()=>window.clearTimeout(timer)},[celebration]);
 useEffect(()=>{if(!gaugeTransition)return;const timer=window.setTimeout(()=>setGaugeTransition(null),460);return()=>window.clearTimeout(timer)},[gaugeTransition]);
 const adjustPeriodUnits=(period:UnitPeriod,change:number)=>{const target=Math.max(period.unitValue,period.target+(change*period.unitValue));persist({...progress,completedAt:undefined,targetByPeriod:{...(progress.targetByPeriod??{}),[period.id]:target}})};
 return <section className="dhikr-runner">
  <header><button className="dhikr-exit" onClick={onExit} aria-label="العودة إلى رحلة اليوم" title="العودة إلى رحلة اليوم">↩</button><div><button className="dhikr-runner-title" onClick={onOpenAchievements}>{activity.name}</button></div><div className="dhikr-head-actions"><button onClick={onEdit} aria-label="تعديل الورد" title="تعديل الورد"><Pencil size={19} strokeWidth={2} aria-hidden="true"/></button></div></header>
  <WeekStrip date={date} today={today} calendarMode={calendarMode} weekStartsOn={weekStartsOn} onChange={next=>{const current=new Date(`${date}T12:00:00`),target=new Date(`${next}T12:00:00`);onDateChange(Math.round((target.getTime()-current.getTime())/86400000))}}/>
  <article className="dhikr-overview-card">
   <div className="dhikr-day-total dhikr-gauge-summary" aria-label="ملخص ورد اليوم">
    <div className="gauge-swipe-stage" onTouchStart={handleGaugeTouchStart} onTouchEnd={handleGaugeTouchEnd} onTouchCancel={()=>{gaugeTouchStart.current=null}} aria-label="اسحب لتغيير شكل العداد">
     {gaugeTransition&&<DhikrGauge key={`from-${gaugeTransition.from}`} style={gaugeTransition.from} totalRatio={totalRatio} activeRatio={active.target?Math.min(1,doneFor(active)/active.target):0} totalDone={totalDone} activeDone={doneFor(active)} activeLabel={active.label} totalPercent={totalPercent} periodMarkers={periodMarkers} feedback={feedback} idSuffix={`${activity.id}-${gaugeTransition.from}-old`} className={`gauge-swipe-old gauge-out-${gaugeTransition.direction}`}/>}
     <DhikrGauge key={`current-${gaugeStyle}`} style={gaugeStyle} totalRatio={totalRatio} activeRatio={active.target?Math.min(1,doneFor(active)/active.target):0} totalDone={totalDone} activeDone={doneFor(active)} activeLabel={active.label} totalPercent={totalPercent} periodMarkers={periodMarkers} feedback={feedback} idSuffix={`${activity.id}-${gaugeStyle}-current`} className={gaugeTransition?`gauge-swipe-new gauge-in-${gaugeTransition.direction}`:""}/>
    </div>
    <p className={`dhikr-goal-remaining ${dayEnded&&dailyRemaining>0?"late":""}`}>{dailyRemaining>0?<>تبقّى لإنجاز هدفك <b>{ar(dailyRemaining)}</b> ذكرًا</>:"أتممت هدفك اليوم"}</p>
   </div>
   <div className="dhikr-station-tracks">{periods.map(period=>{const done=doneFor(period),periodProgress=Math.min(100,period.target?Math.round(done/period.target*100):0),complete=done>=period.target,feedbackKind=selected===period.id||feedback?.periodId===period.id?feedback?.kind:null;return <article key={period.id} className={`dhikr-station-row ${selected===period.id?"selected":""} ${complete?"complete":""} ${!complete&&isMissed(period)?"missed":""}`} onClick={()=>setSelected(period.id)}><button className="dhikr-station-main" onClick={()=>setSelected(period.id)} aria-label={`${period.label}: ${ar(done)} من ${ar(period.target)}، اختر للعمل عليها`}><span>{period.label.replace(/^بعد\s+/,"")}</span><i><b style={{"--period-progress":String(periodProgress/100)} as CSSProperties}/><em className={feedbackKind?["pulse",feedbackKind].join(" "):""} style={{right:`${periodProgress}%`}}>{ar(done)}</em></i></button><div className="dhikr-row-units" aria-label={`العدد المطلوب في ${period.label}`}><button className="dhikr-unit-step" onClick={event=>{event.stopPropagation();adjustPeriodUnits(period,-1)}} disabled={period.target<=period.unitValue} aria-label="إنقاص العدد المطلوب">−</button><b>{ar(period.target)}</b><button className="dhikr-unit-step" onClick={event=>{event.stopPropagation();adjustPeriodUnits(period,1)}} aria-label="زيادة العدد المطلوب">+</button></div></article>})}</div>
  </article>
  {config.method==="units"?(timingEnabled&&timerSession?.status!=="running"?null:<section className="dhikr-unit-grid" aria-label={`وحدات الذكر، ${ar(active.unitCount)} وحدة`} style={{"--unit-count":String(active.unitCount+(doneFor(active)>=active.target?Math.floor((doneFor(active)-active.target)/active.unitValue)+1:0))} as CSSProperties}>{Array.from({length:active.unitCount+(doneFor(active)>=active.target?Math.floor((doneFor(active)-active.target)/active.unitValue)+1:0)},(_,index)=>{const doneIndexes=progress.completedUnitsByPeriod[active.id]??Array.from({length:Math.floor(doneFor(active)/active.unitValue)},(_unused,unitIndex)=>unitIndex),complete=doneIndexes.includes(index);return <button key={index} className={complete?"completed":""} onClick={()=>toggleUnit(index)} aria-pressed={complete} aria-label={`${complete?"إلغاء إكمال":"إكمال"} الوحدة ${ar(index+1)}، ${ar(active.unitValue)} أذكار`}>{complete?"✓":ar(index+1)}</button>})}</section>):<section className={`dhikr-counter ${decrementMode?"decrement-mode":""}`} aria-label="تسجيل الذكر">
  {decrementMode&&roundRemaining===0?<p className="dhikr-period-complete">لا يوجد عدد لإنقاصه</p>:(!timingEnabled||timerSession?.status==="running")&&<button type="button" className={`dhikr-round-submit ${decrementMode?"decrement-mode":""}`} disabled={!roundAmount||timingEnabled&&timerSession?.status!=="running"} onPointerUp={handleCounterPointerUp} onClick={handleCounterClick} aria-label={`${decrementMode?"إنقاص":"أتممت"} ${ar(roundAmount)} ذكرًا`}>{decrementMode?"−":"＋"}{ar(roundAmount)}</button>}
  </section>}
  {timingEnabled&&<DhikrStopwatch session={timerSession} pulse={timerPulse} showTime={showTimer} onStart={startNewSession} onPause={()=>stopTimer(false)} onResume={resumeCurrentSession} onFinish={endSession}/>}
  <div className="dhikr-session-tools" aria-label="أدوات الجلسة"><button className={`dhikr-undo ${decrementMode?"decrement-mode":""}`} onPointerDown={startModeHold} onPointerUp={endModeHold} onPointerLeave={endModeHold} onPointerCancel={endModeHold} onKeyDown={event=>{if((event.key==="Enter"||event.key===" ")&&!event.repeat)startModeHold()}} onKeyUp={endModeHold} onBlur={endModeHold} onContextMenu={event=>event.preventDefault()} onClick={()=>{if(longPressTriggered.current){longPressTriggered.current=false;return}if(decrementMode){setDecrementMode(false);return}undo()}} aria-pressed={decrementMode} aria-label={decrementMode?"إيقاف وضع الإنقاص":"تراجع عن آخر ضغطة أو أنقص من الفترة المختارة"} title={decrementMode?"اضغط للعودة إلى الزيادة":"اضغط للتراجع عن آخر ضغطة أو أنقص من الفترة المختارة"}><span className="undo-icon" aria-hidden="true">{decrementMode?<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5v14"/></svg>:<svg viewBox="0 0 24 24" fill="none"><path d="M8.2 8.4H4.5v-3.7M4.9 8.1a8 8 0 1 1-1 8.3"/><path d="M4.9 8.1 8.2 4.8"/></svg>}</span><small>{decrementMode?"إنقاص":"تراجع"}</small></button></div>
  {totalDone>=totalTarget&&<div className="dhikr-complete"><b>تم ورد اليوم.</b><span>يمكنك مواصلة الذكر لتعويض النقص في الفترات السابقة.</span></div>}
  {celebration&&<div key={celebration.id} className="dhikr-celebration" role="status" aria-live="polite"><div className="dhikr-celebration-card"><svg className="dhikr-celebration-art" viewBox="0 0 96 96" aria-hidden="true"><path className="celebration-rays" d="M48 5v10M48 81v10M5 48h10M81 48h10M17.6 17.6l7 7M71.4 71.4l7 7M78.4 17.6l-7 7M24.6 71.4l-7 7"/><circle className="celebration-medal" cx="48" cy="43" r="25"/><path className="celebration-ribbon" d="m33 63-4 20 19-9 19 9-4-20"/><path className="celebration-check" d="m37 43 8 8 15-17"/></svg><strong>{celebration.message}</strong><span>أتممت هدف هذه الفترة</span></div></div>}
 </section>
}
