# MindMap — Claude Context

## Project Overview
MindMap is a multi-person collaborative project that visualizes brain health based on content consumption habits (learning vs entertainment ratio). It has three planned modules:

| Module | Folder | Status |
|---|---|---|
| AR Brain Viewer | `ar/` | In progress (Person C) |
| Dashboard | `dashboard/` | Not started |
| Chrome Extension | `extension/` | Not started |

## Team Structure
- **Person B** — Supabase backend (events table, API keys)
- **Person C** — AR experience (`ar/`) — this is Derrick's branch
- Other persons — dashboard, chrome extension

## Repository
- GitHub: `https://github.com/prospersa1/MindMap`
- Main branch: `main`
- Person C's branch: `feature/person-c-ar`
- Derrick does NOT have admin access to the repo (cannot enable GitHub Pages)

---

## AR Module (`ar/index.html`)

### What it does
Displays a 3D brain model in AR via the phone's front camera. The brain's color, glow, and pulse speed reflect the user's brain health state based on recent content consumption pulled from Supabase.

### Brain States
| State | Condition | Color |
|---|---|---|
| Thriving | ≥70% learning content | Cyan `#00ffcc` |
| Healthy | ≥50% learning | Blue `#88aaff` |
| Sluggish | ≥30% learning | Brown `#887766` |
| Rotting | <30% learning | Grey `#555555` |

State is calculated from `events` table in Supabase (last 7 days), using `category` and `duration_mins` fields.

### Tech Stack
- **MindAR.js 1.2.2** — face tracking AR (works on iPhone Safari + Android Chrome, free)
- **Three.js 0.150.0** — 3D rendering (must match MindAR's internal bundled version)
- **GLTFLoader** — loads `brain.glb` 3D model
- **Supabase** — backend data source (keys not yet wired up)
- No build system — single HTML file, CDN imports only

### Key Architecture Decisions
- **Why MindAR over WebXR**: Original WebXR hit-test only works on Android Chrome. MindAR face tracking works on iPhone Safari too.
- **Face tracking**: Brain floats above the user's head (anchored to face landmark 10 = forehead) — no marker image needed.
- **Three.js version must be 0.150.0**: MindAR 1.2.2 bundles Three.js r150 internally. Using a different version (e.g. r160) causes silent failures on iPhone Safari due to cross-version incompatibility.
- **Lazy MindAR init**: `MindARThree` is instantiated inside the Start AR click handler (not at page load) so initialization errors surface as visible messages rather than silent failures.
- **GLTFLoader fallback**: If `brain.glb` fails to load, a glowing sphere is shown instead so AR still demonstrates.

### Script loading order (important)
```html
<!-- 1. MindAR global (sets up window.MINDAR) -->
<script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-face-three.prod.js"></script>

<!-- 2. Import map — Three.js 0.150.0 to match MindAR's internal version -->
<script type="importmap">
{ "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.150.0/examples/jsm/"
}}
</script>

<!-- 3. Main module script -->
<script type="module">
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
```

### Assets needed
- `ar/assets/brain.glb` — 3D brain model (already added locally, ~5MB)
- Supabase keys from Person B (currently empty strings, falls back to 'thriving' demo state)

### Current Status (as of 2026-03-28)
- [x] Face tracking AR implemented with MindAR.js
- [x] Brain states + visual effects (pulse, glow, rotation) working
- [x] Camera permission flow with error messages
- [x] brain.glb added locally
- [ ] **Testing on iPhone Safari in progress** — camera permission prompt not triggering yet, actively debugging
- [ ] Supabase keys not yet provided by Person B
- [ ] Not yet committed/pushed latest fix (user is testing first)

### How to Test Locally
```bash
# In the MindMap root
npx serve ar/

# Then open http://10.11.29.45:<port> on phone (same WiFi)
# OR drag ar/ folder to app.netlify.com/drop for HTTPS (required for camera on mobile)
```

### Known Issues / History
- WebXR was the original approach — replaced with MindAR because iOS doesn't support `immersive-ar`
- Import map with `three@0.160.0` caused silent failures on iPhone — fixed by downgrading to `0.150.0`
- Global script approach (removing import map) also failed — reverted to ES module import map
- Netlify Drop creates a NEW URL each drag — do not reuse old URLs like `moonlit-bonbon-3c756a.netlify.app`
- `MindARThree` constructor must run inside a try/catch click handler, not at page load

---

## Supabase Schema (expected)
```sql
events (
  id,
  category        TEXT,   -- used for learning/entertainment classification
  duration_mins   INT,
  recorded_at     TIMESTAMPTZ
)
```
Learning keywords checked against `category`: coding, tutorial, education, science, documentary, language, math, programming, lecture, course, learn, history, engineering, how to, explainer.
