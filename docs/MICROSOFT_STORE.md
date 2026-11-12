# RankDB in the Microsoft Store

RankDB has two ways to reach people, and they don't depend on each other:

| | GitHub | Microsoft Store |
|---|---|---|
| What people get | `RankDB_installer.exe` (our setup around the NSIS installer) | an MSIX package |
| Built by | `npm run installer:build`, `release.yml` on a `v*` tag | `npm run store:build`, `store.yml` on request |
| Signed by | our update key (updates only; the files aren't code-signed) | Microsoft, when the Store accepts the package |
| Updated by | the app's own updater (GitHub releases) | the Store |
| App identifier | `com.merkdesigns.rankdb.next` | `com.merkdesigns.rankdb.store` |
| Data folder | `%APPDATA%\com.merkdesigns.rankdb.next` | inside the package (see [Data](#data)) |

Nothing here submits or publishes anything. Uploading a package to Partner Center is always done
by hand.

## How the Store build differs

It is the same source and the same app. Three things are different, all decided when it is built:

- **Rust: the `store` feature** (`src-tauri/Cargo.toml`). The GitHub updater plugin isn't
  registered, `updates_enabled` is always false, and the first start copies the data of a RankDB
  installed from GitHub (`src-tauri/src/db/store_data.rs`).
- **Tauri: `src-tauri/tauri.store.conf.json`** gives it its own identifier, so its data folder,
  its WebView2 profile, its window position and its "one running copy" lock are its own. Both
  versions can be installed and even run at once without touching each other's files.
- **Frontend: `VITE_RANKDB_CHANNEL=store`** (`src/platform/channel.ts`). Settings → Misc has no
  "Check for updates" button, and the app never asks the updater anything.

`scripts/build-store.mjs` sets all three; there is no switch at run time.

## One-time setup

1. **A Partner Center developer account** at <https://partner.microsoft.com/dashboard>
   (an individual account is enough; check the current registration terms there).
2. **Reserve the app name** "RankDB": Apps and games → New product → MSIX or PWA app.
3. **Copy the package identity.** In the product: Product management → Product identity. Three
   values are needed, exactly as shown:

   | Partner Center | `store/identity.json` | Looks like |
   |---|---|---|
   | Package/Identity/Name | `name` | `12345Publisher.RankDB` |
   | Package/Identity/Publisher | `publisher` | `CN=00000000-0000-0000-0000-000000000000` |
   | Package/Properties/PublisherDisplayName | `publisherDisplayName` | your publisher name |

   Copy `store/identity.example.json` to `store/identity.json` and fill them in. That file is
   git-ignored. The same values can come from the environment instead
   (`RANKDB_STORE_NAME`, `RANKDB_STORE_PUBLISHER`, `RANKDB_STORE_PUBLISHER_DISPLAY_NAME`); for
   `store.yml` they are the repository's Actions *variables* of those names. They aren't secret
   (they are readable in every installed package), but they are yours, so they aren't in the repo.
4. On the build PC: Node 24, Rust and the Tauri prerequisites, as for any build. The winapp CLI
   Microsoft documents for this
   ([Using winapp CLI with Tauri](https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/guides/tauri))
   is a dev dependency (`@microsoft/winappcli`), so `npm install` brings it; nothing is installed
   system-wide. It downloads the Windows SDK's packaging tools into its own cache on first use.

No certificate is bought at any point: the Store signs the package it distributes.

## Building

```bash
npm run store:build
```

1. Builds the app in release mode with the Store configuration, into its own Cargo target folder
   (`src-tauri/target/store`), so the GitHub build's `rankdb.exe` is never replaced.
2. Lays the package out in `release/store/package`: `rankdb.exe`, the manifest
   (`store/Package.appxmanifest` with the identity and the version filled in) and the images
   (tiles, taskbar and Store logo generated from `src-tauri/icons/icon.png`, plus the backup
   file icon).
3. Packs `release/store/RankDB_<version>.0_x64.msix`, **unsigned**: this is the file to upload.
4. Unpacks it again and checks what is really inside: identity, version, architecture, the
   full-trust entry point and capability, the executable, every image the manifest names, and
   that the binary is the Store build.

Options (after `--`):

| | |
|---|---|
| `--dev-sign` | also makes `RankDB_<version>.0_x64_test.msix`, signed with a local test certificate, and `RankDB_test_certificate.cer` to trust it with (see [Testing](#testing-on-a-pc)) |
| `--skip-app` | packs the `rankdb.exe` of the last Store build again (after changing only the manifest or the identity) |

Without an identity the build uses a local test identity (`RankDB.LocalTest`) and says so. Such
a package installs for testing but can't be submitted.

`release/` is git-ignored. `store.yml` (Actions → Store package → Run workflow) runs the same
command with `--dev-sign` and keeps the packages as a download on the run's page for 14 days.

## Testing on a PC

An unsigned package can't be installed; a test-signed one can, on a PC that trusts the test
certificate. **Do this in Windows Sandbox or a VM** rather than on the PC with your real RankDB,
at least until the data copy below has been seen working.

1. `npm run store:build -- --dev-sign`
2. Trust the certificate, in an elevated PowerShell (once per certificate):

   ```powershell
   Import-Certificate -FilePath .\release\store\RankDB_test_certificate.cer -CertStoreLocation Cert:\LocalMachine\TrustedPeople
   ```

3. Install and start it:

   ```powershell
   Add-AppxPackage .\release\store\RankDB_<version>.0_x64_test.msix
   ```

4. Remove it again (this deletes its data, see below):

   ```powershell
   Get-AppxPackage *RankDB* | Remove-AppxPackage
   ```

   and take the certificate out of Trusted People when done
   (`certlm.msc` → Trusted People → Certificates).

`store/devcert.pfx` is the private half. It is made on first use, has winapp's publicly known
default password, is only good for testing and is git-ignored. Never use it for anything else.

To try an update: bump the version in `package.json` (and the Cargo manifests,
`node scripts/check-version.mjs` says which), build again and `Add-AppxPackage` the new file over
the installed one. Windows only accepts a higher version.

### What to check by hand

None of this could be checked where the package was built (installing it needs the certificate
trusted machine-wide), so it is still open:

- [ ] It installs, starts from the Start menu, and shows the list.
- [ ] Accounts, ranks and settings are still there after closing and starting again.
- [ ] Settings → Data: turning on a master password, locking, unlocking; copying an email or
      password; exporting a backup and importing it again.
- [ ] Discord shows RankDB while it is open (Discord Rich Presence on).
- [ ] The window: dragging, resizing by the top and bottom edge only, minimise, close, and it
      reopens where it was closed.
- [ ] Settings → Misc has no "Check for updates"; nothing offers an update at start.
- [ ] `.rankdb` files show the backup icon and open RankDB.
- [ ] With a RankDB from GitHub installed and holding accounts: the Store build's first start
      shows them all, with a "Your RankDB data is here" notification; the GitHub one still has
      its own data afterwards.
- [ ] Installing a higher version over it keeps the data.
- [ ] The Windows App Certification Kit passes (Windows SDK; needs the test package installed
      or its path):

  ```powershell
  & "C:\Program Files (x86)\Windows Kits\10\App Certification Kit\appcert.exe" test -appxpackagepath .\release\store\RankDB_<version>.0_x64_test.msix -reportoutputpath .\release\store\wack.xml
  ```

## Submitting

1. Put the real identity in `store/identity.json`, run `npm run store:build`, and make sure the
   last lines name your package and publisher (not the local test identity).
2. Partner Center → the RankDB product → start a submission:
   - **Packages**: upload `release/store/RankDB_<version>.0_x64.msix`.
   - **Properties**: category (Utilities & tools), a support contact, and a **privacy policy
     URL**. RankDB keeps everything on the PC, but it stores account logins, so say that in
     plain words on a page you control and link it. Also say that the experimental profile
     pictures and banners (off by default) send BattleTags to owapi.eu when turned on, and that
     Discord Rich Presence shows the activity text in Discord.
   - **Age ratings**: the questionnaire. Answer that the app sends data to third parties only
     when the user turns it on (BattleTags to owapi.eu, the activity text to Discord) and has no
     chat, purchases or user-to-user content.
   - **Store listings**: description, at least one screenshot (1366×768 or larger), the logo.
   - **Submission options → Restricted capabilities**: `runFullTrust` asks why. Something like:
     "RankDB is a desktop (Win32) application built with Tauri and WebView2. It needs full
     trust to run as a normal desktop process: a local SQLite database, the clipboard, file
     pickers for backups, and Discord's local Rich Presence pipe."
   - **Pricing and availability**: free; markets as you like.
3. Submit for certification. Microsoft tests, signs and publishes it; nothing in this repository
   is involved after the upload.

## Versions and updates

- The version is `package.json`'s everywhere (`scripts/check-version.mjs`). The package's is that
  plus `.0`: MSIX versions have four parts and the Store reserves the last one.
- Every submission needs a higher version than the one in the Store.
- An update is a new submission with the new `.msix`. The Store delivers it; the app doesn't
  check, download or install anything itself.
- What's New shows after a Store update exactly as after a GitHub one (it only compares the
  running version with the last one seen), so `src/text/whats-new.txt` needs notes for the version.
- The two channels don't have to release together, but one version number should mean one state
  of the source.

## Data

**Where it is.** The Store build writes to `%APPDATA%\com.merkdesigns.rankdb.store`, and for a
packaged app Windows keeps what it writes there inside the package:
`%LOCALAPPDATA%\Packages\<package family name>\LocalCache\Roaming\com.merkdesigns.rankdb.store`.
The "open data folder" button (shown when the database can't be opened) goes to that real place.

**Uninstalling the Store version deletes its data.** That is how Windows treats packaged apps,
and it can't be turned off. Export a backup first (Settings → Data → Export all data); the
GitHub version's data is not affected by this.

**Coming from the GitHub version.** The Store build's first start looks for the GitHub version's
database (`%APPDATA%\com.merkdesigns.rankdb.next\rankdb.sqlite3`) and copies it. Everything is in
that one file: accounts, ranks, past ranks, settings, saved emails and passwords, and the master
password's protection, so a locked database arrives locked and opens with the same password.

- It only reads the other version's files. The GitHub version keeps working with its own data.
- It happens once. A marker file (`copied-from-github-version`) is left in the Store build's data
  folder; after that nothing is copied again, whatever either side does.
- It never replaces a Store database that holds accounts, groups or a master password. If the
  Store build was used first, nothing is copied.
- The copy is checked before it is used (SQLite's integrity check; not from a newer RankDB than
  this build). If it fails, both sides stay as they were, the app says why, and it tries again
  next start as long as the Store build's list is still empty.
- The GitHub version may be running: the database and its write-ahead log are read twice and
  only used if nothing changed in between.
- RankDB 0.3's data is migrated as before, but only when there is no GitHub 1.x data to copy.

**After that the two are separate.** Changes in one don't appear in the other. Someone who
switched should uninstall the GitHub version afterwards, so they don't edit the wrong one.

**Any other way round, use a backup.** Store to GitHub, PC to PC, or when the automatic copy
doesn't apply: Settings → Data → Export all data in one, Import backup in the other. Backups are
the same file for both builds. A backup can't be imported into an *older* RankDB than the one
that made it, so keep both versions up to date before moving.

## Common certification issues

- **Wrong identity.** Name, publisher or publisher display name that differ from Partner Center
  by a single character are rejected at upload. Copy them, don't type them.
- **Version not higher**, or a last part that isn't 0.
- **`runFullTrust` without an explanation.** Fill in the restricted-capabilities note.
- **No privacy policy** for an app that stores account logins.
- **The package is signed.** Upload the unsigned one, not the `_test` one: its test certificate
  and its publisher won't match.
- **WebView2.** RankDB needs the WebView2 runtime. Windows 11 has it; on Windows 10 it normally
  arrives with Edge. A tester's clean Windows 10 image without it shows an empty window, and that
  fails certification as "app doesn't launch". If that happens, say in the certification notes
  that the Evergreen WebView2 Runtime is required, or raise `MinVersion` in
  `store/Package.appxmanifest` to Windows 11 (`10.0.22000.0`).
- **A second updater.** Store policy doesn't want apps updating themselves from elsewhere. The
  Store build has none; don't add the updater back to it.
- **Listing doesn't match the app** (screenshots of another version, a description promising
  features that aren't there).

## Files

| | |
|---|---|
| `scripts/build-store.mjs` | the whole build (`npm run store:build`) |
| `store/Package.appxmanifest` | the manifest template |
| `store/identity.example.json` | what `store/identity.json` looks like |
| `store/BackupFile.png` | the `.rankdb` file icon in the package |
| `src-tauri/tauri.store.conf.json` | the Store build's identifier |
| `src-tauri/src/db/store_data.rs` | the first start's copy of the GitHub version's data, with its tests |
| `src/platform/channel.ts` | `STORE_BUILD` for the frontend |
| `.github/workflows/store.yml` | the package as a download, on request |
