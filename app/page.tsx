"use client";
import { useEffect, useMemo, useState } from "react";
import { activities, dayJourney, settings, templates, type Tab } from "./data";
import { clockLabel, durationLabel, fitsWindow, minuteClockLabel, resolveTimeWindow } from "./time-engine";
import { readExecutionLog, saveExecution } from "./local-store";

type Phase="idle"|"running"|"paused"|"done";
const slots=[
 {time:"—",period:"الصباح",activity:"القراءة",amount:"٥ صفحات",minutes:15,note:"أنجز… ولو لم تستمتع يا هذا.",reading:true,next:"الظهر"},
 {time:"١٣:٠٠",period:"الظهر",activity:"المشي",amount:"٢٠ دقيقة",minutes:20,note:"قم وامشِ. التفكير في المشي لا يُحسب مشيًا.",next:"العصر بعد ٣:٣٠"},
 {time:"١٦:٣٠",period:"العصر",activity:"الرياضة",amount:"٣٠ دقيقة فقط",minutes:30,note:"أنجزها الآن، واستمتع بباقي وقتك.",next:"المغرب بعد ٢:٢٥"},
 {time:"—",period:"المغرب",activity:"المهارة",amount:"٢٠ دقيقة",minutes:20,note:"جلسة واحدة تكفي. لا نؤلف ملحمة.",next:"الليل"},
 {time:"—",period:"الليل",activity:"النوم",amount:"٧ ساعات",minutes:420,note:"يكفي لهذا اليوم. أغلقه بهدوء.",next:"الصباح"},
];
const nav:{id:Tab;label:string;icon:string}[]=[{id:"plan",label:"الخطة",icon:"⌁"},{id:"day",label:"يومي",icon:"◷"},{id:"now",label:"الآن",icon:"●"},{id:"done",label:"الإنجاز",icon:"⌇"},{id:"you",label:"أنت",icon:"○"}];
const arNumber=(value:number,pad=1)=>value.toLocaleString("ar-SA",{minimumIntegerDigits:Math.max(1,pad),useGrouping:false});
const fmt=(s:number)=>`${arNumber(Math.floor(s/60),2)}:${arNumber(s%60,2)}`;

