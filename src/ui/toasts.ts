import { uiText } from "../text/index";
import { createElement, Fragment, type CSSProperties } from "react";
import { toast as sonner, type ExternalToast } from "sonner";

export type ToastTone = "info" | "success" | "warning" | "error";
export interface ToastOptions {
  /** Event identity retained for callers; each action still creates a separate Sonner card. */
  readonly key?: string;
  readonly tone?: ToastTone;
  readonly title: string;
  readonly message?: string;
  readonly durationMs?: number;
  readonly timer?: boolean;
}
export interface Toast extends ToastOptions {
  readonly id: number;
  readonly tone: ToastTone;
  readonly durationMs: number;
  readonly expiresAt?: number;
}
const DEFAULT_DURATION = { info: 3200, success: 3200, warning: 5000, error: 6500 };
const MAX_ACTIVE = 3;
let nextId = 1;
const active = new Map<number, Toast>();
const staged = new Map<number, Toast>();
const rendered = new Set<number>();
const deadlines = new Map<number, ReturnType<typeof setTimeout>>();
let scheduled = false;

/** Inspection surface for lifecycle tests; Sonner owns rendering, motion and ordinary timers. */
export const getToastState = () => ({ toasts: [...active.values()], pending: 0 });

function forget(id: number) {
  active.delete(id);
  staged.delete(id);
  rendered.delete(id);
  clearTimeout(deadlines.get(id));
  deadlines.delete(id);
}

function render(toast: Toast) {
  const remaining = toast.expiresAt === undefined ? undefined : Math.max(0, toast.expiresAt - Date.now());
  const description = toast.timer ? createElement(Fragment, null,
    toast.message,
    createElement("span", {
      key: toast.expiresAt, className: "sonner-deadline", "aria-hidden": true,
      style: { "--toast-duration": `${toast.durationMs}ms`, animationDelay: `-${toast.durationMs - (remaining ?? 0)}ms` } as CSSProperties,
    }),
  ) : toast.message;
  const options: ExternalToast = {
    id: toast.id, description,
    testId: `toast-${toast.id}`,
    // Real deadlines cannot pause on hover. Ordinary lifetimes are entirely Sonner's responsibility.
    duration: toast.timer ? Infinity : toast.durationMs,
    onDismiss: () => forget(toast.id),
    onAutoClose: () => forget(toast.id),
  };
  sonner[toast.tone](toast.title, options);
  rendered.add(toast.id);
}

function stage(toast: Toast) {
  staged.set(toast.id, toast);
  if (scheduled) return;
  scheduled = true;
  // A synchronous flood publishes only the newest bounded set, never hundreds of doomed DOM nodes.
  queueMicrotask(() => {
    scheduled = false;
    const batch = [...staged.values()];
    staged.clear();
    for (const entry of batch) if (active.get(entry.id) === entry) render(entry);
  });
}

export function showToast(options: ToastOptions): number {
  const id = nextId++;
  const tone = options.tone ?? "info";
  const durationMs = Math.max(250, Number.isFinite(options.durationMs) ? options.durationMs! : DEFAULT_DURATION[tone]);
  const toast: Toast = { ...options, id, tone, durationMs, expiresAt: options.timer ? Date.now() + durationMs : undefined };
  active.set(id, toast);
  // Prefer recent feedback to a queue of stale confirmations. Preserve errors over routine spam.
  while (active.size > MAX_ACTIVE) {
    const entries = [...active.values()];
    const victim = entries.find((entry) => entry.tone !== "error") ?? entries[0]!;
    dismissToast(victim.id);
  }
  if (active.has(id)) {
    if (toast.timer) deadlines.set(id, setTimeout(() => dismissToast(id), durationMs));
    stage(toast);
  }
  return id;
}

export function showError(title: string, error: unknown) {
  return showToast({ tone: "error", title, message: error instanceof Error ? error.message : String(error) });
}
export function dismissToast(id: number) {
  const wasRendered = rendered.has(id);
  forget(id);
  if (wasRendered) sonner.dismiss(id);
}
export function clearToasts() {
  for (const id of [...active.keys()]) forget(id);
  sonner.dismiss();
}
/** A subsequent copy invalidates the previous clipboard deadline, not its confirmation. */
export function finishToastTimer(id: number) {
  const toast = active.get(id);
  if (!toast?.timer) return;
  clearTimeout(deadlines.get(id));
  deadlines.delete(id);
  const next = { ...toast, timer: false, expiresAt: undefined, durationMs: 1600, message: uiText("notifications.clipboardSuperseded") };
  active.set(id, next);
  stage(next);
}

