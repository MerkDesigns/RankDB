import { RIM } from "./recipes";

/**
 * TaskMap's directional glass rim (src/ui/materials/nativeGlassRim.ts), with one change:
 * TaskMap draws a canvas per surface; here every rim is rendered once per unique
 * size/radius/alpha into a shared image, because all rows of a list are the same size.
 */

interface RimSpec {
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly dpr: number;
  readonly baseAlpha: number;
  readonly specular: number;
  /** Stroke width and softness in the surface's own pixels. The caller divides TaskMap's values
   *  by the UI scale so the rim keeps the same on-screen width at every scale. */
  readonly strokePx: number;
  readonly softnessPx: number;
}

const cache = new Map<string, string>();

export function clearRimCache() {
  cache.clear();
}

export function rimImageUrl(spec: RimSpec): string {
  const key = `${spec.width}x${spec.height}r${spec.radius}d${spec.dpr}a${spec.baseAlpha}s${spec.specular}w${spec.strokePx}f${spec.softnessPx}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const pixelWidth = Math.max(1, Math.round(spec.width * spec.dpr));
  const pixelHeight = Math.max(1, Math.round(spec.height * spec.dpr));
  const stroke = document.createElement("canvas");
  stroke.width = pixelWidth;
  stroke.height = pixelHeight;
  const context = stroke.getContext("2d");
  if (!context) return "none";
  context.setTransform(spec.dpr, 0, 0, spec.dpr, 0, 0);
  drawRim(context, spec);

  // Bake TaskMap's 0.5px rim softness into the bitmap instead of a live CSS filter per surface.
  const soft = document.createElement("canvas");
  soft.width = pixelWidth;
  soft.height = pixelHeight;
  const softContext = soft.getContext("2d");
  if (!softContext) return "none";
  softContext.filter = `blur(${spec.softnessPx * spec.dpr}px)`;
  softContext.drawImage(stroke, 0, 0);

  const url = `url("${soft.toDataURL("image/png")}")`;
  cache.set(key, url);
  return url;
}

const scratch = document.createElement("canvas");

/**
 * Animated (live) glass: TaskMap's per-surface canvas, redrawn straight into `canvas` whenever the
 * surface's size changes, so a moving pill keeps the exact rim instead of a CSS approximation.
 */
export function paintRimCanvas(canvas: HTMLCanvasElement, spec: RimSpec) {
  const pixelWidth = Math.max(1, Math.round(spec.width * spec.dpr));
  const pixelHeight = Math.max(1, Math.round(spec.height * spec.dpr));
  for (const target of [canvas, scratch]) {
    if (target.width !== pixelWidth) target.width = pixelWidth;
    if (target.height !== pixelHeight) target.height = pixelHeight;
  }
  const stroke = scratch.getContext("2d");
  const context = canvas.getContext("2d");
  if (!stroke || !context) return;
  stroke.setTransform(1, 0, 0, 1, 0, 0);
  stroke.clearRect(0, 0, pixelWidth, pixelHeight);
  stroke.setTransform(spec.dpr, 0, 0, spec.dpr, 0, 0);
  drawRim(stroke, spec);
  context.clearRect(0, 0, pixelWidth, pixelHeight);
  context.filter = `blur(${spec.softnessPx * spec.dpr}px)`;
  context.drawImage(scratch, 0, 0);
}

export function specularAlpha(normalX: number, normalY: number, specular: number): number {
  const direction = (RIM.lightDirectionDegrees * Math.PI) / 180;
  const dot = normalX * Math.sin(direction) + normalY * -Math.cos(direction);
  const primary = Math.pow(Math.max(dot, 0), RIM.sharpness) * RIM.primaryStrength;
  const opposite = Math.pow(Math.max(-dot, 0), RIM.sharpness) * RIM.oppositeStrength;
  return Math.min(1, (primary + opposite) * RIM.specularOpacity * specular * 0.3 * RIM.exposure);
}

/** Edge alphas for the CSS approximation: the straight edges have constant normals. */
export function cssRimAlphas(baseAlpha: number, specular: number) {
  const base = Math.min(1, baseAlpha * RIM.exposure);
  const over = (highlight: number) => 1 - (1 - base) * (1 - highlight);
  const lightX = Math.sin((RIM.lightDirectionDegrees * Math.PI) / 180);
  const lightY = -Math.cos((RIM.lightDirectionDegrees * Math.PI) / 180);
  return {
    top: over(specularAlpha(0, -1, specular)),
    bottom: over(specularAlpha(0, 1, specular)),
    side: base,
    // Strongest where the corner normal points straight at the light.
    hot: over(specularAlpha(lightX, lightY, specular)),
  };
}

function drawRim(context: CanvasRenderingContext2D, spec: RimSpec) {
  const { width, height } = spec;
  const rimWidth = spec.strokePx;
  const half = Math.max(0.35, rimWidth / 2);
  const x = half;
  const y = half;
  const pathWidth = Math.max(0, width - rimWidth);
  const pathHeight = Math.max(0, height - rimWidth);
  const radius = Math.max(0, Math.min(spec.radius - half, pathWidth / 2, pathHeight / 2));
  const baseAlpha = Math.min(1, spec.baseAlpha * RIM.exposure);

  if (baseAlpha > 0.0005 && pathWidth > 0 && pathHeight > 0) {
    context.lineWidth = rimWidth;
    context.strokeStyle = `rgba(255,255,255,${baseAlpha})`;
    context.beginPath();
    context.roundRect(x, y, pathWidth, pathHeight, radius);
    context.stroke();
  }

  const segment = (x1: number, y1: number, x2: number, y2: number, nx: number, ny: number) => {
    const alpha = specularAlpha(nx, ny, spec.specular);
    if (alpha <= 0.0005) return;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.lineWidth = rimWidth;
    context.lineCap = "round";
    context.strokeStyle = `rgba(255,255,255,${alpha})`;
    context.stroke();
  };

  segment(x + radius, y, x + pathWidth - radius, y, 0, -1);
  segment(x + pathWidth, y + radius, x + pathWidth, y + pathHeight - radius, 1, 0);
  segment(x + pathWidth - radius, y + pathHeight, x + radius, y + pathHeight, 0, 1);
  segment(x, y + pathHeight - radius, x, y + radius, -1, 0);

  if (radius <= 0.01) return;
  const corners = [
    { cx: x + pathWidth - radius, cy: y + radius, start: -Math.PI / 2, end: 0 },
    { cx: x + pathWidth - radius, cy: y + pathHeight - radius, start: 0, end: Math.PI / 2 },
    { cx: x + radius, cy: y + pathHeight - radius, start: Math.PI / 2, end: Math.PI },
    { cx: x + radius, cy: y + radius, start: Math.PI, end: Math.PI * 1.5 },
  ];
  const steps = 28;
  for (const corner of corners) {
    for (let index = 0; index < steps; index += 1) {
      const start = corner.start + (corner.end - corner.start) * (index / steps);
      const end = corner.start + (corner.end - corner.start) * ((index + 1) / steps);
      const middle = (start + end) / 2;
      segment(
        corner.cx + Math.cos(start) * radius,
        corner.cy + Math.sin(start) * radius,
        corner.cx + Math.cos(end) * radius,
        corner.cy + Math.sin(end) * radius,
        Math.cos(middle),
        Math.sin(middle),
      );
    }
  }
}
