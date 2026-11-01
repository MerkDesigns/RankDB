# RankDB rewrite: plan

The Glass Lab phase is done: the UI look is decided (Shell strategy rows, TaskMap overlays, the
rank picker, Settings). This plan covers everything after it: the real data layer, porting the old
app's features, and shipping.

Each phase ends with something usable in the dev app. Features are rebuilt from what they do, not
copied from the old code (`../RankDB/app/components/rankdb/RankDbApp.vue`, one 7.8k-line component).
Check [Not carried over](#not-carried-over-from-the-old-app) before porting anything.

## Feature inventory (old app → rewrite)

| Feature (old app) | Status | Phase |
|---|---|---|
| Account rows: name, 3 role ranks, 6v6, currencies | UI done, loaded from SQLite | 1 |
| Rank picker (tier, division, predicted) | Done, plus placements; saved (phase 1) | 1 |
| Privacy mode, UI scale, column toggles | Done (app settings) | 1 |
| Add account | Done | 2 |
| Inline edit of name / Battletag | Done | 2 |
| Copy Battletag, email, password | Done | 2 |
| Clipboard auto-clear timer (5–30 s or never) | Done | 2 |
| Edit credentials modal (email, password) | Done | 2 |
| Optional master-password encryption for email/password; unencrypted fresh-install default | Done; old Windows-key storage dropped (2026-10-31) | 5 |
| Delete account (confirm) | Done | 2 |
| Account context menu | Done | 2 |
| Account info modal: country (flag, dial codes), Battle.net link, notes, status, past ranks | Done | 2 |
| Inline edit of currencies (prisms, coins, credits, comp points, legacy points) | Done | 2 |
| Groups: add, rename, delete, collapse, move account to group | Done | 3 |
| Drag to reorder accounts and groups | Done | 3 |
| Banned section (mark/unmark banned) | Done | 3 |
| Sort by role rank (click role icon, desc/asc, ignores groups), now 6v6 too; temporary, not saved | Done | 3 |
| Rank history: past season resets in account info; past ranks in the list (toolbar) | Done | 4 |
| Season rank reset (archive all ranks, reset to unranked) | Done; undo from Past ranks | 4 |
| Games-dodged counter (record, reset, penalty info) | Done | 4 |
| Encrypted backup export / import (password, PBKDF2 + AES-GCM; import replaces everything) | Done, by request (2026-11-01) | 7 |
| Legacy import: old `.rankdb-export` files (replaces accounts and groups, keeps settings) | Done, by request (2026-11-01) | 7 |
| Migration from the installed old RankDB 0.3 | Done: one way, into an empty database only (2026-10-31) | 7 |
| Automatic local backups (old: before updates) | Removed/deferred by request (2026-10-30) | — |
| Toast notifications | Done | 2 |
| Check for updates + What's New | Done | 6 |
| Discord Rich Presence | Done | 6 |
| Rank badge effects (glow, shine, sparkles by tier) | Done | 7 |
| Themes editor | Dropped (accent colour only) | — |
| Rank refresh via owapi.eu | Dropped | — |

## Data architecture

**Rust owns the data; the frontend mirrors it.** The old app kept everything in Vue state and
saved one encrypted JSON blob. The rewrite stores real records and sends small commands.

- **Storage: SQLite** (`rusqlite`, bundled) in `%APPDATA%\<identifier>\rankdb.sqlite3`, WAL mode.
  Tables:
  - `accounts` (id, name, sort key, group id, status, country, notes, games dodged, last rank change)
  - `ranks` (account id, slot: tank/damage/support/6v6, tier, division, predicted, placements)
  - `currencies` (account id, kind, value)
  - `groups` (id, name, sort key, collapsed)
  - `rank_history` (account id, slot, rank, changed at, reason: season reset)
  - `credentials` (account id, email, password), plain by default; optionally encrypted per field
  - credential protection metadata (plain / password, password-wrapped data key; `legacy` is refused)
  - `settings` (key, JSON value), the app's real settings (UI scale, columns, privacy, accent,
    clipboard timer, …)
  - SQLite `user_version`, with numbered migrations in Rust (currently schema 5)
- **Optional secrets at rest protection.** Fresh databases are unencrypted, with no keyring or
  DPAPI dependency. Settings → Data can protect only email/password fields using a master password;
  a random AES-256-GCM field key is wrapped using PBKDF2-SHA256 (600k) + AES-GCM and stored in the
  database. Restarts lock credentials, while names, ranks, notes and settings remain usable.
  The old DPAPI storage of early dev builds is no longer supported. See `CREDENTIAL-ENCRYPTION.md`.
- **Commands, not blobs.** Each user action is one typed Tauri command (`set_rank`,
  `rename_account`, `move_account`, …). Commands validate input, write in a transaction, and return
  the changed records. The frontend store applies them optimistically, sends them in order through
  one queue, and reloads from Rust after a failure.
