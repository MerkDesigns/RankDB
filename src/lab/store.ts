import { uiText } from "../text/index";
import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_TUNING, type RoleTuning, type Tuning } from "../glass/recipes";

export type Strategy = "off" | "native" | "shared" | "shell" | "baked";
export type BackdropId = "flat" | "dots" | "aurora" | "aurora-live" | "smoke" | "ambient";
export type RimMode = "exact" | "css" | "flat" | "off";
/** native: Windows title bar · caption: buttons float in the top margin · rail: right-hand rail. */
export type WindowChrome = "native" | "caption" | "rail";
/** A rounded plate behind every row, every other row, or none (only the hover plate). */
export type RowPlates = "off" | "all" | "alternate";

/** Rank picker look, tunable in the lab. Sizes in UI pixels; alphas 0–1. */
export interface PickerTuning {
  cell: number;
  emblem: number;
  gap: number;
  radius: number;
  /** Extra fill under the selector glass. */
  fill: number;
  /** Outline of the selected tier, division and placement. */
  selected: number;
  selectedWidth: number;
  divisionSize: number;
  confirmHeight: number;
  confirmRadius: number;
  padding: number;
  /** The panel's own blur, separate from the Major recipe (its pre-blur stays the recipe's). */
  blur: number;
  /** Space between the clicked badge and the panel. */
  offset: number;
}

export const DEFAULT_PICKER: PickerTuning = {
  cell: 52,
  emblem: 40,
  gap: 7,
  radius: 14,
  fill: 0.06,
  selected: 0.7,
  selectedWidth: 0,
  divisionSize: 23,
  confirmHeight: 38,
  confirmRadius: 12,
  padding: 12,
  blur: 24,
  offset: 10,
};

export interface ToastTuning {
  /** Null follows the shared Major recipe. A custom recipe affects notifications only. */
  material: RoleTuning | null;
  shadowStrength: number;
  iconSize: number;
  iconStroke: number;
  textOpacity: number;
  detailOpacity: number;
  edgeX: number;
  edgeY: number;
  motionSpeed: number;
}

export const DEFAULT_TOASTS: ToastTuning = {
  material: { blur: 37, preblur: 6, saturation: 0.78, brightness: 0.82, tintOpacity: 0.075, radius: 18, rimAlpha: 0.205 },
  shadowStrength: 1,
  iconSize: 18,
  iconStroke: 2,
  textOpacity: 0.88,
  detailOpacity: 0.45,
  edgeX: 20,
  edgeY: 17,
  motionSpeed: 1.25,
};

/** The "ambient" backdrop: four soft coloured lights drifting over the base (glass/ambientField.ts). */
export interface AmbientTuning {
  /** One colour per light. */
  colors: readonly [string, string, string, string];
  /** How strongly the lights add to the base colour, 0..1. */
  intensity: number;
  /** Light radius, as a share of the window's long side. */
  size: number;
  /** 0 = a tighter glow, 1 = a wide wash with no visible edge. */
  softness: number;
  speed: number;
  /** How far each light wanders, as a share of the window's long side. */
  drift: number;
  /** Redraws per second. Every redraw makes the glass above it re-blur. */
  updates: number;
  /** Static noise against banding, in 1/255 steps. */
  grain: number;
  /** Picks the lights' places and paths. */
  seed: number;
  /** How far the lights' depth layers slide as the list scrolls; 0 = off (one flat layer). */
  parallax: number;
}

export const DEFAULT_AMBIENT: AmbientTuning = {
  colors: ["#2f2154", "#2f1439", "#391650", "#2e365c"],
  intensity: 0.2,
  size: 0.21,
  softness: 1,
  speed: 3,
  drift: 0.09,
  updates: 30,
  grain: 4,
  seed: 1,
  parallax: 0,
};

/** The "smoke" backdrop: ASCII glyphs over rising smoke (glass/smokeField.ts). */
export interface SmokeTuning {
  /** Cell height in CSS pixels; cells are 0.6 as wide, like monospace text. */
  cellHeight: number;
  speed: number;
  /** Redraws per second. Every redraw makes the glass above it re-blur. */
  updates: number;
  /** How much of each redraw stays on the next one (phosphor afterglow), 0..0.95. */
  trail: number;
  contrast: number;
  brightness: number;
  opacity: number;
  ink: string;
  accent: string;
  /** Glyphs from empty to full; the first is always a space (empty cells). */
  charset: string;
}

