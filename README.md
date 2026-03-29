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
| 🟦 Thriving | ≥70% learning content | Cyan |
| 🔵 Healthy | ≥50% learning | Blue |
| 🟫 Sluggish | ≥30% learning | Brown |
| ⬛ Rotting | <30% learning | Grey |

---

## Features

- **Passive tracking** — runs in the background, zero manual input
- **AI categorisation** — Gemini API classifies every session into Coding/Learning, Entertainment, News, Sport, Music, or Other
- **Unlimited history** — no 7-day cap like native screen time
- **Live AR brain** — 3D brain overlaid on your front camera; colour, particles, and pulse reflect your current brain state
- **Tap-to-explode** — tap the brain to break it apart into floating category breakdown cards; tap again to reassemble
- **Dashboard** — charts, weekly trends, and heatmaps of your consumption habits

---

## Tech Stack

| Layer | Technology |
|---|---|
| Chrome Extension | Manifest V3, Service Worker |
| AI Classification | Google Gemini API |
| Database & Auth | Supabase (PostgreSQL + RLS) |
| AR / 3D | Three.js 0.150.0, GLTFLoader, getUserMedia |
| Dashboard | React (Vite), Recharts |
| Deployment | Netlify |

---

## How It Works

1. You browse normally — the extension captures the URL, title, domain, and time spent
2. Gemini classifies the session into a category in the background
3. Data is stored in Supabase, scoped to your anonymous session
4. The AR brain fetches the last 7 days of events and computes your brain state live
5. The dashboard shows your full history with breakdowns and trends

---

## Project Structure

```
/extension     → Chrome Extension (tracking + Gemini AI)
/dashboard     → React app (analytics & charts)
/ar            → AR brain experience (Three.js + getUserMedia)
```

---

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/prospersa1/MindMap.git
cd MindMap
```

### 2. Set up the Chrome Extension
```bash
# Add your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > extension/.env

# Generate the local config (requires Node.js)
node extension/generate-config.js
```
Then go to `chrome://extensions` → Enable Developer Mode → **Load unpacked** → select the `/extension` folder.

### 3. Run the Dashboard
```bash
cd dashboard
npm install
npm run dev
```

### 4. Test the AR Brain
Drag the `/ar` folder to [app.netlify.com/drop](https://app.netlify.com/drop) — HTTPS is required for camera access on mobile. Open the URL on your phone.

> **Note:** Each Netlify Drop creates a new URL — do not reuse old ones.

---

## Security

- API keys are stored in a gitignored `.env` file and a locally generated `config.js` — neither is ever committed
- Supabase uses anonymous session auth with RLS policies — no login required, no personal data exposed
- The Supabase anon key is safe to expose publicly (it is scoped by RLS)

---

## Known Limitations

- Face tracking is not implemented — MindAR was dropped due to crashes on iOS Safari (TF.js/WASM failure). The AR uses a getUserMedia + Three.js overlay instead.
- WebXR is not used — iOS does not support `immersive-ar` session mode
- Dashboard is in progress

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
- **Google Gemini API** — runtime content classification (core feature)

---

## Team

| Name | Role |
|---|---|
| Perfect | Chrome Extension & AI Integration |
| Prosper | Dashboard & Backend (Supabase) |
| Derrick | AR Brain Experience |
