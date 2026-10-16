# MindMap — Claude Context

## Project Overview
MindMap is a Chrome extension that shows how you spend your time online: how much active browsing time goes to learning vs entertainment. It is **local-only** — no backend, no accounts, no network calls at all.

| Part | Files | What it does |
|---|---|---|
| Tracker | `extension/tracker.js` + `background.js` | Counts active time per site/category, stores daily totals locally |
| New tab | `extension/newtab.html` / `newtab.js` | Clock, greeting, fixed aura background, 7-day brain score. Planned to grow into a "good morning"-style page |
| Dashboard | `extension/dashboard.html` / `dashboard.js` | Category breakdowns, weekly trends, time-of-day heatmap, top sites, streak |

This repo is a fork of `prospersa1/MindMap` (a hackathon project). The fork dropped Supabase, the AR brain viewer, the landing page and Gemini classification — see git history before commit "Phase 3" for those.

### Rule: keep the extension lightweight
The extension runs during all of the user's browsing, so it must stay cheap. **Before building any feature, alert the user if it adds unnecessary compute or network work to normal browsing** — e.g. per-tab or per-page-load work, content scripts injected into pages, background timers/polling, extra API calls, or heavy rendering on the new tab page. Say what it costs and suggest a cheaper alternative (caching, batching, doing it only on demand). The dashboard only runs when opened, so this matters less there.

## Files (`extension/`)
- `manifest.json` — MV3. Permissions: `tabs`, `storage`, `windows`, `idle`; no host permissions.
- `background.js` — service worker entry: loads `shared.js` + `tracker.js`, defines `classifyLocally()`.
- `tracker.js` — the tracker (below).
- `shared.js` — shared constants (below).
- `newtab.html` / `newtab.js` — new tab override: ghosted clock, greeting, the fixed `aura.png` background, and the 7-day score as a small cover tile tinted by brain state (`MINDMAP.readRows(7)`). Clicking the tile opens `chrome.runtime.getURL('dashboard.html')`.
- `aura.png` — the new tab background: a 44×54px, pre-blurred colour field (≈3 KB) baked from the reference design so only colour survives. Fixed by design — the background never changes. (Replaced the daily Unsplash photo; `background.js` clears the old `unsplash_cache` key on update.)
- `dashboard.html` / `dashboard.js` — reads the last 30 days via `MINDMAP.readRows(30)`; each row is `{ domain, cat, dur, dk, hour }`, the shape the chart renderers use. The Top Sites category badges are `<select>`s for correcting a site's category; changing one saves the override and re-runs `init()` (which destroys existing Chart instances first).
- `vendor/chart.umd.js` — Chart.js 4.4.3 from npm, unmodified.
- `theme.css` — shared look for both pages (below).

