// ── Config ──────────────────────────────────────────────────────────────────
const UNSPLASH_ACCESS_KEY = 'oOEF298YzIVrddPb5UuQVpT9tSIqVggfaLnlBdU6W1Q';
const { SUPABASE_URL, SUPABASE_KEY } = MINDMAP; // from shared.js

// ── App URLs — update to your Netlify URL when deployed ─────────────────────
const BASE_URL = 'file:///Users/perfectackah/MindMap-1';
const DASHBOARD_URL = `${BASE_URL}/dashboard/dashboard.html`;
const AR_URL = `${BASE_URL}/ar/ar.html`;

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

// ── Unsplash background ──────────────────────────────────────────────────────
async function loadBackground() {
  const cache = await chrome.storage.local.get('unsplash_cache');
  const today = new Date().toDateString();

  let photo = cache.unsplash_cache;
  if (!photo || photo.date !== today) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/photos/random?orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`
      );
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      photo = {
        date: today,
        url: data.urls.regular,
        photographer: data.user.name,
        photographerLink: data.user.links.html + '?utm_source=mindmap&utm_medium=referral',
        unsplashLink: data.links.html + '?utm_source=mindmap&utm_medium=referral',
      };
      await chrome.storage.local.set({ unsplash_cache: photo });
    } catch (err) {
      console.warn('Unsplash fetch failed:', err);
      return;
    }
  }

  const bg = document.getElementById('bg');
  const img = new Image();
  img.onload = () => {
    bg.style.backgroundImage = `url(${photo.url})`;
    bg.classList.add('loaded');
  };
  img.src = photo.url;

  document.getElementById('photo-credit').innerHTML =
    `Photo by <a href="${photo.photographerLink}" target="_blank">${photo.photographer}</a> on ` +
    `<a href="${photo.unsplashLink}" target="_blank">Unsplash</a>`;
}

// ── Supabase auth (session is owned by background.js) ──────────────────────
async function getSession() {
  const session = await chrome.runtime.sendMessage({ type: 'getSession' });
  if (!session?.access_token) throw new Error('No Supabase session');
  return session;
}

// ── Brain score ──────────────────────────────────────────────────────────────
async function loadBrainScore() {
  try {
    const session = await getSession();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/events?select=category,duration&created_at=gte.${since}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );
    const events = await res.json();

    let total = 0, learning = 0;
    for (const ev of events) {
      const dur = ev.duration || 0;
      total += dur;
      if (MINDMAP.isLearning(ev.category)) learning += dur;
    }

    const ratio = total > 0 ? learning / total : 0;
    const pct = Math.round(ratio * 100);
    const state = MINDMAP.brainState(ratio);

    document.getElementById('score-num').textContent = pct;
    document.getElementById('score-num').style.color = state.color;
    document.getElementById('state-name').textContent = state.label;
    document.getElementById('state-name').style.color = state.color;
    document.getElementById('state-sub').textContent =
      total > 0 ? `${pct}% learning this week` : 'No data yet';

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
document.getElementById('ar-widget').addEventListener('click', () => {
  chrome.tabs.create({ url: AR_URL });
});
loadBackground();
loadBrainScore();
