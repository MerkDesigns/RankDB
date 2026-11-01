# RankDB architecture

The detailed design notes behind `CLAUDE.md`'s rules: how each part works and why, including the
user's decisions. Read the section for an area before changing it, and keep it current.

## Glass architecture (see `src/glass/`)

Ported from `../TaskMap-Refactor` (`docs/GLASS-SYSTEM-CONTRACT.md` is the reference contract).

- **Two materials**, one recipe each, defined in `recipes.ts`:
  - **Major**: header islands.
  - **Minor**: rows and groups. Its only blur is the pre-blur, which the app's defaults turn off
    (rows are shells); RankDB Setup (`src/installer/main.tsx`) passes its own tuning to
    `startGlassEngine` with TaskMap's pre-blur back, since its islands float on the smoke.
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
  - Dialogs use `MODAL_PRESENCE` + `materialFade`, with the scrim's opacity following the progress;
    the picker uses `OPEN_FROM_PRESENCE`.
  - The Minor recipe's blur values only matter for overlay islands. Rows are shells and ignore them.
- **Reusable primitives** (`src/ui/primitives/`, styles in `styles/primitives.css`), ported from
  TaskMap's `src/ui/primitives`. Use these instead of building new controls:
  - `LiquidTabs`, horizontal or vertical, optionally `disabled` (the whole selector greys out:
    track, labels and pill; inert). Its selection pill is Minor glass with two edge springs
    (snappy leading, soft trailing), and its radius grows with stretch. Click, keyboard and
    press-drag all select.
    A tab list that measures 0 (a closed dialog kept mounted) places the pill without animating:
    its minimum size can't reach 0, so the spring never settled and ran every frame (fixed
    2026-10-31).
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
- **Accent colour** (`LabState.accentColor`, null = RankDB purple `#9e7aff`) is set in Settings →
  Visuals. The engine writes `--accent` and `--accent-rgb`; use those, never a
  hard-coded colour.
- **Masks go on filter outputs, never on an ancestor of a filter.** A masked, filtered or
  opacity<1 ancestor becomes a backdrop root, and the filters inside it sample nothing.
- **Rims** are TaskMap's directional canvas rim, rendered once per unique size into a shared data URL
  (`rim.ts`), not one canvas per surface.

## App UI

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

- **Chosen lab defaults (2026-10-30; toast tuning 2026-10-31)**: the user's live visual tuning is
  now `DEFAULT_STATE`, `DEFAULT_PICKER`, `DEFAULT_TUNING` and `DEFAULT_TOASTS` (separate from the
  original TaskMap presets). Release builds have no lab and always use these. Fresh lab
  settings and Reset use it; existing saved tuning is preserved. Panel position defaults to auto.
- **Credential buttons hidden**: account row plates use 13px corners; showing them restores the
  lab's configured radius. This is a CSS override, not a change to the saved tuning.
