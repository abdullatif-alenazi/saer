"use client";

import { useState } from "react";
import { BookOpen, BookText, Brain, Dumbbell, HeartPulse, Moon, Repeat, Sparkles, Timer } from "lucide-react";
import { counterValue, type ExecutionRecord, type PlannedActivity, type UnitProgress, type WeekStartsOn } from "./local-store";
import { durationLabel } from "./time-engine";

type Range = "week" | "month" | "year";
const arabic = (value: number) => Math.round(value).toLocaleString("ar-SA", { useGrouping: false });
const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const recordKey = (record: ExecutionRecord) => record.dueKey || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(record.completedAt));
const weekday = (date: Date) => new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", weekday: "long" }).format(date);
const isScheduled = (activity: PlannedActivity, date: Date) => activity.schedule.mode === "daily" || Boolean(activity.schedule.days?.includes(weekday(date)) || activity.schedule.value.includes(weekday(date)));
const activityIcon = (activity: PlannedActivity) => {
  const template = `${activity.template} ${activity.name}`;
  if (/رياض|تمرين|رياضة/.test(template)) return Dumbbell;
  if (/قرآن|قراءة|كتاب/.test(template)) return BookOpen;
  if (/ذكر|استغفار|تسبيح/.test(template)) return Repeat;
  if (/صلاة/.test(template)) return Sparkles;
  if (/نوم/.test(template)) return Moon;
  if (/صيام/.test(template)) return Timer;
  if (/مهارة|تعلم/.test(template)) return Brain;
  if (/صحة/.test(template)) return HeartPulse;
  return BookText;
};

