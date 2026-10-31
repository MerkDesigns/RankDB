import { uiText } from "../text/index";
import { useSyncExternalStore } from "react";
import {
  Ban,
  Check,
  FolderClosed,
  FolderMinus,
  Gamepad2,
  IdCard,
  PenLine,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShieldEllipsis,
  Smartphone,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { AccountStatus } from "../data/accounts";
import {
  findAccount,
  getRosterGroups,
  MAX_DODGES,
  moveAccountToGroup,
  setGamesDodged,
  useRoster,
} from "../data/rosterStore";
import { dialogs } from "./appActions";
import { startEditing } from "./editing";
import { ContextMenu, MENU_DIVIDER, type MenuEntry } from "./primitives/ContextMenu";

/* ---------- Which row the menu is open for (UI state) ---------- */

let menu: { readonly accountId: number; readonly x: number; readonly y: number; readonly open: boolean } | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Opens the account menu at the pointer (a right-click on the row). */
export function openAccountMenu(accountId: number, x: number, y: number) {
  menu = { accountId, x, y, open: true };
  emit();
}

function closeAccountMenu() {
  if (!menu?.open) return;
  menu = { ...menu, open: false };
  emit();
}

/** The old app's penalty ladder: the leaver penalty after the next dodge, by dodges so far. */
const NEXT_PENALTY = [uiText("accountMenu.penalties.fifteenMinutes"), uiText("accountMenu.penalties.twoHours"), uiText("accountMenu.penalties.eightHours"), uiText("accountMenu.penalties.twentyHours"), uiText("accountMenu.penalties.seasonBan")] as const;

function nextPenalty(dodged: number): string {
  return NEXT_PENALTY[Math.min(dodged, NEXT_PENALTY.length - 1)]!;
}

export const STATUSES: readonly { readonly value: AccountStatus; readonly label: string; readonly Icon: LucideIcon }[] = [
  { value: "clean", label: uiText("accountMenu.status.clean"), Icon: ShieldCheck },
  { value: "sms", label: uiText("accountMenu.status.sms"), Icon: Smartphone },
  { value: "banned", label: uiText("accountMenu.status.banned"), Icon: Ban },
];

const LAST_EDIT = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Right-click on an account row: the old app's account menu. */
export function AccountMenu() {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => menu,
  );
  // Re-rendered with the roster, so the dodge counter updates while its submenu stays open.
  useRoster();
  if (!current) return null;
  const { accountId } = current;
  const account = findAccount(accountId);
  const dodged = account?.gamesDodged ?? 0;
  const entries: MenuEntry[] = [
    {
      section: uiText("accountMenu.lastEditLabel"),
      value: account?.lastRankChangeAt ? LAST_EDIT.format(new Date(account.lastRankChangeAt)) : uiText("common.never"),
    },
    MENU_DIVIDER,
    { key: "battletag", label: uiText("accountMenu.editBattletag"), Icon: PenLine, onSelect: () => startEditing({ accountId, kind: "name" }) },
    {
      key: "credentials",
      label: uiText("accountMenu.editCredentials"),
      Icon: ShieldEllipsis,
      onSelect: () => dialogs.open({ kind: "credentials", accountId }),
    },
    {
      key: "info",
      label: uiText("accountMenu.accountInfo"),
      Icon: IdCard,
      onSelect: () => dialogs.open({ kind: "account-info", accountId }),
    },
    MENU_DIVIDER,
    {
      key: "dodged",
      label: uiText("accountMenu.dodges.label"),
      Icon: Gamepad2,
      submenu: [
        {
          note: uiText("accountMenu.dodges.penaltyLabel"),
          value: nextPenalty(dodged),
          detail: uiText("accountMenu.dodges.summary", { dodged: dodged }),
          hint: uiText("accountMenu.dodges.help"),
        },
        MENU_DIVIDER,
        {
          key: "dodge",
          label: uiText("accountMenu.dodges.add"),
          Icon: Plus,
          disabled: dodged >= MAX_DODGES,
          keepOpen: true,
          onSelect: () => setGamesDodged(accountId, dodged + 1),
          aside: {
            label: uiText("accountMenu.dodges.reset"),
            Icon: RotateCcw,
            disabled: dodged === 0,
            onSelect: () => setGamesDodged(accountId, 0),
          },
        },
      ],
    },
    {
      key: "move",
      label: uiText("accountMenu.move.label"),
      Icon: FolderClosed,
      // SMS and banned accounts live in their own sections, never in a group.
      disabled: account?.status !== "clean",
      submenu: [
        { section: uiText("accountMenu.move.heading") },
        ...getRosterGroups().map((group) => ({
          key: `group-${group.id}`,
          label: group.name,
          Icon: account?.groupId === group.id ? Check : FolderClosed,
          disabled: account?.groupId === group.id,
          onSelect: () => moveAccountToGroup(accountId, group.id),
        })),
        MENU_DIVIDER,
        {
          key: "no-group",
          label: uiText("accountMenu.removeFromGroup"),
          Icon: FolderMinus,
          tone: "danger" as const,
          disabled: !account?.groupId,
          onSelect: () => moveAccountToGroup(accountId, null),
        },
      ],
    },
    MENU_DIVIDER,
    {
      key: "delete",
      label: uiText("accountMenu.deleteAccount"),
      Icon: Trash2,
      tone: "danger",
      onSelect: () => dialogs.open({ kind: "delete-account", accountId }),
    },
  ];
  return (
    <ContextMenu
      open={current.open}
      x={current.x}
      y={current.y}
      label={uiText("accountMenu.accessibleLabel")}
      entries={entries}
      onClose={closeAccountMenu}
    />
  );
}
