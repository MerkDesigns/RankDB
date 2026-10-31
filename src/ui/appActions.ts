import { uiText } from "../text/index";
import { useSyncExternalStore, type MouseEvent } from "react";
import { Eye, EyeOff, FolderPlus, History, SlidersHorizontal, UserPlus, type LucideIcon } from "lucide-react";
import { addAccount, addGroup, useViewedReset } from "../data/rosterStore";
import { settingsStore, useSettings } from "../data/settingsStore";
import { markNew, startEditing } from "./editing";
import { openResetMenu } from "./ResetMenu";

/* ---------- Which dialog is open (UI state, not saved) ---------- */

/** The open dialog; account dialogs carry the account they are about. */
export type Dialog =
  | { readonly kind: "settings" | "season-reset" | "update" | "whats-new" }
  | { readonly kind: "credentials" | "delete-account" | "account-info"; readonly accountId: number }
  | { readonly kind: "delete-group"; readonly groupId: string }
  | { readonly kind: "credential-security"; readonly action: "enable" | "disable" | "unlock" | "change" }
  | null;

let openDialog: Dialog = null;
export const getOpenDialog = () => openDialog;
const dialogListeners = new Set<() => void>();

export const dialogs = {
  open(dialog: Dialog) {
    openDialog = dialog;
    dialogListeners.forEach((listener) => listener());
  },
  close() {
    dialogs.open(null);
  },
};

export function useOpenDialog(): Dialog {
  return useSyncExternalStore(
    (listener) => {
      dialogListeners.add(listener);
      return () => dialogListeners.delete(listener);
    },
    () => openDialog,
  );
}

/* ---------- App-level actions ---------- */

export interface AppAction {
  readonly key: string;
  readonly title: string;
  readonly Icon: LucideIcon;
  readonly active?: boolean;
  /** Active with the accent's glow (a temporary mode, e.g. viewing past ranks). */
  readonly glow?: boolean;
  readonly onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

/** As in the old app: a placeholder Battletag, a "New" pill, scrolled into view; here it also opens
 * straight into editing its name. */
async function addNewAccount() {
  const account = await addAccount("Battletag#0000");
  if (!account) return;
  markNew(account.id);
  startEditing({ accountId: account.id, kind: "name" });
  requestAnimationFrame(() =>
    document.querySelector(`.row[data-account-id="${account.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
  );
}

/** A new group at the end of the list, opened straight into editing its name. */
async function addNewGroup() {
  const group = await addGroup(uiText("toolbar.groupDefaultName"));
  if (!group) return;
  startEditing({ kind: "group", groupId: group.id });
  requestAnimationFrame(() =>
    document.querySelector(`.group[data-group-id="${group.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
  );
}

/** The header's (or the rail's) action buttons, with live state such as privacy mode. */
export function useAppActions(): readonly AppAction[] {
  const privacyMode = useSettings((settings) => settings.privacyMode);
  const viewedReset = useViewedReset();
  return [
    { key: "add-account", title: uiText("toolbar.addAccount"), Icon: UserPlus, onClick: () => void addNewAccount() },
    { key: "add-group", title: uiText("toolbar.addGroup"), Icon: FolderPlus, onClick: () => void addNewGroup() },
    {
      key: "privacy",
      title: privacyMode ? uiText("toolbar.privacy.disableTooltip") : uiText("toolbar.privacy.enableTooltip"),
      Icon: privacyMode ? EyeOff : Eye,
      active: privacyMode,
      onClick: () => settingsStore.set((settings) => ({ privacyMode: !settings.privacyMode })),
    },
    {
      key: "past-ranks",
      title: viewedReset ? uiText("toolbar.history.activeTooltip") : uiText("toolbar.history.tooltip"),
      Icon: History,
      active: viewedReset !== null,
      glow: viewedReset !== null,
      onClick: (event) => void openResetMenu(event.currentTarget),
    },
    { key: "settings", title: uiText("common.settings"), Icon: SlidersHorizontal, onClick: () => dialogs.open({ kind: "settings" }) },
  ];
}
