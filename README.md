# 🧠 MindMap

> Your browsing diet, visualized. MindMap quietly tracks where your active time goes online and shows it back to you, without your history ever leaving your browser.

---

## What It Does

Screen Time stops at the app level: it can tell you that you spent three hours in Chrome, but not whether that was a course, the news, or endless scrolling. MindMap is a Chrome extension that fills that gap:

- **Silent tracking**: counts active time per site, pausing when you're idle or away from Chrome
- **New tab page**: clock, greeting (click it to add your name), a search bar that uses your default search engine, a soft blurred wallpaper you can change (or have it follow your brain state), and your 7-day brain score as an album-cover tile
- **Dashboard**: today's "nutrition label", category breakdowns, weekly trends, a time-of-day heatmap, top sites and a learning streak

Everything is stored locally in the browser. There's no account and no server.

---

## Brain States

Based on the share of your active time over the last 7 days spent on **learning**, **productivity** and **news** sites (plus any custom category you mark as learning):

| State | Condition |
|---|---|
| 🟦 Thriving | ≥55% |
| 🔵 Healthy | ≥35% |
| 🟫 Sluggish | ≥15% |
| ⬛ Rotting | <15% |

Pages are labelled Learning, Entertainment, Social Media, Productivity, News or Other using a built-in list of ~200 sites (Canvas, LeetCode, Canva, Google Docs, YouTube…) and page-title keywords. In the dashboard's **Categories** panel you can assign any site to any category, and create up to three categories of your own, choosing whether each counts as learning.

---

## Install

MindMap isn't on the Chrome Web Store; you load it straight from this folder. It takes about a minute, with no build step and no API keys.

1. **Get the code**, either:
   - `git clone https://github.com/perfect-123/MindMap.git`, or
   - on GitHub, click **Code → Download ZIP** and unzip it
2. Open `chrome://extensions` and turn on **Developer mode** (top right)
3. Click **Load unpacked** and select the **`extension`** folder inside it (not the repo folder itself)
4. Open a new tab. If Chrome asks whether to keep the changed new tab page, choose **Keep it**

Keep the folder where it is: Chrome runs the extension from it.

### Updating

1. `git pull` (or download the ZIP again and replace the old folder)
2. On `chrome://extensions`, click the ↻ reload icon on **MindMap Tracker**
3. Open a fresh new tab

Reloading keeps your data. **Removing** the extension deletes it.

---

## Using It

- **Your name**: click the greeting on the new tab, type your name and press Enter
- **Search**: the search bar uses your default search engine. Chrome puts the cursor in the address bar on a new tab, so click the search bar first
- **Dashboard**: click the brain-score tile on the new tab
- **Wallpaper**: click the picture icon in the bottom-right corner of the new tab. Pick Dusk, Ocean, Forest, Ember or Mono, or **Brain** to have it follow your 7-day score: brighter when you're thriving, duller when you're not
- **Fix a site's category**: in the dashboard, pick a different category next to any site in **Top Sites**, or use the **Categories** panel to assign any site. This re-labels that site's whole history
- **Your own categories**: in the **Categories** panel, add up to three (e.g. "Job hunt") and choose whether each counts as learning
- **Hide Chrome's footer**: Chrome adds a "MindMap Tracker · Customize Chrome" bar to extension new tabs. Right-click it to hide it, or turn off **Show footer on New tab page** under **Customize Chrome**
- **Startup warning**: Chrome may occasionally warn about developer-mode extensions. Dismiss it to keep MindMap running

---

## Project Structure

```
extension/
  manifest.json          → MV3 manifest
  background.js          → Service worker entry + classifier
  sites.js               → Built-in site → category list
  tracker.js             → Active-time tracker (idle-aware), daily totals in chrome.storage.local
  shared.js              → Shared constants (categories, colours, brain-state thresholds)
  newtab.html / .js      → New tab page
  dashboard.html / .js   → Dashboard
  theme.css              → Shared look: blurred aura, film grain, monospace type
  wallpapers/            → New tab wallpapers (tiny pre-blurred colour fields)
  vendor/chart.umd.js    → Chart.js 4.4.3
tools/
  make_wallpapers.py     → Generates the wallpapers
```

---

## Privacy

- Only daily totals are stored, as hour → site → category → seconds. No full URLs, page titles or browsing history.
- Data stays in `chrome.storage.local` and is kept for 365 days.
- The extension makes no network requests at all.

---

## Known Limitations

- Mixed sites like YouTube are labelled from the page title, which is rough. Assign a site to a category in the dashboard to override it for its whole history
- Watching or reading something silently for more than 5 minutes without input counts as idle
- If Chrome crashes, the time since the last tab switch is lost

---

## Credits

Forked from [prospersa1/MindMap](https://github.com/prospersa1/MindMap), a hackathon project.
