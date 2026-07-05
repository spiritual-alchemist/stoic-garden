// The pixel renderer — season- and time-aware. Sky, ground, foliage, snow and a weather
// layer all follow (season, hour); trees are drawn parametrically from species + maturity
// + harm. Everything here is a pure function of the clock and the stored garden.

const GC = {
  stem: '#4f7a3a', trunk: '#7a5230', trunkD: '#5e3f24',
  dead: '#4a382a', deadD: '#33251a', scar: '#241610', scorch: '#241a12',
  soil: '#7a5a40', soilD: '#6a4c34', soilL: '#8a6a4c', grass: '#5a8a3e',
  snow: '#eef3f6', snowD: '#d6dee4',
};
const AUTUMN = { b: '#cf7a2a', l: '#e6a34a', d: '#9c4a1e' };

function skyPalette(hour, season) {
  if (hour < 5 || hour >= 20) return { top: '#20304a', mid: '#38496a', kind: 'night' };
  if (hour < 8) return { top: '#e7b587', mid: '#cfe0e6', kind: 'dawn' };
  if (hour >= 18) return { top: '#e79f68', mid: '#caa0a0', kind: 'dusk' };
  const D = {
    spring: { top: '#cfe8ec', mid: '#e6f2ef' },
    summer: { top: '#bfe0ec', mid: '#daeee7' },
    monsoon: { top: '#8f9ba3', mid: '#aab5ba', overcast: true },
    autumn: { top: '#dcd3b8', mid: '#ece3cb' },
    winter: { top: '#cdd8de', mid: '#dfe7ea' },
  };
  return Object.assign({ kind: 'day' }, D[season] || D.spring);
}

function brushAt(ctx, S, cx, gy) {
  return (dx, dy, color, w, h) => { ctx.fillStyle = color; ctx.fillRect(Math.round((cx + dx) * S), Math.round((gy + dy) * S), (w || 1) * S, (h || 1) * S); };
}

function drawSceneBg(ctx, S, W, H, GY, hour, season) {
  const P = (x, y, c, w, h) => { ctx.fillStyle = c; ctx.fillRect(x * S, y * S, (w || 1) * S, (h || 1) * S); };
  const sky = skyPalette(hour, season);
  P(0, 0, sky.top, W, GY); P(0, GY - 6, sky.mid, W, 6);
  // celestial
  if (sky.kind === 'night') {
    ctx.fillStyle = '#dfe4ee';
    const nst = Math.min(46, Math.round(W * S / 16)), sh = Math.max(4, (GY - 8) * S);
    for (let i = 0; i < nst; i++) ctx.fillRect(Math.round(((i * 733 + 131) % 997) / 997 * W * S), Math.round(((i * 419 + 71) % 991) / 991 * sh) + S, 2, 2);
    const mx = W - 9; P(mx, 6, '#e9edf4', 3, 3); P(mx - 1, 7, '#cfd6e2'); P(mx + 2, 8, '#cfd6e2');
  } else if (sky.overcast) {
    [[Math.floor(W * 0.2), 6], [Math.floor(W * 0.6), 5], [Math.floor(W * 0.8), 7]].forEach(c => { P(c[0], c[1], '#c8cfd4', 6, 2); P(c[0] + 1, c[1] - 1, '#c8cfd4', 4, 1); });
  } else {
    const sx = sky.kind === 'dawn' ? 6 : (sky.kind === 'dusk' ? W - 12 : W - 12), sy = sky.kind === 'day' ? 7 : 10;
    const sun = season === 'winter' ? '#eae6d2' : '#f4d98b';
    P(sx, sy, sun, 3, 3); P(sx - 1, sy + 1, sun, 5, 1); P(sx + 1, sy - 1, '#f6e2a3', 1, 5);
    P(Math.floor(W * 0.32), 6, '#eef4f2', 5, 1);
  }
  // ground skin
  if (season === 'winter') {
    for (let y = GY - 1; y < H; y++) for (let x = 0; x < W; x++) P(x, y, ((x * 7 + y * 5) % 9 === 0) ? GC.snowD : GC.snow);
    return;
  }
  const soil = season === 'monsoon' ? '#5f4632' : GC.soil;
  P(0, GY, soil, W, H - GY);
  for (let y = GY; y < H; y++) for (let x = 0; x < W; x++) { const d = (x * 7 + y * 13) % 6; if (d === 0) P(x, y, GC.soilD); else if (d === 3) P(x, y, GC.soilL); }
  if (season === 'monsoon') { for (let x = 0; x < W; x++) if ((x * 5) % 4 === 0) P(x, GY - 1, '#4a6a34'); P(Math.floor(W * 0.5), H - 2, '#7f8f98', 10, 1); P(Math.floor(W * 0.5) + 1, H - 3, '#8f9ea6', 7, 1); }
  else if (season === 'autumn') { for (let x = 0; x < W; x++) if ((x * 5) % 4 === 0) P(x, GY - 1, '#7a7a3a'); for (let i = 0; i < Math.floor(W / 6); i++) { const x = (i * 29 + 3) % W; P(x, GY + (i % 3), (i % 2) ? '#cf7a2a' : '#9c4a1e'); } }
  else { for (let x = 0; x < W; x++) if ((x * 5) % 4 === 0) P(x, GY - 1, GC.grass); }
}

