import { beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { toast as sonner } from "sonner";
import { clearToasts, dismissToast, finishToastTimer, getToastState, showToast } from "../src/ui/toasts.ts";

let emitted;
let dismissed;
beforeEach((t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  emitted = [];
  dismissed = [];
  for (const tone of ["info", "success", "warning", "error"]) {
    t.mock.method(sonner, tone, (title, options) => { emitted.push({ tone, title, ...options }); return options.id; });
  }
  t.mock.method(sonner, "dismiss", (id) => { dismissed.push(id); return id; });
});
afterEach(async (t) => {
  clearToasts();
  await Promise.resolve();
  assert.deepEqual(getToastState(), { toasts: [], pending: 0 });
  t.mock.restoreAll();
  t.mock.timers.reset();
});

test("separate clicks, even identical ones, create separate Sonner cards", async () => {
  const a = showToast({ title: "Copied" });
  const b = showToast({ title: "Copied" });
  const c = showToast({ title: "Copied" });
  await Promise.resolve();
  assert.equal(new Set([a, b, c]).size, 3);
  assert.equal(emitted.length, 3);
  assert.equal(getToastState().pending, 0);
});

test("a synchronous spam burst renders only the latest three instead of 1000 doomed nodes", async () => {
  for (let i = 0; i < 1000; i++) showToast({ title: `Copy ${i}` });
  await Promise.resolve();
  assert.equal(getToastState().toasts.length, 3);
  assert.deepEqual(emitted.map((t) => t.title), ["Copy 997", "Copy 998", "Copy 999"]);
});

test("clear before dispatch cannot replay staged notices later", async () => {
  showToast({ title: "Will be cleared" });
  clearToasts();
  await Promise.resolve();
  assert.equal(emitted.length, 0);
  assert.equal(getToastState().toasts.length, 0);
});

test("ordinary timing is delegated to Sonner and callbacks release metadata", async () => {
  const id = showToast({ title: "Saved", durationMs: 3200 });
  await Promise.resolve();
  assert.equal(emitted[0].duration, 3200);
  emitted[0].onAutoClose();
  assert.ok(!getToastState().toasts.some((t) => t.id === id));
});

test("clipboard deadlines expire independently of Sonner hover pauses", async (t) => {
  const id = showToast({ title: "Clipboard", timer: true, durationMs: 1000 });
  await Promise.resolve();
  assert.equal(emitted[0].duration, Infinity);
  t.mock.timers.tick(1000);
  assert.equal(getToastState().toasts.length, 0);
  assert.ok(dismissed.includes(id));
});

test("superseded clipboard confirmation loses its deadline and updates the same Sonner card", async (t) => {
  const id = showToast({ key: "copy-email:1", title: "Email copied", timer: true, durationMs: 1000 });
  await Promise.resolve();
  t.mock.timers.tick(800);
  finishToastTimer(id);
  await Promise.resolve();
  assert.equal(emitted.at(-1).id, id);
  assert.equal(emitted.at(-1).duration, 1600);
  assert.equal(emitted.at(-1).description, "Clipboard updated again.");
  t.mock.timers.tick(200);
  assert.ok(getToastState().toasts.some((t) => t.id === id));
});

test("routine spam does not evict an error", async () => {
  const error = showToast({ title: "Failed", tone: "error" });
  for (let i = 0; i < 100; i++) showToast({ title: `Routine ${i}` });
  await Promise.resolve();
  const ids = getToastState().toasts.map((t) => t.id);
  assert.ok(ids.includes(error));
  assert.equal(ids.length, 3);
});

test("manual dismissal invokes Sonner and clears deadline metadata", async (t) => {
  const id = showToast({ title: "Close", timer: true, durationMs: 1000 });
  await Promise.resolve();
  dismissToast(id);
  assert.ok(dismissed.includes(id));
  const count = dismissed.length;
  t.mock.timers.tick(2000);
  assert.equal(dismissed.length, count);
});

