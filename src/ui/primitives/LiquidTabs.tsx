import {
  type CSSProperties,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { roundedRectMask } from "../../glass/engine";
import { Glass } from "../../glass/Glass";
import { advanceSpring, isSpringSettled, settleSpring, SPRING, type SpringState } from "./motion/spring";

/**
 * TaskMap's liquid tabs (src/ui/primitives/LiquidTabs.tsx + LiquidSelectionIndicator.tsx), ported.
 *
 * The selection pill's two edges are separate springs: the edge leading toward the new tab is
 * snappy, the trailing edge soft, so the pill stretches toward the target and then catches up,
 * rounding its corners more the further it is stretched. The pill is Minor glass with TaskMap's
 * bright-selection highlight. Pressing and dragging across the tabs selects whichever tab is under
 * the pointer.
 */

export interface LiquidTab<Value extends string> {
  readonly value: Value;
  readonly label: string;
  readonly icon?: ReactNode;
}

const REST_RADIUS = 7;
const MAX_RADIUS = 16;
/** Stretch (relative to the target size) at which the corners reach MAX_RADIUS. */
const MAX_RADIUS_STRETCH = 0.28;
const MIN_SIZE = 1;

export function LiquidTabs<Value extends string>({
  label,
  tabs,
  value,
  onChange,
  orientation = "horizontal",
  disabled = false,
  className,
}: {
  readonly label: string;
  readonly tabs: readonly LiquidTab<Value>[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  readonly orientation?: "horizontal" | "vertical";
  /** Greyed out and inert; the selection stays visible. */
  readonly disabled?: boolean;
  readonly className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<Value, HTMLButtonElement>());
  // Spring state survives renders; the animation writes styles directly, never through React.
  const edges = useRef<{ start: SpringState; end: SpringState } | null>(null);
  const frame = useRef(0);
  const dragging = useRef<number | null>(null);
  const vertical = orientation === "vertical";

  useLayoutEffect(() => {
    const root = rootRef.current;
    const indicator = indicatorRef.current;
    if (!root || !indicator) return;

    const write = (start: number, size: number, radius: number) => {
      if (vertical) {
        indicator.style.height = `${size}px`;
        indicator.style.transform = `translate3d(0, ${start}px, 0)`;
      } else {
        indicator.style.width = `${size}px`;
        indicator.style.transform = `translate3d(${start}px, 0, 0)`;
      }
      indicator.style.setProperty("--g-radius", `${radius}px`);
    };

    const target = () => {
      const tab = tabRefs.current.get(value);
      if (!tab) return null;
      return vertical
        ? { start: tab.offsetTop, size: tab.offsetHeight }
        : { start: tab.offsetLeft, size: tab.offsetWidth };
    };

    const animateTo = (next: { start: number; size: number }, instant: boolean) => {
      cancelAnimationFrame(frame.current);
      const end = next.start + next.size;
      // A hidden tab list (a closed dialog kept mounted) measures 0: the pill's minimum size could
      // never reach it, so the spring would never settle and run every frame. Place it instead.
      if (instant || !edges.current || next.size < MIN_SIZE) {
        edges.current = { start: settleSpring(next.start), end: settleSpring(end) };
        write(next.start, next.size, REST_RADIUS);
        return;
      }
      let previous = performance.now();
      const step = (now: number) => {
        const delta = now - previous;
        previous = now;
        const current = edges.current!;
        const currentCenter = (current.start.position + current.end.position) / 2;
        const forward = next.start + next.size / 2 >= currentCenter;
        let start = advanceSpring(current.start, next.start, forward ? SPRING.soft : SPRING.snappy, delta);
        let finish = advanceSpring(current.end, end, forward ? SPRING.snappy : SPRING.soft, delta);
        if (finish.position - start.position < MIN_SIZE) {
          const center = (start.position + finish.position) / 2;
          start = { position: center - MIN_SIZE / 2, velocity: start.velocity };
          finish = { position: center + MIN_SIZE / 2, velocity: finish.velocity };
        }
        edges.current = { start, end: finish };
        const settled =
          isSpringSettled(start, next.start, SPRING.liquid) && isSpringSettled(finish, end, SPRING.liquid);
        if (settled) {
          edges.current = { start: settleSpring(next.start), end: settleSpring(end) };
          write(next.start, next.size, REST_RADIUS);
          return;
        }
        const size = Math.max(MIN_SIZE, finish.position - start.position);
        const stretch = Math.min(1, Math.abs(size - next.size) / Math.max(MIN_SIZE, next.size) / MAX_RADIUS_STRETCH);
        write(start.position, size, REST_RADIUS + stretch * (MAX_RADIUS - REST_RADIUS));
        frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    };

    const initial = target();
    if (initial) animateTo(initial, edges.current === null);

    // Real layout changes (UI scale, fonts) re-place the pill instantly, without a swoosh. A
    // ResizeObserver also fires once when it starts observing; that one must not cancel the
    // animation just started, so only an actual size change counts.
    let lastSize = `${root.offsetWidth}x${root.offsetHeight}`;
    const observer = new ResizeObserver(() => {
      const size = `${root.offsetWidth}x${root.offsetHeight}`;
      if (size === lastSize) return;
      lastSize = size;
      const next = target();
      if (next) animateTo(next, true);
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [value, vertical]);

  const selectAt = (clientX: number, clientY: number) => {
    if (disabled) return;
    const tab = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-liquid-tab]");
    const next = tab?.dataset.liquidTab as Value | undefined;
    if (next && rootRef.current?.contains(tab!) && next !== value) onChange(next);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || disabled) return;
    dragging.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Not a live pointer (e.g. synthetic); dragging across tabs just won't be captured.
    }
    selectAt(event.clientX, event.clientY);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current === event.pointerId) selectAt(event.clientX, event.clientY);
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current === event.pointerId) dragging.current = null;
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = vertical ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    const direction = event.key === keys[0] ? -1 : event.key === keys[1] ? 1 : 0;
    if (!direction || disabled) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.value === value);
    const next = tabs[(index + direction + tabs.length) % tabs.length];
    if (next) {
      onChange(next.value);
      tabRefs.current.get(next.value)?.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      role="tablist"
      aria-label={label}
      aria-orientation={orientation}
      data-orientation={orientation}
      data-disabled={disabled || undefined}
      aria-disabled={disabled || undefined}
      className={["liquid-tabs", className].filter(Boolean).join(" ")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
    >
      <Glass
        ref={indicatorRef}
        role="minor"
        live
        className="liquid-tabs-indicator"
        aria-hidden="true"
        // The filter output mask is drawn once at the resting radius; the rim follows the live one.
        style={{ "--g-mask": roundedRectMask(REST_RADIUS), "--g-radius": `${REST_RADIUS}px` } as CSSProperties}
      />
      {tabs.map((tab) => (
        <button
          key={tab.value}
          ref={(element) => {
            if (element) tabRefs.current.set(tab.value, element);
            else tabRefs.current.delete(tab.value);
          }}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          tabIndex={tab.value === value && !disabled ? 0 : -1}
          data-liquid-tab={tab.value}
          className="liquid-tab"
          // Keyboard (Enter/Space) and assistive tech activate tabs through click.
          onClick={() => {
            if (tab.value !== value && !disabled) onChange(tab.value);
          }}
        >
          {tab.icon && <span className="liquid-tab-icon">{tab.icon}</span>}
          <span className="liquid-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
