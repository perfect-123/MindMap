import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Supabase config ─────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://sagbrkjfdqxqndrfekkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhZ2Jya2pmZHF4cW5kcmZla2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTkzNjgsImV4cCI6MjA5MDI5NTM2OH0.R3X09rKRcUES59xnLP_dsQacq6b5gg2QiTIfbTOeTxI';

// ─── Brain state definitions ──────────────────────────────────────────────────
const STATES = {
  thriving: {
    label: 'Thriving',
    color: 0x00ffcc,
    emissive: 0x00ffaa,
    emissiveBase: 0.8,
    pulseSpeed: 4.0,
    rotSpeed: 0.008,
    badgeBg: '#00ffcc22',
    badgeColor: '#00ffcc',
    dotColor: '#00ffcc',
    glowOpacity: 0.35,
    particles: { count: 80, speed: 0.016, size: 0.018 },
  },
  healthy: {
    label: 'Healthy',
    color: 0x88aaff,
    emissive: 0x4466ff,
    emissiveBase: 0.3,
    pulseSpeed: 1.0,
    rotSpeed: 0.004,
    badgeBg: '#88aaff22',
    badgeColor: '#88aaff',
    dotColor: '#88aaff',
    glowOpacity: 0.18,
    particles: { count: 45, speed: 0.008, size: 0.013 },
  },
  sluggish: {
    label: 'Sluggish',
    color: 0x887766,
    emissive: 0x332211,
    emissiveBase: 0.1,
    pulseSpeed: 0.4,
    rotSpeed: 0.002,
    badgeBg: '#88776622',
    badgeColor: '#aa9988',
    dotColor: '#aa9988',
    glowOpacity: 0.07,
    particles: { count: 18, speed: 0.003, size: 0.009 },
  },
  rotting: {
    label: 'Rotting',
    color: 0x555555,
    emissive: 0x000000,
    emissiveBase: 0.0,
    pulseSpeed: 0.0,
    rotSpeed: 0.001,
    badgeBg: '#55555522',
    badgeColor: '#888888',
    dotColor: '#666666',
    glowOpacity: 0.02,
    particles: { count: 5, speed: 0.001, size: 0.007 },
  },
};

// ─── Category definitions — mirrors extension's VALID_CATEGORIES ──────────────
const CATEGORY_DEFS = [
  { name: 'Learning',      key: 'learning',      hex: '#1D9E75' },
  { name: 'Entertainment', key: 'entertainment',  hex: '#D85A30' },
  { name: 'Social Media',  key: 'social media',  hex: '#E040FB' },
  { name: 'Productivity',  key: 'productivity',  hex: '#378ADD' },
  { name: 'News',          key: 'news',          hex: '#EF9F27' },
  { name: 'Other',         key: 'other',         hex: '#888780' },
];

// ─── Classification ───────────────────────────────────────────────────────────
// Uses Gemini-classified category field. Learning + Productivity + News = learning.
function classifyEvent(ev) {
  const cat = (ev.category || '').toLowerCase().trim();
  return (cat === 'learning' || cat === 'productivity' || cat === 'news') ? 'learning' : 'entertainment';
}

function calcBrainState(events) {
  if (!events || events.length === 0) return 'healthy';
  let learningSecs = 0, totalSecs = 0;
  for (const ev of events) {
    const secs = ev.duration || 0;
    totalSecs += secs;
    if (classifyEvent(ev) === 'learning') learningSecs += secs;
  }
  if (totalSecs === 0) {
    // No duration data — use event count as weight
    const learningCount = events.filter(ev => classifyEvent(ev) === 'learning').length;
    learningSecs = learningCount;
    totalSecs = events.length;
  }
  const ratio = learningSecs / totalSecs;
  if (ratio >= 0.55) return 'thriving';
  if (ratio >= 0.35) return 'healthy';
  if (ratio >= 0.15) return 'sluggish';
  return 'rotting';
}

