import { createTauriInstallerClient, InstallError, type InstallFailure, type InstallStage, type InstallerClient } from "./installerClient";

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

/**
 * Development stand-in for working on every screen without installing anything (`?preview`):
 * `&existing=0.3.0` shows the update screen, `&newer` the newer-version guard, `&running` the
 * close-RankDB step for 3 seconds after Install, `&fail=failed` makes installing fail.
 */
export function createPreviewInstallerClient(): InstallerClient {
  const tauri = createTauriInstallerClient();
  const search = new URLSearchParams(window.location.search);
  const existingVersion = search.get("existing");
  const failure = search.get("fail") as InstallFailure | null;
  let runningUntil: number | null = search.has("running") ? null : 0;
  const location = String.raw`C:\Users\you\AppData\Local\RankDB`;
  return {
    details: async () => ({
      productName: "RankDB",
      version: "1.0.0",
      defaultLocation: location,
      existing: existingVersion ? { version: existingVersion, location, executable: `${location}\\rankdb.exe` } : null,
      newerInstalled: search.has("newer"),
      simulated: true,
    }),
    chooseLocation: async () => String.raw`D:\Apps\RankDB`,
    appRunning: async () => Date.now() < (runningUntil ??= Date.now() + 3000),
    async install(request, onStage) {
      const stages: InstallStage[] = ["preparing", "installing"];
      if (request.update || request.startMenuShortcut || request.desktopShortcut) stages.push("shortcuts");
      stages.push("finishing");
      for (const stage of stages) {
        onStage(stage);
        await wait(stage === "installing" ? 1400 : 700);
        if (failure && stage === "installing") throw new InstallError(failure);
      }
    },
    launch: async () => undefined,
    show: tauri.show,
    minimize: tauri.minimize,
    close: tauri.close,
  };
}
