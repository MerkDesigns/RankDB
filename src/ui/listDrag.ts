import { useEffect, type RefObject } from "react";
import type { AccountStatus } from "../data/accounts";
import {
  containerItems,
  findAccount,
  getRoleSort,
  moveItem,
  setGroupCollapsed,
  type Destination,
  type ListItem,
} from "../data/rosterStore";

/**
 * Drag to reorder, ported from TaskMap's canvas browser (src/ui/patterns/workspace/
 * CanvasBrowserRuntime.ts and its helpers), extended to RankDB's groups:
 *
 * - Past 6 px the pressed row (or a group, by its head) lifts to 1.06× and follows the pointer,
 *   keeping the spot it was grabbed by. A group collapses as it lifts (the list below glides up)
 *   and stays collapsed where it lands (Escape restores it).
 * - Live reorder: everything else in the list slides one slot out of the way (190 ms, easeOutQuart)
 *   to open the real gap where the item lands; the gap follows the item's top.
 * - The neighbours spread a little around the enlarged item so its gaps stay even; the first and
 *   last items stay put (TaskMap's held spread).
 * - Rows travel through groups: past a group's head the gap opens inside it, past its last row
 *   back outside. A collapsed group takes a row that hovers its head for a moment (the head
 *   lights up), so passing over it doesn't drop into it.
 *   Groups move among the top level; SMS and banned rows within their own section.
 * - TaskMap's auto-scroll near the list's top and bottom edges.
 * - Drop: the item glides into the gap and settles back to its size, then the order is saved.
 *   Escape (or a cancelled pointer) glides everything back. Off while a role sort is on.
 *
 * Everything moves by `translate`/`scale` on the existing elements; React re-renders only once,
 * with the new order, after the drop.
 */

const DRAG_THRESHOLD = 6;
const SLOT_MS = 190;
const HELD_SCALE = 1.06;
/** How long a row hovers a collapsed group's head before it would go in. */
const INTO_DELAY_MS = 350;
const AUTO_SCROLL = { startInset: 52, outsideRatio: 0.2, minOutside: 96, maxOutside: 180, maxSpeed: 16 } as const;

/** Presses on these never start a drag. */
const INTERACTIVE = "button, input, textarea, select, a, .badge";

/** One element of the list that moves as a unit while dragging (content pixels, unscaled). */
interface Piece {
  readonly element: HTMLElement;
  readonly top: number;
  readonly bottom: number;
}

/** A place the item can land: before pieces[index] (pieces.length: after the last). */
interface Slot {
  readonly index: number;
  readonly destination: Destination;
  /** The item it lands before; null: the container's end. */
  readonly before: ListItem | null;
}

/** A collapsed group's head: hovering it puts a row at that group's end (no gap opens). */
interface Into {
  readonly element: HTMLElement;
  readonly top: number;
  readonly bottom: number;
  readonly destination: Destination;
}

interface Layout {
  readonly pieces: readonly Piece[];
  readonly slots: readonly Slot[];
  readonly into: readonly Into[];
  /** Index of the dragged piece. */
  readonly origin: number;
  /** Space the item takes in the list: its height plus the gap after it. */
  readonly step: number;
}

export function useListDrag(contentRef: RefObject<HTMLElement | null>, scrollerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const content = contentRef.current;
    const scroller = scrollerRef.current;
    if (!content || !scroller) return;
    let active = false;

    const onPointerDown = (down: PointerEvent) => {
      if (active || down.button !== 0 || getRoleSort()) return;
      const target = down.target as HTMLElement;
      if (target.closest(INTERACTIVE)) return;
      const head = target.closest<HTMLElement>(".group-head");
      const element = head ? head.closest<HTMLElement>(".group") : target.closest<HTMLElement>(".row");
      if (!element || !content.contains(element)) return;
      const item = itemOf(element);
      const status = item.kind === "account" ? (findAccount(item.id)?.status ?? "clean") : "clean";
      active = true;
      runDrag(content, scroller, down, element, item, status, () => (active = false));
    };

    content.addEventListener("pointerdown", onPointerDown);
    return () => content.removeEventListener("pointerdown", onPointerDown);
  }, [contentRef, scrollerRef]);
}

