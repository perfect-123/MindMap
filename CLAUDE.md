# MindMap — Claude Context

## Project Overview
MindMap is a Chrome extension that shows how you spend your time online: how much active browsing time goes to learning vs entertainment. It is **local-only** — no backend, no accounts, no network calls at all.

| Part | Files | What it does |
|---|---|---|
| Tracker | `extension/tracker.js` + `background.js` | Counts active time per site/category, stores daily totals locally |
| New tab | `extension/newtab.html` / `newtab.js` | Clock, greeting, favorites, momiji background (time of day or picked), 7-day brain score. Planned to grow into a "good morning"-style page |
| Dashboard | `extension/dashboard.html` / `dashboard.js` | Category breakdowns, weekly trends, time-of-day heatmap, top sites, streak |

This repo is a fork of `prospersa1/MindMap` (a hackathon project). The fork dropped Supabase, the AR brain viewer, the landing page and Gemini classification — see git history before commit "Phase 3" for those.

### Rule: keep the extension lightweight
The extension runs during all of the user's browsing, so it must stay cheap. **Before building any feature, alert the user if it adds unnecessary compute or network work to normal browsing** — e.g. per-tab or per-page-load work, content scripts injected into pages, background timers/polling, extra API calls, or heavy rendering on the new tab page. Say what it costs and suggest a cheaper alternative (caching, batching, doing it only on demand). The dashboard only runs when opened, so this matters less there.

## Files (`extension/`)
- `manifest.json` — MV3. Permissions: `tabs`, `storage`, `windows`, `idle`; no host permissions. (`search` was dropped with the search bar.)
- `background.js` — service worker entry: loads `sites.js` + `shared.js` + `tracker.js`, defines `classifyLocally()`.
- `sites.js` — built-in site → category list (below).
- `tracker.js` — the tracker (below).
- `shared.js` — shared constants (below).
- `newtab.html` / `newtab.js` — new tab override: clock, greeting, favorites (letter tiles), a momiji background (by time of day, or picked with the controls under the tile), and the 7-day score as a small cover tile tinted by brain state (`MINDMAP.readRows(7)`). Clicking the tile opens `chrome.runtime.getURL('dashboard.html')`.
- `backgrounds/momiji-<scene>.webp` — the new tab backgrounds, "Momiji through the seasons": a blurred colour field with drawn Japanese maple leaves, one in focus low on the right and many drifting down-left at several depths. Four scenes: `spring` (green), `autumn` (red), `dry` (brown), `faded` (grey). 2880×1800 WebP, 35–60 KB each (≈20–30 ms to decode). They are rendered, not hand-edited: change `tools/momiji.html` (colours, counts, seeds, the clear zone kept around the clock/greeting/favorites) and run `node tools/render-momiji.js` (needs Playwright and Pillow; see its header). The background does **not** follow brain state. Under the brain-health tile: a **Scene** button that steps through `SCENES` in `newtab.js` (picking one turns Auto off) and an **Auto** on/off switch (`role="switch"`; turning it off keeps the scene showing). Saved in `localStorage` `mindmap_bg_mode` as `'auto'` or a scene key (synchronous, so `body[data-bg]` is set before first paint; an unknown key falls back to Auto). Auto follows the time of day — 5–12 Spring, 12–17 Dry, 17–21 Autumn, 21–5 Faded — and is re-checked on the clock's 10 s tick, so an open tab changes scene at the boundary. No overlay darkens the image; the renders are already dark at the bottom. (History: daily Unsplash photo → `aura.png` → momiji at 1920×1200 → five user-supplied photos → momiji again at 2880×1800. `background.js` clears the old `unsplash_cache` key on update.)
- `dashboard.html` / `dashboard.js` — reads the last 30 days via `MINDMAP.readRows(30)`; each row is `{ domain, cat, dur, dk, hour }`, the shape the chart renderers use. The Top Sites category badges are `<select>`s for correcting a site's category; changing one saves the override and re-runs `init()` (which destroys existing Chart instances first).
- `vendor/chart.umd.js` — Chart.js 4.4.3 from npm, unmodified.
- `theme.css` — shared look for both pages (below).

