/**
 * TaskMap's presence motion (src/ui/motion/presenceMotion.ts, presencePresets.ts,
 * ui/patterns/overlays/modalMotion.ts, ui/materials/materialPresence.ts), ported.
 *
 * One progress, 0 hidden → 1 visible, drives a surface's appearance:
 * - material fade: `--presence` on the surface. Glass layers read it (glass.css): tint, rim and
 *   shadow fade with it, the blur follows it after a short delay, saturation/brightness ease in.
 *   Glass-free content fades through `[data-presence-content]` marks, never through ancestor
 *   opacity, which would flatten the blur.
 * - movement: an offset/scale while hidden, written as the surface's transform.
 */

export interface PresenceChannels {
  /** Offset while hidden, in px. */
  readonly slide?: { readonly x?: number; readonly y?: number };
  /** Scale while hidden, e.g. 0.96. */
  readonly scale?: number;
  /** Transform origin in the surface's own pixels (where a scale grows from). Default: centre. */
  readonly origin?: { readonly x: number; readonly y: number };
}

export interface PresenceTiming {
  readonly durationMs: number;
  readonly easing: (progress: number) => number;
}

export type PresenceEndpoint = "visible" | "hidden";

/** CSS `cubic-bezier(x1, y1, x2, y2)` as an easing function (Newton with bisection fallback). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const axis = (a: number, b: number) => (t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  const slope = (a: number, b: number) => (t: number) =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t ** 2;
  const x = axis(x1, x2);
  const dx = slope(x1, x2);
  const y = axis(y1, y2);
  return (progress: number): number => {
    const target = clamp01(progress);
    if (target === 0 || target === 1) return target;
    let t = target;
    for (let i = 0; i < 8; i++) {
      const error = x(t) - target;
      if (Math.abs(error) < 1e-6) return y(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t = clamp01(t - error / d);
    }
    let low = 0;
    let high = 1;
    t = target;
    for (let i = 0; i < 30 && high - low > 1e-6; i++) {
      if (x(t) < target) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return y(t);
  };
}

export const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;
const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);
const EASE_STANDARD = cubicBezier(0.2, 0, 0, 1);
const EASE_EMPHASIZED = cubicBezier(0.16, 1, 0.3, 1);

/** Menus (TaskMap's Shift+E quick extensions menu). */
export const MENU_PRESENCE = Object.freeze({
  enter: { durationMs: 264, easing: EASE_EMPHASIZED } satisfies PresenceTiming,
  exit: { durationMs: 192, easing: EASE_STANDARD } satisfies PresenceTiming,
});

/** Dialogs: ease-out enter (TaskMap's normal duration × 1.2), fast smoothstep exit. */
export const MODAL_PRESENCE = Object.freeze({
  enter: { durationMs: 180 * 1.2, easing: easeOutCubic } satisfies PresenceTiming,
  exit: { durationMs: 120, easing: smoothstep } satisfies PresenceTiming,
});

/**
 * RankDB's own: a surface grows out of the element that opened it, like an iOS app opening from
 * its icon (origin and scale come from that element), and shrinks back into it on close.
 */
export const OPEN_FROM_PRESENCE = Object.freeze({
  enter: { durationMs: 272, easing: cubicBezier(0.2, 0.8, 0.2, 1) } satisfies PresenceTiming,
  exit: { durationMs: 192, easing: cubicBezier(0.4, 0, 0.2, 1) } satisfies PresenceTiming,
});

/** TaskMap's presets: the Shift+E menu slides up into place, dialogs only fade their material. */
export const PRESENCE_PRESETS = Object.freeze({
  materialFade: {} satisfies PresenceChannels,
  materialFadeSlideUp: { slide: { y: 16 } } satisfies PresenceChannels,
});

export interface PresenceOptions {
  /** A function is read on every frame, for movement that depends on live geometry. */
  readonly channels: PresenceChannels | (() => PresenceChannels);
  readonly enter: PresenceTiming;
  readonly exit: PresenceTiming;
  readonly onProgress?: (progress: number) => void;
  readonly onComplete?: (endpoint: PresenceEndpoint) => void;
}

