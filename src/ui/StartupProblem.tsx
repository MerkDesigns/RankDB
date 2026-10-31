import { uiText } from "../text/index";
import { invoke } from "@tauri-apps/api/core";
import { windowActions } from "../platform/window";
import { Button } from "./primitives/Button";
import { Dialog } from "./primitives/Dialog";
import { showError } from "./toasts";

/**
 * Shown instead of the app when the database can't be opened (damaged, saved by a newer version,
 * an upgrade that failed). Nothing has been changed; the data folder holds the file and the
 * copies taken before each upgrade.
 */
export function StartupProblem({ problem }: { readonly problem: string }) {
  return (
    <Dialog open onClose={() => {}} dismissible={false} title={uiText("startupProblem.title")} className="account-dialog startup-problem">
      <p className="credential-security-error" role="alert">{problem}</p>
      <p className="dialog-note">{uiText("startupProblem.description")}</p>
      <div className="dialog-actions">
        <Button onClick={() => invoke("open_data_folder").catch((error: unknown) => showError(uiText("errors.main.folderOpenFailed"), error))}>
          {uiText("startupProblem.actions.openFolder")}
        </Button>
        <Button variant="primary" data-autofocus="" onClick={() => void windowActions.close()}>
          {uiText("startupProblem.actions.exit")}
        </Button>
      </div>
    </Dialog>
  );
}
