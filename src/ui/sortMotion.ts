import { useLayoutEffect, type RefObject } from "react";

/**
 * The old app's re-sort motion (its TransitionGroup move, 160 ms): when a column sort turns on or
 * off, or an account or group is deleted, every row slides from where it was to its new place
 * instead of jumping. Rows that weren't shown before (they were inside a collapsed group) fade in.
 * Only translate, scale and opacity animate.
 */
const MOVE = { duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" } as const;
const FADE = { duration: 140, easing: "ease-out" } as const;
/** A deleted account or group head shrinking away before the list closes up. */
const EXIT = { duration: 180, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" } as const;

/** Row tops (viewport pixels) just before the re-sort, by account id. */
let before: Map<string, number> | null = null;

const rowsOf = (content: Element) => [...content.querySelectorAll<HTMLElement>(".row[data-account-id]")];

/** Call right before changing the sort. */
export function captureRowPositions() {
  const content = document.querySelector(".list-content");
  if (!content) return;
  before = new Map(rowsOf(content).map((row) => [row.dataset.accountId!, row.getBoundingClientRect().top]));
}

/**
 * Deletes with motion: the account's row (or, for a group, its head and brackets; its accounts
 * stay) fades and shrinks away, then `remove` runs and the rows below slide up into the gap. Not
 * shown (in a collapsed group, or the list isn't there): removed at once.
 */
export function removeWithMotion(target: { readonly accountId: number } | { readonly groupId: string }, remove: () => void) {
  const content = document.querySelector(".list-content");
  const element =
    "accountId" in target
      ? content?.querySelector(`.row[data-account-id="${target.accountId}"]`)
      : content?.querySelector(`.group[data-group-id="${CSS.escape(target.groupId)}"]`);
  const parts = !element
    ? []
    : "accountId" in target
      ? [element]
      : [
          ...[...element.children].filter((child) => !child.classList.contains("group-body")),
          ...element.querySelectorAll(".group-rule"),
        ];
  const done = () => {
    captureRowPositions();
    remove();
  };
  if (parts.length === 0) return done();
  const exits = parts.map((part) => part.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.96 }], EXIT));
  void Promise.allSettled(exits.map((exit) => exit.finished)).then(done);
}

/** Plays the motion after the list re-renders (`listKey`: a new sort, or a deletion). */
export function useSortMotion(contentRef: RefObject<HTMLElement | null>, listKey: unknown) {
  useLayoutEffect(() => {
    const content = contentRef.current;
    const previous = before;
    before = null;
    if (!content || !previous) return;
    // Rows are in the zoomed app: viewport pixels become content pixels by the UI scale.
    const zoom = content.getBoundingClientRect().height / (content.offsetHeight || 1) || 1;
    const viewport = window.innerHeight;
    for (const row of rowsOf(content)) {
      const top = row.getBoundingClientRect().top;
      const old = previous.get(row.dataset.accountId!);
      const visible = (y: number) => y > -viewport && y < viewport * 2;
      if (old === undefined) {
        if (visible(top)) row.animate([{ opacity: 0 }, { opacity: 1 }], FADE);
        continue;
      }
      const offset = (old - top) / zoom;
      // Nothing to see when it neither starts nor ends near the window.
      if (Math.abs(offset) < 0.5 || (!visible(old) && !visible(top))) continue;
      row.animate([{ translate: `0 ${offset}px` }, { translate: "0 0" }], MOVE);
    }
  }, [contentRef, listKey]);
}
