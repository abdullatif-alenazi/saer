import test from "node:test";
import assert from "node:assert/strict";
import {
  activeSeconds,
  checkpointSession,
  completeTimedRound,
  createTimedSession,
  estimateActivityTime,
  finishSession,
  formatDuration,
  pauseSession,
  removeTimedAmount,
  resumeSession,
  summarizeSession,
  undoTimedRound,
} from "../app/activity-time-engine.ts";

const activity = (overrides = {}) => ({
  id: "dhikr-1",
  name: "الاستغفار",
  template: "ذكر",
  period: "الصباح",
  goal: "",
  expectedMinutes: 0,
  schedule: { mode: "daily", value: "كل يوم" },
  quantity: 1000,
  unit: "ذكر",
  measurements: [],
  ...overrides,
});
const record = (quantity, durationSeconds, completedAt, overrides = {}) => ({
  activityId: "dhikr-1",
  activity: "الاستغفار",
  quantity,
  durationSeconds,
  minutes: durationSeconds / 60,
  quantityUnit: "ذكر",
  completedAt,
  status: "completed",
  ...overrides,
});

test("session clocks count active time, exclude pauses, and finish safely", () => {
  let session = createTimedSession("dhikr-1", "2026-10-13", 0);
  session = checkpointSession(session, 12_000, 12_000, 12_000);
  session = pauseSession(session, 12_000, 12_000, 12_000);
  assert.equal(activeSeconds(session, session.elapsedMs), 12);
  session = resumeSession(session, 60_000);
  session = checkpointSession(session, 20_000, 8_000, 68_000);
  session = finishSession(session, 20_000, 8_000, 68_000);
  assert.equal(session.elapsedMs, 20_000);
  assert.equal(session.status, "finished");
});

test("counter and icon rounds preserve amount and duration, and canceled rounds leave summaries", () => {
  let session = createTimedSession("dhikr-1", "2026-10-13", 0);
  let first = completeTimedRound(session, "morning", 10, 8, "counter", undefined, 8_000);
  session = checkpointSession(first.session, 8_000, 4_000, 12_000);
  let second = completeTimedRound(session, "morning", 100, 4, "units", 2, 16_000);
  session = checkpointSession(second.session, 12_000, 0, 16_000);
  const summary = summarizeSession(session);
  assert.equal(summary.quantity, 110);
  assert.equal(summary.roundCount, 2);
  assert.equal(summary.elapsedSeconds, 12);
  const undone = undoTimedRound(session, first.round.id, 17_000);
  assert.equal(summarizeSession(undone).quantity, 100);
  assert.equal(summarizeSession(undone).elapsedSeconds, 4);
});

test("partial decrement reduces a round without leaving a phantom completed amount", () => {
  const session = checkpointSession(createTimedSession("dhikr-1", "2026-10-13", 0), 30_000, 30_000, 30_000);
  const { session: counted } = completeTimedRound(session, "morning", 100, 30, "counter", undefined, 30_000);
  const less = removeTimedAmount(counted, "morning", 40, 31_000);
  const summary = summarizeSession(less);
  assert.equal(summary.quantity, 60);
  assert.equal(summary.roundCount, 1);
  assert.equal(summary.rounds[0].durationSeconds, 18);
  assert.equal(less.elapsedMs, 18_000);
});

test("predictions use explicit planned time before history and never invent values", () => {
  const unplanned = activity();
  assert.equal(estimateActivityTime(unplanned, []).totalSeconds, null);
  const planned = activity({ expectedMinutes: 15 });
  assert.equal(estimateActivityTime(planned, []).totalSeconds, 900);
  assert.equal(estimateActivityTime(planned, [], 1000, 500).remainingSeconds, 450);
});

test("quantity history predicts proportional remaining time and weights recent sessions", () => {
  const item = activity();
  const one = [record(1000, 900, "2026-10-13T10:00:00Z")];
  assert.equal(estimateActivityTime(item, one, 500, 0).totalSeconds, 450);
  assert.equal(estimateActivityTime(item, one, 1000, 600).remainingSeconds, 360);
  const multiple = [
    record(1000, 1000, "2026-10-13T10:00:00Z"),
    record(1000, 2000, "2026-10-12T10:00:00Z"),
  ];
  const blended = estimateActivityTime(item, multiple, 500, 0).totalSeconds;
  assert.ok(blended > 500 && blended < 1000);
  assert.equal(estimateActivityTime(item, [record(1000, 900, "2026-10-13", { status: "missed" })]).source, null);
});

test("short or extreme samples do not dominate personal pace", () => {
  const item = activity();
  const samples = [
    record(100, 100, "2026-10-13T10:00:00Z"),
    record(100, 110, "2026-10-12T10:00:00Z"),
    record(100, 10_000, "2026-10-11T10:00:00Z"),
    record(1000, 1, "2026-10-10T10:00:00Z"),
  ];
  const estimate = estimateActivityTime(item, samples, 100, 0);
  assert.ok(estimate.totalSeconds > 50 && estimate.totalSeconds < 200);
  assert.equal(formatDuration(90), "1د 30ث");
});

test("single-completion activities learn duration without mixing quantity units", () => {
  const item = activity({ quantity: undefined, unit: undefined, expectedMinutes: 0 });
  const estimate = estimateActivityTime(item, [record(undefined, 720, "2026-10-13T10:00:00Z", { quantityUnit: undefined })]);
  assert.equal(estimate.totalSeconds, 720);
  assert.equal(estimate.remainingSeconds, 720);
});
