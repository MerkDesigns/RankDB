import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RankTier } from "../data/accounts";

/**
 * The rank effects' motion (RankBadge renders them; colours and strengths are in app.css
 * `.badge-fx`). They run as Web Animations on the compositor rather than CSS animations: React
 * listens for animation events at its root, so every cycle of a CSS animation woke the page for a
 * dozen frames before it ended, about 150 ms/s of main thread with a list's worth of badges.
 *
 * They also update 60 times a second, all on one clock: stepped timing, every loop started a whole
 * number of 1/60 s steps from the timeline's zero. A smooth animation makes the window redraw at
 * the display's full rate (357 Hz here, GPU ~250 ms/s), and badges out of step would each add
 * their own redraws. Start delays are folded into the start time: a delayed start wakes the page
 * every frame until it begins.
 */

export const EFFECT_TIERS: ReadonlySet<RankTier> = new Set(["Champion", "Grandmaster", "Master", "Diamond", "Emerald"]);
/** Emerald has no shine. */
const SHINE_MS: Partial<Record<RankTier, number>> = { Champion: 3200, Grandmaster: 4400, Master: 6000, Diamond: 7000 };
export const SPARKLES: Partial<Record<RankTier, number>> = { Champion: 7, Grandmaster: 3 };
/** Sparkle spots around the badge (left %, top %, size as a share of the badge height, delay s). */
export const SPOTS = [
  [8, 6, 0.22, 0],
  [40, 92, 0.17, 1.1],
  [95, 10, 0.2, 2],
  [24, -6, 0.15, 0.6],
  [66, 98, 0.15, 1.6],
  [2, 70, 0.17, 2.5],
  [58, -8, 0.17, 0.3],
] as const;

const STEP_MS = 1000 / 60;
const GLOW_MS = 3200;
const SPARKLE_MS = 2800;

