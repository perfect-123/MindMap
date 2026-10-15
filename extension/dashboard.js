// ─── Config (shared constants live in shared.js) ───────────────────────────
const CATS      = MINDMAP.CATEGORY_KEYS;
const CAT_COLOR = Object.fromEntries(MINDMAP.CATEGORIES.map(c => [c.key, c.color]));
const CAT_LABEL = Object.fromEntries(MINDMAP.CATEGORIES.map(c => [c.key, c.label]));

const INK   = '#f3f1ee';
const INK_2 = 'rgba(243, 241, 238, 0.68)';
const INK_3 = 'rgba(243, 241, 238, 0.44)';
const GRID  = 'rgba(255, 255, 255, 0.07)';
const HEAT  = '#3987e5';   // single sequential hue for the heatmap

Chart.defaults.font.family = getComputedStyle(document.body).getPropertyValue('--mono');
Chart.defaults.font.size = 10;
Chart.defaults.color = INK_3;
Chart.defaults.borderColor = GRID;
Object.assign(Chart.defaults.plugins.tooltip, {
  backgroundColor: 'rgba(10, 14, 24, 0.94)',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  borderWidth: 1,
  titleColor: INK,
  bodyColor: INK_2,
  padding: 12,
  cornerRadius: 10,
  boxPadding: 6,
  usePointStyle: true,
});

// ─── Utilities ─────────────────────────────────────────────────────────────
function fmtTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return '<1m';
}

// Returns YYYY-MM-DD in local time
function dateKey(d) {
  return d.toLocaleDateString('en-CA');
}

// Last N calendar days as YYYY-MM-DD strings, oldest → newest
function lastNDays(n) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(dateKey(new Date(Date.now() - i * 86400000)));
  }
  return keys;
}

const total = events => events.reduce((s, ev) => s + ev.dur, 0);

function learningRatio(events) {
  const all = total(events);
  if (all === 0) return 0;
  return total(events.filter(ev => MINDMAP.isLearning(ev.cat))) / all;
}

function sumByCat(events) {
  const sums = Object.fromEntries(CATS.map(c => [c, 0]));
  for (const ev of events) sums[ev.cat] += ev.dur;
  return sums;
}

function groupByDay(events) {
  const m = {};
  for (const ev of events) {
    m[ev.dk] ??= {};
    m[ev.dk][ev.cat] = (m[ev.dk][ev.cat] || 0) + ev.dur;
  }
  return m;
}

// ─── Data: local daily totals written by tracker.js ────────────────────────
// Rows come from MINDMAP.readRows with category corrections already applied.
let overrides = {};

async function loadEvents() {
  overrides = await MINDMAP.getCategoryOverrides();
  return MINDMAP.readRows(30);
}

const today = dateKey(new Date());
const last7 = events => { const c = lastNDays(7)[0]; return events.filter(ev => ev.dk >= c); };

// ─── 1. COVER — the 7-day score, styled like album art ──────────────────────
function renderCover(events7d) {
  const ratio = learningRatio(events7d);
  const state = MINDMAP.brainState(ratio);
  const has   = total(events7d) > 0;
  const el    = document.getElementById('cover');

  el.style.setProperty('--c1', state.aura[0]);
  el.style.setProperty('--c2', state.aura[1]);
  el.innerHTML = `
    <div class="grain-layer"></div>
    <div class="cover-title">The<br>last<br>seven<br>days</div>
    <div class="cover-score ghost">${has ? Math.round(ratio * 100) : '—'}<small>${has ? '%' : ''}</small></div>
    <div class="cover-state"><span class="state-dot" style="background:${state.color}"></span>${has ? state.label : 'No data yet'}</div>
    <div class="cover-foot">
      <span>Learning share of<br><u>active time</u></span>
      <span style="text-align:right">${fmtTime(total(events7d))}<br><u>tracked</u></span>
    </div>`;
}

