import { useLayoutEffect, useRef, type RefObject } from "react";
import { settingsStore, useSettings } from "../data/settingsStore";
import { useLab } from "../lab/store";


interface Shape {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Positions of every plane-backed surface in the list content's own (scrolling) coordinates. */
function measureShapes(content: HTMLElement): Shape[] {
  const shapes: Shape[] = [];
  for (const element of content.querySelectorAll<HTMLElement>("[data-plane-shape]")) {
    let x = 0;
    let y = 0;
    let node: HTMLElement | null = element;
    while (node && node !== content) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    if (node !== content) continue;
    shapes.push({ x, y, width: element.offsetWidth, height: element.offsetHeight });
  }
  return shapes;
}

function shapesMask(width: number, height: number, shapes: readonly Shape[], radius: number) {
  const rects = shapes
    .map(
      (shape) =>
        `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${Math.min(radius, shape.height / 2)}" fill="#fff"/>`,
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
      plane.style.setProperty("--plane-mask", shapesMask(width, height, measureShapes(content), radius));

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
  }, [active, strategy, radius, zoom, layoutKey, contentRef, scrollerRef]);

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
