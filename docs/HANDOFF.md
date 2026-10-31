# Shared handoff: Codex / Claude

Last updated: 2026-10-31 (Europe/Berlin).

## Current request and work completed

Latest request (Claude, 2026-10-31): fix the database issues so nothing breaks, including across
app updates; the old Windows credential system is dropped (the user's data was already plain).
Done:
- DPAPI removed entirely (secrets.rs is only the AES-GCM primitive, no Win32 crypto feature,
  no migrate_legacy_credentials, no LegacyDataMigration screen). `legacy` mode is refused at
  startup, data untouched.
- All DB commands async (no main-thread freezes during PBKDF2); unlock no longer takes the DB
  lock. Frontend FIFO queue `src/data/backend.ts` `command()` keeps commands in order;
  rosterStore `saved()` skips answers overtaken by later saves and reloads the roster from Rust once
  idle after any failure/skip (replaces rollbacks that could clobber newer edits; HANDOFF finding 2).
- Startup: busy_timeout 5 s, quick_check, refuse newer schema, copy before upgrade
  (`upgrade-copies/rankdb-schema-v4.sqlite3`), per-migration transactions with a new-dangling-
  reference check. Failures show StartupProblem (Open data folder / Exit) instead of crashing.
- Migration 5: drop groups.section; rank_history rebuilt with slot/division/placements checks and
  reason = 'season-reset' only; reset index.
- read_roster: 4 queries instead of ~4 per account.
- Single instance (tauri-plugin-single-instance =2.5.4, published 2026-10-14).
- Close waits ≤3 s for pending saves; Install = download → settle → flush_database → install;
  RunEvent::Exit checkpoints.
Verified: cargo test 17 pass (new upgrade_tests: v4 → v5 keeps every record and copies first,
fresh = upgraded schema, newer version refused untouched, failed migration stays at v4, legacy
refused untouched); npm run check; test:strings/credentials/toasts/scroll pass. Live: the user's
dev DB (com.merkdesigns.rankdb.next.dev) upgraded 4 → 5 on restart; accounts, ranks, currencies,
groups, credentials, history and settings hash-identical to the pre-upgrade copy (47 accounts).
Six rapid toggles of one group ended in the original state on screen and in the DB. A second
rankdb.exe exited at once with the first still running. Not live-tested: the StartupProblem screen
(covered by Rust tests only) and a real updater install.

Previous entry:

Latest request (Claude, 2026-10-31): the top/bottom island edges in Settings still wobbled while
scrolling, as if the viewport itself moved. Cause: the compositor scrolls the content a frame
before the JS slice update lands (async scrolling), so the sliced edges trailed the scroll by up to
a frame; JS-side measurements can't see this, which is why earlier checks showed <=1/64px error.
Fix: the Settings content sits in a sticky `.settings-stage` and is translated by `--stage-scroll`
in the same rAF as slices/rims/plane mask; the body still scrolls natively over a spacer sized to
the overflow (content height − stage height + stage padding). `readScrollLayout` takes an optional
clip frame and the applied offset. Verified: scroll ranges unchanged (Visuals 49px, Data 0, Misc
5px), no horizontal overflow, CDP wheel scrolling moved content, edges sliced at both ends in
screenshots, test:scroll and npm run check pass. Settings closed afterwards; no settings changed.
Needs the user's subjective confirmation on real wheel/touchpad input.

Previous entry:

Latest request: the visible top/bottom island edges still wobble only while scrolling. User explicitly
asked to inspect TaskMap-Refactor and use its solution without complicated workarounds. Compared
`../TaskMap-Refactor/src/ui/patterns/settings/SettingsPatterns.tsx`, `useSharedSmallGlassList.ts`,
`glassListScrollGeometry.ts`, `glassListGeometry.ts`, `materialGeometryScheduler.ts` and
`layeredOutputMask.ts`. The previous RankDB port omitted two key parts: TaskMap keeps a shared
Minor filter plane outside the scroller and projects cached local geometry in a frame transaction;
RankDB remeasured card rectangles on each scroll event with independent scrolling island filters.
This supersedes the earlier implication that the fixed-grid layout alone handled the reported wobble.

Implemented TaskMap's relevant structure, adapted to RankDB's single Settings viewport:
- SettingsBody now renders a relative frame with a stationary, output-masked two-filter Minor plane
  alongside the native scroller. `SharedMinorPlane` context makes top-level islands plane-backed;
  nested toggle knobs remain shells. Role recipes, glass tuning and account-list strategies stay intact.
- `scrollEdgeGeometry.ts` measures fractional local layout on layout/content/tuning changes and
  projects it from scroll offsets with no per-scroll layout/style reads. Preserved TaskMap's thin-pill
  narrowing and gradient corner-cap masks, so scrolling doesn't generate/decode mask images.
- `scrollEdgeMorph.ts` batches reads/projection and slice/rim/plane writes into one rAF transaction,
  invalidating the layout on ResizeObserver, content changes, window resize and lab tuning. Kept
  zero insets applied for whole cards to avoid a whole/sliced render-state switch at the boundary.
- Presence treats `data-glass-plane` as a glass layer. Its ancestors stay opacity 1 during fades;
  pre-blur/main-blur follow presence variables. The prior fixed-grid scroll viewport remains.
No custom wheel handler/animation, input delays, pixel-offset patches or alternative glass material.

Verified: npm run check passes (existing >500kB advisory, ~540kB / 170kB gzip). Four new tests under
npm run test:scroll pass: local/fractional geometry through scale-in, zero hot-path measurement,
thin/hidden slices, no drift after 2000 projections and safe gradient/empty masks. Existing 18 text,
credential and toast frontend tests pass (22 frontend tests total). Rust code unchanged.
Live MCP: 40 scroll positions reported zero geometry/style reads from the morph and maximum edge
alignment error 0.015625px (browser layout precision). All three tabs at 540px / temporary 380px
shell heights had stable ranges, zero horizontal/outer overflow, zero local island filters and two
shared filter layers. Native Windows wheel sampling captured 33 moving frames across scrollTop
0–49 with the same <=1/64px geometry error. Screenshots inspected during wheel movement. A 30-frame
opening check kept the plane unmarked by presence and opacity 1 throughout. Temp heights restored;
lab snapshot matched. No account/app-settings/lab-tuning/clipboard/encryption operations performed.
A temporary diagnostic callback initially used the native getComputedStyle with an incorrect receiver;
corrected the probe and removed all diagnostic overrides/listeners. This was not application code.
Subjective visual confirmation from the user is still useful; do not equate settled screenshots alone
with verification of every compositor frame.


Latest request: Settings feels as if the entire content area moves/jumps while scrolling (user
clarified this, rather than the glass-edge morph itself). Investigation via MCP and real Windows
wheel input: shell/title/tabs stayed stationary and native wheel motion was already smooth in the
controlled run. Did not reproduce a distinct outer-list scroll. Found the Major shell's invisible
filter overscan enlarged outer overflow geometry (e.g. 617px content for a 488px shell), and made
the layout constraints explicit to prevent flex/scroll-anchor corrections.

Implemented in dialogs.css: `.dialog.settings` now has four grid tracks for title, tabs,
`minmax(0, 1fr)` viewport and footer. This specificity is required: the generic `.dialog` rule
in controls.css loads later and would otherwise override display:grid. The body is a single block
scroll viewport with horizontal scrolling disabled, overscroll contained on both axes and native
scroll anchoring disabled. The stack has min-height:100% and islands flex:none, preserving the
Misc spacer without resizing cards during scrolling. Clipped the Major glass body so invisible
filter bounds stay out of outer overflow. Existing island edge morph/blur/rims remain. Native
wheel/touchpad/keyboard behavior is retained, with no custom scrolling animation or wheel handler.

Verified after the specificity fix: production build / typecheck pass; full npm run check passed
before that final selector correction (Rust unaffected). Existing >500kB bundle advisory remains.
Live checks covered Visuals/Data/Misc at 540px and temporary 380px shell heights, six scroll positions
per combination: body/shell/title/footer positions, card/content height and scroll range stayed
constant. Only the body was scrollable when needed; shell overflow and horizontal overflow were
zero. Focusing a control never shifted the shell. Temporary heights were restored. Native wheel
and an additional large wheel input at the bottom kept shell Y=105, viewport Y=207 and the account
list at scrollTop=2339; Settings clamped to its 49px range. Lab snapshot matched before/after.
Screenshots inspected; glass sampling and edge morph retained. No app/lab settings or account data
were edited. Temporary diagnostic wheel listeners/logs were removed. The user's window height
changed during the investigation; it was not reset. Subjective feel beyond these controlled checks
still depends on the user's actual input/interaction if they report a remaining jump.


Latest request: replace sentence-derived text IDs, proofread the user's edits, simplify Settings,
add a group-deletion line break and prevent horizontal scrolling during Banned status selection.
Implemented: renamed 366 IDs throughout the catalog, TypeScript, Rust and tests to stable feature /
message roles (e.g. `settings.credentialButtons.label` and `.description`). Catalog now has 582
entries; existing short semantic action IDs, country labels and fixed rank identifiers remain valid.
Separate contextual labels for lab window chrome / row plates avoid sharing strategy-specific IDs.
No migration aliases: all current references were updated and validated. Editing wording never
requires renaming an ID. EDITING-TEXT and CLAUDE document this convention.

The user's current values were carried forward, with targeted grammar/casing corrections:
account/clipboard/accent nouns use normal English lowercase, UI labels use sentence case, and
RankDB/Discord/SMS/BattleTag keep their proper casing. Their customised empty-group, privacy,
rank-effects, 6v6, clipboard and Discord descriptions remain. Clarified the reset description as
covering all accounts. No button labels have trailing ellipses, including busy states; ordinary
non-button loading statuses retain them.

Removed the UI-scale description and its catalog entry. Removed Appearance, Accounts (Data rank
reset), Clipboard and Integrations island headings and the now-unused text entries. Columns,
Credential protection and Privacy headings remain. Delete-group confirmation now has an explicit
line break after the question; the next line reads “The accounts won't get deleted with it.”
The group name stays bold, and the question's punctuation is a separate semantic text entry.

Reproduced the horizontal-scroll bug in Account info's Details form: the Banned status pill's
invisible pre-blur/filter overscan added 11px at rest / up to 15px during the spring transition.
Clipped only the liquid pill's decorative body with `overflow: clip` (preserves backdrop sampling)
and added `overflow-x: hidden` to the form while keeping vertical scrolling. Shared control fix
also contains overscan in Settings tabs. No masks or opacity added above glass filters.

Verified: `npm run check` passes (582 entries/references/placeholder sets, TS/Vite, Rust MCP
feature). Three text tests, seven credential frontend tests, eight toast adapter tests and all
15 Rust tests pass. Existing >500kB bundle advisory and incremental hard-link warning remain.
Live MCP: 252 samples over six rapid status changes had zero form overflow and zero scrollLeft
even when explicitly requesting horizontal scroll; pre-blur still computed to 5px. Banned pill
screenshot inspected. Checked revised Settings copy/headings and no label overflow; group question
and explanation had distinct line positions (20px apart). No console errors observed. Status changes
were unsaved drafts and discarded; deletion confirmation was closed without deleting anything.
No app/lab settings, credentials or clipboard were changed by automation; lab snapshot matched.
The user was also using the app during validation; do not restore stale UI/preferences over their
concurrent work. One-time key migration script removed after use.


Latest request: edit all interface wording by hand from one file. Implemented a shared English
catalog at **`src/text/strings.json`** (584 entries), grouped by screen/feature. Settings labels,
headings, descriptions, buttons, accessible labels, toolbar/account/group menus, dialogs, rank and
country display labels, toasts, clipboard copy, What's New, Discord presence, lab controls/presets
and authored Rust errors now use it. `docs/EDITING-TEXT.md` explains editing values, placeholders,
shared entries, fragment spacing, live rebuilds and installed builds. README links it.

Architecture: typed frontend `uiText` lookup with literal named interpolation; `rankName` keeps
editable labels separate from persisted RankTier IDs / image keys. Rust `text.rs` embeds the same
JSON (OnceLock) and formats placeholders in one pass. No data schema changes, runtime language
selector, translation dependency or user-data editing. System/library error details and native
product/installer metadata remain external. Catalog edits trigger Vite updates and desktop
rebuilds via Cargo's watch directive / Tauri additionalWatchFolders; installed builds need rebuilding.
Preserve user edits to this catalog. See the new interface-text rule in CLAUDE.md.

Validation: `npm run check` passed (584 catalog references/placeholder sets, TypeScript, production
build, Rust MCP-feature check; existing >500kB advisory; bundle ~540kB / 171kB gzip). Three new text
regressions pass (editing labels/rank names with fixed stored IDs, literal interpolation, missing
entries/values); eight toast and seven credential frontend regressions pass. All 15 Rust tests pass,
including two new shared-catalog/interpolation tests. `check:strings` additionally rejects raw JSX
copy and literal accessibility/label attributes; added to `check`. It uses the already-installed
Rolldown parser, now explicitly pinned as a dev dependency (1.2.15; lockfile root updated to match
its existing package entry; offline npm metadata was unavailable, no installed packages changed).

Live MCP: attached to the existing app. Temporarily changed only one catalog label to
“Credential buttons [copy check]”, observed the new text rendered, then restored that value with a
concurrent-edit guard. Final DOM has original labels and no catalog-key leaks; Settings Visuals
screenshot inspected, labels/descriptions fit. Data and Misc copy/width checks also passed; test-opened
Settings closed afterwards (it was closed before testing). No account/credential/clipboard/encryption action or
settings/lab mutation was performed. Lab state exactly matched before/after the copy edit. No
console errors observed. This is a source catalog, not an installed-app text editor; longer user
wording still needs a visual fit check.


Latest request: remove notification action buttons and Clear notifications. Done: removed the
Sonner action mapping/API, Clear-all UI and styles, button design controls/persisted schema fields,
and the lab action example. Countdown preview remains, with no button. Individual X dismissal,
swiping, deadlines, existing glass tuning and the three-card spam cap remain. Notifications now
sit directly at their configured bottom inset (no 40px clear-control space).

Season-reset confirmation is now a normal short success toast with no Undo action/countdown.
Past ranks remain saved and inspectable. The underlying undo command/helper is retained for a
future UI but is not currently offered as a notification action. Feature docs/What's New updated.

Validation: npm run check passed (existing >500kB advisory), eight adapter tests pass (removed the
obsolete action-execution test, kept burst/deadline/dismiss/error-priority coverage). Live mixed
stack screenshot inspected: zero action buttons / zero Clear notifications controls, three X
buttons, configured 17px bottom inset and existing 18px corners/Major material retained. Removed
button settings are ignored when loading older lab files. No real reset, account/settings edits or
clipboard writes were performed. Test previews cleared; other user tuning was not reset.

Latest correction: the user wanted the toast appearance from **before the lab controls** restored.
Reset only saved `LabState.toasts` to `DEFAULT_TOASTS`, keeping the controls and all other lab/app
settings intact. The custom 18px blur / 0px pre-blur / stronger rim/tint was the visible difference.
Toasts again follow shared Major: 37px blur, 6px pre-blur, 23px corners, original tint/rim/full overlay
shadow, 18px bare icons, 12×16px padding, 26px pill actions and 320/160ms motion. Live computed styles
and mixed-stack screenshot checked; persisted values confirmed and only test previews cleared.
No source/runtime logic changed, so no additional build or test run was needed for this settings reset.

Latest request: add notification design controls to the UI/Glass Lab. Implemented a **Toast
notifications** section just after Glass strategy, with live controls for corners, icon size/stroke,
title/detail contrast, action-button corners/fill, right/bottom insets, animation speed and shadows.
Toasts follow shared Major by default; uncheck that option (or change their corners) to customize
their own Major recipe: blur, pre-blur, saturation, brightness, tint, rim and radius. Other Major
surfaces remain unchanged. `LabState.toasts` persists/normalizes, with `DEFAULT_TOASTS` preserving
the previous appearance for existing saved files.

Implementation: `engine.ts` writes toast-specific CSS variables and paints private-material rims;
the actual Glass component, portal and Sonner lifecycle remain intact. Geometry of the content/icon
wells stays fixed, avoiding stale Sonner height measurements during design edits. Material fades
stay within Sonner's 200ms node-removal budget (speed 80–200%). `toastPreview.ts` adds harmless real
adapter previews, available through the panel or `__lab.previewToasts(kind)` / `clearToastPreviews`.
Previews include success, error, action/countdown, mixed three-card stack and 20-event burst;
clearing previews only dismisses their own IDs. No clipboard or account action is triggered.

Verified: `npm run check` passed (existing bundle advisory ~512kB / 163kB gzip); nine toast adapter
tests pass. Live screenshot inspected for default and custom material. Custom toast blur 18px,
12px corners, icon/button styling, insets and 160% speed applied while header blur stayed 37px.
All three existing toast heights stayed identical during tuning; exact rims changed with their
recipe. A custom pre-blur remained enabled while shared Major pre-blur was off. Saving to the real
lab settings file was verified. Burst left only previews 18–20; the sample action produced only
"Preview action clicked". No account/clipboard operations were performed.

The user was adjusting the controls during validation. A test snapshot reset briefly overwrote
those edits; recovered the preceding React snapshot (17px icons, 17.5px corners, 80% title contrast,
2px icon stroke, 13px action corners, plus the other current values), undoing the test-only pre-blur
override. The recovered tuning was reapplied rather than leaving defaults. The original non-toast
lab state was restored after temporary material checks. Do not reset their toast choices in future
automation: take a fresh snapshot immediately before a test and preserve any concurrent user edits.
Preview notices cleared; no application console errors observed.

Latest user scope change: **mandatory one-time legacy decryption**, followed by plain storage,
then optional master-password encryption in Settings. The user also removed backup/history and
export/import features for now. This supersedes prior notes allowing continued legacy operation,
backup portability or recovery via imports. See CREDENTIAL-ENCRYPTION.md for the current design.

Implemented:
- Startup reads protection status before roster initialization. Legacy mode shows the required
  LegacyDataMigration dialog; background app is inert and aria-hidden, normal overlays/lab are
  unmounted, and app services wait. Exit remains possible; Escape/scrim/close cannot skip it.
- Database.lock rejects all normal DB commands while legacy. Status and settings reads use a raw
  lock; migrate_legacy_credentials is the only production command that reads the old DPAPI key.
  Startup no longer reads it. Missing keys/corrupt fields stop migration without overwriting data.
- Legacy → plain converts every field plus metadata in one transaction, then compacts the DB/WAL.
  Retries are idempotent. Direct legacy → password and legacy disable/unlock bypasses are blocked.
  Afterwards the DB works without its old Windows key; master encryption is a separate Settings step.
- Removed DataDialogs.tsx, transfer/portable/legacy/backup Rust modules and all their command
  registrations. Removed pending-import state, automatic daily snapshots, pre-update backup calls,
  file-dialog plugin/dependency/permissions, Credential Manager feature, backup list styles and
  transfer-only helpers. Settings → Data contains Credential protection and Accounts/rank reset.
  What's New, README, CLAUDE/PLAN/NOT-CARRIED-OVER were updated to the current scope. Old recovery
  files on disk are preserved; no deletion of the user's keys/backups was performed.
- Generic Dialog gained dismissible=false for required migration. Existing dialogs default to
  normal close behavior. App services start once; migration loads the roster strictly before
  clearing the required screen.

Validation:
- Rust tests: **13 pass**, including required migration, blocked normal connection access, missing
  key, no direct password bypass, whole-conversion rollback/retry, removal of the fixture Windows
  key followed by plain/password restarts, and existing master-password/field-binding checks.
  Tests for removed transfer/backup functionality were removed with those modules.
- Frontend credential-flow tests: **7 pass**; toast tests: **9 pass**. `npm run check` passes with
  the existing >500kB chunk advisory (~506kB / 161kB gzip); no Rust compile warnings.
- Live UI: previewed the actual migration component by temporarily publishing a frontend-only
  legacy status, then restored the backend's real status. Verified background inert, no close
  button, Escape/scrim do not dismiss, primary focus and Major-glass screenshot. This did not alter
  database protection or credential values. The real app now reports plain, migrationRequired=false;
  migration was not invoked against live data by automation during this pass.
- Final Settings → Data screenshot inspected: only Credential protection and Accounts remain.
  Read-only negative IPC checks confirmed list_backups, legacy_install_available and export_data
  are unregistered. No console errors observed. Left Settings → Data open for review.
- Saved-data checks: still 47 accounts / 5 groups. Canonically sorted hashes of roster, app settings
  and lab state match the start-of-change snapshot exactly. No credential values were returned to
  automation and no clipboard operations were performed. The mode changed from legacy at the start
  of the pass to plain in the running app; current state was observed rather than inferred.

Earlier entries below are history; the scope and protection design above take precedence.

Latest fix: Settings glass islands were glitching while scrolling Data. Reproduced two concrete
causes: filter overscan changed Data's scrollHeight between 874 and 881px as slices changed (the
bottom clamped in multiple jumps), and exact canvas rims used integer offsetHeight while body/
content slices used fractional rects (e.g. 24.75px body versus a rim painted from 24.375px).

