# RankDB rewrite

Ground-up rewrite of RankDB (Overwatch multi-account rank tracker; the old app lives in `../RankDB`).
Only the core idea carries over. Current phase: **polish and release** (phase 7 in `docs/PLAN.md`).
The real data layer and app features are implemented; the Glass Lab remains for visual tuning and
performance work, and still needs to be removed from release builds.

This is the shared project contract for Claude and Codex (`AGENTS.md` points here). Read and update
`docs/HANDOFF.md` for the latest verified state, checks and unresolved findings when switching assistants.

Stack: React 19 + TypeScript 7 (native `tsc`) + Vite 8, Tauri 2 shell (WebView2 on Windows).
Dependencies are pinned exactly; when upgrading, pick the newest version that is at least two weeks old.

**Tauri only.** RankDB only ever runs as the installed Tauri app, so there is no browser support:
- no `isTauri()` checks, localStorage fallbacks or feature-detection fallbacks;
- nothing that only makes sense in a web page;
- don't add any of these back.

`src-tauri/src/webview_browser_features.rs` switches WebView2's own browser features off: print,
find, reload, zoom, DevTools keys, swipe/pinch, status bar, new windows, autofill/password saving,
and the page context menu (text fields keep cut/copy/paste/select-all).

## Commands

| Command | What it does |
|---|---|
| `npm run app:dev` | Tauri app (WebView2) |
| `npm run app:dev:mcp` | Tauri app + MCP bridge on 127.0.0.1:9223 for the `tauri` MCP server |
| `npm run app:profile` | Same as above + WebView2 DevTools protocol on 127.0.0.1:9333 (for `npm run bench`) |
| `npm run bench` | Benchmark matrix in the running `app:profile` window |
| `npm run bundle:dev` | Release installer for **RankDB Dev** (per-user NSIS, `src-tauri/tauri.devapp.conf.json`) |
| `npm run check` | Typecheck, production build, `cargo check` |
| `npm run check:strings` | Validate the editable text catalog, references and placeholders |
| `npm run test:scroll` | TaskMap scroll geometry/projection and shared-mask regression tests |
| `npm run test:strings` | Text edits, literal interpolation and rank ID regression tests |
| `npm run test:toasts` | Sonner adapter tests with a fake clock (Node 24) |
| `npm run test:credentials` | Credential prompt/cancel/resume and stale-status tests (isolated Node 24 VM) |

`npm run dev` is only the Vite dev server that Tauri starts for itself (`beforeDevCommand`); it is
not something to open in a browser.

**RankDB Dev** installs next to the user's old installed RankDB 0.3.0 (`%LOCALAPPDATA%\RankDB`, id
`com.rankdb.desktop`) without sharing anything: own name, install folder, `rankdb-dev.exe` and id
`com.merkdesigns.rankdb.devapp`. It is a release build, so it has no MCP bridge and no DevTools.

`scripts/dev-app.mjs` kills this checkout's stale Vite/`rankdb.exe` before launching; always launch the
app through the npm scripts, never `tauri dev` directly.

## Interface text

All authored interface copy lives in **`src/text/strings.json`**, grouped by feature, including
Settings labels/descriptions, menus/dialogs, toasts, the Lab and Rust errors. See
`docs/EDITING-TEXT.md`. Use `uiText("feature.control.description", { namedPlaceholder: value })` from `src/text/index.ts`
and Rust `crate::text::text` / `crate::text::format`; keep keys static and placeholder objects explicit.
Display rank tiers with `rankName(tier)` while preserving their stored IDs and asset keys. User data,
external system diagnostics and native product/installer metadata stay separate. The catalog is bundled;
source edits refresh/restart the dev app, and installed builds need rebuilding. No language selector yet.
`npm run check:strings` checks references/placeholder sets and uncatalogued JSX text; `npm run check`
includes it. Preserve the user’s wording edits just like their lab tuning.
Text IDs describe stable feature/message roles (e.g. `settings.credentialButtons.label` and
`.description`), never truncated English sentences or numbered duplicates. Keep IDs when wording
changes. Copy uses sentence case, proper names/acronyms retain their casing, and button labels
(including busy states) have no trailing ellipsis. Settings omits the UI-scale description and the
Appearance, Accounts (rank reset), Clipboard and Integrations island headings by user request.

## Testing the UI

- **The app, via MCP**: run `npm run app:dev:mcp` in the background, then
  `mcp__tauri__driver_session` `start` (port 9223), then `webview_screenshot`, `webview_execute_js`
  and `read_logs`. The first Rust build takes a few minutes.
- **Automation API** (`src/lab/automation.ts`), available as `window.__lab`:
  - `__lab.state()`
  - `await __lab.set({ strategy, backdrop, tuning, … })`: resolves after render and bake.
  - `__lab.census()`: filter layers and blurred megapixels.
  - `await __lab.benchmark(ms)`
  - `await __lab.sweep(ms)`
  - `__lab.markdown()`
  - `__lab.previewToasts("success" | "error" | "countdown" | "stack" | "burst")`
  - `__lab.clearToastPreviews()` (only lab examples; no clipboard/account operations)

  Drive the lab through this API rather than clicking the panel.

