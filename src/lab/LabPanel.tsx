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
  DEFAULT_AMBIENT,
  DEFAULT_SMOKE,
  DEFAULT_STATE,
  type AmbientTuning,
  type SmokeTuning,
  labStore,
  ROW_PLATES,
  useLab,
  WINDOW_CHROMES,
  type LabState,
} from "./store";

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
type LabTab = "window" | "background" | "ascii" | "rows" | "data" | "benchmark";

const LAB_TABS: readonly { id: LabTab; label: string }[] = [
  { id: "window", label: uiText("lab.tabs.window") },
  { id: "background", label: uiText("lab.tabs.background") },
  { id: "ascii", label: uiText("lab.tabs.ascii") },
  { id: "rows", label: uiText("lab.tabs.rows") },
  { id: "data", label: uiText("lab.tabs.data") },
  { id: "benchmark", label: uiText("lab.tabs.benchmark") },
];

export function LabPanel() {
  const [tab, setTab] = useState<LabTab>("window");
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
        <div className="segmented lab-tabs" role="tablist" aria-label={uiText("lab.tabs.label")}>
          {LAB_TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === tab}
              data-active={entry.id === tab || undefined}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {tab === "window" && <WindowSection />}
        {tab === "background" && <BackgroundSection />}
        {tab === "ascii" && <AsciiSection />}
        {tab === "rows" && <RowsSection />}
        {tab === "data" && <DataSection />}
        {tab === "benchmark" && <BenchmarkSection />}
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

/* ---------- Window ---------- */

function WindowSection() {
  const shadows = useLab((state) => state.shadows);
  const overlayHeader = useLab((state) => state.overlayHeader);
  return (
    <Section title={uiText("lab.tabs.window")}>
      <WindowFrameControls />
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
    </Section>
  );
}

/* ---------- Background ---------- */

function BackgroundSection() {
  const backdrop = useLab((state) => state.backdrop);
  const backdropColor = useLab((state) => state.backdropColor);
  const shownColor = backdropColor ?? BACKDROP_SPECS[backdrop].base;
  return (
    <Section title={uiText("lab.background")} reset={resetFor("backdrop", backdrop)}>
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
      <AmbientControls />
    </Section>
  );
}

function AmbientControls() {
  const ambient = useLab((state) => state.ambient);
  const active = useLab((state) => state.backdrop === "ambient");
  const d = DEFAULT_AMBIENT;
  const set = (patch: Partial<AmbientTuning>) => labStore.set((state) => ({ ambient: { ...state.ambient, ...patch } }));
  const setColour = (index: number, value: string) =>
    set({ colors: ambient.colors.map((current, at) => (at === index ? value : current)) as unknown as AmbientTuning["colors"] });
  const fixed = (digits: number) => (value: number) => value.toFixed(digits);
  return (
    <>
      <SubHead title={uiText("lab.ambient.title")} reset={{ changed: JSON.stringify(ambient) !== JSON.stringify(d), onReset: () => set(d) }} />
      {!active && (
        <button type="button" className="lab-button" onClick={() => labStore.set({ backdrop: "ambient" })}>
          {uiText("lab.ambient.use")}
        </button>
      )}
      {ambient.colors.map((colour, index) => (
        <Field
          key={index}
          label={uiText("lab.ambient.colour", { number: index + 1 })}
          reset={{ changed: colour !== d.colors[index], onReset: () => setColour(index, d.colors[index]!) }}
        >
          <span className="lab-color">
            <input type="color" value={colour} aria-label={uiText("lab.ambient.colourLabel", { number: index + 1 })} onChange={(event) => setColour(index, event.target.value)} />
            <span className="lab-color-value">{colour}</span>
          </span>
        </Field>
      ))}
      <Slider label={uiText("lab.ambient.intensity")} min={0} max={1} step={0.01} value={ambient.intensity} defaultValue={d.intensity} format={fixed(2)} onChange={(intensity) => set({ intensity })} />
      <Slider label={uiText("lab.ambient.size")} min={0.1} max={1.2} step={0.01} value={ambient.size} defaultValue={d.size} format={fixed(2)} onChange={(size) => set({ size })} />
      <Slider label={uiText("lab.ambient.softness")} min={0} max={1} step={0.01} value={ambient.softness} defaultValue={d.softness} format={fixed(2)} onChange={(softness) => set({ softness })} />
      <Slider label={uiText("lab.ambient.speed")} min={0} max={3} step={0.05} value={ambient.speed} defaultValue={d.speed} format={fixed(2)} onChange={(speed) => set({ speed })} />
      <Slider label={uiText("lab.ambient.drift")} min={0} max={0.5} step={0.01} value={ambient.drift} defaultValue={d.drift} format={fixed(2)} onChange={(drift) => set({ drift })} />
      <Slider label={uiText("lab.ambient.updates")} min={6} max={120} step={6} value={ambient.updates} defaultValue={d.updates} format={fixed(0)} onChange={(updates) => set({ updates })} />
      <Slider label={uiText("lab.ambient.grain")} min={0} max={4} step={0.1} value={ambient.grain} defaultValue={d.grain} format={fixed(1)} onChange={(grain) => set({ grain })} />
      <Slider label={uiText("lab.ambient.parallax")} min={0} max={3} step={0.05} value={ambient.parallax} defaultValue={d.parallax} format={fixed(2)} onChange={(parallax) => set({ parallax })} />
      <div className="lab-check-row">
        <button type="button" className="lab-button" onClick={() => set({ seed: ambient.seed + 1 })}>
          {uiText("lab.ambient.shuffle")}
        </button>
      </div>
    </>
  );
}

/* ---------- ASCII (the smoke backdrop) ---------- */

function AsciiSection() {
  const smoke = useLab((state) => state.smoke);
  const active = useLab((state) => state.backdrop === "smoke");
  const d = DEFAULT_SMOKE;
  const set = (patch: Partial<SmokeTuning>) => labStore.set((state) => ({ smoke: { ...state.smoke, ...patch } }));
  // The character field keeps what's typed; only a usable set (a leading space, 2+ glyphs) applies.
  const [characters, setCharacters] = useState(smoke.charset);
  useEffect(() => setCharacters(smoke.charset), [smoke.charset]);
  const fixed = (digits: number) => (value: number) => value.toFixed(digits);
  const colour = (key: "ink" | "accent", label: string, aria: string) => (
    <Field label={label} reset={{ changed: smoke[key] !== d[key], onReset: () => set({ [key]: d[key] }) }}>
      <span className="lab-color">
        <input type="color" value={smoke[key]} aria-label={aria} onChange={(event) => set({ [key]: event.target.value })} />
        <span className="lab-color-value">{smoke[key]}</span>
      </span>
    </Field>
  );
  return (
    <Section title={uiText("lab.smoke.title")} reset={{ changed: JSON.stringify(smoke) !== JSON.stringify(d), onReset: () => set(d) }}>
      {!active && (
        <button type="button" className="lab-button" onClick={() => labStore.set({ backdrop: "smoke" })}>
          {uiText("lab.smoke.use")}
        </button>
      )}
      <Field label={uiText("lab.smoke.characters")} reset={{ changed: smoke.charset !== d.charset, onReset: () => set({ charset: d.charset }) }}>
        <input
          type="text"
          className="lab-text"
          value={characters}
          spellCheck={false}
          aria-label={uiText("lab.smoke.charactersLabel")}
          onChange={(event) => {
            const value = event.target.value;
            setCharacters(value);
            if (value.startsWith(" ") && [...value].length >= 2 && [...value].length <= 32) set({ charset: value });
          }}
        />
      </Field>
      <Slider label={uiText("lab.smoke.cellHeight")} min={8} max={32} step={1} value={smoke.cellHeight} defaultValue={d.cellHeight} format={(value) => uiText("lab.units.pixels", { value: value })} onChange={(cellHeight) => set({ cellHeight })} />
      <Slider label={uiText("lab.smoke.speed")} min={0} max={3} step={0.05} value={smoke.speed} defaultValue={d.speed} format={fixed(2)} onChange={(speed) => set({ speed })} />
      <Slider label={uiText("lab.smoke.updates")} min={6} max={240} step={6} value={smoke.updates} defaultValue={d.updates} format={fixed(0)} onChange={(updates) => set({ updates })} />
      <Slider label={uiText("lab.smoke.trail")} min={0} max={0.95} step={0.01} value={smoke.trail} defaultValue={d.trail} format={fixed(2)} onChange={(trail) => set({ trail })} />
      <Slider label={uiText("lab.smoke.contrast")} min={0.3} max={2.5} step={0.05} value={smoke.contrast} defaultValue={d.contrast} format={fixed(2)} onChange={(contrast) => set({ contrast })} />
      <Slider label={uiText("lab.smoke.brightness")} min={-0.5} max={0.5} step={0.01} value={smoke.brightness} defaultValue={d.brightness} format={fixed(2)} onChange={(brightness) => set({ brightness })} />
      <Slider label={uiText("lab.smoke.opacity")} min={0} max={1} step={0.01} value={smoke.opacity} defaultValue={d.opacity} format={fixed(2)} onChange={(opacity) => set({ opacity })} />
      {colour("ink", uiText("lab.smoke.ink"), uiText("lab.smoke.inkColour"))}
      {colour("accent", uiText("lab.smoke.accent"), uiText("lab.smoke.accentColour"))}
    </Section>
  );
}

/* ---------- Rows ---------- */

function RowsSection() {
  const heldBlur = useLab((state) => state.heldBlur);
  return (
    <Section title={uiText("lab.tabs.rows")}>
      <RowPlateControls />
      <SubHead title={uiText("lab.draggedRow.title")} reset={resetFor("heldBlur", heldBlur)} />
      <Slider
        label={uiText("lab.draggedRow.blur")}
        min={0}
        max={40}
        step={0.5}
        value={heldBlur}
        defaultValue={DEFAULT_STATE.heldBlur}
        format={(value) => (value === 0 ? uiText("lab.draggedRow.off") : uiText("lab.units.pixels", { value: value }))}
        onChange={(value) => labStore.set({ heldBlur: value })}
      />
    </Section>
  );
}

/* ---------- Data ---------- */

function DataSection() {
  const accountCount = useLab((state) => state.accountCount);
  const seed = useLab((state) => state.seed);
  const dataSource = useLab((state) => state.dataSource);
  // Replacing saved accounts takes a second click ("armed"), instead of a browser confirm dialog.
  const [fill, setFill] = useState<"idle" | "armed" | "busy">("idle");
  return (
    <Section title={uiText("lab.list")} reset={resetFor("dataSource", dataSource)}>
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
