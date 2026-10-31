import { uiText } from "../text/index";
/**
 * Material recipes ported from TaskMap-Refactor (src/ui/materials/materialDefinitions.ts).
 * "Major" is structural chrome (header islands); "Minor" is a smaller object on top of it (rows).
 */

export type GlassRole = "major" | "minor";

export interface RoleTuning {
  /** Main backdrop blur, px. */
  blur: number;
  /** Small blur pass applied before the main one, px. */
  preblur: number;
  saturation: number;
  brightness: number;
  tintOpacity: number;
  radius: number;
  /** Uniform rim stroke alpha before specular highlights. */
  rimAlpha: number;
}

export interface Tuning {
  major: RoleTuning;
  minor: RoleTuning;
  /** Filter layers sample this many times (blur + preblur) beyond their edge, then mask back. */
  overscanRatio: number;
  /** Multiplies the directional rim highlight (TaskMap specularOpacity 0.75 = 1). */
  specular: number;
  shadowStrength: number;
  /** Dark body behind shells (surfaces drawn without their own blur). */
  shellBody: number;
}

export const TINT_RGB: Record<GlassRole, readonly [number, number, number]> = {
  major: [186, 190, 196],
  minor: [182, 183, 195],
};

export const SHADOW: Record<GlassRole, { y: number; blur: number; spread: number; opacity: number }> =
  {
    major: { y: 3.5, blur: 16.5, spread: 0, opacity: 0.5 },
    minor: { y: 3.5, blur: 11.5, spread: 0.5, opacity: 0.48 },
  };

/** Shared rim geometry (TaskMap NATIVE_GLASS_RIM). */
export const RIM = {
  widthPx: 1.5,
  softnessPx: 0.5,
  exposure: 0.9,
  lightDirectionDegrees: -22,
  primaryStrength: 2,
  oppositeStrength: 1.04,
  sharpness: 6,
  specularOpacity: 0.75,
} as const;

export const TASKMAP_TUNING: Tuning = {
  major: {
    blur: 60,
    preblur: 6,
    saturation: 0.78,
    brightness: 0.82,
    tintOpacity: 0.075,
    radius: 23,
    rimAlpha: 0.205,
  },
  minor: {
    blur: 0,
    preblur: 5,
    saturation: 0.78,
    brightness: 0.9,
    tintOpacity: 0,
    radius: 13.5,
    rimAlpha: 0.135,
  },
  overscanRatio: 3,
  specular: 1,
  shadowStrength: 1,
  shellBody: 0.28,
};

/** RankDB's chosen Glass Lab material (2026-10-30); TaskMap presets stay available separately. */
export const DEFAULT_TUNING: Tuning = {
  ...TASKMAP_TUNING,
  major: { ...TASKMAP_TUNING.major, blur: 37 },
  minor: { ...TASKMAP_TUNING.minor, rimAlpha: 0.195 },
  shadowStrength: 0,
  shellBody: 0,
};

export interface TuningPreset {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly tuning: Tuning;
}

const withMinor = (overrides: Partial<RoleTuning>, rest: Partial<Tuning> = {}): Tuning => ({
  ...TASKMAP_TUNING,
  ...rest,
  major: { ...TASKMAP_TUNING.major, ...rest.major },
  minor: { ...TASKMAP_TUNING.minor, ...overrides },
});

export const PRESETS: readonly TuningPreset[] = [
  {
    id: "taskmap",
    label: uiText("glassPresets.taskmap.label"),
    note: uiText("glassPresets.taskmap.description"),
    tuning: TASKMAP_TUNING,
  },
  {
    id: "taskmap-frosted",
    label: uiText("glassPresets.frosted.label"),
    note: uiText("glassPresets.frosted.description"),
    tuning: withMinor({ blur: 23.5 }),
  },
  {
    id: "readable",
    label: uiText("glassPresets.readable.label"),
    note: uiText("glassPresets.readable.description"),
    tuning: withMinor(
      { blur: 18, brightness: 0.7, tintOpacity: 0 },
      { shellBody: 0.45 },
    ),
  },
  {
    id: "lean",
    label: uiText("glassPresets.lean.label"),
    note: uiText("glassPresets.lean.description"),
    tuning: {
      ...TASKMAP_TUNING,
      major: { ...TASKMAP_TUNING.major, blur: 32, preblur: 0 },
      minor: { ...TASKMAP_TUNING.minor, blur: 10, preblur: 0 },
      overscanRatio: 1,
    },
  },
];

export const combinedSigma = (role: RoleTuning) => Math.hypot(role.blur, role.preblur);
export const overscanPx = (role: RoleTuning, ratio: number) => (role.blur + role.preblur) * ratio;