function runDrag(
  content: HTMLElement,
  scroller: HTMLElement,
  down: PointerEvent,
  element: HTMLElement,
  item: ListItem,
  status: AccountStatus,
  done: () => void,
) {
  let layout: Layout | null = null;
  let slot: Slot | null = null;
  let into: Into | null = null;
  /** A collapsed group's head being hovered, and since when (it takes over after the delay). */
  let hovering: { readonly target: Into; readonly since: number } | null = null;
  let spreadAt = -1;
  let pointerY = down.clientY;
  let lastTime = 0;
  let frame = 0;
  let finishing = false;
  const startScroll = scroller.scrollTop;
  const zoom = () => {
    const height = content.offsetHeight;
    return height ? content.getBoundingClientRect().height / height : 1;
  };

  /** The item's offset from its own place, in content pixels (pointer and scroll). */
  const heldOffset = () => {
    const box = scroller.getBoundingClientRect();
    // As in TaskMap, the pointer counts as inside the list while dragging past its edges.
    const clamped = Math.min(box.bottom, Math.max(box.top, pointerY));
    return (clamped - down.clientY) / zoom() + (scroller.scrollTop - startScroll);
  };

  const begin = () => {
    const collapse = item.kind === "group" && !element.querySelector(".group-toggle[data-collapsed]");
    const before = collapse ? topLevel(content).map((child) => child.getBoundingClientRect().top) : [];
    if (collapse) element.dataset.dragCollapsed = "";
    // Measured collapsed and untransformed: the layout the drag works in.
    layout = measure(content, element, item, status, zoom());
    if (collapse) {
      // FLIP: everything below starts where it was and glides up as the gap logic takes over.
      const scale = zoom();
      topLevel(content).forEach((child, index) => {
        const delta = ((before[index] ?? 0) - child.getBoundingClientRect().top) / scale;
        if (Math.abs(delta) < 0.5) return;
        child.style.transition = "none";
        child.style.translate = `0 ${delta}px`;
      });
      content.getBoundingClientRect();
      topLevel(content).forEach((child) => (child.style.transition = ""));
    }
    content.dataset.reordering = "";
    element.dataset.held = "";
    element.style.scale = String(HELD_SCALE);
    try {
      element.setPointerCapture(down.pointerId);
    } catch {
      // Window listeners still follow the pointer.
    }
    frame = requestAnimationFrame(tick);
  };

  /** Opens the gap at the slot nearest the item's top, or lights a collapsed group's head. */
  const update = () => {
    if (!layout) return;
    const offset = heldOffset();
    element.style.translate = `0 ${offset}px`;
    const origin = layout.pieces[layout.origin]!;
    const top = origin.top + offset;
    const centre = top + (origin.bottom - origin.top) / 2;
    const hovered = layout.into.find((entry) => centre >= entry.top && centre <= entry.bottom) ?? null;
    if (hovered !== hovering?.target) hovering = hovered ? { target: hovered, since: performance.now() } : null;
    const nextInto = hovering && performance.now() - hovering.since >= INTO_DELAY_MS ? hovering.target : null;
    if (nextInto !== into) {
      into?.element.removeAttribute("data-drop-target");
      nextInto?.element.setAttribute("data-drop-target", "");
      into = nextInto;
    }
    // While a collapsed group takes the row, the list closes the gap (the row goes inside it).
    const nextSlot = into ? null : nearestSlot(layout, top);
    const gapAt = nextSlot?.index ?? layout.origin;
    if (nextSlot !== slot || gapAt !== spreadAt) {
      slot = nextSlot;
      spreadAt = gapAt;
      shift(layout, gapAt, true);
    }
  };

  const tick = (time: number) => {
    const delta = lastTime ? Math.min(50, time - lastTime) : 16;
    lastTime = time;
    const speed = autoScrollSpeed(pointerY, scroller.getBoundingClientRect());
    if (speed) scroller.scrollTop += (speed * delta) / 16.67;
    update();
    frame = requestAnimationFrame(tick);
  };

  const finish = (commit: boolean) => {
    if (finishing) return;
    finishing = true;
    removeListeners();
    if (!layout) {
      done();
      return;
    }
    cancelAnimationFrame(frame);
    const drop = commit ? (into ? { destination: into.destination, before: null } : slot) : null;
    // The item glides into its gap (or home) and settles to its size, on the slot timing.
    const target = commit && slot ? landingOffset(layout, slot.index) : 0;
    // Neighbours close the spread (and, on cancel, the gap) while the item settles.
    shift(layout, drop && slot && !into ? slot.index : layout.origin, false);
    element.dataset.settling = "";
    element.style.translate = `0 ${commit && !into && slot ? target : 0}px`;
    element.style.scale = "1";
    // Into a collapsed group: the row shrinks away into its head instead.
    if (commit && into) {
      element.style.scale = "0.9";
      element.style.opacity = "0";
    }
    window.setTimeout(() => {
      into?.element.removeAttribute("data-drop-target");
      // A moved group stays collapsed (saved, like its arrow). Sent before the move, so the
      // roster the move returns already has it collapsed.
      if (drop && item.kind === "group" && element.dataset.dragCollapsed !== undefined) setGroupCollapsed(item.id, true);
      if (drop) commitDrop(item, drop.destination, drop.before);
      // React re-renders with the new order before the next paint; the transforms go now.
      for (const piece of layout!.pieces) piece.element.style.translate = "";
      element.style.translate = "";
      element.style.scale = "";
      element.style.opacity = "";
      delete element.dataset.dragCollapsed;
      delete element.dataset.held;
      delete element.dataset.settling;
      delete content.dataset.reordering;
      done();
    }, SLOT_MS);
    // The click that ends a drag must not reach whatever is under the pointer.
    window.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
  };

  const onMove = (move: PointerEvent) => {
    if (move.pointerId !== down.pointerId) return;
    pointerY = move.clientY;
    if (!layout) {
      // TaskMap: vertical travel decides.
      if (Math.abs(move.clientY - down.clientY) < DRAG_THRESHOLD) return;
      begin();
    }
    move.preventDefault();
    update();
  };
  const onUp = (up: PointerEvent) => up.pointerId === down.pointerId && finish(true);
  const onCancel = (cancel: PointerEvent) => cancel.pointerId === down.pointerId && finish(false);
  const onKey = (key: KeyboardEvent) => {
    if (key.key !== "Escape" || !layout) return;
    key.preventDefault();
    key.stopPropagation();
    finish(false);
  };
  const removeListeners = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey, true);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKey, true);
}

