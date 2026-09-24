"use client";
import {useEffect,useMemo,useRef,useState} from "react";

type Props={date:string;today:string;calendarMode:"islamic"|"gregory";onChange:(date:string)=>void};
const key=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const startOfWeek=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()-((date.getDay()+1)%7));

export default function WeekStrip({date,today,calendarMode,onChange}:Props){
 const selected=new Date(`${date}T12:00:00`),todayDate=new Date(`${today}T12:00:00`);
 const [weekStart,setWeekStart]=useState(()=>startOfWeek(selected));
 const [motion,setMotion]=useState<"previous"|"next"|null>(null),touchStart=useRef<number|null>(null);
 useEffect(()=>setWeekStart(startOfWeek(selected)),[date]);
 const dates=useMemo(()=>Array.from({length:7},(_,index)=>new Date(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate()+index)),[weekStart]);
 const locale=calendarMode==="islamic"?"ar-SA-u-ca-islamic-umalqura":"ar-SA-u-ca-gregory";
 const sameMonth=new Intl.DateTimeFormat(locale,{month:"long",year:"numeric"}).format(dates[0])===new Intl.DateTimeFormat(locale,{month:"long",year:"numeric"}).format(dates[6]);
 const label=sameMonth?`${new Intl.DateTimeFormat(locale,{day:"numeric"}).format(dates[0])}–${new Intl.DateTimeFormat(locale,{day:"numeric",month:"long"}).format(dates[6])}`:`${new Intl.DateTimeFormat(locale,{day:"numeric",month:"short"}).format(dates[0])} – ${new Intl.DateTimeFormat(locale,{day:"numeric",month:"short"}).format(dates[6])}`;
 const move=(delta:number)=>{const next=new Date(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate()+delta*7);setMotion(delta<0?"previous":"next");setWeekStart(next);window.setTimeout(()=>setMotion(null),320)};
 const returnToday=()=>{setMotion(key(todayDate)<key(selected)?"next":"previous");setWeekStart(startOfWeek(todayDate));onChange(today);window.setTimeout(()=>setMotion(null),320)};
 return <section className="shared-week-strip" aria-label="اختيار اليوم"><div className="week-browser"><button onClick={()=>move(-1)} aria-label="الأسبوع السابق">→</button><b>{label}</b><button onClick={()=>move(1)} aria-label="الأسبوع القادم">←</button></div><div className={`week-days-window ${motion?`week-${motion}`:""}`} onTouchStart={event=>{touchStart.current=event.changedTouches[0].clientX}} onTouchEnd={event=>{if(touchStart.current===null)return;const distance=event.changedTouches[0].clientX-touchStart.current;touchStart.current=null;if(Math.abs(distance)>48)move(distance>0?-1:1)}}><div className="week-strip">{dates.map(item=>{const itemKey=key(item),isToday=itemKey===today,isSelected=itemKey===date;return <button key={itemKey} className={`${isToday?"today":""} ${isSelected?"selected":""}`} onClick={()=>onChange(itemKey)}><b>{["ح","ن","ث","ر","خ","ج","س"][item.getDay()]}</b><span>{new Intl.DateTimeFormat(locale,{day:"numeric"}).format(item)}</span></button>})}</div></div>{date!==today&&<button className="week-return-today" onClick={returnToday}>العودة إلى اليوم</button>}</section>
}
