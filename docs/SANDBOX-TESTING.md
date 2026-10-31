# Testing installs and updates in Windows Sandbox

Windows Sandbox is a throwaway, clean Windows that is wiped when you close it. Every install and
update path can be tested there without touching the installed RankDB 0.3 or its data.

## Setup

1. Windows Sandbox must be on (Windows features → "Windows Sandbox"; already on for this PC).
2. `npm run sandbox:build` builds everything into `.sandbox/` (git-ignored):
   - the real RankDB 0.3.0 installer, downloaded from its GitHub release;
   - this checkout as **1.0.0** and **1.0.1** installers. These are the real release app, but
     their updater trusts a throwaway test key and checks `http://127.0.0.1:8765`, which only
     exists inside the sandbox;
   - `latest.json`, which offers 1.0.1 to 1.0.0.

   `npm run sandbox:build -- --fresh` rebuilds the 1.0.x installers after code changes.
3. `npm run sandbox:open` starts the sandbox. It opens the **RankDB test** folder on the sandbox
   desktop and starts the update feed in a minimized PowerShell window (leave it open).

**Never run the 1.0.x test installers outside the sandbox**: they would install over your RankDB.

Each scenario starts from a fresh sandbox: close it and run `npm run sandbox:open` again. The
sandbox doesn't share the clipboard with your PC; check it inside with `Get-Clipboard` in PowerShell.

Useful folders in the sandbox: the app is installed in `%LOCALAPPDATA%\RankDB`, 0.3's data is in
`%APPDATA%\com.rankdb.desktop`, and the new app's data is in `%APPDATA%\com.merkdesigns.rankdb.next`.

## Old data for the 0.3 scenarios

Install `RankDB_0.3.0_x64-setup.exe` and create, in 0.3:
- a few accounts with ranks (one predicted), currencies, notes and a country;
- a group with two accounts, one collapsed group, an account marked banned;
- email and password on at least two accounts;
- a season reset (so there are past ranks), then new ranks on some accounts;
- a few changed settings (6v6 column off, UI scale 110%, privacy mode).

Then close 0.3.

## Scenarios

### 1. 0.3 → 1.0, installer run by hand
Run `RankDB_1.0.0_x64-setup.exe` normally.
- [ ] It installs over 0.3: one RankDB in Apps & features, in `%LOCALAPPDATA%\RankDB`.
- [ ] First start shows "Migrated from RankDB 0.3" and every account, group, rank, currency,
      note, country, status and past reset is there, in 0.3's order.
- [ ] Copying an email/password works; the settings from 0.3 carried over.
- [ ] `%APPDATA%\com.rankdb.desktop` is unchanged.
- [ ] Restarting doesn't migrate again; Settings → Data has no Migrate row.

### 2. 0.3 → 1.0, the way 0.3's updater installs
0.3's updater only reads the real GitHub release, so run what it would run, from a Command
Prompt in the RankDB test folder: `RankDB_1.0.0_x64-setup.exe /P /UPDATE`
- [ ] Installs without questions (passive) and the same checks as scenario 1 pass.

### 3. Manual migration
After scenario 1: delete every account and group, restart.
- [ ] No automatic migration; Settings → Data shows Migrate.
- [ ] Migrate brings the accounts back; the row disappears. With any account present it's hidden.
- [ ] With a master password on, Migrate refuses and explains; nothing changes.

### 4. 1.0.0 → 1.0.1, in-app update
Fresh sandbox: install 1.0.0, add a few accounts (credentials too).
- [ ] Shortly after start, the update to 1.0.1 is offered (the feed window logs `200 latest.json`).
- [ ] Edit a rank, then press Install at once: the app restarts as 1.0.1 with the edit saved.
- [ ] Copy a password, then install the update before the clipboard timer: `Get-Clipboard` is
      empty afterwards.
- [ ] With a master password on before updating: 1.0.1 starts locked and unlocks with it.

### 5. No update / feed down
Close the feed window (or start `serve.ps1 -Root "…\RankDB test" -Off`), start 1.0.0.
- [ ] No update dialog, no error toast, the app works normally.

### 6. Fresh install, no 0.3
Install 1.0.1 only.
- [ ] Empty list, no migration toast, no Migrate row; adding accounts works.

### 7. Everyday edge cases
- [ ] Edit something and close immediately (Alt+F4): the edit is there after restarting.
- [ ] Start RankDB a second time: the running window comes to the front, no second window.
- [ ] Uninstall: the app goes; the uninstaller's "delete app data" choice is respected.

Covered by Rust tests rather than the sandbox (`npm run test:rust`): a database from a newer
version refused untouched, a failing migration staying at its old version, upgrade copies
following every master-password change.
