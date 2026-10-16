// Shared constants for the service worker and the extension pages.
// Plain classic script (no import/export):
//   service worker  → importScripts('shared.js')
//   extension pages → <script src="shared.js">
// Everything lives on one global, MINDMAP.

const MINDMAP = (() => {
  // classifyLocally() in background.js must return only these keys.
  // Order = stacking/legend order. Colours are the dataviz reference palette's
  // dark steps, and this order was chosen because it passes the palette
  // validator on the #0d1424 surface (adjacent CVD ΔE 9.4, normal-vision 19.3).
  // Re-validate if you change a colour or the order. "Other" is a deliberate
  // de-emphasis grey, not an identity hue.
  const CATEGORIES = [
    { key: 'learning',      label: 'Learning',      color: '#199e70' },
    { key: 'entertainment', label: 'Entertainment', color: '#d95926' },
    { key: 'productivity',  label: 'Productivity',  color: '#3987e5' },
    { key: 'news',          label: 'News',          color: '#c98500' },
    { key: 'social media',  label: 'Social Media',  color: '#d55181' },
    { key: 'other',         label: 'Other',         color: '#7d8494' },
  ];
  const CATEGORY_KEYS = CATEGORIES.map(c => c.key);

  // These count toward the learning ratio
  const LEARNING_CATEGORIES = new Set(['learning', 'productivity', 'news']);

  // Highest threshold first; `min` is the minimum learning ratio (0–1)
  // `color` is the status dot (always shown with the label, never alone).
  // `aura` is the two-tone blurred gradient behind the score "cover":
  // bright and cool when thriving, dull and ashen when rotting.
  const STATES = [
    { key: 'thriving', label: 'Thriving', min: 0.55, color: '#00ffcc', aura: ['#5ccfe6', '#1baf7a'] },
    { key: 'healthy',  label: 'Healthy',  min: 0.35, color: '#88aaff', aura: ['#7fb0e6', '#b0603f'] },
    { key: 'sluggish', label: 'Sluggish', min: 0.15, color: '#aa9988', aura: ['#8c7d70', '#9a4f33'] },
    { key: 'rotting',  label: 'Rotting',  min: 0,    color: '#888888', aura: ['#545b68', '#5e5650'] },
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
