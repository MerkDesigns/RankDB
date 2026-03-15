# Project Log (RankDB)

Last updated: 2026-03-14

## 1) Project Snapshot
- Type: Nuxt 4 + Vue 3 single-page UI prototype
- Purpose (current): Display/edit rows of Overwatch account data (name, role ranks, and numeric values)
- Repository state: No `.git` directory detected in `C:\Users\Merk\RankDB` (working as a local snapshot)

## 2) Tech Stack
- Runtime/framework: `nuxt@^4.3.1`, `vue@^3.5.29`, `vue-router@^4.6.4`
- Styling: Tailwind via `@nuxtjs/tailwindcss`
- PWA: `@vite-pwa/nuxt` configured in `nuxt.config.ts`
- Scripts:
  - `npm run dev`
  - `npm run build`
  - `npm run preview`
  - `npm run generate`

## 3) Key Files
- `app/app.vue`: Main UI and all current app logic
- `app/assets/css/main.css`: Tailwind imports + small global CSS tweaks
- `nuxt.config.ts`: Modules, CSS include, PWA manifest/workbox settings
- `assets/Ranks/*.png`: Rank icon assets (currently not used in `app.vue`)
- `README.md`: Default Nuxt starter README (not project-specific yet)

## 4) Current Behavior
- Renders a fixed-width table-style dashboard with 5 account rows.
- Each row supports:
  - Account name display/edit
  - Rank tier/division editing for 3 roles (`T`, `D`, `S`)
  - Numeric field editing (`valuesA`, `valuesB`)
  - Toggle edit mode per row
  - Copy account name to clipboard
- Data is in-memory only:
  - No API calls
  - No local persistence (`localStorage`, DB, backend) yet

## 5) Configuration Notes
- `compatibilityDate` is set to `2025-07-15`.
- PWA config exists with `registerType: autoUpdate` and manifest icons from `/public/icon.svg`.
- `pwa.devOptions.enabled` is `false` (service worker disabled in dev mode).

## 6) Risks / Gaps
- No persistent storage: all edits are lost on refresh.
- No tests or lint setup found.
- UI and business logic are all in one component (`app/app.vue`), which will become harder to maintain as features grow.
- Rank icon image assets exist but are not integrated in the rendered rows yet.
- README is generic and does not document project-specific behavior.

## 7) Recommended Next Steps
1. Add persistence layer (first pass: browser `localStorage`; second pass: backend/DB).
2. Split `app/app.vue` into components (`AccountRow`, `RankCell`, `ValueCell`) and move types/composables out of the page.
3. Integrate rank icon assets into rank display/edit UI.
4. Add project-specific README with setup, architecture, and roadmap.
5. Add basic validation + tests for rank/value editing behavior.

## 8) Next-Session Quick Start
1. Open and read this file first: `PROJECT_LOG.md`
2. Run `npm run dev`
3. Open `app/app.vue` to continue feature work
4. After any meaningful change, append/update:
   - What changed
   - Why it changed
   - What remains

## 9) Session Note Template (append below)
```md
## Session YYYY-MM-DD
- Changes made:
- Decisions:
- Open issues:
- Next actions:
```

## Session 2026-03-14
- Changes made:
  - Added clickable rank badges in `app/app.vue`.
  - Added a rank picker modal to choose both rank icon (tier) and division number.
  - Integrated rank icon assets from `assets/Ranks/*.png`.
  - Rendered the division number over the right white panel of each rank icon.
  - Verified production build passes (`npm run build`).
  - Tuned badge visuals to better match `RankDB-mockup.jpg`:
    - removed outer icon container and removed visible `T/D/S` labels
    - switched icon rendering to preserve aspect ratio (`object-contain`)
    - nudged division overlay number 4px further right
    - aligned default rank sequence to mockup-like colors (cyan/green/purple)
  - Captured and checked a final live screenshot: `rankdb-current-4173.png`.
- Decisions:
  - Kept existing row edit toggle for account name and numeric fields.
  - Made rank editing independent from row edit mode (rank can be changed by clicking badge directly).
- Open issues:
  - Rank state is still in-memory only; no persistence after refresh.
  - Overlay alignment may need small visual tuning after browser/device testing.
- Next actions:
  - Add local persistence (`localStorage`) for ranks and values.
  - Fine-tune icon/number alignment against the mockup in responsive sizes.

## Session 2026-03-14 (latest)
- Changes made:
  - Reworked role-rank area to 4 columns: `Tank`, `Damage`, `Support`, and `6v6`.
  - Integrated `6v6` rank into the same rank strip as the other roles (not a separate standalone box).
  - Updated rank click handling so the `6v6` badge opens the same rank picker modal and saves to `sixV6Rank`.
  - Kept homepage rank icons on legacy `Rank_Icon_*` assets; modal uses the newer `assets/Ranks/*.png` icons.
  - Added/kept automatic `localStorage` persistence for all row state (account name, role ranks, 6v6 rank, numeric values).
  - Enforced rule: `Unranked` has no number and cannot be marked predicted.
  - Confirmed production build succeeds after these changes (`npm run build`).
- Decisions:
  - Treat `6v6` as a first-class role-equivalent column in the rank row for alignment and easier scanning.
  - Keep persistence client-side only for now (`localStorage`, key: `rankdb_accounts_v2`).
- Open issues:
  - Visual spacing may still need minor pixel tuning against the latest mockup.
  - No backend sync yet; data is browser-local.
- Next actions:
  - If requested, refine final spacing/typography with side-by-side mockup checks.
  - If requested, extract rank row/modal into components to reduce `app/app.vue` complexity.