export default function Home(){
 const [tab,setTab]=useState<Tab>("now"),[previewIndex,setPreviewIndex]=useState(2),[dayPeriod,setDayPeriod]=useState<number|null>(null),[live,setLive]=useState(true),[clock,setClock]=useState<Date|null>(null),[phase,setPhase]=useState<Phase>("idle"),[pages,setPages]=useState(0),[prayer,setPrayer]=useState(""),[range,setRange]=useState("week"),[added,setAdded]=useState<string[]>([]),[savedCount,setSavedCount]=useState(0); const fallbackClock=new Date(2020,0,1,16,30); const windowNow=resolveTimeWindow(clock??fallbackClock); const prayerStarts=[windowNow.times.fajr,windowNow.times.dhuhr,windowNow.times.asr,windowNow.times.maghrib,windowNow.times.isha]; const prayerClocks=prayerStarts.map(minuteClockLabel); const slotIndex=live&&clock?windowNow.index:previewIndex; const baseSlot=slots[slotIndex]; const isShort=live&&!!clock&&!fitsWindow(baseSlot.minutes,windowNow.remainingMinutes); const suggestedMinutes=isShort?Math.max(1,windowNow.remainingMinutes):baseSlot.minutes; const nextPeriod=windowNow.nextName==="الفجر"?"الصباح":windowNow.nextName; const slot={...baseSlot,time:prayerClocks[slotIndex],minutes:suggestedMinutes,amount:isShort?`نسخة مختصرة · ${durationLabel(suggestedMinutes)}`:baseSlot.amount,note:isShort?"هذا ما يتسع له الوقت الآن. يكفي.":baseSlot.note,next:live&&clock?`${nextPeriod} بعد ${durationLabel(windowNow.remainingMinutes)}`:`${["الظهر","العصر","المغرب","الليل","الصباح"][slotIndex]} عند ${prayerClocks[(slotIndex+1)%5]}`}; const [seconds,setSeconds]=useState(baseSlot.minutes*60); const selectedDay=dayPeriod??slotIndex;
 useEffect(()=>{setClock(new Date());setSavedCount(readExecutionLog().length);const t=window.setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(t)},[]);
 useEffect(()=>{if(phase!=="running")return;const t=window.setInterval(()=>setSeconds(v=>v>0?v-1:0),1000);return()=>clearInterval(t)},[phase]);
 useEffect(()=>{if(seconds===0&&phase==="running")setPhase("done")},[seconds,phase]);
 const elapsed=useMemo(()=>Math.max(0,slot.minutes*60-seconds),[seconds,slot.minutes]);
 const reset=(i=slotIndex,isLive=false)=>{setPreviewIndex(i);setLive(isLive);setPhase("idle");setSeconds(slots[i].minutes*60);setPages(0)};
 const finish=()=>{const minutes=Math.max(1,Math.round(elapsed/60));setSavedCount(saveExecution({activity:slot.activity,minutes,quantity:slot.reading?pages:undefined,completedAt:new Date().toISOString()}));setPhase("done")};
 return <main className={`app-shell tone-${slotIndex}`} dir="rtl">
  <header className="topbar"><div className="brand"><span className="brand-mark">س</span><span>سائر</span></div>{tab==="now"?<button className="time-trigger" onClick={()=>$("time-sheet")?.showModal()}><i/>{live?(clock?clockLabel(clock):"الوقت الفعلي"):slot.time}<span>⌄</span></button>:<p className="top-date">{clock?new Intl.DateTimeFormat("ar-SA",{weekday:"long",day:"numeric",month:"long"}).format(clock):"اليوم في الرياض"}</p>}</header>
  {tab==="now"&&<Now slot={slot} phase={phase} seconds={seconds} pages={pages} elapsed={elapsed} fits={fitsWindow(slot.minutes,windowNow.remainingMinutes)} live={live} setPhase={setPhase} setPages={setPages} finish={finish} start={()=>{setSeconds(slot.minutes*60);setPages(0);setPhase("running")}}/>}
  {tab==="day"&&<DayJourney selected={selectedDay} current={slotIndex} remaining={windowNow.remainingMinutes} remainingSeconds={Math.max(0,windowNow.remainingMinutes*60-(clock?.getSeconds()??0))} prayerStarts={prayerStarts} onSelect={setDayPeriod} onStart={()=>setTab("now")}/>} 
  {tab==="plan"&&<section className="screen"><Head kicker="ما اخترته لحياتك" title="الخطة" text="ليست قائمة واجبات. هذه الأشياء التي قررت أن تجد لها مكانًا."/><button className="primary add" onClick={()=>$("add-sheet")?.showModal()}>+ إضافة إلى خطتي</button><div className="activity-list">{activities.map(a=><button key={a.id} onClick={()=>a.id==="strength"&&$("sport-sheet")?.showModal()}><span className="activity-icon">{a.type[0]}</span><div><h3>{a.name}</h3><p>{a.period} · {a.schedule.value}</p></div><span>‹</span></button>)}</div><p className="principle">سائر لا يدير العادات؛ بل الأشياء التي تريد أن تجعل لها مكانًا في حياتك.</p></section>}
  {tab==="done"&&<section className="screen"><Head kicker="حقيقة وقتك" title="الإنجاز" text="هذا ما فعلته فعلًا، وهذا كل ما أخذه منك."/>{savedCount>0&&<p className="local-log">حُفظت {arNumber(savedCount)} جلسات تنفيذ على هذا الجهاز.</p>}<div className="segmented"><button className={range==="week"?"on":""} onClick={()=>setRange("week")}>هذا الأسبوع</button><button className={range==="month"?"on":""} onClick={()=>setRange("month")}>هذا الشهر</button></div>{range==="week"?<Weekly/>:<PrayerStats/>}</section>}
  {tab==="you"&&<section className="screen"><Head kicker="كما تحب أن تُعامَل" title="أنت" text="اضبط سائر على إيقاع حياتك، لا العكس."/><div className="settings-list">{settings.map(x=><button key={x.title}><div><h3>{x.title}</h3><p>{x.note}</p></div><span>‹</span></button>)}</div><p className="version">سائر · نموذج أولي ٠.١</p></section>}
  <nav className="bottom-nav">{nav.map(n=><button key={n.id} className={tab===n.id?"active":""} onClick={()=>setTab(n.id)}><span>{n.icon}</span>{n.label}</button>)}</nav>
  <TimeSheet live={live} clock={clock} slotIndex={slotIndex} prayerClocks={prayerClocks} reset={reset} setClock={setClock}/>
  <dialog id="add-sheet" className="sheet"><SheetHead kicker="نشاط جديد" title="ماذا تريد أن تجعل له مكانًا؟"/><div className="templates">{templates.map(t=><button key={t} className={added.includes(t)?"selected":""} onClick={()=>setAdded(v=>v.includes(t)?v:[...v,t])}><span>{t}</span><i>{added.includes(t)?"✓":"+"}</i></button>)}</div><button className="primary" onClick={()=>$("add-sheet")?.close()}>{added.length?"أضف إلى الخطة":"اختر قالبًا"}</button></dialog>
  <dialog id="sport-sheet" className="sheet detail"><SheetHead kicker="رياضة · العصر" title="تمارين مقاومة"/><div className="detail-meta"><span>٤ جلسات أسبوعيًا</span><span>٣٥ دقيقة</span><span>وقت + جلسات + تكرارات</span></div><div className="exercise-list">{activities[1].items?.map(x=><div key={x.name}><b>{x.name}</b><span>{arNumber(x.sets)} جلسات × {arNumber(x.reps)} تكرارًا</span></div>)}</div><div className="result"><small>نتيجة جلسة سابقة</small><b>٣٢ دقيقة</b><span>١٠ جلسات · ١١٢ تكرارًا</span></div></dialog>
  <dialog id="prayer-sheet" className="sheet"><SheetHead kicker="تسجيل سريع" title="الصلاة مع الجماعة"/><p className="sheet-copy">كيف أدركت الصلاة؟ ضغطة واحدة تكفي.</p><div className="prayer-options">{activities[3].completionStates?.map(s=><button className={prayer===s?"selected":""} key={s} onClick={()=>setPrayer(s)}>{s}<span>{prayer===s?"✓":""}</span></button>)}</div>{prayer&&<p className="recorded">سُجلت: {prayer}</p>}</dialog>
 </main>
}

