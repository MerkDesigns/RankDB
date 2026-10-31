import { uiText } from "../text/index";
import { whenBakeReady } from "../glass/engine";
import { settingsStore } from "../data/settingsStore";
import { labStore, type LabState, type Strategy } from "./store";

/**
 * Frame timing from requestAnimationFrame deltas. When backdrop filters make the GPU miss vsync,
 * Chromium throttles BeginFrames and the deltas stretch, so this is a fair relative measure.
 * It is not GPU time: use DevTools "Frame rendering stats" for that.
 */

export interface FrameStats {
  readonly frames: number;
  readonly fps: number;
  readonly median: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
  /** Frames that took longer than 1.5 display intervals. */
  readonly longPercent: number;
  readonly refreshHz: number;
}

export interface BenchmarkResult {
  readonly id: number;
  readonly strategy: Strategy;
  readonly backdrop: string;
  readonly tuning: string;
  readonly rim: string;
  readonly accounts: number;
  readonly overlayHeader: boolean;
  readonly filterLayers: number;
  readonly blurredMegapixels: number;
  readonly stats: FrameStats;
}

const percentile = (sorted: readonly number[], fraction: number) =>
  sorted.length === 0
    ? 0
    : sorted[Math.min(sorted.length - 1, Math.floor(fraction * (sorted.length - 1)))]!;

export function summarize(deltas: readonly number[], refreshInterval: number): FrameStats {
  const sorted = [...deltas].sort((left, right) => left - right);
  const total = deltas.reduce((sum, value) => sum + value, 0);
  return {
    frames: deltas.length,
    fps: total > 0 ? (deltas.length * 1000) / total : 0,
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1] ?? 0,
    longPercent:
      deltas.length === 0
        ? 0
        : (deltas.filter((delta) => delta > refreshInterval * 1.5).length / deltas.length) * 100,
    refreshHz: refreshInterval > 0 ? 1000 / refreshInterval : 0,
  };
}

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------- Display refresh estimate ---------- */

let refreshInterval = 1000 / 60;

export async function calibrateRefresh(): Promise<number> {
  const deltas: number[] = [];
  let previous = await nextFrame();
  for (let index = 0; index < 45; index += 1) {
    const now = await nextFrame();
    deltas.push(now - previous);
    previous = now;
  }
  // The fastest steady cadence is the display; slower samples are dropped frames.
  const sorted = deltas.sort((left, right) => left - right);
  refreshInterval = percentile(sorted, 0.2) || refreshInterval;
  return refreshInterval;
}

/* ---------- Live meter ---------- */

const RING = 240;
const ring = new Float64Array(RING);
let ringCount = 0;
let ringIndex = 0;
let meterFrame = 0;
let meterPrevious = 0;
let meterPaused = false;
/** Benchmarks pause the meter so its own DOM writes and layout reads stay out of the sample. */
export const isBenchmarkRunning = () => meterPaused;

export function startLiveMeter() {
  if (meterFrame) return;
  const tick = (now: number) => {
    if (meterPrevious && !meterPaused) {
      ring[ringIndex] = now - meterPrevious;
      ringIndex = (ringIndex + 1) % RING;
      ringCount = Math.min(RING, ringCount + 1);
    }
    meterPrevious = now;
    meterFrame = requestAnimationFrame(tick);
  };
  meterFrame = requestAnimationFrame(tick);
}

export function stopLiveMeter() {
  cancelAnimationFrame(meterFrame);
  meterFrame = 0;
  meterPrevious = 0;
  ringCount = 0;
}

export function liveStats(): FrameStats {
  return summarize(Array.from(ring.subarray(0, ringCount)), refreshInterval);
}

/* ---------- Layer census ---------- */

export interface LayerCensus {
  readonly filterLayers: number;
  readonly visibleFilterLayers: number;
  /** Device pixels covered by visible backdrop-filter layers, i.e. pixels blurred per frame. */
  readonly blurredMegapixels: number;
  readonly surfaces: number;
}

export function takeCensus(): LayerCensus {
  const layers = document.querySelectorAll<HTMLElement>("[data-filter-layer]");
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  let visible = 0;
  let area = 0;
  for (const layer of layers) {
    if (getComputedStyle(layer).display === "none") continue;
    const rect = layer.getBoundingClientRect();
    const width = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
    const height = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    if (width <= 0 || height <= 0) continue;
    visible += 1;
    area += width * height * dpr * dpr;
  }
  return {
    filterLayers: layers.length,
    visibleFilterLayers: visible,
    blurredMegapixels: area / 1_000_000,
    surfaces: document.querySelectorAll(".g").length,
  };
}

/* ---------- Scroll benchmark ---------- */

let scroller: HTMLElement | null = null;
export const registerScroller = (element: HTMLElement | null) => {
  scroller = element;
};

