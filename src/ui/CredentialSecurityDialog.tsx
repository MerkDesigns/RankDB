import { uiText } from "../text/index";
import { invoke } from "@tauri-apps/api/core";
import { command } from "../data/backend";
import { useEffect, useRef, useState } from "react";
import { finishCredentialSecurity, publishCredentialSecurity, refreshCredentialSecurity, useCredentialSecurity, type CredentialSecurity } from "../data/credentialSecurity";
import { useOpenDialog } from "./appActions";
import { Button } from "./primitives/Button";
import { Dialog } from "./primitives/Dialog";
import { Field, TextInput } from "./primitives/Field";
import { showToast } from "./toasts";

const TITLES = { enable: uiText("credentialSecurity.titles.enable"), disable: uiText("credentialSecurity.titles.disable"), unlock: uiText("credentialSecurity.titles.unlock"), change: uiText("credentialSecurity.titles.changePassword") };
export function CredentialSecurityDialog() {
  const dialog = useOpenDialog();
  const open = dialog?.kind === "credential-security";
  const lastAction = useRef<keyof typeof TITLES>("unlock");
  if (open) lastAction.current = dialog.action;
  const action = lastAction.current;
  const status = useCredentialSecurity();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef(false);
  useEffect(() => {
    setCurrent(""); setPassword(""); setConfirm(""); setError("");
  }, [open, action]);
  const needsNew = action === "enable" || action === "change";
  const needsCurrent = action === "unlock" || action === "change" || (action === "disable" && status?.mode === "password");
  const invalid = (needsNew && (password.length < 8 || password !== confirm)) || (needsCurrent && !current);
  const close = () => { if (!operation.current) finishCredentialSecurity(false); };
  const submit = async () => {
    if (invalid || operation.current) return;
    operation.current = true; setBusy(true); setError("");
    try {
      // Unlocking only touches the key, so it doesn't wait behind (or hold up) account saves.
      const next = action === "unlock"
        ? await invoke<CredentialSecurity>("unlock_credentials", { password: current })
        : await command<CredentialSecurity>(action === "change" ? "change_master_password" : "configure_credential_encryption", {
          enabled: action === "enable", password, currentPassword: current,
        });
      publishCredentialSecurity(next);
      setCurrent(""); setPassword(""); setConfirm("");
      finishCredentialSecurity(true);
      showToast({ tone: "success", title: action === "unlock" ? uiText("credentialSecurity.success.unlocked") : action === "disable" ? uiText("credentialSecurity.success.disabled") : action === "change" ? uiText("credentialSecurity.success.passwordChanged") : uiText("credentialSecurity.success.enabled") });
    } catch (failure) {
      setError(String(failure));
      void refreshCredentialSecurity().catch(() => {});
    } finally { operation.current = false; setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={close} title={TITLES[action]} className="account-dialog credential-security-dialog">
      <p className="dialog-text">
        {action === "enable" ? uiText("credentialSecurity.descriptions.enable")
          : action === "disable" ? uiText("credentialSecurity.descriptions.disable")
          : action === "change" ? uiText("credentialSecurity.descriptions.changePassword")
          : uiText("credentialSecurity.descriptions.unlock")}
      </p>
      {needsNew && <p className="dialog-note">{uiText("credentialSecurity.password.recoveryWarning")}</p>}
      <form className="dialog-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        {needsCurrent && <Field label={action === "unlock" ? uiText("credentialSecurity.password.label") : uiText("credentialSecurity.password.currentLabel")}>
          <TextInput data-autofocus="" type="password" autoComplete="off" value={current} maxLength={1024} disabled={busy} onChange={(event) => setCurrent(event.target.value)} />
        </Field>}
        {needsNew && <>
          <Field label={uiText("credentialSecurity.password.newLabel")} description={uiText("credentialSecurity.password.hint")}>
            <TextInput data-autofocus={!needsCurrent ? "" : undefined} type="password" autoComplete="new-password" value={password} maxLength={1024} disabled={busy} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Field label={uiText("credentialSecurity.password.confirmLabel")} description={confirm && password !== confirm ? uiText("credentialSecurity.password.mismatch") : undefined}>
            <TextInput type="password" autoComplete="new-password" value={confirm} maxLength={1024} disabled={busy} onChange={(event) => setConfirm(event.target.value)} />
          </Field>
        </>}
        {error && <p className="credential-security-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <Button onClick={close} disabled={busy}>{uiText("common.cancel")}</Button>
          <Button type="submit" variant={action === "disable" ? "danger" : "primary"} disabled={invalid || busy}>
            {busy ? uiText("credentialSecurity.actions.busy") : action === "unlock" ? uiText("credentialSecurity.actions.unlock") : action === "disable" ? uiText("credentialSecurity.titles.disable") : action === "change" ? uiText("credentialSecurity.actions.changePassword") : uiText("credentialSecurity.actions.enable")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