## Visual design (`theme.css`)
Modelled on a blurred album-art "now playing" screen: a sky-blue / rust aura fading to near-black, film grain, and wide-tracked uppercase monospace.
- Tokens on `:root`: `--mono` (system monospace stack — no web fonts, no network), text `--ink/--ink-2/--ink-3`, `--surface`, `--hairline`, `--tracking` (0.32em), `--radius`.
- `.aura` + `.grain` are fixed full-page layers (grain is an inline SVG `feTurbulence` data URI). `.cover` is a square card with its own two-tone blurred gradient set by `--c1/--c2` (each brain state's `aura` pair in `shared.js`), a smear band, and a `.grain-layer`. `.ghost` is the horizontal motion-blur text-shadow — use it on **one** hero number per page (the score on the dashboard cover; the new tab clock is plain). On the new tab the clock is plain (no ghost), `clamp(4.5rem, 12vw, 8.5rem)`; the greeting is `clamp(15px, 1.5vw, 20px)`.
- Everything is static: no animation loops, no network. The new tab shows one bundled image cover-fitted, with no CSS filter.
- Charts follow the dataviz rules: text never wears a data colour (identity comes from a dot/key beside it), thin marks (≤24px columns, 2px line, 2px gaps between stacked segments, 4px rounded top only), solid hairline grids, a legend for ≥2 series and none for one, part-to-whole as a stacked bar (not a donut), and a single-hue sequential scale for the time-of-day heatmap.

**Extension page CSP:** no inline `<script>` and no CDN scripts — all JS must be in files in the extension. (Network stylesheets/fonts would be allowed, but the pages deliberately use none.)

## Tracker (`tracker.js`)
- Counts active seconds only while a Chrome window is focused, the active tab is http(s), and the user isn't idle (`chrome.idle`, 300 s). An **audible** tab keeps counting while idle (videos). When idle fires, the 300 s of no input is not counted.
- Storage: `chrome.storage.local` key `day:YYYY-MM-DD` (local date) → `{ "hour|domain|category": seconds }`. Domain has `www.` stripped; category is from `classifyLocally()` at record time. Segments are split at hour boundaries.
- The open segment is in `chrome.storage.session` (`tracker_segment`), so it survives service-worker suspension. **No timers** — each tab/focus/idle/title/audible event closes and credits the segment. Events are serialised through a promise queue.
- Safety cap: one segment credits at most 2 h. Days older than 365 are pruned on browser startup.
- If Chrome crashes, the open segment since the last event is lost.

## Classification
- **`sites.js`** (`MINDMAP_SITES.lookup(hostname)`): the built-in site list — ~200 domains → category, matched on the hostname and each parent domain (so `uci.instructure.com` hits `instructure.com`), then prefixes (`canvas.`, `moodle.`, `docs.`, `developer.`, `learn.` …), then any `.edu` → learning. **Mixed** sites (YouTube, Vimeo…) carry a fallback category but let the title decide first. To add a site, add a line there.
- **`classifyLocally(url, title)`** in `background.js` runs at record time: site list → title keywords (tutorial/course/lecture… → learning, etc.) → mixed-site fallback → `other`. Free, instant, no network.
- **At read time** (`MINDMAP.readRows`): your site assignment wins; otherwise the stored label; and time stored as `other` is re-checked against the current site list, so new rules also re-label past days.
- **Site assignments** (`category_overrides`, `{ domain: categoryKey }`): set from the dashboard's Top Sites dropdowns or the Categories panel ("Assign"), which accepts any site and normalises input with `MINDMAP.cleanDomain()`. "↺ Automatic" / × removes one.
- **Custom categories** (`custom_categories`, `[{ key: 'custom:<slug>-<id>', label, color, learning }]`): created in the dashboard's Categories panel, with a "counts as learning" flag. Max **3**: they take the reference palette's remaining dark steps `#008300`, `#9085e9`, `#e66767`, assigned at creation and kept for life (colour follows the category). They sort after "Other" so they never sit next to magenta (red↔magenta fails the validator); every pair that can become adjacent passes. Deleting one also removes its site assignments. Labels are restricted to letters, numbers, spaces and `- ' . + /` because they are rendered into page markup.
- Always read data through `MINDMAP.readRows()` (it also loads custom categories) so assignments and new site rules apply everywhere.

## Shared constants (`shared.js`)
Classic script (no `import`/`export`) loaded after `sites.js` via `importScripts` in the service worker and `<script src>` in pages. Exposes one global, `MINDMAP`: `CATEGORIES` / `CATEGORY_KEYS` (getters: built-in + custom, refreshed by `loadCategories()` and `readRows()`), `STATES`, `MAX_CUSTOM`, helpers `normalizeCategory()`, `isLearning()`, `brainState(ratio)`, `cleanDomain()`, custom-category `addCustomCategory(label, learning)` / `removeCustomCategory(key)`, and data access `readRows(days)`, `getCategoryOverrides()`, `setCategoryOverride(domain, category|null)`. Change built-in categories, colours or thresholds here only; `classifyLocally()` and `sites.js` must return only built-in keys. Category colours and their **order** were validated with the dataviz skill's `validate_palette.js` against the dark surface (#0d1424); the order matters because neighbouring stack segments must stay distinguishable. Re-run it if you change either.

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

### New tab details
- **Greetings:** `GREETINGS` entries are `[text, ending]`; the name goes before the ending ("Still up, Perfect?"), and is left out when unset. One is picked per tab by time of day.
- **Name:** stored in `chrome.storage.local` `user_name`. Clicking the greeting turns it into an inline input (Enter/blur saves, Escape cancels).
- **Favorites** (replaced the search bar): the user's own sites, `chrome.storage.local` `favorites` = `[{ url, name }]`, max 8 (`FAV_MAX`). Rendered as letter tiles (first letter of the name, no favicons — no network) from the `<template>`s in `newtab.html`; text goes in via `textContent`. The "+" tile and each tile's edit button open a `<dialog>` form; `normalizeUrl()` adds `https://` when missing and accepts **only http(s)** addresses (so a tile can never be `javascript:`); an empty name defaults to the domain's main word. Until the user saves a list, `FAV_PRESETS` is shown (YouTube, LeetCode, X, GitHub, Spotify); an emptied list stays empty. Each tile's border is its site's category colour at 45% (80% on hover), set as `--cat` — your site assignment, else `MINDMAP_SITES.lookup()`, else other.
