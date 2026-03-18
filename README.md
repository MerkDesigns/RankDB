# RankDB

RankDB is a multi-account Rank-Tracker for Overwatch players that are too far gone.

## HOW TO INSTALL FOR NOOBS.

- on the right side go to "Releases" to find the .exe installer

## Windows warning !!!

This app is currently not code-signed, so Windows Defender / SmartScreen may show a warning like “Unknown Publisher” or “Windows protected your PC.”

This happens because the app does not yet have a digital code-signing certificate. These certificates are usually paid and can be expensive for small indie or personal projects.

Because of that missing digital signing license/certificate, Windows may flag the installer even though it is not malicious.

## What The App Tracks

Each account row can store:

- Battletag
- Email / Password with easy copy paste access
- Custom notes for the Account
- Ranks for `Tank`, `Damage`, `Support` and `6v6` rank
- Trackable currency: MythicPrisms, Yellow/White Coins, Both Comp points

## Main Functions

### Account Management

- Add / Remove accounts
- Drag accounts to reorder them
- Copy battletags, emails, and passwords directly from the row
- Edit account credentials by rightclicking on the account
- Edit account info such as country, notes, and banned status

### Rank Management

- Click a rank badge to open the rank picker
- Set tier and division for each role
- "P" rank stand for Predicted and is 50% less opacity visually
- Track `6v6` separately from role queue 
  (you hide 6v6 tab if you don't care about the mode)

### Sorting

- Click a role icon in the header to cycle sorting:
  1 - highest to lowest
  2 - lowest to highest
  3 - custom order
- Right-click a role icon to jump straight back to custom order

### Banned Accounts

- Accounts can be marked as banned in the Account Info modal
- Banned accounts are placed in their own section below normal accounts
- They sort within their own section only
- They cannot be dragged into the normal account section

### Settings

The settings include:

- Toggle for Currency columns
- Toggle for `6v6` ranks
- Toggle for rank badge animations
- UI zoom slider
- Clipboard auto-clear timer
- Export data
- Import data

## Data Behavior

- Data is stored locally in browser/local app storage
- UI settings are stored separately from account data
- In the Tauri app, credentials also integrate with Windows Credential Manager
- Changes save automatically

## Tech Stack

- Nuxt 4
- Vue 3
- Tailwind CSS
- Tauri
