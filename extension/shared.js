// Shared constants for the extension, dashboard and AR.
// Plain classic script (no import/export) so it loads everywhere:
//   service worker → importScripts('shared.js')
//   extension pages → <script src="shared.js">
//   dashboard / AR  → <script src="../extension/shared.js">
// Everything lives on one global, MINDMAP.

const MINDMAP = (() => {
  const SUPABASE_URL = 'https://sagbrkjfdqxqndrfekkp.supabase.co';
  // Anon key is public by design — access is scoped by RLS
  const SUPABASE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhZ2Jya2pmZHF4cW5kcmZla2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTkzNjgsImV4cCI6MjA5MDI5NTM2OH0.R3X09rKRcUES59xnLP_dsQacq6b5gg2QiTIfbTOeTxI';

  // Mirrors the categories Gemini is asked to choose from in background.js
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

  return {
    SUPABASE_URL, SUPABASE_KEY,
    CATEGORIES, CATEGORY_KEYS, LEARNING_CATEGORIES, STATES,
    normalizeCategory, isLearning, brainState,
  };
})();