// ---- plant forms ----
function trunk(b, h, col, colD) { for (let i = 1; i <= h; i++) { b(0, -i, col, 2, 1); b(0, -i, colD, 1, 1); } }
function ellipseCanopy(b, cy, rx, ry, fo) {
  for (let dy = -ry - 1; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++)
    if (dx * dx / (rx * rx) + dy * dy / (ry * ry) <= 1) {
      const col = (dx < -1 && dy < 0) ? fo.l : ((dx > rx - 2 || dy > ry - 2) ? fo.d : fo.b);
      b(1 + dx, cy + dy, col);
    }
}
function drawSprout(b, fo, blossom) { b(0, -1, GC.stem); b(0, -2, GC.stem); b(-1, -2, fo.b); b(1, -3, fo.l); b(0, -4, blossom || fo.l); }
function drawBroad(b, m, fo) {
  const Ht = 5 + Math.round(m * 0.7), trunkH = Math.max(2, Math.round(Ht * 0.5));
  trunk(b, trunkH, GC.trunk, GC.trunkD);
  const rx = 2 + Math.floor(m / 2.6), ry = 2 + Math.floor(m / 4);
  ellipseCanopy(b, -trunkH - ry + 1, rx, ry, fo);
}
function drawCone(b, m, fo) {
  const Ht = 5 + Math.round(m * 0.85), w = 2 + Math.floor(m / 2.6);
  b(0, -1, GC.trunkD, 1, 1);
  for (let i = 0; i <= Ht; i++) {
    const yy = -(i + 1), frac = i / Ht, ww = Math.max(0, Math.round((1 - frac) * w));
    if (i % 3 === 0) { b(-ww, yy, fo.d, 2 * ww + 1, 1); continue; }
    b(-ww, yy, fo.b, 2 * ww + 1, 1);
    if (ww > 0) { b(-ww, yy, fo.d); b(ww, yy, fo.d); }
  }
  b(0, -(Ht + 1), fo.l);
}
function drawBlossom(b, m, fo, blossom) {
  const Ht = 5 + Math.round(m * 0.7), trunkH = Math.max(2, Math.round(Ht * 0.5));
  trunk(b, trunkH, GC.trunk, GC.trunkD);
  const rx = 2 + Math.floor(m / 2.8), ry = 2 + Math.floor(m / 4), cy = -trunkH - ry + 1, light = '#ffd6e6';
  for (let dy = -ry - 1; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++)
    if (dx * dx / (rx * rx) + dy * dy / (ry * ry) <= 1) {
      let col = ((dx + dy + 9) % 3 === 0) ? fo.d : blossom;
      if (dx < -1 && dy < 0) col = light;
      b(1 + dx, cy + dy, col);
    }
}
function drawSlender(b, m, fo) {
  const Ht = 6 + Math.round(m * 0.6), trunkH = Math.max(3, Math.round(Ht * 0.55));
  for (let i = 1; i <= trunkH; i++) { b(0, -i, '#dcd7c8', 2, 1); b(0, -i, '#c6c0af', 1, 1); if (i % 3 === 0) b(0, -i, '#5e564a', 1, 1); }
  const rx = 1 + Math.floor(m / 4.5), ry = 2 + Math.floor(m / 3.5);
  ellipseCanopy(b, -trunkH - ry + 2, Math.max(2, rx), ry, fo);
}
function drawWillow(b, m, fo) {
  const Ht = 5 + Math.round(m * 0.65), trunkH = Math.max(2, Math.round(Ht * 0.42));
  trunk(b, trunkH, GC.trunk, GC.trunkD);
  const rx = 3 + Math.floor(m / 2.6), ry = 2 + Math.floor(m / 4), cy = -trunkH - ry;
  ellipseCanopy(b, cy, rx, ry, fo);
  const frondLen = 2 + Math.floor(m / 2);
  for (let dx = -rx + 1; dx <= rx - 1; dx += 2) {
    for (let k = 1; k <= frondLen; k++) { const y = cy + ry - 1 + k; if (y >= 0) break; b(1 + dx, y, (k % 2) ? fo.d : fo.b); }
  }
}
// tall, narrow column — poplar
function drawColumn(b, m, fo) {
  const trunkH = Math.max(2, Math.round((4 + m * 0.7) * 0.25));
  trunk(b, trunkH, GC.trunk, GC.trunkD);
  const rx = 1 + Math.floor(m / 5), ry = 3 + Math.floor(m / 2.5);
  ellipseCanopy(b, -trunkH - ry + 1, Math.max(2, rx), ry, fo);
}
// low wide mound, barely a trunk — hazel shrub
function drawBush(b, m, fo) {
  b(0, -1, GC.trunkD);
  const rx = 3 + Math.floor(m / 2.4), ry = 2 + Math.floor(m / 3);
  ellipseCanopy(b, -ry, rx, ry, fo);
}
// tall trunk, wide flat crown — acacia
function drawSpread(b, m, fo) {
  const Ht = 6 + Math.round(m * 0.7), trunkH = Math.max(3, Math.round(Ht * 0.6));
  trunk(b, trunkH, GC.trunk, GC.trunkD);
  const rx = 3 + Math.floor(m / 2.2), ry = 1 + Math.floor(m / 5);
  ellipseCanopy(b, -trunkH - ry, rx, ry, fo);
}
function scarMark(b, m) { const h = Math.min(15, 4 + m); for (let i = 3; i <= Math.min(h - 1, 9); i++) b(0, -i, GC.scar); b(2, -h + 2, GC.deadD); }
function drawScarred(b, m, winter) {
  const h = Math.min(15, 4 + m);
  for (let i = 1; i <= h; i++) { b(0, -i, GC.dead, 2, 1); b(0, -i, GC.deadD, 1, 1); }
  [[-1, -1], [-2, -2], [0, -2], [1, -3], [2, -2], [-2, -4], [1, -4], [0, -5], [-1, -6], [2, -6]].forEach(o => b(o[0], -h + o[1], GC.deadD));
  if (winter) [[-2, -3], [1, -5], [-1, -7]].forEach(o => b(o[0], -h + o[1], GC.snow));
  [[-2, 0], [2, 0], [-3, 0]].forEach(o => b(o[0], o[1], winter ? GC.snowD : GC.scorch));
}
// bare deciduous tree in winter
function drawBareWinter(b, m) {
  const h = Math.min(15, 4 + m);
  trunk(b, h, GC.trunk, GC.trunkD);
  [[-1, -1], [-2, -2], [0, -2], [1, -3], [2, -2], [-2, -4], [1, -4], [0, -5], [-1, -6], [2, -6], [0, -7]].forEach(o => b(o[0], -h + o[1], GC.trunkD));
  [[-2, -3], [1, -5], [-1, -7], [2, -5]].forEach(o => b(o[0], -h + o[1], GC.snow));
}
function snowCap(b, m) {
  const Ht = 5 + Math.round(m * 0.85);
  b(0, -(Ht + 1), GC.snow); b(-1, -Ht + 1, GC.snow); b(1, -Ht + 2, GC.snow);
}