// Returns an array of { name, percentage, hex } objects, sorted descending.
// Filters out zero-time categories. Falls back to demo data if no events.
function calcCategoryBreakdown(events) {
  if (!events || events.length === 0) {
    return [
      { name: 'Learning',      percentage: 38, hex: '#1D9E75' },
      { name: 'Entertainment', percentage: 28, hex: '#D85A30' },
      { name: 'Social Media',  percentage: 18, hex: '#E040FB' },
      { name: 'Productivity',  percentage: 10, hex: '#378ADD' },
      { name: 'Other',         percentage:  6, hex: '#888780' },
    ];
  }

  const buckets = {};
  CATEGORY_DEFS.forEach(d => buckets[d.key] = 0);
  let totalSecs = 0;

  for (const ev of events) {
    const secs = ev.duration || 0;
    totalSecs += secs;
    const cat = (ev.category || 'other').toLowerCase().trim();
    if (buckets[cat] !== undefined) buckets[cat] += secs;
    else buckets['other'] += secs;
  }

  if (totalSecs === 0) {
    // No duration data — distribute by event count instead
    const countBuckets = {};
    CATEGORY_DEFS.forEach(d => countBuckets[d.key] = 0);
    for (const ev of events) {
      const cat = (ev.category || 'other').toLowerCase().trim();
      if (countBuckets[cat] !== undefined) countBuckets[cat]++;
      else countBuckets['other']++;
    }
    return CATEGORY_DEFS
      .map(d => ({ name: d.name, percentage: Math.round((countBuckets[d.key] / events.length) * 100), hex: d.hex }))
      .filter(e => e.percentage > 0)
      .sort((a, b) => b.percentage - a.percentage);
  }

  return CATEGORY_DEFS
    .map(d => ({ name: d.name, percentage: Math.round((buckets[d.key] / totalSecs) * 100), hex: d.hex }))
    .filter(e => e.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────
async function getAnonSession() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  return data.access_token;
}

// Returns { state, categories }
async function fetchBrainState() {
  try {
    const token = await getAnonSession();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const url = `${SUPABASE_URL}/rest/v1/events?select=title,domain,duration,category&created_at=gte.${sevenDaysAgo}`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const events = await res.json();
    document.getElementById('debug-msg').textContent = `Supabase: ${events.length} events fetched`;
    return {
      state: calcBrainState(events),
      categories: calcCategoryBreakdown(events),
    };
  } catch (err) {
    document.getElementById('debug-msg').textContent = `Supabase error: ${err.message}`;
    console.warn('Supabase fetch failed, using fallback:', err);
    return {
      state: 'thriving',
      categories: calcCategoryBreakdown([]),
    };
  }
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const startBtn       = document.getElementById('start-btn');
const landing        = document.getElementById('landing');
const arView         = document.getElementById('ar-view');
const arUI           = document.getElementById('ar-ui');
const errorMsg       = document.getElementById('error-msg');
const arHint         = document.getElementById('ar-hint');
const arStateBadgeEl = document.getElementById('ar-state-badge');
const cameraVideo    = document.getElementById('camera-video');

// ─── Badge ────────────────────────────────────────────────────────────────────
function renderStateBadge(stateName) {
  const s = STATES[stateName];
  const html = `<span class="state-dot" style="background:${s.dotColor}"></span> ${s.label}`;
  const style = `background:${s.badgeBg}; color:${s.badgeColor}; border:1px solid ${s.badgeColor}44;`;
  const el = document.getElementById('ar-state-badge');
  el.innerHTML = html;
  el.setAttribute('style', style);
}

// Set landing badge to teaser — never reveal state before AR starts
const landingBadge = document.getElementById('state-badge-landing');
landingBadge.textContent = 'Have you been productive? Click to find out';
landingBadge.style.cssText = 'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);border:1px solid rgba(255,255,255,0.18);';

// Prefetch brain state silently so AR starts instantly
fetchBrainState().then(({ state }) => renderStateBadge(state));

// ─── Three.js state ───────────────────────────────────────────────────────────
let renderer, scene, camera, brainGroup, brainMaterial, pointLight, clock;
let glowMesh = null, particleSystem = null;
let animFrameId = null;
let currentState = 'thriving';
let brainMeshes = [];

const GLOW_RADIUS     = 0.42;
const PARTICLE_RADIUS = 0.62;

// ─── FX layer (glow + particles) ─────────────────────────────────────────────
function buildFxLayer(stateName) {
  if (glowMesh)       { brainGroup.remove(glowMesh);       glowMesh.geometry.dispose();       glowMesh.material.dispose();       glowMesh = null; }
  if (particleSystem) { brainGroup.remove(particleSystem); particleSystem.geometry.dispose(); particleSystem.material.dispose(); particleSystem = null; }

  const s = STATES[stateName];
  const col = new THREE.Color(s.color);

  glowMesh = new THREE.Mesh(
    new THREE.SphereGeometry(GLOW_RADIUS, 32, 32),
    new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: s.glowOpacity,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  brainGroup.add(glowMesh);

  const { count, size } = s.particles;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const phi   = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    pos[i * 3]     = PARTICLE_RADIUS * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = PARTICLE_RADIUS * Math.cos(phi);
    pos[i * 3 + 2] = PARTICLE_RADIUS * Math.sin(phi) * Math.sin(theta);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  particleSystem = new THREE.Points(geo, new THREE.PointsMaterial({
    color: col,
    size,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  brainGroup.add(particleSystem);
}

// ─── Label canvas texture ─────────────────────────────────────────────────────
function makeLabelTexture(name, percentage, hex) {
  const W = 256, H = 128, R = 20;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.moveTo(R, 0);
  ctx.lineTo(W - R, 0);
  ctx.quadraticCurveTo(W, 0, W, R);
  ctx.lineTo(W, H - R);
  ctx.quadraticCurveTo(W, H, W - R, H);
  ctx.lineTo(R, H);
  ctx.quadraticCurveTo(0, H, 0, H - R);
  ctx.lineTo(0, R);
  ctx.quadraticCurveTo(0, 0, R, 0);
  ctx.closePath();

  ctx.fillStyle = hex + 'E6'; // ~90% opacity background
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '500 22px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(name.toUpperCase(), W / 2, 14);

  ctx.font = '700 48px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${percentage}%`, W / 2, H - 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ─── Explode system ───────────────────────────────────────────────────────────
const LABEL_W             = 0.52;
const LABEL_H             = 0.26;
const SPRING_STIFFNESS    = 180;
const SPRING_DAMPING      = 12;
const EXPLODE_DEBOUNCE_MS = 800;

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

let explodeSystem      = null;
let categoryData       = [];
let brainModelRoot     = null;
let brainModelBaseScale = 1;

function createExplodeSystem(categories) {
  destroyExplodeSystem();

  const fragments = categories.map((cat, i) => {
    const n     = categories.length;
    const angle = (i / n) * Math.PI * 2 + Math.PI / 2;
    const tx    = 0.27 * Math.cos(angle) + (Math.random() - 0.5) * 0.05;
    const ty    = 0.44 * Math.sin(angle) + (Math.random() - 0.5) * 0.05;
    const tz    = (Math.random() - 0.5) * 0.04;

    const bobPhase   = Math.random() * Math.PI * 2;
    const launchDelay = i * 0.04 + Math.random() * 0.05;
    const spinAxis   = new THREE.Vector3(
      Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5
    ).normalize();
    const spinSpeed  = (Math.random() - 0.5) * 10;

    const geo  = new THREE.PlaneGeometry(LABEL_W, LABEL_H);
    const tex  = makeLabelTexture(cat.name, cat.percentage, cat.hex);
    const mat  = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.set(0, 0, 0);
    brainGroup.add(mesh);

    return {
      mesh, tex,
      target: new THREE.Vector3(tx, ty, tz),
      px: 0, py: 0, pz: 0,
      vx: 0, vy: 0, vz: 0,
      bobPhase, launchDelay, spinAxis, spinSpeed,
      scaleT: 0, launched: false, opacity: 0,
    };
  });

  explodeSystem = {
    fragments,
    isExploded: false,
    isAnimating: false,
    lastTapTime: 0,
    labelOpacity: 0,
    badgeOpacity: 1,
    badgeOpacityCurrent: 1,
    brainOpacity: 1,
    brainScale: 1,
    explodeElapsed: 0,
    shockwaveMesh: null,
    shockwaveT: 0,
  };
}

function destroyExplodeSystem() {
  if (!explodeSystem) return;
  for (const frag of explodeSystem.fragments) {
    brainGroup.remove(frag.mesh);
    frag.mesh.geometry.dispose();
    frag.mesh.material.dispose();
    frag.tex.dispose();
  }
  if (explodeSystem.shockwaveMesh) {
    brainGroup.remove(explodeSystem.shockwaveMesh);
    explodeSystem.shockwaveMesh.geometry.dispose();
    explodeSystem.shockwaveMesh.material.dispose();
    explodeSystem.shockwaveMesh = null;
  }
  explodeSystem = null;
}

function tickExplode(elapsed, dt) {
  if (!explodeSystem) return;

  const { fragments, isExploded, isAnimating } = explodeSystem;
  if (!isAnimating && !isExploded) return;

  if (isExploded) explodeSystem.explodeElapsed += dt;

  for (const frag of fragments) {
    if (isExploded) {
      if (!frag.launched) {
        if (explodeSystem.explodeElapsed < frag.launchDelay) continue;
        frag.mesh.visible = true;
        frag.launched = true;
        const len   = frag.target.length() || 1;
        const burst = 4.0 + Math.random() * 2.5;
        frag.vx = (frag.target.x / len) * burst;
        frag.vy = (frag.target.y / len) * burst;
        frag.vz = (frag.target.z / len) * burst;
      }

      const ax = -SPRING_STIFFNESS * (frag.px - frag.target.x) - SPRING_DAMPING * frag.vx;
      const ay = -SPRING_STIFFNESS * (frag.py - frag.target.y) - SPRING_DAMPING * frag.vy;
      const az = -SPRING_STIFFNESS * (frag.pz - frag.target.z) - SPRING_DAMPING * frag.vz;
      frag.vx += ax * dt; frag.vy += ay * dt; frag.vz += az * dt;
      frag.px += frag.vx * dt; frag.py += frag.vy * dt; frag.pz += frag.vz * dt;

      const distToTarget = Math.sqrt(
        (frag.px - frag.target.x) ** 2 +
        (frag.py - frag.target.y) ** 2 +
        (frag.pz - frag.target.z) ** 2
      );
      const bobY = distToTarget < 0.05
        ? Math.sin(elapsed * (Math.PI * 2 / 2.5) + frag.bobPhase) * 0.008
        : 0;
      frag.mesh.position.set(frag.px, frag.py + bobY, frag.pz);

      if (distToTarget > 0.15) {
        frag.mesh.rotateOnAxis(frag.spinAxis, frag.spinSpeed * dt);
      } else {
        frag.mesh.quaternion.slerp(camera.quaternion, Math.min(1, dt * 10));
      }

      frag.opacity = Math.min(1, frag.opacity + dt * 3.5);
      frag.mesh.material.opacity = frag.opacity;

      frag.scaleT = Math.min(1, frag.scaleT + dt * 3.5);
      frag.mesh.scale.setScalar(frag.scaleT < 1 ? Math.max(0, easeOutBack(frag.scaleT)) : 1);

    } else {
      if (!frag.mesh.visible) continue;

      const t = Math.min(1, dt * 7);
      frag.px += (0 - frag.px) * t;
      frag.py += (0 - frag.py) * t;
      frag.pz += (0 - frag.pz) * t;
      frag.vx = 0; frag.vy = 0; frag.vz = 0;
      frag.mesh.position.set(frag.px, frag.py, frag.pz);

      frag.opacity = Math.max(0, frag.opacity - dt * 3.5);
      frag.scaleT  = Math.max(0, frag.scaleT  - dt * 4.0);
      frag.mesh.material.opacity = frag.opacity;
      frag.mesh.scale.setScalar(frag.scaleT);

      const dist = Math.sqrt(frag.px ** 2 + frag.py ** 2 + frag.pz ** 2);
      if (dist < 0.003 && frag.opacity === 0) frag.mesh.visible = false;
    }
  }

  // Shockwave expansion
  if (explodeSystem.shockwaveMesh) {
    explodeSystem.shockwaveT = Math.min(1, explodeSystem.shockwaveT + dt * 2.8);
    const st = explodeSystem.shockwaveT;
    explodeSystem.shockwaveMesh.scale.setScalar(brainModelBaseScale * (0.5 + st * 3.5));
    explodeSystem.shockwaveMesh.material.opacity = 0.6 * (1 - st);
    if (st >= 1) {
      brainGroup.remove(explodeSystem.shockwaveMesh);
      explodeSystem.shockwaveMesh.geometry.dispose();
      explodeSystem.shockwaveMesh.material.dispose();
      explodeSystem.shockwaveMesh = null;
    }
  }

  // Brain fade + scale burst
  const s = STATES[currentState];
  if (isExploded) {
    explodeSystem.brainOpacity = Math.max(0, explodeSystem.brainOpacity - dt * 5.0);
    explodeSystem.brainScale   = brainModelBaseScale * (1 + (1 - explodeSystem.brainOpacity) * 0.8);
  } else {
    explodeSystem.brainOpacity = Math.min(1, explodeSystem.brainOpacity + dt * 2.5);
    explodeSystem.brainScale   = brainModelBaseScale * (0.7 + explodeSystem.brainOpacity * 0.3);
  }

  const bop = explodeSystem.brainOpacity;
  for (const m of brainMeshes) { m.visible = bop > 0; m.material.opacity = bop; }
  if (glowMesh)       glowMesh.material.opacity       = bop * s.glowOpacity;
  if (particleSystem) particleSystem.material.opacity = bop * 0.85;
  if (brainModelRoot) brainModelRoot.scale.setScalar(explodeSystem.brainScale);

  // Badge fade
  const badgeTarget = isExploded ? 0 : 1;
  explodeSystem.badgeOpacityCurrent += (badgeTarget - explodeSystem.badgeOpacityCurrent) * Math.min(1, dt * 6);
  arStateBadgeEl.style.opacity = explodeSystem.badgeOpacityCurrent;

  // Animation complete
  if (!isExploded && isAnimating) {
    const allHidden    = fragments.every(f => !f.mesh.visible);
    const brainFullyIn = explodeSystem.brainOpacity >= 1;
    if (allHidden && brainFullyIn) {
      explodeSystem.isAnimating = false;
      if (brainModelRoot) brainModelRoot.scale.setScalar(brainModelBaseScale);
    }
  }
}

// ─── Tap detection ────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const tapNDC    = new THREE.Vector2();

function onTap(clientX, clientY) {
  if (!explodeSystem) return;
  const now = Date.now();
  if (now - explodeSystem.lastTapTime < EXPLODE_DEBOUNCE_MS) return;

  if (explodeSystem.isExploded) {
    triggerReassemble();
    explodeSystem.lastTapTime = now;
    return;
  }

  const canvas = renderer.domElement;
  const rect   = canvas.getBoundingClientRect();
  tapNDC.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
  tapNDC.y = -((clientY - rect.top)  / rect.height) * 2 + 1;

  raycaster.setFromCamera(tapNDC, camera);
  const hits = raycaster.intersectObjects(brainMeshes, false);
  if (hits.length > 0) {
    triggerExplode();
    explodeSystem.lastTapTime = now;
  }
}

function triggerExplode() {
  if (!explodeSystem || explodeSystem.isExploded) return;
  explodeSystem.isExploded   = true;
  explodeSystem.isAnimating  = true;
  explodeSystem.brainOpacity = 1;
  explodeSystem.brainScale   = 1;

  // Freeze group rotation so billboard math is correct
  brainGroup.rotation.set(0, 0, 0);

  for (const m of brainMeshes) { m.visible = true; m.material.opacity = 1; }

  for (const frag of explodeSystem.fragments) {
    frag.px = 0; frag.py = 0; frag.pz = 0;
    frag.vx = 0; frag.vy = 0; frag.vz = 0;
    frag.opacity = 0; frag.scaleT = 0; frag.launched = false;
    frag.mesh.position.set(0, 0, 0);
    frag.mesh.material.opacity = 0;
    frag.mesh.scale.setScalar(0);
    frag.mesh.visible = false;
  }
  explodeSystem.explodeElapsed = 0;

  // Shockwave sphere
  if (explodeSystem.shockwaveMesh) {
    brainGroup.remove(explodeSystem.shockwaveMesh);
    explodeSystem.shockwaveMesh.geometry.dispose();
    explodeSystem.shockwaveMesh.material.dispose();
  }
  const swGeo = new THREE.SphereGeometry(1, 20, 20);
  const swMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(STATES[currentState].color),
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  explodeSystem.shockwaveMesh = new THREE.Mesh(swGeo, swMat);
  explodeSystem.shockwaveMesh.scale.setScalar(brainModelBaseScale * 0.5);
  explodeSystem.shockwaveT = 0;
  brainGroup.add(explodeSystem.shockwaveMesh);

  arHint.textContent = 'Tap anywhere to reassemble';
}

function triggerReassemble() {
  if (!explodeSystem || !explodeSystem.isExploded) return;
  explodeSystem.isExploded   = false;
  explodeSystem.isAnimating  = true;
  explodeSystem.brainOpacity = 0;
  explodeSystem.brainScale   = 0.8;

  for (const m of brainMeshes) { m.visible = true; m.material.opacity = 0; }
  if (glowMesh)       { glowMesh.visible = true;       glowMesh.material.opacity = 0; }
  if (particleSystem) { particleSystem.visible = true; particleSystem.material.opacity = 0; }

  arHint.textContent = 'Tap brain to explore categories';
}

function attachTapListeners(canvas) {
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    onTap(t.clientX, t.clientY);
  }, { passive: false });

  canvas.addEventListener('click', (e) => onTap(e.clientX, e.clientY));
}

// ─── Three.js init ────────────────────────────────────────────────────────────
function initThree(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setClearColor(0x000000, 0);

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.01, 100);
  camera.position.set(0, 0, 2);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(1, 2, 1);
  scene.add(dirLight);
  pointLight = new THREE.PointLight(0x00ffcc, 2, 5);
  pointLight.position.set(0, 0.5, 0.5);
  scene.add(pointLight);

  brainGroup = new THREE.Group();
  brainGroup.position.set(0, 0.5, 0);
  scene.add(brainGroup);
  clock = new THREE.Clock();

  buildFxLayer(currentState);
  createExplodeSystem(calcCategoryBreakdown([]));

  const loader = new GLTFLoader();
  loader.load(
    'assets/brain.glb',
    (gltf) => {
      const model = gltf.scene;
      const box   = new THREE.Box3().setFromObject(model);
      const size  = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      model.scale.setScalar(0.6 / maxDim);
      brainModelBaseScale = 0.6 / maxDim;
      const centre = box.getCenter(new THREE.Vector3());
      model.position.sub(centre.multiplyScalar(0.6 / maxDim));
      brainMaterial = makeMaterial(currentState);
      model.traverse(c => {
        if (c.isMesh) { c.material = brainMaterial; brainMeshes.push(c); }
      });
      brainModelRoot = model;
      brainGroup.add(model);
      arHint.textContent = 'Tap brain to explore categories';
    },
    undefined,
    () => {
      // Fallback sphere if brain.glb fails
      brainMaterial   = makeMaterial(currentState);
      const sphere    = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 32), brainMaterial);
      brainMeshes.push(sphere);
      brainModelRoot  = sphere;
      brainModelBaseScale = 1;
      brainGroup.add(sphere);
      arHint.textContent = 'Tap brain to explore categories';
    }
  );

  attachTapListeners(canvas);
}

function makeMaterial(stateName) {
  const s = STATES[stateName];
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(s.color),
    emissive: new THREE.Color(s.emissive),
    emissiveIntensity: s.emissiveBase,
    roughness: 0.4,
    metalness: 0.2,
    transparent: true,
    opacity: 1,
  });
}

