// ─── Config (shared constants live in shared.js) ───────────────────────────
const CATS      = MINDMAP.CATEGORY_KEYS;
const CAT_COLOR = Object.fromEntries(MINDMAP.CATEGORIES.map(c => [c.key, c.color]));
const CAT_LABEL = Object.fromEntries(MINDMAP.CATEGORIES.map(c => [c.key, c.label]));

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

// ─── Brain state ────────────────────────────────────────────────────────────
function learningRatio(events) {
  const total = events.reduce((s, ev) => s + ev.dur, 0);
  if (total === 0) return 0;
  const learn = events
    .filter(ev => MINDMAP.isLearning(ev.cat))
    .reduce((s, ev) => s + ev.dur, 0);
  return learn / total;
}

// ─── Data: local daily totals written by tracker.js ────────────────────────
// Each "hour|domain|category" bucket becomes one row, so the renderers below
// work on the same row shape they always have.
async function loadEvents() {
  const keys = lastNDays(30).map(dk => 'day:' + dk);
  const stored = await chrome.storage.local.get(keys);
  const rows = [];
  for (const [key, buckets] of Object.entries(stored)) {
    const dk = key.slice(4);
    for (const [bucket, secs] of Object.entries(buckets)) {
      const [hour, domain, category] = bucket.split('|');
      rows.push({ domain, cat: MINDMAP.normalizeCategory(category), dur: secs, dk, hour: Number(hour) });
    }
  }
  return rows;
}

// Filter helpers
const today = dateKey(new Date());

function byDate(events, dk)     { return events.filter(ev => ev.dk === dk); }
function last7(events)          { const c = lastNDays(7)[0]; return events.filter(ev => ev.dk >= c); }
function groupByDay(events)     {
  const m = {};
  for (const ev of events) {
    if (!m[ev.dk]) m[ev.dk] = {};
    m[ev.dk][ev.cat] = (m[ev.dk][ev.cat] || 0) + ev.dur;
  }
  return m;
}

// ─── 1. GAUGE ────────────────────────────────────────────────────────────────
function renderGauge(events7d) {
  const ratio = learningRatio(events7d);
  const state = MINDMAP.brainState(ratio);
  const pct   = Math.round(ratio * 100);
  const color = state.color;

  const R     = 80;
  const total = Math.PI * R;       // arc length of upper semi-circle
  const filled = ratio * total;

  // Needle tip (radius slightly inside arc)
  const angle = (1 - ratio) * Math.PI;
  const nx = 100 + 68 * Math.cos(angle);
  const ny = 100 - 68 * Math.sin(angle);

  document.getElementById('gauge-card').innerHTML = `
    <h2>Brain Health Score — 7 Days</h2>
    <div class="gauge-center">
      <svg viewBox="0 0 200 108" width="200" height="108" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="arcGrad" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="180" y2="0">
            <stop offset="0%"   stop-color="#555555"/>
            <stop offset="30%"  stop-color="#aa8866"/>
            <stop offset="65%"  stop-color="#88aaff"/>
            <stop offset="100%" stop-color="#00ffcc"/>
          </linearGradient>
        </defs>
        <!-- Track -->
        <path d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none" stroke="#1a1a2c" stroke-width="16" stroke-linecap="round"/>
        <!-- Filled arc — start=left(0%) end=right(100%) -->
        <path d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="${color}"
          stroke-width="16"
          stroke-linecap="round"
          stroke-dasharray="${filled.toFixed(1)} ${(total * 2).toFixed(1)}"
          stroke-dashoffset="0"/>
        <!-- Needle -->
        <line x1="100" y1="100" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}"
          stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="5" fill="white"/>
        <!-- Score text inside semi-circle -->
        <text x="100" y="88" text-anchor="middle" font-family="Inter,sans-serif"
          font-size="22" font-weight="900" fill="${color}" letter-spacing="-1">${pct}</text>
      </svg>
      <div class="gauge-state" style="color:${color}">${state.label}</div>
      <div class="gauge-sub">${pct}% learning content this week</div>
    </div>
  `;
}

