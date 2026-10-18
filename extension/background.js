// Service worker entry point. All tracking lives in tracker.js.
importScripts("sites.js", "shared.js", "tracker.js");

// The new tab no longer fetches a daily Unsplash photo; drop its old cache
chrome.runtime.onInstalled.addListener(() => chrome.storage.local.remove("unsplash_cache"));

// ─── Classification ─────────────────────────────────────────────────────────
// Free and local. The site list (sites.js) decides first; for unknown or
// "mixed" sites (YouTube…) title keywords get a say; mixed sites then fall
// back to their default, everything else to "other".
function classifyLocally(url, title) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch (_) {}

  const site = MINDMAP_SITES.lookup(host);
  if (site && !site.mixed) return site.category;

  const text = (title || "").toLowerCase();
  if (/tutorial|course|lecture|lesson|documentation|how[ -]to|explained?|guide|learn\b|crash course|walkthrough/.test(text))
    return "learning";
  if (/breaking news|headlines|politics|live updates/.test(text)) return "news";
  if (/\bgame\b|gaming|meme|funny|comedy|music video|trailer|highlights/.test(text))
    return "entertainment";

  return site ? site.category : "other";
}
