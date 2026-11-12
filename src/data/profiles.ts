import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSyncExternalStore } from "react";
import { command } from "./backend";
import { settingsStore } from "./settingsStore";

/**
 * Profile pictures and banners (experimental, Settings → Misc). Rust looks the accounts up and
 * keeps the images (src-tauri/src/db/profiles.rs); this mirrors what it found, per account, and
 * tells it whether the feature is on (on every start and whenever the setting changes: off stops
 * the lookups and hides the images, but keeps them). Images are read from Rust's own `profile` scheme, never from the internet.
 */

export interface Profile {
  readonly accountId: number;
  /** found, missing (not public or no such player), invalid (a name that can't be looked up). */
  readonly state: "found" | "missing" | "invalid";
  readonly avatar: string | null;
  readonly banner: string | null;
}

export interface ProfileStatus {
  readonly running: boolean;
  /** Stopped until tomorrow (too many requests, an outage or no connection). */
  readonly paused: boolean;
  /** Stopped by hand (Settings → Stop) until the next start or Refresh now. */
  readonly stopped: boolean;
}

export interface ProfileSummary extends ProfileStatus {
  readonly found: number;
}

let profiles = new Map<number, Profile>();
let status: ProfileStatus = { running: false, paused: false, stopped: false };
let summary: ProfileSummary = { ...status, found: 0 };
let syncedEnabled: boolean | null = null;
let started = false;
const listeners = new Set<() => void>();

function changed() {
  let found = 0;
  profiles.forEach((profile) => {
    if (profile.state === "found") found += 1;
  });
  summary = { ...status, found };
  listeners.forEach((listener) => listener());
}

function replace(list: readonly Profile[]) {
  profiles = new Map(list.map((profile) => [profile.accountId, profile]));
  changed();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Sends the setting to Rust when it differs from what Rust last heard. */
async function sync() {
  const enabled = settingsStore.get().profileImages;
  if (enabled === syncedEnabled) return;
  syncedEnabled = enabled;
  try {
    replace(await command<Profile[]>("set_profile_images", { enabled }));
  } catch (error) {
    console.error("Profile pictures", error);
  }
}

/** Call once after the first render. */
export function startProfiles() {
  if (started) return;
  started = true;
  void listen<Profile>("profiles-changed", (event) => {
    if (!settingsStore.get().profileImages) return;
    profiles = new Map(profiles).set(event.payload.accountId, event.payload);
    changed();
  });
  void listen<ProfileStatus>("profiles-status", (event) => {
    status = event.payload;
    changed();
  });
  void invoke<ProfileStatus>("profile_status")
    .then((current) => {
      status = current;
      changed();
    })
    .catch(() => {});
  settingsStore.subscribe(() => void sync());
  void sync();
}

/** After an import replaced the accounts (their ids changed). */
export async function reloadProfiles() {
  if (!settingsStore.get().profileImages) return;
  replace(await command<Profile[]>("load_profiles"));
}

/** Settings → Refresh now (also undoes Stop). */
export function refreshProfiles() {
  return command<void>("refresh_profiles");
}

/** Settings → Stop: no lookups until the next start or Refresh now. */
export function stopProfiles() {
  return command<void>("stop_profiles");
}

/** The account menu's Refresh profile: this account next, even while stopped. */
export function refreshProfile(accountId: number) {
  return command<void>("refresh_profile", { accountId });
}

/** A kept image's address (Rust's `profile` scheme). */
export function profileImageUrl(file: string) {
  return convertFileSrc(file, "profile");
}

export function useProfile(accountId: number): Profile | undefined {
  return useSyncExternalStore(subscribe, () => profiles.get(accountId));
}

export function useProfileSummary(): ProfileSummary {
  return useSyncExternalStore(subscribe, () => summary);
}
