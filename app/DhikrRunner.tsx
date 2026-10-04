"use client";
import {useEffect,useMemo,useState} from "react";
import type {PlannedActivity,UnitPeriod,UnitProgress} from "./local-store";
import WeekStrip from "./WeekStrip";

const ar=(value:number)=>value.toLocaleString("ar-SA",{useGrouping:true});

export default function DhikrRunner({activity,date,today,currentPeriodIndex,calendarMode,initialPeriod,initial,onExit,onEdit,onChange,onFinish,onDateChange}:{activity:PlannedActivity;date:string;today:string;currentPeriodIndex:number;calendarMode:"islamic"|"gregory";initialPeriod?:string;initial?:UnitProgress;onExit:()=>void;onEdit:()=>void;onChange:(progress:UnitProgress)=>void;onFinish:(total:number)=>void;onDateChange:(offset:number)=>void}){
 const config=activity.unitTracking!;
 const configuredPeriods=config.periods.length?config.periods:[{id:"daily",label:activity.period,period:activity.period,target:config.target,unitCount:Math.max(1,Math.ceil(config.target/Math.max(1,config.pressValue))),unitValue:config.pressValue}];
 const basePeriods=configuredPeriods.filter((period,index,all)=>all.findIndex(item=>item.period===period.period)===index);
 const [selected,setSelected]=useState(()=>basePeriods.find(period=>period.period===initialPeriod)?.id??basePeriods[0].id);
 const [progress,setProgress]=useState<UnitProgress>(initial??{activityId:activity.id,date,counterByPeriod:{},completedUnitsByPeriod:{},updatedAt:new Date().toISOString()});
 const [increaseHistory,setIncreaseHistory]=useState<Record<string,number[]>>({}),[feedback,setFeedback]=useState<{amount:number;kind:"add"|"undo";id:number}|null>(null);
 const periods=useMemo(()=>basePeriods.map(period=>{const target=progress.targetByPeriod?.[period.id]??period.target;return{...period,target,unitCount:Math.max(1,Math.ceil(target/period.unitValue))}}),[basePeriods,progress.targetByPeriod]);
 const active=periods.find(period=>period.id===selected)??periods[0];
 const doneFor=(period:UnitPeriod,source=progress)=>Math.max(source.counterByPeriod[period.id]??0,(source.completedUnitsByPeriod[period.id]?.length??0)*period.unitValue);
 const totalTarget=periods.reduce((sum,period)=>sum+period.target,0),totalDone=periods.reduce((sum,period)=>sum+doneFor(period),0);
 const dailyRemaining=Math.max(0,totalTarget-totalDone);
 const persist=(next:UnitProgress)=>{const nextPeriods=basePeriods.map(period=>({...period,target:next.targetByPeriod?.[period.id]??period.target}));const completed=nextPeriods.every(period=>doneFor(period,next)>=period.target);const saved={...next,updatedAt:new Date().toISOString(),completedAt:completed?(next.completedAt??new Date().toISOString()):undefined};setProgress(saved);onChange(saved);if(completed&&!progress.completedAt)onFinish(nextPeriods.reduce((sum,period)=>sum+period.target,0))};
 const add=(amount:number)=>{setIncreaseHistory(current=>({...current,[active.id]:[...(current[active.id]??[]),amount]}));setFeedback({amount,kind:"add",id:Date.now()});persist({...progress,counterByPeriod:{...progress.counterByPeriod,[active.id]:(progress.counterByPeriod[active.id]??0)+amount}})};
 const undo=()=>{const history=increaseHistory[active.id]??[],amount=history.at(-1);if(!amount)return;setIncreaseHistory(current=>({...current,[active.id]:history.slice(0,-1)}));setFeedback({amount,kind:"undo",id:Date.now()});persist({...progress,completedAt:undefined,counterByPeriod:{...progress.counterByPeriod,[active.id]:Math.max(0,(progress.counterByPeriod[active.id]??0)-amount)}})};
 useEffect(()=>{if(!feedback)return;const timer=window.setTimeout(()=>setFeedback(null),760);return()=>window.clearTimeout(timer)},[feedback]);
 const adjustPeriodUnits=(period:UnitPeriod,change:number)=>{const target=Math.max(period.unitValue,period.target+(change*period.unitValue));persist({...progress,completedAt:undefined,targetByPeriod:{...(progress.targetByPeriod??{}),[period.id]:target}})};
 const periodOrder=["الصباح","الظهر","العصر","المغرب","الليل"];
 const isMissed=(period:UnitPeriod)=>date<today||(date===today&&periodOrder.indexOf(period.period)<currentPeriodIndex);
 return <section className="dhikr-runner">
  <header><button onClick={onExit} aria-label="العودة">→</button><div><small>ورد اليوم</small><h1>{activity.name}</h1></div><div className="dhikr-head-actions"><span>{ar(totalDone)} / {ar(totalTarget)}</span><button onClick={onEdit}>تعديل</button></div></header>
  <WeekStrip date={date} today={today} calendarMode={calendarMode} onChange={next=>{const current=new Date(`${date}T12:00:00`),target=new Date(`${next}T12:00:00`);onDateChange(Math.round((target.getTime()-current.getTime())/86400000))}}/>
  <article className="dhikr-overview-card">
   <div className="dhikr-station-tracks">{periods.map(period=>{const done=doneFor(period),periodProgress=Math.min(100,period.target?Math.round(done/period.target*100):0),complete=done>=period.target;return <article key={period.id} className={`dhikr-station-row ${selected===period.id?"selected":""} ${complete?"complete":""} ${!complete&&isMissed(period)?"missed":""}`} onClick={()=>setSelected(period.id)}><button className="dhikr-station-main" onClick={()=>setSelected(period.id)} aria-label={`${period.label}: ${ar(done)} من ${ar(period.target)}، اختر للعمل عليها`}><span>{period.label.replace(/^بعد\s+/,"")}</span><i><b style={{width:`${periodProgress}%`}}/><em style={{right:`${periodProgress}%`}}>{ar(done)}</em></i></button><div className="dhikr-row-units" aria-label={`العدد المطلوب في ${period.label}`}><button className="dhikr-unit-step" onClick={event=>{event.stopPropagation();adjustPeriodUnits(period,-1)}} disabled={period.target<=period.unitValue} aria-label="إنقاص العدد المطلوب">−</button><b>{ar(period.target)}</b><button className="dhikr-unit-step" onClick={event=>{event.stopPropagation();adjustPeriodUnits(period,1)}} aria-label="زيادة العدد المطلوب">+</button></div></article>})}</div>
   <div className="dhikr-day-total"><div className="dhikr-total-path"><i><b style={{width:`${totalTarget?Math.min(100,Math.round(totalDone/totalTarget*100)):0}%`}}/><em style={{right:`${totalTarget?Math.min(100,Math.round(totalDone/totalTarget*100)):0}%`}}>{ar(totalDone)}</em></i></div><div className="dhikr-total-facts"><span>إجمالي اليوم</span><b>{ar(totalTarget)}</b><small>تبقّى {ar(dailyRemaining)}</small></div></div>
  </article>
  <div className="dhikr-counter"><div className="dhikr-counter-choices">{[1,10,100].map(amount=><button key={amount} onClick={()=>add(amount)}><small>كل ضغطة</small><b>+{ar(amount)}</b>{feedback?.amount===amount&&<em key={feedback.id} className={`counter-feedback ${feedback.kind}`}>{feedback.kind==="add"?"+":"−"}{ar(amount)}</em>}</button>)}</div><button className="dhikr-undo" onClick={undo} disabled={!(increaseHistory[active.id]?.length)} aria-label="تراجع عن آخر زيادة"><span className="undo-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M8.2 8.4H4.5v-3.7M4.9 8.1a8 8 0 1 1-1 8.3"/><path d="M4.9 8.1 8.2 4.8"/></svg></span><b>تراجع عن آخر زيادة</b></button></div>
  {totalDone>=totalTarget&&<div className="dhikr-complete"><b>تم ورد اليوم.</b><span>انتهيت. أكمل يومك بهدوء.</span></div>}
 </section>
}
