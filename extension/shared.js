// Shared constants for the service worker and the extension pages.
// Plain classic script (no import/export):
//   service worker  → importScripts('shared.js')
//   extension pages → <script src="shared.js">
// Everything lives on one global, MINDMAP.

const MINDMAP = (() => {
  // classifyLocally() in background.js must return only these keys
  const CATEGORIES = [
    { key: 'learning',      label: 'Learning',      color: '#1D9E75' },
    { key: 'entertainment', label: 'Entertainment', color: '#D85A30' },
    { key: 'social media',  label: 'Social Media',  color: '#E040FB' },
    { key: 'productivity',  label: 'Productivity',  color: '#378ADD' },
    { key: 'news',          label: 'News',          color: '#EF9F27' },
    { key: 'other',         label: 'Other',         color: '#888780' },
  ];
  const CATEGORY_KEYS = CATEGORIES.map(c => c.key);

  // These count toward the learning ratio
  const LEARNING_CATEGORIES = new Set(['learning', 'productivity', 'news']);

  // Highest threshold first; `min` is the minimum learning ratio (0–1)
  const STATES = [
    { key: 'thriving', label: 'Thriving', min: 0.55, color: '#00ffcc' },
    { key: 'healthy',  label: 'Healthy',  min: 0.35, color: '#88aaff' },
    { key: 'sluggish', label: 'Sluggish', min: 0.15, color: '#aa9988' },
    { key: 'rotting',  label: 'Rotting',  min: 0,    color: '#888888' },
  ];

  // Normalises a raw category value; unknown or "uncategorized" → "other"
  function normalizeCategory(raw) {
    const cat = (raw || '').toLowerCase().trim();
    return CATEGORY_KEYS.includes(cat) ? cat : 'other';
  }

  function isLearning(category) {
    return LEARNING_CATEGORIES.has(normalizeCategory(category));
  }

  // Ratio (0–1) → state object from STATES
  function brainState(ratio) {
    return STATES.find(s => ratio >= s.min);
  }

  // ─── Local data (written by tracker.js) ───────────────────────────────────
  // Per-site category corrections set from the dashboard: { domain: category }.
  // Applied when data is read, so they also re-label past days.
  async function getCategoryOverrides() {
    const { category_overrides = {} } = await chrome.storage.local.get('category_overrides');
    return category_overrides;
  }

  // category null → back to the automatic label
  async function setCategoryOverride(domain, category) {
    const overrides = await getCategoryOverrides();
    if (category) overrides[domain] = normalizeCategory(category);
    else delete overrides[domain];
    await chrome.storage.local.set({ category_overrides: overrides });
  }

  // Last `days` calendar days including today → one row per stored bucket:
  // { domain, cat, dur (seconds), dk ('YYYY-MM-DD'), hour }, overrides applied.
  async function readRows(days) {
    const dayKeys = [];
    for (let i = 0; i < days; i++) {
      dayKeys.push('day:' + new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA'));
    }
    const stored = await chrome.storage.local.get([...dayKeys, 'category_overrides']);
    const overrides = stored.category_overrides || {};

    const rows = [];
    for (const key of dayKeys) {
      for (const [bucket, secs] of Object.entries(stored[key] || {})) {
        const [hour, domain, category] = bucket.split('|');
        rows.push({
          domain,
          cat: normalizeCategory(overrides[domain] ?? category),
          dur: secs,
          dk: key.slice(4),
          hour: Number(hour),
        });
      }
    }
    return rows;
  }

  return {
    CATEGORIES, CATEGORY_KEYS, LEARNING_CATEGORIES, STATES,
    normalizeCategory, isLearning, brainState,
    getCategoryOverrides, setCategoryOverride, readRows,
  };
})();
