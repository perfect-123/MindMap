// ── Config ──────────────────────────────────────────────────────────────────

const DASHBOARD_URL = chrome.runtime.getURL('dashboard.html');

// ── Background — one momiji scene, by time of day or picked by the user ─────
// The choice lives in localStorage (synchronous, so the scene is set before
// first paint): 'auto', or the key of the scene the user picked. Under the
// tile, the Scene button steps through SCENES and the Auto switch toggles.
const BG_MODE_KEY = 'mindmap_bg_mode';
const SCENES = [
  { key: 'spring', label: 'Spring' },
  { key: 'autumn', label: 'Autumn' },
  { key: 'dry',    label: 'Dry' },
  { key: 'faded',  label: 'Faded' },
];

// Auto follows the day: fresh morning, hazy afternoon, golden evening, dim night
function sceneForHour(h24) {
  if (h24 >= 5  && h24 < 12) return 'spring';
  if (h24 >= 12 && h24 < 17) return 'dry';
  if (h24 >= 17 && h24 < 21) return 'autumn';
  return 'faded';
}

let bgMode = 'auto';
try {
  bgMode = localStorage.getItem(BG_MODE_KEY) || 'auto';
  localStorage.removeItem('mindmap_bg'); // old brain-state cache
} catch {}
if (bgMode !== 'auto' && !SCENES.some((s) => s.key === bgMode)) bgMode = 'auto';

const bgName = document.getElementById('bg-name');
const bgAuto = document.getElementById('bg-auto');

function currentScene() {
  return bgMode === 'auto' ? sceneForHour(new Date().getHours()) : bgMode;
}

function applyBackground() {
  const scene = currentScene();
  if (document.body.dataset.bg === scene && bgName.textContent) return;
  document.body.dataset.bg = scene;
  bgName.textContent = SCENES.find((s) => s.key === scene).label;
}

function setBgMode(mode) {
  bgMode = mode;
  try { localStorage.setItem(BG_MODE_KEY, bgMode); } catch {}
  bgAuto.setAttribute('aria-checked', String(bgMode === 'auto'));
  applyBackground();
}

// Picking a scene turns Auto off
document.getElementById('bg-picker').addEventListener('click', () => {
  const i = SCENES.findIndex((s) => s.key === currentScene());
  setBgMode(SCENES[(i + 1) % SCENES.length].key);
});
// Turning Auto off keeps the scene that's showing
bgAuto.addEventListener('click', () => setBgMode(bgMode === 'auto' ? currentScene() : 'auto'));

bgAuto.setAttribute('aria-checked', String(bgMode === 'auto'));
applyBackground();

// ── Greeting ─────────────────────────────────────────────────────────────────
// Each greeting is [text, ending]; the name (if set) goes before the ending,
// so "Still up?" becomes "Still up, Perfect?".
const GREETINGS = {
  earlyMorning: [ // 5am–8am
    ['Rise and shine', '.'],
    ['Early start today', '.'],
    ['Up with the sun', '.'],
    ['Morning, early bird', '.'],
  ],
  morning: [ // 8am–12pm
    ['Good morning', '.'],
    ['Welcome back', '.'],
    ['Hope you slept well', '.'],
    ['Ready for the day', '?'],
  ],
  afternoon: [ // 12pm–5pm
    ['Good afternoon', '.'],
    ['Welcome back', '.'],
    ['Hope the day is treating you well', '.'],
    ['Afternoon check-in', '.'],
  ],
  evening: [ // 5pm–8pm
    ['Good evening', '.'],
    ['Welcome back', '.'],
    ['Winding down', '?'],
    ['Hope today was a good one', '.'],
  ],
  lateNight: [ // 8pm–12am
    ['Burning the midnight oil', '?'],
    ['Late night session', '?'],
    ['Still going strong', '.'],
    ['Night owl mode', '.'],
  ],
  veryLate: [ // 12am–5am
    ['You should probably sleep', '.'],
    ['Still up', '?'],
    ['The grind never stops', '.'],
    ['Late night, huh', '?'],
  ],
};

