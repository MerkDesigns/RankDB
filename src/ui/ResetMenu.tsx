import { uiText } from "../text/index";
import { useSyncExternalStore } from "react";
import { Check, History, Undo2 } from "lucide-react";
import { getViewedReset, listSeasonResets, undoSeasonReset, useViewedReset, viewSeasonReset } from "../data/rosterStore";
import { ContextMenu, MENU_DIVIDER, type MenuEntry } from "./primitives/ContextMenu";
import { showToast } from "./toasts";

/* ---------- The toolbar's past-ranks menu (UI state; the choice is never saved) ---------- */

let menu: { readonly x: number; readonly y: number; readonly open: boolean; readonly resets: readonly string[] } | null =
  null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Opens below the toolbar button, listing every season reset. */
export async function openResetMenu(button: HTMLElement) {
  const rect = button.getBoundingClientRect();
  const resets = await listSeasonResets();
  menu = { x: rect.left, y: rect.bottom + 6, open: true, resets };
  emit();
}

function closeResetMenu() {
  if (!menu?.open) return;
  menu = { ...menu, open: false };
  emit();
}

const DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * Undoes the newest season reset: its ranks come back wherever a slot is still Unranked (ranks set
 * since stay), and it leaves Past ranks.
 */
async function undoReset(resetAt: string) {
  closeResetMenu();
  if (getViewedReset() === resetAt) await viewSeasonReset(null);
  if (await undoSeasonReset(resetAt)) showToast({ tone: "success", title: uiText("pastRanks.undone") });
}

/** Picks whose ranks the list shows: today's, or those a past season reset cleared. */
export function ResetMenu() {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => menu,
  );
  const viewed = useViewedReset();
  if (!current) return null;
  const entries: MenuEntry[] = [
    {
      key: "current",
      label: uiText("pastRanks.currentRanks"),
      Icon: viewed === null ? Check : History,
      disabled: viewed === null,
      onSelect: () => void viewSeasonReset(null),
    },
    MENU_DIVIDER,
    { section: uiText("pastRanks.heading") },
    ...(current.resets.length === 0
      ? [{ note: uiText("pastRanks.empty"), value: "" }]
      : current.resets.map((resetAt, index) => ({
          key: resetAt,
          label: DATE.format(new Date(resetAt)),
          Icon: viewed === resetAt ? Check : History,
          disabled: viewed === resetAt,
          onSelect: () => void viewSeasonReset(resetAt),
          // Only the newest: undoing an older one under a newer reset would mix two seasons.
          ...(index === 0 ? { aside: { label: uiText("pastRanks.undo"), Icon: Undo2, onSelect: () => void undoReset(resetAt) } } : {}),
        }))),
  ];
  return (
    <ContextMenu
      open={current.open}
      x={current.x}
      y={current.y}
      label={uiText("pastRanks.accessibleLabel")}
      entries={entries}
      onClose={closeResetMenu}
    />
  );
}
