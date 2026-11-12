import { command } from "./backend";
import { useSyncExternalStore } from "react";

/**
 * The app's settings (the Settings window), saved in the database's `settings` table
 * (src-tauri/src/db/settings.rs) one key per setting, as JSON. Loaded before the first render; each change
 * applies at once and is saved shortly after (a burst of changes is one write).
 */

/** The scene behind the app (Settings → Visuals → Designs): Flat is the base colour, Haze the ambient lights. */
export type Design = "flat" | "haze";
export const DESIGNS: readonly Design[] = ["flat", "haze"];

export interface AppSettings {
  design: Design;
  /** App accent (toggles, selections); null = RankDB purple. */
  accentColor: string | null;
  /** Copy-email / copy-password buttons at the start of each row. */
  showCredentialButtons: boolean;
  /** Currency columns (prisms, coins, credits, competitive and legacy points). */
  showCurrency: boolean;
  showSixV6: boolean;
  /** Shortens account names to their first `privacyChars` characters (for streaming). */
  privacyMode: boolean;
  privacyChars: number;
  /** Zoom of the header and rows (Settings and the rank picker stay at 100%). */
  uiScale: number;
  /** Seconds before a copied email/password is cleared from the clipboard; null = never. */
  clipboardClearSeconds: number | null;
  /** Show "Managing Overwatch accounts" in Discord (on by default, as in the old app). */
  discordPresence: boolean;
  /** Replaces "Managing Overwatch accounts" in Discord; "" = that default. Always clean (below). */
  discordActivityText: string;
  /**
   * Profile pictures and banners from owapi.eu (experimental, off by default; data/profiles.ts).
   * Off deletes what was fetched. The two below choose what shows while it is on.
   */
  profileImages: boolean;
  profileAvatar: boolean;
  profileBanner: boolean;
  /** Glow, shine and sparkles on high ranks (Emerald up; on by default, as in the old app). */
  badgeEffects: boolean;
  /** The version whose What's New was last shown (not a visible setting). */
  lastSeenVersion: string | null;
}

export const DEFAULT_ACCENT = "#9e7aff";
/** The UI scale's steps (a segmented control in Settings); anything else snaps to the nearest. */
export const UI_SCALE_STEPS = [0.8, 0.9, 1, 1.1, 1.2] as const;

export function nearestUiScale(value: number): number {
  return UI_SCALE_STEPS.reduce((best, step) => (Math.abs(step - value) < Math.abs(best - value) ? step : best), 1);
}
export const PRIVACY_CHARS = { min: 0, max: 7 } as const;
/** As in the old app: 5 to 30 seconds, or never. */
export const CLIPBOARD_CLEAR = { min: 5, max: 30, step: 5 } as const;

export const DEFAULT_SETTINGS: AppSettings = {
  design: "haze",
  accentColor: null,
  showCredentialButtons: true,
  showCurrency: true,
  showSixV6: true,
  privacyMode: false,
  privacyChars: 3,
  uiScale: 1,
  clipboardClearSeconds: 10,
  discordPresence: true,
  discordActivityText: "",
  profileImages: false,
  profileAvatar: true,
  profileBanner: true,
  badgeEffects: true,
  lastSeenVersion: null,
};

/* ---------- Validation: anything read from disk is untrusted ---------- */

const number = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

const color = (value: unknown): string | null =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;

/** The Discord activity text's limits: Discord wants 2–128 UTF-16 units; 64 characters stay under. */
export const ACTIVITY_TEXT = { min: 2, max: 64 } as const;

/**
 * Cleans a custom Discord activity line, the same way Rust does again before sending it
 * (`discord.rs` `clean_activity`): control characters, line breaks, invisible and text-direction
 * characters become spaces; runs of spaces become one; stacked accent marks (zalgo) keep two;
 * at most 64 characters. Too short to show (under 2) is "", the default line.
 */
