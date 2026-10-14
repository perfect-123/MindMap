# MindMap — Claude Context

## Project Overview
MindMap is a multi-person collaborative project that visualizes brain health based on content consumption habits (learning vs entertainment ratio). Modules:

| Module | Folder | Status |
|---|---|---|
| Landing page | `index.html` | Done — links to dashboard + AR |
| AR Brain Viewer | `ar/` | Working (Person C) |
| Dashboard | `dashboard/dashboard.html` | Working — single HTML page, Chart.js |
| Chrome Extension | `extension/` | Done (Person B) — tracking + new tab page |

### Rule: keep the extension lightweight
The extension runs during all of the user's browsing, so it must stay cheap. **Before building any feature, alert the user if it adds unnecessary compute or network work to normal browsing** — e.g. per-tab or per-page-load work, content scripts injected into pages, background timers/polling, extra API calls, or heavy rendering on the new tab page. Say what it costs and suggest a cheaper alternative (caching, batching, doing it only on demand). The dashboard and AR only run when opened, so this matters less there.

### Shared constants — `extension/shared.js`
Single source of truth for the Supabase URL/anon key, categories (key/label/colour), the learning-category set, and brain-state thresholds/colours. Exposes one global, `MINDMAP`, with helpers `normalizeCategory()`, `isLearning()` and `brainState(ratio)`.
- It's a **classic script** (no `import`/`export`) so it works via `importScripts` (service worker), `<script src>` (extension pages, dashboard) and from the AR ES module (loaded with a plain `<script>` before the importmap).
- It lives inside `extension/` because an unpacked extension can't load files outside its folder. Dashboard and AR load it as `../extension/shared.js`, so **the repo root must be served/deployed**, not individual folders.
- Change categories, colours or thresholds here only. The Gemini prompt in `background.js` must still list the same category keys.

## Team Structure
- **Person B** — Chrome extension + Supabase backend (`extension/`)
- **Person C** — AR experience (`ar/`) — this is Derrick's branch
- Other persons — dashboard

## Repository
- GitHub: `https://github.com/perfect-123/mindmap` (originally `prospersa1/MindMap`)
- Main branch: `main`
- Person C's branch: `feature/person-c-ar`
- Person B's branch: `chrome-extension` (merged to main 2026-03-28)
- Derrick does NOT have admin access to the repo (cannot enable GitHub Pages)

---

## AR Module

### File Structure
```
ar/
  ar.html         — HTML structure only (loads ../extension/shared.js, then app.js)
  style.css       — All CSS
  app.js          — All JavaScript (Three.js, Supabase, explode system)
  assets/
    brain.glb     — 3D brain model (~5MB)
```

### What it does
Displays a 3D brain model overlaid on the phone's front camera feed. The brain's colour, glow, pulse speed, and orbiting particles reflect the user's brain health state based on the last 7 days of browsing events pulled from Supabase. Tapping the brain explodes it into floating category breakdown labels; tapping again reassembles it.

### Brain States
| State | Condition | Color |
|---|---|---|
| Thriving | ≥55% learning | Cyan `#00ffcc` |
| Healthy | ≥35% learning | Blue `#88aaff` |
| Sluggish | ≥15% learning | Brown `#887766` |
| Rotting | <15% learning | Grey `#555555` |

State is calculated from the `events` table in Supabase (last 7 days, weighted by `duration`) using `ev.category` (set by Gemini via the extension). Learning + Productivity + News count toward the learning ratio. Thresholds and UI colours come from `MINDMAP.STATES`; the colours in the table above are the 3D material colours, which stay in `ar/app.js` `STATES` along with emissive/pulse/particle tuning.

With no data (or a failed fetch) the brain shows **Healthy** as a neutral state, the category breakdown is empty, the hint reads "No browsing data in the last 7 days", and tapping does not explode.

### Category System
Defined in `MINDMAP.CATEGORIES` (`extension/shared.js`). Unknown values and `uncategorized` are treated as `other`:

| Category | Brain state contribution | Colour |
|---|---|---|
| learning | learning | `#1D9E75` teal |
| entertainment | entertainment | `#D85A30` coral |
| social media | entertainment | `#E040FB` magenta |
| productivity | **learning** | `#378ADD` blue |
| news | **learning** | `#EF9F27` amber |
| other | entertainment | `#888780` grey |

### Tech Stack
- **Three.js 0.150.0** — 3D rendering via unpkg CDN, ES module import map (importmap stays in ar.html — cannot be in external JS)
- **GLTFLoader** — loads `brain.glb` 3D model
- **getUserMedia** — native camera feed as `<video>` fullscreen background
- **Three.js canvas** — overlaid with `alpha: true` (transparent background)
- **Supabase** — PostgreSQL backend, anon auth session for RLS access
- No build system — CDN imports only

### Key Architecture Decisions
- **Why not MindAR**: MindAR 1.2.2 crashes on iPhone Safari — TF.js/WASM bundle fails to execute (window.MINDAR.FACE undefined). Replaced with plain getUserMedia + Three.js overlay.
- **Why not WebXR**: iOS doesn't support `immersive-ar` session mode.
- **Camera overlay approach**: `<video>` fullscreen behind a transparent Three.js `<canvas>`. Simple, reliable, works on all mobile browsers.
- **GLTFLoader fallback**: If `brain.glb` fails to load, a glowing sphere is shown.
- **Supabase auth**: Must call `/auth/v1/signup` (anon session) first to get an `access_token` — the anon key alone is blocked by RLS.
- **Category classification**: AR reads `ev.category` from Supabase directly (set by Gemini in the extension). No keyword matching in AR.
- **brainModelBaseScale**: Brain GLTF is scaled to `0.6 / maxDim` at load time. Cached as `brainModelBaseScale` and used by the explode animation to restore exact original size on reassembly.
- **`crossorigin="anonymous"`**: Do NOT add this to script tags — causes CORS failures on Safari.

