import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/signup-notification/route.ts";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const validSecret = "a".repeat(48);
const validPayload = {
  type: "INSERT",
  schema: "auth",
  table: "users",
  record: {
    id: "123e4567-e89b-12d3-a456-426614174000",
    email: "new@example.com",
    created_at: "2026-10-16T12:00:00.000Z",
  },
};

function configureEnvironment() {
  process.env.SAER_SIGNUP_WEBHOOK_SECRET = validSecret;
  process.env.RESEND_API_KEY = "test-api-key";
  process.env.SAER_SIGNUP_NOTIFICATION_EMAIL = "owner@example.com";
  process.env.SAER_SIGNUP_FROM_EMAIL = "Saer <notify@example.com>";
}

function request(payload = validPayload, secret = validSecret) {
  return new Request("https://saer-dun.vercel.app/api/signup-notification", {
    method: "POST",
    headers: { "content-type": "application/json", "x-saer-webhook-secret": secret },
    body: JSON.stringify(payload),
  });
}

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  globalThis.fetch = originalFetch;
});

test("signup notification rejects requests without the shared secret", async () => {
  configureEnvironment();
  const response = await POST(request(validPayload, "wrong-secret"));
  assert.equal(response.status, 401);
});

test("signup notification rejects events outside auth.users inserts", async () => {
  configureEnvironment();
  const response = await POST(request({ ...validPayload, table: "profiles" }));
  assert.equal(response.status, 400);
});

test("signup notification sends one Arabic email with a signup idempotency key", async () => {
  configureEnvironment();
  let sentRequest;
  globalThis.fetch = async (url, options) => {
    sentRequest = { url, ...options };
    return Response.json({ id: "email-id" }, { status: 200 });
  };

  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.equal(sentRequest.url, "https://api.resend.com/emails");
  assert.equal(sentRequest.headers["Idempotency-Key"], `saer-new-signup-${validPayload.record.id}`);
  const body = JSON.parse(sentRequest.body);
  assert.deepEqual(body.to, ["owner@example.com"]);
  assert.match(body.subject, /تسجيل عميل جديد/);
  assert.match(body.text, /new@example.com/);
});
