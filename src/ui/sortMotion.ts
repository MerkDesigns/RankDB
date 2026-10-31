import { useLayoutEffect, type RefObject } from "react";

/**
 * The old app's re-sort motion (its TransitionGroup move, 160 ms): when a role sort turns on or off,
 * every row slides from where it was to its new place instead of jumping. Rows that weren't shown
 * before (they were inside a collapsed group) fade in. Only translate and opacity animate.
 */
const MOVE = { duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" } as const;
const FADE = { duration: 140, easing: "ease-out" } as const;

/** Row tops (viewport pixels) just before the re-sort, by account id. */
let before: Map<string, number> | null = null;

const rowsOf = (content: Element) => [...content.querySelectorAll<HTMLElement>(".row[data-account-id]")];

/** Call right before changing the sort. */
export function captureRowPositions() {
  const content = document.querySelector(".list-content");
  if (!content) return;
  before = new Map(rowsOf(content).map((row) => [row.dataset.accountId!, row.getBoundingClientRect().top]));
}

/** Plays the motion after the list re-renders for a new sort (`sortKey`). */
export function useSortMotion(contentRef: RefObject<HTMLElement | null>, sortKey: unknown) {
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
  }, [contentRef, sortKey]);
}