function drawPlant(b, spKey, m, harm, season) {
  const sp = SPECIES_BY_KEY[spKey] || SPECIES[0];
  const scarred = harm >= harmThreshold(m);
  if (scarred && harm > m) return drawScarred(b, m, season === 'winter'); // overwhelmed -> dead
  if (stageOf(m) === 'sprout') { drawSprout(b, season === 'autumn' ? AUTUMN : sp.foliage, (sp.blossom && season === 'spring') ? sp.blossom : null); if (scarred) scarMark(b, 3); return; }
  if (season === 'winter' && !sp.evergreen) { drawBareWinter(b, m); if (scarred) scarMark(b, m); return; }
  const fo = season === 'autumn' ? AUTUMN : sp.foliage;
  if (sp.shape === 'cone') { drawCone(b, m, sp.foliage); if (season === 'winter') snowCap(b, m); }
  else if (sp.shape === 'blossom') { if (season === 'spring') drawBlossom(b, m, sp.foliage, sp.blossom); else drawBroad(b, m, fo); }
  else if (sp.shape === 'slender') drawSlender(b, m, fo);
  else if (sp.shape === 'willow') drawWillow(b, m, fo);
  else if (sp.shape === 'column') drawColumn(b, m, fo);
  else if (sp.shape === 'bush') drawBush(b, m, fo);
  else if (sp.shape === 'spread') drawSpread(b, m, fo);
  else drawBroad(b, m, fo);
  if (scarred) scarMark(b, m);
}

