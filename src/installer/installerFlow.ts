import type { InstallFailure, InstallStage, InstallerDetails } from "./installerClient";

export interface InstallOptions {
  readonly location: string;
  readonly startMenuShortcut: boolean;
  readonly desktopShortcut: boolean;
}

export type InstallerScreen =
  | { readonly name: "loading" }
  | { readonly name: "welcome" }
  | { readonly name: "update" }
  | { readonly name: "newer" }
  | { readonly name: "options" }
  | { readonly name: "appRunning" }
  | { readonly name: "installing"; readonly stage: InstallStage | null }
  | { readonly name: "finished" }
  | { readonly name: "failed"; readonly failure: InstallFailure };

export interface InstallerState {
  readonly screen: InstallerScreen;
  readonly details: InstallerDetails | null;
  readonly options: InstallOptions;
}

export type InstallerAction =
  | { readonly type: "loaded"; readonly details: InstallerDetails }
  | { readonly type: "showOptions" }
  | { readonly type: "back" }
  | { readonly type: "setLocation"; readonly location: string }
  | { readonly type: "setShortcut"; readonly shortcut: "startMenu" | "desktop"; readonly on: boolean }
  | { readonly type: "waitForApp" }
  | { readonly type: "start" }
  | { readonly type: "stage"; readonly stage: InstallStage }
  | { readonly type: "succeeded" }
  | { readonly type: "failed"; readonly failure: InstallFailure };

export const initialInstallerState: InstallerState = {
  screen: { name: "loading" },
  details: null,
  options: { location: "", startMenuShortcut: true, desktopShortcut: true },
};

/** Compares dotted numeric versions ("0.3.10" > "0.3.9"); missing parts count as 0. */
export function compareVersions(left: string, right: string): number {
  const parts = (version: string) => version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const a = parts(left);
  const b = parts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export type InstallKind = "install" | "update" | "reinstall";

export function installKind(details: InstallerDetails | null): InstallKind {
  if (!details?.existing) return "install";
  return compareVersions(details.version, details.existing.version) > 0 ? "update" : "reinstall";
}

/** RankDB before 1.0 is the old app: its accounts are migrated when the new one first starts. */
export const migratesOldApp = (details: InstallerDetails) =>
  !!details.existing && compareVersions(details.existing.version, "1.0.0") < 0;

/** The stages the progress list shows; the Rust side reports the same ones. */
export function installStages(kind: InstallKind, options: InstallOptions): InstallStage[] {
  const shortcuts = kind !== "install" || options.startMenuShortcut || options.desktopShortcut;
  return shortcuts ? ["preparing", "installing", "shortcuts", "finishing"] : ["preparing", "installing", "finishing"];
}

const homeScreen = (details: InstallerDetails | null): InstallerScreen =>
  details?.newerInstalled ? { name: "newer" } : details?.existing ? { name: "update" } : { name: "welcome" };

export function installerReducer(state: InstallerState, action: InstallerAction): InstallerState {
  switch (action.type) {
    case "loaded":
      return {
        ...state,
        details: action.details,
        // Updating keeps the existing installation's folder.
        options: { ...state.options, location: action.details.existing?.location ?? action.details.defaultLocation },
        screen: homeScreen(action.details),
      };
    case "showOptions":
      return { ...state, screen: { name: "options" } };
    case "back":
      return { ...state, screen: homeScreen(state.details) };
    case "setLocation":
      return { ...state, options: { ...state.options, location: action.location } };
    case "setShortcut":
      return {
        ...state,
        options: {
          ...state.options,
          [action.shortcut === "startMenu" ? "startMenuShortcut" : "desktopShortcut"]: action.on,
        },
      };
    case "waitForApp":
      return { ...state, screen: { name: "appRunning" } };
    case "start":
      return { ...state, screen: { name: "installing", stage: null } };
    case "stage":
      return state.screen.name === "installing" ? { ...state, screen: { name: "installing", stage: action.stage } } : state;
    case "succeeded":
      return { ...state, screen: { name: "finished" } };
    case "failed":
      return { ...state, screen: { name: "failed", failure: action.failure } };
  }
}
