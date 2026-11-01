import { uiText } from "../text/index";
import { useEffect, useRef, useState } from "react";
import { command } from "../data/backend";
import { ensureCredentialsUnlocked, refreshCredentialSecurity } from "../data/credentialSecurity";
import { reloadRoster } from "../data/rosterStore";
import { flushSettings, reloadSettings } from "../data/settingsStore";
import { dialogs, useOpenDialog } from "./appActions";
import { Button } from "./primitives/Button";
import { Dialog } from "./primitives/Dialog";
import { Field, TextInput } from "./primitives/Field";
import { showError, showToast } from "./toasts";

type Action = "export" | "import" | "legacy";

const PICKERS = { export: "exportBackup", import: "importBackup", legacy: "legacyExport" } as const;
const TITLES = { export: uiText("dataTransfer.titles.export"), import: uiText("dataTransfer.titles.import"), legacy: uiText("dataTransfer.titles.legacy") };

/** Settings → Data: picks the file (Rust's own dialog), then asks for its password here. */
export async function startDataTransfer(action: Action) {
  try {
    const path = await command<string | null>("choose_transfer_file", { file: PICKERS[action] });
    if (path) dialogs.open({ kind: "data-transfer", action, path });
  } catch (error) {
    showError(uiText("dataTransfer.chooseFailed"), error);
  }
}

/**
 * The password (and, for imports, the warning that everything or the accounts get replaced) for a
 * backup or a RankDB 0.3 export. Rust does the work: see src-tauri/src/db/backup.rs.
 */
export function DataTransferDialog() {
  const dialog = useOpenDialog();
  const open = dialog?.kind === "data-transfer";
  // Kept while closed, so the dialog keeps its content as it fades out and after unlocking.
  const last = useRef<{ action: Action; path: string }>({ action: "export", path: "" });
  if (open && (dialog.action !== last.current.action || dialog.path !== last.current.path)) last.current = { action: dialog.action, path: dialog.path };
  const { action, path } = last.current;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef(false);
  useEffect(() => {
    setPassword(""); setConfirm(""); setError("");
  }, [action, path]);
  const fileName = path.split(/[\\/]/).pop() ?? "";
  const invalid = password.length < 1 || (action === "export" && password !== confirm);
  const close = () => { if (!operation.current) dialogs.close(); };
  const submit = async () => {
    if (invalid || operation.current) return;
    operation.current = true; setBusy(true); setError("");
    try {
      if (action === "export") {
        // The backup has the settings as they are on screen.
        await flushSettings();
        await command<void>("export_backup", { path, password });
        dialogs.close();
        showToast({ tone: "success", title: uiText("dataTransfer.exported.title"), message: fileName });
      } else if (action === "import") {
        await flushSettings();
        const summary = await command<{ accounts: number }>("import_backup", { path, password });
        dialogs.close();
        await Promise.all([reloadSettings(), reloadRoster(), refreshCredentialSecurity()]);
        showToast({ tone: "success", title: uiText("dataTransfer.imported.title"), message: uiText("dataTransfer.imported.description", { count: summary.accounts }) });
      } else {
        // The imported credentials are sealed under the master password, if one is set.
        if (!(await ensureCredentialsUnlocked())) return;
        const summary = await command<{ accounts: number }>("import_legacy_export", { path, password });
        dialogs.close();
        await reloadRoster();
        showToast({ tone: "success", title: uiText("dataTransfer.legacyImported.title"), message: uiText("dataTransfer.legacyImported.description", { count: summary.accounts }) });
      }
      setPassword(""); setConfirm("");
    } catch (failure) {
      setError(String(failure));
    } finally { operation.current = false; setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={close} title={TITLES[action]} className="account-dialog credential-security-dialog">
      <p className="dialog-text">
        {action === "export" ? uiText("dataTransfer.descriptions.export")
          : action === "import" ? uiText("dataTransfer.descriptions.import")
          : uiText("dataTransfer.descriptions.legacy")}
      </p>
      <p className="dialog-note">{action === "export" ? uiText("dataTransfer.recoveryWarning") : fileName}</p>
      <form className="dialog-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <Field label={action === "legacy" ? uiText("dataTransfer.password.legacy") : uiText("dataTransfer.password.backup")}>
          <TextInput data-autofocus="" type="password" autoComplete={action === "export" ? "new-password" : "off"} value={password} maxLength={1024} disabled={busy} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        {action === "export" && (
          <Field label={uiText("dataTransfer.password.confirm")} description={confirm && password !== confirm ? uiText("dataTransfer.password.mismatch") : undefined}>
            <TextInput type="password" autoComplete="new-password" value={confirm} maxLength={1024} disabled={busy} onChange={(event) => setConfirm(event.target.value)} />
          </Field>
        )}
        {error && <p className="credential-security-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <Button onClick={close} disabled={busy}>{uiText("common.cancel")}</Button>
          <Button type="submit" variant={action === "export" ? "primary" : "danger"} disabled={invalid || busy}>
            {busy ? (action === "export" ? uiText("dataTransfer.actions.exporting") : uiText("dataTransfer.actions.importing")) : action === "export" ? uiText("dataTransfer.actions.export") : action === "import" ? uiText("dataTransfer.actions.import") : uiText("dataTransfer.actions.legacy")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