// a brush whose canopy pixels lean with the wind (trunk stays put)
function windyBrush(ctx, S, cx, gy, sway) {
  return (dx, dy, color, w, h) => {
    const off = (-dy) > 3 ? sway : 0;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round((cx + dx + off) * S), Math.round((gy + dy) * S), (w || 1) * S, (h || 1) * S);
  };
}

// falling weather, animated by time t (seconds). Fixed fine device sizes, particles wrap.
function drawWeatherAnim(ctx, pw, ph, season, t) {
  if (season === 'summer') return;
  const dense = (season === 'monsoon' || season === 'winter');
  const N = Math.min(dense ? 150 : 60, Math.round(pw * ph / (dense ? 2600 : 5000)));
  const H = ph + 10;
  for (let i = 0; i < N; i++) {
    const bx = ((i * 733 + 131) % 997) / 997 * pw, ph0 = ((i * 419 + 71) % 991) / 991;
    if (season === 'monsoon') { const y = (ph0 * H + t * 230) % H; ctx.fillStyle = '#c6d0d6'; ctx.fillRect(Math.round(bx + (y / H) * 5), Math.round(y - 7), 2, 8); }
    else if (season === 'winter') { const y = (ph0 * H + t * 34) % H; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(bx + Math.sin(t * 0.8 + i) * 6), Math.round(y), 3, 3); }
    else if (season === 'spring') { const y = (ph0 * H + t * 26) % H; ctx.fillStyle = '#f2a8c8'; ctx.fillRect(Math.round(bx + Math.sin(t * 1.1 + i) * 10), Math.round(y), 3, 3); }
    else if (season === 'autumn') { const y = (ph0 * H + t * 42) % H; ctx.fillStyle = (i % 2) ? '#cf7a2a' : '#9c4a1e'; ctx.fillRect(Math.round(bx + Math.sin(t * 1.4 + i) * 9), Math.round(y), 3, 3); }
  }
}

