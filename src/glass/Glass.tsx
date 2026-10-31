import { createContext, useCallback, useContext, type HTMLAttributes, type Ref } from "react";

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}
import { useLab, type Strategy } from "../lab/store";
import { registerBaked, registerRim } from "./engine";
import type { GlassRole } from "./recipes";

/**
 * How one surface renders under the active strategy:
 * - opaque: today's RankDB boxes
 * - native: owns a pre-blur and a main backdrop-filter layer (sampling with overscan)
 * - shell:  tint, rim and shadow only (contract: Minor nested on Minor never blurs again)
 * - plane:  a shell whose blur is supplied by the list's shared plane underneath
 * - baked:  reveals the pre-blurred backdrop image, no backdrop-filter at all
 */
export type GlassMode = "opaque" | "native" | "shell" | "plane" | "baked";

const InsideMinor = createContext(false);
/** Surfaces inside the scrolling account list (the only place a shared plane exists). */
export const InList = createContext(false);
/** Inside a floating panel (picker, dialog): TaskMap overlay rules apply to every surface in it. */
const InOverlay = createContext(false);
/** TaskMap SettingsIslandList supplies the top-level islands' blur from one stationary plane. */
export const SharedMinorPlane = createContext(false);

export function resolveMode(
  strategy: Strategy,
  role: GlassRole,
  insideMinor: boolean,
  inList: boolean,
  overlay = false,
): GlassMode {
  if (strategy === "off") return "opaque";
  // TaskMap contract: a Minor nested on a Minor is a shell, in overlays too.
  if (insideMinor) return "shell";
  // Overlays (pickers, dialogs and the islands in them) sit above the UI and must blur what is
  // under them, so the row rules (shell, shared plane, baked image) never apply to them.
  if (overlay) return "native";
  switch (strategy) {
    case "native":
      return "native";
    case "shell":
      return role === "major" ? "native" : "shell";
    case "shared":
      return role === "minor" && inList ? "plane" : "native";
    case "baked":
      return role === "minor" && inList ? "plane" : "baked";
  }
}

export interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  readonly ref?: Ref<HTMLDivElement>;
  readonly role: GlassRole;
  /**
   * A panel floating over the UI (picker, dialog). It and every surface inside it follow TaskMap's
   * overlay rules whatever the strategy: real glass, the header's rim style, full-strength shadows.
   */
  readonly floating?: boolean;
  /**
   * Geometry animates every frame (liquid toggle knob, tab indicator): use the CSS rim, which
   * follows any size for free, instead of the cached canvas rim, which would redraw each frame.
   */
  readonly live?: boolean;
  /**
   * TaskMap's small selectors inside an overlay: tint and rim only, never a blur of their own (the
   * panel under them already blurs). A shell without the rows' dark backing.
   */
  readonly rimOnly?: boolean;
  /** "primary" uses the lighter opaque fill of RankDB's name/rank box when glass is off. */
  readonly tone?: "primary";
}

export function Glass({ ref, role, tone, floating, live, rimOnly, className, children, ...props }: GlassProps) {
  const strategy = useLab((state) => state.strategy);
  const insideMinor = useContext(InsideMinor);
  const inList = useContext(InList);
  const overlay = useContext(InOverlay) || !!floating;
  const sharedMinor = useContext(SharedMinorPlane);
  const resolved = resolveMode(strategy, role, insideMinor, inList, overlay);
  const mode = rimOnly && resolved !== "opaque" ? "shell"
    : sharedMinor && role === "minor" && !insideMinor && resolved !== "opaque" ? "plane" : resolved;

  const surfaceRef = useCallback(
    (element: HTMLDivElement | null) => {
      assignRef(ref, element);
      if (!element) return;
      const unregister = registerRim(element);
      return () => {
        unregister();
        assignRef(ref, null);
      };
    },
    [ref, live],
  );
  const bakedRef = useCallback((element: HTMLSpanElement | null) => {
    if (!element) return;
    return registerBaked(element);
  }, []);

  return (
    <div
      {...props}
      ref={surfaceRef}
      className={["g", className].filter(Boolean).join(" ")}
      data-role={role}
      data-mode={mode}
      data-tone={tone}
      data-overlay={overlay || undefined}
      data-live={live || undefined}
      data-rim-only={(rimOnly && mode === "shell") || undefined}
      data-plane-shape={mode === "plane" ? "" : undefined}
    >
      <span className="g-shadow" aria-hidden="true" />
      <span className="g-body" aria-hidden="true">
        {mode === "native" && (
          <>
            <span className="g-filter g-pre" data-filter-layer="" />
            <span className="g-filter g-blur" data-filter-layer="" />
          </>
        )}
        {mode === "baked" && <span ref={bakedRef} className="g-baked" />}
        <span className="g-tint" />
      </span>
      <span className="g-rim" aria-hidden="true">
        {live && <canvas />}
      </span>
      <InOverlay.Provider value={overlay}>
        {role === "minor" && !insideMinor ? (
          <InsideMinor.Provider value>{children}</InsideMinor.Provider>
        ) : (
          children
        )}
      </InOverlay.Provider>
    </div>
  );
}