- `dialogs.css`: clips only each island's filter body with `overflow: clip`. Filter overscan no
  longer contributes to scroll extent; separate shadow/rim siblings remain outside that clip.
  No opacity/mask/clip-path ancestor was added over the filters. Added overscroll containment.
- `scrollEdgeMorph.ts`/`engine.ts`: send fractional width/height/radius measured before writes to
  the rim painter; cache geometry for subsequent resize repaints. Include geometry in the slice
  key so whole-card resizes repaint too. Lab-triggered repaints still read the current radius.
  Skip zero-geometry measurement while the warm-mounted Settings dialog is hidden.
- `SettingsDialog.tsx`: each tab gets a fresh scroll viewport rather than inheriting Data's old
  scroll position. Reset the opening tab in a layout effect, preventing an old-tab opening flash.

Verified in the existing Tauri app: Data scrollHeight stayed **874px** throughout a 100-frame
up/down scroll sweep, with zero body-boundary violations and zero canvas backing-size mismatches.
Visuals and Misc were also scrolled; tab switches started at zero. Closed/reopened from Data's
bottom: the first five sampled opening frames showed Visuals at scroll zero with all three islands
visible. Inspected screenshots at partial slices, the bottom of Data and a 736×600 viewport;
dialog fit with 30px top/bottom margins. Restored the original 736×1151 client / 752×1160 outer window
and position (130,133); lab tuning/position checked unchanged. Left Settings → Data at the top.
No saved account/settings edits or clipboard operations. `npm run check` passes (existing >500kB
bundle advisory); no console errors observed. These checks cover the reproduced scrolling defects,
not a claim that every possible Settings state is visually bug-free.