export const DEFAULT_SMOKE: SmokeTuning = {
  cellHeight: 19,
  speed: 1.1,
  updates: 120,
  trail: 0.48,
  contrast: 1,
  brightness: -0.05,
  opacity: 0.55,
  ink: "#3c2f4c",
  charset: " .:-=+*#%@",
  accent: "#a97aff",
};

export interface LabState {
  picker: PickerTuning;
  toasts: ToastTuning;
  smoke: SmokeTuning;
  ambient: AmbientTuning;

  chrome: WindowChrome;
  strategy: Strategy;
  backdrop: BackdropId;
  /** Base colour under the backdrop's dots and blobs; null keeps the backdrop's own. */
  backdropColor: string | null;
  /** Rim style of the header islands (Major glass). */
  majorRim: RimMode;
  /** Rim style of rows and groups (Minor glass). */
  minorRim: RimMode;
  shadows: boolean;
  /** Rows scroll underneath the header instead of stopping below it. */
  overlayHeader: boolean;
  /** Gradient between the rows and the header glass, fading out at the header's bottom edge. */
  headerFadeOpacity: number;
  /** Colour of that gradient; null follows the background colour. */
  headerFadeColor: string | null;
  rowPlates: RowPlates;
  /** White alpha of those plates. */
  rowPlateOpacity: number;
  /** Plate shape in UI pixels: corner radius, full height (centred on the row), and how far it
      reaches past the row on each side. */
  rowPlateRadius: number;
  rowPlateHeight: number;
  rowPlateOverhang: number;
  /** The plates' 1px outline; null colour = white. */
  rowPlateOutlineColor: string | null;
  rowPlateOutlineOpacity: number;
  /** Blur behind a row while it is dragged; 0 = none. */
  heldBlur: number;
  /** Development: the saved accounts, or an unsaved dummy roster (account count and seed). */
  dataSource: "database" | "dummy";
  accountCount: number;
  seed: number;
  meter: boolean;
  /** Lab pop-up expanded (true) or collapsed to its pill (false). */
  panelOpen: boolean;
  /** Lab pop-up's top-left corner in window pixels; null = default spot at the top right. */
  panelX: number | null;
  panelY: number | null;
  tuning: Tuning;
}

export const STRATEGIES: readonly { id: Strategy; label: string; note: string }[] = [
  {
    id: "off",
    label: uiText("labOptions.strategies.off.label"),
    note: uiText("labOptions.strategies.off.description"),
  },
  {
    id: "native",
    label: uiText("labOptions.strategies.native.label"),
    note: uiText("labOptions.strategies.native.description"),
  },
  {
    id: "shared",
    label: uiText("labOptions.strategies.shared.label"),
    note: uiText("labOptions.strategies.shared.description"),
  },
  {
    id: "shell",
    label: uiText("labOptions.strategies.shell.label"),
    note: uiText("labOptions.strategies.shell.description"),
  },
  {
    id: "baked",
    label: uiText("labOptions.strategies.baked.label"),
    note: uiText("labOptions.strategies.baked.description"),
  },
];

export const BACKDROPS: readonly { id: BackdropId; label: string }[] = [
  { id: "flat", label: uiText("labOptions.backdrops.flat") },
  { id: "dots", label: uiText("labOptions.backdrops.dots") },
  { id: "aurora", label: uiText("labOptions.backdrops.aurora") },
  { id: "aurora-live", label: uiText("labOptions.backdrops.auroraAnimated") },
  { id: "smoke", label: uiText("labOptions.backdrops.smoke") },
  { id: "ambient", label: uiText("labOptions.backdrops.ambient") },
];

export const WINDOW_CHROMES: readonly { id: WindowChrome; label: string; note: string }[] = [
  { id: "native", label: uiText("labOptions.windowChrome.native"), note: uiText("labOptions.windowChrome.nativeDescription") },
  {
    id: "caption",
    label: uiText("labOptions.windowChrome.caption"),
    note: uiText("labOptions.windowChrome.captionDescription"),
  },
  {
    id: "rail",
    label: uiText("labOptions.windowChrome.rail"),
    note: uiText("labOptions.windowChrome.railDescription"),
  },
];

