import { uiText } from "../text/index";
import { dismissToast, showToast, type ToastOptions } from "../ui/toasts";

export type ToastPreview = "success" | "error" | "countdown" | "stack" | "burst";
const previews = new Set<number>();

/** Clears only lab examples; actual notices are left alone. */
export function clearToastPreviews() {
  previews.forEach(dismissToast);
  previews.clear();
}

/** Real Sonner cards, real spam handling, and no account/clipboard side effects. */
export function previewToasts(kind: ToastPreview): readonly number[] {
  clearToastPreviews();
  const add = (options: ToastOptions) => {
    const id = showToast({ durationMs: 15_000, ...options });
    previews.add(id);
    return id;
  };
  const success = () => add({ tone: "success", title: uiText("toastPreview.success.title"), message: uiText("toastPreview.success.description") });
  const error = () => add({ tone: "error", title: uiText("toastPreview.error.title"), message: uiText("toastPreview.error.description") });
  const countdown = () => add({
    tone: "info", title: uiText("toastPreview.countdown.title"), message: uiText("toastPreview.countdown.description"), timer: true,
  });
  if (kind === "success") success();
  else if (kind === "error") error();
  else if (kind === "countdown") countdown();
  else if (kind === "stack") { success(); error(); countdown(); }
  else for (let index = 1; index <= 20; index++) add({ tone: "info", title: uiText("toastPreview.burst.title", { index: index }), message: uiText("toastPreview.burst.description") });
  return [...previews];
}
