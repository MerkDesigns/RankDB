import { uiText, rankName } from "../text/index";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { PLACEMENT_GAMES, sameRank, type Rank, type RankTier } from "../data/accounts";
import { PREDICTED_EMBLEM, RANK_EMBLEMS } from "../data/assets";
import { findAccount, rankAt, setRank, type RankSlot } from "../data/rosterStore";
import { Glass } from "../glass/Glass";
import { useLab } from "../lab/store";
import { CellIndicator } from "./primitives/CellIndicator";
import { LiquidTabs, type LiquidTab } from "./primitives/LiquidTabs";
import { OPEN_FROM_PRESENCE } from "./primitives/motion/presence";
import { usePresence } from "./primitives/motion/usePresence";
import { useWarmMount } from "./primitives/useWarmMount";
import { getRoster } from "../data/rosterStore";
import { RankDigit } from "./RankDigit";

/* ---------- Which badge the picker is open for (UI state, not saved) ---------- */

interface PickerTarget {
  readonly accountId: number;
  readonly slot: RankSlot;
  /** The clicked badge, in viewport pixels. */
  readonly anchor: DOMRect;
  /** Retained while open/closing so the exit follows the badge as the list scrolls. */
  readonly badge?: HTMLElement;
  readonly scrollTop?: number;
}

/** `closing` keeps the panel mounted while it animates out. */
let state: { readonly target: PickerTarget | null; readonly closing: boolean } = { target: null, closing: false };
const listeners = new Set<() => void>();

function setState(next: typeof state) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** A new badge while the old panel animates out replaces it at once. */
export function openRankPicker(accountId: number, slot: RankSlot, badge: HTMLElement) {
  setState({ target: { accountId, slot, anchor: badge.getBoundingClientRect(), badge, scrollTop: badge.closest(".list-scroller")?.scrollTop }, closing: false });
}

function requestCloseRankPicker() {
  if (state.target && !state.closing) setState({ ...state, closing: true });
}

function closeRankPicker() {
  setState({ target: null, closing: false });
}

/* ---------- The badge being edited, and its draft (the row shows it live) ---------- */

export interface PickerEdit {
  readonly accountId: number;
  readonly slot: RankSlot;
  readonly rank: Rank;
}

let edit: PickerEdit | null = null;
const editListeners = new Set<() => void>();

function setEdit(next: PickerEdit | null) {
  if (next === edit || (next && edit && next.accountId === edit.accountId && next.slot === edit.slot && sameRank(next.rank, edit.rank))) {
    return;
  }
  edit = next;
  editListeners.forEach((listener) => listener());
}

/** The edit in progress on this account's row, if any (other rows never re-render for it). */
export function usePickerEdit(accountId: number): PickerEdit | null {
  return useSyncExternalStore(
    (listener) => {
      editListeners.add(listener);
      return () => editListeners.delete(listener);
    },
    () => (edit?.accountId === accountId ? edit : null),
  );
}

/**
 * A press outside the open picker only closes it: the press and the click that follows never reach
 * what was under the pointer, so clicking another badge takes a second click once this one closed.
 */
function swallowClick(event: PointerEvent) {
  event.preventDefault();
  event.stopPropagation();
  const swallow = (click: MouseEvent) => {
    click.preventDefault();
    click.stopPropagation();
  };
  document.addEventListener("click", swallow, { capture: true, once: true });
  // A press that never becomes a click (a drag) must not eat a later one.
  document.addEventListener(
    "pointerdown",
    () => document.removeEventListener("click", swallow, { capture: true }),
    { capture: true, once: true },
  );
}

function usePickerState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

/* ---------- Picker ---------- */

/** Old app order: Champion down to Bronze, then Unranked (5 per column, or 5 per row landscape). */
const TIERS: readonly RankTier[] = [
  "Champion",
  "Grandmaster",
  "Master",
  "Diamond",
  "Emerald",
  "Platinum",
  "Gold",
  "Silver",
  "Bronze",
  "Unranked",
];
type Division = "1" | "2" | "3" | "4" | "5";
const DIVISIONS: readonly LiquidTab<Division>[] = (["1", "2", "3", "4", "5"] as const).map((value) => ({
  value,
  label: value,
  content: <RankDigit value={Number(value)} />,
}));
/** Top to bottom: the bar fills upward from game 1. */
const PLACEMENT_CELLS = Array.from({ length: PLACEMENT_GAMES }, (_, index) => PLACEMENT_GAMES - index);
/** Distance the panel keeps from the window edges, in UI pixels. */
const EDGE = 10;

