"use client";
import {useState} from "react";
import type {PlannedActivity,UnitPeriod,UnitProgress} from "./local-store";

const ar=(value:number)=>value.toLocaleString("ar-SA",{useGrouping:true});
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

export default function DhikrRunner({activity,date,initial,onExit,onEdit,onChange,onFinish}:{activity:PlannedActivity;date:string;initial?:UnitProgress;onExit:()=>void;onEdit:()=>void;onChange:(progress:UnitProgress)=>void;onFinish:(total:number)=>void}){
 const config=activity.unitTracking!;
 const periods=config.periods.length?config.periods:[{id:"daily",label:activity.period,period:activity.period,target:config.target,unitCount:Math.max(1,Math.ceil(config.target/Math.max(1,config.pressValue))),unitValue:config.pressValue}];
 const [method,setMethod]=useState<"counter"|"units">(config.method),[selected,setSelected]=useState(periods[0].id);
 const [progress,setProgress]=useState<UnitProgress>(initial??{activityId:activity.id,date,counterByPeriod:{},completedUnitsByPeriod:{},updatedAt:new Date().toISOString()});
 const active=periods.find(period=>period.id===selected)??periods[0];
 const doneFor=(period:UnitPeriod,source=progress)=>Math.max(source.counterByPeriod[period.id]??0,(source.completedUnitsByPeriod[period.id]?.length??0)*period.unitValue);
 const totalTarget=periods.reduce((sum,period)=>sum+period.target,0),totalDone=periods.reduce((sum,period)=>sum+Math.min(period.target,doneFor(period)),0);
 const activeDone=Math.min(active.target,doneFor(active)),remaining=Math.max(0,active.target-activeDone),percent=active.target?Math.round(activeDone/active.target*100):0;
 const persist=(next:UnitProgress)=>{const completed=periods.every(period=>doneFor(period,next)>=period.target);const saved={...next,updatedAt:new Date().toISOString(),completedAt:completed?(next.completedAt??new Date().toISOString()):undefined};setProgress(saved);onChange(saved);if(completed&&!progress.completedAt)onFinish(totalTarget)};
 const add=()=>persist({...progress,counterByPeriod:{...progress.counterByPeriod,[active.id]:clamp((progress.counterByPeriod[active.id]??0)+config.pressValue,0,active.target)}});
 const undo=()=>persist({...progress,completedAt:undefined,counterByPeriod:{...progress.counterByPeriod,[active.id]:clamp((progress.counterByPeriod[active.id]??0)-config.pressValue,0,active.target)}});
 const toggleUnit=(index:number)=>{const current=progress.completedUnitsByPeriod[active.id]??[],next=current.includes(index)?current.filter(item=>item!==index):[...current,index];persist({...progress,completedAt:undefined,completedUnitsByPeriod:{...progress.completedUnitsByPeriod,[active.id]:next}})};
 const completedUnits=progress.completedUnitsByPeriod[active.id]??[];
 return <section className="dhikr-runner">
  <header><button onClick={onExit} aria-label="العودة">→</button><div><small>ورد اليوم</small><h1>{activity.name}</h1></div><div className="dhikr-head-actions"><span>{ar(totalDone)} / {ar(totalTarget)}</span><button onClick={onEdit}>تعديل</button></div></header>
  {periods.length>1&&<nav className="dhikr-periods" aria-label="فترات الورد">{periods.map(period=>{const done=Math.min(period.target,doneFor(period));return <button key={period.id} className={`${selected===period.id?"selected":""} ${done>=period.target?"done":""}`} onClick={()=>setSelected(period.id)}><b>{period.label}</b><span>{ar(done)} / {ar(period.target)}</span></button>})}</nav>}
  <div className="dhikr-method"><button className={method==="counter"?"selected":""} onClick={()=>setMethod("counter")}>العداد</button><button className={method==="units"?"selected":""} onClick={()=>setMethod("units")}>الوحدات</button></div>
  <div className="dhikr-summary"><span>{active.label}</span><strong>{ar(activeDone)}</strong><p>من {ar(active.target)} · بقي {ar(remaining)}</p><i><b style={{width:`${percent}%`}}/></i></div>
  {method==="counter"?<div className="dhikr-counter"><button onClick={add} disabled={remaining===0}><small>كل ضغطة</small><b>+{ar(config.pressValue)}</b></button><button className="dhikr-undo" onClick={undo} disabled={activeDone===0}>↶ تراجع عن آخر زيادة</button></div>:<><div className="dhikr-units" style={{gridTemplateColumns:`repeat(${Math.min(10,Math.max(4,Math.ceil(Math.sqrt(active.unitCount))))},1fr)`}}>{Array.from({length:active.unitCount},(_,index)=><button key={index} className={completedUnits.includes(index)?"done":""} onClick={()=>toggleUnit(index)} aria-label={`الوحدة ${index+1}، قيمتها ${active.unitValue}`}><span>✓</span><small>{ar(active.unitValue)}</small></button>)}</div><p className="dhikr-unit-note">{ar(active.unitCount)} وحدات × {ar(active.unitValue)} = {ar(active.target)}</p></>}
  {totalDone>=totalTarget&&<div className="dhikr-complete"><b>تم ورد اليوم.</b><span>انتهيت. أكمل يومك بهدوء.</span></div>}
 </section>
}