function applyBrainState(stateName) {
  currentState = stateName;
  const s = STATES[stateName];
  if (brainMaterial) {
    brainMaterial.color.setHex(s.color);
    brainMaterial.emissive.setHex(s.emissive);
  }
  if (pointLight) pointLight.color.setHex(s.color);
  buildFxLayer(stateName);
  renderStateBadge(stateName);
}

// ─── Animation loop ───────────────────────────────────────────────────────────
let prevTime = 0;

function animate(timestamp) {
  animFrameId = requestAnimationFrame(animate);
  if (!renderer) return;

  const dt = Math.min((timestamp - prevTime) / 1000, 0.05);
  prevTime  = timestamp;

  const canvas = renderer.domElement;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const elapsed  = clock.getElapsedTime();
  const s        = STATES[currentState];
  const assembled = !explodeSystem || !explodeSystem.isExploded;

  if (brainMaterial) {
    const pulse = s.pulseSpeed > 0 ? Math.sin(elapsed * s.pulseSpeed) * 0.15 : 0;
    brainMaterial.emissiveIntensity = s.emissiveBase + pulse;
    pointLight.intensity = 1.5 + pulse * 2;
  }
  if (assembled) brainGroup.rotation.y += s.rotSpeed;

  if (glowMesh) {
    const breathe = 1 + Math.sin(elapsed * 1.2) * 0.06;
    glowMesh.scale.setScalar(breathe);
  }

  if (particleSystem) {
    particleSystem.rotation.y += s.particles.speed;
    particleSystem.rotation.x += s.particles.speed * 0.3;
  }

  tickExplode(elapsed, dt);
  renderer.render(scene, camera);
}