- **Frontend store** (`src/data/`):
  - it loads one snapshot at startup, before the window is shown (same rule as today: nothing may
    wait on `requestAnimationFrame` while hidden);
  - it keeps per-account immutability, so editing an account re-renders only its row;
  - selectors produce the visible list (sections, groups, sort).
- **Credentials never sit in the frontend.** The UI asks Rust to copy a secret to the clipboard
  (`copy_secret(account, field)`), and Rust starts the auto-clear timer. Only the edit dialog reads a
  secret, on demand.
- **Dummy data stays for development.** The lab's "Dummy (unsaved)" source shows generated
  accounts without saving them, and a fresh dev database is seeded; release builds never seed.

## Settings and the Glass Lab

- App settings (UI scale, columns, privacy, accent) live in the `settings` table
  (`src/data/settingsStore.ts`). `LabState` keeps only glass tuning and dev tools.
- **The Glass Lab becomes dev-only.** The release build ships the chosen glass values as constants
  (`recipes.ts`), with no lab panel and no lab settings file. Export the final lab state into the
  recipes before the first release.

## Phases

### Phase 1: Data foundation
- [x] Rust: SQLite store, migrations, schema v1, `load_roster`, `set_rank` (+ rank history).
- [x] Frontend: real store; rows and the rank picker run on it (optimistic, rollback on error).
- [x] Dev-only dummy seeding; lab data source (saved / dummy) for benchmarks.
- [x] Settings commands; app settings (UI scale, columns, privacy, accent) moved out of `LabState`
  into the `settings` table, with a one-time hand-over of values from the lab settings file.

Phase 1 is done. The DPAPI-protected data key moved to phase 2, where the credentials that need it
land (no unused crypto code before then).
- Done when: rank edits and settings survive a restart, and the dummy list still works in dev.

### Phase 2: Accounts
- [x] DPAPI-protected data key and AES-GCM field encryption for email and password.
- [x] Add account (placeholder Battletag, "New" pill, opens straight into name editing).
- [x] Inline name (double-click or menu) and currency editing (click; "1.2k" understood).
- [x] Copy buttons with toasts and clipboard auto-clear (kept out of clipboard history).
- [x] Edit credentials dialog and delete confirmation.
- [x] Account context menu and account info dialog (country, notes, status, added, last change).
- [x] New primitives: context menu, text field, dialog shell, toast, button, inline edit.
- [x] Clipboard timer setting (Settings → Misc → Clipboard).

Phase 2 is done. Open: the country picker is a native `<select>` (its dropdown is the system
one); replace it with a TaskMap-style listbox if it bothers.

### Phase 3: Organization
- [x] Groups: add (opens into its name), rename (double-click or menu), delete (accounts stay where
  the group was), collapse saved.
- [x] Move to group from the context menu; drag and drop for accounts and groups.
- [x] Status: clean, SMS or banned (Account info, account menu); SMS and banned sections, reorder
  by dragging.
- [x] Role sorting for all four rank columns, temporary.

Phase 3 is done.

### Phase 4: Rank tracking
- [x] Rank history: past season resets, shown in Account info (tabs: Details / Rank history) and,
  from the toolbar, in the list.
- [x] Season reset (Settings → Data → Rank reset), with a plain completion notification and saved Past ranks.
- [x] Games-dodged counter in the account menu, with the next penalty and its explanation.

Phase 4 is done.

### Phase 5: Credential protection
- [x] Optional master-password encryption for email/password; fresh installations are plain.
- [x] Unlock/lock/change password/disable in Settings, with transactional conversion and cleanup.
- Export/import and backups were removed by user request on 2026-10-30, then brought back as
  manual backups and 0.3 export imports on 2026-11-01 (automatic backups stay removed).

Phase 5 is done for the current scope.