// five bird silhouettes (cell offsets, wings-up / wings-down frames)
const BIRD_TYPES = [
  { color: '#3f372f', rate: 5, up: [[0, 0], [-1, -1], [1, -1], [-2, 0], [2, 0]], down: [[0, 1], [-1, 0], [1, 0], [-2, 1], [2, 1]] },                       // gull
  { color: '#2f2a24', rate: 9, up: [[0, 0], [-1, -1], [1, -1], [-2, -1], [2, -1], [0, 1]], down: [[0, 0], [-1, 0], [1, 0], [-2, -1], [2, -1], [0, 1]] },   // swallow
  { color: '#5a4a38', rate: 12, up: [[0, 0], [-1, -1], [1, -1]], down: [[0, 0], [-1, 0], [1, 0]] },                                                       // sparrow
  { color: '#241f1b', rate: 4, up: [[0, 0], [-1, -1], [1, -1], [-2, -1], [2, -1], [-3, 0], [3, 0]], down: [[0, 1], [-1, 0], [1, 0], [-2, 0], [2, 0], [-3, 1], [3, 1]] }, // crow
  { color: '#6a6258', rate: 6, up: [[-1, -1], [0, 0], [1, -1]], down: [[-1, 0], [0, 1], [1, 0]] },                                                        // distant V
];
function _brnd(k, salt) { let h = Math.imul(((k * 374761393) ^ (salt * 668265263)) ^ 0x9e3779b9, 2246822519) >>> 0; h = (h ^ (h >>> 13)) >>> 0; return h / 4294967296; }

