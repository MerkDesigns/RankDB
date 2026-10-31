/** TaskMap's glassListScrollGeometry / glassListGeometry, specialised to one Settings viewport. */
export interface Rectangle {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}
export interface ScrollCard extends Rectangle {
  readonly element: HTMLElement;
  readonly radius: number;
}
export interface ScrollLayout {
  readonly viewport: HTMLElement;
  readonly scrollLeft: number;
  readonly scrollTop: number;
  readonly clip: Rectangle;
  readonly cards: readonly ScrollCard[];
}
export interface ScrollSlice {
  readonly card: ScrollCard;
  readonly insets: readonly [number, number, number, number] | null;
  readonly shape: (Rectangle & { readonly radius: number }) | null;
}

/** Fractional border-box size, without the integer rounding of offsetWidth/offsetHeight. */
function size(element: HTMLElement, style: CSSStyleDeclaration) {
  const extra = (sides: readonly string[]) => sides.reduce((sum, name) => sum + (parseFloat(style.getPropertyValue(name)) || 0), 0);
  const borderBox = style.boxSizing === "border-box";
  const width = parseFloat(style.width), height = parseFloat(style.height);
  return {
    width: Number.isFinite(width) ? width + (borderBox ? 0 : extra(["padding-left", "padding-right", "border-left-width", "border-right-width"])) : element.offsetWidth,
    height: Number.isFinite(height) ? height + (borderBox ? 0 : extra(["padding-top", "padding-bottom", "border-top-width", "border-bottom-width"])) : element.offsetHeight,
  };
}

/**
 * Read only on layout/content/tuning changes, never while projecting native scrolling. `frame`
 * gives the clip (its padding box minus padding; the viewport by default), and `scrollTop` the
 * offset the cards are drawn at when it isn't the viewport's own (a pinned stage).
 */
export function readScrollLayout(
  viewport: HTMLElement,
  owner: HTMLElement,
  selector: string,
  frame: HTMLElement = viewport,
  scrollTop = viewport.scrollTop,
): ScrollLayout | null {
  const origin = owner.getBoundingClientRect();
  if (origin.width <= 0 || origin.height <= 0) return null;
  const measuredScale = origin.width / size(owner, getComputedStyle(owner)).width;
  const scale = Math.abs(measuredScale - 1) < 0.001 ? 1 : measuredScale;
  const relative = (element: HTMLElement): Rectangle => {
    const box = element.getBoundingClientRect();
    return { left: (box.left - origin.left) / scale, top: (box.top - origin.top) / scale, width: box.width / scale, height: box.height / scale };
  };
  const box = relative(frame), style = getComputedStyle(frame);
  const padding = (side: string) => parseFloat(style.getPropertyValue(`padding-${side}`)) || 0;
  return {
    viewport, scrollTop, scrollLeft: viewport.scrollLeft,
    clip: {
      left: box.left + padding("left"), top: box.top + padding("top"),
      width: Math.max(0, box.width - padding("left") - padding("right")),
      height: Math.max(0, box.height - padding("top") - padding("bottom")),
    },
    cards: [...viewport.querySelectorAll<HTMLElement>(selector)].map((element) => {
      const style = getComputedStyle(element);
      return { element, ...relative(element), ...size(element, style), radius: parseFloat(style.borderTopLeftRadius) || 0 };
    }),
  };
}

/** TaskMap's cached scroll projection: the hot path reads only the native scroll offsets. */
export function projectScrollSlices(layout: ScrollLayout): ScrollSlice[] {
  const dx = layout.viewport.scrollLeft - layout.scrollLeft, dy = layout.viewport.scrollTop - layout.scrollTop;
  const clip = layout.clip;
  return layout.cards.map((card) => {
    const x = card.left - dx, y = card.top - dy;
    const left = Math.max(x, clip.left), top = Math.max(y, clip.top);
    const right = Math.min(x + card.width, clip.left + clip.width), bottom = Math.min(y + card.height, clip.top + clip.height);
    if (right <= left || bottom <= top) return { card, insets: null, shape: null };
    const height = bottom - top;
    const narrow = height < card.radius * 2 ? card.radius - height / 2 : 0;
    return {
      card,
      insets: [Math.max(0, top - y), Math.max(0, x + card.width - right + narrow), Math.max(0, y + card.height - bottom), Math.max(0, left - x + narrow)],
      shape: { left: left + narrow, top, width: Math.max(0, right - left - narrow * 2), height, radius: card.radius },
    };
  });
}

/** TaskMap layeredOutputMask cap layers: no new SVG/image encoding or decoding while scrolling. */
export function scrollPlaneMask(slices: readonly ScrollSlice[], overscan: number) {
  const layers: { image: string; left: number; top: number; width: number; height: number }[] = [];
  const fill = "linear-gradient(#000, #000)";
  for (const { shape } of slices) {
    if (!shape || shape.width <= 0 || shape.height <= 0) continue;
    const { left: x, top: y, width, height } = shape;
    const radius = Math.max(0, Math.min(shape.radius, width / 2)), cap = Math.min(radius, height / 2);
    const layer = (image: string, left: number, top: number, w: number, h: number) => {
      if (w > 0 && h > 0) layers.push({ image, left: left + overscan, top: top + overscan, width: w, height: h });
    };
    if (cap <= 0) { layer(fill, x, y, width, height); continue; }
    const corner = (at: string) => `radial-gradient(${radius}px ${cap}px at ${at}, #000 96%, transparent 100%)`;
    const capRow = (top: number, bottom: boolean) => {
      layer(corner(bottom ? "100% 0" : "100% 100%"), x, top, radius, cap);
      if (width > radius * 2) layer(fill, x + radius - 1, top, width - radius * 2 + 2, cap);
      layer(corner(bottom ? "0 0" : "0 100%"), x + width - radius, top, radius, cap);
    };
    capRow(y, false);
    if (height > cap * 2) layer(fill, x, y + cap - 1, width, height - cap * 2 + 2);
    capRow(y + height - cap, true);
  }
  return layers.length ? {
    image: layers.map((l) => l.image).join(", "),
    position: layers.map((l) => `${l.left}px ${l.top}px`).join(", "),
    size: layers.map((l) => `${l.width}px ${l.height}px`).join(", "),
  } : { image: "linear-gradient(transparent, transparent)", position: "0 0", size: "100% 100%" };
}