export const ROW_PLATES: readonly { id: RowPlates; label: string }[] = [
  { id: "off", label: uiText("labOptions.rowPlates.off") },
  { id: "all", label: uiText("labOptions.rowPlates.all") },
  { id: "alternate", label: uiText("labOptions.rowPlates.alternate") },
];

export const RIM_MODES: readonly { id: RimMode; label: string }[] = [
  { id: "css", label: uiText("labOptions.rims.css") },
  { id: "exact", label: uiText("labOptions.rims.exact") },
  { id: "flat", label: uiText("labOptions.rims.flat") },
  { id: "off", label: uiText("common.none") },
];

export const DEFAULT_STATE: LabState = {
  picker: DEFAULT_PICKER,
  toasts: DEFAULT_TOASTS,
  smoke: DEFAULT_SMOKE,
  ambient: DEFAULT_AMBIENT,
  chrome: "caption",
  strategy: "shell",
  backdrop: "ambient",
  backdropColor: "#07090f",
  majorRim: "exact",
  minorRim: "off",
  shadows: true,
  overlayHeader: true,
  headerFadeOpacity: 0.85,
  headerFadeColor: "#0a0a10",
  rowPlates: "all",
  rowPlateOpacity: 0.045,
  rowPlateRadius: 25,
  rowPlateHeight: 55,
  rowPlateOverhang: 4,
  rowPlateOutlineColor: "#9da3c3",
  rowPlateOutlineOpacity: 0.1,
  heldBlur: 5,
  dataSource: "database",
  accountCount: 70,
  seed: 12,
  meter: true,
  panelOpen: false,
  panelX: null,
  panelY: null,
  tuning: DEFAULT_TUNING,
};

/* ---------- Validation: anything read from disk is untrusted ---------- */

const oneOf = <T extends string>(value: unknown, allowed: readonly { id: T }[], fallback: T): T =>
  allowed.some((entry) => entry.id === value) ? (value as T) : fallback;

const number = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** 2 to 32 glyphs, starting with the space that empty cells show. */
const smokeCharset = (value: unknown): string | null =>
  typeof value === "string" && value.startsWith(" ") && [...value].length >= 2 && [...value].length <= 32 ? value : null;

const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

const color = (value: unknown): string | null =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;

function normalizeRole(value: unknown, fallback: RoleTuning): RoleTuning {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof RoleTuning, unknown>>;
  return {
    blur: number(raw.blur, fallback.blur, 0, 200),
    preblur: number(raw.preblur, fallback.preblur, 0, 50),
    saturation: number(raw.saturation, fallback.saturation, 0, 3),
    brightness: number(raw.brightness, fallback.brightness, 0, 3),
    tintOpacity: number(raw.tintOpacity, fallback.tintOpacity, 0, 1),
    radius: number(raw.radius, fallback.radius, 0, 64),
    rimAlpha: number(raw.rimAlpha, fallback.rimAlpha, 0, 1),
  };
}

