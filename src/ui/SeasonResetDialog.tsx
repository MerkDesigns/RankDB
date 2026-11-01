import { uiText } from "../text/index";
import { getViewedReset, isSavedData, seasonReset, undoSeasonReset, viewSeasonReset } from "../data/rosterStore";
import { dialogs, useOpenDialog } from "./appActions";
import { Button } from "./primitives/Button";
import { Dialog } from "./primitives/Dialog";
import { showToast } from "./toasts";

/**
 * Season reset (Settings → Data): every rank of every account back to Unranked, the old ranks kept
 * as Past ranks in each account's info. Notifications only confirm completion.
 */
export function SeasonResetDialog() {
  const open = useOpenDialog()?.kind === "season-reset";
  const reset = async () => {
    dialogs.close();
    if (!isSavedData()) {
      showToast({ title: uiText("seasonReset.dummy.title"), message: uiText("seasonReset.dummy.description") });
      return;
    }
    const result = await seasonReset();
    if (!result) return;
    showToast({
      tone: "success",
      title: uiText("seasonReset.success.title"),
      message: uiText("seasonReset.success.description", { cleared: result.cleared, rankWord: result.cleared === 1 ? uiText("seasonReset.count.singular") : uiText("seasonReset.count.plural") }),
    });
  };
  return (
    <Dialog open={open} onClose={dialogs.close} title={uiText("seasonReset.title")} className="account-dialog">
      <p className="dialog-text">{uiText("seasonReset.description")}</p>
      <div className="dialog-actions">
        <Button data-autofocus="" onClick={dialogs.close}>{uiText("common.cancel")}</Button>
        <Button variant="danger" onClick={() => void reset()}>{uiText("seasonReset.confirm")}</Button>
      </div>
    </Dialog>
  );
}

/**
 * Undoing the newest season reset (Past ranks menu) asks first: its ranks come back wherever a slot
 * is still Unranked (ranks set since stay), and it leaves Past ranks.
 */
export function UndoSeasonResetDialog() {
  const dialog = useOpenDialog();
  const open = dialog?.kind === "undo-season-reset";
  const resetAt = open ? dialog.resetAt : null;
  const undo = async () => {
    dialogs.close();
    if (!resetAt) return;
    if (getViewedReset() === resetAt) await viewSeasonReset(null);
    if (await undoSeasonReset(resetAt)) showToast({ tone: "success", title: uiText("pastRanks.undone") });
  };
  return (
    <Dialog open={open} onClose={dialogs.close} title={uiText("pastRanks.undoDialog.title")} className="account-dialog">
      <p className="dialog-text">{uiText("pastRanks.undoDialog.description")}</p>
      <div className="dialog-actions">
        <Button data-autofocus="" onClick={dialogs.close}>{uiText("common.cancel")}</Button>
        <Button variant="danger" onClick={() => void undo()}>{uiText("pastRanks.undoDialog.confirm")}</Button>
      </div>
    </Dialog>
  );
}
