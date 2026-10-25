"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, BookText, Brain, Dumbbell, HeartPulse, Moon, Sparkles, Timer } from "lucide-react";
import PrayerBeadsIcon from "./PrayerBeadsIcon";
import { counterValue, type ExecutionRecord, type PlannedActivity, type UnitProgress, type WeekStartsOn } from "./local-store";

type Range = "week" | "month" | "year";
type CalendarKind = "gregory" | "islamic";
type Status = "future" | "complete" | "partial" | "missed" | "unscheduled";
type Metric = { done: number; target: number; unit: string; percent: number | null; dueDays: number; achievedDays: number };
const weekdays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const ar = (value: number, maximumFractionDigits = 0) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits, useGrouping: false }).format(value);
const riyadhDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" });
const keyOf = (date: Date) => riyadhDate.format(date);
const dateFromKey = (key: string) => { const [year, month, day] = key.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day, 12)); };
const addDays = (date: Date, count: number) => new Date(date.getTime() + count * 86400000);
const calendarParts = (date: Date, kind: CalendarKind) => {
  const parts = new Intl.DateTimeFormat(kind === "islamic" ? "en-US-u-ca-islamic-umalqura" : "en-US-u-ca-gregory", { timeZone: "Asia/Riyadh", day: "numeric", month: "numeric", year: "numeric" }).formatToParts(date);
  const read = (part: string) => Number(parts.find(item => item.type === part)?.value ?? 0);
  return { day: read("day"), month: read("month"), year: read("year") };
};
const formatDate = (date: Date, kind: CalendarKind, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(kind === "islamic" ? "ar-SA-u-ca-islamic-umalqura" : "ar-SA-u-ca-gregory", { ...options, timeZone: "Asia/Riyadh" }).format(date);
const activityIcon = (activity: PlannedActivity) => {
  const text = `${activity.template} ${activity.name}`;
  if (/رياض|تمرين|كاليستنس/.test(text)) return Dumbbell;
  if (/قرآن|قراءة|كتاب/.test(text)) return BookOpen;
  if (/ذكر|استغفار|تسبيح|تهليل/.test(text)) return PrayerBeadsIcon;
  if (/صلاة/.test(text)) return Sparkles;
  if (/نوم/.test(text)) return Moon;
  if (/صيام/.test(text)) return Timer;
  if (/مهارة|تعلم/.test(text)) return Brain;
  if (/صحة/.test(text)) return HeartPulse;
  return BookText;
};
const scheduleOf = (activity: PlannedActivity) => activity.nature === "goal" && activity.supportingPlan?.enabled ? activity.supportingPlan.schedule : activity.schedule;
const scheduledWeekdays = (activity: PlannedActivity) => {
  const schedule = scheduleOf(activity);
  return schedule.days?.length ? schedule.days : weekdays.filter(day => schedule.value.includes(day));
};
const sessionsPerWeek = (activity: PlannedActivity) => {
  const schedule = scheduleOf(activity), match = schedule.value.match(/[0-9٠-٩]+/)?.[0];
  const parsed = match ? Number(match.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))) : 1;
  return Math.min(7, Math.max(0, schedule.sessionsPerWeek ?? parsed));
};
const progressFor = (activity: PlannedActivity, progress?: UnitProgress) => activity.unitTracking
  ? activity.unitTracking.periods.reduce((sum, period) => sum + Math.max(progress?.targetByPeriod?.[period.id] ?? period.target, 0), 0)
  : activity.quantity && activity.quantity > 0 ? activity.quantity
    : activity.expectedMinutes > 0 ? activity.expectedMinutes : 1;
const unitFor = (activity: PlannedActivity) => activity.unitTracking ? activity.unit ?? "ذكر"
  : activity.quantity && activity.quantity > 0 ? activity.unit ?? "وحدة"
    : activity.expectedMinutes > 0 ? "دقيقة" : activity.goalDefinition?.unit ?? "مرة";
