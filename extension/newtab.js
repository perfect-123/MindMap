// ── Config ──────────────────────────────────────────────────────────────────

const DASHBOARD_URL = chrome.runtime.getURL('dashboard.html');

// ── Clock ────────────────────────────────────────────────────────────────────
const USERNAME = 'User1'; // swap out once auth is implemented

const GREETINGS = {
  earlyMorning: [ // 5am–8am
    `Rise and shine`,
    `Early start today`,
    `Up with the sun`,
    `Good morning, early bird`,
  ],
  morning: [ // 8am–12pm
    `Good morning`,
    `Welcome back`,
    `Hope you slept well`,
    `Ready for the day`,
  ],
  afternoon: [ // 12pm–5pm
    `Good afternoon`,
    `Welcome back`,
    `Hope the day's treating you well`,
    `Afternoon check-in`,
  ],
  evening: [ // 5pm–8pm
    `Good evening`,
    `Welcome back`,
    `Winding down?`,
    `Hope today was productive`,
  ],
  lateNight: [ // 8pm–12am
    `Burning the midnight oil`,
    `Late night session`,
    `Still going strong`,
    `Night owl mode`,
  ],
  veryLate: [ // 12am–5am
    `You should probably sleep`,
    `Still up?`,
    `The grind never stops`,
    `Late night, huh`,
  ],
};

function pickGreeting(h24) {
  let pool;
  if      (h24 >= 5  && h24 < 8)  pool = GREETINGS.earlyMorning;
  else if (h24 >= 8  && h24 < 12) pool = GREETINGS.morning;
  else if (h24 >= 12 && h24 < 17) pool = GREETINGS.afternoon;
  else if (h24 >= 17 && h24 < 20) pool = GREETINGS.evening;
  else if (h24 >= 20 && h24 < 24) pool = GREETINGS.lateNight;
  else                             pool = GREETINGS.veryLate;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Pick once per tab open so it doesn't change every 10s
const SESSION_GREETING = pickGreeting(new Date().getHours());

function updateClock() {
  const now = new Date();
  const h24 = now.getHours();
  const h12 = h24 % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h24 < 12 ? 'AM' : 'PM';
  document.getElementById('clock').innerHTML = `<span id="time-digits">${h12}:${m}</span><span id="ampm">${ampm}</span>`;
  document.getElementById('greeting').textContent = `${SESSION_GREETING}, ${USERNAME}.`;
}
updateClock();
setInterval(updateClock, 10_000);

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
loadBrainScore();
