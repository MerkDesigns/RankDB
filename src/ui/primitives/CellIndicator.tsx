import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { Glass } from "../../glass/Glass";

/**
 * A rim-only glass highlight that glides between cells of a grid with a plain ease-in-out, keeping
 * its shape (no liquid stretch). Place it first inside the grid's positioned parent; `x`/`y` are
 * the target cell's top-left corner in that parent's coordinates.
 */
export function CellIndicator({
  x,
  y,
  size,
  radius,
  className,
}: {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly radius: number;
  readonly className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const placed = useRef({ size, radius, first: true });

  // First placement and size changes (lab tuning) land instantly; only a new cell glides.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const instant = placed.current.first || placed.current.size !== size || placed.current.radius !== radius;
    placed.current = { size, radius, first: false };
    element.toggleAttribute("data-instant", instant);
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [x, y, size, radius]);

  return (
    <Glass
      ref={ref}
      role="minor"
      rimOnly
      aria-hidden="true"
      className={["cell-indicator", className].filter(Boolean).join(" ")}
      // Corners come from CSS (the owner's radius variable), so a lab change reaches the rim
      // repaint before React re-renders.
      style={{ width: size, height: size } as CSSProperties}
    />
  );
}