## Visual design (`theme.css`)
Modelled on a blurred album-art "now playing" screen: a sky-blue / rust aura fading to near-black, film grain, and wide-tracked uppercase monospace.
- Tokens on `:root`: `--mono` (system monospace stack — no web fonts, no network), text `--ink/--ink-2/--ink-3`, `--surface`, `--hairline`, `--tracking` (0.32em), `--radius`.
- `.aura` + `.grain` are fixed full-page layers (grain is an inline SVG `feTurbulence` data URI). `.cover` is a square card with its own two-tone blurred gradient set by `--c1/--c2` (each brain state's `aura` pair in `shared.js`), a smear band, and a `.grain-layer`. `.ghost` is the horizontal motion-blur text-shadow — use it on **one** hero number per page (clock on the new tab, score on the dashboard cover).
- Everything is static: no animation loops, no network. The new tab stretches `aura.png` full-screen with `filter: blur(20px) saturate(1.3)`.
- Charts follow the dataviz rules: text never wears a data colour (identity comes from a dot/key beside it), thin marks (≤24px columns, 2px line, 2px gaps between stacked segments, 4px rounded top only), solid hairline grids, a legend for ≥2 series and none for one, part-to-whole as a stacked bar (not a donut), and a single-hue sequential scale for the time-of-day heatmap.

**Extension page CSP:** no inline `<script>` and no CDN scripts — all JS must be in files in the extension. (Network stylesheets/fonts would be allowed, but the pages deliberately use none.)

## Tracker (`tracker.js`)
- Counts active seconds only while a Chrome window is focused, the active tab is http(s), and the user isn't idle (`chrome.idle`, 300 s). An **audible** tab keeps counting while idle (videos). When idle fires, the 300 s of no input is not counted.
- Storage: `chrome.storage.local` key `day:YYYY-MM-DD` (local date) → `{ "hour|domain|category": seconds }`. Domain has `www.` stripped; category is from `classifyLocally()` at record time. Segments are split at hour boundaries.
- The open segment is in `chrome.storage.session` (`tracker_segment`), so it survives service-worker suspension. **No timers** — each tab/focus/idle/title/audible event closes and credits the segment. Events are serialised through a promise queue.
- Safety cap: one segment credits at most 2 h. Days older than 365 are pruned on browser startup.
- If Chrome crashes, the open segment since the last event is lost.

## Classification
- `classifyLocally(url, title)` in `background.js`: domain regexes first, then title keywords. Free, instant, no network.
- Mixed sites (e.g. YouTube) only get a non-default label if the title has words like "tutorial".
- **Per-site overrides:** set from the dashboard's Top Sites table, stored in `chrome.storage.local` `category_overrides` (`{ domain: category }`). Applied when data is read (`MINDMAP.readRows`), not when recorded, so they re-label all history instantly and can be undone ("↺ Automatic"). An override applies to all of a site's time, including title-based labels. Only sites in the top 10 for the week can be corrected for now.
- Always read data through `MINDMAP.readRows()` so overrides are applied everywhere.

## Shared constants (`shared.js`)
Classic script (no `import`/`export`) loaded via `importScripts` in the service worker and `<script src>` in pages. Exposes one global, `MINDMAP`: `CATEGORIES` (key/label/colour), `CATEGORY_KEYS`, `LEARNING_CATEGORIES`, `STATES`, helpers `normalizeCategory()`, `isLearning()`, `brainState(ratio)`, and data access `readRows(days)`, `getCategoryOverrides()`, `setCategoryOverride(domain, category|null)`. Change categories, colours or thresholds here only; `classifyLocally()` must return only these keys. Category colours and their **order** were validated with the dataviz skill's `validate_palette.js` against the dark surface (#0d1424); the order matters because neighbouring stack segments must stay distinguishable. Re-run it if you change either.

### Categories
| Category | Counts as | Colour |
|---|---|---|
| learning | learning | `#199e70` aqua |
| entertainment | entertainment | `#d95926` orange |
| productivity | **learning** | `#3987e5` blue |
| news | **learning** | `#c98500` amber |
| social media | entertainment | `#d55181` magenta |
| other | entertainment | `#7d8494` grey (de-emphasis) |

### Brain states (by learning share of active time)
| State | Condition | Colour |
|---|---|---|
| Thriving | ≥55% | dot `#00ffcc`, aura cyan/aqua |
| Healthy | ≥35% | dot `#88aaff`, aura sky/rust |
| Sluggish | ≥15% | dot `#aa9988`, aura dull brown/rust |
| Rotting | <15% | dot `#888888`, aura ash |

Known weakness: counting productivity and news as "learning", and the thresholds themselves, are arbitrary.

## Testing
There is no build step or test suite. To try it: `chrome://extensions` → Developer mode → Load unpacked → `extension/`, then reload after changes. The service worker's console is under "Inspect views" on that page; stored totals can be checked there with `chrome.storage.local.get(null)`.

## Known issues
- `newtab.js` has a hardcoded `USERNAME = 'User1'`.