- **Pointer light** (`src/ui/pointerGlow.ts`, by request instead of hover fills): header and rail
  buttons have no hover highlight of their own. Over a glass bar (header island, rail) a light
  follows the pointer (`GlassLight`, `.glass-light`): one soft radial glow (by request, no
  separate core), and the rim lit near the pointer (a ring-masked `::after`, no filter inside). No blend mode: a
  blended child makes the island a backdrop root and its blur samples nothing. Pressing a button
  brightens it; keyboard focus gets an outline. Icons (`.button-icon`, `.role-sort-icon`, and each row's credential and Battletag buttons) dip to
  0.9 while pressed and spring back on release (`scale` only; no hover growth, by request).
  An account row's plate has its own much larger, fainter hover glow, on at once and fading out
  in 120 ms (a slower fade trailed lit rows behind a pointer moving across the list). One delegated
  `pointermove`/`pointerover` listener writes the pointer's position in the bar or row
  (`--pointer-x`/`-y`, registered as not inherited, so a move restyles only that element).
  - Header buttons cover their island edge to edge (square where they meet, the island's corners
    at its ends), so the whole bar is clickable. Icons keep their places: the role island's outer
    buttons take the slack and pad their icon over its badge column; the last toolbar action
    reaches the rounded end. The past-ranks accent circle is drawn behind the icon (`::after`).
  - A row's glow stops at the header's bottom edge (`--glow-clip`, sizing the gradient layer), so
    a row under the overlay header never lights its glass. It is off while the list scrolls (no
    JS runs then) and restarts under the pointer when scrolling settles (`refreshPointerGlow`).
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

- **`docs/PLAN.md` → Not carried over** lists what we deliberately don't copy from the old app.
  Check it before porting a feature, and add to it when we drop or change one.
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
- **Names** show without their "#1234" (`displayAccountName`, as the old app) and are cut off
  without "..."; copying the Battletag gives the whole tag.
- **Columns** are placed by named grid lines (`lead`, `name`, `ranks`, `sixv6`, `va`, `vb`, each with
  `-start` and `-end`). `applyColumns` in `glass/engine.ts` builds `--cols` and `--grid-w` from the
  settings, so hidden columns vanish and the window refits. Never place items by column number.
- Header and rail actions come from `useAppActions` (`src/ui/appActions.ts`). That file also holds
  the open-dialog state.
- **Accounts: Rust owns the data, the frontend mirrors it** (`docs/PLAN.md` has the full plan).
  - `src-tauri/src/db/` (`mod.rs` opens and migrates, one file per area, `migrations.rs`): SQLite (`rankdb.sqlite3` in the app data dir, WAL, 5 s busy timeout),
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
      rename; only the newest 3 are kept), then each migration in its own transaction; one that adds a dangling reference is
      rolled back. `db/upgrade_tests.rs` builds a version-4 database and check every record
      survives; add a fixture for the current version whenever you add a migration.
    - A database that can't be opened doesn't crash the app: `StartupProblem` (Rust) is shown by
      `src/ui/StartupProblem.tsx` (Open data folder, Exit); nothing is written.
    - Closing (any way) waits up to 3 s for pending saves (`startSaveOnClose`, `settleSaves`);
      Install downloads, settles saves, runs `prepare_for_update` (WAL checkpoint, pending secret
      cleared from the clipboard), then installs. Exit does the same (`RunEvent::Exit`).
    - Upgrade copies follow every credential protection change (`convert_copies` in
      credential_security.rs): enabling, changing or turning off the master password re-encrypts or
      decrypts each copy too, and a copy that can't be converted is deleted, so no copy keeps
      credentials in a weaker mode than the live database.
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
    if the clipboard still holds them. A pending secret is also cleared when the app exits or
    installs an update (`clipboard::clear_pending`), so closing early never leaves it behind.
  - **Status** (migration 3): `clean`, `sms` (needs SMS verification) or `banned`, one `status`
    column (`Status` in db/records.rs, `AccountStatus` in TS). SMS and banned accounts each have a section
    below the list (SMS amber, above banned red), never grouped. Set in Account info (status
    `LiquidTabs`, applied on Save).
  - **Order.** Loose accounts and groups share one top-level order (`sortKey`); each group and each
    section have their own. `move_item(item, destination {groupId, status}, order)` moves one item
    and renumbers its destination from the full `order` (Rust checks every listed item belongs
    there), so keys never run out of precision. A new status takes an account out of its group.
  - **RankDB 0.3 migration** (`src-tauri/src/legacy.rs`, added 2026-10-31 so 0.3 users who
    update don't get an empty app). One way, kept simple by request: old data → new version →
    migrated, nothing else. 0.3 keeps its data in `%APPDATA%\com.rankdb.desktop`
    (`app_state.encrypted_payload`, AES-GCM, key in Credential Manager `local-db-key.RankDB`).
    It only reads it, never writes or deletes. **It only ever writes into an empty database** (no
    accounts, no groups) without a master password, and never appends to existing accounts;
    credentials arrive unencrypted and the user can set a master password afterwards. A release
    build's first start with an empty database migrates automatically (`take_old_app_import` toasts
    the result; the `oldAppImport` setting stops an emptied list from migrating again on a later
    start). Settings → Data shows a Migrate row only while 0.3 data exists and the list is empty
    (manual download, failed first try). Dev builds never auto-migrate; never test it on the user's real 0.3 data. The new installer has
    the same product name and `rankdb.exe` as 0.3, so it is expected to install over it in place
    (verified 2026-11-01 by Merk in a VM with the 1.0.0 test build: installed over 0.3 in place,
    data migrated).
  - **Designs** (Settings → Visuals, by request 2026-11-01; `src/glass/designs.ts`): the app setting
    `design` picks the backdrop, Flat (`flat`, the base colour) or Haze (`ambient`, the default).
    The backdrop stays lab state, which the engine and `Backdrop` read; `startDesigns` sets it from
    the setting at startup and on every change. In dev builds a lab-only backdrop (dots, smoke, …)
    survives startup until a design is picked. Previews: Flat is its colour, Haze a still image of
    the ambient field at the window's shape (`ambientSnapshot`: drawn once on a context of its own,
    released at once, the last image kept). A live WebGL context per preview cost ~6 ms of
    waiting on the GPU every time the Visuals tab opened.
  - **Backups and 0.3 exports** (Settings → Data, by request 2026-11-01; `src-tauri/src/db/backup.rs`,
    `src/ui/DataTransferDialog.tsx`). Rust opens the file pickers itself (`tauri-plugin-dialog`,
    no page permission); the dialog then asks for the file's password.
    - *Export all data*: a `VACUUM INTO` copy of the whole database, sealed with AES-256-GCM under
      a PBKDF2-SHA256 (600 000 rounds) key from a backup password, in a JSON `.rankdb-backup`
      (`format`, `version`, `schema`, `exportedAt`, `salt`, `iterations`, `data`). Pending settings
      are flushed first.
    - *Import backup* replaces **everything** (accounts, groups, past ranks, settings, credential
      protection): the file is decrypted to a staging file, checked, migrated to this schema (a
      newer one is refused), then copied over the live database with SQLite's backup API, and the
      vault reloads its protection (locked if it has a master password).
    - *Import RankDB 0.3 export* (`.rankdb-export`, `legacy::replace_from_export`) replaces only
      the accounts and groups (with their past ranks); settings, the install day and credential
      protection stay. Credentials are sealed under the current protection, so a locked master
      password is unlocked first.
    - Before either import the database is copied to `upgrade-copies/rankdb-before-import.sqlite3`
      (only the latest), which credential protection changes convert like the upgrade copies.
    - Automatic or pre-update backups stay removed (user decision 2026-10-30).
  - **App services** (`src/ui/AppUpdates.tsx`, started after the window is shown):
    - Updates: `tauri-plugin-updater` on the old app's channel (GitHub releases `latest.json`, its
      minisign pubkey in tauri.conf.json). `updates_enabled` (Rust) allows checks only in the
      published app: release build, identifier `com.merkdesigns.rankdb.next`, version ≥ 1.0. Dev
      builds never check. The version is `package.json`'s everywhere
      (`tauri.conf.json` names it; `scripts/check-version.mjs`, in `npm run check`, holds the Cargo
      manifests and locks to it); releases: tag `v<version>`, `.github/workflows/release.yml`.
      Silent check on start; Install downloads the update and restarts (no automatic backup).
    - What's New (`src/data/whatsNew.ts`, text in `src/text/whats-new.txt`, by request so it can be
      edited in one place; format in docs/EDITING-TEXT.md): the old app's rule, never on a first start, once after
      the version changes (`lastSeenVersion` setting); also from Settings → Misc.
    - Discord (`src-tauri/src/discord.rs`): a worker thread owns the connection, follows the
      `discordPresence` setting (on by default, as before), retries every 30 s while Discord
      isn't running. "User since" is the `installedOn` setting (first start, or the old app's).
    - Slow crypto commands are `async`: sync commands run on the UI thread and freeze the window.
      App services start only after the database opened (no startup problem).
  - **Rank tracking.** Rank changes are not logged (by request); `rank_history` holds only season
    resets. `season_reset` moves every non-Unranked rank (6v6 too) into history as `season-reset`
    (one shared `changed_at` per reset) and sets them to Unranked; `undo_season_reset(resetAt)`
    restores only slots still Unranked and removes that reset's entries. Undo lives in Past ranks
    (an Undo icon on the newest reset only) and asks first, warning it is only for a reset made
    by mistake (`UndoSeasonResetDialog`); the reset toast points there.
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
    the SMS and banned sections. A column sort (`cycleColumnSort`, clicking a header icon: tank,
    damage, support and 6v6 best first by the old app's rank score; each currency most first; again
    for off) is temporary, never saved, and flattens the list (no groups). The active column shows
    a chevron either side of its icon (old app); toggling it slides every row to its new place
    (`src/ui/sortMotion.ts`: positions taken before, 160 ms translate after).
  - **Deleting** an account or group (`removeWithMotion`, by request): the row, or the group's
    head, glass and brackets (its accounts stay), fades and shrinks to 0.96 over 180 ms; then the
    roster drops it and the same slide closes the gap. Not shown (inside a collapsed group): removed
    at once. Like the sort's fade-in, it fades with opacity, so with glass in the rows (not the
    shell strategy) their blur drops out for that moment.
  - **Drag to reorder** (`src/ui/listDrag.ts`): TaskMap's canvas browser behaviour
    (`CanvasBrowserRuntime.ts`), extended to groups. Past 6 px (vertical) the row, or a group by
    its head, lifts to 1.06× (z-index 2: over the other rows and the header fade, under the
    header and rail, whose glass blurs it like any row beneath) and follows the pointer (a group
    collapses as it lifts, the list below gliding up by FLIP, and stays collapsed where it lands: saved, sent before the move so
    the move's returned roster agrees; Escape restores it); every other piece of the list (rows, group
    heads and rules, the banned divider) slides one slot to open the real gap (190 ms,
    easeOutQuart), with TaskMap's held spread around the enlarged item; TaskMap's smoothstep
    auto-scroll at the edges. Rows pass through groups (past a head the gap opens inside, past the
    last row back out); a collapsed group takes a row after it hovers the head for 350 ms (head
    lights up). A held row keeps its plate and outline but not its hover tint (by request: no grey cast,
    no extra outline or tint); it only gains a plain backdrop blur on its
    `::before` plate (no saturation or brightness change: that read as grey), only while held, for
    performance (lab → Rows → Dragged row, `--held-blur`, 0 = off). Held groups get
    no blur (by request) and no shadow. Nothing
    above it may become a backdrop root (filter, opacity < 1, mask) or the blur samples nothing.
    The same goes for blend modes inside the row: the rank effects' `mix-blend-mode` made the row
    the blend group (its own render surface), so rows with Emerald+ badges didn't blur. `.badge`
    has `isolation: isolate` so they blend inside the badge.
    Groups move among the top level, SMS and banned rows within their own section. Drop glides
    into the gap, then `moveItem` saves; Escape/cancel glides home. All motion is `translate`/
    `scale` on the existing elements; React re-renders once, after the drop. Off while sorted.
  - The lab's List → data source: "Saved accounts" (the database) or "Dummy (unsaved)" (the
    generator's account count and seed, for benchmarks; `npm run bench` switches to it). A fresh
    dev database is seeded with the dummy roster; release builds never seed.
