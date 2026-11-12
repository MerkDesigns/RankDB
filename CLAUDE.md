# RankDB rewrite

Ground-up rewrite of RankDB (Overwatch multi-account rank tracker; the old app lives in `../RankDB`).
Only the core idea carries over. Current phase: **polish and release** (phase 7 in `docs/PLAN.md`).

This is the project contract: rules first, details elsewhere.
- `docs/ARCHITECTURE.md`: how each area works and the user's decisions behind it. **Read the
  section for an area before changing it**, and update it with the change.
- `docs/PLAN.md`: phases, what's still open, and what we don't copy from the old app (check it
  before porting a feature). Also `docs/CREDENTIAL-ENCRYPTION.md`, `docs/EDITING-TEXT.md`.

Stack: React 19 + TypeScript 7 (native `tsc`) + Vite 8, Tauri 2 shell (WebView2 on Windows).
Dependencies are pinned exactly; when upgrading, pick the newest version that is at least two weeks old.

**Tauri only.** RankDB only ever runs as the installed Tauri app, so there is no browser support:
no `isTauri()` checks, localStorage or feature-detection fallbacks, nothing that only makes sense
in a web page. Don't add any of these back. `src-tauri/src/webview_browser_features.rs` switches
WebView2's own browser features off (print, find, reload, zoom, DevTools keys, page context menu, …).

## Commands

| Command | What it does |
|---|---|
| `npm run app:dev` | Tauri app (WebView2) |
| `npm run app:dev:mcp` | Tauri app + MCP bridge on 127.0.0.1:9223 for the `tauri` MCP server |
| `npm run app:profile` | Same as above + WebView2 DevTools protocol on 127.0.0.1:9333 (for `npm run bench`) |
| `npm run bench` | Benchmark matrix in the running `app:profile` window |
| `npm run installer:build` | RankDB Setup for the published app: `release/RankDB_<version>_installer.exe` (version from `package.json`; unsigned without `TAURI_SIGNING_PRIVATE_KEY`, which only GitHub has). Never run it outside Windows Sandbox: it installs over RankDB |
| `npm run store:build` | The Microsoft Store package: `release/store/RankDB_<version>.0_x64.msix` (`docs/MICROSOFT_STORE.md`; a separate build with the `store` feature and its own identifier. Never install it outside Windows Sandbox either, and never submit it: Merk uploads by hand) |
| `npm run check` | Strings, typecheck, production build, `cargo check` |
| `npm test` | Every test suite: `test:strings`, `test:toasts`, `test:credentials`, `test:scroll`, `test:rust` |
| `npm run lint:rust` | Clippy, warnings as errors |

`.github/workflows/check.yml` runs `check`, a release `cargo check`, `lint:rust` and `npm test` on
every push. Keep all of them passing.

