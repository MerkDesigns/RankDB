import { useLayoutEffect, useRef, type RefObject } from "react";
import { settingsStore, useSettings } from "../data/settingsStore";
import { useLab, type RowPlates } from "../lab/store";


interface Shape {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corner radius; the Minor recipe's when null. */
  radius: number | null;
}

/** An element's offset in the list content's own (scrolling) coordinates; null if outside it. */
function offsetIn(content: HTMLElement, element: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = element;
  while (node && node !== content) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return node === content ? { x, y } : null;
}

/**
 * Every plane-backed surface: the Minor surfaces (`data-plane-shape`) and the account bars, i.e.
 * the row plates (`.row::before`, app.css) on the rows that show one.
 */
function measureShapes(content: HTMLElement, plates: RowPlates): Shape[] {
  const shapes: Shape[] = [];
  for (const element of content.querySelectorAll<HTMLElement>("[data-plane-shape]")) {
    const offset = offsetIn(content, element);
    if (offset) shapes.push({ ...offset, width: element.offsetWidth, height: element.offsetHeight, radius: null });
  }
  if (plates === "off") return shapes;
  const rows = content.querySelectorAll<HTMLElement>(plates === "all" ? ".row" : ".row[data-stripe]");
  for (const row of rows) {
    const offset = offsetIn(content, row);
    if (!offset) continue;
    const plate = getComputedStyle(row, "::before");
    const top = parseFloat(plate.top);
    const left = parseFloat(plate.left);
    shapes.push({
      x: offset.x + left,
      y: offset.y + top,
      width: row.offsetWidth - left - parseFloat(plate.right),
      height: row.offsetHeight - top - parseFloat(plate.bottom),
      radius: parseFloat(plate.borderTopLeftRadius),
    });
  }
  return shapes;
}

function shapesMask(width: number, height: number, shapes: readonly Shape[], radius: number) {
  const rects = shapes
    .map(
      (shape) =>
        `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${Math.min(shape.radius ?? radius, shape.height / 2)}" fill="#fff"/>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * One plane behind all top-level list surfaces.
 * shared: two backdrop-filter layers (pre-blur + main) masked to the union of row shapes. The mask
 *         lives in content coordinates, so scrolling never rewrites it.
 * baked:  the pre-blurred backdrop image, counter-translated by a scroll-driven animation so it
 *         stays fixed to the window while the mask scrolls with the rows.
 */
export function ListPlane({
  contentRef,
  scrollerRef,
  layoutKey,
}: {
  readonly contentRef: RefObject<HTMLDivElement | null>;
  readonly scrollerRef: RefObject<HTMLDivElement | null>;
  readonly layoutKey: string;
}) {
  const strategy = useLab((state) => state.strategy);
  const radius = useLab((state) => state.tuning.minor.radius);
  const zoom = useSettings((settings) => settings.uiScale);
  // The bars' shapes follow the Rows settings and the credential buttons (which round them less).
  const plates = useLab((state) => state.rowPlates);
  const plateShape = useLab((state) => `${state.rowPlateRadius}:${state.rowPlateHeight}:${state.rowPlateOverhang}`);
  const credentials = useSettings((settings) => settings.showCredentialButtons);
  const planeRef = useRef<HTMLDivElement>(null);
  const active = strategy === "shared" || strategy === "baked";

  useLayoutEffect(() => {
    const content = contentRef.current;
    const scroller = scrollerRef.current;
    const plane = planeRef.current;
    if (!active || !content || !scroller || !plane) return;

    const update = () => {
      const width = content.offsetWidth;
      const height = content.scrollHeight;
      plane.style.width = `${width}px`;
      plane.style.height = `${height}px`;
      plane.style.setProperty("--plane-mask", shapesMask(width, height, measureShapes(content, plates), radius));

      const rect = scroller.getBoundingClientRect();
      const currentZoom = settingsStore.get().uiScale;
      plane.style.setProperty("--viewport-w", `${scroller.clientWidth}px`);
      plane.style.setProperty("--viewport-h", `${scroller.clientHeight}px`);
      plane.style.setProperty("--viewport-x", `${-content.offsetLeft}px`);
      plane.style.setProperty(
        "--bake-pos",
        `${-rect.left / currentZoom}px ${-rect.top / currentZoom}px`,
      );
      plane.style.setProperty(
        "--max-scroll",
        `${Math.max(0, scroller.scrollHeight - scroller.clientHeight)}px`,
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    observer.observe(scroller);

    return () => observer.disconnect();
  }, [active, strategy, radius, zoom, layoutKey, plates, plateShape, credentials, contentRef, scrollerRef]);

  if (!active) return null;
  return (
    <div ref={planeRef} className="plane" data-kind={strategy} aria-hidden="true">
      {strategy === "shared" ? (
        <>
          <span className="plane-layer plane-pre" data-filter-layer="" />
          <span className="plane-layer plane-blur" data-filter-layer="" />
        </>
      ) : (
        <span className="plane-baked" />
      )}
    </div>
  );
}
