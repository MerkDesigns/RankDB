import { uiText } from "../text/index";
import { useRef, useSyncExternalStore } from "react";
import { PenLine, Trash2 } from "lucide-react";
import { deleteGroup, findGroup } from "../data/rosterStore";
import { dialogs, useOpenDialog } from "./appActions";
import { startEditing } from "./editing";
import { Button } from "./primitives/Button";
import { ContextMenu, MENU_DIVIDER, type MenuEntry } from "./primitives/ContextMenu";
import { Dialog } from "./primitives/Dialog";
import { showToast } from "./toasts";

/* ---------- Which group the menu is open for (UI state) ---------- */

let menu: { readonly groupId: string; readonly x: number; readonly y: number; readonly open: boolean } | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Opens the group menu at a point (right-click on the group head, or its ⋮ button). */
export function openGroupMenu(groupId: string, x: number, y: number) {
  menu = { groupId, x, y, open: true };
  emit();
}

function closeGroupMenu() {
  if (!menu?.open) return;
  menu = { ...menu, open: false };
  emit();
}

export function GroupMenu() {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => menu,
  );
  if (!current) return null;
  const { groupId } = current;
  const entries: MenuEntry[] = [
    { key: "rename", label: uiText("groupMenu.renameGroup"), Icon: PenLine, onSelect: () => startEditing({ kind: "group", groupId }) },
    MENU_DIVIDER,
    {
      key: "delete",
      label: uiText("groupMenu.delete.title"),
      Icon: Trash2,
      tone: "danger",
      onSelect: () => dialogs.open({ kind: "delete-group", groupId }),
    },
  ];
  return (
    <ContextMenu
      open={current.open}
      x={current.x}
      y={current.y}
      label={uiText("groupMenu.accessibleLabel")}
      entries={entries}
      onClose={closeGroupMenu}
    />
  );
}

/** Deleting a group keeps its accounts: they become loose accounts where the group was. */
export function DeleteGroupDialog() {
  const dialog = useOpenDialog();
  const open = dialog?.kind === "delete-group";
  const groupId = useRef<string | null>(null);
  if (open) groupId.current = dialog.groupId;
  const name = groupId.current ? (findGroup(groupId.current)?.name ?? "") : "";
  return (
    <Dialog open={open} onClose={dialogs.close} title={uiText("groupMenu.delete.title")} className="account-dialog">
      <p className="dialog-text">
        {uiText("groupMenu.delete.promptPrefix")}<strong>{name}</strong>{uiText("groupMenu.delete.promptSuffix")}
        <br />
        {uiText("groupMenu.delete.description")}
      </p>
      <div className="dialog-actions">
        <Button data-autofocus="" onClick={dialogs.close}>{uiText("common.cancel")}</Button>
        <Button
          variant="danger"
          onClick={() => {
            if (groupId.current) deleteGroup(groupId.current);
            showToast({ tone: "success", title: uiText("groupMenu.delete.success"), message: name });
            dialogs.close();
          }}
        >{uiText("common.delete")}</Button>
      </div>
    </Dialog>
  );
}