### Phase 6: App services
- [x] Updater (old app's GitHub channel and key; checks only in the published app ≥ 1.0) with a
  restart after installing, and What's New.
- [x] Discord Rich Presence (Settings → Misc), retrying while Discord isn't running.

Phase 6 is done. For the first release (phase 7): set the app version, build with
`createUpdaterArtifacts` and `TAURI_SIGNING_PRIVATE_KEY`, and publish `latest.json` with it.

### Phase 7: Polish and release
- [x] Rank badge effects.
- [x] Database handover across updates (upgrade copies, startup checks, save on close) and the
  one-way RankDB 0.3 migration.
- [ ] Accessibility pass (dialog focus trap and restoration).
- [x] Lab off in release (chosen values as constants, 2026-10-31).
- [ ] Installer and update channel; verify the installer replaces 0.3 in place.
- [ ] A license file (the repository is public without one).

## Decisions

- **Themes:** dropped. The accent colour is the only colour setting.
- **Rank refresh (owapi.eu):** dropped, with its refresh action.
- **Role sorting:** temporary, never saved; covers 6v6 as well as the three roles.
- **Backups:** manual only (export and import in Settings → Data); importing replaces everything.
- **RankDB 0.3:** migrated once into an empty database; never appended to existing accounts.

## Not carried over from the old app

Things the old RankDB (`../RankDB`) had that the rewrite deliberately leaves out or changes. Add an
entry whenever we decide not to copy something, so it isn't rebuilt by accident.

### Removed

- **Automatic local backups** (daily snapshots, before updates) and the backup history are removed
  by request (2026-10-30). Manual backups came back on 2026-11-01 as one encrypted file of the whole
  database, and 0.3's exports can be imported (accounts and groups only; settings stay). The
  installed 0.3 app's data is still migrated once, into an empty database only.

- **Browser support.** RankDB only runs as the installed Tauri app. All browser fallbacks are gone:
  localStorage settings, scroll-timeline fallbacks, the web-only lab and the Edge benchmark. Don't add
  `isTauri()` checks or browser fallbacks back.
- **WebView2's built-in browser features.** The old app still had them (Ctrl+P printed the "web
  page"). `src-tauri/src/webview_browser_features.rs`, ported from TaskMap, turns these off:
  - print, save-page and find-in-page;
  - reload, back and forward;
  - DevTools keys, zoom keys, pinch zoom and swipe navigation;
  - the link status bar and opening links in new windows;
  - form autofill and password saving;
  - the page right-click menu (text fields keep only cut, copy, paste and select all).
- **Maximize.** The window has a fixed width, so it isn't maximizable, the same as the League client
  or Character Map. The maximize button is gone, and dragging to the top of the screen, Win+↑ and
  double-click do nothing. People change the height by dragging the top or bottom edge.
- **Horizontal window resizing.** The width follows the UI, so only the top and bottom edges resize,
  and the side edges no longer show a resize cursor.
- **Toolbar chevron that expanded and collapsed the credential buttons.** It's now the
  "Credential Buttons" toggle in Settings → Visuals.
- **Themes.** The toolbar's design button and theme editor (custom themes, theme files, premade
  themes) are gone for good. The accent colour in Settings is the only colour setting.
- **Rank refresh via owapi.eu.** The "refresh rank" action and the owapi lookup are gone: the source
  was too limited to rely on. Ranks are entered by hand.
- **Outlines around account rows.** The glass rows have no rim. The rim code is kept for future
  highlights, such as a selected or new account.
- **Red tint on banned rows.** The "Banned Accounts" divider still marks the section.

### Changed

- **UI scale** uses five chips (80/90/100/110/120%) instead of a slider; 100% is the default.
- **Rank badges** are 10% smaller, and the gap between the role ranks and the 6v6 rank is narrower.
- **Rank picker** is a floating glass menu (no dimmed backdrop) with the same controls (tier grid,
  divisions as a liquid tab switcher, predicted, a plain glass Confirm),
  plus placement games 1–10 for predicted ranks (a vertical drag bar), which the old app didn't
  track. Portrait only; a landscape layout was tried and dropped.
- **Copying email/password** no longer goes through the page: Rust copies it, keeps it out of
  Windows clipboard history and cloud sync, and only clears the clipboard if it still holds it.
- **Credential encryption is optional**, off for fresh installations. Users can enable a master
  password in Settings for email/password fields only (AES-GCM, password-wrapped random data key).
  No keyring or Windows account dependency. Accounts migrated from 0.3 arrive unencrypted; a
  master password can be set afterwards. See `CREDENTIAL-ENCRYPTION.md`.
- **New accounts** open straight into name editing (the "New" pill stays until the name is saved).
  Names can also be edited by double-click, not only from the context menu.
- **Toasts** sit in the bottom-right corner.
- **Group outline**: two rounded brackets above and below a group's accounts (corners curving
  toward the rows) instead of a box.
- **Groups** sit anywhere among the loose accounts as before, but are placed by one shared order
  instead of being anchored to an account. Collapsing is saved. New groups open into their name.
- **Move to group** is the account menu's Move To submenu.
- **Updates** use the same GitHub channel and signing key, restart after installation, and check
  silently on start. There is no automatic backup. Development builds never check.
- **Discord presence** reconnects by itself when Discord is started after RankDB.
- **Rank history** is only the season resets, all of them in one Account info tab (role icons over
  badge columns, a row per reset), instead of a dropdown of snapshots. Rank changes aren't logged.
  The toolbar shows past reset ranks; the newest reset can be undone there. Notifications have no
  action buttons or clear-all control.
- **Status** has three states (Clean, SMS, Banned) instead of a banned switch; SMS accounts get
  their own section above the banned one.
- **Role sorting** covers 6v6 too, and is never saved (a restart shows your own order).
- **Scrollbar** is a thin overlay that only shows while the pointer is over the window.

### Current scope

Clipboard auto-clear, rank reset, Discord presence, update checks, manual backups and 0.3 export
imports are implemented.