// ─── 2. TODAY — total + part-to-whole bar + breakdown ───────────────────────
function renderToday(todayEvents) {
  const el = document.getElementById('today');
  const sums = sumByCat(todayEvents);
  const all = total(todayEvents);
  const cats = CATS.filter(c => sums[c] > 0);

  if (all === 0) {
    el.innerHTML = `<span class="label">Today's diet</span><div class="empty">Nothing tracked yet today</div>`;
    return;
  }

  const pct = c => Math.round(sums[c] / all * 100);
  const segments = cats.map(c =>
    `<div style="flex:${sums[c]};background:${CAT_COLOR[c]}" title="${CAT_LABEL[c]} · ${fmtTime(sums[c])} · ${pct(c)}%"></div>`).join('');
  const rows = cats.map(c => `
    <tr>
      <td><span class="key" style="background:${CAT_COLOR[c]}"></span>${CAT_LABEL[c]}</td>
      <td class="num">${fmtTime(sums[c])}</td>
      <td class="num pct">${pct(c)}%</td>
    </tr>`).join('');

  el.innerHTML = `
    <span class="label">Today's diet</span>
    <div class="kpi">${fmtTime(all)}</div>
    <div class="kpi-sub">active time · ${Math.round(learningRatio(todayEvents) * 100)}% learning</div>
    <div class="stack" role="img" aria-label="Share of today's time by category">${segments}</div>
    <table class="rows">${rows}</table>
    <div class="footnote">Learning = learning + productivity + news</div>`;
}

// ─── 3. WEEK — stacked columns by category ─────────────────────────────────
function renderWeek(events7d) {
  const days = lastNDays(7);
  const byDay = groupByDay(events7d);
  document.getElementById('week').innerHTML =
    `<span class="label">Last 7 days · hours by category</span><div class="chart"><canvas></canvas></div>`;

  const hours = (dk, c) => +((byDay[dk]?.[c] || 0) / 3600).toFixed(2);
  const used = CATS.filter(c => days.some(dk => hours(dk, c) > 0));
  // Round only the top segment of each column; the baseline stays square
  const topIndex = days.map(dk => {
    for (let i = used.length - 1; i >= 0; i--) if (hours(dk, used[i]) > 0) return i;
    return -1;
  });

  new Chart(document.querySelector('#week canvas'), {
    type: 'bar',
    data: {
      labels: days.map(dk => new Date(dk + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()),
      datasets: used.map((c, i) => ({
        label: CAT_LABEL[c],
        data: days.map(dk => hours(dk, c)),
        backgroundColor: CAT_COLOR[c],
        borderColor: 'transparent',
        borderWidth: { top: 2 },                     // 2px surface gap between segments
        borderSkipped: false,
        borderRadius: ctx => topIndex[ctx.dataIndex] === i ? { topLeft: 4, topRight: 4 } : 0,
        maxBarThickness: 24,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } } },
        y: { stacked: true, border: { display: false }, ticks: { callback: v => `${v}h`, maxTicksLimit: 5 } },
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: INK_2, usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 18 } },
        tooltip: { mode: 'index', filter: item => item.raw > 0, callbacks: { label: item => ` ${item.dataset.label}  ${fmtTime(item.raw * 3600)}` } },
      },
    },
  });
}

// ─── 4. TREND — 30-day learning share ──────────────────────────────────────
function renderTrend(events) {
  const days = lastNDays(30);
  const byDay = groupByDay(events);
  const data = days.map(dk => {
    const cats = byDay[dk];
    if (!cats) return null;
    const all = Object.values(cats).reduce((a, b) => a + b, 0);
    const learn = Object.entries(cats).filter(([c]) => MINDMAP.isLearning(c)).reduce((a, [, v]) => a + v, 0);
    return all ? Math.round(learn / all * 100) : null;
  });
  const healthy = MINDMAP.STATES.find(s => s.key === 'healthy').min * 100;

  document.getElementById('trend').innerHTML =
    `<span class="label">30 days · learning share · line = healthy ${healthy}%</span><div class="chart short"><canvas></canvas></div>`;

  // Solid hairline at the "Healthy" threshold (named in the card label)
  const threshold = {
    id: 'threshold',
    beforeDatasetsDraw({ ctx, chartArea: { left, right }, scales: { y } }) {
      const py = y.getPixelForValue(healthy);
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke();
      ctx.restore();
    },
  };

  new Chart(document.querySelector('#trend canvas'), {
    type: 'line',
    data: {
      labels: days.map(dk => new Date(dk + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()),
      datasets: [{
        label: 'Learning share',
        data,
        borderColor: CAT_COLOR.learning,
        backgroundColor: CAT_COLOR.learning + '1a',   // ~10% wash
        borderWidth: 2,
        fill: true,
        tension: 0.25,
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: '#0d1424',
        pointHoverBackgroundColor: CAT_COLOR.learning,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0 } },
        y: { min: 0, max: 100, border: { display: false }, ticks: { stepSize: 25, callback: v => `${v}%` } },
      },
      plugins: {
        legend: { display: false },  // single series — the label names it
        tooltip: { callbacks: { label: item => ` ${item.raw ?? '—'}% learning` } },
      },
    },
    plugins: [threshold],
  });
}