export interface Presence {
  show(): void;
  hide(): void;
  destroy(): void;
}

/** Starts hidden; call show() to enter. */
export function createPresence(surface: HTMLElement, options: PresenceOptions): Presence {
  let progress = 0;
  let frame = 0;
  let destroyed = false;

  const write = (next: number) => {
    progress = clamp01(next);
    // Geometry first: read before this frame's writes, so it never forces a restyle.
    const channels = typeof options.channels === "function" ? options.channels() : options.channels;
    if (progress === 1) surface.style.removeProperty("--presence");
    else surface.style.setProperty("--presence", String(progress));
    surface.style.transformOrigin = channels.origin ? `${channels.origin.x}px ${channels.origin.y}px` : "";
    surface.style.transform = movement(channels, progress);
    options.onProgress?.(progress);
  };

  const complete = (endpoint: PresenceEndpoint) => {
    surface.dataset.presencePhase = endpoint;
    surface.style.pointerEvents = endpoint === "hidden" ? "none" : "";
    options.onComplete?.(endpoint);
  };

  const animateTo = (target: number) => {
    if (destroyed) return;
    cancelAnimationFrame(frame);
    const from = progress;
    const distance = Math.abs(target - from);
    const opening = target > from;
    surface.dataset.presencePhase = opening ? "showing" : "hiding";
    // Pointer input stops at once on close (TaskMap: [data-presence-phase="hiding"]).
    surface.style.pointerEvents = opening ? "" : "none";
    if (distance < 0.0001) {
      write(target);
      complete(target === 0 ? "hidden" : "visible");
      return;
    }
    markPresenceContent(surface);
    const timing = opening ? options.enter : options.exit;
    // A reversal mid-way takes only the remaining share of the duration.
    const duration = Math.max(1, timing.durationMs * distance);
    let start: number | null = null;
    const step = (now: number) => {
      start ??= now;
      const time = Math.min(1, (now - start) / duration);
      write(from + (target - from) * timing.easing(time));
      if (time < 1) {
        frame = requestAnimationFrame(step);
        return;
      }
      complete(target === 0 ? "hidden" : "visible");
    };
    frame = requestAnimationFrame(step);
  };

  write(0);
  surface.dataset.presencePhase = "hidden";

  return {
    show: () => animateTo(1),
    hide: () => animateTo(0),
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
    },
  };
}

function movement(channels: PresenceChannels, progress: number): string {
  const hidden = 1 - progress;
  const x = (channels.slide?.x ?? 0) * hidden;
  const y = (channels.slide?.y ?? 0) * hidden;
  const scale = 1 + ((channels.scale ?? 1) - 1) * hidden;
  return [
    Math.abs(x) >= 0.001 || Math.abs(y) >= 0.001 ? `translate3d(${x}px, ${y}px, 0)` : "",
    Math.abs(scale - 1) >= 0.0001 ? `scale(${scale})` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Glass layers already read `--presence`; content beside them is what needs marking. */
const GLASS_LAYERS = ".g-shadow, .g-body, .g-rim, [data-glass-plane]";
const PRESENCE_CONTENT = "data-presence-content";

/**
 * Marks the largest glass-free subtrees under `root` so CSS fades them with the inherited
 * `--presence`. Text must sit in an element: bare text beside a glass layer cannot be marked.
 */
export function markPresenceContent(root: HTMLElement): void {
  for (const marked of root.querySelectorAll(`[${PRESENCE_CONTENT}]`)) marked.removeAttribute(PRESENCE_CONTENT);
  const visit = (parent: Element) => {
    for (const child of parent.children) {
      if (child.matches(GLASS_LAYERS)) continue;
      if (child.matches(".g") || child.querySelector(".g")) visit(child);
      else child.setAttribute(PRESENCE_CONTENT, "");
    }
  };
  visit(root);
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
