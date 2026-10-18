// Shared constants for the service worker and the extension pages.
// Plain classic script (no import/export):
//   service worker  → importScripts('sites.js', 'shared.js')
//   extension pages → <script src="sites.js"> then <script src="shared.js">
// Everything lives on one global, MINDMAP.

const MINDMAP = (() => {
  // Built-in categories. classifyLocally() and sites.js return only these keys.
  // Order = stacking/legend order. Colours are the dataviz reference palette's
  // dark steps, and this order was chosen because it passes the palette
  // validator on the #0d1424 surface (adjacent CVD ΔE 9.4, normal-vision 19.3).
  // Re-validate if you change a colour or the order. "Other" is a deliberate
  // de-emphasis grey, not an identity hue.
  const BUILT_IN = [
    { key: 'learning',      label: 'Learning',      color: '#199e70', learning: true },
    { key: 'entertainment', label: 'Entertainment', color: '#d95926', learning: false },
    { key: 'productivity',  label: 'Productivity',  color: '#3987e5', learning: true },
    { key: 'news',          label: 'News',          color: '#c98500', learning: true },
    { key: 'social media',  label: 'Social Media',  color: '#d55181', learning: false },
    { key: 'other',         label: 'Other',         color: '#7d8494', learning: false },
  ];

  // User-made categories (stored in chrome.storage.local "custom_categories")
  // come after "Other" and get one of these three colours, kept for life so a
  // category never changes colour. These are the reference palette's
  // remaining dark steps; every pair that can end up adjacent passes the
  // validator (worst ΔE 8.6). That is also why there are at most three.
  const CUSTOM_COLORS = ['#008300', '#9085e9', '#e66767'];
  const MAX_CUSTOM = CUSTOM_COLORS.length;

  // Current list (built-in + custom). Refreshed by loadCategories()/readRows().
  let categories = [...BUILT_IN];
  let keys = categories.map(c => c.key);
  let learningKeys = new Set(categories.filter(c => c.learning).map(c => c.key));

  function setCustom(custom) {
    categories = [...BUILT_IN, ...(custom || [])];
    keys = categories.map(c => c.key);
    learningKeys = new Set(categories.filter(c => c.learning).map(c => c.key));
  }

  // Highest threshold first; `min` is the minimum learning ratio (0–1)
  // `color` is the status dot (always shown with the label, never alone).
  const STATES = [
    { key: 'thriving', label: 'Thriving', min: 0.55, color: '#00ffcc' },
    { key: 'healthy',  label: 'Healthy',  min: 0.35, color: '#88aaff' },
    { key: 'sluggish', label: 'Sluggish', min: 0.15, color: '#aa9988' },
    { key: 'rotting',  label: 'Rotting',  min: 0,    color: '#888888' },
  ];

  // Normalises a raw category value; unknown or "uncategorized" → "other"
  function normalizeCategory(raw) {
    const cat = (raw || '').toLowerCase().trim();
    return keys.includes(cat) ? cat : 'other';
  }

  function isLearning(category) {
    return learningKeys.has(normalizeCategory(category));
  }

  // Ratio (0–1) → state object from STATES
  function brainState(ratio) {
    return STATES.find(s => ratio >= s.min);
  }

  // ─── Custom categories ────────────────────────────────────────────────────
  async function loadCategories() {
    const { custom_categories = [] } = await chrome.storage.local.get('custom_categories');
    setCustom(custom_categories);
    return categories;
  }

  // Returns the new category, or throws with a message fit to show the user
  async function addCustomCategory(label, learning) {
    // Letters, numbers, spaces and - ' . + / only: labels end up in page markup
    label = (label || '').replace(/[^\p{L}\p{N} \-'.+/]/gu, '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!label) throw new Error('Give the category a name');
    const { custom_categories = [] } = await chrome.storage.local.get('custom_categories');
    if (custom_categories.length >= MAX_CUSTOM) throw new Error(`You can have up to ${MAX_CUSTOM} custom categories`);
    if ([...BUILT_IN, ...custom_categories].some(c => c.label.toLowerCase() === label.toLowerCase()))
      throw new Error('That category already exists');

    const used = new Set(custom_categories.map(c => c.color));
    const color = CUSTOM_COLORS.find(c => !used.has(c));
    const key = 'custom:' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
    const cat = { key, label, color, learning: !!learning };
    await chrome.storage.local.set({ custom_categories: [...custom_categories, cat] });
    setCustom([...custom_categories, cat]);
    return cat;
  }

  // Removing a category also removes the site assignments that pointed to it
  async function removeCustomCategory(key) {
    const { custom_categories = [], category_overrides = {} } =
      await chrome.storage.local.get(['custom_categories', 'category_overrides']);
    const kept = custom_categories.filter(c => c.key !== key);
    for (const [domain, cat] of Object.entries(category_overrides)) {
      if (cat === key) delete category_overrides[domain];
    }
    await chrome.storage.local.set({ custom_categories: kept, category_overrides });
    setCustom(kept);
  }

  // ─── Site assignments ─────────────────────────────────────────────────────
  // Per-site categories set from the dashboard: { domain: category }.
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

  // "https://www.Example.com/path" → "example.com"; '' if it isn't a hostname
  function cleanDomain(input) {
    let host = (input || '').trim().toLowerCase();
    try { host = new URL(host.includes('://') ? host : 'https://' + host).hostname; } catch (_) { return ''; }
    host = host.replace(/^www\./, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : '';
  }

  // ─── Local data (written by tracker.js) ───────────────────────────────────
  // Last `days` calendar days including today → one row per stored bucket:
  // { domain, cat, dur (seconds), dk ('YYYY-MM-DD'), hour }.
  // Category priority: your site assignment → the stored label → for time
  // stored as "other", the current site list (so new rules apply to old days).
  async function readRows(days) {
    const dayKeys = [];
    for (let i = 0; i < days; i++) {
      dayKeys.push('day:' + new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA'));
    }
    const stored = await chrome.storage.local.get([...dayKeys, 'category_overrides', 'custom_categories']);
    setCustom(stored.custom_categories);
    const overrides = stored.category_overrides || {};

    const rows = [];
    for (const key of dayKeys) {
      for (const [bucket, secs] of Object.entries(stored[key] || {})) {
        const [hour, domain, category] = bucket.split('|');
        let cat = overrides[domain] ?? category;
        if (normalizeCategory(cat) === 'other' && !(domain in overrides)) {
          cat = MINDMAP_SITES.lookup(domain)?.category ?? 'other';
        }
        rows.push({ domain, cat: normalizeCategory(cat), dur: secs, dk: key.slice(4), hour: Number(hour) });
      }
    }
    return rows;
  }

  // ─── Background scenes ────────────────────────────────────────────────────
  // The new tab's momiji scenes. Both pages read the same choice, so the
  // dashboard and the brain-health tiles take the scene's colours (theme.css
  // :root[data-scene=…]). Stored in the pages' localStorage as 'auto' or a key.
  const SCENES = [
    { key: 'spring', label: 'Spring' },
    { key: 'autumn', label: 'Autumn' },
    { key: 'dry',    label: 'Dry' },
    { key: 'faded',  label: 'Faded' },
  ];
  const BG_MODE_KEY = 'mindmap_bg_mode';

  // Auto follows the day: fresh morning, hazy afternoon, golden evening, dim night
  function sceneForHour(h24) {
    if (h24 >= 5  && h24 < 12) return 'spring';
    if (h24 >= 12 && h24 < 17) return 'dry';
    if (h24 >= 17 && h24 < 21) return 'autumn';
    return 'faded';
  }

  // 'auto' or a scene key; pages only (the service worker has no localStorage)
  function getSceneMode() {
    let mode = 'auto';
    try { mode = localStorage.getItem(BG_MODE_KEY) || 'auto'; } catch (_) {}
    return mode === 'auto' || SCENES.some(s => s.key === mode) ? mode : 'auto';
  }

  function setSceneMode(mode) {
    try { localStorage.setItem(BG_MODE_KEY, mode); } catch (_) {}
  }

  function sceneFor(mode) {
    return mode === 'auto' ? sceneForHour(new Date().getHours()) : mode;
  }

  return {
    get CATEGORIES() { return categories; },
    get CATEGORY_KEYS() { return keys; },
    STATES, MAX_CUSTOM,
    normalizeCategory, isLearning, brainState,
    loadCategories, addCustomCategory, removeCustomCategory,
    getCategoryOverrides, setCategoryOverride, cleanDomain, readRows,
    SCENES, sceneForHour, getSceneMode, setSceneMode, sceneFor,
  };
})();
