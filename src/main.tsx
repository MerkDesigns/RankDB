import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ALL_IMAGE_URLS } from "./data/assets";
import { initRoster } from "./data/rosterStore";
import { invoke } from "@tauri-apps/api/core";
import { initSettings } from "./data/settingsStore";
import { startGlassEngine } from "./glass/engine";
import { installLabAutomation } from "./lab/automation";
import { initLabStore, takeLegacyAppSettings } from "./lab/store";
import {
  fitWindowToContent,
  revealWindow,
  startWindowChrome,
  startSaveOnClose,
  startWindowFit,
} from "./platform/window";
import { startAppServices } from "./ui/AppUpdates";
import "./styles/app.css";
import "./styles/glass.css";
import "./styles/lab.css";
import "./styles/dialogs.css";
import "./styles/primitives.css";
import "./styles/controls.css";

for (const url of ALL_IMAGE_URLS) new Image().src = url;

// Saved settings load before the first render, so the app never flashes the defaults, and the
// window frame is applied before the (initially hidden) window is shown.
void (async () => {
  await initLabStore();
  // A database that couldn't be opened leaves the app showing only why (App's `problem`).
  const problem = await invoke<string | null>("database_problem");
  if (problem === null) {
    // App settings come from the database; ones still in an old lab settings file move over once.
    await initSettings(takeLegacyAppSettings());
    await initRoster();
    startSaveOnClose();
  }
  startGlassEngine();
  installLabAutomation();
  await startWindowChrome();
  // Committed synchronously: the window is still hidden, and hidden webviews never fire animation
  // frames, so nothing below may wait for one. The layout exists as soon as this returns.
  const root = createRoot(document.getElementById("root")!);
  flushSync(() =>
    root.render(
      <StrictMode>
        <App problem={problem} />
      </StrictMode>,
    ),
  );
  // Size the window to the UI before showing it, then keep it fitted.
  await fitWindowToContent();
  startWindowFit();
  await revealWindow();
  // Discord, What's New and the update check: after the window is up, never in the way of it.
  if (problem === null) startAppServices();
})();
