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

## AR Module (`ar/index.html`)

### What it does
Displays a 3D brain model overlaid on the phone's front camera feed. The brain's colour, glow, pulse speed, and orbiting particles reflect the user's brain health state based on the last 7 days of browsing events pulled from Supabase. Tapping the brain explodes it into floating category breakdown labels; tapping again reassembles it.

### Brain States
| State | Condition | Color |
|---|---|---|
| Thriving | ≥70% learning content | Cyan `#00ffcc` |
| Healthy | ≥50% learning | Blue `#88aaff` |
| Sluggish | ≥30% learning | Brown `#887766` |
| Rotting | <30% learning | Grey `#555555` |

State is calculated from the `events` table in Supabase (last 7 days), using `title` and `domain` fields (NOT `category` — extension always writes `"uncategorized"`).

### Tech Stack
- **Three.js 0.150.0** — 3D rendering via unpkg CDN, ES module import map
- **GLTFLoader** — loads `brain.glb` 3D model
- **getUserMedia** — native camera feed as `<video>` fullscreen background
- **Three.js canvas** — overlaid with `alpha: true` (transparent background)
- **Supabase** — PostgreSQL backend, anon auth session for RLS access
- No build system — single HTML file, CDN imports only

### Key Architecture Decisions
- **Why not MindAR**: MindAR 1.2.2 crashes on iPhone Safari — TF.js/WASM bundle fails to execute (window.MINDAR.FACE undefined). Replaced with plain getUserMedia + Three.js overlay.
- **Why not WebXR**: iOS doesn't support `immersive-ar` session mode.
- **Camera overlay approach**: `<video>` fullscreen behind a transparent Three.js `<canvas>`. Simple, reliable, works on all mobile browsers.
- **GLTFLoader fallback**: If `brain.glb` fails to load, a glowing sphere is shown.
- **Supabase auth**: Must call `/auth/v1/signup` (anon session) first to get an `access_token` — the anon key alone is blocked by RLS. Extension uses the same pattern.
- **Category classification**: Extension writes `category = "uncategorized"` for all events. AR classifies using `title + domain` fields against LEARNING_KEYWORDS list.
- **brainModelBaseScale**: Brain GLTF is scaled to `0.6 / maxDim` at load time. This value is cached as `brainModelBaseScale` and used by the explode animation to restore exact original size on reassembly.

### Visual Effects
- **Glow sphere**: Slightly larger BackSide additive-blended sphere around brain. Opacity varies by state.
- **Orbiting particles**: THREE.Points cloud rotated each frame. Count/speed/size varies dramatically by state (80 fast particles for Thriving → 5 barely-moving for Rotting).
- **Brain pulse**: emissiveIntensity + pointLight intensity oscillate via sine wave. Speed varies by state.

### Tap-to-Explode Feature
- Tap brain → brain dissolves outward (scale burst to 1.3× + fade ~700ms) while category fragment labels spring out from centre
- Fragment labels: THREE.PlaneGeometry with CanvasTexture pill badges (256×128px), colour-coded by category
- Spring physics: stiffness 180, damping 12 — gives fast-out overshoot-and-settle feel
- Idle bob: amplitude 0.008 units, ~2.5s period, random phase per fragment
- Tap anywhere → fragments lerp back to centre, brain fades in (~800ms) from 0.8× scale
- AR state badge fades out during exploded state, fades back in on reassembly
- Debounce: 800ms between taps

### Category Colours (explode labels)
| Category | Keywords | Colour |
|---|---|---|
| Coding/Learning | coding, tutorial, education, programming, math, science, engineering, course, lecture, learn, how to, explainer, documentary, history | `#1D9E75` teal |
| Sport/Fitness | sport, fitness | `#378ADD` blue |
| Entertainment | entertainment, movies, TV, netflix, youtube | `#D85A30` coral |
| News/Politics | news, politics | `#7F77DD` purple |
| Music | music | `#EF9F27` amber |
| Other | anything else | `#888780` grey |

### Assets
- `ar/assets/brain.glb` — 3D brain model (~5MB)

### Current Status (as of 2026-03-28)
- [x] Camera AR working on iPhone Safari
- [x] Brain states + glow + particles working
- [x] Supabase live data wired up (anon session auth)
- [x] Tap-to-explode category breakdown working
- [x] Pushed to `feature/person-c-ar`
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
- `crossorigin="anonymous"` on script tags can cause CORS failures on Safari — do not add it
- Netlify Drop creates a NEW URL each drag — do not reuse old URLs
- Three.js must stay at 0.150.0 (if MindAR is ever re-introduced, it bundles r150 internally)

---

## Supabase Schema (actual, from Person B's extension)
```sql
events (
  id,
  url           TEXT,
  title         TEXT,    -- used for learning classification (category is always "uncategorized")
  domain        TEXT,    -- used for learning classification
  category      TEXT,    -- always "uncategorized" — do not use for classification
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
- Anon key: in `.env` (gitignored) and hardcoded in `ar/index.html` (safe — anon key is public)
- Service role key: never expose, never commit