- **Lab settings belong to the user** and persist across restarts. They live in
  `%APPDATA%\<identifier>\lab-settings.json`, written by `src-tauri/src/lab_settings.rs` about 0.1 s
  after each change. Any automation that changes them must snapshot `__lab.state()` first and
  `await __lab.set(snapshot)` when done. `npm run bench` already does this.
- **App settings belong to the user too** (accent, columns, privacy, UI scale): they live in the
  database's `settings` table. `__lab.state()`/`__lab.set()` include `zoom` (the UI scale) so
  benchmarks can set and restore it; restore any other app setting a test changes.

## Benchmarking rules

- `requestAnimationFrame` stops in hidden or minimized windows and is throttled when the window is
  covered. Benchmarks need a visible, uncovered window and an idle mouse. `__lab.set` and `benchmark`
  hang while the page is hidden.
- Only compare runs from the same machine, window size, DPR and display refresh. The results'
  environment line records these values.
- Always include an `off` run as the baseline. The "vs Off" ratio is p95 against p95.
- Frame times come from rAF deltas, which measure frame pacing, not GPU time. For GPU detail, use
  DevTools → Rendering → Frame rendering stats, or a Performance trace via `app:profile`.

## Glass architecture (see `src/glass/`)

Ported from `../TaskMap-Refactor` (`docs/GLASS-SYSTEM-CONTRACT.md` is the reference contract).

- **Two materials**, one recipe each, defined in `recipes.ts`:
  - **Major**: header islands.
  - **Minor**: rows and groups.
  - A Minor nested in a Minor is a **shell**: tint, rim and shadow, no blur.
- **Strategies** (`Glass.tsx` `resolveMode`): off, native, shared, shell and baked. The surface
  component is the same in every strategy. Only the material implementation underneath changes, so the
  look must stay the same across strategies.
- **Hot path**: tuning writes CSS variables from `engine.ts` and never re-renders React. Scrolling runs
  no JS: the shared plane's mask is in content coordinates, and the baked image is held still by a
  scroll-driven animation (`animation-timeline: --list-scroll`).
