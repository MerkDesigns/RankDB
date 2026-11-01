import type { AmbientTuning } from "../lab/store";

/**
 * The "ambient" backdrop: four very soft lights, each a colour, drifting slowly over the base.
 * Additive Gaussian falloff, so they read as ambience rather than as circles, plus a faint static
 * grain against banding. One WebGL2 draw per update at half resolution (the canvas is stretched,
 * which a gradient this soft can't show). Redraws are capped at `updates` per second, like the
 * smoke field: every redraw makes the glass above it re-blur. Nothing runs through React.
 */

const LIGHTS = 4;
/** The canvas renders at this share of the window's device pixels. */
const RESOLUTION = 0.5;

const VERTEX = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform vec3 u_base;
uniform vec3 u_colors[${LIGHTS}];
// x, y and radius, in units of the window's long side.
uniform vec3 u_lights[${LIGHTS}];
uniform float u_intensity;
uniform float u_falloff;
uniform float u_grain;
out vec4 fragColor;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  float longSide = max(u_resolution.x, u_resolution.y);
  vec2 point = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / longSide;
  vec3 light = vec3(0.0);
  for (int i = 0; i < ${LIGHTS}; i++) {
    vec2 offset = (point - u_lights[i].xy) / u_lights[i].z;
    light += u_colors[i] * exp(-dot(offset, offset) * u_falloff);
  }
  vec3 colour = u_base + light * u_intensity;
  colour += (hash21(gl_FragCoord.xy) - 0.5) * u_grain / 255.0;
  fragColor = vec4(colour, 1.0);
}`;

const rgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255) as [number, number, number];

/** A small seeded generator (mulberry32), so a seed always gives the same layout. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Light {
  /** Resting place, as a share of the window's width and height. */
  readonly x: number;
  readonly y: number;
  /** Radius relative to the Size setting. */
  readonly scale: number;
  /** Wander frequencies and phases, so no two lights move in step. */
  readonly fx: number;
  readonly fy: number;
  readonly px: number;
  readonly py: number;
}

function layout(seed: number): Light[] {
  const next = random(seed * 9973 + 17);
  return Array.from({ length: LIGHTS }, (_, index) => ({
    // Spread around the window: one light per quadrant, placed loosely within it.
    x: (index % 2) * 0.5 + 0.1 + next() * 0.3,
    y: Math.floor(index / 2) * 0.5 + 0.1 + next() * 0.3,
    scale: 0.75 + next() * 0.5,
    fx: 0.6 + next() * 0.8,
    fy: 0.6 + next() * 0.8,
    px: next() * Math.PI * 2,
    py: next() * Math.PI * 2,
  }));
}

export interface AmbientField {
  /** New tuning or base colour; applied on the next update. */
  set(tuning: AmbientTuning, background: string): void;
  destroy(): void;
}

const NO_FIELD: AmbientField = { set() {}, destroy() {} };

let snapshot: { key: string; image: string | null } | null = null;

/**
 * The field standing still at the window's shape, as an image (a PNG data URL), for the Haze
 * preview in Settings. It draws once on a context of its own and lets go of it at once, and the
 * last image is kept, so showing the preview again sets up no WebGL (a context took ~6 ms of
 * waiting on the GPU, every time the Visuals tab opened). Null without WebGL2.
 */
export function ambientSnapshot(tuning: AmbientTuning, background: string): string | null {
  const key = JSON.stringify([tuning, background, window.innerWidth, window.innerHeight]);
  if (snapshot?.key === key) return snapshot.image;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true });
  let image: string | null = null;
  if (gl && !gl.isContextLost()) {
    try {
      const field = runAmbientField(canvas, gl, { ...tuning, speed: 0 }, background);
      image = canvas.toDataURL();
      field.destroy();
    } catch (error) {
      console.error(error);
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
  snapshot = { key, image };
  return image;
}

/** Starts the field; without WebGL2 (or if it fails) the backdrop's base colour shows instead. */
export function startAmbientField(canvas: HTMLCanvasElement, initial: AmbientTuning, initialBackground: string): AmbientField {
  const context = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false });
  if (!context || context.isContextLost()) return NO_FIELD;
  try {
    return runAmbientField(canvas, context, initial, initialBackground);
  } catch (error) {
    console.error(error);
    return NO_FIELD;
  }
}

function runAmbientField(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, initial: AmbientTuning, initialBackground: string): AmbientField {
  let tuning = initial;
  let background = initialBackground;
  let lights = layout(tuning.seed);

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.bindAttribLocation(program, 0, "position");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "program");
  const at = (name: string) => gl.getUniformLocation(program, name);
  const uniforms = {
    resolution: at("u_resolution"),
    base: at("u_base"),
    colors: at("u_colors"),
    lights: at("u_lights"),
    intensity: at("u_intensity"),
    falloff: at("u_falloff"),
    grain: at("u_grain"),
  };

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function resize() {
    const scale = (window.devicePixelRatio || 1) * RESOLUTION;
    canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
    canvas.height = Math.max(1, Math.round(window.innerHeight * scale));
  }

  let time = 0;

  function draw() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const longSide = Math.max(width, height);
    const wander = tuning.drift;
    const placed = new Float32Array(LIGHTS * 3);
    lights.forEach((light, index) => {
      placed[index * 3] = (light.x * width) / longSide + wander * Math.sin(time * light.fx + light.px);
      placed[index * 3 + 1] = (light.y * height) / longSide + wander * Math.cos(time * light.fy + light.py);
      placed[index * 3 + 2] = tuning.size * light.scale;
    });
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform3fv(uniforms.base, rgb(background));
    gl.uniform3fv(uniforms.colors, tuning.colors.flatMap(rgb));
    gl.uniform3fv(uniforms.lights, placed);
    gl.uniform1f(uniforms.intensity, tuning.intensity);
    // Softness 0 → a tighter glow, 1 → a wide, barely-there wash.
    gl.uniform1f(uniforms.falloff, 5 - tuning.softness * 4);
    gl.uniform1f(uniforms.grain, tuning.grain);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---------- Loop: one frame per update; none while nothing moves ---------- */

  let frame = 0;
  let timer = 0;
  let lastDraw = performance.now();
  const moving = () => tuning.speed > 0 && tuning.drift > 0;
  const schedule = (wait: number) => {
    window.clearTimeout(timer);
    cancelAnimationFrame(frame);
    timer = window.setTimeout(() => (frame = requestAnimationFrame(tick)), Math.max(0, wait));
  };
  const tick = (now: number) => {
    // A long gap (hidden window) resumes where it was instead of jumping ahead.
    const step = Math.min((now - lastDraw) / 1000, 0.25);
    lastDraw = now;
    time += step * tuning.speed * 0.25;
    draw();
    // Draws fall on whole periods of the page clock, the same clock as the rank effects' 1/60 s
    // steps (rankEffects.ts), so most share a frame with an effect step instead of adding one
    // (82 → ~73 frames a second at 357 Hz; waking early to always hit it cost more page frames than
    // it saved).
    const period = 1000 / tuning.updates;
    if (moving()) schedule((Math.round(now / period) + 1) * period - performance.now());
  };

  const onResize = () => {
    resize();
    draw();
  };
  window.addEventListener("resize", onResize);
  resize();
  draw();
  if (moving()) schedule(0);

  return {
    set(next, nextBackground) {
      const reseeded = next.seed !== tuning.seed;
      tuning = next;
      background = nextBackground;
      if (reseeded) lights = layout(tuning.seed);
      // Still: redraw once to show the change. Moving: the loop picks it up (and restarts if it
      // had stopped because nothing moved).
      if (moving()) schedule(0);
      else {
        lastDraw = performance.now();
        draw();
      }
    },
    destroy() {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
    },
  };
}