Releases: push a tag `v<version>` and `.github/workflows/release.yml` builds, signs (repo secrets)
and drafts a GitHub release with the setup, NSIS installer, `.sig` and `latest.json`; publishing
the draft is what offers the update to installed apps. **Before any release or version change,
read `RELEASE-CHECKLIST.md`** (repo root, git-ignored, local to Merk's PC) and go through it with
Merk; keep it current when the release process changes. `RELEASE-STEPS.md` (also local) is the short
version to follow once Merk gives the final go: GitHub release plus the Store `.msix` for him to upload.

`npm run dev` is only the Vite server Tauri starts for itself; it is not something to open in a
browser. Always launch through the npm scripts (`scripts/dev-app.mjs` stops this checkout's stale
Vite/`rankdb.exe` first), never `tauri dev` directly.

The user's installed RankDB 0.3.0 (`%LOCALAPPDATA%\RankDB`, id `com.rankdb.desktop`) is real:
never run a release installer outside Windows Sandbox, it installs over it.

## Interface text

All authored interface copy lives in **`src/text/strings.json`**, grouped by feature (including the
lab and Rust errors); see `docs/EDITING-TEXT.md`. The exception is What's New, plain text in
`src/text/whats-new.txt` (by request). Use `uiText("feature.control.description",
{ namedPlaceholder: value })` (`src/text/index.ts`) and Rust `crate::text::text` / `format`; keep
keys static and placeholder objects explicit. Display tiers with `rankName(tier)`, keeping stored
IDs. `check:strings` rejects unknown, unused and uncatalogued text.
- IDs describe stable roles (`settings.credentialButtons.label`), never truncated sentences or
  numbered duplicates; keep IDs when wording changes. Preserve the user's wording edits.
- Sentence case; proper names keep their casing; button labels (busy states too) have no trailing
  ellipsis. Avoid unnecessary explanatory text in the UI.

## The user's data and settings

- **The dev app holds the user's real data.** `app:dev:mcp`/`app:profile` use the identifier
  `com.merkdesigns.rankdb.next.dev` (47 real accounts). Test read-only: never press Save, cancel
  picker edits, never open the credentials dialog, never import the user's real 0.3 data.
- **Lab settings belong to the user** (`%APPDATA%\<identifier>\lab-settings.json`, dev builds only).
  Automation that changes them must snapshot `__lab.state()` first and `await __lab.set(snapshot)`
  afterwards (`npm run bench` does). **App settings** (accent, columns, privacy, UI scale) are in
  the database's `settings` table; restore any a test changes.
- Separate identifiers have separate data folders: base `com.merkdesigns.rankdb.next` (release),
  `…next.dev` (MCP config), `com.merkdesigns.rankdb.store` (the Microsoft Store build, which
  copies the release one's database on its first start and never writes to it).

## Testing the UI

- **Via MCP**: run `npm run app:dev:mcp` in the background, then `mcp__tauri__driver_session`
  `start` (port 9223), then `webview_screenshot`, `webview_execute_js` and `read_logs`. The first
  Rust build takes a few minutes.
- **`window.__lab`** (`src/lab/automation.ts`, dev builds only): `state()`, `await set({ … })`
  (resolves after render and bake), `census()`, `await benchmark(ms)`, `await sweep(ms)`,
  `markdown()`, `previewToasts(kind)`, `clearToastPreviews()`. Drive the lab through it, not the panel.
- **Benchmarks** need a visible, uncovered window and an idle mouse (`requestAnimationFrame` stops
  when hidden; `__lab.set` and `benchmark` then hang). Compare only runs with the same machine,
  window size, DPR and refresh; always include an `off` baseline ("vs Off" is p95 against p95).
  rAF deltas measure pacing, not GPU time; use a trace via `app:profile` for GPU detail.

## Rules (details in `docs/ARCHITECTURE.md`)

**Data**
- Rust owns the data; the frontend mirrors it. Every action is one command that validates, writes
  in a transaction and returns the changed record. Database commands are `async`, and **every one
  from the frontend goes through `command()` (`src/data/backend.ts`)**, the FIFO queue.
- Migrations live in `src-tauri/src/db/migrations.rs`: never edit a shipped one; add one, and a
  fixture to `db/upgrade_tests.rs`. **Never change the identifier `com.merkdesigns.rankdb.next`**:
  the data folder follows it, and an update would open an empty database.
- Secrets never reach the page unasked: rows get `hasEmail`/`hasPassword`, copying goes through
  Rust, only the edit-credentials dialog reads values. The lock is enforced in Rust.
- RankDB 0.3 is migrated once, only into an empty database, never appended (`legacy.rs`).
- Backups (`db/backup.rs`) replace everything; a 0.3 export replaces only accounts and groups,
  never settings or credential protection. Never import into the dev app's real data.
- Discord Rich Presence loads its image from GitHub `main`: keep
  `src/assets/extras/RankDB_Animated_Icon.webp` (1.0.2 on) and `public/app-icon-512.png` (1.0.0–1.0.1)
  at those paths.
- Removed by request, not to be rebuilt without a new one: automatic backups, rank-change
  logging, themes, owapi rank refresh, maximize, horizontal resizing. (The experimental profile
  pictures and banners use owapi.eu for images only; ranks stay manual.)

**Glass and motion**
- Masks go on filter outputs, never on an ancestor of a filter: a masked, filtered or opacity < 1
  ancestor becomes a backdrop root and the filters inside sample nothing.
- Never fade an element that holds glass with opacity: fade its colours with `var(--presence)` and
  mark glass-free content `[data-presence-content]`.
- Tuning writes CSS variables (`glass/engine.ts`) and never re-renders React; scrolling runs no JS.
  The look must stay the same across strategies. Motion writes to the DOM per frame, never React.
- Use the primitives in `src/ui/primitives/` instead of new controls; use `--accent`, never a
  hard-coded colour.
- Animate only compositor properties (opacity, transform, scale, rotate); no mask or filter on an
  animated element. Keep rows' `overflow-clip-margin` larger than anything reaching past a row.

**Window and layout**
- All window access goes through `src/platform/window.ts`. The width is locked to the layout; only
  the top and bottom edges resize; there is no maximize. Never add layout relying on spare width.
- The UI scale zooms only `.app`; overlays (Settings, picker) render at 100% in viewport pixels.
  Inside `.app`, rim widths are divided by the scale to stay 1.5 px.
- While the window is hidden nothing may wait for `requestAnimationFrame`.

**The lab**
- The Glass Lab is dev-only (`import.meta.env.DEV`; Rust `lab_settings` is `debug_assertions`).
  Release builds use `DEFAULT_STATE`/`DEFAULT_TUNING`/`DEFAULT_PICKER`/`DEFAULT_TOASTS`, so when the
  user settles on new tuning, copy it into those defaults or releases won't have it.
- `LabState` changes need a migration in `normalizeState` (`src/lab/store.ts`).

## Gotchas

- Capability edits rebuild because `src-tauri/build.rs` watches `capabilities`. If a "not allowed"
  error survives one, check `src-tauri/gen/schemas/capabilities.json` contains the permission.
- Vite's watcher on Windows can miss two edits to one file within milliseconds: `touch` it and reload.
- After a new npm dependency, the first dev launch shows a blank window for a few seconds while Vite
  pre-bundles it. Wait rather than treating it as a crash.
