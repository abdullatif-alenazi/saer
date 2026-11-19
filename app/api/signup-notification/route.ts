export const runtime = "nodejs";

type SignupRecord = {
  id: string;
  email: string | null;
  created_at: string;
};

type SignupWebhook = {
  type?: string;
  schema?: string;
  table?: string;
  record?: SignupRecord;
};

const json = (status: number, message: string) =>
  Response.json({ ok: status >= 200 && status < 300, message }, { status });

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.SAER_SIGNUP_WEBHOOK_SECRET;
  const suppliedSecret = request.headers.get("x-saer-webhook-secret") ?? "";
  if (!webhookSecret || webhookSecret.length < 32 || !safeEqual(webhookSecret, suppliedSecret)) {
    return json(401, "غير مصرح");
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 20_000) return json(413, "حجم الطلب أكبر من المسموح");

  let payload: SignupWebhook;
  try {
    payload = (await request.json()) as SignupWebhook;
  } catch {
    return json(400, "بيانات غير صالحة");
  }

  const record = payload.record;
  if (
    payload.type !== "INSERT" ||
    payload.schema !== "auth" ||
    payload.table !== "users" ||
    !record ||
    !/^[0-9a-f-]{36}$/i.test(record.id) ||
    !record.email ||
    record.email.length > 320 ||
    !record.created_at
  ) {
    return json(400, "حدث التسجيل غير صالح");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.SAER_SIGNUP_NOTIFICATION_EMAIL;
  const sender = process.env.SAER_SIGNUP_FROM_EMAIL;
  if (!apiKey || !recipient || !sender) {
    return json(503, "خدمة إشعار التسجيل غير مكتملة الإعداد");
  }

  const registeredAt = new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(record.created_at));
  const escapedEmail = escapeHtml(record.email);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `saer-new-signup-${record.id}`,
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        subject: "تسجيل عميل جديد في سائر",
        text: `تم تسجيل عميل جديد في سائر.\nالبريد: ${record.email}\nوقت التسجيل: ${registeredAt}`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8"><h2>تسجيل عميل جديد في سائر</h2><p><b>البريد الإلكتروني:</b> ${escapedEmail}</p><p><b>وقت التسجيل:</b> ${escapeHtml(registeredAt)}</p></div>`,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return json(502, "تعذر إرسال إشعار التسجيل");
    return json(200, "تم إرسال إشعار التسجيل");
  } catch {
    return json(502, "تعذر الوصول إلى خدمة البريد");
  }
}