Latest request: replace mandatory Windows-bound credential encryption with **optional encryption**.
The user chose a **user-chosen master password**, protecting **email and password fields only**.
Implemented; the durable design is `docs/CREDENTIAL-ENCRYPTION.md`. This supersedes earlier DPAPI
architecture notes below. Fresh installations are plain by default; existing data is never silently
decrypted or discarded.

Backend:
- Added schema migration 4 and `credential_security.rs` (`plain`, `password`, `legacy`). Existing
  credential values migrate to explicit legacy mode; empty/fresh databases are plain. Production
  no longer generates `data.key`; a missing/unreadable legacy key allows startup and ordinary
  account use, with credential operations blocked and an explicit recovery explanation.
- Optional AES-256-GCM field encryption uses a random key wrapped with a master-password-derived
  key (PBKDF2-HMAC-SHA256, 600k, random salt; authenticated versioned envelope in SQLite). Password
  mode starts locked after restart. Unlock/lock/change/disable commands are registered in debug
  and release. Changing/disabling verifies the current password even while unlocked.
- Conversions are transactional with metadata and serialized against credential writes/imports/
  restores. `secure_delete`, checkpoint/VACUUM/checkpoint clean obsolete current database pages.
  Cleanup failures explicitly report that protection has already changed. AES-GCM zeroize feature
  and pinned `zeroize` 1.9.1 (already in the lockfile) clear key/password buffers on drop.