/**
 * Change rank, next to the clicked badge: tier grid, divisions, then (past a separator) the
 * "predicted" toggle above a vertical placement bar (games 1–10, live while predicted), and Confirm.
 *
 * Built like TaskMap's Shift+E quick extensions menu: a Major glass panel floating over the app (no
 * scrim; a press outside closes it), with that menu's presence (material fade + slide up) and
 * shadow. Selectors are rim-only glass, the divisions TaskMap's vertical liquid tabs. Sizes come
 * from the lab (LabState.picker, applied as --picker-* variables).
 */
export function RankPicker() {
  const { target, closing } = usePickerState();
  // Kept mounted (hidden) once the app is idle, for the last badge it opened for: opening it only
  // resets its draft, never re-renders the whole panel.
  const warm = useWarmMount();
  const last = useRef<PickerTarget | null>(null);
  if (target) last.current = target;
  if (!last.current && warm) last.current = warmTarget();
  if (!last.current) return null;
  return <RankPickerPanel target={last.current} open={target !== null && !closing} />;
}

/** Something to mount the hidden panel for before any badge was clicked. */
function warmTarget(): PickerTarget | null {
  const first = getRoster().entries.find((entry) => entry.kind === "account");
  return first?.kind === "account" ? { accountId: first.account.id, slot: 0, anchor: new DOMRect() } : null;
}