export function normalizeState(value: unknown): LabState {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const tuning = (raw.tuning && typeof raw.tuning === "object" ? raw.tuning : {}) as Record<string, unknown>;
  const defaults = DEFAULT_STATE;
  // v1 had one rim mode for everything; "off" meant the user wanted borderless rows.
  const legacyRim = oneOf(raw.rimMode, RIM_MODES, "off");
  const hadLegacyRim = typeof raw.rimMode === "string" && raw.majorRim === undefined;
  const picker = (raw.picker && typeof raw.picker === "object" ? raw.picker : {}) as Record<string, unknown>;
  const p = DEFAULT_PICKER;
  const toasts = (raw.toasts && typeof raw.toasts === "object" ? raw.toasts : {}) as Record<string, unknown>;
  const t = DEFAULT_TOASTS;
  const smoke = (raw.smoke && typeof raw.smoke === "object" ? raw.smoke : {}) as Record<string, unknown>;
  const ambient = (raw.ambient && typeof raw.ambient === "object" ? raw.ambient : {}) as Record<string, unknown>;
  const a = DEFAULT_AMBIENT;
  const ambientColors = Array.isArray(ambient.colors) ? ambient.colors : [];
  const k = DEFAULT_SMOKE;
  return {
    smoke: {
      cellHeight: number(smoke.cellHeight, k.cellHeight, 8, 32),
      speed: number(smoke.speed, k.speed, 0, 3),
      updates: Math.round(number(smoke.updates, k.updates, 6, 240)),
      trail: number(smoke.trail, k.trail, 0, 0.95),
      contrast: number(smoke.contrast, k.contrast, 0.3, 2.5),
      brightness: number(smoke.brightness, k.brightness, -0.5, 0.5),
      opacity: number(smoke.opacity, k.opacity, 0, 1),
      ink: color(smoke.ink) ?? k.ink,
      accent: color(smoke.accent) ?? k.accent,
      charset: smokeCharset(smoke.charset) ?? k.charset,
    },
    ambient: {
      colors: [0, 1, 2, 3].map((index) => color(ambientColors[index]) ?? a.colors[index]!) as unknown as AmbientTuning["colors"],
      intensity: number(ambient.intensity, a.intensity, 0, 1),
      size: number(ambient.size, a.size, 0.1, 1.2),
      softness: number(ambient.softness, a.softness, 0, 1),
      speed: number(ambient.speed, a.speed, 0, 3),
      drift: number(ambient.drift, a.drift, 0, 0.5),
      updates: Math.round(number(ambient.updates, a.updates, 6, 120)),
      grain: number(ambient.grain, a.grain, 0, 4),
      seed: Math.round(number(ambient.seed, a.seed, 0, 1_000_000)),
      parallax: number(ambient.parallax, a.parallax, 0, 3),
    },
    toasts: {
      material: toasts.material && typeof toasts.material === "object" ? normalizeRole(toasts.material, defaults.tuning.major) : null,
      shadowStrength: number(toasts.shadowStrength, t.shadowStrength, 0, 2),
      iconSize: number(toasts.iconSize, t.iconSize, 12, 20),
      iconStroke: number(toasts.iconStroke, t.iconStroke, 1, 3),
      textOpacity: number(toasts.textOpacity, t.textOpacity, 0.4, 1),
      detailOpacity: number(toasts.detailOpacity, t.detailOpacity, 0.2, 0.9),
      edgeX: number(toasts.edgeX, t.edgeX, 8, 64),
      edgeY: number(toasts.edgeY, t.edgeY, 8, 64),
      motionSpeed: number(toasts.motionSpeed, t.motionSpeed, 0.8, 2),
    },
    picker: {
      cell: number(picker.cell, p.cell, 32, 80),
      emblem: number(picker.emblem, p.emblem, 20, 72),
      gap: number(picker.gap, p.gap, 0, 24),
      radius: number(picker.radius, p.radius, 0, 26),
      fill: number(picker.fill, p.fill, 0, 0.4),
      selected: number(picker.selected, p.selected, 0, 1),
      selectedWidth: number(picker.selectedWidth, p.selectedWidth, 0, 4),
      divisionSize: number(picker.divisionSize, p.divisionSize, 14, 40),
      confirmHeight: number(picker.confirmHeight, p.confirmHeight, 28, 64),
      confirmRadius: number(picker.confirmRadius, p.confirmRadius, 0, 32),
      padding: number(picker.padding, p.padding, 4, 32),
      blur: number(picker.blur, p.blur, 0, 60),
      offset: number(picker.offset, p.offset, 0, 40),
    },
    chrome: oneOf(raw.chrome, WINDOW_CHROMES, defaults.chrome),
    strategy: oneOf(raw.strategy, STRATEGIES, defaults.strategy),
    backdrop: oneOf(raw.backdrop, BACKDROPS, defaults.backdrop),
    backdropColor: color(raw.backdropColor),
    majorRim: hadLegacyRim
      ? legacyRim === "off"
        ? "css"
        : legacyRim
      : oneOf(raw.majorRim, RIM_MODES, defaults.majorRim),
    // Rows have no rim control any more (kept for future highlights), so a saved one can't stick.
    minorRim: "off",
    shadows: bool(raw.shadows, defaults.shadows),
    overlayHeader: bool(raw.overlayHeader, defaults.overlayHeader),
    headerFadeOpacity: number(raw.headerFadeOpacity, defaults.headerFadeOpacity, 0, 1),
    headerFadeColor: color(raw.headerFadeColor),
    rowPlates: oneOf(raw.rowPlates, ROW_PLATES, defaults.rowPlates),
    rowPlateOpacity: number(raw.rowPlateOpacity, defaults.rowPlateOpacity, 0, 0.2),
    rowPlateRadius: number(raw.rowPlateRadius, defaults.rowPlateRadius, 0, 40),
    rowPlateHeight: number(raw.rowPlateHeight, defaults.rowPlateHeight, 40, 80),
    rowPlateOverhang: number(raw.rowPlateOverhang, defaults.rowPlateOverhang, -10, 30),
    rowPlateOutlineColor: color(raw.rowPlateOutlineColor),
    rowPlateOutlineOpacity: number(raw.rowPlateOutlineOpacity, defaults.rowPlateOutlineOpacity, 0, 1),
    heldBlur: number(raw.heldBlur, defaults.heldBlur, 0, 40),
    dataSource: raw.dataSource === "dummy" ? "dummy" : "database",
    accountCount: Math.round(number(raw.accountCount, defaults.accountCount, 10, 200)),
    seed: Math.round(number(raw.seed, defaults.seed, 0, 1_000_000)),
    meter: bool(raw.meter, defaults.meter),
    panelOpen: bool(raw.panelOpen, defaults.panelOpen),
    panelX: typeof raw.panelX === "number" ? number(raw.panelX, 0, 0, 10_000) : null,
    panelY: typeof raw.panelY === "number" ? number(raw.panelY, 0, 0, 10_000) : null,
    tuning: {
      major: normalizeRole(tuning.major, defaults.tuning.major),
      minor: normalizeRole(tuning.minor, defaults.tuning.minor),
      overscanRatio: number(tuning.overscanRatio, defaults.tuning.overscanRatio, 0, 8),
      specular: number(tuning.specular, defaults.tuning.specular, 0, 4),
      shadowStrength: number(tuning.shadowStrength, defaults.tuning.shadowStrength, 0, 4),
      shellBody: number(tuning.shellBody, defaults.tuning.shellBody, 0, 1),
    },
  };
}