- Backups carry the protection metadata and validate it before restore commits; password restores
  start locked and need the password in effect for that backup. Existing DPAPI key files and old
  backups are retained. Portable exports remain fully password-encrypted independently of local mode.
- Locked imports cannot mutate data. A missing legacy key permits only explicit Replace recovery
  from an independent export, with the normal before-import backup; recovered storage is plain.
  Add remains blocked, and failed recovery rolls back fields and metadata together. Prepared imports
  survive apply failures and are discarded on manual lock.

Frontend:
- Settings → Data has Credential protection with Enable/Use master password, Unlock/Lock now,
  Change password and Turn off. The shared glass dialog validates confirmation/minimum length,
  prevents duplicate submission/closing during work, reports inline errors and clears form values.
- Credential copy/edit and export/import prompt then resume, with cancellation preventing the action.
  An older status response cannot overwrite an explicit lock/unlock result. Missing-key errors close
  the credential editor instead of leaving an empty loading form. Non-warm Dialog content is released
  after exit, and export/import password state clears on close.
- The UI explains that other account fields stay plain, forgotten master passwords have no reset,
  and historical backups retain their original protection (including old plaintext copies).

Validation:
- `npm run check` passes (TypeScript, Vite, Cargo with MCP feature). Existing >500kB chunk advisory
  remains (~514kB / 163kB gzip); no new compile warnings.