- **Current direction: Shell strategy (rows have no glass), with TaskMap overlays.**
  - `<Glass floating>` marks an overlay (rank picker, Settings shell). It and every surface inside
    it (`data-overlay`) follow TaskMap's rules whatever the strategy:
    - real glass (`native`);
    - the header's rim style;
    - full-strength shadows (`--*-shadow-overlay`), whatever the row shadow strength is.
  - Settings is a portrait Major shell with Minor islands, following TaskMap's settings patterns:
    horizontal liquid tabs on top, rows and switches (`styles/dialogs.css`, `--tm-*` tokens,
    `--accent`). Its scrim is a sibling of the dialog, never an ancestor.
  - **Settings follows TaskMap's SettingsIslandList**, including the shared Minor batch:
    `settings-scroll-frame` owns a stationary two-filter plane outside `settings-body`.
    `SharedMinorPlane` context makes top-level islands plane-backed; nested Minors remain shells.
    Other overlay islands still use their own native material; the account-list strategies are unchanged.
    `glass/scrollEdgeGeometry.ts` ports the relevant `glassListScrollGeometry`,
    `glassListGeometry` and `layeredOutputMask` logic from `../TaskMap-Refactor`.
    Read fractional local geometry only on layout/content/tuning changes, then project cached shapes
    from scrollTop/scrollLeft in one rAF transaction. Commit body/rim/content slices and the stationary
    plane mask together. Zero insets stay applied for whole cards, as in TaskMap. Do not remeasure
    cards per scroll event or move independent island backdrop filters with the scrolling content.
    Rounded masks use TaskMap's gradient corner caps, avoiding new image encoding/decoding per frame.
    The plane has `data-glass-plane`: presence marking must skip it and its filter descendants;
    fade the material variables rather than adding ancestor opacity. Masks belong on filter outputs.
    Body/rim/content geometry stays in sync; avoid integer offsetHeight for sliced rim geometry.
    Each tab mounts its own scroll viewport at the top, with overscroll contained inside Settings.
    `.dialog.settings` uses four grid tracks (title, tabs, `minmax(0, 1fr)` frame, footer);
    only `.settings-body` scrolls. Keep its selector more specific than the generic `.dialog`
    rule in controls.css. The stack fills the viewport with `min-height: 100%` and islands never
    flex-shrink. Scroll anchoring is disabled; the Major body clips invisible filter overscan.
    Keep native wheel, touchpad and keyboard scrolling; do not add another scroll owner or wheel animation.
    **The content never scrolls natively.** It sits in a sticky `.settings-stage` (which carries the
    padding, i.e. the clip) and `scrollEdgeMorph` moves `.settings-content` by `--stage-scroll` in
    the same rAF as the slices; the body scrolls natively over a spacer sized to the overflow.
    Natively scrolled content is moved by the compositor a frame before JS can update the slices,
    which made the island edges wobble against the viewport while scrolling (2026-10-31).
  - `<Glass rimOnly>`: a shell with tint and rim only, no blur and no dark backing (TaskMap's
    selectors inside a menu, e.g. the picker's buttons).
- **Presence** (`primitives/motion/presence.ts`, `usePresence.ts`), TaskMap's presence motion:
  one progress drives `--presence` on a surface. Glass layers read it (tint, rim, shadow fade; the
  blur starts after 20%), glass-free content fades via `[data-presence-content]` marks. Never fade
  an element that holds glass with opacity; fade its own colours or pseudo-elements with
  `var(--presence)` instead, and keep text inside elements so it can be marked.
  - Menus use `MENU_PRESENCE` + `materialFadeSlideUp` (TaskMap's Shift+E menu; currently unused,
    the picker opens from its badge instead); dialogs use
    `MODAL_PRESENCE` + `materialFade`, with the scrim's opacity following the progress.
  - The Minor recipe's blur values only matter for overlay islands. Rows are shells and ignore them.
- **Reusable primitives** (`src/ui/primitives/`, styles in `styles/primitives.css`), ported from
  TaskMap's `src/ui/primitives`. Use these instead of building new controls:
  - `LiquidTabs`, horizontal or vertical, optionally `disabled` (the whole selector greys out:
    track, labels and pill; inert). Its selection pill is Minor glass with two edge springs
    (snappy leading, soft trailing), and its radius grows with stretch. Click, keyboard and
    press-drag all select.
  - `LiquidToggleSwitch`: TaskMap's track and a Minor glass knob that stretches and thins with
    speed. On an island the knob is a shell, as in TaskMap.
  - Motion: `primitives/motion/spring.ts` (TaskMap's exact spring solver and tokens) and
    `liquidToggleMotion.ts`. Motion writes styles directly to the DOM each frame, never through
    React.
  - Animated glass uses `<Glass live>`: as in TaskMap, its exact rim is drawn on its own canvas and
    redrawn whenever it resizes (or its scroll-edge slice changes); with a non-exact rim style it
    falls back to the CSS rim. Set `--g-radius` inline.
  - The toggle is smaller than TaskMap's (40×24, knob 18); its stretch/thin/overshoot scale with it.
  - `Dialog` (modal shell: scrim, presence, Escape, `data-autofocus`), `ContextMenu` (TaskMap's
    opaque menu), `Field`/`TextInput`/`TextArea`/`Select`, `Button` (secondary/primary/danger),
    `InlineEdit` (+ `parseAmount`: "1.2k", "1,234"). `ContextMenu` entries: items (optional `aside` icon button),
    submenus (`submenu`: open on hover, click or →), sections (optional `value`), notes, dividers.
    The account menu follows the old app's: Last edit header, Edit Battletag, Edit Credentials,
    Account Info, Games Dodged ›, Move To ›, Delete Account. Toasts: `showToast`/`showError`
    (`src/ui/toasts.ts`, rendered by `ToastStack`, Major glass, bottom right). Styles in
    `styles/controls.css`. Open dialogs through `dialogs.open({ kind, accountId })`.
- **Accent colour** (`LabState.accentColor`, null = RankDB cyan `#22d3ee`) is set in Settings →
  Visuals. The engine writes `--accent` and `--accent-rgb`; use those, never a
  hard-coded colour.
- **Masks go on filter outputs, never on an ancestor of a filter.** A masked, filtered or
  opacity<1 ancestor becomes a backdrop root, and the filters inside it sample nothing.
- **Rims** are TaskMap's directional canvas rim, rendered once per unique size into a shared data URL
  (`rim.ts`), not one canvas per surface.

## App UI so far

- **Toasts use Sonner 2.0.8** (pinned; published 2026-08-09). `ToastStack.tsx` mounts the real
  `Toaster` with `expand`, three visible cards, bottom-right and individual swipe/close support. Sonner owns measured stacking, interruptible entrance/exit and ordinary
  hover/hidden-window timer pauses. No custom stack, queue, presence animation or duplicate merging.
  `ui/toasts.ts` keeps the existing `showToast`/`showError` API and a small adapter: three active
  records, microtask batching so synchronous spam publishes only the latest bounded set, errors
  protected ahead of routine feedback, and no stale waiting queue. Each action gets a
  fresh ID, even identical clicks. Ordinary durations are delegated to Sonner.
  `timer: true` uses an absolute adapter deadline and Sonner duration Infinity, so clipboard
  expiry never pauses with hover. A later copy
  converts the earlier clipboard countdown into a short "Clipboard updated again." confirmation.
  Each Sonner `li` receives an actual `<Glass role="major" floating>` through a decorative portal
  managed in `ToastStack.tsx`; Sonner still owns its DOM measurement and gestures. A MutationObserver
  tracks mounted/removed cards and releases material/rim registrations when they leave. The `li`
  itself stays transparent with opacity 1 (including during swipes); Sonner's mounted/visible/removed
  states transition inherited `--presence` to fade glass layers and glass-free content separately.
  Never restore an opacity fade on that ancestor: it would break backdrop sampling. Major blur,
  pre-blur, tint, radius, exact rim and overlay shadow all come from the shared engine.
  The card grid reserves an icon well, text column and dismiss column. No second action row.
  Titles wrap to two lines, long details scroll within a viewport-based budget so three cards fit
  at the 600px minimum height. The stack sits at the lab bottom inset with no reserved footer space.
  Toasts are compact: 12px vertical / 16px horizontal padding, 20px bare icons (no circle), 3px
  title/detail gap and no action buttons. Motion uses 320ms transforms and 160ms material fades /
  swipe exit (20% shorter durations); glass-free content follows presence without a second delayed
  opacity transition.
  `npm run test:toasts` covers the adapter; live MCP checks cover Sonner's actual motion/lifetimes.
  Glass Lab → **Toast notifications** exposes notification-only corner radius, icon size/stroke,
  title/detail contrast, screen insets, speed and shadow strength.
  It follows the shared Major recipe by default; disable that checkbox (or adjust toast corners)
  to capture a private Major recipe for toast blur/pre-blur/saturation/brightness/tint/rim/radius.
  These values live in `LabState.toasts` (`DEFAULT_TOASTS`), normalize on load and persist with the
  lab. Existing settings without that field keep the previous look. `engine.ts` writes CSS variables
  directly and repaints only toast rims for private material changes; no toast-store/lifecycle edits.
  Icon wells and content layout remain fixed so tuning doesn't invalidate Sonner's measured stack.
  Motion speed is bounded to 80–200% so material fades fit Sonner's 200ms removed-node lifetime.
  Previews use the real toast adapter: single success/error, countdown, three-card mixed
  stack and a 20-event burst. They live 15 seconds and have no real side effects. Clear previews
  dismisses only IDs created by the lab. Clear previews remains a lab-only testing control.

- **Chosen lab defaults (2026-10-30)**: the user's live visual tuning is now `DEFAULT_STATE`,
  `DEFAULT_PICKER` and `DEFAULT_TUNING` (separate from the original TaskMap presets). Fresh lab
  settings and Reset use it; existing saved tuning is preserved. Panel position defaults to auto.
- **Credential buttons hidden**: account row plates use 13px corners; showing them restores the
  lab's configured radius. This is a CSS override, not a change to the saved tuning.
- **Toolbar highlights**: action buttons have circular hover/focus fills; role-sort buttons have
  pill fills. The same treatment applies to rail actions.
- **Status/tab scroll bounds**: liquid selection pills clip their decorative `.g-body` with
  `overflow: clip` so masked filter overscan never enlarges an ancestor scroll range. Account info
  Details allows vertical scrolling only (`overflow-x: hidden`). Preserve the springs and backdrop
  sampling; do not replace the body clip with a mask/opacity on the glass ancestor.

- **Submenu pointer intent** (`primitives/menuAim.ts`, `ContextMenu.tsx`): moving diagonally toward
  the open submenu delays sibling activation for up to 350ms, for left- and right-opening menus.
  Entering the submenu cancels switching; moving outside the corridor switches immediately.
  Clicks and keyboard input bypass the delay.
- **Rank picker dismissal**: scrolling three row pitches (row height + gap, currently 210 layout
  pixels) from the opening scroll position closes/cancels it. The listener exists only while open.
  The closing animation aims at the badge's live viewport position, including continued scrolling
  during exit; panel placement still uses its opening anchor. The target retains the badge element
  for animation geometry (the opening rectangle is a fallback for warm mounting/removed elements).
  Placement-only changes update the draft and accessible label without replaying badge-change FX.

- **`docs/NOT-CARRIED-OVER.md`** lists what we deliberately don't copy from the old app. Check it
  before porting a feature, and add to it when we drop or change one.
- **The UI scale only zooms `.app`** (header, rows, scrollbar; the window width follows). Settings
  and the rank picker live in `.overlays`, a `display: contents` sibling outside the zoom, so they
  always render at 100%. Overlays work in plain viewport pixels; never divide by the UI scale there.
- **Rims keep TaskMap's 1.5 px on screen at every UI scale.** Inside `.app`, rim widths are divided
  by the scale: `--ui-zoom` in CSS (reset to 1 in `.overlays`), and `strokePx`/`softnessPx` for the
  canvas rim (the engine uses the scale only for elements inside `.app`). Anything else that must
  not thin out when scaled down should do the same.

- **Settings** (`src/ui/SettingsDialog.tsx`) is copied from the old app's layout.
  - Working: UI scale (five chips under its row, 80/90/100/110/120%, no stepper; other saved
    values snap to the nearest, `UI_SCALE_STEPS`), the Currency and 6v6 column toggles, and
    privacy mode with visible characters.
  - Data and app-service actions are implemented; see `docs/PLAN.md` for release work.
  - Its values are app settings (`src/data/settingsStore.ts`): one JSON value per key in the
    database's `settings` table (`load_settings`/`save_settings`), saved ~0.1 s after a change.
    Values from an old lab settings file are moved over once, when the table is still empty.
- **Names** show without their "#1234" (`displayAccountName`, as the old app) and are cut off
  without "..."; copying the Battletag gives the whole tag.
- **Columns** are placed by named grid lines (`lead`, `name`, `ranks`, `sixv6`, `va`, `vb`, each with
  `-start` and `-end`). `applyColumns` in `glass/engine.ts` builds `--cols` and `--grid-w` from the
  settings, so hidden columns vanish and the window refits. Never place items by column number.
- Header and rail actions come from `useAppActions` (`src/ui/appActions.ts`). That file also holds
  the open-dialog state.
- **Accounts: Rust owns the data, the frontend mirrors it** (`docs/PLAN.md` has the full plan).
  - `src-tauri/src/db.rs`: SQLite (`rankdb.sqlite3` in the app data dir, WAL, 5 s busy timeout),
    numbered migrations tracked by `user_version`, now 5 (never edit a shipped one; add a new one).
    Every action is one command that validates, writes in a transaction and returns the changed record
    (`load_roster`, `set_rank`, `add_account`, `rename_account`, `set_currency`, `delete_account`,
    account details, credentials, `set_status`; dev-only `replace_roster`). The roster loads with
    one query per table (`read_accounts`), never one per account.
  - **Database commands are `async`** (worker threads; sync commands run on the window's thread
    and froze it). So that they still reach the database in the order they were made, **every
    database command from the frontend goes through `command()` in `src/data/backend.ts`**, a FIFO
    queue; never call `invoke` directly for one. Pure clipboard/window/shell commands and
    `unlock_credentials` (key only) may use `invoke`.
  - `src/data/rosterStore.ts`: loads the roster before the first render, applies edits
    optimistically (`editAccount`), then takes Rust's record (`saved`). An answer that arrives while
    later saves are pending is skipped, and a failure shows a toast; either way the roster is reloaded
    from Rust once nothing is pending (never rolled back over newer edits). Edits replace only the
    edited account, so only that row re-renders.
  - **Updates and the database** (the handover from one version to the next):
    - The data folder follows the app identifier: **never change `com.merkdesigns.rankdb.next`**,
      or an update opens an empty database.
    - On open: `quick_check`, refuse a database whose `user_version` is newer than this build
      (going back a version can't misread or damage it), copy an older-schema database to
      `upgrade-copies/rankdb-schema-v<N>.sqlite3` (`VACUUM INTO`, once per version, temp name then
      rename), then each migration in its own transaction; one that adds a dangling reference is
      rolled back. `upgrade_tests` in db.rs build a version-4 database and check every record
      survives; add a fixture for the current version whenever you add a migration.
    - A database that can't be opened doesn't crash the app: `StartupProblem` (Rust) is shown by
      `src/ui/StartupProblem.tsx` (Open data folder, Exit); nothing is written.
    - Closing (any way) waits up to 3 s for pending saves (`startSaveOnClose`, `settleSaves`);
      Install downloads, settles saves, checkpoints the WAL (`flush_database`), then installs. Exit
      also checkpoints (`RunEvent::Exit`).
    - One running copy (`tauri-plugin-single-instance`): a second start focuses the first.
  - **Optional credential protection** (`src-tauri/src/credential_security.rs`, schema 4;
    `docs/CREDENTIAL-ENCRYPTION.md` is the design). New databases store credentials unencrypted;
    Settings → Data can enable a user-chosen master password for **email and password only**.
    AES-256-GCM fields use a random data key, wrapped by PBKDF2-SHA256 (600k) + AES-GCM in database
    metadata. Restart locks credentials; ordinary account management remains available. Settings
    offers unlock, lock now, change password and turn off. Conversions update fields and metadata
    in one transaction, then compact the current database. Keys are zeroized on drop.
    The old Windows-key (DPAPI, `data.key`) storage of early dev builds was dropped (2026-10-31,
    user decision; their data was already converted): a database still in `legacy` mode is refused
    at startup with an explanation, untouched. There is no DPAPI code left; don't add it back.
  - **Secrets never reach the page unasked.** Rows only get `hasEmail`/`hasPassword`. Copy goes
    through `copy_secret` (Rust reads, copies, clears); only the edit-credentials dialog reads the
    values (`get_credentials`), and drops them on close. Credential reads/writes and copies
    enforce the lock in Rust; the frontend prompts and resumes the requested
    operation. Account names, ranks, notes and settings are always outside credential encryption.
  - `src-tauri/src/clipboard.rs`: Win32 clipboard. Secrets are marked to stay out of clipboard
    history, cloud sync and monitors, and cleared after the Settings timer (5–30 s or never) only
    if the clipboard still holds them.
  - **Status** (migration 3): `clean`, `sms` (needs SMS verification) or `banned`, one `status`
    column (`Status` in db.rs, `AccountStatus` in TS). SMS and banned accounts each have a section
    below the list (SMS amber, above banned red), never grouped. Set in Account info (status
    `LiquidTabs`, applied on Save).
  - **Order.** Loose accounts and groups share one top-level order (`sortKey`); each group and each
    section have their own. `move_item(item, destination {groupId, status}, order)` moves one item
    and renumbers its destination from the full `order` (Rust checks every listed item belongs
    there), so keys never run out of precision. A new status takes an account out of its group.
  - **Export/import and backup features are removed/deferred** (user decision 2026-10-30).
    No transfer dialogs, installed-old-app import, backup island/history, automatic snapshots or
    pre-update backups. Their Rust modules/commands, dialog plugin and Credential Manager access
    were removed. Do not rebuild them without a new request. Existing recovery files on disk are
    preserved; this decision removes the feature, not the user's old files.
  - **App services** (`src/ui/AppUpdates.tsx`, started after the window is shown):
    - Updates: `tauri-plugin-updater` on the old app's channel (GitHub releases `latest.json`, its
      minisign pubkey in tauri.conf.json). `updates_enabled` (Rust) allows checks only in the
      published app: release build, identifier `com.merkdesigns.rankdb.next`, version ≥ 1.0. Dev
      builds and RankDB Dev are 0.0.0 and would otherwise be offered the old 0.3 as an "update".
      Silent check on start; Install downloads the update and restarts (no backup feature).
    - What's New (`src/data/whatsNew.ts`): the old app's rule, never on a first start, once after
      the version changes (`lastSeenVersion` setting); also from Settings → Misc.
    - Discord (`src-tauri/src/discord.rs`): a worker thread owns the connection, follows the
      `discordPresence` setting (on by default, as before), retries every 30 s while Discord
      isn't running. "User since" is the `installedOn` setting (first start, or the old app's).
    - Slow crypto commands are `async`: sync commands run on the UI thread and freeze the window.
      App services start only after mandatory decryption has completed.
  - **Rank tracking.** Rank changes are not logged (by request); `rank_history` holds only season
    resets. `season_reset` moves every non-Unranked rank (6v6 too) into history as `season-reset`
    (one shared `changed_at` per reset) and sets them to Unranked; `undo_season_reset(resetAt)`
    restores only slots still Unranked and removes that reset's entries (backend capability retained;
    no Undo toast action is offered after notification buttons were removed).
    Account info → Rank history: role icons over four badge columns, one row per reset, its date
    on the left. `gamesDodged` (0–10) is on the account record; the menu shows the old app's
    next-penalty ladder (15 min, 2 h, 8 h, 20 h, season ban).
  - **Past ranks** (toolbar History button, `src/ui/ResetMenu.tsx`): a menu of every reset
    (`list_season_resets`); picking one shows its ranks in the list (`get_season_reset`, overlaid in
    `rosterStore` `shown()`, one copy per record so rows keep identity). Temporary, never saved;
    the button glows in the accent (`AppAction.glow`) and badges are read-only meanwhile.
  - **Account info** (`AccountInfoDialog`): title "icon Account Info | Battletag", tabs, then the
    old app's country picker (dropdown with dial codes + flag box; `src/data/countries.ts`,
    flag-icons SVGs for these countries only), a Battle.net account settings button
    (`open_battlenet`, Rust opens the one fixed URL), notes (not resizable) and Status.
  - **Groups open and close animated** (`GroupBody` in `src/ui/AccountList.tsx`): eased height via
    grid rows 0fr↔1fr plus a fade, 240 ms; rows are mounted only while open or closing, and clipped
    only while animating. Brackets (`.group-rule-top/-bottom`) enclose the rows.
  - **List** (`buildRoster`): top level (groups with their accounts; empty groups shown), then
    the SMS and banned sections. A role sort (`cycleRoleSort`: tank/damage/support/6v6, best first, again
    for off; old app's rank score) is temporary, never saved, and flattens the list (no groups).
    The active role shows a chevron either side of its icon (old app); toggling it slides every
    row to its new place (`src/ui/sortMotion.ts`: positions taken before, 160 ms translate after).
  - **Drag to reorder** (`src/ui/listDrag.ts`): TaskMap's canvas browser behaviour
    (`CanvasBrowserRuntime.ts`), extended to groups. Past 6 px (vertical) the row, or a group by
    its head, lifts to 1.06× and follows the pointer (a group collapses as it lifts, the list
    below gliding up by FLIP, and stays collapsed where it lands: saved, sent before the move so
    the move's returned roster agrees; Escape restores it); every other piece of the list (rows, group
    heads and rules, the banned divider) slides one slot to open the real gap (190 ms,
    easeOutQuart), with TaskMap's held spread around the enlarged item; TaskMap's smoothstep
    auto-scroll at the edges. Rows pass through groups (past a head the gap opens inside, past the
    last row back out); a collapsed group takes a row after it hovers the head for 350 ms (head
    lights up). A held row looks exactly as it did hovered (same plate, outline, hover; by request no
    extra outline or tint); it only gains a plain backdrop blur on its `::before` plate, and only
    while held, for performance (lab → Scene → Dragged row, `--held-blur`, 0 = off). Held groups get
    no blur (by request) and no shadow. Nothing
    above it may become a backdrop root (filter, opacity < 1, mask) or the blur samples nothing.
    Groups move among the top level, SMS and banned rows within their own section. Drop glides
    into the gap, then `moveItem` saves; Escape/cancel glides home. All motion is `translate`/
    `scale` on the existing elements; React re-renders once, after the drop. Off while sorted.
  - The lab's List → data source: "Saved accounts" (the database) or "Dummy (unsaved)" (the
    generator's account count and seed, for benchmarks; `npm run bench` switches to it). A fresh
    dev database is seeded with the dummy roster; release builds never seed.
- **Kept mounted while hidden**: Settings (`Dialog keepMounted`) and the rank picker mount once the
  app is idle (`useWarmMount`) and then stay, `display: none` while closed, so opening never
  re-renders them. The picker resets its draft and placement when another badge opens it, and
  remounts only its gliding selectors (`generation` key).
- **Rank picker** (`src/ui/RankPicker.tsx`): a Major glass panel with no scrim (a press outside
  closes it) and TaskMap's menu shadow. Its blur is its own (`LabState.picker.blur`, default 24px,
  as `--picker-blur`/`--picker-os`); the rest of the recipe is Major's. It opens like an iOS app from its icon
  (`OPEN_FROM_PRESENCE`, `origin` + `scale` channels read every frame): it fades in while growing
  out of the clicked badge into place, and shrinks back into it on close.
  Columns: tiers (2 × 5) · a cell-wide column with Predicted, then "Div" over vertical division
  `LiquidTabs` (disabled while Unranked is picked) · only while Predicted is on, the placement
  count ("6 / 10", fixed width) above a vertical placement bar (10 unnumbered cells filling up from
  the bottom; press, drag or arrow keys). Toggling Predicted eases the panel's width over 240 ms
  with a Web Animation. Its side of the badge is chosen once, for the expanded width
  (`placementsWidth` measures the column, or an invisible stand-in), and it always sits at the lab
  offset from the badge: on the right the left edge stays put; on the left the right edge does, so
  the panel grows leftwards and its content slides by the column's width (by request: the column
  always stays on the right). The column
  stays rendered until a collapse ends, and the placement effect leaves geometry alone while the
  width animates.
  The panel is `live` glass so its canvas rim follows the width. Confirm spans the bottom.
  - Glass: only Confirm and the division tabs keep their rims. The tiers share one rim-only
    `CellIndicator` that glides to the selected rank with a plain ease-in-out (no liquid
    deformation, by request). Predicted's rim fades in and out as it toggles.
  - Confirm is disabled (and Enter does nothing) until the draft differs from the saved rank.
  - Live draft: while open, the row's badge shows the draft (`usePickerEdit`, only that row
    subscribes), lifted to 1.1 with an overshoot; Confirm saves it, cancel hands back the saved
    rank. A change on the edited badge cross-fades from the old image with a shine masked to the
    badge's shape (`RankBadge`: `badge-in`/`badge-out`/`badge-shine`).
  - While it grows in (`data-presence-phase="showing"`) it takes no pointer events, so the row
    under the pointer keeps its hover.
  - Greyed-out states fade (150 ms), never snap, except the tier and Predicted emblems, which have
    no fade of their own (by request). Where the dimming multiplies with `--presence`,
    transition a registered factor (`--tabs-dim`, `--emblem-dim`), never `opacity` itself, or the
    open/close fade would lag behind the presence.
  - A press outside the picker only closes it: the press and its click are swallowed
    (`swallowClick`), so opening another badge takes a second click.
  - Every size comes from `LabState.picker` as `--picker-*` variables (engine `applyPicker`).
  - It opens beside the badge if either side fits, otherwise below or above it. Escape cancels,
    Enter confirms.
  - Presses inside the lab pop-up don't close the picker, so it can be tuned while open.- **Rank effects** (`RankBadge` `.badge-fx`, styles in app.css; Settings → Visuals → Rank
  effects, `badgeEffects`, the old app's `badgeAnimationsEnabled`): real (not predicted) ranks from
  Emerald up. Glow on the emblem (radial gradient in the tier's colour, screen blend, no white;
  pulses), shine every few seconds, sparkles (pre-drawn SVG per tier). Champion all, Grandmaster
  fewer, Master glow + slight shine, Diamond slight shine + little glow, Emerald faint glow.
  Preview: `docs/previews/rank-effects.html`. Performance rules (measured, 25 effect badges):
  - only compositor animations (opacity, scale, rotate, transform); custom-property or
    background animations restyle the whole row every frame (~10-20 ms);
  - sparkles and shines are hidden while the list scrolls (`data-scrolling`, `useScrollingFlag`):
    their animated layers made each row scrolling into view re-layerize (10 ms frames);
  - no mask or filter on an animated element (sparkles are plain images).