function swallow(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

/* ---------- Geometry ---------- */

/** The list's top-level elements (rows, groups, the section dividers and their rows), in order. */
const topLevel = (content: HTMLElement) =>
  [...content.children].filter((child): child is HTMLElement => child.matches(".row, .group, .section-divider"));

const itemOf = (element: HTMLElement): ListItem =>
  element.classList.contains("group")
    ? { kind: "group", id: element.dataset.groupId! }
    : { kind: "account", id: Number(element.dataset.accountId) };

/**
 * Everything that moves while this item is dragged, in list order, with where it may land.
 * Clean rows see the whole top level, groups opened up into their head, rules and rows; groups see
 * top-level items only; SMS and banned rows see the rows of their own section.
 */
function measure(content: HTMLElement, dragged: HTMLElement, item: ListItem, status: AccountStatus, scale: number): Layout {
  const box = content.getBoundingClientRect();
  const rect = (element: HTMLElement) => {
    const r = element.getBoundingClientRect();
    return { top: (r.top - box.top) / scale, bottom: (r.bottom - box.top) / scale };
  };
  const pieces: Piece[] = [];
  const slots: Slot[] = [];
  const into: Into[] = [];
  const add = (element: HTMLElement) => pieces.push({ element, ...rect(element) });
  const top: Destination = { groupId: null, status: "clean" };

  const children = [...content.children].filter((child): child is HTMLElement =>
    child.matches(".row, .group, .section-divider"),
  );
  const dividerAt = children.findIndex((child) => child.classList.contains("section-divider"));
  const topLevel = dividerAt === -1 ? children : children.slice(0, dividerAt);
  const tail = dividerAt === -1 ? [] : children.slice(dividerAt);

  if (status !== "clean") {
    // The rows after this section's divider, up to the next divider.
    const start = tail.findIndex((child) => child.matches(`.section-divider[data-status="${status}"]`));
    const end = tail.findIndex((child, index) => index > start && child.classList.contains("section-divider"));
    const section: Destination = { groupId: null, status };
    for (const row of tail.slice(start + 1, end === -1 ? undefined : end)) {
      slots.push({ index: pieces.length, destination: section, before: itemOf(row) });
      add(row);
    }
    slots.push({ index: pieces.length, destination: section, before: null });
  } else {
    for (const child of topLevel) {
      slots.push({ index: pieces.length, destination: top, before: itemOf(child) });
      const collapsed = child.classList.contains("group") && child.querySelector(".group-toggle[data-collapsed]");
      if (item.kind === "group" || !child.classList.contains("group") || collapsed) {
        add(child);
        if (item.kind === "account" && collapsed) {
          const head = child.querySelector<HTMLElement>(":scope > .group-head")!;
          into.push({ element: head, ...rect(head), destination: { groupId: child.dataset.groupId!, status: "clean" } });
        }
        continue;
      }
      // An open group, opened up: rows can land before any of its rows, or at its end.
      const group: Destination = { groupId: child.dataset.groupId!, status: "clean" };
      const parts = [
        ...child.querySelectorAll<HTMLElement>(":scope > .group-head, :scope > .group-body > .group-body-inner > *"),
      ].filter((part) => part.matches(".group-head, .group-rule, .group-empty, .group-rows"));
      const lastRule = parts.filter((part) => part.classList.contains("group-rule")).at(-1);
      for (const part of parts) {
        if (part.classList.contains("group-rows")) {
          for (const row of [...part.children] as HTMLElement[]) {
            slots.push({ index: pieces.length, destination: group, before: itemOf(row) });
            add(row);
          }
          continue;
        }
        if (part === lastRule) slots.push({ index: pieces.length, destination: group, before: null });
        add(part);
      }
    }
    slots.push({ index: pieces.length, destination: top, before: null });
    // The SMS and banned sections move down/up with the top level, but nothing lands there.
    tail.forEach(add);
  }

  const origin = pieces.findIndex((piece) => piece.element === dragged);
  const own = pieces[origin]!;
  const next = pieces[origin + 1];
  const gap = next ? Math.max(0, next.top - own.bottom) : 14;
  return {
    pieces,
    // A slot right before or after the item itself is its current place.
    slots: slots.filter((entry) => entry.index !== origin + 1 || entry.index === origin),
    into,
    origin,
    step: own.bottom - own.top + gap,
  };
}

/** Where the item's top would be if it landed in slot `index` (with its old place closed). */
function landingTop(layout: Layout, index: number): number {
  const { pieces, origin, step } = layout;
  if (index <= origin) return pieces[index]!.top;
  const last = pieces[pieces.length - 1]!;
  const after = index < pieces.length ? pieces[index]!.top : last.bottom + (step - (pieces[origin]!.bottom - pieces[origin]!.top));
  return after - step;
}

function landingOffset(layout: Layout, index: number): number {
  return landingTop(layout, index) - layout.pieces[layout.origin]!.top;
}

/** TaskMap picks the slot under the card; here, the landing spot nearest the item's top. */
function nearestSlot(layout: Layout, top: number): Slot | null {
  let best: Slot | null = null;
  let distance = Infinity;
  for (const slot of layout.slots) {
    const next = Math.abs(landingTop(layout, slot.index) - top);
    if (next < distance) {
      best = slot;
      distance = next;
    }
  }
  return best;
}

/**
 * Slides the pieces between the item's old place and slot `index` one step, opening the gap there.
 * With `spread`, the others also make room for the enlarged item (TaskMap's held spread): the
 * nearest move most, the first and last not at all, and each side's gaps stay equal.
 */
function shift(layout: Layout, index: number, spread: boolean) {
  const { pieces, origin, step } = layout;
  const held = pieces[origin]!;
  const amount = spread ? ((held.bottom - held.top) * (HELD_SCALE - 1)) / 2 : 0;
  // Where the gap sits among the other pieces, and how many lie on each side of it.
  const above = index > origin ? index - 1 : index;
  const below = pieces.length - 1 - above;
  let display = 0;
  pieces.forEach((piece, position) => {
    if (position === origin) return;
    const slide =
      index > origin && position > origin && position < index
        ? -step
        : index <= origin && position >= index && position < origin
          ? step
          : 0;
    const side = display < above ? -amount * (above > 0 ? display / above : 0) : amount * (below > 0 ? (pieces.length - 2 - display) / below : 0);
    display += 1;
    const offset = slide + side;
    piece.element.style.translate = Math.abs(offset) > 0.01 ? `0 ${offset}px` : "";
  });
}

/** TaskMap's edge scroll: smoothstep from 52 px inside the edge to a point past it. */
function autoScrollSpeed(pointerY: number, box: DOMRect): number {
  const outside = Math.min(AUTO_SCROLL.maxOutside, Math.max(AUTO_SCROLL.minOutside, box.height * AUTO_SCROLL.outsideRatio));
  const topStart = box.top + AUTO_SCROLL.startInset;
  const bottomStart = box.bottom - AUTO_SCROLL.startInset;
  const ramp = (value: number, start: number, end: number) => {
    const progress = Math.min(1, Math.max(0, (value - start) / (end - start)));
    return progress * progress * (3 - 2 * progress);
  };
  if (pointerY < topStart) return -AUTO_SCROLL.maxSpeed * ramp(pointerY, topStart, box.top - outside);
  if (pointerY > bottomStart) return AUTO_SCROLL.maxSpeed * ramp(pointerY, bottomStart, box.bottom + outside);
  return 0;
}

/* ---------- Saving ---------- */

const sameItem = (a: ListItem | null, b: ListItem | null) => a !== null && b !== null && a.kind === b.kind && a.id === b.id;

/** Moves the item into its destination, before `before` (or at the end), unless nothing changed. */
function commitDrop(item: ListItem, destination: Destination, before: ListItem | null) {
  // Its own place: nothing to do.
  if (sameItem(before, item)) return;
  const current = containerItems(destination);
  const order = current.filter((entry) => !sameItem(entry, item));
  const index = before ? order.findIndex((entry) => sameItem(entry, before)) : -1;
  if (index === -1) order.push(item);
  else order.splice(index, 0, item);
  if (current.length === order.length && current.every((entry, position) => sameItem(entry, order[position]!))) return;
  moveItem(item, destination, order);
}