const validActivityRecords = (activity: PlannedActivity, records: ExecutionRecord[]) => records.filter(record => (record.activityId === activity.id || (!record.activityId && record.activity === activity.name)) && record.status !== "missed");
const recordDate = (record: ExecutionRecord) => record.dueKey || keyOf(new Date(record.completedAt));
const hasProgress = (activity: PlannedActivity, date: string, records: ExecutionRecord[], unitProgress: UnitProgress[]) => {
  if (records.some(record => recordDate(record) === date)) return true;
  return unitProgress.some(item => item.activityId === activity.id && item.date === date && (
    Object.values(item.counterByPeriod).some(value => value > 0) ||
    Object.values(item.completedUnitsByPeriod).some(values => values.length > 0) ||
    Boolean(item.timedSessions?.some(session => session.rounds.some(round => round.status === "completed")))
  ));
};

export default function AchievementOverview({ plan, records, unitProgress, calendarMode, transitioningOut = false, transitioningIn = false }: {
  plan: PlannedActivity[];
  records: ExecutionRecord[];
  unitProgress: UnitProgress[];
  weekStartsOn: WeekStartsOn;
  calendarMode: "islamic" | "gregory" | "mixed";
  transitioningOut?: boolean;
  transitioningIn?: boolean;
}) {
  const [range, setRange] = useState<Range>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [activityId, setActivityId] = useState(plan[0]?.id ?? "");
  const [calendar, setCalendar] = useState<CalendarKind>(calendarMode === "gregory" ? "gregory" : "islamic");
  const [dayDetail, setDayDetail] = useState<{ activity: PlannedActivity; date: Date } | null>(null);
  const todayKey = keyOf(new Date()), today = dateFromKey(todayKey);
  const firstDay = 6;
  const selectedActivity = plan.find(activity => activity.id === activityId) ?? plan[0];

  useEffect(() => {
    if (!plan.some(activity => activity.id === activityId)) setActivityId(plan[0]?.id ?? "");
  }, [plan, activityId]);
  useEffect(() => {
    setCalendar(calendarMode === "gregory" ? "gregory" : "islamic");
  }, [calendarMode]);

  const weekStart = useMemo(() => {
    const todayDay = today.getUTCDay();
    return addDays(today, -((todayDay - firstDay + 7) % 7) + weekOffset * 7);
  }, [todayKey, firstDay, weekOffset]);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekCaption = `${formatDate(weekDates[0], calendar, { day: "numeric", month: "long" })} – ${formatDate(weekDates[6], calendar, { day: "numeric", month: "long", year: "numeric" })}`;
  const monthDates = useMemo(() => {
    const focus = calendarParts(viewDate, calendar), dates: Date[] = [];
    for (let offset = -40; offset <= 40; offset++) {
      const date = addDays(viewDate, offset), parts = calendarParts(date, calendar);
      if (parts.year === focus.year && parts.month === focus.month) dates.push(date);
    }
    return dates;
  }, [viewDate, calendar]);
  const monthTitle = formatDate(monthDates[0] ?? viewDate, calendar, { month: "long", year: "numeric" });
  const yearDates = useMemo(() => {
    const year = calendarParts(viewDate, calendar).year;
    if (calendar === "gregory") {
      const first = new Date(Date.UTC(year, 0, 1, 12)), length = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
      return Array.from({ length }, (_, index) => addDays(first, index));
    }
    const dates: Date[] = [];
    for (let offset = -190; offset <= 190; offset++) { const date = addDays(viewDate, offset); if (calendarParts(date, calendar).year === year) dates.push(date); }
    return dates;
  }, [viewDate, calendar]);
  const yearTitle = formatDate(viewDate, calendar, { year: "numeric" });
  const monthGroups = Array.from({ length: 12 }, (_, index) => {
    const dates = yearDates.filter(date => calendarParts(date, calendar).month === index + 1);
    return dates.length ? { month: index + 1, dates, label: formatDate(dates[0], calendar, { month: "long" }) } : null;
  }).filter((item): item is { month: number; dates: Date[]; label: string } => Boolean(item));

  const activityProgress = (activity: PlannedActivity) => unitProgress.filter(item => item.activityId === activity.id);
  const activityRecords = (activity: PlannedActivity) => validActivityRecords(activity, records);
  const dayDone = (activity: PlannedActivity, date: Date) => {
    const key = keyOf(date), relevant = activityRecords(activity).filter(record => recordDate(record) === key);
    if (activity.unitTracking) {
      const progress = activityProgress(activity).find(item => item.date === key);
      const tracked = progress ? activity.unitTracking.periods.reduce((sum, period) => sum + Math.max(counterValue(progress, period.id), (progress.completedUnitsByPeriod[period.id]?.length ?? 0) * period.unitValue), 0) : 0;
      return Math.max(tracked, relevant.reduce((sum, record) => sum + (record.quantity ?? 0), 0));
    }
    if (activity.quantity && activity.quantity > 0) return relevant.reduce((sum, record) => sum + (record.goalProgressValue ?? record.quantity ?? 0), 0);
    if (activity.expectedMinutes > 0) return relevant.reduce((sum, record) => sum + (record.durationSeconds ?? record.minutes * 60) / 60, 0);
    return relevant.reduce((sum, record) => sum + ((record.quantity ?? record.goalProgressValue) || 1), 0);
  };
  const startKey = (activity: PlannedActivity) => activity.createdAt ? keyOf(new Date(activity.createdAt)) : null;
  const targetForDay = (activity: PlannedActivity, date: Date) => {
    const key = keyOf(date), progress = activityProgress(activity).find(item => item.date === key);
    return progressFor(activity, progress);
  };
  const isPastOrToday = (date: Date) => keyOf(date) <= todayKey;
  const scheduledOn = (activity: PlannedActivity, date: Date) => {
    if (keyOf(date) < (startKey(activity) ?? "0000-00-00")) return false;
    const schedule = scheduleOf(activity), named = scheduledWeekdays(activity);
    if (schedule.mode === "daily") return true;
    if (named.length) return named.includes(weekdays[date.getUTCDay()]);
    if (schedule.mode === "flexible") return hasProgress(activity, keyOf(date), activityRecords(activity), activityProgress(activity));
    return false;
  };
  const metric = (activity: PlannedActivity, dates: Date[]): Metric => {
    const active = dates.filter(date => isPastOrToday(date) && keyOf(date) >= (startKey(activity) ?? "0000-00-00"));
    const schedule = scheduleOf(activity), named = scheduledWeekdays(activity), flexible = schedule.mode === "flexible" && named.length === 0;
    const due = active.filter(date => scheduledOn(activity, date));
    const done = active.reduce((sum, date) => sum + dayDone(activity, date), 0);
    let target = due.reduce((sum, date) => sum + targetForDay(activity, date), 0);
    if (flexible && active.length) target = progressFor(activity) * sessionsPerWeek(activity) * active.length / 7;
    const percent = target > 0 ? Math.min(100, Math.round(done / target * 100)) : null;
    const achievedDays = due.filter(date => dayDone(activity, date) >= targetForDay(activity, date)).length;
    return { done, target, unit: unitFor(activity), percent, dueDays: flexible ? (target > 0 ? Math.ceil(target / Math.max(progressFor(activity), 1)) : 0) : due.length, achievedDays };
  };
  const statusForDay = (activity: PlannedActivity, date: Date): Status => {
    if (keyOf(date) > todayKey) return "future";
    if (!scheduledOn(activity, date)) return "unscheduled";
    const done = dayDone(activity, date), target = targetForDay(activity, date);
    if (done <= 0) return "missed";
    return done >= target ? "complete" : "partial";
  };
  const metricFor = (activity: PlannedActivity, dates: Date[]) => metric(activity, dates);
  const weekMetrics = plan.map(activity => ({ activity, metric: metricFor(activity, weekDates) }));
  const weeklyDue = weekMetrics.filter(item => item.metric.target > 0);
  const weeklyAchieved = weeklyDue.filter(item => item.metric.done >= item.metric.target).length;
  const weeklyAverage = weeklyDue.length ? Math.round(weeklyDue.reduce((sum, item) => sum + Math.min(100, item.metric.done / item.metric.target * 100), 0) / weeklyDue.length) : null;

  const moveCalendar = (amount: number, period: "month" | "year") => {
    const start = calendarParts(viewDate, calendar), direction = Math.sign(amount);
    let date = viewDate;
    for (let index = 0; index < 400; index++) {
      date = addDays(date, direction);
      const parts = calendarParts(date, calendar);
      if (period === "month" ? parts.year !== start.year || parts.month !== start.month : parts.year !== start.year) { setViewDate(date); return; }
    }
  };
  const goMonth = (dates: Date[]) => { if (!dates[0]) return; setViewDate(dates[0]); setRange("month"); };

  const monthlyMetric = selectedActivity ? metricFor(selectedActivity, monthDates) : null;
  const monthDaysDue = selectedActivity ? monthDates.filter(date => isPastOrToday(date) && scheduledOn(selectedActivity, date)) : [];
  const monthAchievedDays = selectedActivity ? monthDaysDue.filter(date => statusForDay(selectedActivity, date) === "complete").length : 0;
  const dailyAverages = selectedActivity ? monthDaysDue.map(date => {
    const target = targetForDay(selectedActivity, date);
    return target > 0 ? Math.min(100, dayDone(selectedActivity, date) / target * 100) : 0;
  }) : [];
  const bestDate = selectedActivity ? monthDaysDue.reduce<Date | null>((best, date) => !best || dayDone(selectedActivity, date) > dayDone(selectedActivity, best) ? date : best, null) : null;
  const streak = selectedActivity ? (() => {
    let current = 0, longest = 0;
    for (const date of monthDates) {
      if (keyOf(date) > todayKey) break;
      if (statusForDay(selectedActivity, date) === "complete") { current++; longest = Math.max(longest, current); }
      else current = 0;
    }
    return longest;
  })() : 0;
  const previousMonthDates = selectedActivity && monthDates.length ? (() => {
    const previous = addDays(monthDates[0], -1), parts = calendarParts(previous, calendar), dates: Date[] = [];
    for (let offset = -40; offset <= 40; offset++) { const date = addDays(previous, offset), item = calendarParts(date, calendar); if (item.year === parts.year && item.month === parts.month) dates.push(date); }
    return dates;
  })() : [];
  const previousMonthMetric = selectedActivity ? metricFor(selectedActivity, previousMonthDates) : null;
  const comparison = monthlyMetric?.percent != null && previousMonthMetric?.percent != null ? monthlyMetric.percent - previousMonthMetric.percent : null;

  const annualMetrics = selectedActivity ? monthGroups.map(group => ({ ...group, metric: metricFor(selectedActivity, group.dates) })) : [];
  const annualMetric = selectedActivity ? metricFor(selectedActivity, yearDates) : null;
  const averageMonthly = annualMetrics.filter(item => item.metric.target > 0);
  const bestMonth = averageMonthly.reduce<(typeof averageMonthly)[number] | null>((best, item) => !best || (item.metric.percent ?? 0) > (best.metric.percent ?? 0) ? item : best, null);
  const monthOffset = monthDates.length ? (monthDates[0].getUTCDay() - firstDay + 7) % 7 : 0;
  const weekDayLabels = Array.from({ length: 7 }, (_, index) => weekdays[(firstDay + index) % 7]);

  return <section className={`screen achievement-overview ${transitioningOut ? "is-transitioning-out" : ""} ${transitioningIn ? "is-transitioning-in" : ""}`} dir="rtl">
    <nav className="achievement-range" aria-label="فترة الإنجازات" role="tablist">
      {([["week", "أسبوعي"], ["month", "شهري"], ["year", "سنوي"]] as const).map(([id, label]) => <button type="button" role="tab" aria-selected={range === id} key={id} className={range === id ? "selected" : ""} onClick={() => setRange(id)}>{label}</button>)}
    </nav>

    {range === "week" && <>
      <div className="achievement-period-nav">
        <button type="button" aria-label="الأسبوع السابق" onClick={() => setWeekOffset(value => value - 1)}>→</button>
        <strong>{weekCaption}{calendarMode === "mixed" && <small>{new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", year: "numeric" }).format(weekDates[0])} – {new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", year: "numeric" }).format(weekDates[6])}</small>}</strong>
        {weekOffset !== 0 && <button className="achievement-current-period" type="button" aria-label="العودة للأسبوع الحالي" onClick={() => setWeekOffset(0)}><CurrentPeriodIcon/></button>}
        <button type="button" aria-label="الأسبوع التالي" onClick={() => setWeekOffset(value => value + 1)}>←</button>
      </div>
      <div className="achievement-table-clip" role="region" aria-label="جدول الإنجازات الأسبوعية" tabIndex={0}>
        <table className="achievement-table">
          <thead><tr><th className="activity-sticky">النشاط</th>{weekDayLabels.map((label, index) => { const date = weekDates.find(item => weekdays[item.getUTCDay()] === label)!; return <th key={label} className={keyOf(date) === todayKey ? "today" : ""}><span>{label}</span><small>{ar(calendarParts(date, calendar).day)}</small></th>; })}<th>المجموع</th><th>النسبة</th></tr></thead>
          <tbody>{plan.map((activity, activityIndex) => {
            const Icon = activityIcon(activity), summary = metricFor(activity, weekDates);
            return <tr key={activity.id} className={`achievement-row pastel-${activityIndex % 6}`}>
              <th scope="row" className="activity-sticky"><span className="achievement-card-icon"><Icon aria-hidden="true"/></span><b>{activity.name || "نشاط بلا اسم"}</b></th>
              {weekDates.map(date => {
                const status = statusForDay(activity, date), done = dayDone(activity, date), target = targetForDay(activity, date), percent = target ? Math.min(100, Math.round(done / target * 100)) : 0;
                return <td key={keyOf(date)} className={`achievement-day-cell ${status} ${keyOf(date) === todayKey ? "today" : ""}`}><button type="button" aria-label={`${activity.name}، ${formatDate(date, calendar, { weekday: "long", day: "numeric", month: "long" })}`} onClick={() => setDayDetail({ activity, date })} title={status === "unscheduled" ? "غير مجدول" : status === "future" ? "يوم مستقبلي" : `${ar(done, 1)} / ${ar(target, 1)} ${unitFor(activity)}`}>{status === "future" || status === "unscheduled" ? "—" : ar(done, 1)}{target > 0 && <i style={{ width: `${percent}%` }}/>}</button></td>;
              })}
              <td className="achievement-total-cell">{summary.target > 0 ? <><b>{ar(summary.done, 1)}</b><small> / {ar(summary.target, 1)} {summary.unit}</small></> : "—"}</td>
              <td className="achievement-percent-cell">{summary.percent == null ? "—" : `${ar(summary.percent)}٪`}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {plan.length === 0 ? <EmptyState/> : <section className="achievement-week-summary" aria-label="ملخص الأسبوع">
        <div><small>أنشطة مستحقة</small><b>{ar(weeklyDue.length)}</b></div>
        <div><small>حققت المستهدف</small><b>{ar(weeklyAchieved)}<span> / {ar(weeklyDue.length)}</span></b></div>
        <div><small>متوسط الإنجاز</small><b>{weeklyAverage == null ? "—" : `${ar(weeklyAverage)}٪`}</b></div>
      </section>}
    </>}

    {range === "month" && <>
      <div className="achievement-controls"><label htmlFor="achievement-month-activity">النشاط</label><select id="achievement-month-activity" value={selectedActivity?.id ?? ""} onChange={event => setActivityId(event.target.value)}>{plan.map(activity => <option key={activity.id} value={activity.id}>{activity.name || "نشاط بلا اسم"}</option>)}</select></div>
      <CalendarToolbar title={monthTitle} calendarMode={calendarMode} calendar={calendar} onCalendar={setCalendar} onPrevious={() => moveCalendar(-1, "month")} onNext={() => moveCalendar(1, "month")} />
      {!selectedActivity ? <EmptyState/> : <>
        <section className="achievement-month-card">
          <header><div><small>{selectedActivity.name}</small><h2>{monthTitle}</h2></div><div className="achievement-month-legend"><span className="complete">مكتمل</span><span className="partial">جزئي</span><span className="missed">دون إنجاز</span></div></header>
          <div className="achievement-calendar-grid" dir="rtl">
            {weekDayLabels.map(label => <b className="weekday-label" key={label}>{label}</b>)}
            {Array.from({ length: monthOffset }, (_, index) => <i className="calendar-blank" key={`blank-${index}`} aria-hidden="true"/>)}
            {monthDates.map(date => {
              const status = statusForDay(selectedActivity, date), done = dayDone(selectedActivity, date), target = targetForDay(selectedActivity, date);
              return <button type="button" key={keyOf(date)} className={`achievement-calendar-day ${status} ${keyOf(date) === todayKey ? "today" : ""}`} onClick={() => setDayDetail({ activity: selectedActivity, date })} aria-label={`${formatDate(date, calendar, { weekday: "long", day: "numeric", month: "long" })}: ${statusLabel(status)}`}><b>{ar(calendarParts(date, calendar).day)}</b>{done > 0 && <small>{ar(done, 1)}</small>}{target > 0 && <i style={{ width: `${Math.min(100, done / target * 100)}%` }}/>}</button>;
            })}
          </div>
        </section>
        <section className="achievement-analysis" aria-label="تحليل الشهر">
          <AnalysisCard title="الإنجاز الشهري" value={monthlyMetric?.target ? `${ar(monthlyMetric.done, 1)} / ${ar(monthlyMetric.target, 1)} ${monthlyMetric.unit}` : "لا يوجد مستهدف"} foot={monthlyMetric?.percent == null ? "—" : `${ar(monthlyMetric.percent)}٪`} tone="blue"/>
          <AnalysisCard title="أيام الالتزام" value={`${ar(monthAchievedDays)} / ${ar(monthDaysDue.length)} يوم`} foot="أيام مستحقة" tone="green"/>
          <AnalysisCard title="متوسط الإنجاز" value={dailyAverages.length ? `${ar(dailyAverages.reduce((sum, value) => sum + value, 0) / dailyAverages.length)}٪` : "—"} foot="لكل يوم مستحق" tone="purple"/>
          <AnalysisCard title="أفضل يوم" value={bestDate ? formatDate(bestDate, calendar, { weekday: "short", day: "numeric", month: "short" }) : "—"} foot={bestDate ? `${ar(dayDone(selectedActivity, bestDate), 1)} ${unitFor(selectedActivity)}` : "لا توجد إنجازات"} tone="orange"/>
          <AnalysisCard title="الاستمرارية" value={`${ar(streak)} يوم`} foot="أطول سلسلة مكتملة" tone="pink"/>
          <AnalysisCard title="مقارنة بالشهر السابق" value={comparison == null ? "—" : `${comparison > 0 ? "+" : ""}${ar(comparison)} نقطة`} foot={comparison == null ? "لا تتوفر مقارنة" : comparison > 0 ? "تحسن" : comparison < 0 ? "تراجع" : "دون تغيير"} tone="gold"/>
        </section>
      </>}
    </>}

    {range === "year" && <>
      <div className="achievement-controls"><label htmlFor="achievement-year-activity">النشاط</label><select id="achievement-year-activity" value={selectedActivity?.id ?? ""} onChange={event => setActivityId(event.target.value)}>{plan.map(activity => <option key={activity.id} value={activity.id}>{activity.name || "نشاط بلا اسم"}</option>)}</select></div>
      <CalendarToolbar title={yearTitle} calendarMode={calendarMode} calendar={calendar} onCalendar={setCalendar} onPrevious={() => moveCalendar(-1, "year")} onNext={() => moveCalendar(1, "year")} />
      {selectedActivity ? <>
        <div className="achievement-month-cards">{annualMetrics.map((item, index) => <button type="button" className={`achievement-annual-card pastel-${index % 6}`} key={item.month} onClick={() => goMonth(item.dates)}><header><b>{item.label}</b><strong>{item.metric.percent == null ? "—" : `${ar(item.metric.percent)}٪`}</strong></header><span>{ar(item.metric.done, 1)} / {ar(item.metric.target, 1)} {item.metric.unit}</span><i><b style={{ width: `${item.metric.percent ?? 0}%` }}/></i></button>)}</div>
        <section className="achievement-year-summary" aria-label="ملخص السنة"><header><b>الإجمالي السنوي</b><strong>{annualMetric?.percent == null ? "—" : `${ar(annualMetric.percent)}٪`}</strong></header><div className="year-summary-values"><span><small>المنجز</small><b>{ar(annualMetric?.done ?? 0, 1)} {unitFor(selectedActivity)}</b></span><span><small>المستهدف</small><b>{ar(annualMetric?.target ?? 0, 1)} {unitFor(selectedActivity)}</b></span><span><small>متوسط شهري</small><b>{averageMonthly.length ? `${ar(averageMonthly.reduce((sum, item) => sum + item.metric.done, 0) / averageMonthly.length, 1)} ${unitFor(selectedActivity)}` : "—"}</b></span><span><small>أفضل شهر</small><b>{bestMonth?.label ?? "—"}</b></span></div><i><b style={{ width: `${annualMetric?.percent ?? 0}%` }}/></i></section>
      </> : <EmptyState/>}
    </>}

    {dayDetail && <div className="achievement-day-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDayDetail(null); }}><section className="achievement-day-dialog" role="dialog" aria-modal="true" aria-labelledby="achievement-day-title"><button className="achievement-dialog-close" type="button" aria-label="إغلاق" onClick={() => setDayDetail(null)}>×</button><small>{formatDate(dayDetail.date, calendar, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</small><h2 id="achievement-day-title">{dayDetail.activity.name}</h2>{(() => { const status = statusForDay(dayDetail.activity, dayDetail.date), done = dayDone(dayDetail.activity, dayDetail.date), target = targetForDay(dayDetail.activity, dayDetail.date), percent = target > 0 ? Math.min(100, Math.round(done / target * 100)) : null; return <><p className="day-status">{statusLabel(status)}</p><div className="day-detail-values"><span><small>المستهدف اليومي</small><b>{target > 0 ? `${ar(target, 1)} ${unitFor(dayDetail.activity)}` : "—"}</b></span><span><small>المنجز الفعلي</small><b>{keyOf(dayDetail.date) > todayKey ? "—" : `${ar(done, 1)} ${unitFor(dayDetail.activity)}`}</b></span><span><small>نسبة الإنجاز</small><b>{percent == null || keyOf(dayDetail.date) > todayKey ? "—" : `${ar(percent)}٪`}</b></span></div></>; })()}</section></div>}
  </section>;
}

function CalendarToolbar({ title, calendarMode, calendar, onCalendar, onPrevious, onNext }: { title: string; calendarMode: "islamic" | "gregory" | "mixed"; calendar: CalendarKind; onCalendar: (value: CalendarKind) => void; onPrevious: () => void; onNext: () => void }) {
  return <div className="achievement-calendar-toolbar"><button type="button" aria-label="الفترة السابقة" onClick={onPrevious}>→</button><strong>{title}</strong><button type="button" aria-label="الفترة التالية" onClick={onNext}>←</button>{calendarMode === "mixed" && <div className="achievement-calendar-kind" role="group" aria-label="نوع التقويم"><button type="button" className={calendar === "islamic" ? "selected" : ""} aria-pressed={calendar === "islamic"} onClick={() => onCalendar("islamic")}>هجري</button><button type="button" className={calendar === "gregory" ? "selected" : ""} aria-pressed={calendar === "gregory"} onClick={() => onCalendar("gregory")}>ميلادي</button></div>}</div>;
}
function AnalysisCard({ title, value, foot, tone }: { title: string; value: string; foot: string; tone: string }) { return <article className={`achievement-analysis-card tone-${tone}`}><small>{title}</small><b>{value}</b><span>{foot}</span></article>; }
function EmptyState() { return <div className="achievement-empty"><p>لا توجد أنشطة محفوظة لعرض إنجازاتها بعد.</p></div>; }
function statusLabel(status: Status) { return status === "complete" ? "اكتمل المستهدف" : status === "partial" ? "إنجاز جزئي" : status === "missed" ? "مستحق دون إنجاز" : status === "future" ? "يوم مستقبلي" : "غير مجدول"; }
function CurrentPeriodIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 11a8.5 8.5 0 1 1 2.1 6.2M3.5 4.8V11h6.2M12 7.5v5l3.2 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