- `cargo test --manifest-path src-tauri/Cargo.toml --features mcp-development --locked`: **20 pass**.
  Isolated fixtures cover fresh plain mode, enable/restart/unlock, wrong passwords, field binding,
  disable/password change, corrupt-field rollback, damaged metadata, missing keys, locked imports,
  resealing imported account IDs, failed/successful recovery import, legacy schema/key conversion,
  portable password backup/restore and the existing transfer/portable/clipboard-menu tests.
- `npm run test:credentials`: **7 pass**, isolated Node VM with fake IPC/dialogs: no prompt for plain
  data, shared concurrent unlock, resume/cancel behavior, missing-key recovery, stale-status race,
  IPC failures. Node prints experimental VM/type-stripping notices for this test harness.
- `npm run test:toasts`: **9 pass**.
- Live MCP inspected Settings → Data and the actual Major-glass enable dialog, autofocus, disabled
  empty/mismatched submission, mismatch feedback, cancel returning to Settings and input DOM removal
  after exit. No real enable/disable/password change was performed against the user's data.
  Password-mode cryptography and prompt/resume logic were checked separately with isolated Rust/
  frontend tests; the complete password-mode form workflow has not been exercised end to end.
  No independent cryptographic audit or signed-release validation performed.

User data safety: before Rust changes, created the live recovery backup
`rankdb-20261030-115857-manual.sqlite3`. The existing app still reports `mode: legacy`, unlocked,
original key available. There are 47 accounts and 5 groups. No credential values were read into
automation, and no live account edits, clipboard writes or lab/settings changes were made. The dev
watcher rebuilt/restarted the app for Rust edits; the final frontend was reloaded. Choose Use master
password or Turn off in Settings to explicitly convert the existing dataset. Never delete `data.key`:
old legacy backups may require it.
Roster and lab-state hashes matched across the final reload; app settings matched after sorting
their keys (Rust HashMap serialization order varies). Left the app on Settings → Data for review.

Latest tweak: removed toast icon circles/background/inset shadow, narrowed the icon column to 20px,
reduced card padding to 12px vertical / 16px horizontal, row gap to 7px, title/detail gap to 3px and
action height to 26px. Entrance/reflow transform duration is now 320ms (from 400ms), material fade
and swipe exit 160ms (from 200ms): 20% shorter. Removed Sonner's secondary opacity transition from
glass-free content so it follows inherited presence without lag. Major material remains unchanged.
`npm run check` passed with the existing size advisory; live computed styles confirmed no icon
background/shadow and the shorter durations. Screenshot inspected; preview notices cleared.

