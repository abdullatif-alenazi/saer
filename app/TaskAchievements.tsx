"use client";
import {useMemo,useState} from "react";
import type {ExecutionRecord,PlannedActivity,UnitProgress} from "./local-store";

type Range="week"|"month"|"year";
const ar=(value:number)=>value.toLocaleString("ar-SA");
const dateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const weekdayNames=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const weekdayShort=["أح","إث","ثل","أر","خم","جم","سب"];
const monthNames=Array.from({length:12},(_,month)=>new Intl.DateTimeFormat("ar-SA",{month:"short"}).format(new Date(2024,month,1)));

export default function TaskAchievements({activity,records,unitProgress,weekStartsOn,onClose}:{activity:PlannedActivity;records:ExecutionRecord[];unitProgress:UnitProgress[];weekStartsOn:"saturday"|"sunday";onClose:()=>void}){
 const [range,setRange]=useState<Range>("week"),now=new Date(),today=dateKey(now);
 const values=useMemo(()=>{
  const activityRecords=records.filter(record=>record.activityId===activity.id||(!record.activityId&&record.activity===activity.name));
  const byDay=new Map<string,number>();
  if(activity.unitTracking){
   for(const progress of unitProgress.filter(item=>item.activityId===activity.id)){
    const count=activity.unitTracking.periods.reduce((sum,period)=>sum+Math.max(progress.counterByPeriod[period.id]??0,(progress.completedUnitsByPeriod[period.id]?.length??0)*period.unitValue),0);
    byDay.set(progress.date,count);
   }
  }
  for(const record of activityRecords){if(record.status==="missed")continue;const key=record.dueKey??dateKey(new Date(record.completedAt));if(activity.unitTracking)byDay.set(key,Math.max(byDay.get(key)??0,record.quantity??0));else byDay.set(key,(byDay.get(key)??0)+((record.quantity??record.minutes)||1))}
  return byDay;
 },[activity,records,unitProgress]);
 const getDay=(date:Date)=>values.get(dateKey(date))??0;
 const firstDay=weekStartsOn==="saturday"?6:0,weekStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()-firstDay+7)%7));
 const summary=range==="week"?(()=>{let total=0;for(let index=0;index<7;index++){const date=new Date(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate()+index);total+=getDay(date)}return total})():range==="month"?(()=>{let total=0;for(let day=1;day<=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();day++)total+=getDay(new Date(now.getFullYear(),now.getMonth(),day));return total})():(()=>{let total=0;for(let month=0;month<12;month++){const days=new Date(now.getFullYear(),month+1,0).getDate();for(let day=1;day<=days;day++)total+=getDay(new Date(now.getFullYear(),month,day))}return total})();
 const unit=activity.unitTracking?"ذكرًا":activity.unit??(activity.template==="رياضة"?"عدة":"دقيقة");
 const dailyTarget=activity.unitTracking?activity.unitTracking.periods.reduce((sum,period)=>sum+period.target,0):activity.quantity??1;
 const weekly=Array.from({length:7},(_,index)=>{const date=new Date(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate()+index);return{date,label:weekdayNames[date.getDay()],short:weekdayShort[date.getDay()],value:getDay(date),key:dateKey(date)}});
 const monthDays=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),monthOffset=(new Date(now.getFullYear(),now.getMonth(),1).getDay()-firstDay+7)%7,monthWeekdays=Array.from({length:7},(_,index)=>{const day=(firstDay+index)%7;return{full:weekdayNames[day],short:weekdayShort[day]}});
 const yearValues=Array.from({length:12},(_,month)=>{let total=0;for(let day=1;day<=new Date(now.getFullYear(),month+1,0).getDate();day++)total+=getDay(new Date(now.getFullYear(),month,day));return{label:monthNames[month],value:total}});
 const max=range==="week"?Math.max(1,...weekly.map(item=>item.value)):Math.max(1,...yearValues.map(item=>item.value));
 return <div className="task-achievements-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="task-achievements" role="dialog" aria-modal="true" aria-labelledby="task-achievements-title"><header><div><small>إنجاز المهمة</small><h2 id="task-achievements-title">{activity.name}</h2></div><button aria-label="إغلاق" onClick={onClose}>×</button></header><div className="task-achievement-tabs" role="tablist" aria-label="الفترة"><button className={range==="week"?"selected":""} onClick={()=>setRange("week")}>الأسبوع</button><button className={range==="month"?"selected":""} onClick={()=>setRange("month")}>الشهر</button><button className={range==="year"?"selected":""} onClick={()=>setRange("year")}>السنة</button></div><div className="task-achievement-total"><small>{range==="week"?`الأسبوع من ${weekStartsOn==="saturday"?"السبت":"الأحد"} إلى ${weekStartsOn==="saturday"?"الجمعة":"السبت"}`:range==="month"?"إنجاز هذا الشهر":"إنجاز هذه السنة"}</small><strong>{ar(summary)}</strong><span>{unit}</span></div>{range==="week"&&<div className="task-week-chart" dir="rtl" aria-label="الإنجاز اليومي خلال الأسبوع">{weekly.map(day=><div className="task-week-column" key={day.key}><small>{day.value?ar(day.value):""}</small><div className="task-week-track"><i style={{height:`${day.value?Math.max(7,day.value/max*100):3}%`}}/></div><span className={day.key===today?"today":""}>{day.short}</span></div>)}</div>}{range==="month"&&<><div className="task-month-heading">{new Intl.DateTimeFormat("ar-SA",{month:"long",year:"numeric"}).format(now)}</div><div className="task-month-grid" dir="rtl" aria-label="تقويم الإنجاز الشهري">{monthWeekdays.map(day=><b key={day.full}>{day.short}</b>)}{Array.from({length:monthOffset},(_,index)=><i key={`empty-${index}`} aria-hidden="true"/>)}{Array.from({length:monthDays},(_,index)=>{const day=index+1,date=new Date(now.getFullYear(),now.getMonth(),day),value=getDay(date),ratio=Math.min(1,value/Math.max(1,dailyTarget)),complete=value>=dailyTarget;return <div key={day} className={`${value?"has-value":""} ${dateKey(date)===today?"today":""}`}><span className={`day-progress-ring ${complete?"complete":""}`} style={{"--day-progress":`${ratio*100}%`} as React.CSSProperties}>{complete?"✓":ar(day)}</span>{value>0&&<small>{ar(value)}</small>}</div>})}</div></>}{range==="year"&&<div className="task-year-chart" aria-label="الإنجاز الشهري خلال السنة">{yearValues.map(item=><div key={item.label}><span>{item.label}</span><i><b style={{width:`${item.value?Math.max(3,item.value/max*100):0}%`}}/></i><small>{item.value?ar(item.value):"—"}</small></div>)}</div>}<footer>الأرقام مبنية على إنجازات هذه المهمة المحفوظة.</footer></section></div>
}
