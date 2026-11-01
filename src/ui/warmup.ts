/**
 * Renders the surfaces that are kept mounted while hidden (Settings, the rank picker) for a few
 * frames once the app is idle after startup, nearly transparent (dialogs.css, `data-warming`).
 * Their first opening then animates as smoothly as every later one: before this, Settings' first
 * open had a 61 ms frame and the picker's dropped about four times the frames of later opens.
 */
const FRAMES = 3;
/** Idle checks for the parked surfaces to mount (useWarmMount) before giving up. */
const ATTEMPTS = 10;

const parked = () =>
  document.querySelector(".dialog-layer[hidden]") !== null && document.querySelector(".picker[data-parked]") !== null;

export function startAnimationWarmup() {
  let attempts = 0;
  const wait = () => {
    if (parked()) return whenVisible(warm);
    if (++attempts < ATTEMPTS) requestIdleCallback(wait, { timeout: 2000 });
  };
  requestIdleCallback(wait, { timeout: 2000 });
}

/** Hidden windows fire no animation frames, so the warm-up waits for the window to show. */
function whenVisible(run: () => void) {
  if (document.visibilityState === "visible") return run();
  const onChange = () => {
    if (document.visibilityState !== "visible") return;
    document.removeEventListener("visibilitychange", onChange);
    run();
  };
  document.addEventListener("visibilitychange", onChange);
}

function warm() {
  const root = document.documentElement;
  root.dataset.warming = "";
  // A window hidden mid-warm-up fires no more frames, so a timer ends it too.
  const end = () => {
    window.clearTimeout(timer);
    cancelAnimationFrame(frame);
    delete root.dataset.warming;
  };
  const timer = window.setTimeout(end, 500);
  let left = FRAMES;
  let frame = 0;
  const next = () => {
    if (--left > 0) frame = requestAnimationFrame(next);
    else end();
  };
  frame = requestAnimationFrame(next);
}