Latest design request: use real Major glass for notifications and polish their internal layout.
`ToastStack.tsx` now portals the existing `<Glass role="major" floating>` into each Sonner card as
an absolute decorative layer. A MutationObserver tracks Sonner's actual mounted cards; portals add
no layout height and clean up their rim registrations when cards disappear. The adapter supplies
stable `testId` values for portal identity. No lifecycle/queue business behavior changed.

Crucial glass integration: Sonner's outer `li` opacity is held at 1, with transparent background and
no filter; mounted/visible/removed states transition inherited `--presence` instead. The normal
Major glass layers fade their own tint/rim/shadow/blur, and text/icons/buttons fade independently.
This prevents an opacity backdrop root from destroying the blur during entrance/exit. Actual shared
Major material now supplies pre-blur, blur, saturation/brightness, tint, 23px radius, exact canvas-
generated cached rim and overlay shadow. This replaces the previous approximate opaque dark styling.

Layout: 30px icon well, flexible text column, dedicated 24px close column; action pill on a separate
row under the message; accent countdown track clear of the corners. Titles cap at two lines, long
details scroll, with a viewport-height budget allowing three tall actionable cards at 600px. The
Clear notifications control also uses Major glass. Styling is in `styles/controls.css`.

Validation: nine adapter tests and `npm run check` pass (same existing bundle-size advisory). Live
MCP confirmed Major/native mode, real 37px blur plus 6px pre-blur, cached exact rim, and partial glass
presence on entry/exit while ancestor opacity stays 1. Screenshot of success/info-with-Undo/error
cards inspected. Long-text geometry confirmed text clear of close, action below details, scrollable
message; at a temporarily resized 736x600 viewport, all three long actionable cards fit (topmost
top ~37px). Window restored to 736x1163, previews cleared, no toast-related console errors. No saved
settings/data or clipboard contents changed. Prior implementation notes below are superseded.

Latest implementation: the user said "try sonner then". Installed pinned `sonner@2.0.8` (npm
publication 2026-08-09 satisfies the two-week rule). The real Sonner `Toaster` now owns notifications:
expanded by default, three visible, bottom-right, close/swipe, stock interruptible motion and measured
reflow. A Clear notifications button sits below the stack. RankDB colors, typography and native
backdrop material style the animated `li` directly, avoiding nested Glass under Sonner's opacity.

Replaced the custom store/queue/400ms merging/ToastItem presence with a small adapter preserving
`showToast`, `showError`, numeric IDs and copy helpers. Each action gets a new card. Three active
records maximum; a microtask batches synchronous floods before publishing to Sonner, retaining only
recent routine feedback and protecting actions/errors first. No waiting queue. Ordinary timers are
Sonner-owned; real clipboard/Undo deadlines use adapter timeouts plus Sonner Infinity, so hover never
extends an actual deadline. Earlier clipboard countdowns become brief superseded confirmations.
Removed the obsolete custom toast styles and TOAST_PRESENCE token. Package and lockfile updated.

Validation: nine rewritten adapter tests pass (`npm run test:toasts`); `npm run check` passes. Vite
now emits its advisory for a >500kB main chunk (about 507kB minified / 161kB gzip; Sonner added about
10kB gzip). Live MCP verified partial-opacity/transformed entrance, removed/fading exit, three fully
expanded cards, a 1000-event burst leaving only three Sonner nodes, hover pause/resume for ordinary
notices, absolute timed expiry during hover, and an Undo double click calling its action once.
Mixed success/error/Undo screenshot inspected; no Sonner-related console errors. Preview notices
cleared; no account data, saved settings or clipboard contents modified. Earlier implementation notes
below are history and are superseded by this Sonner section.

Latest request: research established application notification patterns. See `TOAST-REFERENCES.md`
for primary sources (Sonner author, Adobe Spectrum, VS Code, Google Material, GitHub Primer) and the
proposed RankDB direction: Sonner-style expanded three-card stack with interruptible motion and less
stale routine replay. These are recommendations; this research changed documentation only. No source
implementation, data or settings were changed, and no new runtime verification was needed.

Latest correction: the user reported only one static notification for all clicks. The global
`key: "clipboard"` policy was too broad and the previous synthetic spam checks missed normal action
behavior. Fixed: event keys include account/field, and merge matching requires identical content,
tone, timer/duration AND a repeat within 400ms. Ordinary repeated clicks outside that window get
separate cards. A merged burst animates a small content nudge; new cards use a 56px glass entrance
and animate out. Only the latest copied secret keeps a live countdown: `finishToastTimer` preserves
the older confirmation briefly with "Clipboard updated again." and a 1.6s lifetime.

Verified through the live copy module's safe missing-credential paths (no clipboard writes): three
normal email/password/email clicks produced three cards; observed `showing` and `hiding` transforms
and intermediate presence values. A two-click burst produced one count-2 card with an active body
animation. All previews cleared. `npm run test:toasts` now has 12 passing tests (including normal
repeat clicks, different actions sharing a key, and account-specific privacy-safe identity), and
`npm run check` passes. No saved data/settings or clipboard contents changed.

Earlier work: polished notification lifecycle, appearance and burst handling. `ui/toasts.ts` now caps
the mounted set at three cards, including exits, and pending at eight. Repeated non-action notices
merge with a count (now limited to rapid bursts as described above). Queue priority: actions, errors,
warnings, routine notices. Overflow drops oldest entries
of the lowest priority; queue freshness is 6s for routine notices and 15s for errors/actions, capped
by any real deadline. Timed notices retain original expiry while queued. Clear all discards pending
before animating exits; idempotent dismissal and fallback cleanup prevent stuck hidden-window exits.
Ordinary lifetimes pause independently for pointer/focus/hidden states; clipboard and Undo deadlines
never pause. Store-level action activation prevents double execution and rejects expired actions.

