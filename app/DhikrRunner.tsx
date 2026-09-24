"use client";
import {useMemo,useState} from "react";
import type {PlannedActivity,UnitPeriod,UnitProgress} from "./local-store";

const ar=(value:number)=>value.toLocaleString("ar-SA",{useGrouping:true});

export default function DhikrRunner({activity,date,initialPeriod,initial,onExit,onEdit,onChange,onFinish}:{activity:PlannedActivity;date:string;initialPeriod?:string;initial?:UnitProgress;onExit:()=>void;onEdit:()=>void;onChange:(progress:UnitProgress)=>void;onFinish:(total:number)=>void}){
 const config=activity.unitTracking!;
 const configuredPeriods=config.periods.length?config.periods:[{id:"daily",label:activity.period,period:activity.period,target:config.target,unitCount:Math.max(1,Math.ceil(config.target/Math.max(1,config.pressValue))),unitValue:config.pressValue}];
 const basePeriods=configuredPeriods.filter((period,index,all)=>all.findIndex(item=>item.period===period.period)===index);
 const [method,setMethod]=useState<"counter"|"units">(config.method),[selected,setSelected]=useState(()=>basePeriods.find(period=>period.period===initialPeriod)?.id??basePeriods[0].id);
 const [progress,setProgress]=useState<UnitProgress>(initial??{activityId:activity.id,date,counterByPeriod:{},completedUnitsByPeriod:{},updatedAt:new Date().toISOString()});
 const periods=useMemo(()=>basePeriods.map(period=>{const target=progress.targetByPeriod?.[period.id]??period.target;return{...period,target,unitCount:Math.max(1,Math.ceil(target/period.unitValue))}}),[basePeriods,progress.targetByPeriod]);
 const active=periods.find(period=>period.id===selected)??periods[0];
 const doneFor=(period:UnitPeriod,source=progress)=>Math.max(source.counterByPeriod[period.id]??0,(source.completedUnitsByPeriod[period.id]?.length??0)*period.unitValue);
 const totalTarget=periods.reduce((sum,period)=>sum+period.target,0),totalDone=periods.reduce((sum,period)=>sum+doneFor(period),0);
 const activeDone=doneFor(active),remaining=Math.max(0,active.target-activeDone),percent=active.target?Math.min(100,Math.round(activeDone/active.target*100)):0,dailyPercent=totalTarget?Math.min(100,Math.round(totalDone/totalTarget*100)):0,dailyRemaining=Math.max(0,totalTarget-totalDone);
 const persist=(next:UnitProgress)=>{const nextPeriods=basePeriods.map(period=>({...period,target:next.targetByPeriod?.[period.id]??period.target}));const completed=nextPeriods.every(period=>doneFor(period,next)>=period.target);const saved={...next,updatedAt:new Date().toISOString(),completedAt:completed?(next.completedAt??new Date().toISOString()):undefined};setProgress(saved);onChange(saved);if(completed&&!progress.completedAt)onFinish(nextPeriods.reduce((sum,period)=>sum+period.target,0))};
 const add=(amount:number)=>persist({...progress,counterByPeriod:{...progress.counterByPeriod,[active.id]:(progress.counterByPeriod[active.id]??0)+amount}});
 const undo=()=>persist({...progress,completedAt:undefined,counterByPeriod:{...progress.counterByPeriod,[active.id]:Math.max(0,(progress.counterByPeriod[active.id]??0)-config.pressValue)}});
 const toggleUnit=(index:number)=>{const current=progress.completedUnitsByPeriod[active.id]??[],next=current.includes(index)?current.filter(item=>item!==index):[...current,index];persist({...progress,completedAt:undefined,completedUnitsByPeriod:{...progress.completedUnitsByPeriod,[active.id]:next}})};
 const adjustActiveUnits=(change:number)=>{const target=Math.max(active.unitValue,active.target+(change*active.unitValue));persist({...progress,completedAt:undefined,targetByPeriod:{...(progress.targetByPeriod??{}),[active.id]:target}})};
 const completedUnits=progress.completedUnitsByPeriod[active.id]??[];
 return <section className="dhikr-runner">
  <header><button onClick={onExit} aria-label="العودة">→</button><div><small>ورد اليوم</small><h1>{activity.name}</h1></div><div className="dhikr-head-actions"><span>{ar(totalDone)} / {ar(totalTarget)}</span><button onClick={onEdit}>تعديل</button></div></header>
  {periods.length>1&&<nav className="dhikr-periods" aria-label="فترات الورد">{periods.map(period=>{const done=doneFor(period);return <button key={period.id} className={`${selected===period.id?"selected":""} ${done>=period.target?"done":""}`} onClick={()=>setSelected(period.id)}><b>{period.label.replace(/^بعد\s+/,"")}</b><span>{ar(done)} / {ar(period.target)}</span></button>})}</nav>}
  <article className="dhikr-summary dhikr-path-card">
   <div className="dhikr-path-head"><span>مسار محطة {active.label.replace(/^بعد\s+/,"")}</span><small>{ar(percent)}٪</small></div>
   <div className="dhikr-path-count"><strong>{ar(activeDone)}</strong><span>من {ar(active.target)}</span></div>
   <div className="dhikr-path" role="progressbar" aria-label={`أنجزت ${ar(activeDone)} من ${ar(active.target)}`} aria-valuemin={0} aria-valuemax={active.target} aria-valuenow={activeDone}>
    <div className="dhikr-path-rail"><b style={{width:`${percent}%`}}/><i style={{right:`clamp(12px, ${percent}%, calc(100% - 12px))`}}><span>{ar(activeDone)}</span></i></div>
    <div className="dhikr-path-ends"><span>٠</span><span>{ar(active.target)}</span></div>
   </div>
  <div className="dhikr-path-facts"><p><small>المتبقي</small><b>{ar(remaining)}</b></p><p><small>الوحدات</small><b>{ar(Math.floor(activeDone/Math.max(1,active.unitValue)))} من {ar(active.unitCount)}</b></p></div>
  <div className="dhikr-target-adjust"><span>هدف هذه المحطة اليوم</span><div><button onClick={()=>adjustActiveUnits(-1)} disabled={active.target<=active.unitValue} aria-label="إنقاص وحدة من المحطة">−</button><b>{ar(active.unitCount)} وحدات</b><button onClick={()=>adjustActiveUnits(1)} aria-label="إضافة وحدة إلى المحطة">+</button></div></div>
  </article>
  <article className="dhikr-daily-path">
   <div><span>مسار ورد اليوم</span><b>{ar(totalDone)} / {ar(totalTarget)}</b></div>
   <div className="dhikr-path dhikr-daily-rail" role="progressbar" aria-label={`أنجزت ${ar(totalDone)} من ورد اليوم ${ar(totalTarget)}`} aria-valuemin={0} aria-valuemax={totalTarget} aria-valuenow={totalDone}><div className="dhikr-path-rail"><b style={{width:`${dailyPercent}%`}}/><i style={{right:`clamp(12px, ${dailyPercent}%, calc(100% - 12px))`}}><span>{ar(totalDone)}</span></i></div></div>
   <p><span>{ar(dailyPercent)}٪ من وردك</span><b>بقي {ar(dailyRemaining)}</b></p>
  </article>
  <div className="dhikr-method"><button className={method==="counter"?"selected":""} onClick={()=>setMethod("counter")}>العداد</button><button className={method==="units"?"selected":""} onClick={()=>setMethod("units")}>الوحدات</button></div>
  {method==="counter"?<div className="dhikr-counter"><div className="dhikr-counter-choices">{[1,10,100].map(amount=><button key={amount} onClick={()=>add(amount)}><small>كل ضغطة</small><b>+{ar(amount)}</b></button>)}</div><button className="dhikr-undo" onClick={undo} disabled={activeDone===0}>↶ تراجع عن آخر زيادة</button></div>:<><div className="dhikr-units" style={{gridTemplateColumns:`repeat(${Math.min(10,Math.max(4,Math.ceil(Math.sqrt(active.unitCount))))},1fr)`}}>{Array.from({length:active.unitCount},(_,index)=><button key={index} className={completedUnits.includes(index)?"done":""} onClick={()=>toggleUnit(index)} aria-label={`الوحدة ${index+1}، قيمتها ${active.unitValue}`}><span>✓</span><small>{ar(active.unitValue)}</small></button>)}</div><p className="dhikr-unit-note">{ar(active.unitCount)} وحدات × {ar(active.unitValue)} = {ar(active.target)}</p></>}
  {totalDone>=totalTarget&&<div className="dhikr-complete"><b>تم ورد اليوم.</b><span>انتهيت. أكمل يومك بهدوء.</span></div>}
 </section>
}
