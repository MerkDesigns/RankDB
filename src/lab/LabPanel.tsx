import { uiText } from "../text/index";
import "../styles/lab.css";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp, FlaskConical, GripVertical, RotateCcw } from "lucide-react";
import { BACKDROP_SPECS } from "../glass/backdrops";
import { fillDatabaseWithDummy } from "../data/rosterStore";
import { headerFadeColor } from "../glass/engine";
import { PRESETS, type RoleTuning, type Tuning } from "../glass/recipes";
import {
  benchmarkResults,
  calibrateRefresh,
  isBenchmarkRunning,
  liveStats,
  resultsMarkdown,
  runScrollBenchmark,
  runStrategySweep,
  startLiveMeter,
  stopLiveMeter,
  takeCensus,
} from "./perf";
import {
  BACKDROPS,
  DEFAULT_PICKER,
  DEFAULT_STATE,
  DEFAULT_TOASTS,
  type ToastTuning,
  type PickerTuning,
  labStore,
  RIM_MODES,
  ROW_PLATES,
  STRATEGIES,
  useLab,
  WINDOW_CHROMES,
  type LabState,
  type RimMode,
} from "./store";
import { clearToastPreviews, previewToasts, type ToastPreview } from "./toastPreview";

/** Distance the pop-up keeps from the window edges. */
const EDGE = 12;
/** Default spot: top right, just below the header islands. */
const DEFAULT_TOP = 84;

/**
 * Places the pop-up from the saved position (or the default top-right spot), always fully inside
 * the window. Dragging writes the element's style directly and saves only on release.
 */