function greetingPool(h24) {
  if (h24 >= 5  && h24 < 8)  return GREETINGS.earlyMorning;
  if (h24 >= 8  && h24 < 12) return GREETINGS.morning;
  if (h24 >= 12 && h24 < 17) return GREETINGS.afternoon;
  if (h24 >= 17 && h24 < 20) return GREETINGS.evening;
  if (h24 >= 20)             return GREETINGS.lateNight;
  return GREETINGS.veryLate;
}

// Picked once per tab so it doesn't change while the page is open
const pool = greetingPool(new Date().getHours());
const [GREETING_TEXT, GREETING_END] = pool[Math.floor(Math.random() * pool.length)];
const greetingEl = document.getElementById('greeting');

function renderGreeting(name) {
  greetingEl.textContent = `${GREETING_TEXT}${name ? `, ${name}` : ''}${GREETING_END}`;
}

// The name is stored locally; click the greeting to set or change it
async function initGreeting() {
  let { user_name = '' } = await chrome.storage.local.get('user_name');
  renderGreeting(user_name);
  greetingEl.title = user_name ? 'Click to change your name' : 'Click to add your name';

  greetingEl.addEventListener('click', () => {
    if (greetingEl.querySelector('input')) return;
    const input = document.createElement('input');
    input.className = 'name-input';
    input.placeholder = 'Your name';
    input.maxLength = 30;
    input.value = user_name;
    greetingEl.replaceChildren(input);
    input.focus();
    let finished = false;
    const done = async (save) => {
      if (finished) return;
      finished = true;
      if (save) {
        user_name = input.value.trim();
        await chrome.storage.local.set({ user_name });
        greetingEl.title = user_name ? 'Click to change your name' : 'Click to add your name';
      }
      renderGreeting(user_name);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(true);
      if (e.key === 'Escape') done(false);
    });
    input.addEventListener('blur', () => done(true), { once: true });
  });
}

// ── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h24 = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('time-digits').textContent = `${h24 % 12 || 12}:${m}`;
  document.getElementById('ampm').textContent = h24 < 12 ? 'AM' : 'PM';
  applyBackground(); // Auto moves to the next scene when the hour crosses a boundary
}
updateClock();
setInterval(updateClock, 10_000);

// ── Favorites — your own sites as a text row, top-right ─────────────────────
// Stored in chrome.storage.local "favorites" as [{ url, name }], up to FAV_MAX;
// FAV_PRESETS until the user saves a list. On hover each name gets a faint
// underline in its site's category colour, by the same rules as the dashboard
// (your site assignment first, then the built-in site list).
const FAV_MAX = 8;
const FAV_PRESETS = [
  { url: 'https://www.youtube.com/',  name: 'YouTube' },
  { url: 'https://leetcode.com/',     name: 'LeetCode' },
  { url: 'https://x.com/',            name: 'X' },
  { url: 'https://github.com/',       name: 'GitHub' },
  { url: 'https://open.spotify.com/', name: 'Spotify' },
];
const favList = document.getElementById('fav-list');
const favDialog = document.getElementById('fav-dialog');
const favUrl = document.getElementById('fav-url');
const favName = document.getElementById('fav-name');
const favError = document.getElementById('fav-error');
let favorites = [];
let favEditing = -1; // index being edited, -1 when adding

// 'github.com' → 'https://github.com/'; null unless it's an http(s) address
function normalizeUrl(input) {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') ? url.href : null;
  } catch { return null; }
}

