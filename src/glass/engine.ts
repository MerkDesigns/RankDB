import { DEFAULT_ACCENT, settingsStore, type AppSettings } from "../data/settingsStore";
import { labStore, type LabState } from "../lab/store";
import { resolveBackdrop } from "./backdrops";
import { bakeBackdrop } from "./bake";
import {
  overscanPx,
  RIM,
  SHADOW,
  TINT_RGB,
  type GlassRole,
  type RoleTuning,
  type Tuning,
} from "./recipes";
import { clearRimCache, cssRimAlphas, paintRimCanvas, rimImageUrl } from "./rim";

/**
 * Everything derived from lab state that lives outside React: CSS variables, rim images,
 * filter-output masks and baked backdrops. Sliders only touch this, never the component tree.
 */

const root = document.documentElement;

export function roundedRectMask(radius: number): string {
  // The SVG viewport follows mask-size; vmin clamps both corner axes like border-radius does.
  const corner = `min(${radius}px,50vmin)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="${radius}" fill="white" style="rx:${corner};ry:${corner}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function applyRoleVars(role: GlassRole | "toast", tuning: RoleTuning, all: Tuning) {
  const prefix = `--${role}`;
  const materialRole = role === "toast" ? "major" : role;
  const [red, green, blue] = TINT_RGB[materialRole];
  const shadow = SHADOW[materialRole];
  const opacity = shadow.opacity * all.shadowStrength;
  const rim = cssRimAlphas(tuning.rimAlpha, all.specular);
  const vars: Record<string, string> = {
    [`${prefix}-blur`]: `${tuning.blur}px`,
    [`${prefix}-pre`]: `${tuning.preblur}px`,
    [`${prefix}-sat`]: String(tuning.saturation),
    [`${prefix}-bright`]: String(tuning.brightness),
    [`${prefix}-tint`]: `rgb(${red} ${green} ${blue} / ${tuning.tintOpacity})`,
    [`${prefix}-radius`]: `${tuning.radius}px`,
    [`${prefix}-os`]: `${overscanPx(tuning, all.overscanRatio)}px`,
    [`${prefix}-mask`]: roundedRectMask(tuning.radius),
    [`${prefix}-shadow`]: [
      `0 ${shadow.y}px ${Math.max(0, shadow.blur - 4)}px ${shadow.spread}px rgb(0 0 0 / ${opacity * 0.58})`,
      `0 ${shadow.y + 1}px ${shadow.blur}px ${Math.max(-4, shadow.spread - 1)}px rgb(0 0 0 / ${opacity * 0.42})`,
    ].join(", "),
    // Overlays (pickers, dialogs) always cast TaskMap's full shadow; the strength setting is for rows.
    [`${prefix}-shadow-overlay`]: [
      `0 ${shadow.y}px ${Math.max(0, shadow.blur - 4)}px ${shadow.spread}px rgb(0 0 0 / ${shadow.opacity * 0.58})`,
      `0 ${shadow.y + 1}px ${shadow.blur}px ${Math.max(-4, shadow.spread - 1)}px rgb(0 0 0 / ${shadow.opacity * 0.42})`,
    ].join(", "),
    [`${prefix}-rim-top`]: `rgb(255 255 255 / ${rim.top})`,
    [`${prefix}-rim-bottom`]: `rgb(255 255 255 / ${rim.bottom})`,
    [`${prefix}-rim-side`]: `rgb(255 255 255 / ${rim.side})`,
    [`${prefix}-rim-hot`]: `rgb(255 255 255 / ${rim.hot})`,
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}

function applyTuning(tuning: Tuning) {
  applyRoleVars("major", tuning.major, tuning);
  applyRoleVars("minor", tuning.minor, tuning);
  root.style.setProperty("--shell-body", `rgb(10 12 16 / ${tuning.shellBody})`);
  // A 0px pre-blur pass is still a backdrop-filter layer; drop it instead of paying for nothing.
  root.dataset.majorPre = tuning.major.preblur > 0 ? "on" : "off";
  root.dataset.minorPre = tuning.minor.preblur > 0 ? "on" : "off";
}

/* ---------- Exact rim: one image per unique surface size ---------- */

const rimElements = new Set<HTMLElement>();
const rimObserver = new ResizeObserver((entries) => {
  for (const entry of entries) paintRim(entry.target as HTMLElement);
});

/** Scroll-edge slices (scrollEdgeMorph.ts): top/right/bottom/left insets of the visible part. */
const rimSlices = new WeakMap<HTMLElement, readonly number[]>();
export interface RimGeometry {
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}
const rimGeometry = new WeakMap<HTMLElement, RimGeometry>();

export function setRimSlice(element: HTMLElement, insets: readonly number[] | null, geometry?: RimGeometry) {
  if (insets) rimSlices.set(element, insets);
  else rimSlices.delete(element);
  if (geometry) rimGeometry.set(element, geometry);
  else rimGeometry.delete(element);
  paintRim(element, geometry?.radius);
}

function paintRim(element: HTMLElement, measuredRadius?: number) {
  const state = labStore.get();
  const role = (element.dataset.role ?? "minor") as GlassRole;
  // Overlay surfaces always need an edge, so they use the header's rim style whatever their material.
  const mode = role === "major" || element.dataset.overlay !== undefined ? state.majorRim : state.minorRim;
  const canvas = element.dataset.live === undefined ? null : element.querySelector<HTMLCanvasElement>(":scope > .g-rim > canvas");
  // Live glass falls back to the CSS rim unless its rim style is exact.
  if (canvas) element.toggleAttribute("data-rim-canvas", mode === "exact" && state.strategy !== "off");
  if (mode !== "exact" || state.strategy === "off") return;
  const roleTuning = element.classList.contains("sonner-major-material")
    ? state.toasts.material ?? state.tuning.major : state.tuning[role];
  // Only the app is zoomed by the UI scale; overlays (Settings, rank picker) render at 100%.
  const zoom = element.closest(".app") ? settingsStore.get().uiScale : 1;
  const [top = 0, right = 0, bottom = 0, left = 0] = rimSlices.get(element) ?? [];
  // Scroll-edge morphs supply fractional layout geometry from their read pass. Rounding the
  // full height with offsetHeight first made thin rims disagree with the body/content clip.
  const geometry = rimGeometry.get(element);
  const width = (geometry?.width ?? element.offsetWidth) - right - left;
  const height = (geometry?.height ?? element.offsetHeight) - top - bottom;
  if (width <= 0 || height <= 0) return;
  // Repaints caused by lab tuning must read the current radius, rather than a scroll-time cache.
  const radius = measuredRadius ?? (parseFloat(getComputedStyle(element).borderTopLeftRadius) || roleTuning.radius);
  if (canvas) {
    paintRimCanvas(canvas, {
      width,
      height,
      radius,
      dpr: Math.min(3, (window.devicePixelRatio || 1) * zoom),
      baseAlpha: roleTuning.rimAlpha,
      specular: state.tuning.specular,
      strokePx: RIM.widthPx / zoom,
      softnessPx: RIM.softnessPx / zoom,
    });
    return;
  }
  element.style.setProperty(
    "--rim-img",
    rimImageUrl({
      width,
      height,
      // A surface may round differently from its role (picker selectors follow the lab's radius).
      radius,
      dpr: Math.min(3, (window.devicePixelRatio || 1) * zoom),
      baseAlpha: roleTuning.rimAlpha,
      specular: state.tuning.specular,
      // The UI scale zooms the rim too; undo it so it stays TaskMap's width on screen.
      strokePx: RIM.widthPx / zoom,
      softnessPx: RIM.softnessPx / zoom,
    }),
  );
}

export function registerRim(element: HTMLElement): () => void {
  rimElements.add(element);
  rimObserver.observe(element);
  return () => {
    rimElements.delete(element);
    rimObserver.unobserve(element);
  };
}

function repaintAllRims() {
  clearRimCache();
  rimElements.forEach((element) => paintRim(element));
}

/* ---------- Baked backdrops ---------- */

const bakedElements = new Set<HTMLElement>();
let bakeGeneration = 0;
let bakeUrls: string[] = [];
let bakeReady: Promise<void> = Promise.resolve();
let lastBakeKey = "";

/** Window size in the app's local (un-zoomed) CSS pixels. */
export function localViewport(zoom = settingsStore.get().uiScale) {
  return { width: window.innerWidth / zoom, height: window.innerHeight / zoom };
}

function bakeKey(state: EngineState) {
  const { width, height } = localViewport(state.uiScale);
  const role = (tuning: RoleTuning) =>
    `${tuning.blur}/${tuning.preblur}/${tuning.saturation}/${tuning.brightness}`;
  return `${state.backdrop}|${state.backdropColor ?? ""}|${Math.round(width)}x${Math.round(height)}|${role(state.tuning.major)}|${role(state.tuning.minor)}`;
}

function scheduleBake(state: EngineState) {
  if (state.strategy !== "baked") return;
  const key = bakeKey(state);
  if (key === lastBakeKey) return;
  lastBakeKey = key;
  const generation = ++bakeGeneration;
  const spec = resolveBackdrop(state.backdrop, state.backdropColor);
  const { width, height } = localViewport(state.uiScale);
  root.dataset.bakeState = "baking";
  bakeReady = Promise.all([
    bakeBackdrop(spec, width, height, state.tuning.major),
    bakeBackdrop(spec, width, height, state.tuning.minor),
  ])
    .then(([major, minor]) => {
      if (generation !== bakeGeneration) {
        URL.revokeObjectURL(major);
        URL.revokeObjectURL(minor);
        return;
      }
      root.style.setProperty("--bake-major", `url("${major}")`);
      root.style.setProperty("--bake-minor", `url("${minor}")`);
      root.style.setProperty("--bake-size", `${width}px ${height}px`);
      bakeUrls.forEach((url) => URL.revokeObjectURL(url));
      bakeUrls = [major, minor];
      root.dataset.bakeState = "ready";
      positionBakedElements();
    })
    .catch((error: unknown) => {
      console.error("Backdrop bake failed", error);
      root.dataset.bakeState = "failed";
    });
}

export const whenBakeReady = () => bakeReady;

/** Baked surfaces outside the scroller show the part of the image that lies behind them. */
export function registerBaked(element: HTMLElement): () => void {
  bakedElements.add(element);
  positionBaked(element);
  return () => bakedElements.delete(element);
}

function positionBaked(element: HTMLElement) {
  const zoom = settingsStore.get().uiScale;
  const rect = element.getBoundingClientRect();
  element.style.backgroundPosition = `${-rect.left / zoom}px ${-rect.top / zoom}px`;
}

export function positionBakedElements() {
  bakedElements.forEach(positionBaked);
}

/* ---------- Columns ---------- */

/** Track widths in px, in order. Each gets [name-start] … [name-end] lines for placement. */
const COLUMNS = [
  { name: "lead", width: 92, setting: "showCredentialButtons" },
  { name: "name", width: 236 },
  { name: "ranks", width: 344 },
  { name: "sixv6", width: 114, setting: "showSixV6" },
  { name: "va", width: 186, setting: "showCurrency" },
  { name: "vb", width: 124, setting: "showCurrency" },
] as const;
const COLUMN_GAP = 12;

/**
 * Grid for the shared header/row layout. A hidden column takes no space, but its line names stay
 * on the neighbouring line, so anything spanning it (e.g. the first header island, lead→name)
 * still places correctly.
 */
function applyColumns(state: AppSettings) {
  const parts: string[] = [];
  let pendingNames: string[] = [];
  let width = 0;
  let shown = 0;
  for (const column of COLUMNS) {
    const visible = !("setting" in column) || state[column.setting];
    if (!visible) {
      pendingNames.push(`${column.name}-start`, `${column.name}-end`);
      continue;
    }
    pendingNames.push(`${column.name}-start`);
    parts.push(`[${pendingNames.join(" ")}] ${column.width}px`);
    pendingNames = [`${column.name}-end`];
    width += column.width;
    shown += 1;
  }
  parts.push(`[${pendingNames.join(" ")}]`);
  root.style.setProperty("--cols", parts.join(" "));
  root.style.setProperty("--grid-w", `${width + COLUMN_GAP * (shown - 1)}px`);
  root.dataset.showCredentials = String(state.showCredentialButtons);
  root.dataset.showSixv6 = String(state.showSixV6);
  root.dataset.showCurrency = String(state.showCurrency);
}

/* ---------- Rank picker look ---------- */

function applyPicker(picker: LabState["picker"], tuning: Tuning) {
  const vars: Record<string, string> = {
    "--picker-blur": `${picker.blur}px`,
    "--picker-os": `${overscanPx({ ...tuning.major, blur: picker.blur }, tuning.overscanRatio)}px`,
    "--picker-cell": `${picker.cell}px`,
    "--picker-emblem": `${picker.emblem}px`,
    "--picker-gap": `${picker.gap}px`,
    "--picker-radius": `${picker.radius}px`,
    "--picker-fill": `rgb(255 255 255 / ${picker.fill})`,
    "--picker-fill-hover": `rgb(255 255 255 / ${Math.min(1, picker.fill * 2)})`,
    "--picker-selected": `rgb(226 232 240 / ${picker.selected})`,
    "--picker-selected-width": `${picker.selectedWidth}px`,
    "--picker-division-size": `${picker.divisionSize}px`,
    "--picker-confirm-h": `${picker.confirmHeight}px`,
    "--picker-confirm-radius": `${picker.confirmRadius}px`,
    "--picker-pad": `${picker.padding}px`,
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  // Canvas rims bake in their radius, and a radius change alone doesn't resize anything, so the
  // picker's rims (rank indicator, Predicted, Confirm) are redrawn with the new corners.
  rimElements.forEach((element) => {
    if (element.closest(".picker")) paintRim(element);
  });
}

/* ---------- Header fade ---------- */

function hexToRgbChannels(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

/** The fade's colour: its own, or the background's so it blends into the backdrop by default. */
export function headerFadeColor(state: LabState): string {
  return state.headerFadeColor ?? resolveBackdrop(state.backdrop, state.backdropColor).base;
}

/** The app accent, as a colour and as space-separated channels for rgb(… / alpha). */
function applyAccent(state: AppSettings) {
  const accent = state.accentColor ?? DEFAULT_ACCENT;
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-rgb", hexToRgbChannels(accent));
}

function applyHeaderFade(state: LabState) {
  root.style.setProperty("--fade-rgb", hexToRgbChannels(headerFadeColor(state)));
  root.style.setProperty("--fade-a", String(state.headerFadeOpacity));
}

function applyRowPlates(state: LabState) {
  root.dataset.rowPlates = state.rowPlates;
  root.style.setProperty("--row-plate-a", String(state.rowPlateOpacity));
  root.style.setProperty("--row-plate-radius", `${state.rowPlateRadius}px`);
  root.style.setProperty("--row-plate-h", `${state.rowPlateHeight}px`);
  root.style.setProperty("--row-plate-x", `${state.rowPlateOverhang}px`);
  root.style.setProperty("--row-outline-rgb", hexToRgbChannels(state.rowPlateOutlineColor ?? "#ffffff"));
  root.style.setProperty("--row-outline-a", String(state.rowPlateOutlineOpacity));
  root.style.setProperty("--held-blur", `${state.heldBlur}px`);
}

/* ---------- Wiring ---------- */

function applyToasts(state: LabState) {
  const toast = state.toasts;
  const material = toast.material ?? state.tuning.major;
  // The same Major material implementation, with optional notification-only tuning.
  applyRoleVars("toast", material, { ...state.tuning, shadowStrength: toast.shadowStrength });
  root.dataset.toastPre = material.preblur > 0 ? "on" : "off";
  const vars: Record<string, string> = {
    "--toast-icon-size": `${toast.iconSize}px`,
    "--toast-icon-stroke": String(toast.iconStroke),
    "--toast-text-alpha": String(toast.textOpacity),
    "--toast-detail-alpha": String(toast.detailOpacity),
    "--toast-edge-x": `${toast.edgeX}px`,
    "--toast-edge-y": `${toast.edgeY}px`,
    "--toast-move-ms": `${320 / toast.motionSpeed}ms`,
    // Sonner releases removed nodes after 200ms; material must finish within that budget.
    "--toast-fade-ms": `${160 / toast.motionSpeed}ms`,
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}

/** Glass looks come from the lab; columns, accent and UI scale from the app's settings. */
type EngineState = LabState & AppSettings;
/** Tuning that replaces the lab's (the installer's own glass); null in the app. */
let tuningOverride: Tuning | null = null;
const current = (): EngineState => {
  const state = { ...labStore.get(), ...settingsStore.get() };
  return tuningOverride ? { ...state, tuning: tuningOverride } : state;
};

let previous: EngineState | null = null;
let rimFrame = 0;
let toastRimFrame = 0;

function sync(state: EngineState) {
  if (!previous || previous.tuning !== state.tuning) applyTuning(state.tuning);
  if (!previous || previous.toasts !== state.toasts || previous.tuning !== state.tuning) {
    applyToasts(state);
    if (!previous || previous.toasts.material !== state.toasts.material) {
      cancelAnimationFrame(toastRimFrame);
      toastRimFrame = requestAnimationFrame(() => {
        rimElements.forEach((element) => {
          if (element.classList.contains("sonner-major-material")) paintRim(element);
        });
      });
    }
  }
  applyHeaderFade(state);
  applyRowPlates(state);
  applyAccent(state);
  if (!previous || previous.picker !== state.picker || previous.tuning !== state.tuning) {
    applyPicker(state.picker, state.tuning);
  }
  if (
    !previous ||
    previous.showCredentialButtons !== state.showCredentialButtons ||
    previous.showSixV6 !== state.showSixV6 ||
    previous.showCurrency !== state.showCurrency
  ) {
    applyColumns(state);
  }
  // UI scale, for sizes that must stay constant on screen (rim widths: calc(1.5px / zoom)).
  root.style.setProperty("--ui-zoom", String(state.uiScale));
  root.dataset.strategy = state.strategy;
  root.dataset.chrome = state.chrome;
  root.dataset.backdrop = state.backdrop;
  root.dataset.rimMajor = state.majorRim;
  root.dataset.rimMinor = state.minorRim;
  root.dataset.shadows = String(state.shadows);
  root.dataset.overlayHeader = String(state.overlayHeader);
  root.dataset.badgeEffects = String(state.badgeEffects);
  // Shells in the list (rows, groups) draw nothing when their tint, body, shadow and rim are all
  // zero, as in the chosen look. Their layers are then skipped (styles: glass.css), which saves
  // painting and layerizing a dozen empty stacking layers per row.
  const { tuning } = state;
  root.dataset.listShells =
    tuning.minor.tintOpacity === 0 &&
    tuning.shellBody === 0 &&
    (!state.shadows || tuning.shadowStrength === 0) &&
    state.minorRim === "off"
      ? "empty"
      : "drawn";
  if (
    !previous ||
    previous.tuning !== state.tuning ||
    previous.majorRim !== state.majorRim ||
    previous.minorRim !== state.minorRim ||
    previous.strategy !== state.strategy ||
    previous.uiScale !== state.uiScale
  ) {
    cancelAnimationFrame(rimFrame);
    rimFrame = requestAnimationFrame(repaintAllRims);
  }
  scheduleBake(state);
  if (previous && previous.uiScale !== state.uiScale) requestAnimationFrame(positionBakedElements);
  previous = state;
}

let resizeFrame = 0;
/** `tuning`: the installer's own material instead of the lab's (which the app uses). */
export function startGlassEngine(tuning: Tuning | null = null) {
  tuningOverride = tuning;
  sync(current());
  labStore.subscribe(() => sync(current()));
  settingsStore.subscribe(() => sync(current()));
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      positionBakedElements();
      scheduleBake(current());
    });
  });
}