// wildlife: fireflies at night; by day, pseudo-random bird FLYBYS — 0 to 2 on screen at a
// time, five kinds, smaller on the small plots. Birds enter, cross, and leave; no state.
function drawWildlife(ctx, W, GY, S, season, hour, t, seed) {
  const night = hour < 5 || hour >= 20;
  if (night) {
    if (season === 'spring' || season === 'summer') {
      const pw = W * S, gpx = GY * S; ctx.fillStyle = '#f6e9a0';
      for (let i = 0; i < 5; i++) { const x = (((i * 311 + 40) + t * 8 * (i % 2 ? 1 : -1)) % pw + pw) % pw; const y = gpx * 0.45 + Math.sin(t * 0.6 + i) * gpx * 0.16; ctx.globalAlpha = Math.sin(t * 3 + i * 2) > 0 ? 1 : 0.3; ctx.fillRect(Math.round(x), Math.round(y), 3, 3); }
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (season === 'monsoon') return;
  const cell = Math.max(3, Math.min(8, S <= 5 ? 3 : S)); // smaller on the field thumbnails
  const GAP = 6, Dbase = 7, base = (seed || 0) * 101 + season.charCodeAt(0), nowK = Math.floor(t / GAP);
  const active = [];
  for (let k = nowK - 2; k <= nowK; k++) {
    const kk = k + base;
    if (_brnd(kk, 1) >= 0.6) continue; // ~60% of slots spawn a bird
    const startT = k * GAP + _brnd(kk, 2) * GAP * 0.5, D = Dbase * (0.8 + _brnd(kk, 3) * 0.7);
    const prog = (t - startT) / D;
    if (prog < 0 || prog > 1) continue;
    const dir = _brnd(kk, 4) < 0.5 ? 1 : -1;
    const lx = dir > 0 ? (-3 + prog * (W + 6)) : (W + 3 - prog * (W + 6));
    const ly = GY * (0.1 + _brnd(kk, 5) * 0.34) + Math.sin(t * 0.6 + k) * GY * 0.03;
    active.push({ lx, ly, ty: Math.floor(_brnd(kk, 6) * BIRD_TYPES.length), kk });
  }
  active.sort((a, b) => a.kk - b.kk);
  for (let i = 0; i < Math.min(2, active.length); i++) {
    const b = active[i], T = BIRD_TYPES[b.ty], frame = Math.sin(t * T.rate + b.kk) > 0 ? T.up : T.down;
    const bx = b.lx * S, by = b.ly * S; ctx.fillStyle = T.color;
    for (const o of frame) ctx.fillRect(Math.round(bx + o[0] * cell), Math.round(by + o[1] * cell), cell, cell);
  }
}

// ---- animated views: one RAF loop redraws all attached canvases (bg cached, ~30fps) ----
const _gviews = new Set();
let _ganim = false, _glast = 0;
function gardenViewAttach(canvas, getOpts) {
  const v = { canvas, ctx: canvas.getContext('2d'), getOpts, bg: document.createElement('canvas'), key: '', seed: _gviews.size };
  _gviews.add(v);
  if (!_ganim) { _ganim = true; requestAnimationFrame(_gloop); }
  return v;
}
function gardenViewDetach(v) { _gviews.delete(v); }
function _gloop(ts) {
  requestAnimationFrame(_gloop);
  if (ts - _glast < 33) return; // ~30fps
  _glast = ts;
  const t = ts / 1000;
  for (const v of _gviews) { try { _gdraw(v, t); } catch (_) {} }
}
function _gdraw(v, t) {
  const o = v.getOpts(); if (!o) return;
  const { W, H, GY, S, gap, clip, plants, scorch, hour, season } = o;
  const cw = W * S, ch = H * S;
  const key = `${season}:${Math.floor(hour)}:${W}:${H}:${S}`;
  if (v.key !== key || v.bg.width !== cw) { v.bg.width = cw; v.bg.height = ch; drawSceneBg(v.bg.getContext('2d'), S, W, H, GY, hour, season); v.key = key; }
  const ctx = v.ctx; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(v.bg, 0, 0);
  for (let i = 0; i < Math.min(scorch || 0, 6); i++) { ctx.fillStyle = season === 'winter' ? GC.snowD : GC.scorch; ctx.fillRect((8 + i * 7) * S, GY * S, 3 * S, 1 * S); }
  const amp = season === 'monsoon' ? 1.5 : 1;
  const { xs } = layoutPlants(plants, 6, gap);
  for (let i = 0; i < plants.length; i++) {
    const cx = xs[i]; if (clip && cx > W - 3) break;
    const p = plants[i], sway = Math.round(Math.sin(t * 1.1 + i * 0.7) * amp);
    drawPlant(windyBrush(ctx, S, cx, GY - 1, sway), p.species, plantMaturity(p), p.harm, season);
  }
  drawWeatherAnim(ctx, cw, Math.max(4, (GY - 1) * S), season, t);
  drawWildlife(ctx, W, GY, S, season, hour, t, v.seed);
}

// approximate canopy half-width (logical px) per species + maturity, so trees pack tight
function plantHalfWidth(spKey, m) {
  if (m < 2) return 2;
  const sp = SPECIES_BY_KEY[spKey] || SPECIES[0];
  switch (sp.shape) {
    case 'cone': return 3 + Math.floor(m / 2.6);
    case 'slender': return 3 + Math.floor(m / 4.5);
    case 'column': return 3 + Math.floor(m / 5);
    case 'willow': return 4 + Math.floor(m / 2.6);
    case 'bush': return 4 + Math.floor(m / 2.4);
    default: return 3 + Math.floor(m / 2.6);
  }
}
// place each tree by its own width + a small consistent gap; returns centers + total width
function layoutPlants(plants, x0, gap) {
  const xs = []; let cx = x0;
  for (const p of plants) { const hw = plantHalfWidth(p.species, plantMaturity(p)); cx += hw; xs.push(cx); cx += hw + gap; }
  return { xs, endX: cx };
}
function gardenStripWidth(plants, gap) { return Math.max(40, layoutPlants(plants, 6, gap).endX + 6); }