export default function AchievementOverview({ plan, records, unitProgress, weekStartsOn, onManage }: {
  plan: PlannedActivity[];
  records: ExecutionRecord[];
  unitProgress: UnitProgress[];
  weekStartsOn: WeekStartsOn;
  onManage: () => void;
}) {
  const [range, setRange] = useState<Range>("week");
  const [offset, setOffset] = useState(0);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const start = new Date(now);
  if (range === "week") {
    const firstDay = weekStartsOn === "saturday" ? 6 : 0;
    start.setDate(start.getDate() - ((start.getDay() - firstDay + 7) % 7) + offset * 7);
  } else if (range === "month") {
    start.setDate(1);
    start.setMonth(start.getMonth() + offset);
  } else start.setFullYear(start.getFullYear() + offset, 0, 1);
  const end = new Date(start);
  if (range === "week") end.setDate(end.getDate() + 7);
  else if (range === "month") end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  const dateKeys: string[] = [];
  for (const date = new Date(start); date < end; date.setDate(date.getDate() + 1)) dateKeys.push(keyOf(date));
  const dates = dateKeys.map(key => new Date(`${key}T12:00:00`));
  const items = plan;

  const metrics = items.map(activity => {
    const activityRecords = records.filter(record => (record.activityId === activity.id || (!record.activityId && record.activity === activity.name)) && record.status !== "missed");
    const inRange = activityRecords.filter(record => dateKeys.includes(recordKey(record)));
    const progressByDate = new Map(unitProgress.filter(progress => progress.activityId === activity.id && dateKeys.includes(progress.date)).map(progress => [progress.date, progress]));
    const daysScheduled = dates.filter(date => isScheduled(activity, date)).length;
    let target: number | null = null;
    let done = 0;
    let unit = "مرة";
    let kind: "quantity" | "time" | "sessions" = "sessions";
    const definition = activity.goalDefinition;
    if (definition && definition.kind !== "level" && (definition.targetValue ?? definition.targetMilestone) != null) {
      target = definition.targetValue ?? definition.targetMilestone ?? null;
      done = inRange.reduce((sum, record) => sum + (record.goalProgressValue ?? record.quantity ?? 0), 0);
      unit = definition.unit ?? "تقدم";
      kind = "quantity";
    } else if (activity.unitTracking) {
      const perDay = activity.unitTracking.periods.reduce((sum, period) => sum + period.target, 0);
      target = perDay * daysScheduled;
      unit = activity.unit ?? "ذكر";
      kind = "quantity";
      done = dateKeys.reduce((sum, key) => {
        const progress = progressByDate.get(key);
        if (!progress) return sum;
        return sum + activity.unitTracking!.periods.reduce((daySum, period) => daySum + Math.max(counterValue(progress, period.id), (progress.completedUnitsByPeriod[period.id]?.length ?? 0) * period.unitValue), 0);
      }, 0);
      if (!done) done = inRange.reduce((sum, record) => sum + (record.quantity ?? 0), 0);
    } else if (activity.quantity != null && activity.quantity > 0) {
      target = activity.quantity * daysScheduled;
      done = inRange.reduce((sum, record) => sum + (record.quantity ?? 0), 0);
      unit = activity.unit ?? "وحدة";
      kind = "quantity";
    } else if (activity.trackingMode === "time" || activity.expectedMinutes > 0) {
      target = activity.expectedMinutes * daysScheduled;
      done = inRange.reduce((sum, record) => sum + (record.durationSeconds ?? record.minutes * 60), 0) / 60;
      unit = "دقيقة";
      kind = "time";
    } else {
      target = daysScheduled;
      done = inRange.length;
    }
    const percent = target && target > 0 ? Math.min(100, Math.round(done / target * 100)) : null;
    const values = new Map<string, number>();
    dateKeys.forEach(key => {
      const dayRecords = activityRecords.filter(record => recordKey(record) === key);
      const progress = progressByDate.get(key);
      let value = 0;
      if (activity.unitTracking && progress) value = activity.unitTracking.periods.reduce((sum, period) => sum + Math.max(counterValue(progress, period.id), (progress.completedUnitsByPeriod[period.id]?.length ?? 0) * period.unitValue), 0);
      else if (kind === "quantity") value = dayRecords.reduce((sum, record) => sum + (record.goalProgressValue ?? record.quantity ?? 0), 0);
      else if (kind === "time") value = dayRecords.reduce((sum, record) => sum + (record.durationSeconds ?? record.minutes * 60), 0) / 60;
      else value = dayRecords.length;
      values.set(key, value);
    });
    const minutes = inRange.reduce((sum, record) => sum + (record.durationSeconds ?? record.minutes * 60), 0) / 60;
    return { activity, target, done, unit, kind, percent, values, inRange, minutes, daysScheduled };
  });

  const selected = metrics.find(item => item.activity.id === selectedActivityId) ?? null;
  const totalMinutes = metrics.reduce((sum, item) => sum + item.minutes, 0) + unitProgress.filter(progress => dateKeys.includes(progress.date) && progress.timedSessions?.some(session => session.status === "finished" && !records.some(record => record.sessionId === session.id))).reduce((sum, progress) => sum + (progress.timedSessions ?? []).filter(session => session.status === "finished" && !records.some(record => record.sessionId === session.id)).reduce((sessionSum, session) => sessionSum + session.elapsedMs / 60000, 0), 0);
  const measurable = metrics.filter(item => item.percent != null);
  const averageProgress = measurable.length ? Math.round(measurable.reduce((sum, item) => sum + item.percent!, 0) / measurable.length) : null;
  const activitiesDone = metrics.filter(item => item.done > 0 || item.inRange.length > 0).length;
  const periodLabel = range === "week"
    ? `${new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short" }).format(start)} – ${new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(end.getTime() - 86400000))}`
    : range === "month" ? new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { month: "long", year: "numeric" }).format(start)
      : new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { year: "numeric" }).format(start);
  const monthLabel = (date: Date) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { month: "long" }).format(date);
  const startWeekday = range === "month" ? (start.getDay() - (weekStartsOn === "saturday" ? 6 : 0) + 7) % 7 : 0;
  const months = Array.from({ length: 12 }, (_, index) => {
    const monthStart = new Date(start.getFullYear(), index, 1, 12);
    const monthEnd = new Date(start.getFullYear(), index + 1, 1, 12);
    const keys: string[] = [];
    for (const date = new Date(monthStart); date < monthEnd; date.setDate(date.getDate() + 1)) keys.push(keyOf(date));
    return { label: monthLabel(monthStart), keys };
  });

  return <section className="screen achievement-overview" dir="rtl">
    <header className="achievement-overview-head"><div><small>نتائجك من السجلات المحفوظة</small><h1>الإنجازات</h1></div><button type="button" onClick={onManage}>إدارة الأنشطة</button></header>
    <section className="achievement-summary-card" aria-label="ملخص الإنجاز"><div><small>متوسط الإنجاز</small><b>{averageProgress == null ? "—" : `${arabic(averageProgress)}٪`}</b></div><div><small>أنشطة لها إنجاز</small><b>{arabic(activitiesDone)} <i>من {arabic(items.length)}</i></b></div><div><small>الوقت المسجل</small><b>{totalMinutes > 0 ? durationLabel(totalMinutes) : "—"}</b></div></section>
    <nav className="achievement-period-nav" aria-label="التنقل بين فترات الإنجاز"><div className="achievement-range" role="tablist">{([ ["week", "أسبوعي"], ["month", "شهري"], ["year", "سنوي"] ] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={range === id} className={range === id ? "selected" : ""} onClick={() => { setRange(id); setOffset(0); }}>{label}</button>)}</div><div className="achievement-period-arrows"><button type="button" aria-label="الفترة السابقة" onClick={() => setOffset(value => value - 1)}>‹</button><strong>{periodLabel}</strong><button type="button" aria-label="الفترة التالية" onClick={() => setOffset(value => value + 1)}>›</button></div></nav>
    {metrics.length ? <div className="achievement-cards">{metrics.map((item, index) => { const Icon = activityIcon(item.activity); return <button type="button" key={item.activity.id} aria-pressed={selectedActivityId === item.activity.id} className={`achievement-card pastel-${index % 6} ${selectedActivityId === item.activity.id ? "selected" : ""}`} onClick={() => setSelectedActivityId(value => value === item.activity.id ? null : item.activity.id)}><span className="achievement-card-icon"><Icon aria-hidden="true"/></span><span className="achievement-card-copy"><b>{item.activity.name}</b><small>{item.target == null ? "لا يوجد مستهدف رقمي" : `المستهدف ${arabic(item.target)} ${item.unit}`}</small><span className="achievement-progress-track"><i style={{ width: `${item.percent ?? 0}%` }}/></span><small>{item.done > 0 ? `المنجز ${arabic(item.done)} ${item.unit}` : "لا يوجد إنجاز مسجل في هذه الفترة"}</small></span><strong className="achievement-card-percent">{item.percent == null ? "—" : `${arabic(item.percent)}٪`}</strong></button>; })}</div> : <div className="achievement-empty"><p>لا توجد أنشطة محفوظة لعرض إنجازاتها بعد.</p><button type="button" onClick={onManage}>إدارة الأنشطة</button></div>}
    {selected && <section className="achievement-detail-panel"><header><div><small>تفاصيل الفترة · {periodLabel}</small><h2>{selected.activity.name}</h2></div><button type="button" aria-label="إغلاق التفاصيل" onClick={() => setSelectedActivityId(null)}>×</button></header>
      {range === "week" && <div className="achievement-week-table-scroll"><table className="achievement-week-table"><thead><tr><th scope="col">النشاط</th>{dates.map(date => <th key={keyOf(date)} scope="col"><span>{new Intl.DateTimeFormat("ar-SA", { weekday: "short" }).format(date)}</span><small>{new Intl.DateTimeFormat("ar-SA", { day: "numeric" }).format(date)}</small></th>)}</tr></thead><tbody>{metrics.map((item, index) => <tr key={item.activity.id} className={item.activity.id === selectedActivityId ? "current" : ""}><th scope="row"><span className={`activity-dot pastel-${index % 6}`}/><span>{item.activity.name}</span></th>{dates.map(date => { const value = item.values.get(keyOf(date)) ?? 0; return <td key={keyOf(date)} className={value > 0 ? "has-value" : ""}>{value > 0 ? arabic(value) : "—"}</td>; })}</tr>)}</tbody></table></div>}
      {range === "month" && <><label className="achievement-activity-select">النشاط<select value={selected.activity.id} onChange={event => setSelectedActivityId(event.target.value)}>{metrics.map(item => <option key={item.activity.id} value={item.activity.id}>{item.activity.name}</option>)}</select></label><div className="achievement-month-grid"><div className="achievement-month-weekdays">{(weekStartsOn === "saturday" ? ["س", "ح", "ن", "ث", "ر", "خ", "ج"] : ["ح", "ن", "ث", "ر", "خ", "ج", "س"]).map((day, index) => <b key={`${day}-${index}`}>{day}</b>)}</div><div className="achievement-month-days">{Array.from({ length: startWeekday }, (_, index) => <i key={`empty-${index}`}/>)}{dates.map(date => { const value = selected.values.get(keyOf(date)) ?? 0; return <div key={keyOf(date)} className={value > 0 ? "has-value" : ""}><b>{new Intl.DateTimeFormat("ar-SA", { day: "numeric" }).format(date)}</b>{value > 0 && <small>{arabic(value)}</small>}</div>; })}</div></div><footer className="achievement-detail-summary"><span>إجمالي المنجز</span><b>{arabic(selected.done)} {selected.unit}</b><span>الوقت المسجل</span><b>{selected.minutes > 0 ? durationLabel(selected.minutes) : "—"}</b><span>نسبة الإنجاز</span><b>{selected.percent == null ? "—" : `${arabic(selected.percent)}٪`}</b></footer></>}
      {range === "year" && <><label className="achievement-activity-select">النشاط<select value={selected.activity.id} onChange={event => setSelectedActivityId(event.target.value)}>{metrics.map(item => <option key={item.activity.id} value={item.activity.id}>{item.activity.name}</option>)}</select></label><div className="achievement-year-months">{months.map(month => { const actual = month.keys.reduce((sum, key) => sum + (selected.values.get(key) ?? 0), 0); const scheduled = dates.filter(date => month.keys.includes(keyOf(date)) && isScheduled(selected.activity, date)).length; const target = selected.kind === "time" ? scheduled * selected.activity.expectedMinutes : selected.activity.unitTracking ? scheduled * selected.activity.unitTracking.periods.reduce((sum, period) => sum + period.target, 0) : selected.activity.quantity ? scheduled * selected.activity.quantity : scheduled; const percent = target > 0 ? Math.min(100, actual / target * 100) : 0; return <div key={month.label}><b>{month.label}</b><span className="achievement-year-track"><i style={{ width: `${percent}%` }}/></span><small>{actual > 0 ? arabic(actual) : "—"} {actual > 0 ? selected.unit : ""}</small></div>; })}</div><footer className="achievement-detail-summary"><span>إجمالي السنة</span><b>{arabic(selected.done)} {selected.unit}</b><span>الوقت المسجل</span><b>{selected.minutes > 0 ? durationLabel(selected.minutes) : "—"}</b><span>نسبة الإنجاز</span><b>{selected.percent == null ? "—" : `${arabic(selected.percent)}٪`}</b></footer></>}
    </section>}
  </section>;
}
