// ── Config ──────────────────────────────────────────────────────────────────

const DASHBOARD_URL = chrome.runtime.getURL('dashboard.html');

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

// Returns the brain-state key ('thriving'…), or null when there's no data yet
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
    return total > 0 ? state.key : null;
  } catch (err) {
    console.warn('Brain score failed:', err);
    document.getElementById('state-name').textContent = 'Unavailable';
    document.getElementById('brain-widget').classList.add('loaded');
    return null;
  }
}

// ── Wallpaper ────────────────────────────────────────────────────────────────
// Saved in chrome.storage.local "wallpaper"; "brain" follows the 7-day state.
const bg = document.getElementById('bg');
let brainStateKey = null;

function applyWallpaper(key) {
  bg.style.backgroundImage = `url(${MINDMAP.wallpaperFile(key, brainStateKey)})`;
  bg.classList.add('ready');
  for (const opt of document.querySelectorAll('.wp-opt')) {
    opt.setAttribute('aria-checked', String(opt.dataset.key === key));
  }
}

function initWallpaperPicker(current) {
  const btn = document.getElementById('wp-btn');
  const panel = document.getElementById('wp-panel');
  const grid = document.getElementById('wp-grid');

  // Swatch images only load when the panel is first opened
  grid.innerHTML = MINDMAP.WALLPAPERS.map(w => `
    <button class="wp-opt" role="radio" data-key="${w.key}" aria-checked="${w.key === current}">
      <span class="wp-swatch${w.key === 'brain' ? ' wp-brain' : ''}"></span>
      <span class="wp-label">${w.label}</span>
    </button>`).join('');

  const setOpen = (open) => {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      for (const s of grid.querySelectorAll('.wp-opt:not([data-key="brain"]) .wp-swatch')) {
        s.style.backgroundImage ||= `url(${MINDMAP.wallpaperFile(s.parentElement.dataset.key)})`;
      }
    }
  };
  btn.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.wp')) setOpen(false); });

  grid.addEventListener('click', async (e) => {
    const opt = e.target.closest('.wp-opt');
    if (!opt) return;
    await chrome.storage.local.set({ wallpaper: opt.dataset.key });
    applyWallpaper(opt.dataset.key);
  });
}

async function initWallpaper() {
  const { wallpaper = 'dusk' } = await chrome.storage.local.get('wallpaper');
  initWallpaperPicker(wallpaper);
  if (wallpaper !== 'brain') applyWallpaper(wallpaper);
  brainStateKey = await loadBrainScore();
  if (wallpaper === 'brain') applyWallpaper(wallpaper);
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.getElementById('brain-widget').addEventListener('click', () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});
initGreeting();
initWallpaper(); // also loads the brain score
