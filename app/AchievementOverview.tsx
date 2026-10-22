"use client";

import { useState } from "react";
import { BookOpen, BookText, Brain, Dumbbell, HeartPulse, Moon, Repeat, Sparkles, Timer } from "lucide-react";
import { counterValue, type ExecutionRecord, type PlannedActivity, type UnitProgress, type WeekStartsOn } from "./local-store";

type Range = "week" | "month" | "year";
type CalendarKind = "gregory" | "islamic";
const ar = (value: number) => Math.round(value).toLocaleString("ar-SA", { useGrouping: false });
const weekdayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const weekdayShort = ["أح", "إث", "ثل", "أر", "خم", "جم", "سب"];
const riyadhDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" });
const keyOf = (date: Date) => riyadhDate.format(date);
const recordKey = (record: ExecutionRecord) => record.dueKey || keyOf(new Date(record.completedAt));
const fromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
};
const addDays = (date: Date, count: number) => new Date(date.getTime() + count * 86400000);
const calendarParts = (date: Date, calendar: CalendarKind) => {
  const parts = new Intl.DateTimeFormat(calendar === "islamic" ? "en-US-u-ca-islamic-umalqura" : "en-US-u-ca-gregory", { timeZone: "Asia/Riyadh", day: "numeric", month: "numeric", year: "numeric" }).formatToParts(date);
  const read = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
  return { day: read("day"), month: read("month"), year: read("year") };
};
const makeCalendarMonth = (calendar: CalendarKind, year: number, month: number, center: Date, offset: number) => {
  if (calendar === "gregory") {
    const first = new Date(Date.UTC(year, month - 1, 1, 12));
    const count = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
    return Array.from({ length: count }, (_, index) => addDays(first, index));
  }
  const guess = addDays(center, Math.round(offset * 29.530588));
  const radius = Math.max(40, Math.ceil(Math.abs(offset) * 0.55) + 12);
  const dates: Date[] = [];
  for (let day = -radius; day <= radius; day++) {
    const date = addDays(guess, day), parts = calendarParts(date, calendar);
    if (parts.year === year && parts.month === month) dates.push(date);
  }
  return dates;
};
const formatDate = (date: Date, calendar: CalendarKind, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(calendar === "islamic" ? "ar-SA-u-ca-islamic-umalqura" : "ar-SA-u-ca-gregory", { ...options, timeZone: "Asia/Riyadh" }).format(date);
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
const scheduledDays = (activity: PlannedActivity) => {
  const schedule = activity.nature === "goal" && activity.supportingPlan?.enabled ? activity.supportingPlan.schedule : activity.schedule;
  const named = schedule.days?.length ? schedule.days : weekdayNames.filter(day => schedule.value.includes(day));
  return { schedule, named };
};
const sessionsPerWeek = (activity: PlannedActivity) => {
  const { schedule } = scheduledDays(activity);
  const text = schedule.value.match(/[0-9٠-٩]+/)?.[0];
  const parsed = text ? Number(text.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))) : 1;
  return Math.min(7, Math.max(0, schedule.sessionsPerWeek ?? parsed));
};

