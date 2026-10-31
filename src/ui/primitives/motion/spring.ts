/**
 * Exact damped-spring integration, ported from TaskMap-Refactor (src/ui/motion/motionMath.ts and
 * motionTokens.ts) so liquid motion feels identical in both apps.
 */

export interface SpringState {
  readonly position: number;
  readonly velocity: number;
}

export interface SpringConfiguration {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
  readonly positionEpsilon: number;
  readonly velocityEpsilon: number;
}

const spring = (
  stiffness: number,
  damping: number,
  mass: number,
  positionEpsilon: number,
  velocityEpsilon: number,
): SpringConfiguration => Object.freeze({ stiffness, damping, mass, positionEpsilon, velocityEpsilon });

/** TaskMap's spring tokens. */
export const SPRING = Object.freeze({
  snappy: spring(560, 38, 1, 0.08, 0.08),
  soft: spring(240, 28, 1, 0.08, 0.08),
  liquid: spring(300, 28, 1, 0.08, 0.08),
});

/** Long frames (a hitch, a hidden window) advance at most this much, so motion never jumps. */
const MAX_FRAME_DELTA_MS = 48;

export const settleSpring = (target: number): SpringState => Object.freeze({ position: target, velocity: 0 });

export function isSpringSettled(state: SpringState, target: number, configuration: SpringConfiguration): boolean {
  return (
    Math.abs(state.position - target) <= configuration.positionEpsilon &&
    Math.abs(state.velocity) <= configuration.velocityEpsilon
  );
}

/** Exact damped-oscillator step: stable at any frame rate. */
export function advanceSpring(
  state: SpringState,
  target: number,
  { stiffness, damping, mass }: SpringConfiguration,
  deltaMs: number,
): SpringState {
  const seconds = Math.min(Math.max(deltaMs, 0), MAX_FRAME_DELTA_MS) / 1000;
  if (seconds === 0) return state;
  const displacement = state.position - target;
  const angularFrequency = Math.sqrt(stiffness / mass);
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
  let nextDisplacement: number;
  let nextVelocity: number;

  if (dampingRatio < 1 - 1e-6) {
    const decayRate = dampingRatio * angularFrequency;
    const dampedFrequency = angularFrequency * Math.sqrt(1 - dampingRatio * dampingRatio);
    const coefficient = (state.velocity + decayRate * displacement) / dampedFrequency;
    const cosine = Math.cos(dampedFrequency * seconds);
    const sine = Math.sin(dampedFrequency * seconds);
    const decay = Math.exp(-decayRate * seconds);
    const wave = displacement * cosine + coefficient * sine;
    nextDisplacement = decay * wave;
    nextVelocity =
      decay * (-decayRate * wave - displacement * dampedFrequency * sine + coefficient * dampedFrequency * cosine);
  } else if (dampingRatio > 1 + 1e-6) {
    const root = Math.sqrt(dampingRatio * dampingRatio - 1);
    const rateOne = -angularFrequency * (dampingRatio - root);
    const rateTwo = -angularFrequency * (dampingRatio + root);
    const coefficientOne = (state.velocity - rateTwo * displacement) / (rateOne - rateTwo);
    const coefficientTwo = displacement - coefficientOne;
    const exponentialOne = Math.exp(rateOne * seconds);
    const exponentialTwo = Math.exp(rateTwo * seconds);
    nextDisplacement = coefficientOne * exponentialOne + coefficientTwo * exponentialTwo;
    nextVelocity = coefficientOne * rateOne * exponentialOne + coefficientTwo * rateTwo * exponentialTwo;
  } else {
    const coefficient = state.velocity + angularFrequency * displacement;
    const decay = Math.exp(-angularFrequency * seconds);
    nextDisplacement = (displacement + coefficient * seconds) * decay;
    nextVelocity = (coefficient - angularFrequency * (displacement + coefficient * seconds)) * decay;
  }

  return Object.freeze({ position: target + nextDisplacement, velocity: nextVelocity });
}