// ─── 2. NUTRITION LABEL ─────────────────────────────────────────────────────
function renderNutritionLabel(todayEvents) {
  const totals = {};
  CATS.forEach(c => totals[c] = 0);
  for (const ev of todayEvents) totals[ev.cat] += ev.dur;
  const total = Object.values(totals).reduce((s, v) => s + v, 0);

  const rows = CATS
    .filter(c => totals[c] > 0)
    .map(c => {
      const pct = total > 0 ? Math.round(totals[c] / total * 100) : 0;
      return `
        <div class="nl-row">
          <div class="nl-cat-name">
            <div class="nl-dot" style="background:${CAT_COLOR[c]}"></div>
            ${CAT_LABEL[c]}
          </div>
          <span class="nl-time">${fmtTime(totals[c])}</span>
          <span class="nl-pct">${pct}%</span>
        </div>`;
    }).join('');

  const body = total === 0
    ? `<div class="no-data"><div class="no-data-icon">🌙</div>No browsing recorded today yet</div>`
    : rows;

  document.getElementById('nutrition-card').innerHTML = `
    <h2>Today's Nutrition Label</h2>
    <div class="nl-wrap">
      <div class="nl-title">Nutrition Facts</div>
      <div class="nl-serving">
        <span>Serving Size</span><span>Today</span>
      </div>
      <div class="nl-total-row">
        <span class="nl-total-label">Total Screen Time</span>
        <span class="nl-total-value">${fmtTime(total)}</span>
      </div>
      <div class="nl-dv-header">% of Today</div>
      ${body}
      <div class="nl-footnote">
        Percentages reflect share of today's total screen time recorded by the extension.
        Learning includes Productivity &amp; News.
      </div>
    </div>`;
}

// ─── 3. DONUT ───────────────────────────────────────────────────────────────
let _donutChart = null;

function renderDonut(todayEvents) {
  const totals = {};
  CATS.forEach(c => totals[c] = 0);
  for (const ev of todayEvents) totals[ev.cat] += ev.dur;

  const activeCats = CATS.filter(c => totals[c] > 0);
  const total = todayEvents.reduce((s, ev) => s + ev.dur, 0);

  const card = document.getElementById('donut-card');

  if (activeCats.length === 0) {
    card.innerHTML = `<h2>Today's Diet Breakdown</h2>
      <div class="no-data"><div class="no-data-icon">📊</div>No data for today yet</div>`;
    return;
  }

  card.innerHTML = `<h2>Today's Diet Breakdown</h2><div class="chart-donut"><canvas id="donut-c"></canvas></div>`;

  if (_donutChart) { _donutChart.destroy(); _donutChart = null; }

  _donutChart = new Chart(document.getElementById('donut-c').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: activeCats.map(c => CAT_LABEL[c]),
      datasets: [{
        data:            activeCats.map(c => totals[c]),
        backgroundColor: activeCats.map(c => CAT_COLOR[c]),
        borderColor:     '#05050d',
        borderWidth:     3,
        hoverOffset:     8,
      }],
    },
    plugins: [{
      id: 'center',
      beforeDraw(chart) {
        const { ctx, chartArea: { left, right, top, bottom } } = chart;
        const cx = (left + right) / 2, cy = (top + bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e6e6f0';
        ctx.font = '700 17px Inter, sans-serif';
        ctx.fillText(fmtTime(total), cx, cy - 9);
        ctx.fillStyle = '#5a5a78';
        ctx.font = '500 10px Inter, sans-serif';
        ctx.fillText('today', cx, cy + 10);
        ctx.restore();
      },
    }],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a2c',
          borderColor: '#2a2a40',
          borderWidth: 1,
          bodyColor: '#e6e6f0',
          titleColor: '#e6e6f0',
          padding: 10,
          callbacks: {
            label: item => ` ${fmtTime(item.raw)}  (${total > 0 ? Math.round(item.raw / total * 100) : 0}%)`,
          },
        },
      },
    },
  });
}

// ─── 4. WEEKLY STACKED BAR ──────────────────────────────────────────────────
let _weekChart = null;