- **Kept mounted while hidden**: Settings (`Dialog keepMounted`) and the rank picker mount once the
  app is idle (`useWarmMount`) and then stay, `display: none` while closed, so opening never
  re-renders them. The picker resets its draft and placement when another badge opens it, and
  remounts only its gliding selectors (`generation` key). Once both are mounted and the window
  is visible, `ui/warmup.ts` renders them for 3 frames at full presence and 0.2% opacity
  (`data-warming`), so the first opening doesn't rasterise and set up blurs mid-animation (by
  request: Settings' first open had a 61 ms frame, now 20 ms like later ones).
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
  - Presses inside the lab pop-up don't close the picker, so it can be tuned while open.
- **Rank effects** (`RankBadge` `.badge-fx`; which tier gets what and the motion in
  `ui/rankEffects.ts`, colours and strengths in app.css; Settings → Visuals → Rank effects,
  `badgeEffects`, the old app's `badgeAnimationsEnabled`): real (not predicted) ranks from
  Emerald up. Glow on the emblem (radial gradient in the tier's colour, screen blend, no white;
  pulses), shine every few seconds, sparkles (pre-drawn SVG per tier). Champion all, Grandmaster
  fewer, Master glow + slight shine, Diamond slight shine + little glow, Emerald faint glow.
  Only the Rank effects setting turns them off; Windows' "Animation effects" (reduced motion) is
  deliberately ignored, by request (2026-10-31). Performance rules (measured):
  - **Web Animations, not CSS animations** (`element.animate`, the shine on `::before`). React
    listens for animation events at its root, so Chromium woke the page for ~14 frames before
    every CSS animation cycle ended: with a list's worth of effects (64 loops) ~200 page frames/s
    and ~160 ms/s of main thread at rest (357 Hz). No start delays either: a delayed start wakes
    the page every frame until it begins, so sparkle delays are folded into the start time.
  - **60 updates a second on one clock**: stepped timing (`steps(duration × 60)`), every loop
    started a whole number of 1/60 s steps from the timeline's zero, phases rounded to steps. A
    smooth compositor animation redraws the window at the display's full rate, and loops out of
    step would each add their own redraws. Idle over Haze, 2026-11-01 (357 Hz, 11 badges with
    effects in view): page 200 → 30 frames/s; main thread 162 → 29 ms/s, GPU 257 → 43, viz
    270 → 58, compositor 136 → 47 (effects off: 11 / 13 / 19 / 14). The ambient backdrop's
    redraws fall on the same clock (`ambientField.ts`), so most share a frame with a step.
  - only compositor properties (opacity, scale, rotate, transform); custom-property or
    background animations restyle the whole row every frame (~10-20 ms). The glow's strength is
    in its gradient so the pulse animates opacity from 1;
  - no mask or filter on an animated element (sparkles are plain images);
  - **each running loop is a layer of its own** (113 layers vs 26 with them stopped), and with
    those layers every frame that changes the page's layering (an overlay's fading blur, rows
    scrolling into view) re-layerizes for ~5.5 ms instead of ~0.5. So they stop (cancelled, not
    paused: a paused animation keeps its layer) while their badge is off screen (one
    IntersectionObserver), another window has focus (`data-window-inactive`,
    `startFocusTracking` in window.ts), a dialog is open (`data-dialog-open`, `Dialog.tsx`) or the
    rank picker is open (`data-picker-open`, all but the edited badge, which keeps its own until
    the picker has closed). The shine and sparkles also stop while the list scrolls
    (`data-scrolling`, `useScrollingFlag`). At rest the glow stays lit; shine and sparkles are out
    of sight. Restarting them costs one ~10 ms frame (layerize), when nothing else moves. The rank
    picker went from 5.2% to 0.9% late frames (p99 8.4 → 3 ms);
  - **Nothing may request animation frames it doesn't draw on**: one stray `requestAnimationFrame`
    loop makes every badge effect cost main-thread time at the display's full refresh rate.
