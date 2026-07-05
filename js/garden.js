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
    for (let i = 0; i < Math.floor(W / 9); i++) { const sx = (i * 61) % (W - 2) + 1, sy = (i * 29) % (GY - 10) + 2; P(sx, sy, '#dfe4ee'); }
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
  else drawBroad(b, m, fo);
  if (scarred) scarMark(b, m);
}

// deterministic weather scatter across the sky (no flicker)
function drawWeather(ctx, S, W, GY, season) {
  const P = (x, y, c, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x * S), Math.round(y * S), (w || 1) * S, (h || 1) * S); };
  if (season === 'spring') { for (let i = 0; i < Math.floor(W / 5); i++) P((i * 37 + 3) % W, (i * 23 + 2) % (GY - 2), '#f2a8c8'); }
  else if (season === 'monsoon') { for (let i = 0; i < Math.floor(W * 0.5); i++) P((i * 17 + 2) % W, (i * 11) % (GY - 2), '#aeb9c0', 1, 2); }
  else if (season === 'autumn') { for (let i = 0; i < Math.floor(W / 5); i++) P((i * 41 + 4) % W, (i * 19 + 1) % (GY - 2), (i % 2) ? '#cf7a2a' : '#9c4a1e'); }
  else if (season === 'winter') { for (let i = 0; i < Math.floor(W * 0.45); i++) P((i * 29 + 5) % W, (i * 13) % (GY + 1), '#ffffff'); }
}

function drawGardenStrip(ctx, S, opts) {
  const { W, H, GY, plants, scorch, hour, season, spacing, clip } = opts;
  ctx.imageSmoothingEnabled = false;
  drawSceneBg(ctx, S, W, H, GY, hour, season);
  for (let i = 0; i < Math.min(scorch || 0, 6); i++) { ctx.fillStyle = season === 'winter' ? GC.snowD : GC.scorch; ctx.fillRect((8 + i * 7) * S, GY * S, 3 * S, 1 * S); }
  const x0 = 6;
  for (let i = 0; i < plants.length; i++) {
    const cx = x0 + i * spacing;
    if (clip && cx > W - 3) break;
    const p = plants[i];
    drawPlant(brushAt(ctx, S, cx, GY - 1), p.species, plantMaturity(p), p.harm, season);
  }
  drawWeather(ctx, S, W, GY, season);
}

function stripWidthFor(plantCount, spacing) { return 6 + Math.max(1, plantCount) * spacing + 6; }
