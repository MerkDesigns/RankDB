import { whenBakeReady } from "../glass/engine";
import { PRESETS, type Tuning } from "../glass/recipes";
import {
  benchmarkResults,
  resultsMarkdown,
  runScrollBenchmark,
  runStrategySweep,
  takeCensus,
  type BenchmarkResult,
} from "./perf";
import { settingsStore } from "../data/settingsStore";
import { labStore, type LabState } from "./store";
import { clearToastPreviews, previewToasts } from "./toastPreview";

/**
 * `window.__lab`: a stable surface for MCP tools (tauri webview_execute_js, browser javascript)
 * and benchmark scripts, so they never click through the panel or reach into React.
 */
/** Lab state plus the UI scale (an app setting now, but benchmarks set it with the rest). */
type AutomationState = LabState & { readonly zoom: number };

export interface LabAutomation {
  readonly state: () => AutomationState;
  readonly previewToasts: typeof previewToasts;
  readonly clearToastPreviews: typeof clearToastPreviews;
  /** Applies a patch and resolves once React has rendered it (and any bake has finished). */
  readonly set: (patch: Partial<AutomationState>) => Promise<AutomationState>;
  readonly census: typeof takeCensus;
  readonly benchmark: (durationMs?: number, speed?: number) => Promise<BenchmarkResult>;
  readonly sweep: (durationMs?: number) => Promise<readonly BenchmarkResult[]>;
  readonly results: () => readonly BenchmarkResult[];
  readonly markdown: () => string;
  readonly clearResults: () => void;
  readonly reset: () => Promise<LabState>;
  /** Applies a material preset by id, optionally overriding fields of the result. */
  readonly applyPreset: (id: string, overrides?: Partial<Tuning>) => Promise<LabState>;
}

const frames = (count: number) =>
  new Promise<void>((resolve) => {
    const step = (remaining: number) =>
      remaining <= 0 ? resolve() : requestAnimationFrame(() => step(remaining - 1));
    step(count);
  });

async function settle() {
  await frames(2);
  if (labStore.get().strategy === "baked") await whenBakeReady();
  await frames(2);
}

const state = (): AutomationState => ({ ...labStore.get(), zoom: settingsStore.get().uiScale });

export function installLabAutomation() {
  const automation: LabAutomation = {
    state,
    previewToasts,
    clearToastPreviews,
    async set({ zoom, ...patch }) {
      labStore.set(patch);
      if (zoom !== undefined) settingsStore.set({ uiScale: zoom });
      await settle();
      return state();
    },
    census: takeCensus,
    benchmark: (durationMs = 6000, speed = 1400) => runScrollBenchmark(durationMs, speed),
    async sweep(durationMs = 6000) {
      const before = benchmarkResults.get().length;
      await runStrategySweep(durationMs, () => {});
      return benchmarkResults.get().slice(before);
    },
    results: benchmarkResults.get,
    markdown: () => resultsMarkdown(benchmarkResults.get()),
    clearResults: benchmarkResults.clear,
    async reset() {
      labStore.reset();
      await settle();
      return state();
    },
    async applyPreset(id, overrides = {}) {
      const preset = PRESETS.find((entry) => entry.id === id);
      if (!preset) throw new Error(`Unknown preset ${id}; known: ${PRESETS.map((entry) => entry.id).join(", ")}`);
      labStore.set({ tuning: { ...preset.tuning, ...overrides } });
      await settle();
      return labStore.get();
    },
  };
  (window as unknown as { __lab: LabAutomation }).__lab = automation;
}