function renderWeeklyBar(events7d) {
  const dayMap = groupByDay(events7d);
  const days   = lastNDays(7);
  const labels = days.map(dk => {
    const d = new Date(dk + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  });

  const datasets = CATS.map(cat => ({
    label:           CAT_LABEL[cat],
    data:            days.map(dk => parseFloat(((dayMap[dk]?.[cat] || 0) / 3600).toFixed(2))),
    backgroundColor: CAT_COLOR[cat],
    borderRadius:    3,
  }));

  document.getElementById('weekly-card').innerHTML = `
    <h2>Last 7 Days — Time by Category</h2>
    <div class="chart-bar"><canvas id="weekly-c"></canvas></div>`;

  if (_weekChart) { _weekChart.destroy(); _weekChart = null; }

  _weekChart = new Chart(document.getElementById('weekly-c').getContext('2d'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { color: '#1a1a2c' }, ticks: { color: '#5a5a78', font: { size: 11 } } },
        y: { stacked: true, grid: { color: '#1a1a2c' }, ticks: { color: '#5a5a78', font: { size: 11 }, callback: v => `${v}h` } },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#5a5a78', boxWidth: 10, boxHeight: 10, padding: 12, font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          mode: 'index',
          backgroundColor: '#1a1a2c',
          borderColor: '#2a2a40',
          borderWidth: 1,
          titleColor: '#e6e6f0',
          bodyColor: '#9090a8',
          padding: 10,
          callbacks: { label: item => ` ${item.dataset.label}: ${item.raw}h` },
        },
      },
    },
  });
}

// ─── 5. 30-DAY TREND LINE ───────────────────────────────────────────────────
let _trendChart = null;

function renderTrendLine(allEvents) {
  const dayMap = groupByDay(allEvents);
  const days   = lastNDays(30);
  const labels = days.map(dk => {
    const d = new Date(dk + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const data = days.map(dk => {
    const cats = dayMap[dk] || {};
    const total = Object.values(cats).reduce((s, v) => s + v, 0);
    if (total === 0) return null;
    const learn = (cats.learning || 0) + (cats.productivity || 0) + (cats.news || 0);
    return Math.round(learn / total * 100);
  });

  document.getElementById('trend-card').innerHTML = `
    <h2>30-Day Learning Trend</h2>
    <div class="chart-line"><canvas id="trend-c"></canvas></div>`;

  if (_trendChart) { _trendChart.destroy(); _trendChart = null; }

  const ctx = document.getElementById('trend-c').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 210);
  grad.addColorStop(0,   '#1D9E7540');
  grad.addColorStop(1,   '#1D9E7500');

  _trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Learning %',
          data,
          borderColor:          '#1D9E75',
          backgroundColor:      grad,
          borderWidth:          2.5,
          pointRadius:          3,
          pointBackgroundColor: '#1D9E75',
          pointBorderColor:     '#0e0e1a',
          pointBorderWidth:     2,
          fill:                 true,
          tension:              0.4,
          spanGaps:             true,
        },
        {
          label: 'Goal',
          data: days.map(() => 50),
          borderColor:  '#2a2a48',
          borderWidth:  1.5,
          borderDash:   [5, 5],
          pointRadius:  0,
          fill:         false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: '#1a1a2c' },
          ticks: { color: '#5a5a78', font: { size: 10 }, maxTicksLimit: 10, maxRotation: 0 },
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: '#1a1a2c' },
          ticks: { color: '#5a5a78', font: { size: 11 }, callback: v => `${v}%` },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: '#5a5a78',
            boxWidth: 10,
            boxHeight: 10,
            font: { size: 11 },
            filter: item => item.text === 'Learning %',
          },
        },
        tooltip: {
          backgroundColor: '#1a1a2c',
          borderColor: '#2a2a40',
          borderWidth: 1,
          titleColor: '#e6e6f0',
          bodyColor: '#9090a8',
          padding: 10,
          callbacks: {
            label: item => item.datasetIndex === 0 ? ` Learning: ${item.raw ?? '—'}%` : ` Goal: 50%`,
          },
        },
      },
    },
  });
}

