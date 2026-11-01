import { useEffect, useReducer, useRef, useState } from "react";
import { Minus, X } from "lucide-react";
import { startSmokeField } from "../glass/smokeField";
import type { SmokeTuning } from "../lab/store";
import { uiText } from "../text/index";
import { InstallError, type InstallerClient } from "./installerClient";
import { initialInstallerState, installerReducer, installKind } from "./installerFlow";
import {
  AppRunningScreen,
  FailedScreen,
  FinishedScreen,
  InstallingScreen,
  NewerInstalledScreen,
  OptionsScreen,
  UpdateScreen,
  WelcomeScreen,
} from "./InstallerScreens";
import appIcon from "../../src-tauri/icons/32x32.png";

/** How often the close-RankDB step checks whether it has closed. */
const APP_POLL_MS = 800;

/** The scene: the app's ASCII smoke (glass/smokeField.ts), faint and in the icon's purples. */
const SCENE_BASE = "#06070b";
const SCENE_SMOKE: SmokeTuning = {
  cellHeight: 19,
  speed: 1.1,
  updates: 60,
  trail: 0.48,
  contrast: 1.3,
  brightness: 0.27,
  opacity: 0.14,
  ink: "#a681fe",
  accent: "#8b93fe",
  charset: " .:-=+*#%@",
};

export function InstallerApp({ client }: { readonly client: InstallerClient }) {
  const [state, dispatch] = useReducer(installerReducer, initialInstallerState);
  const [launch, setLaunch] = useState(true);
  const waiting = useRef(0);
  const scene = useRef<HTMLCanvasElement>(null);
  const { details, options, screen } = state;
  const kind = installKind(details);
  const product = details?.productName ?? uiText("common.rankdb");

  useEffect(() => {
    let current = true;
    client.details().then(
      (loaded) => current && dispatch({ type: "loaded", details: loaded }),
      () => current && dispatch({ type: "failed", failure: "unknown" }),
    );
    return () => {
      current = false;
    };
  }, [client]);

  useEffect(() => {
    if (!scene.current) return;
    const smoke = startSmokeField(scene.current, SCENE_SMOKE, SCENE_BASE);
    return smoke.destroy;
  }, []);

  const stopWaiting = () => window.clearTimeout(waiting.current);
  useEffect(() => stopWaiting, []);

  const runInstall = () => {
    dispatch({ type: "start" });
    client.install({ ...options, update: kind !== "install" }, (stage) => dispatch({ type: "stage", stage })).then(
      () => dispatch({ type: "succeeded" }),
      (error: unknown) => dispatch({ type: "failed", failure: error instanceof InstallError ? error.failure : "unknown" }),
    );
  };

  // An open RankDB is asked to close rather than ended by the installer, so it saves first;
  // installing continues by itself once it has.
  const install = async () => {
    stopWaiting();
    if (!(await client.appRunning().catch(() => false))) return runInstall();
    dispatch({ type: "waitForApp" });
    const check = async () => {
      if (await client.appRunning().catch(() => false)) waiting.current = window.setTimeout(check, APP_POLL_MS);
      else runInstall();
    };
    waiting.current = window.setTimeout(check, APP_POLL_MS);
  };

  const browse = () => {
    void client.chooseLocation(options.location, uiText("installer.optionsPage.chooseFolder", { product })).then((location) => {
      if (location) dispatch({ type: "setLocation", location });
    });
  };
  const finish = async () => {
    if (launch) await client.launch().catch(() => undefined);
    await client.close();
  };
  const back = () => {
    stopWaiting();
    dispatch({ type: "back" });
  };
  const installing = screen.name === "installing";

  return (
    <div className="installer" data-screen={screen.name}>
      <div className="installer-scene" aria-hidden="true" data-drag-region="">
        <canvas ref={scene} className="installer-field" />
      </div>
      <header className="installer-titlebar" data-drag-region="">
        <img src={appIcon} alt="" width={16} height={16} draggable={false} />
        <span>{uiText("installer.windowTitle", { product })}</span>
        <span className="window-controls">
          <button
            type="button"
            className="window-button"
            data-kind="minimize"
            aria-label={uiText("windowControls.minimize")}
            onClick={() => void client.minimize()}
          >
            <Minus size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="window-button"
            data-kind="close"
            aria-label={uiText("common.close")}
            // Closing mid-install would abandon NSIS halfway.
            disabled={installing}
            onClick={() => void client.close()}
          >
            <X size={17} strokeWidth={2} />
          </button>
        </span>
      </header>
      <main className="installer-content" key={screen.name}>
          {details && screen.name === "welcome" && (
            <WelcomeScreen details={details} onInstall={() => void install()} onOptions={() => dispatch({ type: "showOptions" })} />
          )}
          {details && screen.name === "update" && (
            <UpdateScreen
              details={details}
              kind={kind}
              onUpdate={() => void install()}
              onOptions={() => dispatch({ type: "showOptions" })}
            />
          )}
          {details && screen.name === "newer" && <NewerInstalledScreen details={details} onClose={() => void client.close()} />}
          {screen.name === "options" && (
            <OptionsScreen
              options={options}
              kind={kind}
              onBrowse={browse}
              onShortcut={(shortcut, on) => dispatch({ type: "setShortcut", shortcut, on })}
              onBack={back}
              onInstall={() => void install()}
            />
          )}
          {screen.name === "appRunning" && <AppRunningScreen product={product} onBack={back} />}
          {screen.name === "installing" && <InstallingScreen product={product} kind={kind} options={options} stage={screen.stage} />}
          {details && screen.name === "finished" && (
            <FinishedScreen details={details} kind={kind} launch={launch} onLaunchChange={setLaunch} onFinish={() => void finish()} />
          )}
          {screen.name === "failed" && (
            <FailedScreen product={product} failure={screen.failure} onRetry={back} onClose={() => void client.close()} />
          )}
      </main>
    </div>
  );
}