`ToastStack.tsx` uses measured absolute outer slots with transform transitions for smooth reflow,
separate from glass presence. The compact queue/Clear all control fades in/out. Cards have round
corners, repeat-count pills, bounded long text, accessible dismiss names and reduced spatial motion
when requested. Timer delay is memoized per revision so unrelated renders cannot accelerate it.

Validation: `npm run test:toasts` (10 tests) and `npm run check` passed. Live tests: 1000 repeated
events produced one card/count 1000; 100 distinct events produced three cards/eight pending; Clear all
left zero cards/queue with no replay. Measured intermediate stack positions confirmed animated reflow.
A 4s countdown remained accurate through unrelated renders (scale 0.753 to 0.737 over ~60ms).
Mixed success/error/Undo screenshot inspected; no toast-related console errors. All previews cleared.
No account data, clipboard contents or saved app/lab settings were changed for these tests.

Previous follow-up: the picker now shrinks toward the badge's current viewport position when scrolling
triggers dismissal, and follows further scrolling during the exit. `PickerTarget` retains the badge
element; presence channels read its live rectangle each animation frame, with the opening rectangle
as fallback when no connected badge exists. Picker placement and the three-row threshold are unchanged.
`npm run check` passed. Live checks verified upward/downward target motion, including additional
scroll during exit, at 100% and 120% UI scale. Test scroll position and lab/UI scale were restored;
no account edits were made.

After the initial repository analysis, the user requested six UI changes, now implemented:

- Captured the live lab visual tuning as defaults in `src/lab/store.ts` and `DEFAULT_TUNING` in
  `src/glass/recipes.ts`. Original TaskMap presets remain intact. Fresh/Reset values match the
  captured scene, materials, picker, dummy count/seed and collapsed panel; panel coordinates remain
  automatic instead of copying machine-specific coordinates. Existing saved values still load.
- Hidden credential buttons give `.row::before` a 13px radius; showing them restores the lab radius.
- `RankBadge` only replays change FX when tier/division/predicted appearance changes, not placements.
- `ContextMenu` uses `primitives/menuAim.ts` for a directional triangle corridor on either side;
  sibling hover waits at most 350ms during diagonal transit, cancelled on submenu entry or explicit
  click/keyboard selection. Timers clean up on close, reposition and unmount.
- `RankPicker` closes/cancels after scrolling three row pitches from its opening position (210px
  at current layout). The passive scroll listener is installed only while open.
- Header/rail actions have circular hover/focus highlights; role-sort controls have pill highlights.

No dependencies or backend behavior changed. Live testing used the unsaved dummy roster, cancelled
draft edits, and restored lab state, app settings and scroll position in `finally` blocks. No saved
accounts or credentials were edited.

Validation for these changes: `npm run check` passed. Six pure pointer-corridor cases passed (both
directions, away movement, vertical departure and stationary pointer). Live checks confirmed 13px
with credentials hidden / 25px shown; placement progress changed without replacing the badge image
or adding animation nodes; picker remained open after two rows and closed after three. Submenu
transit retained Games Dodged on both sides, including entry into the submenu, while explicit clicks
switched immediately. A screenshot was inspected for the restored main layout.

Vite serves timestamped module URLs after HMR. When testing through dynamic imports, import the
actual loaded URL from `performance.getEntriesByType('resource')`; a plain source URL can create an
independent module/store instance and produce misleading results. Initial checks with independent
instances were discarded and rerun using the live module URLs.

Read `../CLAUDE.md` for the detailed project contract. `../AGENTS.md` points Codex at that same
contract. Keep this file current from either assistant so chat history is not required to continue.

## Actual project stage

This is a functional desktop rewrite, beyond the original dummy-data Glass Lab. Plan phases 1-6
are marked complete; phase 7 (polish/release) remains. Rank badge effects are already implemented.
The selected design is Shell rows with native glass overlays and TaskMap motion/primitives.

Implemented features include SQLite accounts and app settings; rank editing and placements;
credentials and clipboard protection; groups, ordering and statuses; season resets/history;
password-encrypted exports, legacy imports and database backups; updater gating and Discord presence.
Implementation inspection is not an end-to-end verification of every feature.

## Architecture map

| Area | Entry points and responsibilities |
|---|---|
| Startup | `src/main.tsx`: load lab/settings/roster, start glass engine, synchronous first render, fit/show window, start services |
| Frontend data | `src/data/accounts.ts`, `rosterStore.ts`, `settingsStore.ts`: typed records, external stores, optimistic edits, settings persistence |
| Backend | `src-tauri/src/main.rs`: command registration/plugins; `db.rs`: SQLite, validation, transactions, four migrations tracked by `user_version` |
| Data protection | `credential_security.rs`: optional master-password vault and legacy migration; `secrets.rs`: AES-GCM primitive/legacy DPAPI reader; `clipboard.rs`: protected Win32 clipboard/conditional clearing |
| Data transfer | Removed/deferred by request; no active export/import/backup modules or commands |
| Materials | `src/glass/`: material resolution, CSS-variable engine, cached/live rims, baking, scroll-edge morphs |
| UI/motion | `src/ui/`, `src/ui/primitives/`: app actions/dialogs, reusable controls, direct DOM motion |
| Window behavior | `src/platform/window.ts`, `resize_edges.rs`, `webview_browser_features.rs`: fitted width, vertical resizing, browser features disabled |
| Lab/profiling | `src/lab/automation.ts`, `perf.ts`, `scripts/bench.mjs`: `window.__lab`, frame-pacing benchmarks and CDP |

