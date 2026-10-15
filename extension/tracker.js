// Local active-time tracker. Loaded by background.js via importScripts.
// Needs classifyLocally() from background.js.
//
// Counts seconds only while: a Chrome window is focused, the active tab is an
// http(s) page, and the user is not idle (an audible tab still counts while
// idle, so videos aren't dropped). Totals are stored per local day:
//
//   chrome.storage.local  "day:YYYY-MM-DD" → { "hour|domain|category": seconds }
//
// The open segment lives in chrome.storage.session, so it survives the service
// worker being suspended. No timers: every Chrome event closes the open
// segment, credits it, and opens a new one if we should still be counting.

const IDLE_SECONDS = 300;              // no input for this long = idle
const MAX_SEGMENT_MS = 2 * 60 * 60e3;  // safety cap (e.g. a sleep we never heard about)
const KEEP_DAYS = 365;

chrome.idle.setDetectionInterval(IDLE_SECONDS);

function dayKey(date) {
  return "day:" + date.toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
}

function trackableDomain(url) {
  if (!url || !/^https?:/.test(url)) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    return null;
  }
}

// Splits [start, end) at hour boundaries and adds each piece to its day/hour bucket.
async function credit(segment, end) {
  const start = segment.start;
  end = Math.min(end, start + MAX_SEGMENT_MS);
  if (end <= start) return;

  const pieces = {}; // dayKey → { bucket: seconds }
  for (let t = start; t < end; ) {
    const d = new Date(t);
    const nextHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
    const until = Math.min(end, nextHour);
    const day = (pieces[dayKey(d)] ??= {});
    const bucket = `${d.getHours()}|${segment.domain}|${segment.category}`;
    day[bucket] = (day[bucket] || 0) + (until - t) / 1000;
    t = until;
  }

  const stored = await chrome.storage.local.get(Object.keys(pieces));
  for (const [key, add] of Object.entries(pieces)) {
    const day = stored[key] || {};
    for (const [bucket, secs] of Object.entries(add)) {
      day[bucket] = Math.round(((day[bucket] || 0) + secs) * 10) / 10;
    }
    stored[key] = day;
  }
  await chrome.storage.local.set(stored);
}

// What should be counted right now? Returns { domain, category } or null.
async function currentActivity() {
  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (!win?.focused) return null;

  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  const domain = trackableDomain(tab?.url);
  if (!domain) return null;

  const idle = await chrome.idle.queryState(IDLE_SECONDS);
  if (idle === "locked" || (idle === "idle" && !tab.audible)) return null;

  return { domain, category: classifyLocally(tab.url, tab.title || "") };
}

// Close the open segment, then open a new one if needed. `endAt` backdates the
// close (used for idle), but only when counting actually stops.
async function refresh(endAt) {
  const { tracker_segment: open } = await chrome.storage.session.get("tracker_segment");
  const activity = await currentActivity();
  const now = Date.now();
  const continues = activity && open && activity.domain === open.domain && activity.category === open.category;

  if (open) await credit(open, continues ? now : Math.max(open.start, endAt ?? now));

  if (continues) {
    await chrome.storage.session.set({ tracker_segment: { ...open, start: now } });
  } else if (activity) {
    await chrome.storage.session.set({ tracker_segment: { ...activity, start: now } });
  } else {
    await chrome.storage.session.remove("tracker_segment");
  }
}

// Events can arrive together; run refreshes one at a time so writes don't race.
let trackerQueue = Promise.resolve();
function queueRefresh(endAt) {
  trackerQueue = trackerQueue.then(() => refresh(endAt)).catch((err) => console.warn("Tracker:", err));
  return trackerQueue;
}

async function pruneOldDays() {
  const cutoff = dayKey(new Date(Date.now() - KEEP_DAYS * 86400e3));
  const keys = chrome.storage.local.getKeys
    ? await chrome.storage.local.getKeys()
    : Object.keys(await chrome.storage.local.get(null));
  const old = keys.filter((k) => k.startsWith("day:") && k < cutoff);
  if (old.length) await chrome.storage.local.remove(old);
}

chrome.tabs.onActivated.addListener(() => queueRefresh());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!tab.active) return;
  if (changeInfo.url || changeInfo.title || "audible" in changeInfo) queueRefresh();
});
chrome.windows.onFocusChanged.addListener(() => queueRefresh());
chrome.idle.onStateChanged.addListener((state) => {
  // "idle" fires IDLE_SECONDS after the last input; don't count that stretch
  queueRefresh(state === "idle" ? Date.now() - IDLE_SECONDS * 1000 : undefined);
});
chrome.runtime.onStartup.addListener(() => {
  queueRefresh();
  pruneOldDays();
});
chrome.runtime.onInstalled.addListener(() => queueRefresh());
