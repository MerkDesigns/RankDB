import { uiText } from "../text/index";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useEffect, useRef, useState } from "react";
import { command } from "../data/backend";
import { settingsStore } from "../data/settingsStore";
import { settleSaves } from "../platform/window";
import { WHATS_NEW } from "../data/whatsNew";
import { dialogs, useOpenDialog } from "./appActions";
import { Button } from "./primitives/Button";
import { Dialog } from "./primitives/Dialog";
import { showError, showToast } from "./toasts";

/**
 * App services after startup: Discord presence, What's New after an update, and update checks
 * (silent on start, or from Settings → Misc → Check for updates). Updates come from the GitHub
 * releases the old app used (signed); they only run in the published app (see `updates_enabled`).
 */

let available: Update | null = null;
let servicesStarted = false;

/** Starts the services; call once after the first render. */
export function startAppServices() {
  if (servicesStarted) return;
  servicesStarted = true;
  syncDiscord();
  settingsStore.subscribe(syncDiscord);
  void startupPopups();
}

/** One after another: What's New (after an update or 0.3's migration), then an available update. */
async function startupPopups() {
  const migrated = await reportOldAppImport();
  await showWhatsNewAfterUpdate(migrated);
  await checkForUpdates(true);
}

/* ---------- RankDB 0.3 ---------- */

/** The first start brought over RankDB 0.3's accounts (Rust, before the list loaded): say so. */
async function reportOldAppImport(): Promise<boolean> {
  try {
    const summary = await command<{ accounts: number } | null>("take_old_app_import");
    if (summary) {
      showToast({ tone: "success", title: uiText("oldApp.imported.title"), message: uiText("oldApp.imported.description", { count: summary.accounts }) });
    }
    return summary !== null;
  } catch (error) {
    showError(uiText("oldApp.failed"), error);
    return false;
  }
}

/* ---------- Discord ---------- */

let discordWanted: boolean | null = null;

function syncDiscord() {
  const enabled = settingsStore.get().discordPresence;
  if (enabled === discordWanted) return;
  discordWanted = enabled;
  void command<string>("installed_on")
    .catch(() => "")
    .then((day) => {
      const date = day ? new Date(`${day}T00:00:00`) : null;
      const since =
        date && !Number.isNaN(date.getTime())
          ? uiText("updates.userSinceLabel", { date: date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) })
          : uiText("common.rankdb");
      return invoke("set_discord_presence", { enabled, userSince: since });
    })
    .catch((error: unknown) => console.error(uiText("updates.discordPresence"), error));
}

/* ---------- What's New ---------- */

/**
 * Old app's rule: never on a first start; once after the version changes, if it has notes. Coming
 * from 0.3 counts as an update (its version isn't in the new database).
 */
async function showWhatsNewAfterUpdate(migrated: boolean) {
  const version = await getVersion();
  const { lastSeenVersion } = settingsStore.get();
  settingsStore.set({ lastSeenVersion: version });
  const updated = migrated || (lastSeenVersion && lastSeenVersion !== version);
  if (updated && WHATS_NEW.some((entry) => entry.version === version)) {
    dialogs.open({ kind: "whats-new" });
  }
}

export function WhatsNewDialog() {
  const open = useOpenDialog()?.kind === "whats-new";
  return (
    <Dialog open={open} onClose={dialogs.close} title={uiText("updates.whatsNewTitle")} className="account-dialog whats-new">
      <div className="whats-new-list">
        {WHATS_NEW.map((entry) => (
          <section key={entry.version}>
            <h3 className="history-heading">{uiText("updates.versionPrefix")}{entry.version}</h3>
            <ul>
              {entry.items.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="dialog-actions">
        <Button variant="primary" data-autofocus="" onClick={dialogs.close}>{uiText("updates.dismiss")}</Button>
      </div>
    </Dialog>
  );
}

/* ---------- Updates ---------- */

/** Silent: only an available update is announced (startup). Otherwise every outcome is. */
export async function checkForUpdates(silent: boolean) {
  if (!(await invoke<boolean>("updates_enabled"))) {
    if (!silent) {
      showToast({
        title: uiText("updates.unavailable.title"),
        message: uiText("updates.unavailable.description"),
      });
    }
    return;
  }
  try {
    available = await check();
  } catch (error) {
    if (!silent) showError(uiText("updates.checkFailed"), error);
    return;
  }
  if (available) {
    // On start it waits for What's New (or anything else open) to close instead of replacing it.
    if (silent) await dialogs.whenClosed();
    dialogs.open({ kind: "update" });
  }
  else if (!silent) showToast({ tone: "success", title: uiText("updates.upToDate") });
}

export function UpdateDialog() {
  const open = useOpenDialog()?.kind === "update";
  const update = useRef<Update | null>(null);
  if (open) update.current = available;
  const [progress, setProgress] = useState<number | null>(null);
  const [installing, setInstalling] = useState(false);
  useEffect(() => {
    if (open) setProgress(null);
  }, [open]);

  const install = async () => {
    const pending = update.current;
    if (!pending || progress !== null) return;
    setProgress(0);
    try {
      let total = 0;
      let done = 0;
      await pending.download((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          done += event.data.chunkLength;
          setProgress(total ? done / total : 0);
        }
      });
      // The installer replaces the app at once: every pending save first, and the database file
      // complete on its own, so the new version opens exactly what this one saved.
      setInstalling(true);
      await settleSaves();
      await command("prepare_for_update");
      // Quiet NSIS (tauri.conf.json): no installer window. On Windows this call ends the app and
      // the installer starts the new version when it's done, so nothing after it runs.
      await pending.install();
    } catch (error) {
      showError(uiText("updates.installFailed"), error);
      setProgress(null);
      setInstalling(false);
    }
  };

  const pending = update.current;
  return (
    <Dialog open={open} onClose={dialogs.close} title={uiText("updates.available.title")} className="account-dialog">
      <p className="dialog-text">{uiText("updates.available.promptPrefix")}<strong>{pending?.version}</strong>{uiText("updates.available.versionSeparator")}{pending?.currentVersion}{uiText("updates.available.promptSuffix")}</p>
      {pending?.body && <p className="dialog-note update-notes">{pending.body}</p>}
      {progress !== null && (
        <div className="update-progress" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
          <span style={{ width: `${installing ? 100 : Math.round(progress * 100)}%` }} />
        </div>
      )}
      <div className="dialog-actions">
        <Button onClick={dialogs.close} disabled={progress !== null}>{uiText("updates.actions.later")}</Button>
        <Button variant="primary" data-autofocus="" onClick={() => void install()} disabled={progress !== null}>
          {progress === null
            ? uiText("updates.actions.install")
            : installing
              ? uiText("updates.actions.restarting")
              : uiText("updates.actions.downloading", { percent: Math.round(progress * 100) })}
        </Button>
      </div>
    </Dialog>
  );
}
