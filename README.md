# RankDB

A Windows desktop app for keeping track of multiple Overwatch accounts: their ranks, currencies,
login details and status, all in one list.

## Features

- **Ranks** for tank, damage, support and 6v6, with divisions, predicted ranks and placement games.
- **Currencies** per account, edited inline.
- **Groups**, drag-and-drop ordering, and separate sections for accounts that need SMS
  verification or are banned.
- **Sorting** by any role's rank.
- **Season resets** that archive every rank, with past ranks viewable later (and undoable).
- **Login details** copied straight to the clipboard, kept out of clipboard history and cleared
  after a few seconds. Credentials can optionally be protected with a master password.
- **Account info**: country, notes, games dodged and the next penalty.
- **Privacy mode**, UI scale, column toggles and an accent colour.
- **Discord Rich Presence** and automatic updates.

## Install

Download the latest installer from [Releases](https://github.com/MerkDesigns/RankDB/releases)
and run it. Updating from RankDB 0.3 keeps your accounts: they are migrated on the first start.

## Your data

Everything stays on your PC, in a local SQLite database under
`%APPDATA%\com.merkdesigns.rankdb.next`. Nothing is uploaded. Emails and passwords are stored
unencrypted unless you set a master password in Settings → Data.

## Building from source

Requires [Node.js](https://nodejs.org/) 24, [Rust](https://rustup.rs/) and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for Windows.

```bash
npm install
```

```bash
npm run app:dev
```

`npm run check` typechecks, builds and runs `cargo check`. Interface text lives in
[`src/text/strings.json`](src/text/strings.json) ([editing guide](docs/EDITING-TEXT.md)).

Built with Tauri 2, React 19, TypeScript and SQLite.