export default function AchievementOverview({ plan, records, unitProgress, weekStartsOn, calendarMode, transitioningOut = false, transitioningIn = false }: {
  plan: PlannedActivity[];
  records: ExecutionRecord[];
  unitProgress: UnitProgress[];
  weekStartsOn: WeekStartsOn;
  calendarMode: "islamic" | "gregory" | "mixed";
  transitioningOut?: boolean;
  transitioningIn?: boolean;
}) {
  const [range, setRange] = useState<Range>("week");
  const [offset, setOffset] = useState(0);
  const [selectedWeekDay, setSelectedWeekDay] = useState<number | null>(null);
  const [selectedMonthDay, setSelectedMonthDay] = useState<string | null>(null);
  const [selectedYearMonth, setSelectedYearMonth] = useState<number | null>(null);
  const calendar: CalendarKind = calendarMode === "gregory" || calendarMode === "mixed" ? "gregory" : "islamic";
  const todayKey = keyOf(new Date());
  const today = fromKey(todayKey);
  const firstDay = weekStartsOn === "saturday" ? 6 : 0;

  const currentWeekDay = fromKey(todayKey).getUTCDay();
  const weekStart = addDays(fromKey(todayKey), -((currentWeekDay - firstDay + 7) % 7) + offset * 7);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const todayParts = calendarParts(today, calendar);
  const monthIndex = todayParts.year * 12 + todayParts.month - 1 + offset;
  const monthYear = Math.floor(monthIndex / 12), monthNumber = monthIndex - monthYear * 12 + 1;
  const monthDates = makeCalendarMonth(calendar, monthYear, monthNumber, today, offset);
  const year = todayParts.year + offset;
  const yearCenter = addDays(today, Math.round(offset * (calendar === "islamic" ? 354.367 : 365.2425)));
  const yearDates = calendar === "gregory"
    ? Array.from({ length: (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000 }, (_, index) => new Date(Date.UTC(year, 0, index + 1, 12))).filter(date => calendarParts(date, calendar).year === year)
    : (() => {
      const found: Date[] = [], radius = 190 + Math.ceil(Math.abs(offset) * 11.2);
      for (let day = -radius; day <= radius; day++) {
        const date = addDays(yearCenter, day);
        if (calendarParts(date, calendar).year === year) found.push(date);
      }
      return found;
    })();
  const yearMonths = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    date: yearDates.find(date => calendarParts(date, calendar).month === index + 1),
  })).filter(item => item.date);
  const monthTitle = monthDates[0] ? formatDate(monthDates[0], calendar, { month: "long", year: "numeric" }) : formatDate(today, calendar, { month: "long", year: "numeric" });
  const yearTitle = formatDate(yearCenter, calendar, { year: "numeric" });
  const monthOffset = monthDates.length ? (monthDates[0].getUTCDay() - firstDay + 7) % 7 : 0;
  const weekdayHeaders = Array.from({ length: 7 }, (_, index) => (firstDay + index) % 7);
  const isCurrentWeek = offset === 0;
  const isCurrentMonth = offset === 0;
  const changeRange = (next: Range) => {
    setRange(next); setOffset(0); setSelectedWeekDay(null); setSelectedMonthDay(null); setSelectedYearMonth(null);
  };
  const shift = (amount: number) => {
    setOffset(value => value + amount); setSelectedWeekDay(null); setSelectedMonthDay(null); setSelectedYearMonth(null);
  };
  const selectedDates = range === "week"
    ? (selectedWeekDay == null ? weekDates : weekDates.filter(date => date.getUTCDay() === selectedWeekDay))
    : range === "month"
      ? (selectedMonthDay ? monthDates.filter(date => keyOf(date) === selectedMonthDay) : monthDates)
      : (selectedYearMonth == null ? yearDates : yearDates.filter(date => calendarParts(date, calendar).month === selectedYearMonth));
  const futureSelection = selectedDates.length > 0 && selectedDates.every(date => keyOf(date) > todayKey);
  const datesInPeriod = selectedDates.filter(date => keyOf(date) <= todayKey);
  const metrics = plan.map((activity, index) => {
    const { schedule, named } = scheduledDays(activity);
    const activityRecords = records.filter(record => (record.activityId === activity.id || (!record.activityId && record.activity === activity.name)) && record.status !== "missed");
    const activityProgress = unitProgress.filter(progress => progress.activityId === activity.id);
    const knownDates = [...activityRecords.map(record => record.dueKey || keyOf(new Date(record.completedAt))), ...activityProgress.map(progress => progress.date)].filter(Boolean).sort();
    const startKey = activity.createdAt ? keyOf(new Date(activity.createdAt)) : knownDates[0] ?? null;
    const activeDates = datesInPeriod.filter(date => !startKey || keyOf(date) >= startKey);
    const selectedKeys = new Set(activeDates.map(keyOf));
    const isBeforeCreation = Boolean(startKey && selectedDates.length && selectedDates.every(date => keyOf(date) < startKey));
    const scheduled = activeDates.filter(date => {
      if (schedule.mode === "daily") return true;
      if (schedule.mode === "flexible") return named.length ? named.includes(weekdayNames[date.getUTCDay()]) : selectedDates.length > 1;
      if (named.length) return named.includes(weekdayNames[date.getUTCDay()]);
      return false;
    });
    const fixedCount = scheduled.length;
    const flexibleTarget = schedule.mode === "flexible" && !named.length
      ? selectedDates.length === 1 ? 0 : sessionsPerWeek(activity) * activeDates.length / 7
      : 0;
    const occurrences = schedule.mode === "flexible" && !named.length ? flexibleTarget : fixedCount;
    const targetByDay = new Map<string, number>();
    if (activity.unitTracking) {
      for (const date of scheduled) {
        const key = keyOf(date), progress = activityProgress.find(item => item.date === key);
        targetByDay.set(key, activity.unitTracking.periods.reduce((sum, period) => sum + (progress?.targetByPeriod?.[period.id] ?? period.target), 0));
      }
    }
    let unit = "مرة", target = 0, done = 0;
    if (activity.unitTracking) {
      unit = activity.unit ?? "ذكر";
      const dailyTarget = activity.unitTracking.periods.reduce((sum, period) => sum + period.target, 0);
      target = schedule.mode === "flexible" && !named.length ? dailyTarget * occurrences : [...targetByDay.values()].reduce((sum, value) => sum + value, 0);
      const recordByDay = new Map<string, number>();
      for (const record of activityRecords) {
        const key = recordKey(record);
        if (!selectedKeys.has(key)) continue;
        recordByDay.set(key, Math.max(recordByDay.get(key) ?? 0, record.quantity ?? 0));
      }
      done = activeDates.reduce((sum, date) => {
        const key = keyOf(date), progress = activityProgress.find(item => item.date === key);
        const tracked = progress ? activity.unitTracking!.periods.reduce((daySum, period) => daySum + Math.max(counterValue(progress, period.id), (progress.completedUnitsByPeriod[period.id]?.length ?? 0) * period.unitValue), 0) : 0;
        return sum + Math.max(tracked, recordByDay.get(key) ?? 0);
      }, 0);
    } else if (activity.quantity != null && activity.quantity > 0) {
      unit = activity.unit ?? "وحدة"; target = activity.quantity * occurrences;
      done = activityRecords.filter(record => selectedKeys.has(recordKey(record))).reduce((sum, record) => sum + (record.goalProgressValue ?? record.quantity ?? 0), 0);
    } else if (activity.expectedMinutes > 0) {
      unit = "دقيقة"; target = activity.expectedMinutes * occurrences;
      done = activityRecords.filter(record => selectedKeys.has(recordKey(record))).reduce((sum, record) => sum + (record.durationSeconds ?? record.minutes * 60) / 60, 0);
    } else {
      unit = activity.trackingMode === "time" ? "جلسة" : "مرة";
      target = occurrences;
      done = activityRecords.filter(record => selectedKeys.has(recordKey(record))).length;
    }
    if (activity.goalDefinition?.unit && !activity.unitTracking && !activity.quantity && activity.goalDefinition.kind !== "level") {
      unit = activity.goalDefinition.unit;
      done = activityRecords.filter(record => selectedKeys.has(recordKey(record))).reduce((sum, record) => sum + (record.goalProgressValue ?? record.quantity ?? 0), 0);
      target = 0;
    }
    const isFutureOnly = futureSelection;
    const isScheduled = occurrences > 0;
    const percent = target > 0 && !isFutureOnly ? Math.min(100, Math.round(done / target * 100)) : null;
    return { activity, index, target, done, unit, percent, isScheduled, isFutureOnly, isBeforeCreation };
  });
  const scoreActivities = metrics.filter(item => item.isScheduled && item.target > 0 && !item.isFutureOnly);
  const overall = scoreActivities.length ? Math.round(scoreActivities.reduce((sum, item) => sum + Math.min(100, item.done / item.target * 100), 0) / scoreActivities.length) : null;
  const caption = range === "week"
    ? selectedWeekDay == null
      ? `${formatDate(weekDates[0], calendar, { day: "numeric", month: "short" })} – ${formatDate(weekDates[6], calendar, { day: "numeric", month: "short", year: "numeric" })}`
      : formatDate(weekDates.find(date => date.getUTCDay() === selectedWeekDay) ?? weekDates[0], calendar, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : range === "month" ? monthTitle
      : yearTitle;
  const goCurrent = () => { setOffset(0); setSelectedWeekDay(null); setSelectedMonthDay(null); setSelectedYearMonth(null); };
  const pastPeriod = offset !== 0;
  const weekDayOptions = weekdayHeaders.map(day => ({ day, name: weekdayNames[day] }));

  return <section className={`screen achievement-overview ${transitioningOut ? "is-transitioning-out" : ""} ${transitioningIn ? "is-transitioning-in" : ""}`} dir="rtl">
    <nav className="achievement-range" aria-label="فترة الإنجازات">
      {([['week', 'أسبوعي'], ['month', 'شهري'], ['year', 'سنوي']] as const).map(([id, label]) => <button type="button" aria-pressed={range === id} key={id} className={range === id ? "selected" : ""} onClick={() => changeRange(id)}>{label}</button>)}
    </nav>

    <div className="achievement-period-nav">
      <button type="button" aria-label="الفترة السابقة" onClick={() => shift(-1)}>‹</button>
      <strong>{caption}</strong>
      {pastPeriod && <button type="button" className="achievement-current-period" onClick={goCurrent} aria-label="العودة إلى الفترة الحالية" title="العودة إلى الفترة الحالية"><CurrentPeriodIcon/></button>}
      <button type="button" aria-label="الفترة التالية" onClick={() => shift(1)}>›</button>
    </div>

    {range === "week" && <div className="achievement-week-days" aria-label="تصفية أيام الأسبوع">
      <button type="button" className={selectedWeekDay == null ? "selected" : ""} aria-pressed={selectedWeekDay == null} onClick={() => setSelectedWeekDay(null)}>الكل</button>
      {weekDayOptions.map(({ day, name }) => {
        const date = weekDates.find(item => item.getUTCDay() === day)!, current = isCurrentWeek && keyOf(date) === todayKey;
        return <button type="button" key={day} className={`${selectedWeekDay === day ? "selected" : ""} ${current ? "today" : ""}`} aria-pressed={selectedWeekDay === day} onClick={() => setSelectedWeekDay(day)}><span>{name}</span>{current && <i aria-label="اليوم"/>}</button>;
      })}
    </div>}

    {range === "month" && <div className="achievement-month-grid" aria-label="تقويم الشهر" dir="rtl">
      {weekdayHeaders.map(day => <b key={day}>{weekdayShort[day]}</b>)}
      {Array.from({ length: monthOffset }, (_, index) => <i key={`blank-${index}`} aria-hidden="true"/>)}
      {monthDates.map(date => {
        const key = keyOf(date), current = isCurrentMonth && key === todayKey;
        return <button type="button" key={key} className={`${selectedMonthDay === key ? "selected" : ""} ${current ? "today" : ""} ${key > todayKey ? "future" : ""}`} aria-pressed={selectedMonthDay === key} onClick={() => setSelectedMonthDay(selectedMonthDay === key ? null : key)}>{ar(calendarParts(date, calendar).day)}</button>;
      })}
      <button type="button" className={`achievement-all-days ${selectedMonthDay == null ? "selected" : ""}`} aria-pressed={selectedMonthDay == null} onClick={() => setSelectedMonthDay(null)}>الكل</button>
    </div>}

    {range === "year" && <div className="achievement-year-months" aria-label="أشهر السنة">
      <button type="button" className={`achievement-all-months ${selectedYearMonth == null ? "selected" : ""}`} aria-pressed={selectedYearMonth == null} onClick={() => setSelectedYearMonth(null)}>الكل</button>
      {yearMonths.map(({ month, date }) => <button type="button" key={month} className={`${selectedYearMonth === month ? "selected" : ""} ${offset === 0 && month === todayParts.month ? "today" : ""} ${date && keyOf(date) > todayKey ? "future" : ""}`} aria-pressed={selectedYearMonth === month} onClick={() => setSelectedYearMonth(selectedYearMonth === month ? null : month)}>{date ? formatDate(date, calendar, { month: "short" }) : ar(month)}</button>)}
    </div>}

    <section className="achievement-overall" aria-label="مؤشر الإنجاز العام">
      <div className="achievement-overall-copy"><small>{range === "week" ? selectedWeekDay == null ? "إنجاز الأسبوع" : "إنجاز اليوم" : range === "month" ? selectedMonthDay ? "إنجاز اليوم" : "إنجاز الشهر" : selectedYearMonth ? "إنجاز الشهر" : "إنجاز السنة"}</small><span>{caption}</span></div>
      <div className="achievement-semi-gauge" role="img" aria-label={overall == null ? "لا توجد مستهدفات مستحقة" : `نسبة الإنجاز ${ar(overall)}٪`}>
        <svg viewBox="0 0 160 94" aria-hidden="true"><path className="gauge-track" d="M 12 84 A 68 68 0 0 1 148 84"/><path className="gauge-value" d="M 12 84 A 68 68 0 0 1 148 84" pathLength="100" style={{ strokeDasharray: `${overall ?? 0} 100` }}/></svg>
        <strong>{overall == null ? "—" : `${ar(overall)}٪`}</strong>
      </div>
      <small>{scoreActivities.length ? `${ar(scoreActivities.length)} أنشطة مستحقة` : futureSelection ? "هذه الفترة لم تبدأ بعد" : "لا توجد مستهدفات مستحقة في هذه الفترة"}</small>
    </section>

    {metrics.length ? <div className="achievement-cards">{metrics.map(item => {
      const Icon = activityIcon(item.activity), fill = item.percent ?? 0;
      const label = item.isFutureOnly ? "لم تبدأ الفترة بعد" : item.isBeforeCreation ? "النشاط لم يكن قد أُنشئ بعد" : !item.isScheduled ? "غير مجدول" : item.target > 0 ? `${ar(item.done)} / ${ar(item.target)} ${item.unit}` : item.done > 0 ? `المنجز ${ar(item.done)} ${item.unit} · لا يوجد مستهدف للفترة` : "لا يوجد مستهدف لهذه الفترة";
      return <article key={item.activity.id} className={`achievement-card pastel-${item.index % 6}`} style={{ "--achievement-progress": `${fill}%` } as React.CSSProperties}>
        <span className={`achievement-card-icon pastel-icon-${item.index % 6}`}><Icon aria-hidden="true"/></span>
        <span className="achievement-card-copy"><b>{item.activity.name}</b><small>{label}</small></span>
        <strong className="achievement-card-percent">{item.percent == null ? "—" : `${ar(item.percent)}٪`}</strong>
      </article>;
    })}</div> : <div className="achievement-empty"><p>لا توجد أنشطة محفوظة لعرض إنجازاتها بعد.</p></div>}
  </section>;
}

function CurrentPeriodIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 11a8.5 8.5 0 1 1 2.1 6.2M3.5 4.8V11h6.2M12 7.5v5l3.2 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
