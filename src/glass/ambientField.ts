import type { AmbientTuning } from "../lab/store";

/**
 * The "ambient" backdrop: very soft lights, each a colour, drifting slowly over the base.
 * Additive Gaussian falloff, so they read as ambience rather than as circles, plus a faint static
 * grain against banding. One WebGL2 draw per layer per update at half resolution (the canvas is
 * stretched, which a gradient this soft can't show). Redraws are capped at `updates` per second,
 * like the smoke field: every redraw makes the glass above it re-blur. Nothing runs through React.
 *
 * Parallax (`parallax` > 0): the lights sit on three canvases at different depths, each slid up by
 * a share of the list's scroll by a scroll-driven animation (app.css `.backdrop-layer`), so
 * scrolling runs no JS and redraws nothing. The back layer holds the base colour; the others are
 * black with their lights and are added on top (`plus-lighter`). A layer is taller than the window
 * by how far it travels, and the window's four-light layout repeats down it, one window height
 * per tile, so the lights' places never depend on the list's length.
 */

/** Lights per window-sized tile. */
const LIGHTS = 4;
/** The most lights one layer draws (the shader's array size). */
const MAX_LIGHTS = 16;
/** The canvas renders at this share of the window's device pixels. */
const RESOLUTION = 0.5;
/** How far each layer moves per pixel scrolled at parallax 1, back to front. */
const DEPTHS = [0.06, 0.14, 0.26] as const;
/** Which layer each of a tile's lights is on. */
const LIGHT_LAYER = [0, 1, 2, 0] as const;
/** Layer heights grow in steps of this (CSS pixels), so opening a group rarely resizes a canvas. */
const TRAVEL_STEP = 256;

