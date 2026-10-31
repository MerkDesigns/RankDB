import { uiText } from "../text/index";
import { invoke } from "@tauri-apps/api/core";
import { command } from "./backend";
import { finishToastTimer, showError, showToast, type ToastOptions } from "../ui/toasts";
import type { Account } from "./accounts";
import { isSavedData } from "./rosterStore";
import { settingsStore } from "./settingsStore";
import { ensureCredentialsUnlocked } from "./credentialSecurity";

/**
 * Copy buttons. Emails and passwords are copied by Rust straight from the database: they never
 * pass through the page, stay out of Windows clipboard history, and are cleared after the
 * clipboard timer (Settings) unless something else was copied since.
 */

const FIELD_LABELS = { email: uiText("common.email"), password: uiText("common.password") } as const;

let lastCopy: number | null = null;
function notifyCopied(options: ToastOptions & { key: string }) {
  // Keep separate actions visible. Only the newest copied secret still owns a live countdown.
  const id = showToast(options);
  if (lastCopy !== null && lastCopy !== id) finishToastTimer(lastCopy);
  lastCopy = id;
}

export async function copySecret(account: Account, field: "email" | "password") {
  if (!isSavedData()) {
    showToast({ title: uiText("clipboard.dummy.title"), message: uiText("clipboard.dummy.description") });
    return;
  }
  const saved = field === "email" ? account.hasEmail : account.hasPassword;
  if (!saved) {
    showToast({ tone: "warning", title: uiText("clipboard.missingCredential.title", { field: FIELD_LABELS[field].toLocaleLowerCase() }), message: uiText("clipboard.missingCredential.description") });
    return;
  }
  const seconds = settingsStore.get().clipboardClearSeconds;
  try {
    if (!(await ensureCredentialsUnlocked())) return;
    await command("copy_secret", { accountId: account.id, field, clearAfterSeconds: seconds });
  } catch (error) {
    showError(uiText("clipboard.secretCopyFailed", { field: FIELD_LABELS[field].toLocaleLowerCase() }), error);
    return;
  }
  notifyCopied(
    seconds === null
      ? { key: `copy-${field}:${account.id}`, tone: "success", title: uiText("clipboard.copied", { field: FIELD_LABELS[field] }), message: uiText("clipboard.autoClearDisabled") }
      : {
          tone: "success",
          key: `copy-${field}:${account.id}`,
          title: uiText("clipboard.copied", { field: FIELD_LABELS[field] }),
          message: uiText("clipboard.clearCountdown", { seconds: seconds }),
          durationMs: seconds * 1000,
          timer: true,
        },
  );
}

export async function copyBattletag(account: Account) {
  try {
    await invoke("copy_text", { text: account.name });
    // Privacy mode is for streaming: the toast doesn't reveal the name either.
    const { privacyMode } = settingsStore.get();
    notifyCopied({ key: `copy-battletag:${account.id}`, tone: "success", title: uiText("clipboard.battletagCopied"), message: privacyMode ? undefined : account.name });
  } catch (error) {
    showError(uiText("clipboard.battletagCopyFailed"), error);
  }
}
