# RankDB

RankDB is a Nuxt 4 UI for tracking Overwatch account data across:
- role queue ranks (`Tank`, `Damage`, `Support`)
- `6v6` rank
- resource values (mythic prisms, coins, etc.)

Each account row is a single continuous bar, with fixed internal column lanes so values stay centered under their header icons.

## Current App Behavior

- Runs as a client-only Nuxt 4 PWA with local-first persistence.
- Account bars can be reordered by dragging.
- New bars start with the placeholder name `Battletag`.
- Battletags store the full value, but the row only displays the part before `#`.
  - Example: saving `name#55671` displays `name`.
  - The copy button still copies the full stored battletag.
- Field editing is inline and per-field.
  - Right-click a name or numeric value to edit it.
  - Clicking elsewhere saves on blur.
  - `Enter` saves and `Esc` cancels.
- Right-click context menus are disabled globally except for the app's own edit behavior.
- Settings open in a modal, not a dropdown.
- Settings currently include:
  - toggle `Credits` columns
  - toggle `6v6` column
  - `UI Zoom` slider from `80%` to `125%` in `5%` steps

## Rank UI Notes

- Homepage rank badges are slightly smaller than the original version.
- `Unranked` homepage badges render at `50%` opacity.
- Predicted ranks use a stronger dimmed state.
- The division number overlay on homepage badges is shifted down by `1px`.
- The rank picker modal shows `Champion` before `Grandmaster`.

## Data Columns (Canonical Order)

After the `6v6` rank column, the value columns are:
1. Mythic Prisms
2. Overwatch Coins
3. Credits
4. Competitive Points
5. Legacy Points

Current code mapping:
- `valuesA[0]` = Mythic Prisms
- `valuesA[1]` = Overwatch Coins
- `valuesA[2]` = Credits
- `valuesB[0]` = Competitive Points
- `valuesB[1]` = Legacy Points

## Setup

```bash
npm install
```

## Run

Development:

```bash
npm run dev
```

Production build:

```bash
npm run build
```

Preview built app:

```bash
npm run preview
```

## Persistence

App data is auto-saved in browser localStorage.
- Key: `rankdb_accounts_v2`
- Saved fields: account name, role ranks, 6v6 rank, predicted state, and numeric values.

UI settings are also saved in browser localStorage.
- Key: `rankdb_ui_settings_v1`
- Saved fields: `showSixV6`, `showNonRankColumns`, `uiZoom`

## Interaction Model

- Dragging uses a custom pointer-based system with a floating clone instead of native HTML drag and drop.
- Rows reorder live while dragging.
- The source row is hidden during drag so only the floating copy is visible.
- The list uses a move transition for reordering.
- The only row action menu item is `Remove Bar`.

## Visual QA (Screenshot Flow)

Use this when layout changes need visual verification:

1. Build app:
```bash
npm run build
```
2. Run built server on port `4173` (recommended, because port `3000` may be occupied by other local apps):
```powershell
$env:PORT='4173'; node .output/server/index.mjs
```
3. Capture screenshot with Playwright:
```bash
npx playwright screenshot --device="Desktop Chrome" http://127.0.0.1:4173 rankdb-live-4173.png
```

## Notes

- Homepage rank icons use legacy `assets/Ranks/Rank_Icon_*` assets.
- Modal uses newer rank icons from `assets/Ranks/*.png`.
- `Unranked` shows no division number and cannot be marked as predicted.
- The UI palette was darkened from the earlier build.
- Text selection uses a low-opacity white highlight instead of the browser default blue.
- Many PNG assets were resized down significantly to reduce PWA startup cost and precache size.
- `nuxt.config.ts` is configured with `ssr: false` and production devtools disabled.