// ─── Camera stream ────────────────────────────────────────────────────────────
let cameraStream = null;

async function startCamera() {
  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  cameraVideo.srcObject = cameraStream;
  await cameraVideo.play();
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

// ─── Start button ─────────────────────────────────────────────────────────────
startBtn.addEventListener('click', async () => {
  startBtn.disabled    = true;
  startBtn.textContent = 'Requesting camera…';
  errorMsg.style.display = 'none';

  try {
    await startCamera();
  } catch (err) {
    startBtn.textContent   = 'Start AR';
    startBtn.disabled      = false;
    errorMsg.textContent   = err.name === 'NotAllowedError'
      ? 'Camera permission denied. Allow camera access in Settings and try again.'
      : 'Could not access camera: ' + err.message;
    errorMsg.style.display = 'block';
    return;
  }

  landing.style.display = 'none';
  arView.style.display  = 'block';
  arUI.style.display    = 'block';

  const canvas = document.getElementById('three-canvas');
  initThree(canvas);
  requestAnimationFrame(animate);

  fetchBrainState().then(({ state, categories }) => {
    applyBrainState(state);
    createExplodeSystem(categories);
    categoryData = categories;
  });
});

// ─── Exit AR ──────────────────────────────────────────────────────────────────
document.getElementById('exit-btn').addEventListener('click', () => {
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  stopCamera();
  destroyExplodeSystem();
  if (renderer) { renderer.dispose(); renderer = null; }
  brainGroup = null; brainMaterial = null; brainMeshes = [];

  arView.style.display  = 'none';
  arUI.style.display    = 'none';
  landing.style.display = 'flex';
  startBtn.disabled     = false;
  startBtn.textContent  = 'Start AR';
  arStateBadgeEl.style.opacity = '1';
});

// ─── Camera not supported ─────────────────────────────────────────────────────
if (!navigator.mediaDevices?.getUserMedia) {
  startBtn.textContent = 'Camera Not Supported';
  startBtn.disabled    = true;
}