export function cleanActivityText(value: string): string {
  const cleaned = value
    .replace(/[\p{Cc}\u2028\u2029\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/gu, " ")
    .replace(/([\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]{2})[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]+/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim();
  const limited = Array.from(cleaned).slice(0, ACTIVITY_TEXT.max).join("").trim();
  return Array.from(limited).length < ACTIVITY_TEXT.min ? "" : limited;
}

function normalizeSettings(raw: Record<string, unknown>): AppSettings {
  const d = DEFAULT_SETTINGS;
  return {
    design: DESIGNS.includes(raw.design as Design) ? (raw.design as Design) : d.design,
    accentColor: color(raw.accentColor),
    showCredentialButtons: bool(raw.showCredentialButtons, d.showCredentialButtons),
    showCurrency: bool(raw.showCurrency, d.showCurrency),
    showSixV6: bool(raw.showSixV6, d.showSixV6),
    privacyMode: bool(raw.privacyMode, d.privacyMode),
    privacyChars: Math.round(number(raw.privacyChars, d.privacyChars, PRIVACY_CHARS.min, PRIVACY_CHARS.max)),
    uiScale: nearestUiScale(number(raw.uiScale, d.uiScale, 0.5, 1.5)),
    clipboardClearSeconds:
      raw.clipboardClearSeconds === null
        ? null
        : Math.round(number(raw.clipboardClearSeconds, 10, CLIPBOARD_CLEAR.min, CLIPBOARD_CLEAR.max)),
    discordPresence: bool(raw.discordPresence, d.discordPresence),
    discordActivityText: typeof raw.discordActivityText === "string" ? cleanActivityText(raw.discordActivityText) : d.discordActivityText,
    profileImages: bool(raw.profileImages, d.profileImages),
    profileAvatar: bool(raw.profileAvatar, d.profileAvatar),
    profileBanner: bool(raw.profileBanner, d.profileBanner),
    badgeEffects: bool(raw.badgeEffects, d.badgeEffects),
    lastSeenVersion: typeof raw.lastSeenVersion === "string" ? raw.lastSeenVersion.slice(0, 32) : null,
  };
}

/* ---------- Persistence ---------- */

/** Coalesces a quick run of changes (stepper clicks, colour drags) into one write. */
const SAVE_DELAY_MS = 120;

let pending: Partial<AppSettings> = {};
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveChain: Promise<void> = Promise.resolve();

/** Sends any change still waiting for its delay (closing, updating, a backup); resolves once saved. */
export function flushSettings(): Promise<void> {
  flush();
  return saveChain;
}

/** Loads the saved settings again after an import replaced them; changes not yet sent are dropped. */
export async function reloadSettings(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  pending = {};
  state = normalizeSettings(await command<Record<string, unknown>>("load_settings"));
  listeners.forEach((listener) => listener());
}

function flush() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const values = pending;
  pending = {};
  if (Object.keys(values).length === 0) return;
  // Serialised, so writes land in the order they were made.
  saveChain = saveChain
    .then(() => command<void>("save_settings", { values }))
    .catch((error: unknown) => console.error("Could not save settings", error));
}

/** Loads the saved settings before the first render. */
export async function initSettings(): Promise<void> {
  let saved: Record<string, unknown> = {};
  try {
    saved = await command<Record<string, unknown>>("load_settings");
  } catch (error) {
    console.error("Could not load settings", error);
  }
  state = normalizeSettings(saved);
}

/* ---------- Store ---------- */

let state: AppSettings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

export const settingsStore = {
  get: () => state,
  set(patch: Partial<AppSettings> | ((current: AppSettings) => Partial<AppSettings>)) {
    const next = normalizeSettings({ ...state, ...(typeof patch === "function" ? patch(state) : patch) });
    const changed = (Object.keys(next) as (keyof AppSettings)[]).filter((key) => next[key] !== state[key]);
    if (changed.length === 0) return;
    state = next;
    for (const key of changed) Object.assign(pending, { [key]: next[key] });
    listeners.forEach((listener) => listener());
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, SAVE_DELAY_MS);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useSettings<T>(selector: (settings: AppSettings) => T): T {
  return useSyncExternalStore(settingsStore.subscribe, () => selector(state));
}

// A change still waiting to be saved is written when the window goes away.
window.addEventListener("pagehide", flush);