- **Placements** live on each `Rank`: `predicted` plus `placements` (1–10, 0 when not predicted).
  The row badge has no placement indicator yet; that design is still open.
- **Row background** (lab → Scene → Row background: off / every row / every other row, strength,
  radius, height, width per side, outline colour and opacity; `--row-plate-*`/`--row-outline-*`,
  engine `applyRowPlates`): a rounded plate on `.row::before`, the same element as the hover plate (registered
  `--row-hover` adds to `--row-plate`). Alternation restarts in each block (a run of loose rows, a
  group, a section) through `AccountRow`'s `stripe` prop.
- **List scrollbar** (`src/ui/ListScrollbar.tsx`): a thin (4px, never wider) overlay at the
  window's right edge, clear of the rows, visible while the pointer is over the window. The thumb follows `--list-scroll` through a scroll-driven
  animation (`.frame-main` sets `timeline-scope`). JS only sizes it and handles dragging.

## Performance (measured at 370 Hz, 1x DPI; traces via `app:profile`)

- **The list scroller is composited** (`will-change: scroll-position`). Without it, Chromium keeps
  a see-through scroller on the main thread at 1x DPI and repaints the list every scroll frame
  (shell/off scrolled at half rate, 86% late frames). Text rendering is unchanged.
- **Rows use `content-visibility: auto`** (culling): offscreen rows skip style, layout and paint,
  and moved rows reuse their paint. It clips to the row, so `overflow-clip-margin` must stay larger
  than any row plate or hover effect that reaches past the row. Group open/close spam went from
  49% late frames to ~0.3%.
