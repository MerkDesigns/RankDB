# RankDB rewrite: plan

The Glass Lab phase is done: the UI look is decided (Shell strategy rows, TaskMap overlays, the
rank picker, Settings). This plan covers everything after it: the real data layer, porting the old
app's features, and shipping.

Each phase ends with something usable in the dev app. Features are rebuilt from what they do, not
copied from the old code (`../RankDB/app/components/rankdb/RankDbApp.vue`, one 7.8k-line component).
Check `docs/NOT-CARRIED-OVER.md` before porting anything.

## Feature inventory (old app → rewrite)

| Feature (old app) | Status | Phase |
|---|---|---|
| Account rows: name, 3 role ranks, 6v6, currencies | UI done, loaded from SQLite | 1 |
| Rank picker (tier, division, predicted) | Done, plus placements; saved (phase 1) | 1 |
| Privacy mode, UI scale, column toggles | Done (values in `LabState`) | 1 (move to app settings) |
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
| Season rank reset (archive all ranks, reset to unranked) | Done; saved snapshots | 4 |
| Games-dodged counter (record, reset, penalty info) | Done | 4 |
| Encrypted export / import (password, PBKDF2 + AES-GCM) | Removed/deferred by request (2026-10-30) | — |
| Legacy import: old `.rankdb-export` files | Removed/deferred by request (2026-10-30) | — |
| Import from the installed old RankDB 0.3.0 | Removed/deferred by request (2026-10-30) | — |
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
  - `groups` (id, name, sort key, collapsed, section)
  - `rank_history` (account id, slot, rank, changed at, reason: season reset)
  - `credentials` (account id, email, password), plain by default; optionally encrypted per field
  - `credential_security` (one row: plain / legacy / password, password-wrapped data key)
  - `settings` (key, JSON value), the app's real settings (UI scale, columns, privacy, accent,
    clipboard timer, …)
  - SQLite `user_version`, with numbered migrations in Rust (currently schema 4)
- **Optional secrets at rest protection.** Fresh databases are unencrypted, with no keyring or
  DPAPI dependency. Settings → Data can protect only email/password fields using a master password;
  a random AES-256-GCM field key is wrapped using PBKDF2-SHA256 (600k) + AES-GCM and stored in the
  database. Restarts lock credentials, while names, ranks, notes and settings remain usable.
  Existing DPAPI fields require a one-time legacy → plain conversion before normal app use; a
  master password can only be enabled afterwards. See `CREDENTIAL-ENCRYPTION.md` for the design.
- **Commands, not blobs.** Each user action is one typed Tauri command (`set_rank`,
  `rename_account`, `move_account`, …). Commands validate input, write in a transaction, and return
  the changed records. The frontend store applies them optimistically and rolls back on error.
- **Frontend store** (`src/data/`) replaces the dummy `rosterStore`:
  - it loads one snapshot at startup, before the window is shown (same rule as today: nothing may
    wait on `requestAnimationFrame` while hidden);
  - it keeps per-account immutability, so editing an account re-renders only its row;
  - selectors produce the visible list (sections, groups, sort).
- **Credentials never sit in the frontend.** The UI asks Rust to copy a secret to the clipboard
  (`copy_secret(account, field)`), and Rust starts the auto-clear timer. Only the edit dialog reads a
  secret, on demand.
- **Dummy data stays for development.** The Glass Lab's account count and seed fill an in-memory
  database in dev builds only, so benchmarks keep working without touching real data.

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
- [x] Mandatory one-time legacy Windows decryption before app use; no direct legacy → password path.
- [x] Unlock/lock/change password/disable in Settings, with transactional conversion and cleanup.
- Export/import, installed-old-app import and all backup features were removed/deferred by user
  request on 2026-10-30. They may be designed again later; do not treat them as pending release work.

Phase 5 is done for the current scope.

### Phase 6: App services
- [x] Updater (old app's GitHub channel and key; checks only in the published app ≥ 1.0) with a
  restart after installing, and What's New.
- [x] Discord Rich Presence (Settings → Misc), retrying while Discord isn't running.

Phase 6 is done. For the first release (phase 7): set the app version, build with
`createUpdaterArtifacts` and `TAURI_SIGNING_PRIVATE_KEY`, and publish `latest.json` with it.

### Phase 7: Polish and release
- Rank badge animations, accessibility pass, performance pass at 360 Hz.
- Lab off in release.
- Installer and update channel.

## Decisions

- **Themes:** dropped. The accent colour is the only colour setting.
- **Rank refresh (owapi.eu):** dropped, with its refresh action.
- **Role sorting:** temporary, never saved; covers 6v6 as well as the three roles.
- **Export/import/backups:** removed and deferred by request; only existing-database decryption remains.