const results: BenchmarkResult[] = [];
const resultListeners = new Set<() => void>();
let resultsSnapshot: readonly BenchmarkResult[] = [];
let nextResultId = 1;

export const benchmarkResults = {
  get: () => resultsSnapshot,
  subscribe(listener: () => void) {
    resultListeners.add(listener);
    return () => resultListeners.delete(listener);
  },
  clear() {
    results.length = 0;
    resultsSnapshot = [];
    resultListeners.forEach((listener) => listener());
  },
};

function pushResult(result: BenchmarkResult) {
  results.push(result);
  resultsSnapshot = [...results];
  resultListeners.forEach((listener) => listener());
}

export function describeTuning(state: LabState): string {
  const { major, minor, overscanRatio } = state.tuning;
  return uiText("labPerformance.tuning", { majorPreblur: major.preblur, majorBlur: major.blur, minorPreblur: minor.preblur, minorBlur: minor.blur, overscan: overscanRatio });
}

/** Scrolls the list top↔bottom at a constant speed and records every frame. */
export async function runScrollBenchmark(durationMs = 6000, speed = 1400): Promise<BenchmarkResult> {
  if (!scroller) throw new Error(uiText("labPerformance.listNotMounted"));
  const target = scroller;
  meterPaused = true;
  try {
    target.scrollTop = 0;
    await nextFrame();
    await calibrateRefresh();
    const census = takeCensus();
    const range = Math.max(1, target.scrollHeight - target.clientHeight);
    const deltas: number[] = [];
    const start = await nextFrame();
    let previous = start;
    for (;;) {
      const now = await nextFrame();
      deltas.push(now - previous);
      previous = now;
      const elapsed = now - start;
      if (elapsed >= durationMs) break;
      // Triangle wave: down to the bottom and back up, repeatedly.
      const travelled = (elapsed / 1000) * speed;
      const phase = travelled % (range * 2);
      target.scrollTop = phase <= range ? phase : range * 2 - phase;
    }
    target.scrollTop = 0;
    const state = labStore.get();
    const result: BenchmarkResult = {
      id: nextResultId++,
      strategy: state.strategy,
      backdrop: state.backdrop,
      tuning: describeTuning(state),
      rim: `${state.majorRim}/${state.minorRim}`,
      accounts: state.accountCount,
      overlayHeader: state.overlayHeader,
      filterLayers: census.visibleFilterLayers,
      blurredMegapixels: census.blurredMegapixels,
      stats: summarize(deltas.slice(3), refreshInterval),
    };
    pushResult(result);
    return result;
  } finally {
    meterPaused = false;
  }
}

export const SWEEP_ORDER: readonly Strategy[] = ["off", "shell", "baked", "shared", "native"];

export async function runStrategySweep(
  durationMs: number,
  onProgress: (label: string) => void,
): Promise<void> {
  const original = labStore.get().strategy;
  try {
    for (const strategy of SWEEP_ORDER) {
      onProgress(uiText("labPerformance.running", { strategy: strategy }));
      labStore.set({ strategy });
      await nextFrame();
      await nextFrame();
      if (strategy === "baked") await whenBakeReady();
      await sleep(500);
      await runScrollBenchmark(durationMs);
    }
  } finally {
    labStore.set({ strategy: original });
    onProgress("");
  }
}

export function resultsMarkdown(rows: readonly BenchmarkResult[]): string {
  const baseline = (result: BenchmarkResult) =>
    rows.find(
      (candidate) =>
        candidate.strategy === "off" &&
        candidate.backdrop === result.backdrop &&
        candidate.accounts === result.accounts,
    );
  const environment = [
    navigator.userAgent.match(/(Edg|Chrome|Electron)\/[\d.]+/g)?.join(" ") ?? navigator.userAgent,
    `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
    `${(1000 / refreshInterval).toFixed(0)} Hz`,
    uiText("labPerformance.zoom", { uiScale: settingsStore.get().uiScale }),
  ].join(" · ");
  const lines = [
    uiText("labPerformance.environment", { environment: environment }),
    "",
    uiText("labPerformance.tableHeader"),
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((result) => {
      const base = baseline(result);
      const ratio = base && base.stats.p95 > 0 ? `${(result.stats.p95 / base.stats.p95).toFixed(2)}×` : "—";
      return `| ${result.id} | ${result.strategy} | ${result.backdrop} | ${result.tuning} | ${result.rim} | ${result.filterLayers} | ${result.blurredMegapixels.toFixed(1)} | ${result.stats.median.toFixed(2)} | ${result.stats.p95.toFixed(2)} | ${result.stats.p99.toFixed(2)} | ${result.stats.longPercent.toFixed(1)} | ${ratio} |`;
    }),
  ];
  return lines.join("\n");
}
