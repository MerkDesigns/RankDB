import { drawBackdrop, type BackdropSpec } from "./backdrops";
import type { RoleTuning } from "./recipes";
import { combinedSigma } from "./recipes";

/**
 * Pre-blurs the backdrop once with a material's recipe. A glass surface that reveals this image
 * looks like native backdrop-filter glass over a static backdrop, at the cost of a texture copy.
 * The blurred result is low frequency, so it is baked at a fraction of the window resolution.
 */
export async function bakeBackdrop(
  spec: BackdropSpec,
  width: number,
  height: number,
  role: RoleTuning,
): Promise<string> {
  const sigma = combinedSigma(role);
  const scale = sigma > 30 ? 0.25 : sigma > 8 ? 0.5 : 1;
  // Blur reaches ~3 sigma; drawing that far past the edge keeps the borders from going dark.
  const pad = Math.ceil(sigma * 3);
  const fullWidth = Math.max(1, Math.round((width + pad * 2) * scale));
  const fullHeight = Math.max(1, Math.round((height + pad * 2) * scale));

  const sharp = new OffscreenCanvas(fullWidth, fullHeight);
  const sharpContext = sharp.getContext("2d");
  if (!sharpContext) throw new Error("2D canvas is unavailable");
  drawBackdrop(sharpContext, spec, width, height, pad, scale);

  const outWidth = Math.max(1, Math.round(width * scale));
  const outHeight = Math.max(1, Math.round(height * scale));
  const output = new OffscreenCanvas(outWidth, outHeight);
  const outputContext = output.getContext("2d");
  if (!outputContext) throw new Error("2D canvas is unavailable");
  outputContext.filter = [
    sigma > 0 ? `blur(${sigma * scale}px)` : "",
    `saturate(${role.saturation})`,
    `brightness(${role.brightness})`,
  ]
    .filter(Boolean)
    .join(" ");
  outputContext.drawImage(sharp, -pad * scale, -pad * scale);

  const blob = await output.convertToBlob({ type: "image/png" });
  return URL.createObjectURL(blob);
}
