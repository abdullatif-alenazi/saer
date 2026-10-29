import { replaceLocalSnapshot, type Appointment, type ExecutionRecord, type PlannedActivity, type TaskItem, type UnitProgress, type WorkoutExercise } from "./local-store";

const marker = "sair.demo-preview.seed.v1";
const dayKey = (date: Date) => {
  const year = date.getFullYear(), month = String(date.getMonth() + 1).padStart(2, "0"), day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const shift = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const at = (date: Date, hour: number) => { const next = new Date(date); next.setHours(hour, 0, 0, 0); return next.toISOString(); };

const exercises: WorkoutExercise[] = [
  { id: "demo-pushups", name: "بوش أب", category: "دفع", measurement: "repetitions", sets: 3, reps: 12, restSeconds: 60 },
  { id: "demo-pullup", name: "تعلق عقلة", category: "سحب", measurement: "duration", sets: 3, durationSeconds: 30, restSeconds: 60 },
  { id: "demo-squats", name: "سكوات", category: "أرجل", measurement: "repetitions", sets: 3, reps: 16, restSeconds: 60 },
  { id: "demo-plank", name: "بلانك", category: "جذع", measurement: "duration", sets: 3, durationSeconds: 45, restSeconds: 60 },
];
const schedule = { mode: "daily" as const, value: "يومي", days: ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"] };
const plan: PlannedActivity[] = [
  { id: "demo-istighfar", name: "الاستغفار", template: "ذكر", period: "الصباح", goal: "١٠٬٠٠٠ استغفار", expectedMinutes: 35, nature: "commitment", schedule, quantity: 10000, unit: "ذكر", measurements: ["عدد"], unitTracking: { method: "counter", target: 10000, pressValue: 100, timing: { count: 100, seconds: 70, enabled: true, showTimer: true, roundSize: 100 }, gaugeStyle: "periods", periods: [
    { id: "demo-morning", label: "الصباح", period: "الصباح", target: 3000, unitCount: 30, unitValue: 100 },
    { id: "demo-noon", label: "الظهر", period: "الظهر", target: 1500, unitCount: 15, unitValue: 100 },
    { id: "demo-asr", label: "العصر", period: "العصر", target: 1500, unitCount: 15, unitValue: 100 },
    { id: "demo-maghrib", label: "المغرب", period: "المغرب", target: 1500, unitCount: 15, unitValue: 100 },
    { id: "demo-night", label: "الليل", period: "الليل", target: 2500, unitCount: 25, unitValue: 100 },
  ] } },
  { id: "demo-tasbeeh", name: "التسبيح", template: "ذكر", period: "الصباح", goal: "١٬٠٠٠ تسبيحة", expectedMinutes: 12, nature: "commitment", schedule, quantity: 1000, unit: "ذكر", measurements: ["عدد"], unitTracking: { method: "counter", target: 1000, pressValue: 100, timing: { count: 100, seconds: 90, enabled: true, showTimer: true, roundSize: 100 }, periods: [{ id: "demo-tasbeeh-morning", label: "الصباح", period: "الصباح", target: 600, unitCount: 6, unitValue: 100 }, { id: "demo-tasbeeh-night", label: "الليل", period: "الليل", target: 400, unitCount: 4, unitValue: 100 }] } },
  { id: "demo-quran", name: "قراءة القرآن", template: "قراءة", period: "الصباح", goal: "قراءة يومية", expectedMinutes: 25, nature: "commitment", schedule, quantity: 5, unit: "صفحة", measurements: ["صفحات"] },
  { id: "demo-reading", name: "قراءة كتاب", template: "قراءة", period: "الليل", goal: "قراءة كتاب نافع", expectedMinutes: 20, nature: "goal", schedule, quantity: 15, unit: "صفحة", measurements: ["صفحات"], goalDefinition: { kind: "quantity", currentValue: 84, targetValue: 240, unit: "صفحة" } },
  { id: "demo-workout", name: "كاليسثنكس", template: "رياضة", period: "العصر", goal: "جلسة تمرين متكاملة", expectedMinutes: 32, nature: "commitment", schedule, exercises, measurements: ["جلسات"] },
  { id: "demo-walk", name: "المشي", template: "رياضة", period: "الظهر", goal: "مشي يومي", expectedMinutes: 30, nature: "commitment", schedule, quantity: 30, unit: "دقيقة", measurements: ["مدة"] },
  { id: "demo-prayer", name: "الصلاة على النبي ﷺ", template: "ذكر", period: "المغرب", goal: "ورد الصلاة على النبي", expectedMinutes: 10, nature: "commitment", schedule: { ...schedule, mode: "fixed", value: "بعد المغرب", days: ["السبت", "الاثنين", "الأربعاء", "الجمعة"] }, quantity: 500, unit: "ذكر", measurements: ["عدد"] },
];

export function seedDemoPreview() {
  if (typeof window === "undefined" || localStorage.getItem(marker)) return;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const tasks: TaskItem[] = [
    { id: "demo-task-today", title: "إرسال التقرير الأسبوعي", date: dayKey(today), time: "15:30", urgent: true },
    { id: "demo-task-tomorrow", title: "شراء مستلزمات التمرين", date: dayKey(shift(today, 1)), time: "18:00" },
    { id: "demo-task-week", title: "مراجعة خطة الأسبوع", date: dayKey(shift(today, 3)), time: "10:00" },
    { id: "demo-task-unscheduled", title: "ترتيب رف الكتب" },
    { id: "demo-task-completed", title: "تجهيز حقيبة النادي", date: dayKey(shift(today, -1)), completedAt: at(shift(today, -1), 19) },
    { id: "demo-task-archived", title: "مهمة مؤرشفة للعرض", date: dayKey(shift(today, -8)), archivedAt: at(shift(today, -2), 12) },
  ];
  const appointments: Appointment[] = [
    { id: "demo-appointment", title: "موعد طبيب الأسنان", date: dayKey(shift(today, 2)), time: "17:30", alertMinutes: 15, kind: "appointment", location: "مركز الابتسامة", notes: "موعد تجريبي" },
    { id: "demo-event", title: "موعد تسليم المشروع", date: dayKey(shift(today, 5)), time: "12:00", kind: "event", repeat: "none" },
    { id: "demo-memory", title: "ذكرى جميلة", date: dayKey(shift(today, -12)), time: "09:00", kind: "memory", yearly: true },
    { id: "demo-occasion", title: "مناسبة عائلية", date: dayKey(shift(today, 10)), time: "20:00", kind: "occasion" },
    { id: "demo-custom-record", title: "موعد متابعة القراءة", date: dayKey(shift(today, 15)), time: "19:00", kind: "event", customCategoryId: "demo-category-health" },
  ];
  const executionLog: ExecutionRecord[] = [];
  const unitProgress: UnitProgress[] = [];
  for (let offset = 89; offset >= 0; offset--) {
    const date = shift(today, -offset), key = dayKey(date), iso = at(date, 8);
    const factor = (offset * 7) % 10;
    executionLog.push({ id: `demo-quran-${key}`, activityId: "demo-quran", activity: "قراءة القرآن", minutes: 18 + factor, durationSeconds: (18 + factor) * 60, quantity: 2 + factor % 4, targetQuantity: 5, quantityUnit: "صفحة", activityKind: "quantity", completedAt: iso, status: "completed", dueKey: key });
    executionLog.push({ id: `demo-reading-${key}`, activityId: "demo-reading", activity: "قراءة كتاب", minutes: 15 + factor, durationSeconds: (15 + factor) * 60, quantity: 6 + factor, targetQuantity: 15, quantityUnit: "صفحة", activityKind: "quantity", completedAt: at(date, 21), status: "completed", dueKey: key });
    if (offset % 6 !== 0) executionLog.push({ id: `demo-workout-${key}`, activityId: "demo-workout", activity: "كاليسثنكس", minutes: 24 + factor, durationSeconds: (24 + factor) * 60, activityKind: "time", completedAt: at(date, 17), status: "completed", dueKey: key, exerciseResults: exercises.map((exercise, index) => ({ exerciseId: exercise.id, name: exercise.name, measurement: exercise.measurement, completedSets: 2 + (offset + index) % 2, targetSets: exercise.sets, repetitions: exercise.reps ?? 0, durationSeconds: exercise.durationSeconds ?? 0 })) });
    if (offset % 4 !== 0) executionLog.push({ id: `demo-walk-${key}`, activityId: "demo-walk", activity: "المشي", minutes: 22 + factor, durationSeconds: (22 + factor) * 60, quantity: 22 + factor, targetQuantity: 30, quantityUnit: "دقيقة", activityKind: "quantity", completedAt: at(date, 13), status: "completed", dueKey: key });
    for (const [activityId, period, amount, target, hour] of [["demo-istighfar", "demo-morning", 1800 + (factor * 100), 3000, 7], ["demo-istighfar", "demo-night", 1200 + (factor * 100), 2500, 22], ["demo-tasbeeh", "demo-tasbeeh-morning", 400 + factor * 10, 600, 8]] as const) {
      unitProgress.push({ activityId, date: key, counterByPeriod: { [period]: amount }, completedUnitsByPeriod: { [period]: Array.from({ length: Math.floor(amount / 100) }, (_, index) => index) }, targetByPeriod: { [period]: target }, updatedAt: at(date, hour), ...(amount >= target ? { completedAt: at(date, hour) } : {}) });
    }
  }
  const snapshot = {
    version: 1 as const, plan, tasks, appointments, executionLog, unitProgress,
    preferences: { calendarMode: "mixed", journeyFilter: "all", weekStartsOn: "saturday" as const, calendarCategories: [{ id: "demo-category-health", name: "صحة" }, { id: "demo-category-family", name: "العائلة" }] },
  };
  replaceLocalSnapshot(snapshot);
  localStorage.setItem("sair.notifications.read.v1", JSON.stringify([]));
  localStorage.setItem(marker, "ready");
}
