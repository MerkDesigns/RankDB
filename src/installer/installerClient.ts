import { Channel, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface ExistingInstall {
  readonly version: string;
  readonly location: string;
  readonly executable: string;
}

export interface InstallerDetails {
  readonly productName: string;
  readonly version: string;
  readonly defaultLocation: string;
  readonly existing: ExistingInstall | null;
  /** An older app refuses a newer database, so setup never downgrades. */
  readonly newerInstalled: boolean;
  /** Development builds carry no NSIS installer and only simulate installing. */
  readonly simulated: boolean;
}

export interface InstallRequest {
  readonly location: string;
  readonly startMenuShortcut: boolean;
  readonly desktopShortcut: boolean;
  readonly update: boolean;
}

export type InstallStage = "preparing" | "installing" | "shortcuts" | "finishing";

/** Content-free failure kinds reported by installer/src/install.rs. */
export const INSTALL_FAILURES = [
  "invalidLocation",
  "prepare",
  "start",
  "failed",
  "notFound",
  "shortcut",
  "appRunning",
  "newerInstalled",
  "unknown",
] as const;
export type InstallFailure = (typeof INSTALL_FAILURES)[number];

export class InstallError extends Error {
  constructor(readonly failure: InstallFailure) {
    super(`Installation failed: ${failure}`);
  }
}

const toInstallError = (error: unknown) =>
  new InstallError(
    INSTALL_FAILURES.find((failure) => failure === error) ?? "unknown",
  );

export interface InstallerClient {
  details(): Promise<InstallerDetails>;
  /** Opens a folder picker; resolves to the chosen install folder, or null when cancelled. */
  chooseLocation(current: string, title: string): Promise<string | null>;
  /** Whether the installed app is open (its files can't be replaced while it runs). */
  appRunning(): Promise<boolean>;
  install(request: InstallRequest, onStage: (stage: InstallStage) => void): Promise<void>;
  launch(): Promise<void>;
  show(): Promise<void>;
  minimize(): Promise<void>;
  close(): Promise<void>;
}

export function createTauriInstallerClient(): InstallerClient {
  return {
    details: () => invoke<InstallerDetails>("installer_details"),
    chooseLocation: (current, title) =>
      invoke<string | null>("installer_choose_location", { current, title }),
    appRunning: () => invoke<boolean>("installer_app_running"),
    async install(request, onStage) {
      const channel = new Channel<InstallStage>();
      channel.onmessage = onStage;
      try {
        await invoke("installer_run", { request, onStage: channel });
      } catch (error) {
        throw toInstallError(error);
      }
    },
    async launch() {
      try {
        await invoke("installer_launch");
      } catch (error) {
        throw toInstallError(error);
      }
    },
    show: () => getCurrentWindow().show(),
    minimize: () => getCurrentWindow().minimize(),
    close: () => getCurrentWindow().close(),
  };
}