// ─── 6. HEATMAP ─────────────────────────────────────────────────────────────
function renderHeatmap(events7d) {
  const HOUR_LABELS = ['12a','1','2','3','4','5','6','7','8','9','10','11',
                       '12p','1','2','3','4','5','6','7','8','9','10','11'];
  const days = lastNDays(7);

  // Build grid[dk][hour] = { cat: secs }
  const grid = {};
  for (const ev of events7d) {
    if (!grid[ev.dk]) grid[ev.dk] = {};
    if (!grid[ev.dk][ev.hour]) grid[ev.dk][ev.hour] = {};
    grid[ev.dk][ev.hour][ev.cat] = (grid[ev.dk][ev.hour][ev.cat] || 0) + ev.dur;
  }

  // Find max cell value for opacity scaling
  let maxCellSecs = 1;
  for (const dk of days) for (let h = 0; h < 24; h++) {
    const s = Object.values(grid[dk]?.[h] || {}).reduce((a, b) => a + b, 0);
    if (s > maxCellSecs) maxCellSecs = s;
  }

  let html = '';

  // Header row
  html += '<div class="hm-corner"></div>';
  for (let h = 0; h < 24; h++) {
    html += `<div class="hm-hour-label">${h % 3 === 0 ? HOUR_LABELS[h] : ''}</div>`;
  }

  // Day rows
  for (const dk of days) {
    const d     = new Date(dk + 'T12:00:00');
    const wday  = d.toLocaleDateString('en-US', { weekday: 'short' });
    const mday  = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    html += `<div class="hm-day-label" title="${dk}">${wday}<br><span style="color:var(--text-dim)">${mday}</span></div>`;

    for (let h = 0; h < 24; h++) {
      const cell      = grid[dk]?.[h] || {};
      const cellTotal = Object.values(cell).reduce((a, b) => a + b, 0);

      if (cellTotal === 0) {
        html += `<div class="hm-cell"></div>`;
      } else {
        const domCat  = Object.entries(cell).sort((a, b) => b[1] - a[1])[0][0];
        const opacity = Math.max(0.18, Math.min(1, cellTotal / (maxCellSecs * 0.5)));
        const tip     = `${wday} ${HOUR_LABELS[h]} — ${fmtTime(cellTotal)} (${CAT_LABEL[domCat]})`;
        html += `<div class="hm-cell" style="background:${CAT_COLOR[domCat]};opacity:${opacity.toFixed(2)}" title="${tip}"></div>`;
      }
    }
  }

  const legend = CATS.map(c => `
    <div class="heatmap-legend-item">
      <div class="heatmap-legend-dot" style="background:${CAT_COLOR[c]}"></div>
      ${CAT_LABEL[c]}
    </div>`).join('');

  document.getElementById('heatmap-card').innerHTML = `
    <h2>Time-of-Day Heatmap — Last 7 Days</h2>
    <div class="heatmap-grid" style="grid-template-rows:16px repeat(${days.length},22px)">${html}</div>
    <div class="heatmap-legend">${legend}</div>`;
}

