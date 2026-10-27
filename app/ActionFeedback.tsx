"use client";

import { useEffect, useRef, useState } from "react";

type FeedbackTone = "success" | "error";
type FeedbackNotice = { message: string; tone: FeedbackTone; id: number };
const EVENT_NAME = "sair:action-feedback";

export function announceAction(message: string, tone: FeedbackTone = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { message, tone } }));
}

export default function ActionFeedback() {
  const [notice, setNotice] = useState<FeedbackNotice | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; tone: FeedbackTone }>).detail;
      if (!detail?.message) return;
      setNotice({ ...detail, id: Date.now() });
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setNotice(null), detail.tone === "error" ? 4500 : 2600);
    };
    window.addEventListener(EVENT_NAME, receive);
    return () => {
      window.removeEventListener(EVENT_NAME, receive);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  if (!notice) return null;
  return <div key={notice.id} className={`action-feedback action-feedback-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"} aria-live={notice.tone === "error" ? "assertive" : "polite"}>
    <span aria-hidden="true">{notice.tone === "error" ? "!" : "✓"}</span>{notice.message}
  </div>;
}
