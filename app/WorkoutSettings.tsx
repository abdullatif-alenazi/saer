"use client";

import { useMemo, useState } from "react";
import { GripVertical, Plus, RotateCcw, Trash2, X } from "lucide-react";
import type { PlannedActivity, WorkoutExercise } from "./local-store";
import { calisthenicsCatalog } from "./workout-data";
import WorkoutProgression from "./WorkoutProgression";

type Tab = "program" | "schedule" | "session" | "settings";
const days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const stations = ["الفجر", "الظهر", "العصر", "المغرب", "الليل"];
const colors = [{ value: "#77b9d0", label: "أزرق" }, { value: "#82b99a", label: "أخضر" }, { value: "#d5ae6d", label: "ذهبي" }, { value: "#aa93c8", label: "بنفسجي" }];
const EMPTY_EXERCISES: WorkoutExercise[] = [];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export default function WorkoutSettings({ activity, onClose, onSave, onDelete, records = [], onSaveProgression }: {
  activity: PlannedActivity;
  onClose: () => void;
  onSave: (activity: PlannedActivity) => void;
  onDelete: () => void;
  records?: import("./local-store").ExecutionRecord[];
  onSaveProgression?: (activity: PlannedActivity, message?: string) => void;
}) {
  const [draft, setDraft] = useState(() => clone(activity));
  const [tab, setTab] = useState<Tab>("program");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeleteActivity, setConfirmDeleteActivity] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newMeasurement, setNewMeasurement] = useState<"repetitions" | "duration">("repetitions");
  const [progressionOpen,setProgressionOpen]=useState(false);
  const exercises = draft.exercises ?? EMPTY_EXERCISES;
  const schedule = draft.workoutSchedule ?? { days: draft.schedule.days ?? [], timeMode: draft.startTime ? "time" as const : "station" as const, time: draft.startTime, station: draft.period === "الصباح" ? "الفجر" : draft.period };
  const session = draft.workoutSessionSettings ?? { startMode: draft.workoutStartMode ?? "manual", preparationSeconds: 5, sound: false, vibration: false, motion: "normal" as const };
  const estimate = useMemo(() => {
    const seconds = exercises.reduce((sum, item, index) => sum + (Number.isFinite(item.expectedDurationSeconds) && (item.expectedDurationSeconds ?? 0) > 0
      ? Math.floor(item.expectedDurationSeconds!)
      : item.measurement === "duration"
        ? Array.from({ length: Math.max(0, item.sets) }, (_, round) => item.durationTargets?.[round] ?? item.durationSeconds ?? 0).reduce((a, b) => a + b, 0)
        : Math.max(0, item.sets) * 30) + Math.max(0, item.sets - 1) * item.restSeconds + (index < exercises.length - 1 ? item.restAfterSeconds ?? 0 : 0), 0);
    return Math.ceil(seconds / 60);
  }, [exercises]);
  const updateDraft = (patch: Partial<PlannedActivity>) => setDraft(value => ({ ...value, ...patch }));
  const updateExercise = (id: string, patch: Partial<WorkoutExercise>) => updateDraft({ exercises: exercises.map(item => item.id === id ? { ...item, ...patch } : item) });
  const resizeTargets = (item: WorkoutExercise, count: number) => {
    const sets = Math.max(1, Math.min(20, Math.floor(count) || 1));
    return { ...item, sets, repetitionTargets: item.measurement === "repetitions" ? Array.from({ length: sets }, (_, i) => item.repetitionTargets?.[i] ?? item.reps ?? 0) : item.repetitionTargets, durationTargets: item.measurement === "duration" ? Array.from({ length: sets }, (_, i) => item.durationTargets?.[i] ?? item.durationSeconds ?? 0) : item.durationTargets };
  };
  const moveExercise = (from: number, to: number) => {
    if (from === to || to < 0 || to >= exercises.length) return;
    const next = [...exercises], [item] = next.splice(from, 1); next.splice(to, 0, item); updateDraft({ exercises: next });
  };
  const addExercise = (template?: WorkoutExercise) => {
    const name = template?.name ?? newExerciseName.trim();
    if (!name) return;
    const source = template ?? { id: `exercise-${crypto.randomUUID?.() ?? Date.now()}`, name, category: "جذع" as const, measurement: newMeasurement, sets: 3, reps: 10, durationSeconds: 30, restSeconds: 60 };
    const item = resizeTargets({ ...source, id: `exercise-${crypto.randomUUID?.() ?? Date.now()}` }, source.sets || 3);
    updateDraft({ exercises: [...exercises, item] }); setEditingId(item.id); setNewExerciseName("");
  };
  const setSchedule = (patch: Partial<typeof schedule>) => updateDraft({ workoutSchedule: { ...schedule, ...patch } });
  const setSession = (patch: Partial<typeof session>) => updateDraft({ workoutSessionSettings: { ...session, ...patch }, workoutStartMode: patch.startMode ?? session.startMode });
  const persist = () => {
    const station = schedule.station === "الفجر" ? "الصباح" : schedule.station ?? draft.period;
    onSave({ ...draft, exercises, expectedMinutes: estimate || draft.expectedMinutes,
      schedule: { ...draft.schedule, mode: schedule.days.length === 7 ? "daily" : "fixed", value: schedule.days.join("، ") || "غير مجدول", days: schedule.days },
      period: schedule.timeMode === "station" ? station : draft.period,
      startTime: schedule.timeMode === "time" ? schedule.time : undefined,
      workoutSchedule: schedule,
    });
  };

  return <div className="workout-settings-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="workout-settings-panel" role="dialog" aria-modal="true" aria-labelledby="workout-settings-title">
      <header className="workout-settings-heading"><div><small>إدارة البرنامج الرياضي</small><h2 id="workout-settings-title">إعدادات الكاليسثنكس</h2></div><button type="button" aria-label="إغلاق الإعدادات" onClick={onClose}><X size={20}/></button></header>
      <nav className="workout-settings-tabs" aria-label="أقسام الإعدادات">{([["program", "البرنامج"], ["schedule", "الجدول"], ["session", "الجلسة"], ["settings", "الإعدادات"]] as [Tab, string][]).map(([id, label]) => <button key={id} type="button" className={tab === id ? "active" : ""} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <div className="workout-settings-content">
        {tab === "program" && <div className="workout-settings-program">
          <div className="workout-settings-subhead"><b>تمارين البرنامج</b><span>{exercises.length ? `${exercises.length} تمارين` : "أضف تمارين لبرنامجك"}</span></div>
          <button type="button" className="workout-progression-entry" onClick={()=>setProgressionOpen(true)}><span><b>خطة التقدم</b><small>{draft.progressionPlan?`${draft.progressionPlan.paths.length} مسارات تمرين`:"أنشئ مسارات لمتابعة تطور أدائك"}</small></span><span aria-hidden="true">›</span></button>
          {exercises.map((item, index) => <article className={`workout-plan-item ${editingId === item.id ? "editing" : ""}`} key={item.id} draggable onDragStart={event => event.dataTransfer.setData("text/plain", String(index))} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); moveExercise(Number(event.dataTransfer.getData("text/plain")), index); }}>
            <header><button type="button" className="workout-drag-handle" aria-label="اسحب لإعادة الترتيب"><GripVertical size={17}/></button><button type="button" className="workout-plan-title" onClick={() => setEditingId(editingId === item.id ? null : item.id)}><b>{item.name}</b><small>{item.sets} جولات · {item.measurement === "duration" ? `${item.durationSeconds ?? 0} ث` : `${item.reps ?? 0} عدة`} · راحة {item.restSeconds} ث</small></button><button type="button" aria-label={`حذف ${item.name}`} className="workout-delete-icon" onClick={() => setDeleteId(item.id)}><Trash2 size={16}/></button></header>
            {editingId === item.id && <div className="workout-exercise-editor">
              <label>اسم التمرين<input value={item.name} onChange={event => updateExercise(item.id, { name: event.target.value })}/></label>
              <div className="workout-settings-grid"><label>نوع القياس<select value={item.measurement} onChange={event => updateExercise(item.id, { measurement: event.target.value as WorkoutExercise["measurement"] })}><option value="repetitions">تكرارات</option><option value="duration">مدة زمنية</option></select></label><label>عدد الجولات<input type="number" min="1" max="20" value={item.sets} onChange={event => updateExercise(item.id, resizeTargets(item, Number(event.target.value)))}/></label></div>
              <label className="workout-apply-target">مستهدف موحد لكل الجولات<input type="number" min="1" value={item.measurement === "duration" ? item.durationSeconds ?? 0 : item.reps ?? 0} onChange={event => { const target = Math.max(0, Number(event.target.value)); updateExercise(item.id, item.measurement === "duration" ? { durationSeconds: target, durationTargets: Array.from({ length: item.sets }, () => target) } : { reps: target, repetitionTargets: Array.from({ length: item.sets }, () => target) }); }}/></label>
              <div className="workout-round-targets">{Array.from({ length: Math.max(1, item.sets) }, (_, round) => <label key={round}>الجولة {round + 1}<input type="number" min="0" value={item.measurement === "duration" ? item.durationTargets?.[round] ?? item.durationSeconds ?? 0 : item.repetitionTargets?.[round] ?? item.reps ?? 0} onChange={event => { const values = Array.from({ length: item.sets }, (_, i) => item.measurement === "duration" ? item.durationTargets?.[i] ?? item.durationSeconds ?? 0 : item.repetitionTargets?.[i] ?? item.reps ?? 0); values[round] = Math.max(0, Number(event.target.value)); updateExercise(item.id, item.measurement === "duration" ? { durationTargets: values } : { repetitionTargets: values }); }}/></label>)}</div>
              <label>الوقت المتوقع للأداء (ثانية)<input type="number" min="0" step="5" value={item.expectedDurationSeconds ?? ""} placeholder="تقدير تلقائي" onChange={event => updateExercise(item.id, { expectedDurationSeconds: event.target.value === "" ? undefined : Math.max(0, Number(event.target.value)) })}/><small>وقت الأداء فقط؛ تُضاف راحة الجولات تلقائيًا.</small></label>
              <div className="workout-settings-grid"><label>الراحة بين الجولات (ث)<input type="number" min="0" step="15" value={item.restSeconds} onChange={event => updateExercise(item.id, { restSeconds: Math.max(0, Number(event.target.value)) })}/></label><label>الراحة بعد التمرين (ث)<input type="number" min="0" step="15" value={item.restAfterSeconds ?? 0} onChange={event => updateExercise(item.id, { restAfterSeconds: Math.max(0, Number(event.target.value)) })}/></label></div>
            </div>}
          </article>)}
          <div className="workout-add-exercise"><div className="workout-settings-grid"><label>تمرين من القائمة<select defaultValue="" onChange={event => { const found = calisthenicsCatalog.find(item => item.id === event.target.value); if (found) addExercise(found); event.target.value = ""; }}><option value="">اختر تمرينًا</option>{calisthenicsCatalog.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>أو أضف اسمًا<input value={newExerciseName} onChange={event => setNewExerciseName(event.target.value)} placeholder="اسم التمرين"/></label></div><div className="workout-settings-grid"><label>نوع القياس<select value={newMeasurement} onChange={event => setNewMeasurement(event.target.value as typeof newMeasurement)}><option value="repetitions">تكرارات</option><option value="duration">مدة زمنية</option></select></label><button type="button" className="workout-add-button" onClick={() => addExercise()}><Plus size={16}/> إضافة تمرين</button></div></div>
          <div className="workout-plan-estimate">المدة التقديرية الأولية: <b>{estimate ? `${estimate} دقيقة تقريبًا` : "أضف أهدافًا للتمارين"}</b><small>تتحسن التقديرات مع تسجيل مدد الجولات الفعلية.</small></div>
          <button type="button" className="workout-settings-reset" onClick={() => setConfirmReset(true)}><RotateCcw size={15}/> إعادة ضبط البرنامج</button>
        </div>}
        {tab === "schedule" && <div className="workout-settings-section"><h3>أيام التمرين</h3><div className="workout-day-choices">{days.map(day => <button key={day} type="button" className={schedule.days.includes(day) ? "selected" : ""} aria-pressed={schedule.days.includes(day)} onClick={() => setSchedule({ days: schedule.days.includes(day) ? schedule.days.filter(item => item !== day) : [...schedule.days, day] })}>{day}</button>)}</div><h3>وقت التمرين</h3><div className="workout-choice-switch"><button type="button" className={schedule.timeMode === "station" ? "selected" : ""} onClick={() => setSchedule({ timeMode: "station" })}>محطة من محطات سائر</button><button type="button" className={schedule.timeMode === "time" ? "selected" : ""} onClick={() => setSchedule({ timeMode: "time" })}>وقت محدد</button></div>{schedule.timeMode === "station" ? <label>المحطة<select value={schedule.station ?? "العصر"} onChange={event => setSchedule({ station: event.target.value })}>{stations.map(station => <option key={station}>{station}</option>)}</select></label> : <label>الوقت<input type="time" value={schedule.time ?? "17:00"} onChange={event => setSchedule({ time: event.target.value })}/></label>}<div className="workout-next-session">موعد الحصة القادمة <b>{schedule.days.length ? `${schedule.days[0]} · ${schedule.timeMode === "station" ? schedule.station : schedule.time}` : "لم تحدد أيامًا"}</b></div><p className="workout-plan-estimate">المدة المتوقعة للحصة: <b>{estimate ? `${estimate} دقيقة تقريبًا` : "تتحسن بعد تسجيل جلسات"}</b></p></div>}
        {tab === "session" && <div className="workout-settings-section"><h3>طريقة بدء الجولات</h3><div className="workout-choice-switch"><button type="button" className={session.startMode === "manual" ? "selected" : ""} onClick={() => setSession({ startMode: "manual" })}>يدوي</button><button type="button" className={session.startMode === "automatic" ? "selected" : ""} onClick={() => setSession({ startMode: "automatic" })}>تلقائي</button></div><p className="workout-settings-note">الجولة الأولى تبدأ يدويًا دائمًا. في الوضع اليدوي تبدأ كل جولة بعد موافقتك.</p><label>العد التحضيري (ثوانٍ)<input type="number" min="0" max="15" value={session.preparationSeconds} onChange={event => setSession({ preparationSeconds: Math.max(0, Math.min(15, Number(event.target.value))) })}/></label>{([["sound", "التنبيهات الصوتية"], ["vibration", "الاهتزاز"]] as const).map(([key, label]) => <label className="workout-settings-toggle" key={key}>{label}<input type="checkbox" checked={session[key]} onChange={event => setSession({ [key]: event.target.checked })}/></label>)}<label>المؤثرات الحركية<select value={session.motion} onChange={event => setSession({ motion: event.target.value as typeof session.motion })}><option value="normal">عادية</option><option value="reduced">مخففة</option></select></label></div>}
        {tab === "settings" && <div className="workout-settings-section"><h3>النشاط</h3><label>اسم النشاط<input value={draft.name} onChange={event => updateDraft({ name: event.target.value })}/></label><label>الأيقونة<select value={draft.workoutIcon ?? "🏋️"} onChange={event => updateDraft({ workoutIcon: event.target.value })}>{["🏋️", "💪", "🤸", "⚡"].map(icon => <option key={icon}>{icon}</option>)}</select></label><div className="workout-color-picker"><b>لون النشاط</b>{colors.map(color => <button key={color.value} type="button" title={color.label} aria-label={color.label} aria-pressed={(draft.workoutColor ?? colors[0].value) === color.value} style={{ background: color.value }} onClick={() => updateDraft({ workoutColor: color.value })}/>)}</div><label className="workout-settings-toggle">تفعيل النشاط<input type="checkbox" checked={draft.workoutEnabled !== false} onChange={event => updateDraft({ workoutEnabled: event.target.checked })}/></label><button type="button" className="workout-delete-activity" onClick={() => setConfirmDeleteActivity(true)}><Trash2 size={16}/> حذف النشاط</button><p className="workout-settings-note">حذف النشاط لا يحذف سجلات الإنجاز السابقة.</p></div>}
      </div>
      <footer className="workout-settings-footer"><button type="button" className="workout-settings-cancel" onClick={onClose}>إلغاء</button><button type="button" className="workout-settings-save" onClick={persist}>حفظ الإعدادات</button></footer>
      {(deleteId || confirmReset || confirmDeleteActivity) && <div className="workout-confirm-backdrop"><section role="alertdialog" aria-modal="true"><h3>{confirmDeleteActivity ? "حذف النشاط؟" : confirmReset ? "إعادة ضبط البرنامج؟" : "حذف التمرين؟"}</h3><p>{confirmDeleteActivity ? "سيُزال النشاط من القائمة، وستبقى سجلات الإنجاز التاريخية محفوظة." : confirmReset ? "سيُمسح ترتيب وتمارين البرنامج الحالية فقط، مع بقاء كل نتائج الجولات السابقة." : "سيُحذف التمرين من البرنامج، وستبقى نتائجه السابقة محفوظة."}</p><div><button type="button" onClick={() => { setDeleteId(null); setConfirmReset(false); setConfirmDeleteActivity(false); }}>تراجع</button><button type="button" className="danger" onClick={() => { if (confirmDeleteActivity) onDelete(); else if (confirmReset) { updateDraft({ exercises: [] }); setEditingId(null); } else if (deleteId) { updateDraft({ exercises: exercises.filter(item => item.id !== deleteId) }); setDeleteId(null); } setConfirmReset(false); setConfirmDeleteActivity(false); }}>تأكيد</button></div></section></div>}
    </section>
    {progressionOpen&&<WorkoutProgression activity={draft} records={records} onClose={()=>setProgressionOpen(false)} onSave={(updated,message)=>{setDraft(updated);onSaveProgression?.(updated,message)}}/>}
  </div>;
}