function RankPickerPanel({ target: current, open }: { readonly target: PickerTarget; readonly open: boolean }) {
  // Only listen while open. Scroll offsets are layout pixels, so this also works at every UI scale.
  useEffect(() => {
    if (!open) return;
    const scroller = document.querySelector<HTMLElement>(".list-scroller");
    if (!scroller) return;
    const start = current.scrollTop ?? scroller.scrollTop;
    const style = getComputedStyle(scroller);
    const distance = 3 * (parseFloat(style.getPropertyValue("--row-h")) + parseFloat(style.getPropertyValue("--row-gap")));
    const onScroll = () => {
      if (Math.abs(scroller.scrollTop - start) >= distance) requestCloseRankPicker();
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [open, current]);
  const offset = useLab((state) => state.picker.offset);
  // Any size change re-measures the panel to keep it beside the badge and inside the window.
  const pickerTuning = useLab((state) => state.picker);
  const account = findAccount(current.accountId);
  const initial = account ? rankAt(account, current.slot) : null;
  const [tier, setTier] = useState<RankTier>(initial?.tier ?? "Unranked");
  const [division, setDivision] = useState(initial?.division ?? 5);
  const [predicted, setPredicted] = useState(initial?.predicted ?? false);
  const [placements, setPlacements] = useState(initial?.placements || 1);
  const panelRef = useRef<HTMLDivElement>(null);
  // The panel stays mounted across badges, so the presence reads the current one through a ref.
  const anchor = useRef(current);
  anchor.current = current;
  // Opens like an iOS app from its icon: it fades in while growing out of the clicked badge into
  // its place beside it, and shrinks back into the badge on close. Read every frame, so it follows
  // the panel's current place and size.
  const present = usePresence(panelRef, {
    open,
    channels: () => {
      const panel = panelRef.current;
      if (!panel || !panel.offsetHeight) return {};
      // Placement stays where the picker opened, but its animation follows the actual badge,
      // including continued scrolling during exit. Warm mounting has no badge element yet.
      const target = anchor.current;
      const badge = target.badge?.isConnected ? target.badge.getBoundingClientRect() : target.anchor;
      return {
        origin: {
          x: badge.left + badge.width / 2 - panel.offsetLeft,
          y: badge.top + badge.height / 2 - panel.offsetTop,
        },
        scale: Math.min(1, badge.height / panel.offsetHeight),
      };
    },
    timing: OPEN_FROM_PRESENCE,
    onExited: closeRankPicker,
  });
  // While it is open or animating, only the edited badge's rank effects run (rankEffects.ts).
  const shown = open || present;
  useLayoutEffect(() => {
    if (!shown) return;
    const root = document.documentElement;
    root.dataset.pickerOpen = "";
    return () => {
      delete root.dataset.pickerOpen;
    };
  }, [shown]);

  const unranked = tier === "Unranked";
  const tierIndex = TIERS.indexOf(tier);
  const placementMode = predicted && !unranked;

  const draft = { tier, division, predicted: placementMode, placements: placementMode ? placements : 0 };
  // While open, the row's badge shows the draft (lifted a little); closing hands it back to the
  // saved rank (the confirmed one, or the old one on cancel).
  useLayoutEffect(() => {
    setEdit(
      open
        ? {
            accountId: current.accountId,
            slot: current.slot,
            rank: { ...draft, division: unranked ? 5 : draft.division },
          }
        : null,
    );
  }, [open, current, tier, division, placementMode, placements]);
  useEffect(() => () => setEdit(null), []);
  // Nothing to confirm until the draft differs from the saved rank (an Unranked rank has no division).
  const changed =
    !initial ||
    draft.tier !== initial.tier ||
    (draft.tier !== "Unranked" && draft.division !== initial.division) ||
    draft.predicted !== initial.predicted ||
    draft.placements !== (initial.predicted ? initial.placements : 0);

  const confirm = () => {
    if (!changed) return;
    setRank(current.accountId, current.slot, draft);
    requestCloseRankPicker();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestCloseRankPicker();
      if (event.key === "Enter") confirm();
    };
    // TaskMap: the menu alone closes on an outside press, in the capture phase so nothing under it
    // can swallow the press. Here the press only closes it (swallowClick). The lab pop-up is exempt
    // so the picker can be tuned live.
    const onPointerDown = (event: PointerEvent) => {
      const outside = event.target instanceof Node && !panelRef.current?.contains(event.target);
      const inLab = event.target instanceof Element && event.target.closest(".lab");
      if (event.button !== 0 || !outside || inLab) return;
      swallowClick(event);
      requestCloseRankPicker();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  });

  // Beside the badge if it fits on either side, else below or above it; always inside the window.
  // The picker isn't zoomed by the UI scale (only the app is), so viewport pixels are its pixels.
  // The side is chosen once, for the expanded width (placements column included), so toggling
  // Predicted never flips it. Beside the badge the panel always touches it (at the lab's offset):
  // on the right its left edge stays put; on the left its right edge does, so the panel grows
  // leftwards and its content slides left by the placements column's width as it opens.
  const side = useRef<"right" | "left" | "below" | "above" | null>(null);
  const placeFor = (width: number, height: number, expanded: number) => {
    const badge = current.anchor;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    if (!side.current) {
      const below = badge.bottom + offset + height <= viewport.height - EDGE;
      side.current =
        badge.right + offset + expanded <= viewport.width - EDGE
          ? "right"
          : badge.left - offset - expanded >= EDGE
            ? "left"
            : below
              ? "below"
              : "above";
    }
    let left: number;
    let top: number;
    if (side.current === "right" || side.current === "left") {
      // Vertically centred on the badge.
      left = side.current === "right" ? badge.right + offset : badge.left - offset - width;
      top = badge.top + badge.height / 2 - height / 2;
    } else {
      // Too wide for either side (narrow window): below or above the badge, centred on it for the
      // expanded width so the left edge stays put. Never covers the badge itself.
      left = (badge.left + badge.right) / 2 - expanded / 2;
      top = side.current === "below" ? badge.bottom + offset : badge.top - offset - height;
    }
    return {
      left: Math.max(EDGE, Math.min(left, viewport.width - width - EDGE)),
      top: Math.max(EDGE, Math.min(top, viewport.height - height - EDGE)),
    };
  };

  // Predicted expands or collapses the panel to show or hide the placements column, easing its
  // width (and left edge, when it sits left of the badge). The column stays rendered until a
  // collapse finishes. The panel is live glass, so its rim follows every frame.
  const [showPlacements, setShowPlacements] = useState(placementMode);
  if (placementMode && !showPlacements) setShowPlacements(true);

  // Another badge opened the kept-mounted panel: its draft starts from that rank, and the selectors
  // that glide between values are remounted (`generation`) so they don't glide from the last one.
  const [draftFor, setDraftFor] = useState(current);
  const [generation, setGeneration] = useState(0);
  if (draftFor !== current) {
    setDraftFor(current);
    setGeneration((value) => value + 1);
    setTier(initial?.tier ?? "Unranked");
    setDivision(initial?.division ?? 5);
    setPredicted(initial?.predicted ?? false);
    setPlacements(initial?.placements || 1);
    setShowPlacements(Boolean(initial?.predicted && initial.tier !== "Unranked"));
  }
  const lastPlace = useRef<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    side.current = null;
    lastPlace.current = null;
    const panel = panelRef.current;
    panel?.getAnimations().forEach((animation) => animation.cancel());
    if (panel) delete panel.dataset.resizing;
  }, [current]);

  // Only a toggle eases the width; the first render and a new badge just place the panel.
  const lastMode = useRef({ target: current, placementMode });
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const previous = lastMode.current;
    lastMode.current = { target: current, placementMode };
    if (previous.target !== current || previous.placementMode === placementMode) return;
    if (!panel || !lastPlace.current) return;
    // Toggled again mid-animation: start from where the panel is now, not where it was headed.
    const running = panel.getAnimations().length > 0;
    const from = running ? { width: panel.offsetWidth, left: panel.offsetLeft } : lastPlace.current;
    panel.getAnimations().forEach((animation) => animation.cancel());
    // Expanding, the column is already in: the natural width is the target. Collapsing, it is
    // still in, so the target is the natural width without it.
    const expanded = panel.offsetWidth;
    const width = placementMode ? expanded : expanded - placementsWidth(panel);
    const to = placeFor(width, panel.offsetHeight, expanded);
    // Nothing to ease (e.g. StrictMode's second mount run).
    if (Math.abs(width - from.width) < 0.5 && Math.abs(to.left - from.left) < 0.5) {
      if (!placementMode) setShowPlacements(false);
      return;
    }
    panel.dataset.resizing = "";
    // Where it ends up; the placement effect leaves geometry alone while this runs.
    panel.style.left = `${to.left}px`;
    lastPlace.current = { left: to.left, width };
    const animation = panel.animate(
      [
        { width: `${from.width}px`, left: `${from.left}px` },
        { width: `${width}px`, left: `${to.left}px` },
      ],
      { duration: 240, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
    );
    animation.onfinish = () => {
      if (!placementMode) setShowPlacements(false);
      else {
        animation.cancel();
        delete panel.dataset.resizing;
      }
    };
  }, [placementMode, current]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    // A finished collapse: the column is gone, so the held end frame can go.
    if (!showPlacements) {
      panel.getAnimations().forEach((animation) => animation.cancel());
      delete panel.dataset.resizing;
    }
    // Mid-animation offsetWidth is the animated width, not the layout's; the animation owns it.
    if (panel.getAnimations().length > 0) return;
    const width = panel.offsetWidth;
    const expanded = showPlacements ? width : width + placementsWidth(panel);
    const { left, top } = placeFor(width, panel.offsetHeight, expanded);
    panel.dataset.side = side.current ?? "right";
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    lastPlace.current = { left, width };
  }, [current, offset, pickerTuning, showPlacements]);

  if (!account) return null;

  return (
    <Glass
      ref={panelRef}
      role="major"
      floating
      live
      className="picker"
      aria-label={uiText("rankPicker.accessibleLabel")}
      data-parked={(!present && !open) || undefined}
    >
      <div className="picker-body">
        <div className="picker-tiers">
          {/* One rim for the whole grid, gliding to the selected rank (5 per column). */}
          <CellIndicator
            key={generation}
            x={Math.floor(tierIndex / 5) * (pickerTuning.cell + pickerTuning.gap)}
            y={(tierIndex % 5) * (pickerTuning.cell + pickerTuning.gap)}
            size={pickerTuning.cell}
            radius={pickerTuning.radius}
          />
          {TIERS.map((entry) => (
            <Selector
              key={entry}
              className="picker-cell"
              aria-label={rankName(entry)}
              aria-pressed={tier === entry}
              selected={tier === entry}
              data-dimmed={entry === "Unranked" || undefined}
              onClick={() => {
                setTier(entry);
                if (entry === "Unranked") setPredicted(false);
              }}
            >
              <img src={RANK_EMBLEMS[entry]} alt="" draggable={false} />
            </Selector>
          ))}
        </div>

        <div className="picker-divisions">
          <Selector
            glass
            className="picker-cell picker-predicted"
            aria-label={uiText("rankPicker.predicted")}
            aria-pressed={placementMode}
            disabled={unranked}
            selected={placementMode}
            data-dimmed=""
            onClick={() => setPredicted((value) => !value)}
          >
            <img src={PREDICTED_EMBLEM} alt="" draggable={false} />
          </Selector>
          <span className="picker-heading" data-disabled={unranked || undefined}>{uiText("rankPicker.divisionHeading")}</span>
          <LiquidTabs
            key={generation}
            label={uiText("rankPicker.divisionAccessibleLabel")}
            orientation="vertical"
            disabled={unranked}
            tabs={DIVISIONS}
            value={String(division) as Division}
            onChange={(value) => setDivision(Number(value))}
          />
        </div>

        {/* Only while Predicted is on; the panel widens to show it and narrows again without it. */}
        {showPlacements && (
          <div className="picker-placements" data-leaving={!placementMode || undefined}>
            <span className="picker-placement-count" aria-hidden="true">
              {placements}{uiText("rankPicker.placementSeparator")}{PLACEMENT_GAMES}
            </span>
            <PlacementBar value={placements} onChange={setPlacements} />
          </div>
        )}
      </div>

      <Selector glass className="picker-confirm" disabled={!changed} onClick={confirm}>
        <span>{uiText("rankPicker.confirm")}</span>
      </Selector>
    </Glass>
  );
}

