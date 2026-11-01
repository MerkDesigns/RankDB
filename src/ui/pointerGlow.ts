/**
 * The light around the pointer on the glass bars (header islands, rail) and the hover glow on
 * account rows (app.css). Writes the pointer's position inside the element it is over as
 * `--pointer-x`/`--pointer-y`; both are registered as not inherited, so a move restyles that one
 * element and repaints only its light.
 * A row also gets `--glow-clip`, how far it reaches up under the header, where its glow stops.
 * `pointerover` also fires when a row scrolls in under a resting pointer, so the glow starts where
 * the pointer is.
 */
const TARGETS = ".header .island, .rail, .row";

let lastX = -1;
let lastY = -1;

function update(target: HTMLElement, x: number, y: number) {
  const rect = target.getBoundingClientRect();
  // Rows sit inside the UI scale's zoom: the rect is in viewport pixels, the glow in the row's own.
  const scale = rect.width > 0 ? target.offsetWidth / rect.width : 1;
  target.style.setProperty("--pointer-x", `${(x - rect.left) * scale}px`);
  target.style.setProperty("--pointer-y", `${(y - rect.top) * scale}px`);
  if (target.classList.contains("row")) {
    const headerBottom = document.querySelector(".header")?.getBoundingClientRect().bottom ?? 0;
    target.style.setProperty("--glow-clip", `${Math.max(0, (headerBottom - rect.top) * scale)}px`);
  }
}

export function startPointerGlow() {
  const onPointer = (event: PointerEvent) => {
    lastX = event.clientX;
    lastY = event.clientY;
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(TARGETS) : null;
    if (target) update(target, lastX, lastY);
  };
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerover", onPointer, { passive: true });
}

/** After the list stops scrolling (AccountList): the row now under the resting pointer. */
export function refreshPointerGlow() {
  if (lastX < 0) return;
  const target = document.elementFromPoint(lastX, lastY)?.closest<HTMLElement>(TARGETS);
  if (target) update(target, lastX, lastY);
}
