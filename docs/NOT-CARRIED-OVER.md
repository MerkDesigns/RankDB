# Not carried over from the old app

Things the old RankDB (`../RankDB`) had that the rewrite deliberately leaves out or changes. Add an
entry whenever we decide not to copy something, so it isn't rebuilt by accident.

## Removed

- **Export/import and local backups** are deferred by request (2026-10-30). Removed the export,
  file import and restore dialogs, backup island/history, automatic snapshots and pre-update
  backups. Add them back only after a new request. Existing files are not automatically deleted.
  The installed 0.3 app's data is still migrated once, into an empty database only.

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

## Changed

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
  silently on start. There is no recovery-file/backup feature. Development builds never check.
- **Discord presence** reconnects by itself when Discord is started after RankDB.
- **Rank history** is only the season resets, all of them in one Account info tab (role icons over
  badge columns, a row per reset), instead of a dropdown of snapshots. Rank changes aren't logged.
  The toolbar shows past reset ranks; the newest reset can be undone there. Notifications have no
  action buttons or clear-all control.
- **Status** has three states (Clean, SMS, Banned) instead of a banned switch; SMS accounts get
  their own section above the banned one.
- **Role sorting** covers 6v6 too, and is never saved (a restart shows your own order).
- **Scrollbar** is a thin overlay that only shows while the pointer is over the window.

## Current scope

Clipboard auto-clear, rank reset, Discord presence and update checks are implemented. Export/import
and backup features are removed, not placeholders in Settings.
