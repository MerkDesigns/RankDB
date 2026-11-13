import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { whenIdle } from "../data/backend";
import { flushSettings, settingsStore } from "../data/settingsStore";
import { labStore, type WindowChrome } from "../lab/store";

/**
 * The app window: decorations follow the lab's window-frame choice, the width is locked to the UI,
 * and custom frames get their own buttons and drag handling. There is no maximise: like other
 * fixed-size apps (League client, Character Map), the window is not maximisable
 * (tauri.conf.json `maximizable: false`); people drag the top or bottom edge to change height.
 * RankDB only runs as the Tauri app, so there are no browser fallbacks.
 */

const appWindow = () => getCurrentWindow();

/* ---------- Decorations ---------- */

/**
 * Switches the native title bar on or off without changing the webview's size. Windows keeps the
 * outer rectangle, so removing the bar would grow the content by its height; the window-state
 * plugin saves and restores that content size on a window that starts decorated, so every start
 * grew the window by one title bar (bug fixed 2026-11-13). Putting the size back keeps it exact.
 */
async function applyDecorations(chrome: WindowChrome) {
  const window_ = appWindow();
  const decorated = chrome === "native";
  try {
    if ((await window_.isDecorated()) === decorated) return;
    const before = await window_.innerSize();
    await window_.setDecorations(decorated);
    const after = await window_.innerSize();
    if (after.width !== before.width || after.height !== before.height) await window_.setSize(before);
  } catch (error) {
    console.error("Could not change window decorations", error);
  }
}

/**
 * Applies the saved frame and wires the window behaviour. The window starts hidden
 * (tauri.conf.json) so the native title bar never flashes before a custom frame replaces it.
 */
export async function startWindowChrome(): Promise<void> {
  let current = labStore.get().chrome;
  await applyDecorations(current);
  labStore.subscribe(() => {
    const next = labStore.get().chrome;
    if (next === current) return;
    current = next;
    // Native and custom frames have different borders, so the width lock is remeasured after.
    void applyDecorations(next).then(() => scheduleFit());
  });
  installDragHandling();
}

/** Shows the window. Never waits for an animation frame: hidden webviews don't fire them. */
export async function revealWindow(): Promise<void> {
  try {
    await appWindow().show();
  } catch (error) {
    console.error("Could not show the window", error);
  }
}

/* ---------- Width follows the UI ---------- */

const MIN_HEIGHT = 520;
/** "No limit" for the free axis; Windows clamps it to what fits. */
const UNBOUNDED = 100_000;
let lockKey = "";
let fitFrame = 0;

/**
 * Locks the window to the layout's rendered width (frame × UI scale): never empty space on the
 * sides, never clipped. Height stays user-resizable.
 *
 * Size limits apply to the whole window, including the invisible resize borders Windows keeps
 * around even a frameless window, while setSize sets the webview area. The border allowance is
 * measured and added to the limits, or the UI would be clipped by it on the right.
 */
export async function fitWindowToContent(): Promise<void> {
  const frame = document.querySelector<HTMLElement>(".frame");
  if (!frame) return;
  const width = Math.ceil(frame.offsetWidth * settingsStore.get().uiScale);
  if (width <= 0) return;

  const window_ = appWindow();
  try {
    const scale = await window_.scaleFactor();
    const [outer, inner] = await Promise.all([window_.outerSize(), window_.innerSize()]);
    const borderWidth = Math.max(0, (outer.width - inner.width) / scale);
    const borderHeight = Math.max(0, (outer.height - inner.height) / scale);
    const key = `${width}:${borderWidth}`;
    if (key === lockKey && Math.abs(inner.width / scale - width) < 1) return;

    const outerWidth = width + borderWidth;
    const min = new LogicalSize(outerWidth, MIN_HEIGHT + borderHeight);
    const max = new LogicalSize(outerWidth, UNBOUNDED);
    // Never let min exceed max in between: lower the floor first, then the ceiling.
    await window_.setMinSize(new LogicalSize(0, 0));
    await window_.setMaxSize(max);
    await window_.setMinSize(min);
    await window_.setSize(new LogicalSize(width, Math.max(MIN_HEIGHT, inner.height / scale)));
    lockKey = key;
  } catch (error) {
    console.error("Could not fit the window to the UI", error);
  }
}

function scheduleFit() {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => void fitWindowToContent());
}

/** Refits whenever the layout width or the UI scale changes. */
export function startWindowFit() {
  const observer = new ResizeObserver(scheduleFit);
  const frame = document.querySelector(".frame");
  if (frame) observer.observe(frame);
  let zoom = settingsStore.get().uiScale;
  settingsStore.subscribe(() => {
    const next = settingsStore.get().uiScale;
    if (next === zoom) return;
    zoom = next;
    scheduleFit();
  });
}

/* ---------- Dragging ---------- */

/**
 * Our own drag handling for `data-drag-region` elements: Tauri's built-in drag regions hard-wire
 * double-click to maximise, which RankDB doesn't have. Like Tauri's, a region only reacts to
 * presses on the element itself, never on its children. Double-clicks do nothing.
 */
export function installDragHandling() {
  document.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (!target?.hasAttribute("data-drag-region")) return;
    event.preventDefault();
    if (event.detail === 1) void appWindow().startDragging().catch(() => {});
  });
}

/** Spread on elements whose empty space should drag the window (only with a custom frame). */
export function dragRegion(chrome: WindowChrome): { "data-drag-region"?: true } {
  return chrome === "native" ? {} : { "data-drag-region": true };
}

/** How long closing or updating waits at most for pending saves. */
const SETTLE_LIMIT_MS = 3000;

/** Sends waiting settings and resolves once every database command so far has finished. */
export function settleSaves(): Promise<void> {
  flushSettings();
  return Promise.race([whenIdle(), new Promise<void>((resolve) => setTimeout(resolve, SETTLE_LIMIT_MS))]);
}

/**
 * Closing (our buttons, the title bar, Alt+F4) waits for pending saves, so an edit made just
 * before closing is never lost. The window closes once the handler resolves.
 */
export function startSaveOnClose() {
  void appWindow().onCloseRequested(() => settleSaves());
}

/* ---------- Focus ---------- */

/**
 * Marks the root `data-window-inactive` while another window has focus, which stops the rank
 * effects (rankEffects.ts): RankDB mostly sits behind a game, where nobody watches them.
 */
export function startFocusTracking() {
  const root = document.documentElement;
  const apply = (focused: boolean) => {
    if (focused) delete root.dataset.windowInactive;
    else root.dataset.windowInactive = "";
  };
  void appWindow().isFocused().then(apply, () => undefined);
  void appWindow().onFocusChanged(({ payload }) => apply(payload));
}

export const windowActions = {
  minimize: () => appWindow().minimize(),
  close: () => appWindow().close(),
};