function useFloatingPanel() {
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{
    pointerId: number;
    dx: number;
    dy: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  /** Whether the last press was a drag, so a click on the pill doesn't also expand it. */
  const lastWasDrag = useRef(false);

  const clamp = (element: HTMLElement, x: number, y: number) => ({
    x: Math.round(Math.min(Math.max(EDGE, x), window.innerWidth - element.offsetWidth - EDGE)),
    y: Math.round(Math.min(Math.max(EDGE, y), window.innerHeight - element.offsetHeight - EDGE)),
  });

  const place = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const { panelX, panelY } = labStore.get();
    const { x, y } = clamp(
      element,
      panelX ?? window.innerWidth - element.offsetWidth - EDGE * 2,
      panelY ?? DEFAULT_TOP,
    );
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  }, []);

  // Every render: expanding or collapsing changes the size the position is clamped with.
  useLayoutEffect(place);
  useEffect(() => {
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [place]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const element = ref.current;
    if (!element || event.button !== 0) return;
    if ((event.target as Element).closest("button, input, select, label, a")) return;
    drag.current = {
      pointerId: event.pointerId,
      dx: event.clientX - element.offsetLeft,
      dy: event.clientY - element.offsetTop,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    element.dataset.dragging = "";
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const element = ref.current;
    const active = drag.current;
    if (!element || !active || active.pointerId !== event.pointerId) return;
    if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < 4) {
      return;
    }
    active.moved = true;
    const { x, y } = clamp(element, event.clientX - active.dx, event.clientY - active.dy);
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const element = ref.current;
    const active = drag.current;
    if (!element || !active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    delete element.dataset.dragging;
    lastWasDrag.current = active.moved;
    if (active.moved) labStore.set({ panelX: element.offsetLeft, panelY: element.offsetTop });
  };

  return {
    ref,
    lastWasDrag,
    handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}

/**
 * The lab as a pop-up inside the app window: drag it by its header, collapse it to a pill and
 * expand it again in place. It is opaque and glass-free so it never adds to what is measured.
 */
export function LabPanel() {
  const open = useLab((state) => state.panelOpen);
  const { ref, lastWasDrag, handle } = useFloatingPanel();

  if (!open) {
    return (
      <aside
        ref={ref}
        className="lab lab-pill"
        title={uiText("lab.panel.tooltip")}
        {...handle}
        onClick={() => {
          if (!lastWasDrag.current) labStore.set({ panelOpen: true });
        }}
      >
        <FlaskConical size={15} />
        <span>{uiText("lab.panel.title")}</span>
        <button
          type="button"
          className="lab-icon-button"
          title={uiText("lab.panel.expand")}
          aria-label={uiText("lab.panel.expandAccessibleLabel")}
          onClick={() => labStore.set({ panelOpen: true })}
        >
          <ChevronDown size={16} />
        </button>
      </aside>
    );
  }
  return (
    <aside ref={ref} className="lab lab-popup">
      <div className="lab-head" {...handle}>
        <GripVertical size={15} className="lab-grip" />
        <FlaskConical size={16} />
        <span>{uiText("lab.panel.title")}</span>
        <span className="lab-saved" title={uiText("lab.panel.persistenceTooltip")}>{uiText("lab.panel.persistenceStatus")}</span>
        <button
          type="button"
          className="lab-icon-button"
          title={uiText("lab.panel.collapse")}
          aria-label={uiText("lab.panel.collapseAccessibleLabel")}
          onClick={() => labStore.set({ panelOpen: false })}
        >
          <ChevronUp size={16} />
        </button>
      </div>
      <div className="lab-scroll">
        <Meter />
        <StrategySection />
        <ToastSection />
        <SceneSection />
        <TuningSection />
        <PickerSection />
        <BenchmarkSection />
      </div>
    </aside>
  );
}

/* ---------- Building blocks ---------- */

/** Puts one option back to its default; invisible (but keeps its slot) while already default. */
function Reset({ changed, onReset }: { readonly changed: boolean; readonly onReset: () => void }) {
  return (
    <button
      type="button"
      className="lab-reset"
      data-hidden={!changed || undefined}
      tabIndex={changed ? 0 : -1}
      title={uiText("lab.resetTooltip")}
      onClick={(event) => {
        event.preventDefault();
        onReset();
      }}
    >
      <RotateCcw size={12} strokeWidth={2.4} />
    </button>
  );
}

/** Reset wiring for a top-level LabState field. */
function resetFor<K extends keyof LabState>(key: K, value: LabState[K]) {
  return {
    changed: value !== DEFAULT_STATE[key],
    onReset: () => labStore.set({ [key]: DEFAULT_STATE[key] } as Partial<LabState>),
  };
}

function Section({
  title,
  reset,
  children,
}: {
  readonly title: string;
  readonly reset?: { changed: boolean; onReset: () => void };
  readonly children: ReactNode;
}) {
  return (
    <section className="lab-section">
      <div className="lab-section-head">
        <h3>{title}</h3>
        {reset && <Reset {...reset} />}
      </div>
      {children}
    </section>
  );
}

function SubHead({
  title,
  reset,
}: {
  readonly title: string;
  readonly reset?: { changed: boolean; onReset: () => void };
}) {
  return (
    <div className="lab-subhead">
      <h4>{title}</h4>
      {reset && <Reset {...reset} />}
    </div>
  );
}

function Field({
  label,
  reset,
  children,
}: {
  readonly label: string;
  readonly reset: { changed: boolean; onReset: () => void };
  readonly children: ReactNode;
}) {
  return (
    <div className="lab-field">
      <span>{label}</span>
      {children}
      <Reset {...reset} />
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
  reset,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly reset: { changed: boolean; onReset: () => void };
}) {
  return (
    <div className="lab-check-row">
      <label className="lab-check">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
      <Reset {...reset} />
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  defaultValue,
  format,
  onChange,
}: {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly defaultValue?: number;
  readonly format: (value: number) => string;
  readonly onChange: (value: number) => void;
}) {
  return (
    <div className="lab-slider">
      <span className="lab-slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="lab-slider-value">{format(value)}</span>
      {defaultValue === undefined ? (
        <span />
      ) : (
        <Reset changed={value !== defaultValue} onReset={() => onChange(defaultValue)} />
      )}
    </div>
  );
}

/* ---------- Live meter: written straight to the DOM, never through React state ---------- */

function Meter() {
  const enabled = useLab((state) => state.meter);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const detailRef = useRef<HTMLSpanElement>(null);
  const censusRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!enabled) return;
    void calibrateRefresh();
    startLiveMeter();
    const statsTimer = setInterval(() => {
      if (isBenchmarkRunning()) return;
      const stats = liveStats();
      if (fpsRef.current) fpsRef.current.textContent = stats.fps.toFixed(0);
      if (detailRef.current) {
        detailRef.current.textContent = uiText("lab.meter.frameStats", { median: stats.median.toFixed(1), p95: stats.p95.toFixed(1), p99: stats.p99.toFixed(1), longPercent: stats.longPercent.toFixed(0), refreshHz: stats.refreshHz.toFixed(0) });
      }
    }, 300);
    const censusTimer = setInterval(() => {
      if (isBenchmarkRunning()) return;
      const census = takeCensus();
      if (censusRef.current) {
        censusRef.current.textContent = uiText("lab.meter.filterStats", { visibleFilterLayers: census.visibleFilterLayers, filterLayers: census.filterLayers, megapixels: census.blurredMegapixels.toFixed(1), surfaces: census.surfaces });
      }
    }, 1000);
    return () => {
      clearInterval(statsTimer);
      clearInterval(censusTimer);
      stopLiveMeter();
    };
  }, [enabled]);

  return (
    <div className="meter">
      <div className="meter-top">
        <span className="meter-fps" ref={fpsRef}>{uiText("lab.meter.placeholder")}</span>
        <span className="meter-unit">{uiText("lab.meter.fps")}</span>
        <label className="lab-check meter-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => labStore.set({ meter: event.target.checked })}
          />{uiText("lab.meter.toggle")}</label>
      </div>
      <span className="meter-detail" ref={detailRef}>
        {enabled ? uiText("lab.meter.measuring") : uiText("lab.meter.disabled")}
      </span>
      <span className="meter-detail" ref={censusRef} />
    </div>
  );
}

/* ---------- Strategy ---------- */

