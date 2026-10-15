# MindMap — Claude Context

## Project Overview
MindMap is a Chrome extension that shows how you spend your time online: how much active browsing time goes to learning vs entertainment. It is **local-only** — no backend, no accounts, no network calls except the new tab's Unsplash photo.

| Part | Files | What it does |
|---|---|---|
| Tracker | `extension/tracker.js` + `background.js` | Counts active time per site/category, stores daily totals locally |
| New tab | `extension/newtab.html` / `newtab.js` | Clock, greeting, daily photo, 7-day brain score. Planned to grow into a "good morning"-style page |
| Dashboard | `extension/dashboard.html` / `dashboard.js` | Category breakdowns, weekly trends, time-of-day heatmap, top sites, streak |

This repo is a fork of `prospersa1/MindMap` (a hackathon project). The fork dropped Supabase, the AR brain viewer, the landing page and Gemini classification — see git history before commit "Phase 3" for those.

### Rule: keep the extension lightweight
The extension runs during all of the user's browsing, so it must stay cheap. **Before building any feature, alert the user if it adds unnecessary compute or network work to normal browsing** — e.g. per-tab or per-page-load work, content scripts injected into pages, background timers/polling, extra API calls, or heavy rendering on the new tab page. Say what it costs and suggest a cheaper alternative (caching, batching, doing it only on demand). The dashboard only runs when opened, so this matters less there.

## Files (`extension/`)
- `manifest.json` — MV3. Permissions: `tabs`, `storage`, `windows`, `idle`; host permission only for `api.unsplash.com`.
- `background.js` — service worker entry: loads `shared.js` + `tracker.js`, defines `classifyLocally()`.
- `tracker.js` — the tracker (below).
- `shared.js` — shared constants (below).
- `newtab.html` / `newtab.js` — new tab override. Score = last 7 calendar days of local totals (`MINDMAP.readRows(7)`). Clicking it opens `chrome.runtime.getURL('dashboard.html')`. Unsplash photo cached once per day in `chrome.storage.local` `unsplash_cache`.
- `dashboard.html` / `dashboard.js` — reads the last 30 days via `MINDMAP.readRows(30)`; each row is `{ domain, cat, dur, dk, hour }`, the shape the chart renderers use. The Top Sites category badges are `<select>`s for correcting a site's category; changing one saves the override and re-runs `init()` (which destroys existing Chart instances first).
- `vendor/chart.umd.js` — Chart.js 4.4.3 from npm, unmodified.

**Extension page CSP:** no inline `<script>` and no CDN scripts — all JS must be in files in the extension. Stylesheets/fonts from the network are allowed (the dashboard uses Google Fonts).

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
Classic script (no `import`/`export`) loaded via `importScripts` in the service worker and `<script src>` in pages. Exposes one global, `MINDMAP`: `CATEGORIES` (key/label/colour), `CATEGORY_KEYS`, `LEARNING_CATEGORIES`, `STATES`, helpers `normalizeCategory()`, `isLearning()`, `brainState(ratio)`, and data access `readRows(days)`, `getCategoryOverrides()`, `setCategoryOverride(domain, category|null)`. Change categories, colours or thresholds here only; `classifyLocally()` must return only these keys.

### Categories
| Category | Counts as | Colour |
|---|---|---|
| learning | learning | `#1D9E75` teal |
| entertainment | entertainment | `#D85A30` coral |
| social media | entertainment | `#E040FB` magenta |
| productivity | **learning** | `#378ADD` blue |
| news | **learning** | `#EF9F27` amber |
| other | entertainment | `#888780` grey |

### Brain states (by learning share of active time)
| State | Condition | Colour |
|---|---|---|
| Thriving | ≥55% | `#00ffcc` |
| Healthy | ≥35% | `#88aaff` |
| Sluggish | ≥15% | `#aa9988` |
| Rotting | <15% | `#888888` |

Known weakness: counting productivity and news as "learning", and the thresholds themselves, are arbitrary.

## Testing
There is no build step or test suite. To try it: `chrome://extensions` → Developer mode → Load unpacked → `extension/`, then reload after changes. The service worker's console is under "Inspect views" on that page; stored totals can be checked there with `chrome.storage.local.get(null)`.

## Known issues
- `newtab.js` has a hardcoded `USERNAME = 'User1'` and a hardcoded Unsplash access key.