// ─── 5. STREAK ─────────────────────────────────────────────────────────────
function renderStreak(events) {
  const days = lastNDays(30);
  const byDay = groupByDay(events);
  const healthy = MINDMAP.STATES.find(s => s.key === 'healthy').min;
  const scored = days.map(dk => {
    const cats = byDay[dk] || {};
    const all = Object.values(cats).reduce((a, b) => a + b, 0);
    const learn = Object.entries(cats).filter(([c]) => MINDMAP.isLearning(c)).reduce((a, [, v]) => a + v, 0);
    return { dk, on: all > 0 && learn / all >= healthy, noData: all === 0 };
  });

  let current = 0;
  for (let i = scored.length - 1; i >= 0; i--) {
    if (scored[i].noData && scored[i].dk === today) continue; // today isn't over yet
    if (scored[i].on) current++; else break;
  }
  let longest = 0, run = 0;
  for (const { on } of scored) { run = on ? run + 1 : 0; longest = Math.max(longest, run); }

  const dots = scored.map(({ dk, on, noData }) => {
    const label = new Date(dk + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const tip = `${label}: ${noData ? 'no data' : on ? `≥${healthy * 100}% learning` : `<${healthy * 100}% learning`}`;
    return `<i class="${on ? 'on' : ''}${dk === today ? ' today' : ''}" title="${tip}"></i>`;
  }).join('');

  document.getElementById('streak').innerHTML = `
    <span class="label">Healthy-day streak</span>
    <div class="streak-nums">
      <div><div class="kpi">${current}</div><span class="label">Current</span></div>
      <div><div class="kpi">${longest}</div><span class="label">Best · 30d</span></div>
    </div>
    <div class="dots">${dots}</div>
    <div class="legend"><span><i style="background:#199e70"></i>≥${healthy * 100}% learning</span><span><i style="background:rgba(255,255,255,.06)"></i>Below / no data</span></div>`;
}

// ─── 6. HEATMAP — when you're online (single-hue intensity) ────────────────
function renderHeatmap(events7d) {
  const days = lastNDays(7);
  const H = ['12a','1a','2a','3a','4a','5a','6a','7a','8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p','8p','9p','10p','11p'];

  const grid = {};  // grid[dk][hour] = { cat: secs }
  for (const ev of events7d) {
    grid[ev.dk] ??= {};
    grid[ev.dk][ev.hour] ??= {};
    grid[ev.dk][ev.hour][ev.cat] = (grid[ev.dk][ev.hour][ev.cat] || 0) + ev.dur;
  }
  const cellTotal = (dk, h) => Object.values(grid[dk]?.[h] || {}).reduce((a, b) => a + b, 0);
  let max = 1;
  for (const dk of days) for (let h = 0; h < 24; h++) max = Math.max(max, cellTotal(dk, h));

  // Sequential: one hue, more time = more opaque (sqrt keeps short hours visible)
  const alpha = v => (0.18 + 0.82 * Math.sqrt(v / max)).toFixed(2);
  const hex = a => Math.round(a * 255).toString(16).padStart(2, '0');

  let html = '<div></div>' + H.map((l, h) => `<div class="hm-h">${h % 3 === 0 ? l : ''}</div>`).join('');
  for (const dk of days) {
    const d = new Date(dk + 'T12:00');
    const wday = d.toLocaleDateString('en-US', { weekday: 'short' });
    html += `<div class="hm-d">${wday}</div>`;
    for (let h = 0; h < 24; h++) {
      const v = cellTotal(dk, h);
      if (!v) { html += '<div class="hm-c"></div>'; continue; }
      const top = Object.entries(grid[dk][h]).sort((a, b) => b[1] - a[1])[0][0];
      const tip = `${wday} ${H[h]} · ${fmtTime(v)} · mostly ${CAT_LABEL[top]}`;
      html += `<div class="hm-c" data-tip style="background:${HEAT}${hex(alpha(v))}" title="${tip}"></div>`;
    }
  }
  const steps = [0.1, 0.3, 0.55, 0.8, 1].map(f => `<i style="background:${HEAT}${hex(alpha(f * max))}"></i>`).join('');

  document.getElementById('heatmap').innerHTML = `
    <span class="label">When you're online · last 7 days</span>
    <div class="heatmap">${html}</div>
    <div class="scale"><span>Less</span>${steps}<span>More</span></div>`;
}

// ─── 7. TOP SITES — with category correction ───────────────────────────────
function categoryPicker(domain, cat) {
  const options = CATS.map(c =>
    `<option value="${c}"${c === cat ? ' selected' : ''}>${CAT_LABEL[c]}</option>`).join('');
  const edited = domain in overrides;
  const reset = edited ? '<option value="">↺ Automatic</option>' : '';
  // Identity comes from the coloured dot; the text stays in an ink colour
  const bg = `radial-gradient(circle at 13px 50%, ${CAT_COLOR[cat]} 3.5px, transparent 4.5px), rgba(255,255,255,0.04)`;
  return `<select class="picker" data-domain="${domain}" title="Change this site's category" style="background:${bg}">${options}${reset}</select>${
    edited ? '<span class="edited" title="Set by you">✎</span>' : ''}`;
}

function renderSites(events7d) {
  const el = document.getElementById('sites');
  const map = {};
  for (const ev of events7d) {
    map[ev.domain] ??= { secs: 0, cats: {} };
    map[ev.domain].secs += ev.dur;
    map[ev.domain].cats[ev.cat] = (map[ev.domain].cats[ev.cat] || 0) + ev.dur;
  }
  const sorted = Object.entries(map).sort((a, b) => b[1].secs - a[1].secs).slice(0, 10);

  if (!sorted.length) {
    el.innerHTML = `<span class="label">Top sites this week</span><div class="empty">No sites yet</div>`;
    return;
  }

  const max = sorted[0][1].secs;
  const rows = sorted.map(([dom, { secs, cats }], i) => {
    const cat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0];
    return `
      <tr>
        <td class="rank">${String(i + 1).padStart(2, '0')}</td>
        <td>${dom}</td>
        <td>${categoryPicker(dom, cat)}</td>
        <td class="time">${fmtTime(secs)}</td>
        <td class="bar"><div class="track"><div class="fill" style="width:${(secs / max * 100).toFixed(1)}%;background:${CAT_COLOR[cat]}"></div></div></td>
      </tr>`;
  }).join('');

  el.onchange = async (e) => {
    if (!e.target.matches('.picker')) return;
    await MINDMAP.setCategoryOverride(e.target.dataset.domain, e.target.value || null);
    init(); // re-read with the correction applied everywhere
  };

  el.innerHTML = `
    <span class="label">Top sites this week · pick a category to correct it</span>
    <table class="sites">${rows}</table>`;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function init() {
  Object.values(Chart.instances).forEach(chart => chart.destroy()); // re-render safely
  try {
    const events = await loadEvents();
    const events7d = last7(events);

    renderCover(events7d);
    renderToday(events.filter(ev => ev.dk === today));
    renderWeek(events7d);
    renderTrend(events);
    renderStreak(events);
    renderHeatmap(events7d);
    renderSites(events7d);

    document.getElementById('updated').textContent =
      `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    document.getElementById('loading').hidden = true;
    document.getElementById('app').hidden = false;
  } catch (err) {
    document.getElementById('loading').textContent = `Couldn't load data — ${err.message}`;
  }
}

init();
