# RankDB privacy policy

Last updated: 12 November 2026

RankDB is a desktop app for Windows that keeps track of your Overwatch accounts and their ranks.
It is made by MerkDesigns. This policy explains what the app does with your data. In short:
**everything stays on your PC.** RankDB has no user accounts, no servers of its own, no analytics,
no telemetry and no ads, and the developer never receives any of your data.

## What RankDB stores

Everything you enter is kept in a database in your Windows user profile, on your own PC:

- your accounts: BattleTags, ranks, groups, statuses, notes, past ranks and similar details;
- the email addresses and passwords you choose to save for those accounts;
- your app settings.

Emails and passwords are stored as entered unless you turn on **credential protection** (Settings →
Data). With it on, they are encrypted with a master password that only you know and that is never
stored or sent anywhere. If you forget it, the saved credentials can't be recovered.

When you copy a password, RankDB keeps it out of the Windows clipboard history and cloud clipboard
and clears it from the clipboard after a short delay.

**Backups** (Settings → Data → Export all data) are files you save yourself, wherever you choose.
They are encrypted with a backup password you pick. RankDB never uploads them.

## What RankDB sends over the internet

RankDB only connects to the internet for the following. None of it includes your emails, passwords,
notes or ranks.

1. **Update check** (the GitHub version only). RankDB asks GitHub
   (`github.com/MerkDesigns/RankDB`) whether a newer version exists and downloads it if you
   install it. The Microsoft Store version doesn't do this; the Store handles its updates.
2. **Profile pictures and banners** (experimental, **off by default**, Settings → Misc). When you
   turn this on, RankDB sends each account's **BattleTag** to [owapi.eu](https://owapi.eu), a
   third-party service that reads public Overwatch career profiles. When owapi.eu returns an
   address for a profile picture or banner, RankDB downloads that image from the address given and keeps it on your
   PC. Only public profiles return anything. Turning the feature off stops all lookups; the images
   already downloaded stay on your PC, hidden, until you uninstall the app. owapi.eu's own privacy
   practices apply to what it receives.
3. **Discord Rich Presence** (on by default, Settings → Misc). If Discord is running on your PC,
   RankDB tells it locally to show that you're using RankDB, together with the activity text (your
   own text if you set one) and the date you started using RankDB. Discord shows this on your
   profile to people who can see your activity, under Discord's own privacy policy. Discord loads the
   RankDB icon from GitHub. Turn the feature off to stop this.

The button that opens Battle.net account management opens `account.battle.net` in your web
browser; RankDB sends nothing with it.

## What RankDB doesn't do

- It doesn't collect analytics, usage statistics, crash reports or any personal information.
- It doesn't share or sell your data. The developer has no way to see it.
- It doesn't log in to Battle.net, Overwatch or any other service with your credentials.

## Deleting your data

Everything RankDB stores is on your PC. Uninstalling the Microsoft Store version deletes its data.
For the GitHub version, uninstall RankDB and delete its `com.merkdesigns.rankdb.next` folders in
`%APPDATA%` (your data, including downloaded profile images) and `%LOCALAPPDATA%` (the window's
browser cache) to remove everything.
Backups you saved yourself aren't touched.

## Children

RankDB is not directed at children and collects no personal information from anyone.

## Changes

If this policy changes, the new version is published here with a new date.

## Contact

Questions about privacy: open an issue at
[github.com/MerkDesigns/RankDB/issues](https://github.com/MerkDesigns/RankDB/issues).
