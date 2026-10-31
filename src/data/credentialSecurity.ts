import { uiText } from "../text/index";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useSyncExternalStore } from "react";
import { dialogs, getOpenDialog, type Dialog } from "../ui/appActions";
import { showError } from "../ui/toasts";

export interface CredentialSecurity {
  readonly mode: "plain" | "password";
  readonly locked: boolean;
}
let state: CredentialSecurity | null = null;
let loading: Promise<CredentialSecurity> | null = null;
let revision = 0;
const listeners = new Set<() => void>();
let resume: Dialog = null;
let waiters: ((success: boolean) => void)[] = [];

export function publishCredentialSecurity(next: CredentialSecurity) {
  revision++;
  state = next;
  listeners.forEach((listener) => listener());
}
export function refreshCredentialSecurity(): Promise<CredentialSecurity> {
  if (!loading) {
    const started = revision;
    loading = invoke<CredentialSecurity>("credential_security_status")
      .then((next) => {
        // An explicit lock/unlock/configure result supersedes older in-flight status reads.
        if (started === revision) publishCredentialSecurity(next);
        return state ?? next;
      })
      .finally(() => { loading = null; });
  }
  return loading;
}
export function useCredentialSecurity() {
  const status = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => state,
  );
  useEffect(() => { void refreshCredentialSecurity().catch((error) => showError(uiText("credentialSecurity.errors.statusFailed"), error)); }, []);
  return status;
}
export function openCredentialSecurity(action: "enable" | "disable" | "unlock" | "change") {
  if (getOpenDialog()?.kind !== "credential-security") resume = getOpenDialog();
  dialogs.open({ kind: "credential-security", action });
}
export function finishCredentialSecurity(success: boolean) {
  const destination = !success && resume?.kind === "credentials" ? null : resume;
  resume = null;
  dialogs.open(destination);
  const pending = waiters;
  waiters = [];
  pending.forEach((resolve) => resolve(success));
}
/** Only credential operations ask for a master password; account management remains available. */
export async function ensureCredentialsUnlocked(): Promise<boolean> {
  try {
    const status = await refreshCredentialSecurity();
    if (!status.locked) return true;
    return await new Promise<boolean>((resolve) => {
      waiters.push(resolve);
      if (getOpenDialog()?.kind !== "credential-security") openCredentialSecurity("unlock");
    });
  } catch (error) {
    showError(uiText("credentialSecurity.errors.unlockFailed"), error);
    return false;
  }
}
export async function lockCredentials() {
  publishCredentialSecurity(await invoke<CredentialSecurity>("lock_credentials"));
}

