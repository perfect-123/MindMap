# 🧠 MindMap

> Your brain health, visualized. MindMap tracks what you consume online and reflects it back as a living, breathing 3D brain.

**Live AR Demo:** [Deploy via Netlify Drop] · **Repo:** [github.com/prospersa1/MindMap](https://github.com/prospersa1/MindMap)

---

## What It Does

Most phones have a Screen Time feature — but it only goes back a few days and stops at the app level. It tells you how long you spent in Chrome, not *what* you were actually consuming inside it. There's no equivalent for web browsing, which is where people spend a huge chunk of their time.

MindMap fixes that. It passively tracks your browsing in the background, uses AI to classify everything you visit, stores it indefinitely, and visualises your brain health in real time through:

- **A Chrome Extension** that silently logs every browsing session
- **A Dashboard** showing category breakdowns, weekly trends, and time-of-day patterns
- **An AR Brain** that changes colour, glow, and pulse speed based on your learning-to-entertainment ratio over the last 7 days — tap it to explode it into floating category labels

---

## Brain States

| State | Condition | Colour |
|---|---|---|
| 🟦 Thriving | ≥55% learning content | Cyan |
| 🔵 Healthy | ≥35% learning | Blue |
| 🟫 Sluggish | ≥15% learning | Brown |
| ⬛ Rotting | <15% learning | Grey |

"Learning content" is time spent on **learning**, **productivity** and **news** pages, over the last 7 days.

---

## Features

- **Passive tracking** — runs in the background, zero manual input
- **Categorisation** — every page is labelled Learning, Entertainment, Social Media, Productivity, News, or Other by a free local keyword classifier. A daily server-side AI pass to refine these labels and summarise the previous day is planned
- **Unlimited history** — no 7-day cap like native screen time
- **Live AR brain** — 3D brain overlaid on your front camera; colour, particles, and pulse reflect your current brain state
- **Tap-to-explode** — tap the brain to break it apart into floating category breakdown cards; tap again to reassemble
- **Dashboard** — charts, weekly trends, and heatmaps of your consumption habits
- **New tab page** — clock, daily Unsplash background, and your current brain score

---

## Tech Stack

| Layer | Technology |
|---|---|
| Chrome Extension | Manifest V3, Service Worker, new tab override |
| Classification | Local keyword rules (daily AI batch planned) |
| Database & Auth | Supabase (PostgreSQL + RLS) |
| AR / 3D | Three.js 0.150.0, GLTFLoader, getUserMedia |
| Dashboard | Single HTML page, Chart.js (CDN) |
| Deployment | Netlify |

---

## How It Works

1. You browse normally — the extension captures the URL, title, domain, and time spent
2. A local keyword classifier labels it instantly — no AI calls from the browser
3. Data is stored in Supabase, scoped to your anonymous session
4. The AR brain fetches the last 7 days of events and computes your brain state live
5. The dashboard shows your full history with breakdowns and trends

---

## Project Structure

```
index.html               → Landing page linking to the dashboard and AR
/extension
  shared.js              → Shared constants (Supabase config, categories, brain states)
  background.js          → Service worker: tab tracking, Supabase writes, keyword classification
  newtab.html / .js      → New tab page
/dashboard/dashboard.html → Analytics & charts
/ar                      → AR brain experience (Three.js + getUserMedia)
```

`extension/shared.js` is loaded by the extension, the dashboard and the AR page, so categories, colours and brain-state thresholds are defined once. Change them there.

---

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/prospersa1/MindMap.git
cd MindMap
```

### 2. Set up the Chrome Extension
Go to `chrome://extensions` → Enable Developer Mode → **Load unpacked** → select the `/extension` folder.

### 3. Run the Dashboard
Serve the **repo root** (the dashboard loads `../extension/shared.js`):
```bash
python3 -m http.server 5173
```
Then open http://localhost:5173/dashboard/dashboard.html.

### 4. Test the AR Brain
The AR page loads `../extension/shared.js`, so deploy the **repo root**, not just `/ar`. HTTPS is required for camera access on mobile. Either connect the GitHub repo to Netlify, or drag a **fresh `git clone`** to [app.netlify.com/drop](https://app.netlify.com/drop) and open `/ar/ar.html` on your phone.

> Each Netlify Drop creates a new URL — do not reuse old ones.

---

## Security

- The extension holds no AI API keys — classification is local
- Supabase uses anonymous session auth with RLS policies — no login required, no personal data exposed
- The Supabase anon key is safe to expose publicly (it is scoped by RLS)

---

## Known Limitations

- Face tracking is not implemented — MindAR was dropped due to crashes on iOS Safari (TF.js/WASM failure). The AR uses a getUserMedia + Three.js overlay instead.
- WebXR is not used — iOS does not support `immersive-ar` session mode
- The current RLS policy lets any session read all events, and the dashboard/AR create a fresh anonymous session per visit — so scores reflect everyone's data, not just yours. Per-user scoping is pending.

---

## What's Next

- Standalone mobile app (iOS + Android) alongside the extension
- Face tracking — brain follows your face position
- Push notifications for unhealthy consumption streaks
- Deeper AI insights and personalised recommendations

---

## AI Tools Used

In the spirit of MLH transparency rules, we used the following AI tools during the hackathon:

- **Claude (Anthropic)** — code assistance, debugging, architecture decisions
- **Google Gemini API** — page classification (used during the hackathon; removed from the extension in favour of a planned daily server-side batch)

---

## Team

| Name | Role |
|---|---|
| Perfect | Chrome Extension & AI Integration |
| Prosper | Dashboard & Backend (Supabase) |
| Derrick | AR Brain Experience |