- **Placements** live on each `Rank`: `predicted` plus `placements` (1–10, 0 when not predicted).
  The row badge has no placement indicator yet; that design is still open.
- **Row background** (lab → Scene → Row background: off / every row / every other row, strength,
  radius, height, width per side, outline colour and opacity; `--row-plate-*`/`--row-outline-*`,
  engine `applyRowPlates`): a rounded plate on `.row::before`, the same element as the hover glow (registered
  `--row-hover` fades it in over `--row-plate`). Alternation restarts in each block (a run of loose rows, a
  group, a section) through `AccountRow`'s `stripe` prop.
  In the shared strategy the plates are glass too: `ListPlane` adds each shown plate's
  `.row::before` box (with its own radius) to the plane's mask, beside the `data-plane-shape`
  surfaces. Measured 2026-10-31 over the smoke backdrop: 1.9 MPx blurred, 0% late scroll frames,
  ~6% GPU idle in the background.
- **List scrollbar** (`src/ui/ListScrollbar.tsx`): a thin (4px, never wider) overlay at the
  window's right edge, clear of the rows, visible while the pointer is over the window. The thumb follows `--list-scroll` through a scroll-driven
  animation (`.frame-main` sets `timeline-scope`). JS only sizes it and handles dragging. The
  thumb's hitbox is 12px, 3x the bar it draws (`::before`), by request.

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
- **Smoke backdrop** (lab → Scene → Background → Smoke, `glass/smokeField.ts`, WebGL2, after
  motes by Lucas Marques, MIT): redraws at most `updates` times a second (default 120) because each
  redraw re-blurs the glass above. Between draws it sleeps on a timer rather than polling
  `requestAnimationFrame`, so it costs one page frame per draw, not one per refresh.