const EASE = "ease-in-out";
/** The glow dims to 70% and back (its strength is in the gradient, app.css). */
const PULSE: Keyframe[] = [{ opacity: 1, easing: EASE }, { opacity: 0.7, offset: 0.5, easing: EASE }, { opacity: 1 }];
/** The shine crosses the badge in the first ~22% of each cycle. */
const SHINE: Keyframe[] = [
  { transform: "translateX(0)", easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
  { transform: "translateX(270%)", offset: 0.22 },
  { transform: "translateX(270%)" },
];
/** A sparkle pops in, turns a little and fades. */
const TWINKLE: Keyframe[] = [
  { opacity: 0, scale: "0", rotate: "0deg", easing: EASE },
  { opacity: 0.8, scale: "0.9", offset: 0.18, easing: EASE },
  { opacity: 0, scale: "0.2", rotate: "90deg", offset: 0.4, easing: EASE },
  { opacity: 0, scale: "0", rotate: "0deg" },
];

/** One loop on the shared clock, `phase` (0–1, any number wraps) into its cycle now. */
function loop(target: Element, keyframes: Keyframe[], duration: number, phase: number, pseudoElement?: string) {
  const animation = target.animate(keyframes, { duration, iterations: Infinity, easing: `steps(${Math.round(duration / STEP_MS)})`, pseudoElement });
  const now = Math.floor(Number(document.timeline.currentTime) / STEP_MS) * STEP_MS;
  animation.startTime = now - Math.round((((phase % 1) + 1) % 1) * duration / STEP_MS) * STEP_MS;
  return animation;
}

interface Badge {
  readonly fx: HTMLElement;
  readonly tier: RankTier;
  readonly phase: number;
  readonly scroller: Element | null;
  onScreen: boolean;
  /** The rank picker is open for it. */
  editing: boolean;
  /** The glow, and the shine and sparkles; null while stopped. */
  glow: Animation[] | null;
  moving: Animation[] | null;
}

function toggle(animations: Animation[] | null, on: boolean, start: () => Animation[]) {
  if (on) return animations ?? start();
  for (const animation of animations ?? []) animation.cancel();
  return null;
}

/**
 * Effects run only while their badge is on screen, the window has focus (`data-window-inactive`,
 * window.ts: RankDB mostly sits behind a game) and no dialog is open (`data-dialog-open`,
 * Dialog.tsx). While the rank picker is open (`data-picker-open`, RankPicker) only the badge it
 * edits keeps them. Each running loop is a layer of its own, and with the list's ~90 of them every
 * frame of an overlay's own motion (its fading blur, tabs, selectors) re-layerized the page for
 * ~5.5 ms instead of ~0.5. The shine and sparkles also stop while the list scrolls
 * (`data-scrolling`, AccountList), for the same reason as rows scroll into view. Stopped, not
 * paused: a paused animation keeps its layer. At rest the glow stays lit and the shine and
 * sparkles are out of sight; they restart at their phase.
 */
function update(badge: Badge) {
  const root = document.documentElement.dataset;
  const shown =
    badge.onScreen &&
    root.badgeEffects !== "false" &&
    root.windowInactive === undefined &&
    root.dialogOpen === undefined &&
    (root.pickerOpen === undefined || badge.editing);
  const { fx, tier, phase } = badge;
  badge.glow = toggle(badge.glow, shown, () => [loop(fx.querySelector(".fx-glow")!, PULSE, GLOW_MS, phase)]);
  badge.moving = toggle(badge.moving, shown && !badge.scroller?.hasAttribute("data-scrolling"), () => {
    const shine = fx.querySelector(".fx-glint");
    const sparkles = [...fx.querySelectorAll(".fx-sparkle")].map((sparkle, index) =>
      loop(sparkle, TWINKLE, SPARKLE_MS, phase - (SPOTS[index]![3] * 1000) / SPARKLE_MS),
    );
    return shine ? [loop(shine, SHINE, SHINE_MS[tier]!, phase, "::before"), ...sparkles] : sparkles;
  });
}

const badges = new Map<Element, Badge>();
let visibility: IntersectionObserver | null = null;
let changes: MutationObserver | null = null;

function watch(fx: HTMLElement, tier: RankTier, phase: number, editing: boolean) {
  const badge: Badge = { fx, tier, phase, scroller: fx.closest(".list-scroller"), onScreen: false, editing, glow: null, moving: null };
  badges.set(fx, badge);
  visibility ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const target = badges.get(entry.target);
      if (!target) continue;
      target.onScreen = entry.isIntersecting;
      update(target);
    }
  });
  visibility.observe(fx);
  if (!changes) {
    changes = new MutationObserver(() => badges.forEach(update));
    changes.observe(document.documentElement, { attributeFilter: ["data-badge-effects", "data-window-inactive", "data-dialog-open", "data-picker-open"] });
  }
  if (badge.scroller) changes.observe(badge.scroller, { attributeFilter: ["data-scrolling"] });
  return () => {
    visibility?.unobserve(fx);
    badges.delete(fx);
    toggle(badge.glow, false, () => []);
    toggle(badge.moving, false, () => []);
  };
}

/** The ref for a badge's `.badge-fx`: runs its effects while it is mounted. */
export function useRankEffects(tier: RankTier, editing: boolean) {
  // Each badge starts its loops at its own point, so a list of them never pulses in step.
  const [phase] = useState(() => Math.random());
  const fx = useRef<HTMLSpanElement | null>(null);
  const editingNow = useRef(editing);
  editingNow.current = editing;
  // A badge the picker leaves keeps running until the picker has closed (no stop and restart as it
  // shrinks back into the badge).
  useLayoutEffect(() => {
    const badge = fx.current && badges.get(fx.current);
    if (!badge || badge.editing === editing) return;
    badge.editing = editing;
    if (editing) update(badge);
  }, [editing]);
  return useCallback(
    (element: HTMLSpanElement) => {
      fx.current = element;
      const stop = watch(element, tier, phase, editingNow.current);
      return () => {
        fx.current = null;
        stop();
      };
    },
    [tier, phase],
  );
}
