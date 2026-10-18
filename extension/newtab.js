// ── Config ──────────────────────────────────────────────────────────────────

const DASHBOARD_URL = chrome.runtime.getURL('dashboard.html');

// ── Background — one momiji scene, by time of day or picked by the user ─────
// The choice lives in localStorage (synchronous, so the scene is set before
// first paint): 'auto', or the key of the scene the user picked. Under the
// tile, the Scene button steps through SCENES and the Auto switch toggles.
const BG_MODE_KEY = 'mindmap_bg_mode';
const SCENES = [
  { key: 'thriving', label: 'Spring' },
  { key: 'healthy',  label: 'Autumn' },
  { key: 'sluggish', label: 'Dry' },
  { key: 'rotting',  label: 'Faded' },
];

// Auto follows the day: fresh morning, hazy afternoon, golden evening, dim night
function sceneForHour(h24) {
  if (h24 >= 5  && h24 < 12) return 'thriving';
  if (h24 >= 12 && h24 < 17) return 'sluggish';
  if (h24 >= 17 && h24 < 21) return 'healthy';
  return 'rotting';
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

// ── Search — goes to the user's default search engine ───────────────────────
document.getElementById('search').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = document.getElementById('q').value.trim();
  if (text) chrome.search.query({ text, disposition: 'CURRENT_TAB' });
});

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
    document.getElementById('state-name').innerHTML = total > 0
      ? `<span class="state-dot" style="background:${state.color}"></span>${state.label}`
      : 'No data yet';
    document.getElementById('state-sub').textContent = 'Learning share · open dashboard';

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
loadBrainScore();