/* ---------- Persistence ---------- */

// Release builds have no lab: they always use the defaults above and never read or write the
// settings file (the Rust commands exist only in debug builds).

/** Short enough to feel live, long enough to coalesce a slider drag into a few writes. */
const SAVE_DELAY_MS = 120;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveChain: Promise<void> = Promise.resolve();

/** Writes the settings file through the app (src-tauri/src/lab_settings.rs). */
function persist() {
  if (!import.meta.env.DEV) return;
  const snapshot = JSON.stringify(state);
  // Serialised so two writes never race on the temporary file.
  saveChain = saveChain
    .then(() => invoke<void>("save_lab_settings", { settings: snapshot }))
    .catch((error: unknown) => console.error(uiText("labOptions.errors.saveFailed"), error));
}

function schedulePersist() {
  if (!import.meta.env.DEV) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist();
  }, SAVE_DELAY_MS);
}

/** Loads the saved settings file before first render; defaults when there is none. */
export async function initLabStore(): Promise<void> {
  if (!import.meta.env.DEV) return;
  let saved: unknown = null;
  try {
    const content = await invoke<string | null>("load_lab_settings");
    saved = content ? JSON.parse(content) : null;
  } catch (error) {
    console.error(uiText("labOptions.errors.loadFailed"), error);
  }
  state = normalizeState(saved);
}

/* ---------- Store ---------- */

let state: LabState = DEFAULT_STATE;
const listeners = new Set<() => void>();

export const labStore = {
  get: () => state,
  set(patch: Partial<LabState> | ((current: LabState) => Partial<LabState>)) {
    const next = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
    schedulePersist();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  reset() {
    labStore.set(DEFAULT_STATE);
  },
};

// Flush a pending save when the window goes away rather than dropping the last change.
window.addEventListener("pagehide", () => {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  persist();
});

export function useLab<T>(select: (current: LabState) => T): T {
  return useSyncExternalStore(labStore.subscribe, () => select(labStore.get()));
}