- **Ambient backdrop** (lab → Background → Ambient, `glass/ambientField.ts`, WebGL2): four soft
  coloured lights (additive Gaussian falloff, a faint static grain against banding) drifting over
  the base colour, drawn at half resolution, 30 updates/s by default and none while nothing moves.
  Draws fall on whole periods of the page clock, the rank effects' clock, so most share a frame
  with an effect step (82 → ~73 frames/s at 357 Hz; waking early to always share cost more page
  frames than it saved). Measured 2026-10-31 with the window in the background: ~1% GPU, ~2% CPU
  (smoke: ~6% / ~8%).
  - **Parallax** (lab only, by request off in releases: `ambient.parallax` default 0, and release
    builds draw one canvas, `AMBIENT_LAYERS` in `Backdrop.tsx`; 0 = one flat layer): the
    lights sit on three canvases (back to front 0.06, 0.14, 0.26 of the scroll at strength 1); the
    upper two are black plus their lights, added with `plus-lighter`, so at the top of the list it
    looks the same as one layer. Each slides by a scroll-driven `translate` on `--list-scroll`
    (`timeline-scope` on `.app`), so scrolling runs no JS and redraws nothing. A layer is taller
    than the window by its travel (heights in 256px steps, so opening a group rarely resizes a
    canvas); the four-light layout repeats down it per window height. The list's scroll range
    reaches the field through a ResizeObserver (`Backdrop.tsx`), never on scroll. Off in the baked
    strategy (its still copy can't follow). Measured 2026-11-01 (dev, 357 Hz, scripted scroll):
    p99 2.9 ms on and off, no late frames.
- Remaining one-off frames (production frontend, 2026-11-01, 357 Hz): restarting the rank
  effects after a dialog closes or the list stops scrolling (~10 ms, layerize; nothing else is
  moving then) and switching Settings tabs (each tab mounts afresh; ≤ 8 ms of script). Scroll,
  hover and menus: p99 at refresh. Mounting the rank picker or Settings happens at idle.
- Measure frontend costs on the production build: dev React inflates script time. `vite build`,
  `vite preview --port 5180`, then the debug `rankdb.exe` with
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9333 --remote-allow-origins=*"`.
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
- **The lab is a pop-up inside the window** (dev builds only; `App.tsx` lazy-loads it, so release
  bundles don't contain it) (`LabPanel` `useFloatingPanel`). It's dragged by its
  header, collapses to a pill, and is clamped inside the window. Its position is saved as
  `panelX`/`panelY` (null means the default top-right spot). It takes no layout space.
- **While the window is hidden, nothing may wait for `requestAnimationFrame`.** Hidden webviews never
  fire it. Startup renders with `flushSync`, then fits and shows the window without waiting for a
  frame.