- **Empty list shells are skipped** (`data-list-shells="empty"`, engine): with zero tint, body,
  shadow and rim their layers are `display: none`; pixel-identical.
- **Fewer paint effects per row**: an unranked badge's dimming is in its image's filter chain
  (`drop-shadow(…) opacity(.5)`), not `opacity` on the badge. Every filter, opacity < 1, clip and
  z-indexed layer splits paint into chunks that are re-layerized each frame.
- Remaining one-off frames: mounting the rank picker or Settings (React render in one frame).
- Tracing recipe: CDP `Tracing.start` (devtools.timeline, blink, cc, viz) around a scenario, then
  total `X` events per thread; `UpdateLayoutTree.args.elementCount` shows restyle size. Long frames
  with `FunctionCall` > `FireAnimationFrame` around `UpdateLayoutTree` mean forced style in rAF.

## Window frame (`src/platform/window.ts`)

- The lab's `chrome` setting can be `native` (Windows title bar), `caption` (window buttons in the top
  margin) or `rail` (buttons plus app actions in a right-hand glass rail).
- The window is created hidden (`visible: false`). The frontend applies decorations for the saved
  frame, renders, then shows the window, so the native bar never flashes. `main.rs` shows the window
  after 3 s if the frontend never does.
- Custom frames drag through our own `data-drag-region` handling, not Tauri's
  `data-tauri-drag-region`, because Tauri's hard-wires double-click to the system maximize. It's on
  the top strip, the header itself (the gaps between islands), the island spacer, the rail spacer and
  the backdrop. Drag regions only fire on the element itself, never on its children.
