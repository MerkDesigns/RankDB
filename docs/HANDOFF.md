# Shared handoff: Codex / Claude

Last updated: 2026-10-31 (Europe/Berlin). Read `../CLAUDE.md` first; it is the project contract
(`../AGENTS.md` points Codex at it). This file holds only the current state, what was verified,
and what is open. Older session logs were removed on 2026-10-31; they are in git history.

## Project stage

A functional desktop rewrite. Plan phases 1-6 are done; phase 7 (polish and release) remains.
Design: Shell rows with native glass overlays and TaskMap motion/primitives.

Implemented: SQLite accounts and app settings; rank editing and placements; credentials with
optional master password; protected clipboard copies; groups, ordering and statuses; season resets,
past ranks and undo; games dodged; one-way RankDB 0.3 migration; updater gating, What's New and
Discord presence; single instance; startup problem screen. Export/import and backups are removed
by request.

## Architecture map

| Area | Entry points and responsibilities |
|---|---|
| Startup | `src/main.tsx`: database problem check, load lab/settings/roster, start glass engine, synchronous first render, fit/show window, start services |
| Frontend data | `src/data/backend.ts` (FIFO command queue), `rosterStore.ts`, `settingsStore.ts`, `accounts.ts`: typed records, optimistic edits, reload when idle after a failure |
| Backend | `src-tauri/src/main.rs`: plugins, command registration, exit handling; `db/`: `mod.rs` (open, migrate, upgrade copies), `migrations.rs`, `records.rs`, `accounts.rs`, `groups.rs`, `history.rs`, `settings.rs`, `credentials.rs`, `upgrade_tests.rs` |
| Old app | `legacy.rs`: read-only RankDB 0.3 reader and migration into an empty database |
| Data protection | `credential_security.rs`: optional master-password vault (also converts upgrade copies); `secrets.rs`: AES-GCM primitive; `clipboard.rs`: protected Win32 clipboard, conditional clearing |
| Materials | `src/glass/`: material resolution, CSS-variable engine, cached/live rims, baking, scroll-edge morphs |
| UI/motion | `src/ui/`, `src/ui/primitives/`: app actions/dialogs, reusable controls, direct DOM motion |
| Window | `src/platform/window.ts`, `resize_edges.rs`, `webview_browser_features.rs`: fitted width, vertical resizing, browser features disabled, save on close |
| Lab/profiling | `src/lab/`, `scripts/bench.mjs`: `window.__lab`, frame-pacing benchmarks, CDP. Dev builds only |
| Checks | `npm run check`, `npm test`, `npm run lint:rust`; `.github/workflows/check.yml` runs them on every push |

## Verified (2026-10-31)

- Lab removed from release: production bundle has no `__lab`, lab panel, CSS or lab-settings
  commands; `cargo check --release` passes without `lab_settings`. The user's saved toast tuning
  (the only difference from the defaults) is now `DEFAULT_TOASTS`. `db.rs` split into `db/`
  without behaviour changes (same 22 tests). `npm test` and `lint:rust` (0 warnings) pass. CI not yet run on GitHub.
- Fixed: closing the window failed ("window.destroy not allowed"): the save-on-close handler makes
  Tauri close via `destroy()`, which needed `core:window:allow-destroy`. Live: the dev app (lab
  present, roster loaded) now closes and exits.

- `cargo test`: 22 pass. Covers upgrades (v4 → v5 keeps every record and copies first, fresh =
  upgraded schema, newer version and `legacy` mode refused untouched, failed migration stays at its
  version), credential protection (including upgrade copies following every change) and the 0.3
  migration (conversion, decryption of the old format, refusing a non-empty or password-protected
  database).
- `npm run check`, `test:strings`, `test:credentials`, `test:toasts`, `test:scroll`: pass.
- Live, on the user's dev database (`com.merkdesigns.rankdb.next.dev`, 47 accounts): upgrade 4 → 5
  left every table hash-identical to the pre-upgrade copy; six rapid group toggles ended in the
  original state on screen and in the database; a second `rankdb.exe` exited at once.

**Not live-tested:** the 0.3 migration on real data (deliberately: it's release-only, and the
user's 0.3 data must not be imported in tests), the Undo and Migrate rows in the running app, the
startup problem screen (Rust tests only), the NSIS installer replacing 0.3, a real updater install.

## Open findings

1. **Modal keyboard accessibility is incomplete.** `primitives/Dialog.tsx` focuses on open and
   handles Escape, but has no Tab trap, background inertness or focus restoration.
2. **Release setup is unfinished.** Version is 0.0.0, base bundling is off, the dev installer
   disables updater artifacts. Needed: final version, installer, signed updater artifacts, channel
   check, and a test that the installer replaces 0.3 in place.
3. **No license file.** The repository is public without one.

## Running app and MCP

Launch only via `npm run app:dev:mcp` (or `app:profile` for CDP on 9333), then the Tauri MCP
`driver_session` `start` on `127.0.0.1:9223`. The MCP config uses the identifier
`com.merkdesigns.rankdb.next.dev`, which holds the user's real data: test read-only, never
press Save, cancel picker edits, never open the credentials dialog. Snapshot `__lab.state()` and
restore it after any lab change. The installed RankDB Dev has no bridge.

## Repository

Branch `rewrite`, pushed to `origin` = https://github.com/MerkDesigns/RankDB (public; `main` is
the old app, with unrelated history). Commit and push on `rewrite`; when the rewrite replaces the
old app, swap or merge the default branch.
