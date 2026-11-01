import type { BackdropId } from "../lab/store";

export interface Blob {
  /** Centre as a fraction of the window. */
  readonly x: number;
  readonly y: number;
  /** Radius as a fraction of the window's longer side. */
  readonly r: number;
  readonly rgb: readonly [number, number, number];
  readonly alpha: number;
}

export interface BackdropSpec {
  readonly base: string;
  readonly dots: { readonly spacing: number; readonly radius: number; readonly alpha: number } | null;
  readonly blobs: readonly Blob[];
  readonly animated: boolean;
  /** Drawn by a WebGL field over the base colour (glass/smokeField.ts); bakes show only the base. */
  readonly field: "smoke" | "ambient" | null;
}

/** Rank colours, so the glass picks up the same hues as the badges. */
const MASTER: Blob["rgb"] = [139, 92, 246];
const EMERALD: Blob["rgb"] = [16, 185, 129];
const GOLD: Blob["rgb"] = [245, 158, 11];
const DIAMOND: Blob["rgb"] = [59, 130, 246];
const CHAMPION: Blob["rgb"] = [236, 72, 153];

const AURORA_BLOBS: readonly Blob[] = [
  { x: 0.08, y: 0.12, r: 0.34, rgb: MASTER, alpha: 0.55 },
  { x: 0.62, y: 0.3, r: 0.28, rgb: EMERALD, alpha: 0.4 },
  { x: 0.92, y: 0.08, r: 0.22, rgb: CHAMPION, alpha: 0.45 },
  { x: 0.28, y: 0.86, r: 0.3, rgb: DIAMOND, alpha: 0.5 },
  { x: 0.84, y: 0.9, r: 0.26, rgb: GOLD, alpha: 0.38 },
];

export const BACKDROP_SPECS: Record<BackdropId, BackdropSpec> = {
  flat: { base: "#090c11", dots: null, blobs: [], animated: false, field: null },
  dots: {
    base: "#050609",
    dots: { spacing: 26, radius: 1.15, alpha: 0.16 },
    blobs: [],
    animated: false,
    field: null,
  },
  aurora: {
    base: "#06070b",
    dots: { spacing: 26, radius: 1.1, alpha: 0.09 },
    blobs: AURORA_BLOBS,
    animated: false,
    field: null,
  },
  "aurora-live": {
    base: "#06070b",
    dots: { spacing: 26, radius: 1.1, alpha: 0.09 },
    blobs: AURORA_BLOBS,
    animated: true,
    field: null,
  },
  smoke: { base: "#06070b", dots: null, blobs: [], animated: true, field: "smoke" },
  ambient: { base: "#06070b", dots: null, blobs: [], animated: true, field: "ambient" },
};

/** The backdrop as drawn: its spec with the user's base colour, when one is set. */
export function resolveBackdrop(id: BackdropId, baseColor: string | null): BackdropSpec {
  const spec = BACKDROP_SPECS[id];
  return baseColor ? { ...spec, base: baseColor } : spec;
}

const rgba = ([red, green, blue]: Blob["rgb"], alpha: number) =>
  `rgba(${red}, ${green}, ${blue}, ${alpha})`;

/** Gradient stops shared by CSS and canvas so live and baked backdrops match. */
export const blobStops = (blob: Blob): readonly [number, string][] => [
  [0, rgba(blob.rgb, blob.alpha)],
  [0.45, rgba(blob.rgb, blob.alpha * 0.45)],
  [1, rgba(blob.rgb, 0)],
];

export function blobCss(blob: Blob): string {
  return `radial-gradient(circle closest-side, ${blobStops(blob)
    .map(([offset, color]) => `${color} ${offset * 100}%`)
    .join(", ")})`;
}

export function dotsCss(dots: NonNullable<BackdropSpec["dots"]>): string {
  return `radial-gradient(circle at center, rgba(255,255,255,${dots.alpha}) ${dots.radius}px, transparent ${dots.radius + 0.6}px)`;
}

/**
 * Draws the backdrop as the window shows it, offset by `pad` on every side
 * (the bake blurs past the window edge without darkening it).
 */
export function drawBackdrop(
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  spec: BackdropSpec,
  width: number,
  height: number,
  pad: number,
  scale: number,
) {
  const fullWidth = (width + pad * 2) * scale;
  const fullHeight = (height + pad * 2) * scale;
  context.fillStyle = spec.base;
  context.fillRect(0, 0, fullWidth, fullHeight);

  if (spec.dots) {
    const { spacing, radius, alpha } = spec.dots;
    context.fillStyle = `rgba(255,255,255,${alpha})`;
    // CSS tiles start at the window origin, so the lattice sits on multiples of the spacing.
    const start = -Math.ceil(pad / spacing) * spacing - spacing;
    for (let y = start; y < height + pad + spacing; y += spacing) {
      for (let x = start; x < width + pad + spacing; x += spacing) {
        context.beginPath();
        context.arc(
          (x + spacing / 2 + pad) * scale,
          (y + spacing / 2 + pad) * scale,
          radius * scale,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }
  }

  const longSide = Math.max(width, height);
  for (const blob of spec.blobs) {
    const centerX = (blob.x * width + pad) * scale;
    const centerY = (blob.y * height + pad) * scale;
    const radius = blob.r * longSide * scale;
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    for (const [offset, color] of blobStops(blob)) gradient.addColorStop(offset, color);
    context.fillStyle = gradient;
    context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
  }
}
