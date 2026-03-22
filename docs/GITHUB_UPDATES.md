# GitHub Updater Setup

This project is wired to use Tauri's updater plugin with GitHub Releases.

The updater endpoint is:

`https://github.com/MerkDesigns/RankDB/releases/latest/download/latest.json`

That `latest.json` file is expected to be uploaded by `tauri-apps/tauri-action` when a tagged release is built.

## 1. Generate the updater signing key

Run this once on your machine:

```powershell
npx tauri signer generate -w ~/.tauri/rankdb.key
```

Tauri will print:

- a private key file path
- a public key string

What to do with them:

- put the public key into `src-tauri/tauri.conf.json` as `plugins.updater.pubkey`
- put the private key contents into the GitHub secret `TAURI_SIGNING_PRIVATE_KEY`
- if you used a password while generating the key, store it in `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Do not commit the private key.

## 2. Replace the placeholder public key

Edit `src-tauri/tauri.conf.json` and replace:

`REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY`

with the actual public key that the signer command printed.

## 3. Add GitHub repository secrets

In GitHub:

1. Open the repo.
2. Go to `Settings` -> `Secrets and variables` -> `Actions`.
3. Add these repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

`GITHUB_TOKEN` is provided automatically by GitHub Actions, so you do not need to create that one.

## 4. Publish updates correctly

This workflow publishes on tags that start with `v`.

Recommended release flow:

1. Update the app version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` if needed.
2. Commit your changes to `main`.
3. Create and push a version tag:

```powershell
git tag v0.1.1
git push origin v0.1.1
```

4. GitHub Actions will build the app and create a draft GitHub Release.
5. Open the draft release on GitHub and confirm the assets are attached:

- the NSIS installer `.exe`
- `.sig` signature files
- `latest.json`

6. Publish the draft release.

Once that release is live, installed desktop users can use the in-app update button.

## 5. Important rules

- Keep the updater signing key forever. If you lose it, existing installs cannot trust future updates from you.
- Bump the app version for every release.
- Do not delete or rewrite published updater assets for a version after release.
- Test at least one real install-to-update path before relying on it.

## 6. What users will do

After the first install from the GitHub Release installer:

1. They open RankDB.
2. They go to Settings.
3. They click `Check for Updates`.
4. The app downloads the new release from GitHub and relaunches itself.

## 7. Migration expectation

This desktop app no longer imports legacy plain JSON backups and no longer reads legacy
Windows Credential Manager data from older builds.

Users should expect to re-enter their account credentials one final time on the new build,
then use the encrypted `.rankdb-export` format going forward.
