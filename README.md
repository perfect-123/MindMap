# 🧠 MindMap

> Your browsing diet, visualized. MindMap quietly tracks where your active time goes online and shows it back to you, without your history ever leaving your browser.

---

## What It Does

Screen Time stops at the app level: it can tell you that you spent three hours in Chrome, but not whether that was a course, the news, or endless scrolling. MindMap is a Chrome extension that fills that gap:

- **Silent tracking**: counts active time per site, pausing when you're idle or away from Chrome
- **New tab page**: clock, greeting, daily photo, and your 7-day brain score
- **Dashboard**: today's "nutrition label", category breakdowns, weekly trends, a time-of-day heatmap, top sites and a learning streak

Everything is stored locally in the browser. There's no account, no server and no AI service.

---

## Brain States

Based on the share of your active time over the last 7 days spent on **learning**, **productivity** and **news** sites:

| State | Condition |
|---|---|
| 🟦 Thriving | ≥55% |
| 🔵 Healthy | ≥35% |
| 🟫 Sluggish | ≥15% |
| ⬛ Rotting | <15% |

Pages are labelled Learning, Entertainment, Social Media, Productivity, News or Other by local keyword rules (domain first, then page title).

---

## Install

1. Clone the repo
2. Go to `chrome://extensions` and turn on **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder
4. Open a new tab. Click the brain score to open the dashboard

No build step, no API keys.

---

## Project Structure

```
extension/
  manifest.json          → MV3 manifest
  background.js          → Service worker entry + keyword classifier
  tracker.js             → Active-time tracker (idle-aware), daily totals in chrome.storage.local
  shared.js              → Shared constants (categories, colours, brain-state thresholds)
  newtab.html / .js      → New tab page
  dashboard.html / .js   → Dashboard
  vendor/chart.umd.js    → Chart.js 4.4.3
```

---

## Privacy

- Only daily totals are stored, as hour → site → category → seconds. No full URLs, page titles or browsing history.
- Data stays in `chrome.storage.local` and is kept for 365 days.
- The only network request is the new tab's daily background photo from Unsplash.

---

## Known Limitations

- Keyword classification is rough on mixed sites like YouTube; correcting a site's category from the dashboard is planned
- Watching or reading something silently for more than 5 minutes without input counts as idle
- If Chrome crashes, the time since the last tab switch is lost

---

## History

MindMap started as a hackathon project ([prospersa1/MindMap](https://github.com/prospersa1/MindMap)) with a Supabase backend, Gemini classification and an AR brain viewer for phones. This fork drops those for a simpler, private, local-only extension.

**Original team:** Perfect (Chrome extension & AI integration), Prosper (dashboard & Supabase backend), Derrick (AR brain experience).

**AI tools used (per MLH transparency rules):** Claude (Anthropic) for code assistance; Google Gemini API for page classification in the hackathon version.
