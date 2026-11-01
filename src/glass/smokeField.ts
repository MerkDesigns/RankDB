import type { SmokeTuning } from "../lab/store";

/**
 * The "smoke" backdrop: a grid of monospace cells, each showing a glyph picked by smoke rising from
 * the bottom centre, with a phosphor afterglow. One WebGL2 draw per update plus a copy to the
 * screen; nothing runs through React.
 *
 * The smoke field, tone curve, ink-to-accent colouring and trail follow motes by Lucas Marques
 * (https://github.com/lucasmarkes/motes, MIT License, Copyright (c) 2026 Lucas Marques). Unlike
 * motes, redraws are capped (`updates` per second): every redraw makes the glass above re-blur, so
 * it must not follow the display's full refresh rate.
 */

const VERTEX = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const FIELD = `#version 300 es
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_dpr;
uniform vec2 u_cell;
uniform vec2 u_grid;
uniform sampler2D u_glyphs;
uniform int u_charCount;
uniform sampler2D u_prev;
uniform float u_fade;
uniform vec3 u_background;
uniform vec3 u_ink;
uniform vec3 u_accent;
uniform float u_contrast;
uniform float u_brightness;
uniform float u_opacity;
out vec4 fragColor;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * valueNoise(p);
    p *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

// Smoke rising from the bottom centre, curling and widening as it goes.
float field(vec2 cell, float t) {
  float h = cell.y / u_grid.y;
  vec2 p = cell * vec2(0.07, 0.12) + vec2(0.0, t * 0.35);
  float w = fbm(p * 1.3 + vec2(t * 0.1, 0.0));
  float n = fbm(p + vec2(w * 1.6, w * 0.4));
  float width = 0.1 + (1.0 - h) * 0.32;
  float source = exp(-pow((cell.x / u_grid.x - 0.5) / width, 2.0));
  return smoothstep(0.38, 0.78, n) * source * (0.25 + 0.75 * h);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_dpr;
  vec2 g = px / u_cell;
  vec2 cell = floor(g);
  vec2 sub = fract(g);

  // Phosphor: the previous update, pulled toward the background.
  vec3 faded = mix(texelFetch(u_prev, ivec2(gl_FragCoord.xy), 0).rgb, u_background, u_fade);

  float value = clamp((field(cell, u_time) - 0.5) * u_contrast + 0.5 + u_brightness, 0.0, 1.0);
  // Near-empty cells stay empty: a sparser field, and a cheap early out.
  if (value < 0.14) {
    fragColor = vec4(faded, 1.0);
    return;
  }

  int glyph = int(value * float(u_charCount - 1));
  float coverage = texture(u_glyphs, vec2((float(glyph) + sub.x) / float(u_charCount), sub.y)).a * u_opacity;
  // Dim cells lean toward the background, bright ones toward the ink; value pushes toward the accent.
  vec3 dim = mix(u_background, u_ink, 0.44 + value * 0.56);
  vec3 colour = mix(dim, u_accent, value * 0.5);
  fragColor = vec4(mix(faded, colour, coverage), 1.0);
}`;

const COPY = `#version 300 es
precision highp float;
uniform sampler2D u_src;
out vec4 fragColor;
void main() { fragColor = texelFetch(u_src, ivec2(gl_FragCoord.xy), 0); }`;

const FIELD_UNIFORMS = [
  "u_time", "u_resolution", "u_dpr", "u_cell", "u_grid", "u_glyphs", "u_charCount", "u_prev", "u_fade",
  "u_background", "u_ink", "u_accent", "u_contrast", "u_brightness", "u_opacity",
] as const;

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255) as [number, number, number];

interface Target {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
}

export interface SmokeField {
  /** New tuning or base colour; applied on the next update. */
  set(tuning: SmokeTuning, background: string): void;
  destroy(): void;
}

const NO_FIELD: SmokeField = { set() {}, destroy() {} };

/** Starts the field; without WebGL2 (or if it fails) the backdrop's base colour shows instead. */
export function startSmokeField(canvas: HTMLCanvasElement, initial: SmokeTuning, initialBackground: string): SmokeField {
  const context = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false });
  if (!context || context.isContextLost()) return NO_FIELD;
  try {
    return runSmokeField(canvas, context, initial, initialBackground);
  } catch (error) {
    console.error(error);
    return NO_FIELD;
  }
}