/**
 * A picker button. With `glass` it sits on rim-only Minor glass (TaskMap's selectors in a menu: no
 * blur of their own). Its content must sit in elements so it can fade with the panel's presence.
 */
function Selector({
  selected,
  glass,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly selected?: boolean;
  readonly glass?: boolean;
  readonly children: ReactNode;
  readonly [data: `data-${string}`]: unknown;
}) {
  return (
    <button
      {...props}
      type="button"
      className={["picker-selector", className].join(" ")}
      data-selected={selected || undefined}
    >
      {glass && <Glass role="minor" rimOnly className="picker-selector-glass" aria-hidden="true" />}
      {children}
    </button>
  );
}

/**
 * Placement games played, 1–10: a vertical bar of unnumbered cells filling up from the bottom.
 * Press or drag along it to set the count; arrow keys step it.
 */
function PlacementBar({ value, onChange }: { readonly value: number; readonly onChange: (value: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  const setFromPointer = (clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const fraction = (rect.bottom - clientY) / rect.height;
    const next = Math.min(PLACEMENT_GAMES, Math.max(1, Math.ceil(fraction * PLACEMENT_GAMES)));
    if (next !== value) onChange(next);
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      className="picker-placement-bar"
      aria-label={uiText("rankPicker.placementsAccessibleLabel")}
      aria-orientation="vertical"
      aria-valuemin={1}
      aria-valuemax={PLACEMENT_GAMES}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        dragging.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        setFromPointer(event.clientY);
      }}
      onPointerMove={(event) => {
        if (dragging.current === event.pointerId) setFromPointer(event.clientY);
      }}
      onPointerUp={() => (dragging.current = null)}
      onPointerCancel={() => (dragging.current = null)}
      onKeyDown={(event) => {
        const step = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        onChange(Math.min(PLACEMENT_GAMES, Math.max(1, value + step)));
      }}
    >
      {PLACEMENT_CELLS.map((game) => (
        <span key={game} className="picker-placement-cell" data-filled={game <= value || undefined} />
      ))}
    </div>
  );
}

/**
 * The width the placements column adds (its own width plus the column gap). Measured on the
 * column when it is shown, else on an invisible stand-in with the same widest content.
 */
function placementsWidth(panel: HTMLElement): number {
  const body = panel.querySelector<HTMLElement>(".picker-body");
  if (!body) return 0;
  const gap = parseFloat(getComputedStyle(body).columnGap) || 0;
  const column = body.querySelector<HTMLElement>(".picker-placements");
  if (column) return column.offsetWidth + gap;
  const probe = document.createElement("div");
  probe.className = "picker-placements";
  probe.style.cssText = "position: absolute; visibility: hidden; animation: none";
  probe.innerHTML = `<span class="picker-placement-count">${PLACEMENT_GAMES} / ${PLACEMENT_GAMES}</span><div class="picker-placement-bar"></div>`;
  body.append(probe);
  const width = probe.offsetWidth;
  probe.remove();
  return width + gap;
}
