"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, X } from "lucide-react";
import type { ExecutionRecord, PlannedActivity, PrayerStatus } from "./local-store";
import "./prayer-tracker.css";

export const PRAYER_NAMES = ["الفجر", "الظهر", "العصر", "المغرب", "العشاء"] as const;
export const PRAYER_STATUS_OPTIONS: { id: PrayerStatus; label: string; hint: string }[] = [
  { id: "very-early", label: "مبكر جدًا", hint: "مع الأذان أو قريبًا منه" },
  { id: "early", label: "مبكر", hint: "بين الأذان والإقامة" },
  { id: "late", label: "متأخر", hint: "بعد الإقامة مع إدراك جميع الركعات" },
  { id: "very-late", label: "متأخر جدًا", hint: "فاتت ركعة أو أكثر" },
  { id: "home", label: "في البيت", hint: "داخل وقت الصلاة" },
  { id: "makeup", label: "مقضية", hint: "بعد خروج وقتها" },
];
const keyDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const dateAtNoon = (key: string) => new Date(`${key}T12:00:00`);
const formatDay = (key: string, mode: "islamic" | "gregory") => new Intl.DateTimeFormat(mode === "islamic" ? "ar-SA-u-ca-islamic-umalqura" : "ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" }).format(dateAtNoon(key));

export function prayerRecordFor(records: ExecutionRecord[], activityId: string, date: string, prayer: string) {
  return records.find(record => record.activityId === activityId && record.dueKey === date && record.prayerName === prayer && record.prayerStatus);
}

export default function PrayerTracker({ activity, date, today, calendarMode, records, onDateChange, onSave, onExit }: {
  activity: PlannedActivity; date: string; today: string; calendarMode: "islamic" | "gregory" | "mixed";
  records: ExecutionRecord[]; onDateChange: (date: string) => void; onSave: (prayer: typeof PRAYER_NAMES[number], status: PrayerStatus, date: string) => void; onExit: () => void;
}) {
  const [editing, setEditing] = useState<typeof PRAYER_NAMES[number] | null>(null);
  const mode = calendarMode === "gregory" ? "gregory" : "islamic";
  const entries = useMemo(() => PRAYER_NAMES.map(name => ({ name, record: prayerRecordFor(records, activity.id, date, name) })), [records, activity.id, date]);
  const shiftDate = (offset: number) => { const next = dateAtNoon(date); next.setDate(next.getDate() + offset); onDateChange(keyDate(next)); };
  const todayLabel = date === today ? "اليوم" : formatDay(date, mode);
  return <section className="prayer-tracker" dir="rtl">
    <header className="prayer-tracker-heading"><div><small>متابعة الصلاة</small><h1>{activity.name}</h1></div><button type="button" onClick={onExit} aria-label="العودة إلى اليوم"><X/></button></header>
    <nav className="prayer-date-nav" aria-label="اختيار اليوم"><button type="button" onClick={() => shiftDate(-1)} aria-label="اليوم السابق"><ChevronRight/></button><strong>{todayLabel}</strong><button type="button" onClick={() => shiftDate(1)} disabled={date >= today} aria-label="اليوم التالي"><ChevronLeft/></button>{date !== today && <button className="prayer-today-button" type="button" onClick={() => onDateChange(today)}>اليوم</button>}</nav>
    <p className="prayer-tracker-note">سجّل حالتك لكل صلاة. يمكنك تعديلها في أي وقت.</p>
    <div className="prayer-list">{entries.map(({ name, record }) => {
      const status = PRAYER_STATUS_OPTIONS.find(option => option.id === record?.prayerStatus);
      return <button type="button" key={name} className={`prayer-row ${status ? `status-${status.id}` : ""}`} onClick={() => setEditing(name)}>
        <span className="prayer-row-name"><Clock3 aria-hidden="true"/><b>{name}</b></span><span className="prayer-row-status">{status ? <><i/>{status.label}</> : "لم تُسجل"}</span><span className="prayer-row-edit">{status ? "تعديل" : "تسجيل"}</span>
      </button>;
    })}</div>
    {editing && <div className="prayer-sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}><section className="prayer-sheet" role="dialog" aria-modal="true" aria-labelledby="prayer-sheet-title"><header><div><small>{formatDay(date, mode)}</small><h2 id="prayer-sheet-title">صلاة {editing}</h2></div><button type="button" aria-label="إغلاق" onClick={() => setEditing(null)}><X/></button></header><div className="prayer-status-options">{PRAYER_STATUS_OPTIONS.map(option => <button type="button" key={option.id} className={`prayer-status-option status-${option.id}`} onClick={() => { onSave(editing, option.id, date); setEditing(null); }}><i/><span><b>{option.label}</b><small>{option.hint}</small></span></button>)}</div></section></div>}
  </section>;
}