// 'https://www.github.com/' → 'Github'
function defaultName(url) {
  const parts = MINDMAP.cleanDomain(url).split('.');
  const word = parts[parts.length - 2] || parts[0] || 'Site';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function categoryColor(url, overrides) {
  const domain = MINDMAP.cleanDomain(url);
  const key = MINDMAP.normalizeCategory(overrides[domain] || MINDMAP_SITES.lookup(domain)?.category || 'other');
  return (MINDMAP.CATEGORIES.find((c) => c.key === key) || {}).color;
}

async function renderFavorites() {
  await MINDMAP.loadCategories();
  const overrides = await MINDMAP.getCategoryOverrides();
  const tiles = favorites.map((fav, i) => {
    const li = document.getElementById('fav-template').content.firstElementChild.cloneNode(true);
    li.dataset.i = i;
    const color = categoryColor(fav.url, overrides);
    if (color) li.querySelector('.fav-link').style.setProperty('--cat', color);
    li.querySelector('.fav-link').href = fav.url;
    li.querySelector('.fav-link').title = fav.url;
    li.querySelector('.fav-name').textContent = fav.name;
    li.querySelector('.fav-edit').setAttribute('aria-label', `Edit ${fav.name}`);
    li.querySelector('.fav-remove').setAttribute('aria-label', `Remove ${fav.name}`);
    return li;
  });
  if (favorites.length < FAV_MAX) {
    tiles.push(document.getElementById('fav-add-template').content.firstElementChild.cloneNode(true));
  }
  favList.replaceChildren(...tiles);
}

function saveFavorites() {
  chrome.storage.local.set({ favorites });
  renderFavorites();
}

function openFavDialog(i) {
  favEditing = i;
  document.getElementById('fav-title').textContent = i >= 0 ? 'Edit favorite' : 'Add a favorite';
  favUrl.value = i >= 0 ? favorites[i].url : '';
  favName.value = i >= 0 ? favorites[i].name : '';
  favError.textContent = '';
  favDialog.showModal();
}

favList.addEventListener('click', (e) => {
  const i = Number(e.target.closest('.fav')?.dataset.i ?? -1);
  if (e.target.closest('.fav-add')) openFavDialog(-1);
  else if (e.target.closest('.fav-edit')) openFavDialog(i);
  else if (e.target.closest('.fav-remove')) {
    favorites.splice(i, 1);
    saveFavorites();
  }
});

document.getElementById('fav-form').addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'save') return; // Cancel just closes
  const url = normalizeUrl(favUrl.value);
  if (!url) {
    e.preventDefault();
    favError.textContent = 'Enter a web address, like github.com';
    return;
  }
  const fav = { url, name: favName.value.trim().slice(0, 24) || defaultName(url) };
  if (favEditing >= 0) favorites[favEditing] = fav;
  else favorites.push(fav);
  saveFavorites();
});

async function initFavorites() {
  ({ favorites = FAV_PRESETS.slice() } = await chrome.storage.local.get('favorites'));
  renderFavorites();
}

// ── Brain score (last 7 days of local totals, same window as the dashboard) ──
async function fetchScoreTotals() {
  let total = 0, learning = 0;
  for (const row of await MINDMAP.readRows(7)) {
    total += row.dur;
    if (MINDMAP.isLearning(row.cat)) learning += row.dur;
  }
  return { total, learning };
}

async function loadBrainScore() {
  try {
    const { total, learning } = await fetchScoreTotals();

    const ratio = total > 0 ? learning / total : 0;
    const pct = Math.round(ratio * 100);
    const state = MINDMAP.brainState(ratio);

    const tile = document.getElementById('brain-widget');
    tile.style.setProperty('--c1', state.aura[0]);
    tile.style.setProperty('--c2', state.aura[1]);
    document.getElementById('score-num').innerHTML = total > 0 ? `${pct}<small>%</small>` : '—';
    const stateName = document.getElementById('state-name');
    stateName.innerHTML = total > 0
      ? `<span class="state-dot" style="background:${state.color}"></span>${state.label}`
      : 'No data yet';
    stateName.style.color = total > 0 ? state.color : '';
    document.getElementById('levels').innerHTML = MINDMAP.levelsHTML(ratio, total > 0, false);

    document.getElementById('brain-widget').classList.add('loaded');
  } catch (err) {
    console.warn('Brain score failed:', err);
    document.getElementById('state-name').textContent = 'Unavailable';
    document.getElementById('brain-widget').classList.add('loaded');
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.getElementById('brain-widget').addEventListener('click', () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});
initGreeting();
initFavorites();
loadBrainScore();