function runSmokeField(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, initial: SmokeTuning, initialBackground: string): SmokeField {

  let tuning = initial;
  let background = initialBackground;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
    return shader;
  };
  const link = (fragment: string) => {
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.bindAttribLocation(program, 0, "position");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "program");
    return program;
  };
  const fieldProgram = link(FIELD);
  const copyProgram = link(COPY);
  const uniforms = Object.fromEntries(FIELD_UNIFORMS.map((name) => [name, gl.getUniformLocation(fieldProgram, name)])) as Record<
    (typeof FIELD_UNIFORMS)[number],
    WebGLUniformLocation | null
  >;
  const copySource = gl.getUniformLocation(copyProgram, "u_src");

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  /* ---------- Glyphs: one strip of monospace characters, white on transparent ---------- */

  const glyphs = gl.createTexture();
  let dpr = 1;
  let atlasKey = "";
  const cellSize = () => ({ width: Math.max(5, tuning.cellHeight * 0.6), height: tuning.cellHeight });

  function buildGlyphs() {
    const { width, height } = cellSize();
    const key = `${width}x${height}@${dpr}:${tuning.charset}`;
    if (key === atlasKey) return;
    atlasKey = key;
    const glyphWidth = Math.ceil(width * dpr);
    const glyphHeight = Math.ceil(height * dpr);
    const chars = [...tuning.charset];
    const atlas = document.createElement("canvas");
    atlas.width = glyphWidth * chars.length;
    atlas.height = glyphHeight;
    const pen = atlas.getContext("2d")!;
    pen.fillStyle = "#fff";
    pen.textAlign = "center";
    pen.textBaseline = "middle";
    pen.font = `500 ${Math.round(glyphHeight * 0.82)}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
    chars.forEach((char, index) => pen.fillText(char, index * glyphWidth + glyphWidth / 2, glyphHeight * 0.54));
    gl.bindTexture(gl.TEXTURE_2D, glyphs);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /* ---------- Trail: two targets, each update reads one and writes the other ---------- */

  let targets: Target[] = [];
  let current = 0;

  function makeTarget(width: number, height: number): Target {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return { texture, framebuffer };
  }

  function clearTrail() {
    const [red, green, blue] = rgb(background);
    for (const target of targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.clearColor(red, green, blue, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  /** The canvas covers the window (it sits in a fixed, full-window backdrop). */
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(window.innerWidth * dpr));
    const height = Math.max(1, Math.round(window.innerHeight * dpr));
    if (canvas.width === width && canvas.height === height && targets.length) return;
    canvas.width = width;
    canvas.height = height;
    for (const target of targets) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.framebuffer);
    }
    targets = [makeTarget(width, height), makeTarget(width, height)];
    buildGlyphs();
    clearTrail();
  }

  /* ---------- Drawing ---------- */

  let time = 0;

  function draw(elapsed: number) {
    const { width, height } = cellSize();
    const source = targets[current]!;
    const target = targets[1 - current]!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(fieldProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, glyphs);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    gl.uniform1i(uniforms.u_glyphs, 0);
    gl.uniform1i(uniforms.u_prev, 1);
    gl.uniform1f(uniforms.u_time, time);
    gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.u_dpr, dpr);
    gl.uniform2f(uniforms.u_cell, width, height);
    gl.uniform2f(uniforms.u_grid, Math.ceil(window.innerWidth / width), Math.ceil(window.innerHeight / height));
    gl.uniform1i(uniforms.u_charCount, [...tuning.charset].length);
    // The same fade per second whatever the update rate (motes fades per 60 Hz frame).
    const fadePerFrame = Math.max(0.02, 1 - tuning.trail);
    gl.uniform1f(uniforms.u_fade, Math.min(1, 1 - Math.pow(1 - fadePerFrame, elapsed * 60)));
    gl.uniform3fv(uniforms.u_background, rgb(background));
    gl.uniform3fv(uniforms.u_ink, rgb(tuning.ink));
    gl.uniform3fv(uniforms.u_accent, rgb(tuning.accent));
    gl.uniform1f(uniforms.u_contrast, tuning.contrast);
    gl.uniform1f(uniforms.u_brightness, tuning.brightness);
    gl.uniform1f(uniforms.u_opacity, tuning.opacity);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(copyProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.uniform1i(copySource, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    current = 1 - current;
  }

  /* ---------- Loop: one frame per update, not per display refresh ---------- */

  // Every requested frame runs a full page frame (style, layout and every CSS animation), even
  // when the field skips drawing, so between updates the loop sleeps on a timer instead.
  let frame = 0;
  let timer = 0;
  let lastDraw = performance.now();
  const tick = (now: number) => {
    // A long gap (hidden window) resumes where it was instead of jumping ahead.
    const step = Math.min((now - lastDraw) / 1000, 0.25);
    lastDraw = now;
    time += step * tuning.speed;
    draw(step);
    // Wake just before the next update is due; the frame it asks for lands on the next refresh.
    const wait = 1000 / tuning.updates - (performance.now() - now) - 1;
    timer = window.setTimeout(() => (frame = requestAnimationFrame(tick)), Math.max(0, wait));
  };

  window.addEventListener("resize", resize);
  resize();
  draw(0);
  frame = requestAnimationFrame(tick);

  return {
    set(next, nextBackground) {
      const backgroundChanged = nextBackground !== background;
      tuning = next;
      background = nextBackground;
      buildGlyphs();
      if (backgroundChanged) clearTrail();
    },
    destroy() {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("resize", resize);
      // The canvas keeps its context (a remount gets the same one), so free what this run made.
      for (const target of targets) {
        gl.deleteTexture(target.texture);
        gl.deleteFramebuffer(target.framebuffer);
      }
      gl.deleteTexture(glyphs);
      gl.deleteBuffer(quad);
      gl.deleteProgram(fieldProgram);
      gl.deleteProgram(copyProgram);
    },
  };
}
