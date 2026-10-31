# RankDB (rewrite)

A fresh start on RankDB: a Tauri desktop app for tracking multiple Overwatch accounts, ranks,
credentials and currencies. Accounts and settings are stored in SQLite, with optional master-password credential encryption,
groups and season history. Existing Windows-protected data must be decrypted once before use.

The rewrite is in polish and release preparation. Its **Glass Lab** remains for material tuning and
performance benchmarks, with saved accounts or an unsaved dummy roster. The chosen design uses
Shell rows and native glass overlays. See [the plan](docs/PLAN.md) for feature progress and
[the shared handoff](docs/HANDOFF.md) for current validation and open findings. Both Codex and Claude
use [CLAUDE.md](CLAUDE.md) as the project contract.

## Edit interface text

All authored interface text is in [`src/text/strings.json`](src/text/strings.json), grouped by screen.
Edit the values there to rename options, descriptions, menus and notifications.
See [Editing text](docs/EDITING-TEXT.md) for placeholders, live updates and validation.

## Run it

RankDB only runs as the desktop app (Tauri); there is no browser version.

```bash
npm install
```

```bash
npm run app:dev
```

The Glass Lab pill at the top right opens the lab.

To install it as a normal app (**RankDB Dev** in the Start menu, next to your installed RankDB):

```bash
npm run bundle:dev
```

The installer lands in `src-tauri/target/release/bundle/nsis/`. Run it again after changes to update the app.

## What you can try

- **Glass strategy**: the same design built five ways.
  - **Off**: today's opaque boxes. This is the baseline.
  - **Native**: every box blurs on its own, like TaskMap.
  - **Shared**: all rows share one blur layer.
  - **Shell**: rows don't blur at all.
  - **Baked**: the background is blurred once into an image. It's the cheapest option and only works
    with a background that doesn't move.
- **Scene**: the background behind the glass (flat, dots, aurora, animated aurora), rim style, shadows,
  rows scrolling under the header, account count and UI scale.
- **Material**: every TaskMap glass value (blur, pre-blur, saturation, brightness, tint, radius, rim,
  overscan) with presets.
- **Benchmark**: "Compare all modes" scrolls the list in every mode and shows frame times against Off.
  "Copy as Markdown" gives you a table to paste.

## Benchmark from the command line

In the real app (start it first, keep the window visible):

```bash
npm run app:profile
```

```bash
npm run bench
```

Results land in `bench-results/`. Options: `--duration 8 --modes off,baked,native --backdrops aurora --accounts 120 --preset lean --overscan 1`.

## First measurements (2026-10-29)

Historical results from the initial Glass Lab; later implementation and performance work changed
the behavior of these strategies. These numbers do not describe the current build.

These runs use the real WebView2 app (Edge 156) at 1600×960, 1x scale, on a 360 Hz display (2.78 ms per
frame). The list holds 40 accounts on the Aurora background, with the TaskMap preset, scrolling at
1400 px/s.

| Mode | Filter layers | Median | p95 | Long frames |
|---|---|---|---|---|
| Off | 0 | 2.8 ms | 2.9 ms | 0% |
| Baked | 0 | 2.8 ms | 2.9 ms | 0% |
| Shared | 12 | 2.8 ms | 2.9 ms | 0% |
| Native | 146 | 2.8 ms | 5.6 ms | 24% |
| Shell | 10 | 5.5 ms | 5.7 ms | 60% |

- **Shared and Baked look the same as Native and cost the same as Off.** Glass can be free at 360 Hz
  if it's built this way.
- **Native** (one blur per box, the way TaskMap renders cards) drops about a quarter of frames while
  scrolling.
- **Shell is the surprise.** It has the fewest blur layers yet the worst result. Cutting the header's
  overscan to 0 halves its cost (median 2.9 ms), so the header glass re-blurring the rows that scroll
  beneath it is a big part of the problem. Shared mode doesn't pay that cost, and the reason isn't
  understood yet. It's worth a DevTools Performance trace (`npm run app:profile` exposes port 9333).
- The animated background barely changed any of the results.