### Visual Effects
- **Glow sphere**: Slightly larger BackSide additive-blended sphere around brain. Opacity varies by state.
- **Orbiting particles**: THREE.Points cloud rotated each frame. Count/speed/size varies dramatically by state (80 fast for Thriving → 5 barely-moving for Rotting).
- **Brain pulse**: emissiveIntensity + pointLight intensity oscillate via sine wave. Speed varies by state.

### Tap-to-Explode Feature
- Tap brain → shockwave sphere expands, brain dissolves (scale burst to 1.8×, fade ~200ms), category labels spring out with staggered cascade
- Fragment labels: THREE.PlaneGeometry with CanvasTexture pill badges (256×128px)
- Fragments: elliptical arrangement (rx=0.27, ry=0.44) centred on brain — portrait-safe, always on screen
- Spring physics: stiffness 180, damping 12 + initial velocity burst (4–6.5 units/sec)
- Fragments spin during flight, snap to billboard (face camera) when settled
- Scale in with easeOutBack overshoot; idle bob amplitude 0.008 units
- `brainGroup.rotation` reset to 0 on explode — required for billboard math to work correctly
- Tap anywhere → fragments lerp back (dt-based, frame-rate independent), brain fades in from 0.7× scale
- AR state badge fades out during exploded state, fades back in on reassembly
- Debounce: 800ms between taps

### Current Status (as of 2026-03-28)
- [x] Camera AR working on iPhone Safari
- [x] Brain states + glow + particles working
- [x] Supabase live data wired up (anon session auth)
- [x] Tap-to-explode category breakdown working
- [x] Categories aligned with extension's Gemini classification
- [x] Merged main into feature/person-c-ar
- [x] Split into ar.html / style.css / app.js
- [x] Shared constants moved to `extension/shared.js`
- [ ] Face tracking (brain follows face position) — not implemented, MindAR dropped

### How to Test
```bash
# Locally: serve the repo root, open /ar/ar.html
python3 -m http.server 5173

# On a phone (HTTPS required for camera): drag a FRESH git clone of the
# repo root to app.netlify.com/drop, then open /ar/ar.html.
# Don't drag a working copy containing extension/config.js (Gemini key).
# Each drag creates a NEW URL — do not reuse old ones.
```

### Known Issues / History
- MindAR dropped — crashes on iOS Safari (TF.js WASM execution error, window.MINDAR.FACE undefined)
- WebXR dropped — iOS doesn't support immersive-ar
- `crossorigin="anonymous"` on script tags causes CORS failures on Safari — do not add it
- Netlify Drop creates a NEW URL each drag — do not reuse old URLs
- Three.js must stay at 0.150.0 (if MindAR is ever re-introduced, it bundles r150 internally)

---

## Extension Module (`extension/`)

### What it does
Chrome extension that tracks browsing events and stores them in Supabase. Uses Gemini to classify each page into a category.

### Classification
- Checks the local category cache (`chrome.storage.local` `category_cache`, keyed by URL without `#hash`, max 500 entries, oldest dropped first). On a hit the event is inserted with that category and Gemini is not called.
- On a miss: creates event immediately with `category: "uncategorized"`, calls Gemini 2.5 Flash in background, then patches the category field and caches it
- Only Gemini answers are cached; if Gemini fails (network or non-2xx), the local keyword fallback is used and not cached
- Valid categories: `learning`, `entertainment`, `social media`, `productivity`, `news`, `other`

### Key files
- `background.js` — service worker: tab tracking, Supabase writes, Gemini classification, owns the Supabase session (answers `{type: 'getSession'}` messages)
- `newtab.html` / `newtab.js` — new tab override: clock, greeting, daily Unsplash background, brain score widget. The score's totals are cached in `chrome.storage.local` `brain_score_cache` for 5 minutes, so most new tabs make no request; on a miss it gets its session from the service worker via `chrome.runtime.sendMessage`.
- `shared.js` — shared constants (see top of this file)
- `config.example.js` — copy to `config.js` (gitignored) and add `GEMINI_API_KEY`
- `manifest.json` — MV3 manifest

### Known issues
- `newtab.js` `BASE_URL` is a hardcoded local `file://` path — dashboard/AR links only work on one machine.
- Tab-tracking state in `background.js` is in memory and is lost when the MV3 service worker is suspended.

---

## Supabase Schema
```sql
events (
  id,
  url           TEXT,
  title         TEXT,
  domain        TEXT,
  category      TEXT,    -- set by Gemini (learning/entertainment/social media/productivity/news/other)
  duration      INT,     -- seconds (NOT minutes)
  created_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  user_id       UUID
)
```

### RLS Policy (current)
```sql
CREATE POLICY "allow anon read"
ON events FOR SELECT
TO anon, authenticated
USING (true);
```
This lets any session read **all** users' events. The dashboard and AR also create a new anonymous user on every load, so their scores reflect everyone's data. Planned fix: `USING (auth.uid() = user_id)` plus passing the extension's session/user to the dashboard and AR.

## Supabase Credentials
- URL: `https://sagbrkjfdqxqndrfekkp.supabase.co`
- Anon key: in `extension/shared.js` (safe — anon key is public)
- Service role key: never expose, never commit