Keep Tauri-only behavior, exact dependency pins, existing primitives and performance constraints.
Do not introduce browser fallbacks, maximize/horizontal resizing, theme editing or rank refresh.

## Running app and MCP access verified

Connected successfully to the existing app; no restart was needed:
- Bridge: `127.0.0.1:9223`.
- Identifier: `com.merkdesigns.rankdb.next.dev` (the MCP config overrides the base identifier).
- Working directory: this checkout's `src-tauri`.
- Main window: visible, title `RankDB`, serving `http://127.0.0.1:5180/` in WebView2.
- Bridge plugin 0.13.1; MCP server 0.13.2; session reported no version warning.
- Verified window listing, header accessibility snapshot, native screenshot, console log reading,
  JavaScript execution and presence of `window.__lab`.

For a new session, use the available Tauri MCP `driver_session` with `action: "start"`, host
`127.0.0.1`, port `9223`. Then use DOM/screenshot/interaction/log/JS tools as needed. If the app is
not running with the bridge, launch only via `npm run app:dev:mcp` (or `app:profile` for CDP on 9333).
The installed release-built RankDB Dev has no bridge. MCP connection state does not transfer between
assistants; repository notes and the running app do.

No lab automation mutations, account edits, clipboard operations or benchmarks were performed.
For future lab changes, snapshot `__lab.state()` and restore with `await __lab.set(snapshot)` in a
`finally` block; restore any other app setting separately. Benchmarks need a visible, uncovered
window and a matching machine/window/DPR/refresh environment, including an Off baseline.

## Validation on 2026-10-30

- `npm run check`: passed (TypeScript, Vite production build, Cargo check with MCP feature).
- `cargo test --manifest-path src-tauri/Cargo.toml --features mcp-development --locked`: passed,
  8 tests. Coverage includes encryption/binding, portable formats, legacy conversion/import round
  trip, backup filename parsing and browser context-menu filtering.
- Live app rendered and exposed its expected header controls and lab automation API.
- Console contained an earlier Vite reload error for `src/ui/primitives/Slider.tsx` at
  08:59:07 UTC. That file is absent from the current source tree; the current build passes. The
  historical log alone does not establish a current defect.
- Not performed: full UI workflows, release installer/update validation, benchmark matrix, or
  systematic accessibility/security audit. Existing tests do not cover most command behavior,
  overlapping frontend edits, modal focus or complete backup restoration.

## Open findings and suggested order

These are code-inspection findings, not fixes made in this pass. Reproduce with isolated fixtures
before changing data behavior; keep tests away from the user's live database.

1. **Legacy app-setting migration is blocked by startup metadata.** `db.rs:148` inserts
   `installedOn` before the frontend loads settings; `load_settings` returns it. The migration
   branch in `settingsStore.ts:121` requires the entire returned object to be empty, so an old lab
   file's app settings cannot migrate through that branch on a normal successful startup. Use an
   explicit migration marker or check relevant app-setting keys, accounting for existing values.
2. **(Fixed 2026-10-31: FIFO command queue + reload-when-idle in rosterStore.)** **Overlapping optimistic mutations can clobber newer state.** `rosterStore.ts:281` and `:468`
   apply returned whole records or roll back to captured previous records without mutation
   sequencing. Delete/move paths (`:374`, `:558`) can publish a whole captured/returned roster.
   Delayed responses, failures, or switching between saved/dummy sources while a command is in
   flight can overwrite newer frontend state. Evaluate serialization/reconciliation and source
   generation checks with controlled delayed promises.
3. **Pending settings writes can race with Replace/restore.** `settingsStore.ts:131` calls
   `flush()` then loads settings without awaiting `saveChain`; `DataDialogs.tsx` invokes it after
   backend replacement. Previously queued edits may write over restored/imported values. Coordinate
   pending writes with replacement before issuing the backend operation, then reload its result.
4. **Modal keyboard accessibility is incomplete.** `primitives/Dialog.tsx:45-58` focuses on open
   and handles Escape, but has no Tab trap, background inertness or restoration of the opener's
   focus. `aria-modal` alone does not implement those behaviors. Verify Settings and other dialogs
   with keyboard navigation, including warm-mounted/closing states.
5. **Release lab removal is still pending.** `App.tsx:67` always mounts `LabPanel`; `main.tsx:30,36`
   always loads lab settings/installs automation. Lab commands are registered in both backend build
   variants. The MCP plugin itself is correctly gated to debug + feature, and dummy replacement is
   debug-only. Phase 7 still needs chosen material constants and removal/gating of release lab UI,
   persistence and automation; do not simply hide the panel and call that complete.
6. **Release setup is unfinished.** Version is 0.0.0, base bundling is disabled, and the dev
   installer explicitly disables updater artifacts. Follow phase 7 for final version, installer,
   signed updater artifacts and channel verification; release publishing was not requested.

## Documentation and repository state

- The README introduction and CLAUDE.md phase header were refreshed in this pass; old benchmark
  results in README remain historical and are not a recommendation for today's implementation.
- Some older documentation still drifts from source: `NOT-CARRIED-OVER.md` describes obsolete UI
  scale controls, calls Move To a section instead of the implemented submenu, and lists completed
  data/services features as unbuilt. `PLAN.md` contains old references to LabState app settings,
  `schema_version`, role-sort cycling and exclusively in-memory dev seeding. Read current source
  and CLAUDE.md alongside these until reconciled.
- Git: branch `rewrite`, pushed to `origin` = https://github.com/MerkDesigns/RankDB (public; the
  old app is `main` there, so the histories are unrelated). Commit and push on `rewrite`; when the
  rewrite replaces the old app, merge or swap the default branch then.