- **There is no maximize**, the same as other fixed-size apps such as the League client and
  Character Map.
  - The window is `maximizable: false`, so Windows offers no maximize: no drag-to-top, no Win+↑,
    and the native title bar's button is greyed out.
  - `resize_edges.rs` also drops any `SC_MAXIMIZE` that still arrives.
  - Custom frames show only minimize and close, flush in the top-right corner.
  - Height changes only by dragging the top or bottom edge.
  - Don't add maximize back: an earlier "full height in place" version bounced visibly when Windows
    maximized first.
- All window access goes through `src/platform/window.ts`. Window permissions are listed in
  `src-tauri/capabilities/default.json`.
- **Only the top and bottom edges resize.** `src-tauri/src/resize_edges.rs` remaps Windows' frame
  hit test: side edges become a plain border (no resize cursor), and corners become top or bottom.
- **The window width is locked to the layout.** `fitWindowToContent` sets min and max width to
  `.frame` width × UI scale and refits on frame resize, scale change or frame-type change. Height
  stays free. Never add layout that relies on spare width beside the frame.
  - Size limits apply to the whole window, including Windows' invisible 8 px resize borders, even
    on a frameless window. `setSize` sets only the webview area. The measured border allowance is
    added to the limits; without it the UI is clipped on the right.