const VERTEX = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
// Canvas pixels per unit (the window's long side).
uniform float u_unit;
uniform vec3 u_base;
uniform int u_count;
uniform vec3 u_colors[${MAX_LIGHTS}];
// x, y and radius, in units of the window's long side, from the canvas's top left.
uniform vec3 u_lights[${MAX_LIGHTS}];
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
  vec2 point = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_unit;
  vec3 light = vec3(0.0);
  for (int i = 0; i < u_count; i++) {
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
  /** Which of the four colours. */
  readonly colour: number;
  /** Resting place, as a share of the window's width and height (y counts down the tiles). */
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

/** One window-sized tile of lights; tile 0 is the window itself. */
function tile(seed: number, index: number): Light[] {
  const next = random(seed * 9973 + 17 + index * 7919);
  return Array.from({ length: LIGHTS }, (_, light) => ({
    colour: light,
    // Spread around the window: one light per quadrant, placed loosely within it.
    x: (light % 2) * 0.5 + 0.1 + next() * 0.3,
    y: index + Math.floor(light / 2) * 0.5 + 0.1 + next() * 0.3,
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
  /** The list's scroll range and the UI scale, which set how far (and how tall) each layer is. */
  setScroll(maxScroll: number, zoom: number): void;
  destroy(): void;
}

const NO_FIELD: AmbientField = { set() {}, setScroll() {}, destroy() {} };

let snapshot: { key: string; image: string | null } | null = null;

const CONTEXT: WebGLContextAttributes = { antialias: false, alpha: false, depth: false, stencil: false };

/**
 * The field standing still at the window's shape, as an image (a PNG data URL), for the Haze
 * preview in Settings: every light on one canvas, at the top of the list. It draws once on a
 * context of its own and lets go of it at once, and the last image is kept, so showing the
 * preview again sets up no WebGL (a context took ~6 ms of waiting on the GPU, every time the
 * Visuals tab opened). Null without WebGL2.
 */
export function ambientSnapshot(tuning: AmbientTuning, background: string): string | null {
  const key = JSON.stringify([tuning, background, window.innerWidth, window.innerHeight]);
  if (snapshot?.key === key) return snapshot.image;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { ...CONTEXT, preserveDrawingBuffer: true });
  let image: string | null = null;
  if (gl && !gl.isContextLost()) {
    try {
      const field = runAmbientField([{ canvas, gl }], { ...tuning, speed: 0, parallax: 0 }, background);
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

/**
 * Starts the field on the backdrop's layer canvases (back to front); without WebGL2 (or if it
 * fails) the backdrop's base colour shows instead.
 */
export function startAmbientField(canvases: readonly HTMLCanvasElement[], initial: AmbientTuning, initialBackground: string): AmbientField {
  const layers: Layer[] = [];
  for (const canvas of canvases) {
    const gl = canvas.getContext("webgl2", CONTEXT);
    if (!gl || gl.isContextLost()) return NO_FIELD;
    layers.push({ canvas, gl });
  }
  try {
    return runAmbientField(layers, initial, initialBackground);
  } catch (error) {
    console.error(error);
    return NO_FIELD;
  }
}

interface Layer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
}

function program(gl: WebGL2RenderingContext) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
    return shader;
  };
  const linked = gl.createProgram()!;
  gl.attachShader(linked, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(linked, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.bindAttribLocation(linked, 0, "position");
  gl.linkProgram(linked);
  if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(linked) ?? "program");
  const at = (name: string) => gl.getUniformLocation(linked, name);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return {
    program: linked,
    quad,
    uniforms: {
      resolution: at("u_resolution"),
      unit: at("u_unit"),
      base: at("u_base"),
      count: at("u_count"),
      colors: at("u_colors"),
      lights: at("u_lights"),
      intensity: at("u_intensity"),
      falloff: at("u_falloff"),
      grain: at("u_grain"),
    },
  };
}

function runAmbientField(layers: readonly Layer[], initial: AmbientTuning, initialBackground: string): AmbientField {
  let tuning = initial;
  let background = initialBackground;
  let maxScroll = 0;
  let zoom = 1;
  const programs = layers.map(({ gl }) => program(gl));
  /** Per layer: CSS pixels it travels over the whole scroll, and its height step beyond the window. */
  const travel = layers.map(() => 0);
  const extra = layers.map(() => -1);

  const layered = () => tuning.parallax > 0 && layers.length > 1;
  /** Which layer a tile light is on: all on the back layer without parallax. */
  const layerOf = (light: number) => (layered() ? LIGHT_LAYER[light]! : 0);

  /** Sizes each layer to the window plus its travel (in steps), and sets how far it slides. */
  function resize() {
    const dpr = (window.devicePixelRatio || 1) * RESOLUTION;
    layers.forEach(({ canvas }, index) => {
      const shown = index === 0 || layered();
      travel[index] = shown && layered() ? DEPTHS[index]! * tuning.parallax * maxScroll : 0;
      const step = Math.ceil(travel[index]! / TRAVEL_STEP) * TRAVEL_STEP;
      canvas.style.setProperty("--layer-travel", `${travel[index]}px`);
      canvas.hidden = !shown;
      const width = Math.max(1, Math.round(window.innerWidth * dpr));
      const height = Math.max(1, Math.round((window.innerHeight + step * zoom) * dpr));
      if (step !== extra[index] || canvas.width !== width || canvas.height !== height) {
        extra[index] = step;
        canvas.style.height = step > 0 ? `calc(100% + ${step}px)` : "";
        canvas.width = width;
        canvas.height = height;
      }
    });
  }

  let time = 0;

  function draw() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const longSide = Math.max(width, height);
    const wander = tuning.drift;
    const unit = longSide * (window.devicePixelRatio || 1) * RESOLUTION;
    layers.forEach(({ canvas, gl }, index) => {
      if (canvas.hidden) return;
      // Enough tiles to cover the layer, never more lights than the shader holds.
      const tiles = Math.min(Math.ceil(canvas.height / (height * (window.devicePixelRatio || 1) * RESOLUTION)), 6);
      const colours: number[] = [];
      const placed: number[] = [];
      for (let t = 0; t < tiles; t++) {
        tile(tuning.seed, t).forEach((light, at) => {
          if (layerOf(at) !== index || placed.length / 3 >= MAX_LIGHTS) return;
          colours.push(...rgb(tuning.colors[light.colour]!));
          placed.push(
            (light.x * width) / longSide + wander * Math.sin(time * light.fx + light.px),
            (light.y * height) / longSide + wander * Math.cos(time * light.fy + light.py),
            tuning.size * light.scale,
          );
        });
      }
      const { program: linked, uniforms } = programs[index]!;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(linked);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.unit, unit);
      // Upper layers are added onto the back one, so they carry no base and no grain.
      gl.uniform3fv(uniforms.base, index === 0 ? rgb(background) : [0, 0, 0]);
      gl.uniform1i(uniforms.count, placed.length / 3);
      if (placed.length > 0) {
        gl.uniform3fv(uniforms.colors, colours);
        gl.uniform3fv(uniforms.lights, placed);
      }
      gl.uniform1f(uniforms.intensity, tuning.intensity);
      // Softness 0 → a tighter glow, 1 → a wide, barely-there wash.
      gl.uniform1f(uniforms.falloff, 5 - tuning.softness * 4);
      gl.uniform1f(uniforms.grain, index === 0 ? tuning.grain : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
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

  /** Applies a change at once: still, redraw now; moving, the loop picks it up (restarting it). */
  const redraw = () => {
    if (moving()) schedule(0);
    else {
      lastDraw = performance.now();
      draw();
    }
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
      const relayered = next.parallax !== tuning.parallax;
      tuning = next;
      background = nextBackground;
      // A resized canvas is blank until drawn, so draw it now rather than on the next update.
      if (relayered) {
        resize();
        draw();
      }
      redraw();
    },
    setScroll(nextMax, nextZoom) {
      if (nextMax === maxScroll && nextZoom === zoom) return;
      maxScroll = nextMax;
      zoom = nextZoom;
      const before = extra.join();
      resize();
      // Only a layer that grew or shrank a step (and so was cleared) needs drawing again.
      if (extra.join() !== before) draw();
    },
    destroy() {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      layers.forEach(({ gl }, index) => {
        gl.deleteBuffer(programs[index]!.quad);
        gl.deleteProgram(programs[index]!.program);
      });
    },
  };
}