// ─── 7. TOP SITES ───────────────────────────────────────────────────────────
function renderTopSites(events7d) {
  // Aggregate by domain
  const map = {};
  for (const ev of events7d) {
    const dom = ev.domain;
    if (!dom) continue;
    if (!map[dom]) map[dom] = { secs: 0, catSecs: {} };
    map[dom].secs += ev.dur;
    map[dom].catSecs[ev.cat] = (map[dom].catSecs[ev.cat] || 0) + ev.dur;
  }

  const sorted = Object.entries(map)
    .sort((a, b) => b[1].secs - a[1].secs)
    .slice(0, 10);

  const card = document.getElementById('sites-card');

  if (sorted.length === 0) {
    card.innerHTML = `<h2>Top Sites This Week</h2><div class="no-data"><div class="no-data-icon">🌐</div>No data yet</div>`;
    return;
  }

  const maxSecs = sorted[0][1].secs;

  const rows = sorted.map(([dom, { secs, catSecs }]) => {
    const topCat   = Object.entries(catSecs).sort((a, b) => b[1] - a[1])[0][0];
    const color    = CAT_COLOR[topCat];
    const barWidth = Math.round(secs / maxSecs * 100);
    return `
      <tr>
        <td><span class="site-domain">${dom}</span></td>
        <td><span class="cat-badge" style="background:${color}22;color:${color}">${CAT_LABEL[topCat]}</span></td>
        <td class="site-time">${fmtTime(secs)}</td>
        <td class="bar-cell">
          <div class="site-bar-track">
            <div class="site-bar-fill" style="width:${barWidth}%;background:${color}"></div>
          </div>
        </td>
      </tr>`;
  }).join('');

  card.innerHTML = `
    <h2>Top Sites This Week</h2>
    <table class="sites-table">
      <thead>
        <tr>
          <th>Domain</th>
          <th>Category</th>
          <th style="text-align:right;padding-right:12px">Time</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── 8. LEARNING STREAK ─────────────────────────────────────────────────────
function renderStreak(allEvents) {
  const dayMap = groupByDay(allEvents);
  const days   = lastNDays(30);

  const scored = days.map(dk => {
    const cats  = dayMap[dk] || {};
    const total = Object.values(cats).reduce((s, v) => s + v, 0);
    if (total === 0) return { dk, on: false, noData: true };
    const learn = (cats.learning || 0) + (cats.productivity || 0) + (cats.news || 0);
    return { dk, on: learn / total >= 0.35, noData: false };
  });

  // Current streak (from today backwards)
  let current = 0;
  for (let i = scored.length - 1; i >= 0; i--) {
    if (scored[i].noData && scored[i].dk === today) continue; // today not counted yet
    if (scored[i].on) current++;
    else break;
  }

  // Longest streak
  let longest = 0, run = 0;
  for (const { on } of scored) {
    run = on ? run + 1 : 0;
    if (run > longest) longest = run;
  }

  const dots = scored.map(({ dk, on, noData }) => {
    const d     = new Date(dk + 'T12:00:00');
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const cls   = noData ? 'off' : on ? 'on' : 'off';
    const tip   = `${label}: ${noData ? 'No data' : on ? '≥35% learning ✓' : '<35% learning'}`;
    return `<div class="streak-dot ${cls}" title="${tip}"></div>`;
  }).join('');

  document.getElementById('streak-card').innerHTML = `
    <h2>Learning Streak — Last 30 Days</h2>
    <div class="streak-stats">
      <div>
        <div class="streak-stat-val" style="color:var(--learning)">${current}</div>
        <div class="streak-stat-label">Current Streak</div>
      </div>
      <div>
        <div class="streak-stat-val" style="color:var(--productivity)">${longest}</div>
        <div class="streak-stat-label">Best Streak</div>
      </div>
    </div>
    <div class="streak-dots">${dots}</div>
    <div class="streak-legend">
      <div class="streak-legend-item">
        <div style="width:13px;height:13px;border-radius:3px;background:var(--learning)"></div>
        ≥35% learning
      </div>
      <div class="streak-legend-item">
        <div style="width:13px;height:13px;border-radius:3px;background:var(--card-border)"></div>
        Not reached / no data
      </div>
    </div>`;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const events     = await loadEvents();
    const todayEvs   = byDate(events, today);
    const events7d   = last7(events);

    renderGauge(events7d);
    renderNutritionLabel(todayEvs);
    renderDonut(todayEvs);
    renderWeeklyBar(events7d);
    renderTrendLine(events);
    renderHeatmap(events7d);
    renderTopSites(events7d);
    renderStreak(events);

    document.getElementById('last-updated').textContent =
      `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    document.getElementById('loading').style.display  = 'none';
    document.getElementById('content').style.display  = 'block';

  } catch (err) {
    document.getElementById('loading').innerHTML = `
      <div style="text-align:center">
        <div style="font-size:28px;margin-bottom:10px">⚠️</div>
        <div style="color:#D85A30;font-size:14px">Failed to load data</div>
        <div style="color:var(--text-muted);font-size:12px;margin-top:6px">${err.message}</div>
        <div style="color:var(--text-dim);font-size:11px;margin-top:4px">
          Make sure the extension is running and try refreshing.
        </div>
      </div>`;
  }
}

init();
