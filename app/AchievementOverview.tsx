"use client";

import { BookOpen, BookText, Brain, Dumbbell, HeartPulse, Moon, Repeat, Sparkles, Timer } from "lucide-react";
import { counterValue, type ExecutionRecord, type PlannedActivity, type UnitProgress, type WeekStartsOn } from "./local-store";

const arabic = (value: number) => Math.round(value).toLocaleString("ar-SA", { useGrouping: false });
const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const recordKey = (record: ExecutionRecord) => record.dueKey || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(record.completedAt));
const weekday = (date: Date) => new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", weekday: "long" }).format(date);
const scheduledCount = (activity: PlannedActivity, dates: Date[]) => {
  if (activity.schedule.mode === "daily") return dates.length;
  const selectedDays = activity.schedule.days?.length
    ? activity.schedule.days
    : ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].filter(day => activity.schedule.value.includes(day));
  if (selectedDays.length) return dates.filter(date => selectedDays.includes(weekday(date))).length;
  if (activity.schedule.mode === "flexible") {
    const match = activity.schedule.value.match(/[0-9٠-٩]+/)?.[0];
    const parsedSessions = match ? Number(match.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))) : 1;
    return dates.length * Math.min(7, Math.max(0, activity.schedule.sessionsPerWeek ?? parsedSessions)) / 7;
  }
  return dates.length / 7;
};
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

export default function AchievementOverview({ plan, records, unitProgress, weekStartsOn, onOpen, transitioningOut = false, transitioningIn = false }: {
  plan: PlannedActivity[];
  records: ExecutionRecord[];
  unitProgress: UnitProgress[];
  weekStartsOn: WeekStartsOn;
  onOpen: (activity: PlannedActivity) => void;
  transitioningOut?: boolean;
  transitioningIn?: boolean;
}) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const firstDay = weekStartsOn === "saturday" ? 6 : 0;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() - firstDay + 7) % 7));
  const dates = Array.from({ length: 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const dateKeys = new Set(dates.map(keyOf));

  const metrics = plan.map(activity => {
    const activityRecords = records.filter(record => (record.activityId === activity.id || (!record.activityId && record.activity === activity.name)) && record.status !== "missed");
    const inRange = activityRecords.filter(record => dateKeys.has(recordKey(record)));
    const progressByDate = new Map(unitProgress.filter(progress => progress.activityId === activity.id && dateKeys.has(progress.date)).map(progress => [progress.date, progress]));
    const scheduled = scheduledCount(activity, dates);
    let target: number;
    let done = 0;
    let unit = "مرة";
    let kind: "quantity" | "time" | "sessions" = "sessions";
    const definition = activity.goalDefinition;
    if (definition && definition.kind !== "level" && (definition.targetValue ?? definition.targetMilestone) != null) {
      target = definition.targetValue ?? definition.targetMilestone ?? 0;
      done = inRange.reduce((sum, record) => sum + (record.goalProgressValue ?? record.quantity ?? 0), 0);
      unit = definition.unit ?? "تقدم";
      kind = "quantity";
    } else if (activity.unitTracking) {
      target = activity.unitTracking.periods.reduce((sum, period) => sum + period.target, 0) * scheduled;
      unit = activity.unit ?? "ذكر";
      kind = "quantity";
      done = dates.reduce((sum, date) => {
        const progress = progressByDate.get(keyOf(date));
        return sum + (progress ? activity.unitTracking!.periods.reduce((daySum, period) => daySum + Math.max(counterValue(progress, period.id), (progress.completedUnitsByPeriod[period.id]?.length ?? 0) * period.unitValue), 0) : 0);
      }, 0);
      if (!done) done = inRange.reduce((sum, record) => sum + (record.quantity ?? 0), 0);
    } else if (activity.quantity != null && activity.quantity > 0) {
      target = activity.quantity * scheduled;
      done = inRange.reduce((sum, record) => sum + (record.quantity ?? 0), 0);
      unit = activity.unit ?? "وحدة";
      kind = "quantity";
    } else if (activity.trackingMode === "time" || activity.expectedMinutes > 0) {
      target = activity.expectedMinutes * scheduled;
      done = inRange.reduce((sum, record) => sum + (record.durationSeconds ?? record.minutes * 60), 0) / 60;
      unit = "دقيقة";
      kind = "time";
    } else {
      target = scheduled;
      done = inRange.length;
    }

    const percent = target > 0 ? Math.min(100, Math.round(done / target * 100)) : null;
    return { activity, target, done, unit, kind, percent };
  });

  return <section className={`screen achievement-overview ${transitioningOut ? "is-transitioning-out" : ""} ${transitioningIn ? "is-transitioning-in" : ""}`} dir="rtl">
    {metrics.length ? <div className="achievement-cards">{metrics.map((item, index) => {
      const Icon = activityIcon(item.activity);
      return <button type="button" key={item.activity.id} className={`achievement-card pastel-${index % 6}`} onClick={() => onOpen(item.activity)}>
        <span className={`achievement-card-icon pastel-icon-${index % 6}`}><Icon aria-hidden="true"/></span>
        <span className="achievement-card-copy"><b>{item.activity.name}</b><small>{item.target > 0 ? `المستهدف ${arabic(item.target)} ${item.unit}` : "لا يوجد مستهدف لهذه الفترة"}</small><span className="achievement-progress-track"><i style={{ width: `${item.percent ?? 0}%` }}/></span><small>{item.done > 0 ? `المنجز ${arabic(item.done)} ${item.unit}` : "لا يوجد إنجاز مسجل هذا الأسبوع"}</small></span>
        <strong className="achievement-card-percent">{item.percent == null ? "—" : `${arabic(item.percent)}٪`}</strong>
      </button>;
    })}</div> : <div className="achievement-empty"><p>لا توجد أنشطة محفوظة لعرض إنجازاتها بعد.</p></div>}
  </section>;
}
