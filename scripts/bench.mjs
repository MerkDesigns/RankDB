// Reproducible glass benchmarks over the Chrome DevTools Protocol, driving `window.__lab`.
//
//   node scripts/bench.mjs      the running app from `npm run app:profile` (DevTools port 9333)
//
// Options (all optional):
//   --duration 6            seconds per run
//   --modes off,shell,baked,shared,native
//   --backdrops aurora,aurora-live
//   --accounts 40   --zoom 0.8   --overlay-header
//   --rim-major css   --rim-minor off   (or --rim <mode> for both: exact, css, flat, off)
//
// The user's lab settings are saved before the run and restored afterwards.
//   --preset taskmap        material preset id (src/glass/recipes.ts PRESETS)
//   --overscan 3            override the preset's overscan ratio
//   --label "note"          free text saved with the results
//
// Results are printed and written to bench-results/<timestamp>-webview2.{md,json}.
// Keep the window visible and leave the mouse alone: hidden or covered windows throttle frames.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = {
    duration: 6,
    modes: ["off", "shell", "baked", "shared", "native"],
    backdrops: ["aurora", "aurora-live"],
    accounts: 40,
    zoom: 0.8,
    rimMajor: "css",
    rimMinor: "off",
    overlayHeader: false,
    label: "",
    port: null,
    preset: "taskmap",
    overscan: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case "--duration": options.duration = Number(value); index += 1; break;
      case "--modes": options.modes = value.split(","); index += 1; break;
      case "--backdrops": options.backdrops = value.split(","); index += 1; break;
      case "--accounts": options.accounts = Number(value); index += 1; break;
      case "--zoom": options.zoom = Number(value); index += 1; break;
      case "--rim": options.rimMajor = value; options.rimMinor = value; index += 1; break;
      case "--rim-major": options.rimMajor = value; index += 1; break;
      case "--rim-minor": options.rimMinor = value; index += 1; break;
      case "--label": options.label = value; index += 1; break;
      case "--port": options.port = Number(value); index += 1; break;
      case "--preset": options.preset = value; index += 1; break;
      case "--overscan": options.overscan = Number(value); index += 1; break;
      case "--overlay-header": options.overlayHeader = true; break;
      default: throw new Error(`Unknown option ${flag}`);
    }
  }
  return options;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const value = await check();
      if (value) return value;
    } catch {
      /* Not ready yet. */
    }
    if (Date.now() > deadline) throw new Error(message);
    await sleep(250);
  }
}

/* ---------- Minimal CDP client (Node's built-in WebSocket) ---------- */

async function connectPage(port, urlPrefix) {
  const targets = await waitFor(
    async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await response.json();
      const page = list.find((target) => target.type === "page" && target.url.startsWith(urlPrefix));
      return page ? list : null;
    },
    90_000,
    `No page at ${urlPrefix} on DevTools port ${port}. Is the app running with --devtools-port ${port}?`,
  );
  const page = targets.find((target) => target.type === "page" && target.url.startsWith(urlPrefix));
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const callback = message.id && pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(message.error.message));
    else callback.resolve(message.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result.value;
  };
  return { send, evaluate, close: () => socket.close() };
}

/* ---------- Targets ---------- */

function webview2Target(port) {
  return {
    port,
    urlPrefix: "http://127.0.0.1:5180",
    version: "webview2",
    async stop() {},
  };
}

/* ---------- Run ---------- */

const options = parseArgs(process.argv.slice(2));
const target = webview2Target(options.port ?? 9333);

let page;
let userState = null;
try {
  page = await connectPage(target.port, target.urlPrefix);
  await page.send("Page.bringToFront").catch(() => {});
  await waitFor(() => page.evaluate("typeof window.__lab === 'object'"), 30_000, "window.__lab never appeared");

  const environment = await page.evaluate(`({
    userAgent: navigator.userAgent,
    viewport: innerWidth + "x" + innerHeight,
    dpr: devicePixelRatio,
    visible: document.visibilityState,
  })`);
  if (environment.visible !== "visible") {
    console.warn("[bench] warning: the page reports it is hidden; frame timings will be throttled.");
  }
  console.log(`[bench] ${environment.userAgent.match(/(Edg|Chrome)\/[\d.]+/g)?.join(" ")} · ${environment.viewport} @${environment.dpr}x`);

  // The lab state is the user's (it persists across restarts): put it back when done.
  userState = await page.evaluate(`__lab.state()`);
  await page.evaluate(`__lab.clearResults()`);
  await page.evaluate(
    `__lab.applyPreset(${JSON.stringify(options.preset)}, ${JSON.stringify(
      options.overscan === null ? {} : { overscanRatio: options.overscan },
    )})`,
  );
  for (const backdrop of options.backdrops) {
    for (const strategy of options.modes) {
      await page.evaluate(`__lab.set(${JSON.stringify({
        backdrop,
        strategy,
        // The dummy roster: benchmarks never depend on (or touch) the saved accounts.
        dataSource: "dummy",
        accountCount: options.accounts,
        zoom: options.zoom,
        majorRim: options.rimMajor,
        minorRim: options.rimMinor,
        overlayHeader: options.overlayHeader,
        panelOpen: false,
        meter: false,
      })})`);
      await sleep(600);
      const result = await page.evaluate(`__lab.benchmark(${options.duration * 1000})`);
      const { stats } = result;
      console.log(
        `[bench] ${backdrop.padEnd(12)} ${strategy.padEnd(7)} median ${stats.median.toFixed(2)}ms  p95 ${stats.p95.toFixed(2)}ms  p99 ${stats.p99.toFixed(2)}ms  long ${stats.longPercent.toFixed(1)}%  (${result.filterLayers} filter layers, ${result.blurredMegapixels.toFixed(1)} MPx)`,
      );
    }
  }

  const markdown = await page.evaluate(`__lab.markdown()`);
  const results = await page.evaluate(`__lab.results()`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(root, "bench-results");
  mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, `${stamp}-webview2`);
  const header = [
    `# Glass benchmark (webview2)`,
    options.label ? `\n${options.label}\n` : "",
    `Options: ${JSON.stringify({ ...options })}`,
    "",
  ].join("\n");
  writeFileSync(`${base}.md`, `${header}\n${markdown}\n`);
  writeFileSync(`${base}.json`, JSON.stringify({ options, environment, results }, null, 2));
  console.log(`\n${markdown}\n\n[bench] saved ${path.relative(root, base)}.md and .json`);
} finally {
  if (page && userState) {
    await page.evaluate(`__lab.set(${JSON.stringify(userState)})`).catch(() => {
      console.warn("[bench] could not restore the lab settings");
    });
  }
  page?.close();
  await target.stop();
}
