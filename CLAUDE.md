# MindMap — Claude Context

## Project Overview
MindMap is a multi-person collaborative project that visualizes brain health based on content consumption habits (learning vs entertainment ratio). It has three planned modules:

| Module | Folder | Status |
|---|---|---|
| AR Brain Viewer | `ar/` | Working (Person C) |
| Dashboard | `dashboard/` | Not started |
| Chrome Extension | `extension/` | Done (Person B) |

## Team Structure
- **Person B** — Chrome extension + Supabase backend (`extension/`)
- **Person C** — AR experience (`ar/`) — this is Derrick's branch
- Other persons — dashboard

## Repository
- GitHub: `https://github.com/prospersa1/MindMap`
- Main branch: `main`
- Person C's branch: `feature/person-c-ar`
- Person B's branch: `chrome-extension` (merged to main 2026-03-28)
- Derrick does NOT have admin access to the repo (cannot enable GitHub Pages)

---

## AR Module

### File Structure
```
ar/
  index.html      — HTML structure only (46 lines)
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

State is calculated from the `events` table in Supabase (last 7 days) using `ev.category` (set by Gemini via the extension). Learning + Productivity + News count toward the learning ratio.

### Category System
Categories mirror the extension's `VALID_CATEGORIES` (classified by Gemini):

| Category | Brain state contribution | Colour |
|---|---|---|
| learning | learning | `#1D9E75` teal |
| entertainment | entertainment | `#D85A30` coral |
| social media | entertainment | `#E040FB` magenta |
| productivity | **learning** | `#378ADD` blue |
| news | **learning** | `#EF9F27` amber |
| other | entertainment | `#888780` grey |

### Tech Stack
- **Three.js 0.150.0** — 3D rendering via unpkg CDN, ES module import map (importmap stays in index.html — cannot be in external JS)
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
- [x] Split into index.html / style.css / app.js
- [ ] Face tracking (brain follows face position) — not implemented, MindAR dropped
- [ ] Merge to main pending

### How to Test
```bash
# Drag ar/ folder to app.netlify.com/drop
# Opens HTTPS URL — required for camera on mobile
# Each drag creates a NEW URL — do not reuse old ones
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
- Creates event immediately with `category: "uncategorized"`
- Calls Gemini 2.5 Flash in background, then patches the category field
- Valid categories: `learning`, `entertainment`, `social media`, `productivity`, `news`, `other`

### Key files
- `background.js` — service worker: tab tracking, Supabase writes, Gemini classification
- `manifest.json` — MV3 manifest

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

### RLS Policy required
```sql
CREATE POLICY "allow anon read"
ON events FOR SELECT
TO anon, authenticated
USING (true);
```

## Supabase Credentials
- URL: `https://sagbrkjfdqxqndrfekkp.supabase.co`
- Anon key: hardcoded in `ar/app.js` (safe — anon key is public)
- Service role key: never expose, never commit