function StrategySection() {
  const strategy = useLab((state) => state.strategy);
  const backdrop = useLab((state) => state.backdrop);
  const note = STRATEGIES.find((entry) => entry.id === strategy)?.note;
  return (
    <Section title={uiText("lab.glassStrategy")} reset={resetFor("strategy", strategy)}>
      <div className="segmented">
        {STRATEGIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            data-active={entry.id === strategy || undefined}
            onClick={() => labStore.set({ strategy: entry.id })}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <p className="lab-note">{note}</p>
      {strategy === "baked" && backdrop === "aurora-live" && (
        <p className="lab-warn">{uiText("lab.strategyWarning")}</p>
      )}
    </Section>
  );
}

/* ---------- Toast notifications ---------- */

function ToastSection() {
  const toast = useLab((state) => state.toasts);
  const major = useLab((state) => state.tuning.major);
  const d = DEFAULT_TOASTS;
  const material = toast.material ?? major;
  const set = (patch: Partial<ToastTuning>) => labStore.set((state) => ({ toasts: { ...state.toasts, ...patch } }));
  const setMaterial = (patch: Partial<RoleTuning>) => labStore.set((state) => ({
    toasts: { ...state.toasts, material: { ...(state.toasts.material ?? state.tuning.major), ...patch } },
  }));
  const px = (value: number) => `${value}px`;
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const previews: readonly [ToastPreview, string][] = [["success", uiText("lab.toastPreviews.success")], ["error", uiText("lab.toastPreviews.error")], ["countdown", uiText("lab.toastPreviews.countdown")], ["stack", uiText("lab.toastPreviews.stack")], ["burst", uiText("lab.toastPreviews.burst")]];
  return (
    <Section title={uiText("lab.toastNotifications")} reset={{ changed: JSON.stringify(toast) !== JSON.stringify(d), onReset: () => set(d) }}>
      <div className="lab-toast-previews">
        {previews.map(([kind, label]) => <button key={kind} type="button" className="lab-button" onClick={() => previewToasts(kind)}>{label}</button>)}
        <button type="button" className="lab-button" onClick={clearToastPreviews}>{uiText("lab.toastPreviews.clear")}</button>
      </div>
      <p className="lab-note">{uiText("lab.toastPreviews.help")}</p>

      <SubHead title={uiText("lab.shapeAndContent")} />
      <Slider label={uiText("lab.toastCorners")} min={0} max={28} step={0.5} value={material.radius} defaultValue={major.radius} format={px} onChange={(radius) => setMaterial({ radius })} />
      <Slider label={uiText("lab.toastIcon")} min={12} max={20} step={1} value={toast.iconSize} defaultValue={d.iconSize} format={px} onChange={(iconSize) => set({ iconSize })} />
      <Slider label={uiText("lab.iconStroke")} min={1} max={3} step={0.1} value={toast.iconStroke} defaultValue={d.iconStroke} format={(value) => value.toFixed(1)} onChange={(iconStroke) => set({ iconStroke })} />
      <Slider label={uiText("lab.titleContrast")} min={0.4} max={1} step={0.01} value={toast.textOpacity} defaultValue={d.textOpacity} format={percent} onChange={(textOpacity) => set({ textOpacity })} />
      <Slider label={uiText("lab.detailContrast")} min={0.2} max={0.9} step={0.01} value={toast.detailOpacity} defaultValue={d.detailOpacity} format={percent} onChange={(detailOpacity) => set({ detailOpacity })} />

      <SubHead title={uiText("lab.placementAndMotion")} />
      <Slider label={uiText("lab.rightInset")} min={8} max={64} step={1} value={toast.edgeX} defaultValue={d.edgeX} format={px} onChange={(edgeX) => set({ edgeX })} />
      <Slider label={uiText("lab.bottomInset")} min={8} max={64} step={1} value={toast.edgeY} defaultValue={d.edgeY} format={px} onChange={(edgeY) => set({ edgeY })} />
      <Slider label={uiText("lab.animationSpeed")} min={0.8} max={2} step={0.05} value={toast.motionSpeed} defaultValue={d.motionSpeed} format={percent} onChange={(motionSpeed) => set({ motionSpeed })} />

      <SubHead title={uiText("lab.majorGlass")} reset={{ changed: toast.material !== null, onReset: () => set({ material: null }) }} />
      <Check label={uiText("lab.toastMaterial.followShared")} checked={toast.material === null} reset={{ changed: toast.material !== null, onReset: () => set({ material: null }) }} onChange={(shared) => set({ material: shared ? null : { ...major } })} />
      <p className="lab-note">{uiText("lab.toastMaterial.help")}</p>
      {toast.material !== null && <>
        <Slider label={uiText("lab.toastBlur")} min={0} max={80} step={0.5} value={material.blur} defaultValue={major.blur} format={px} onChange={(blur) => setMaterial({ blur })} />
        <Slider label={uiText("lab.toastPreBlur")} min={0} max={16} step={0.5} value={material.preblur} defaultValue={major.preblur} format={px} onChange={(preblur) => setMaterial({ preblur })} />
        <Slider label={uiText("lab.toastSaturation")} min={0} max={2} step={0.01} value={material.saturation} defaultValue={major.saturation} format={(value) => value.toFixed(2)} onChange={(saturation) => setMaterial({ saturation })} />
        <Slider label={uiText("lab.toastBrightness")} min={0.3} max={1.5} step={0.01} value={material.brightness} defaultValue={major.brightness} format={(value) => value.toFixed(2)} onChange={(brightness) => setMaterial({ brightness })} />
        <Slider label={uiText("lab.toastTint")} min={0} max={0.5} step={0.005} value={material.tintOpacity} defaultValue={major.tintOpacity} format={percent} onChange={(tintOpacity) => setMaterial({ tintOpacity })} />
        <Slider label={uiText("lab.toastRim")} min={0} max={0.6} step={0.005} value={material.rimAlpha} defaultValue={major.rimAlpha} format={percent} onChange={(rimAlpha) => setMaterial({ rimAlpha })} />
      </>}
      <Slider label={uiText("lab.toastShadow")} min={0} max={2} step={0.05} value={toast.shadowStrength} defaultValue={d.shadowStrength} format={percent} onChange={(shadowStrength) => set({ shadowStrength })} />
    </Section>
  );
}

/* ---------- Scene ---------- */

function SceneSection() {
  const backdrop = useLab((state) => state.backdrop);
  const backdropColor = useLab((state) => state.backdropColor);
  const shadows = useLab((state) => state.shadows);
  const overlayHeader = useLab((state) => state.overlayHeader);
  const heldBlur = useLab((state) => state.heldBlur);
  const accountCount = useLab((state) => state.accountCount);
  const seed = useLab((state) => state.seed);
  const dataSource = useLab((state) => state.dataSource);
  // Replacing saved accounts takes a second click ("armed"), instead of a browser confirm dialog.
  const [fill, setFill] = useState<"idle" | "armed" | "busy">("idle");
  const shownColor = backdropColor ?? BACKDROP_SPECS[backdrop].base;
  return (
    <Section title={uiText("lab.scene")}>
      <WindowFrameControls />
      <SubHead title={uiText("lab.background")} reset={resetFor("backdrop", backdrop)} />
      <div className="segmented">
        {BACKDROPS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            data-active={entry.id === backdrop || undefined}
            onClick={() => labStore.set({ backdrop: entry.id })}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <Field label={uiText("lab.colour")} reset={resetFor("backdropColor", backdropColor)}>
        <span className="lab-color">
          <input
            type="color"
            value={shownColor}
            aria-label={uiText("lab.backgroundColour")}
            onChange={(event) => labStore.set({ backdropColor: event.target.value })}
          />
          <span className="lab-color-value">{shownColor}</span>
        </span>
      </Field>
      <Check
        label={uiText("lab.shadows")}
        checked={shadows}
        onChange={(checked) => labStore.set({ shadows: checked })}
        reset={resetFor("shadows", shadows)}
      />
      <Check
        label={uiText("lab.headerOverlap")}
        checked={overlayHeader}
        onChange={(checked) => labStore.set({ overlayHeader: checked })}
        reset={resetFor("overlayHeader", overlayHeader)}
      />
      <HeaderFadeControls />
      <RowPlateControls />
      <SubHead title={uiText("lab.draggedRow")} reset={resetFor("heldBlur", heldBlur)} />
      <Slider
        label={uiText("lab.glassBlur")}
        min={0}
        max={40}
        step={1}
        value={heldBlur}
        defaultValue={DEFAULT_STATE.heldBlur}
        format={(value) => (value === 0 ? uiText("lab.off") : uiText("lab.units.pixels", { value: value }))}
        onChange={(value) => labStore.set({ heldBlur: value })}
      />
      <SubHead title={uiText("lab.list")} reset={resetFor("dataSource", dataSource)} />
      <div className="segmented">
        {(["database", "dummy"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            data-active={entry === dataSource || undefined}
            onClick={() => labStore.set({ dataSource: entry })}
          >
            {entry === "database" ? uiText("lab.roster.saved") : uiText("lab.roster.dummy")}
          </button>
        ))}
      </div>
      <p className="lab-note">
        {dataSource === "database"
          ? uiText("lab.roster.savedHelp")
          : uiText("lab.roster.dummyHelp")}
      </p>
      {dataSource === "database" && (
        <button
          type="button"
          className="lab-button"
          disabled={fill === "busy"}
          onBlur={() => setFill((current) => (current === "armed" ? "idle" : current))}
          onClick={() => {
            if (fill === "idle") {
              setFill("armed");
              return;
            }
            setFill("busy");
            fillDatabaseWithDummy()
              .catch((error: unknown) => console.error(uiText("lab.roster.replaceFailed"), error))
              .finally(() => setFill("idle"));
          }}
        >
          {fill === "armed" ? uiText("lab.roster.replaceConfirm") : uiText("lab.roster.replace")}
        </button>
      )}
      <Slider
        label={uiText("lab.accounts")}
        min={10}
        max={200}
        step={10}
        value={accountCount}
        defaultValue={DEFAULT_STATE.accountCount}
        format={(value) => String(value)}
        onChange={(value) => labStore.set({ accountCount: value })}
      />
      <div className="lab-check-row">
        <button
          type="button"
          className="lab-button"
          onClick={() => labStore.set((state) => ({ seed: state.seed + 1 }))}
        >{uiText("lab.rerollAccounts")}</button>
        <Reset {...resetFor("seed", seed)} />
      </div>
    </Section>
  );
}

function WindowFrameControls() {
  const chrome = useLab((state) => state.chrome);
  const note = WINDOW_CHROMES.find((entry) => entry.id === chrome)?.note;
  return (
    <>
      <SubHead title={uiText("lab.windowFrame")} reset={resetFor("chrome", chrome)} />
      <div className="segmented">
        {WINDOW_CHROMES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            data-active={entry.id === chrome || undefined}
            onClick={() => labStore.set({ chrome: entry.id })}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <p className="lab-note">{note}</p>
    </>
  );
}

function HeaderFadeControls() {
  const opacity = useLab((state) => state.headerFadeOpacity);
  const customColor = useLab((state) => state.headerFadeColor);
  const shownColor = useLab(headerFadeColor);
  return (
    <>
      <SubHead
        title={uiText("lab.headerFade")}
        reset={{
          changed: opacity !== DEFAULT_STATE.headerFadeOpacity || customColor !== DEFAULT_STATE.headerFadeColor,
          onReset: () =>
            labStore.set({
              headerFadeOpacity: DEFAULT_STATE.headerFadeOpacity,
              headerFadeColor: DEFAULT_STATE.headerFadeColor,
            }),
        }}
      />
      <Slider
        label={uiText("lab.strength")}
        min={0}
        max={1}
        step={0.01}
        value={opacity}
        defaultValue={DEFAULT_STATE.headerFadeOpacity}
        format={(value) => uiText("lab.units.percent", { value: Math.round(value * 100) })}
        onChange={(value) => labStore.set({ headerFadeOpacity: value })}
      />
      <Field label={uiText("lab.colour")} reset={resetFor("headerFadeColor", customColor)}>
        <span className="lab-color">
          <input
            type="color"
            value={shownColor}
            aria-label={uiText("lab.headerFadeColour")}
            onChange={(event) => labStore.set({ headerFadeColor: event.target.value })}
          />
          <span className="lab-color-value">{customColor ? shownColor : uiText("lab.defaultBackground")}</span>
        </span>
      </Field>
    </>
  );
}

const ROW_PLATE_KEYS = [
  "rowPlates",
  "rowPlateOpacity",
  "rowPlateRadius",
  "rowPlateHeight",
  "rowPlateOverhang",
  "rowPlateOutlineColor",
  "rowPlateOutlineOpacity",
] as const;

function RowPlateControls() {
  const plates = useLab((state) => state.rowPlates);
  const opacity = useLab((state) => state.rowPlateOpacity);
  const radius = useLab((state) => state.rowPlateRadius);
  const height = useLab((state) => state.rowPlateHeight);
  const overhang = useLab((state) => state.rowPlateOverhang);
  const outlineColor = useLab((state) => state.rowPlateOutlineColor);
  const outlineOpacity = useLab((state) => state.rowPlateOutlineOpacity);
  const changed = useLab((state) => ROW_PLATE_KEYS.some((key) => state[key] !== DEFAULT_STATE[key]));
  const px = (value: number) => `${value}px`;
  return (
    <>
      <SubHead
        title={uiText("lab.rowBackground")}
        reset={{
          changed,
          onReset: () =>
            labStore.set(Object.fromEntries(ROW_PLATE_KEYS.map((key) => [key, DEFAULT_STATE[key]])) as Partial<LabState>),
        }}
      />
      <div className="segmented">
        {ROW_PLATES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            data-active={entry.id === plates || undefined}
            onClick={() => labStore.set({ rowPlates: entry.id })}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <Slider
        label={uiText("lab.strength")}
        min={0}
        max={0.2}
        step={0.005}
        value={opacity}
        defaultValue={DEFAULT_STATE.rowPlateOpacity}
        format={(value) => uiText("lab.units.percent", { value: (value * 100).toFixed(1) })}
        onChange={(value) => labStore.set({ rowPlateOpacity: value })}
      />
      <Slider
        label={uiText("lab.radius")}
        min={0}
        max={40}
        step={1}
        value={radius}
        defaultValue={DEFAULT_STATE.rowPlateRadius}
        format={px}
        onChange={(value) => labStore.set({ rowPlateRadius: value })}
      />
      <Slider
        label={uiText("lab.height")}
        min={40}
        max={80}
        step={1}
        value={height}
        defaultValue={DEFAULT_STATE.rowPlateHeight}
        format={px}
        onChange={(value) => labStore.set({ rowPlateHeight: value })}
      />
      <Slider
        label={uiText("lab.widthEachSide")}
        min={-10}
        max={30}
        step={1}
        value={overhang}
        defaultValue={DEFAULT_STATE.rowPlateOverhang}
        format={(value) => uiText("lab.units.signedPixels", { sign: value > 0 ? "+" : "", value: value })}
        onChange={(value) => labStore.set({ rowPlateOverhang: value })}
      />
      <Field label={uiText("lab.outline")} reset={resetFor("rowPlateOutlineColor", outlineColor)}>
        <span className="lab-color">
          <input
            type="color"
            value={outlineColor ?? "#ffffff"}
            aria-label={uiText("lab.rowOutlineColour")}
            onChange={(event) => labStore.set({ rowPlateOutlineColor: event.target.value })}
          />
          <span className="lab-color-value">{outlineColor ?? uiText("lab.white")}</span>
        </span>
      </Field>
      <Slider
        label={uiText("lab.outlineOpacity")}
        min={0}
        max={1}
        step={0.01}
        value={outlineOpacity}
        defaultValue={DEFAULT_STATE.rowPlateOutlineOpacity}
        format={(value) => uiText("lab.units.percent", { value: Math.round(value * 100) })}
        onChange={(value) => labStore.set({ rowPlateOutlineOpacity: value })}
      />
    </>
  );
}

/* ---------- Tuning ---------- */

function TuningSection() {
  const tuning = useLab((state) => state.tuning);
  const majorRim = useLab((state) => state.majorRim);
  const defaults = DEFAULT_STATE.tuning;
  const setRole = (role: "major" | "minor", patch: Partial<RoleTuning>) =>
    labStore.set((state) => ({
      tuning: { ...state.tuning, [role]: { ...state.tuning[role], ...patch } },
    }));
  const setShared = (patch: Partial<Tuning>) =>
    labStore.set((state) => ({ tuning: { ...state.tuning, ...patch } }));
  const activePreset = PRESETS.find(
    (preset) => JSON.stringify(preset.tuning) === JSON.stringify(tuning),
  );

  return (
    <Section
      title={uiText("lab.material")}
      reset={{
        changed: JSON.stringify(tuning) !== JSON.stringify(defaults),
        onReset: () => labStore.set({ tuning: defaults }),
      }}
    >
      <Field
        label={uiText("lab.preset")}
        reset={{ changed: activePreset?.tuning !== defaults, onReset: () => labStore.set({ tuning: defaults }) }}
      >
        <select
          value={activePreset?.id ?? "custom"}
          onChange={(event) => {
            const preset = PRESETS.find((entry) => entry.id === event.target.value);
            if (preset) labStore.set({ tuning: preset.tuning });
          }}
        >
          {!activePreset && <option value="custom">{uiText("lab.custom")}</option>}
          {PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </Field>
      {activePreset && <p className="lab-note">{activePreset.note}</p>}
      <RoleControls
        title={uiText("lab.majorMaterialHeading")}
        tuning={tuning.major}
        defaults={defaults.major}
        rimControl={{
          mode: majorRim,
          reset: resetFor("majorRim", majorRim),
          onChange: (mode) => labStore.set({ majorRim: mode }),
        }}
        onChange={(patch) => setRole("major", patch)}
      />
      <RoleControls
        title={uiText("lab.minorMaterialHeading")}
        tuning={tuning.minor}
        defaults={defaults.minor}
        onChange={(patch) => setRole("minor", patch)}
      />
      <SubHead title={uiText("lab.shared")} />
      <Slider label={uiText("lab.overscan")} min={0} max={4} step={0.25} value={tuning.overscanRatio} defaultValue={defaults.overscanRatio} format={(value) => uiText("lab.units.multiplier", { value: value })} onChange={(value) => setShared({ overscanRatio: value })} />
      <Slider label={uiText("lab.rimHighlight")} min={0} max={2} step={0.05} value={tuning.specular} defaultValue={defaults.specular} format={(value) => value.toFixed(2)} onChange={(value) => setShared({ specular: value })} />
      <Slider label={uiText("lab.shadow")} min={0} max={2} step={0.05} value={tuning.shadowStrength} defaultValue={defaults.shadowStrength} format={(value) => value.toFixed(2)} onChange={(value) => setShared({ shadowStrength: value })} />
      <Slider label={uiText("lab.shellBody")} min={0} max={0.9} step={0.01} value={tuning.shellBody} defaultValue={defaults.shellBody} format={(value) => value.toFixed(2)} onChange={(value) => setShared({ shellBody: value })} />
    </Section>
  );
}

function RoleControls({
  title,
  tuning,
  defaults,
  rimControl,
  onChange,
}: {
  readonly title: string;
  readonly tuning: RoleTuning;
  readonly defaults: RoleTuning;
  /** Omitted for a material whose rim is not exposed (rows: no outline until highlights need one). */
  readonly rimControl?: {
    readonly mode: RimMode;
    readonly reset: { changed: boolean; onReset: () => void };
    readonly onChange: (mode: RimMode) => void;
  };
  readonly onChange: (patch: Partial<RoleTuning>) => void;
}) {
  // A hidden rim must not light up the heading's reset or be touched by it.
  const visible = (values: RoleTuning) =>
    JSON.stringify(rimControl ? values : { ...values, rimAlpha: 0 });
  const { rimAlpha: _hiddenRim, ...visibleDefaults } = defaults;
  return (
    <>
      <SubHead
        title={title}
        reset={{
          changed: visible(tuning) !== visible(defaults),
          onReset: () => onChange(rimControl ? defaults : visibleDefaults),
        }}
      />
      {rimControl && (
        <Field label={uiText("lab.rimStyle")} reset={rimControl.reset}>
          <select
            value={rimControl.mode}
            onChange={(event) => rimControl.onChange(event.target.value as RimMode)}
          >
            {RIM_MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Slider label={uiText("lab.blur")} min={0} max={80} step={0.5} value={tuning.blur} defaultValue={defaults.blur} format={(value) => uiText("lab.units.pixels", { value: value })} onChange={(value) => onChange({ blur: value })} />
      <Slider label={uiText("lab.preBlur")} min={0} max={16} step={0.5} value={tuning.preblur} defaultValue={defaults.preblur} format={(value) => uiText("lab.units.pixels", { value: value })} onChange={(value) => onChange({ preblur: value })} />
      <Slider label={uiText("lab.saturation")} min={0} max={2} step={0.01} value={tuning.saturation} defaultValue={defaults.saturation} format={(value) => value.toFixed(2)} onChange={(value) => onChange({ saturation: value })} />
      <Slider label={uiText("lab.brightness")} min={0.3} max={1.5} step={0.01} value={tuning.brightness} defaultValue={defaults.brightness} format={(value) => value.toFixed(2)} onChange={(value) => onChange({ brightness: value })} />
      <Slider label={uiText("lab.tint")} min={0} max={0.5} step={0.005} value={tuning.tintOpacity} defaultValue={defaults.tintOpacity} format={(value) => value.toFixed(3)} onChange={(value) => onChange({ tintOpacity: value })} />
      <Slider label={uiText("lab.radius")} min={0} max={28} step={0.5} value={tuning.radius} defaultValue={defaults.radius} format={(value) => uiText("lab.units.pixels", { value: value })} onChange={(value) => onChange({ radius: value })} />
      {rimControl && (
        <Slider label={uiText("lab.rim")} min={0} max={0.6} step={0.005} value={tuning.rimAlpha} defaultValue={defaults.rimAlpha} format={(value) => value.toFixed(3)} onChange={(value) => onChange({ rimAlpha: value })} />
      )}
    </>
  );
}

/* ---------- Rank picker ---------- */

function PickerSection() {
  const picker = useLab((state) => state.picker);
  const d = DEFAULT_PICKER;
  const set = (patch: Partial<PickerTuning>) =>
    labStore.set((state) => ({ picker: { ...state.picker, ...patch } }));
  const px = (value: number) => `${value}px`;
  const alpha = (value: number) => value.toFixed(2);

  return (
    <Section
      title={uiText("lab.rankPicker")}
      reset={{
        changed: JSON.stringify(picker) !== JSON.stringify(d),
        onReset: () => labStore.set({ picker: DEFAULT_PICKER }),
      }}
    >
      <button
        type="button"
        className="lab-button"
        onClick={() => document.querySelector<HTMLElement>(".list-content .badge")?.click()}
      >{uiText("lab.pickerPreview")}</button>
      <p className="lab-note">{uiText("lab.pickerPreviewHelp")}</p>

      <SubHead title={uiText("lab.sizes")} />
      <Slider label={uiText("lab.cell")} min={32} max={80} step={1} value={picker.cell} defaultValue={d.cell} format={px} onChange={(cell) => set({ cell })} />
      <Slider label={uiText("lab.emblem")} min={20} max={72} step={1} value={picker.emblem} defaultValue={d.emblem} format={px} onChange={(emblem) => set({ emblem })} />
      <Slider label={uiText("lab.gap")} min={0} max={24} step={1} value={picker.gap} defaultValue={d.gap} format={px} onChange={(gap) => set({ gap })} />
      <Slider label={uiText("lab.radius")} min={0} max={26} step={0.5} value={picker.radius} defaultValue={d.radius} format={px} onChange={(radius) => set({ radius })} />
      <Slider label={uiText("lab.padding")} min={4} max={32} step={1} value={picker.padding} defaultValue={d.padding} format={px} onChange={(padding) => set({ padding })} />
      <Slider label={uiText("lab.division")} min={14} max={40} step={1} value={picker.divisionSize} defaultValue={d.divisionSize} format={px} onChange={(divisionSize) => set({ divisionSize })} />
      <Slider label={uiText("lab.confirmHeight")} min={28} max={64} step={1} value={picker.confirmHeight} defaultValue={d.confirmHeight} format={px} onChange={(confirmHeight) => set({ confirmHeight })} />
      <Slider label={uiText("lab.confirmRadius")} min={0} max={32} step={0.5} value={picker.confirmRadius} defaultValue={d.confirmRadius} format={px} onChange={(confirmRadius) => set({ confirmRadius })} />
      <Slider label={uiText("lab.blur")} min={0} max={60} step={0.5} value={picker.blur} defaultValue={d.blur} format={px} onChange={(blur) => set({ blur })} />
      <Slider label={uiText("lab.offset")} min={0} max={40} step={1} value={picker.offset} defaultValue={d.offset} format={px} onChange={(offset) => set({ offset })} />

      <SubHead title={uiText("lab.look")} />
      <Slider label={uiText("lab.cellFill")} min={0} max={0.4} step={0.01} value={picker.fill} defaultValue={d.fill} format={alpha} onChange={(fill) => set({ fill })} />
      <Slider label={uiText("lab.selected")} min={0} max={1} step={0.01} value={picker.selected} defaultValue={d.selected} format={alpha} onChange={(selected) => set({ selected })} />
      <Slider label={uiText("lab.outline")} min={0} max={4} step={0.5} value={picker.selectedWidth} defaultValue={d.selectedWidth} format={px} onChange={(selectedWidth) => set({ selectedWidth })} />
    </Section>
  );
}

/* ---------- Benchmark ---------- */

function BenchmarkSection() {
  const results = useSyncExternalStore(benchmarkResults.subscribe, benchmarkResults.get);
  const [busy, setBusy] = useState("");
  const [seconds, setSeconds] = useState(6);
  const [copied, setCopied] = useState(false);

  const run = async (task: () => Promise<unknown>, label: string) => {
    if (busy) return;
    setBusy(label);
    try {
      await task();
    } finally {
      setBusy("");
    }
  };

  return (
    <Section title={uiText("lab.benchmark")}>
      <p className="lab-note">{uiText("lab.benchmarkHelp")}</p>
      <Slider label={uiText("lab.duration")} min={3} max={15} step={1} value={seconds} defaultValue={6} format={(value) => uiText("lab.units.seconds", { value: value })} onChange={setSeconds} />
      <div className="lab-row">
        <button type="button" className="lab-button" disabled={!!busy} onClick={() => run(() => runScrollBenchmark(seconds * 1000), uiText("lab.running"))}>{uiText("lab.runCurrent")}</button>
        <button
          type="button"
          className="lab-button lab-button-primary"
          disabled={!!busy}
          onClick={() => run(() => runStrategySweep(seconds * 1000, (label) => setBusy(label || uiText("lab.running"))), uiText("lab.running"))}
        >{uiText("lab.compareAllModes")}</button>
      </div>
      {busy && <p className="lab-note lab-busy">{busy}</p>}
      {results.length > 0 && (
        <>
          <table className="results">
            <thead>
              <tr>
                <th>{uiText("lab.mode")}</th>
                <th>{uiText("lab.scene")}</th>
                <th>{uiText("lab.p50")}</th>
                <th>{uiText("lab.p95")}</th>
                <th>{uiText("lab.long")}</th>
                <th>{uiText("lab.vsOff")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => {
                const base = results.find(
                  (candidate) =>
                    candidate.strategy === "off" &&
                    candidate.backdrop === result.backdrop &&
                    candidate.accounts === result.accounts,
                );
                const ratio = base && base.stats.p95 > 0 ? result.stats.p95 / base.stats.p95 : null;
                return (
                  <tr key={result.id} title={uiText("lab.benchmarkRowTooltip", { tuning: result.tuning, rim: result.rim, filterLayers: result.filterLayers, megapixels: result.blurredMegapixels.toFixed(1) })}>
                    <td>{result.strategy}</td>
                    <td>{result.backdrop}</td>
                    <td>{result.stats.median.toFixed(1)}</td>
                    <td>{result.stats.p95.toFixed(1)}</td>
                    <td>{result.stats.longPercent.toFixed(0)}{uiText("lab.units.percentSymbol")}</td>
                    <td data-bad={ratio !== null && ratio > 1.25 ? "" : undefined}>
                      {ratio === null ? uiText("lab.missingValue") : uiText("lab.units.ratio", { ratio: ratio.toFixed(2) })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="lab-note">{uiText("lab.benchmarkResultsHelp")}</p>
          <div className="lab-row">
            <button
              type="button"
              className="lab-button"
              onClick={() => {
                void navigator.clipboard.writeText(resultsMarkdown(results)).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                });
              }}
            >
              {copied ? uiText("lab.copied") : uiText("lab.copyAsMarkdown")}
            </button>
            <button type="button" className="lab-button" onClick={benchmarkResults.clear}>{uiText("lab.clear")}</button>
          </div>
        </>
      )}
      <button type="button" className="lab-link" onClick={labStore.reset}>{uiText("lab.resetAllLabSettings")}</button>
    </Section>
  );
}