- **The lab is a pop-up inside the window** (`LabPanel` `useFloatingPanel`). It's dragged by its
  header, collapses to a pill, and is clamped inside the window. Its position is saved as
  `panelX`/`panelY` (null means the default top-right spot). It takes no layout space.
- **While the window is hidden, nothing may wait for `requestAnimationFrame`.** Hidden webviews never
  fire it. Startup renders with `flushSync`, then fits and shows the window without waiting for a
  frame.

## Gotchas

- Capability edits now rebuild because `src-tauri/build.rs` watches the `capabilities` folder; the
  custom capability pattern stops tauri-build from doing it. If a "not allowed" error survives a
  capability edit, check that `src-tauri/gen/schemas/capabilities.json` contains the permission.
- Vite's watcher on Windows can miss two edits to one file that land within milliseconds and keep
  serving the old transform. Fix: `touch` the file and reload.
- The base identifier (`com.merkdesigns.rankdb.next`), MCP development override (`…next.dev`)
  and installed RankDB Dev (`com.merkdesigns.rankdb.devapp`) have separate data directories and
  databases. Check the active launch config before assuming which data a window uses.
- Loaded settings pass through `normalizeState` in `src/lab/store.ts`. Add a migration there when the
  `LabState` shape changes; v1's single `rimMode` already migrates to `majorRim`/`minorRim`.
- After a new npm dependency, the first dev launch shows a blank window for a few seconds while Vite
  pre-bundles it. Wait for it rather than treating it as a crash.