const $=(id:string)=>document.getElementById(id) as HTMLDialogElement|null;
function TimeSheet({live,clock,slotIndex,prayerClocks,reset,setClock}:{live:boolean;clock:Date|null;slotIndex:number;prayerClocks:string[];reset:(index:number,isLive?:boolean)=>void;setClock:(date:Date)=>void}){
 return <dialog id="time-sheet" className="sheet"><SheetHead kicker="أداة النموذج" title="اختر محطة زمنية"/><div className="time-options"><button className={live?"selected live-time":"live-time"} onClick={()=>{const now=new Date();reset(resolveTimeWindow(now).index,true);setClock(now);$("time-sheet")?.close()}}><span>الوقت الفعلي · الرياض</span><b>{clock?clockLabel(clock):"—"}</b></button>{slots.map((item,index)=><button key={item.period} className={!live&&index===slotIndex?"selected":""} onClick={()=>{reset(index);$("time-sheet")?.close()}}><span>{item.period}</span><b>{prayerClocks[index]}</b></button>)}</div><p className="prototype-note">المحطات مرتبطة بحساب مواقيت الصلاة في الرياض، وتتجدد يوميًا دون اتصال خارجي.</p></dialog>
}
function DayJourney({selected,current,remaining,remainingSeconds,prayerStarts,onSelect,onStart}:{selected:number;current:number;remaining:number;remainingSeconds:number;prayerStarts:number[];onSelect:(index:number)=>void;onStart:()=>void}){
 const [flipped,setFlipped]=useState(false);
 const [turning,setTurning]=useState<"out"|"in"|null>(null);
 const station=dayJourney[selected];
 const stationTime=minuteClockLabel(prayerStarts[selected]);
 const nextStart=selected===4?prayerStarts[0]+1440:prayerStarts[selected+1];
 const windowMinutes=nextStart-prayerStarts[selected];
 const available=selected===current?remaining:windowMinutes;
 const free=Math.max(0,available-station.totalMinutes);
 const elapsedPercent=selected<current?100:selected>current?0:Math.max(0,Math.min(100,((windowMinutes-remaining)/windowMinutes)*100));
 const currentMinute=nextStart-remaining;
 const currentTimeLabel=minuteClockLabel((currentMinute+1440)%1440);
 const endTimeLabel=minuteClockLabel(nextStart%1440);
 const countdownHours=Math.floor(remainingSeconds/3600),countdownMinutes=Math.floor((remainingSeconds%3600)/60),countdownSeconds=remainingSeconds%60;
 const focusTask=station.tasks.find(task=>!task.done)??station.tasks[0];
 useEffect(()=>{setFlipped(false);setTurning(null)},[selected]);
 const flip=()=>{if(turning)return;setTurning("out");window.setTimeout(()=>{setFlipped(value=>!value);setTurning("in");window.setTimeout(()=>setTurning(null),260)},210)};
 return <section className="screen day-screen">
  <div className="journey-title"><h1>رحلة اليوم</h1></div>
  <div className="journey-strip period-tiles">{dayJourney.map((item,i)=><button key={item.period} className={`${i===selected?"selected":""} ${i<current?"passed":""} ${i===current?"live":""}`} onClick={()=>onSelect(i)} aria-label={`${item.period}، يبدأ ${minuteClockLabel(prayerStarts[i])}`}><span className="period-check">{i<current?"✓":""}</span><b>{item.period}</b><small>{minuteClockLabel(prayerStarts[i])}</small></button>)}</div>
  <div className={`flip-scene ${flipped?"is-flipped":""} ${turning?`turn-${turning}`:""}`}>
   <div className="flip-card">
    {!flipped?<article className={`station-hero flip-face flip-front station-tone-${selected}`} role="button" tabIndex={0} aria-label="إظهار المهمة الحالية" onClick={flip} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();flip()}}}>
     <div className="hero-top"><div><p>{selected===current?"محطتك الآن":selected<current?"محطة مرّت":"محطة أمامك"}</p><h2>{station.period}</h2></div>{selected===current?<div className="remaining-hero"><span>تنتهي بعد</span><b>{countdownHours>0?<><strong>{arNumber(countdownMinutes)}</strong><small>د</small><strong>{arNumber(countdownHours)}</strong><small>س</small></>:<><strong className="countdown-seconds">{arNumber(countdownSeconds,2)}</strong><small>ث</small><strong>{arNumber(countdownMinutes)}</strong><small>د</small></>}</b></div>:<strong className="hero-status-static">{selected<current?"انتهت":`تبدأ ${stationTime}`}</strong>}</div>
     <div className={`period-progress ${selected===current?"is-live":selected<current?"is-past":"is-next"}`} aria-label={`من ${stationTime} إلى ${endTimeLabel}`}>
      <div className="period-rail"><span className="elapsed-rail" style={{width:`${elapsedPercent}%`}}/>{selected===current&&<span className="live-time-marker" style={{right:`clamp(8px, ${elapsedPercent}%, calc(100% - 8px))`}}><i/></span>}</div>
      {selected===current&&<span className="current-time-label" style={{right:`clamp(38px, ${elapsedPercent}%, calc(100% - 38px))`}}>الآن {currentTimeLabel}</span>}
      <div className="period-times"><span>{stationTime}</span><span>{endTimeLabel}</span></div>
     </div>
     <div className="hero-facts"><p><b>{station.tasks.length}</b><span>نشاطان</span></p><p><b>{durationLabel(station.totalMinutes)}</b><span>تحتاج فقط</span></p><p><b>{durationLabel(free)}</b><span>{selected===current?"يبقى لك":"وقت متسع"}</span></p></div>
     <span className="flip-hint">اضغط لترى مهمتك <b>↻</b></span>
    </article>:<article className={`station-hero flip-face flip-back station-tone-${selected}`} role="button" tabIndex={0} aria-label="العودة إلى ملخص المحطة" onClick={flip} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();flip()}}}>
     <div className="back-kicker"><span>الآن وقت</span><b>↻</b></div>
     <h2>{focusTask.name}</h2>
     <p className="back-duration">{focusTask.meta}</p>
     <p className="back-message">{selected===current?"أنجزها الآن، والباقي لك.":selected<current?"كانت هذه مهمتك هنا. انتهى وقتها بهدوء.":"ليست عليك الآن. حين تصلها ستجدها هنا."}</p>
     {selected===current&&!focusTask.done&&<button className="back-start" onClick={event=>{event.stopPropagation();onStart()}}>ابدأ الآن <span>←</span></button>}
     <span className="flip-hint">اضغط للعودة إلى الوقت <b>↻</b></span>
    </article>}
   </div>
  </div>
  <section className="period-task-section"><h3>ماذا تستطيع أن تنجز في {station.period}؟</h3><div className="period-task-card">{station.tasks.map(task=><div key={task.name} className={`period-task-row ${task.done?"task-done":""}`}><h4>{task.name}</h4><b>{task.meta}</b>{task.done?<span className="task-complete">تم</span>:<button onClick={onStart}>ابدأ</button>}</div>)}</div></section>
 </section>
}
function Head({kicker,title,text}:{kicker:string;title:string;text:string}){return <div className="screen-head"><p className="eyebrow">{kicker}</p><h1>{title}</h1><p>{text}</p></div>}
function SheetHead({kicker,title}:{kicker:string;title:string}){return <div className="sheet-head"><div><p className="eyebrow">{kicker}</p><h2>{title}</h2></div><button aria-label="إغلاق" onClick={e=>(e.currentTarget.closest("dialog") as HTMLDialogElement).close()}>×</button></div>}
function Now({slot,phase,seconds,pages,elapsed,setPhase,setPages,finish,start}:any){return <section className="now-view" aria-live="polite">{phase==="idle"&&<><div className="period-block"><p className="eyebrow">{slot.period}</p><p className="until">{slot.next}</p></div><div className="quiet-arc"><span/></div><div className="now-copy"><p className="eyebrow">الآن وقت</p><h1>{slot.activity}</h1><p className="amount">{slot.amount}</p>{slot.reading&&<p className="rate">بمعدل تقريبي <b>٣ دقائق للصفحة</b></p>}<p className="note">{slot.note}</p></div><button className="primary" onClick={start}>{slot.reading?"ابدأ القراءة":"ابدأ"}<span>←</span></button></>}{(phase==="running"||phase==="paused")&&<div className="focus-mode"><p className="eyebrow">قيد التنفيذ</p><h1>{slot.activity}</h1><div className="timer-ring"><div><strong>{fmt(seconds)}</strong><span>باقي من جلستك</span></div></div>{slot.reading&&<div className="page-progress"><strong>{arNumber(pages)} / ٥</strong><span>صفحات</span><button disabled={pages>=5} onClick={()=>setPages((p:number)=>Math.min(5,p+1))}>أنجزت صفحة</button></div>}<div className="session-actions"><button className="soft" onClick={()=>setPhase(phase==="running"?"paused":"running")}>{phase==="running"?"إيقاف مؤقت":"استئناف"}</button><button className="text-button" onClick={finish}>إنهاء النشاط</button></div></div>}{phase==="done"&&<div className="done-state"><span className="done-mark">✓</span><p className="eyebrow">تمت.</p><h1>{elapsed<60?"لحظات":`${arNumber(Math.max(1,Math.round(elapsed/60)))} دقيقة`}</h1><p>الآن وقتك لك.</p><button className="soft" onClick={()=>setPhase("idle")}>عودة بهدوء</button></div>}</section>}
function Weekly(){return <div className="stats"><article><h3>القراءة</h3><div><b>٥ جلسات</b><b>١س ٠٨د</b></div><p>متوسط الجلسة <strong>١٣د ٣٦ث</strong></p></article><article><h3>الرياضة</h3><div><b>٣ من ٤ جلسات</b><b>٧٥٪</b></div><p>١س ٤١د · ٣٣٦ تكرارًا</p></article><article><h3>المهارة</h3><div><b>٣ جلسات</b><b>٤٧ دقيقة</b></div></article><div className="truth"><p>كل ما أنجزته هذا الأسبوع أخذ منك</p><h2>٣ ساعات و٣٦ دقيقة فقط.</h2><span>أقل مما كان يبدو في رأسك، أليس كذلك؟</span></div><button className="prayer-link" onClick={()=>$("prayer-sheet")?.showModal()}>سجّل حالة الصلاة سريعًا <span>←</span></button></div>}
function PrayerStats(){return <div className="stats"><article><h3>الصلاة مع الجماعة</h3>{[["مع الأذان","١٢٠"],["مع الإقامة","٤٠"],["فاتتك ركعات","٦"],["فاتتك الجماعة","٣"]].map(x=><div className="stat-row" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}<p>أغلب صلواتك أدركتها من بدايتها.</p></article><div className="truth small"><p>هذه ليست محاسبة.</p><h2>إنها صورة أوضح لما حدث.</h2></div></div>}
