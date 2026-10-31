import { advanceSpring, isSpringSettled, settleSpring, SPRING, type SpringState } from "./spring";

/**
 * The liquid toggle knob's motion, ported from TaskMap-Refactor (src/ui/motion/liquidToggleMotion.ts):
 * one spring for the position; while moving, the knob stretches along the track and thins with
 * speed, and may overshoot the ends by a hair. RankDB's switch is smaller than TaskMap's 52×30;
 * the deformation is scaled with it.
 */

export const LIQUID_TOGGLE_TRACK_WIDTH_PX = 40;
export const LIQUID_TOGGLE_TRACK_HEIGHT_PX = 24;
export const LIQUID_TOGGLE_INSET_PX = 3;
export const LIQUID_TOGGLE_KNOB_SIZE_PX = 18;
export const LIQUID_TOGGLE_TRAVEL_PX =
  LIQUID_TOGGLE_TRACK_WIDTH_PX - LIQUID_TOGGLE_KNOB_SIZE_PX - LIQUID_TOGGLE_INSET_PX * 2;

const MAX_STRETCH_PX = 6;
const MAX_THIN_PX = 3;
const DEFORMATION_VELOCITY = 140;
const MAX_OVERSHOOT_PX = 1.5;

export interface LiquidToggleState {
  readonly position: SpringState;
}

export interface LiquidToggleFrame {
  readonly state: LiquidToggleState;
  readonly x: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly settled: boolean;
}

export function createLiquidToggleState(checked: boolean): LiquidToggleState {
  return Object.freeze({ position: settleSpring(checked ? LIQUID_TOGGLE_TRAVEL_PX : 0) });
}

export function advanceLiquidToggle(
  state: LiquidToggleState,
  checked: boolean,
  deltaMs: number,
): LiquidToggleFrame {
  const target = checked ? LIQUID_TOGGLE_TRAVEL_PX : 0;
  const position = advanceSpring(state.position, target, SPRING.liquid, deltaMs);
  if (isSpringSettled(position, target, SPRING.liquid)) return settledLiquidToggle(checked);

  const deformation = Math.min(1, Math.abs(position.velocity) / DEFORMATION_VELOCITY);
  const width = LIQUID_TOGGLE_KNOB_SIZE_PX + MAX_STRETCH_PX * deformation;
  const height = LIQUID_TOGGLE_KNOB_SIZE_PX - MAX_THIN_PX * deformation;
  const boundedPosition = Math.max(
    -MAX_OVERSHOOT_PX,
    Math.min(LIQUID_TOGGLE_TRAVEL_PX + MAX_OVERSHOOT_PX, position.position),
  );
  return Object.freeze({
    state: Object.freeze({ position }),
    x: LIQUID_TOGGLE_INSET_PX + boundedPosition - (width - LIQUID_TOGGLE_KNOB_SIZE_PX) / 2,
    width,
    height,
    radius: height / 2,
    settled: false,
  });
}

export function settledLiquidToggle(checked: boolean): LiquidToggleFrame {
  return Object.freeze({
    state: createLiquidToggleState(checked),
    x: LIQUID_TOGGLE_INSET_PX + (checked ? LIQUID_TOGGLE_TRAVEL_PX : 0),
    width: LIQUID_TOGGLE_KNOB_SIZE_PX,
    height: LIQUID_TOGGLE_KNOB_SIZE_PX,
    radius: LIQUID_TOGGLE_KNOB_SIZE_PX / 2,
    settled: true,
  });
}
