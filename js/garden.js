// The pixel renderer. Draws a bed's garden — sky by the hour, ground, and each plant
// rendered parametrically from its species + maturity + scar. No per-species sprite
// sheets: a species is a recipe (shape + foliage), size comes from maturity.

const GC = {
  stem: '#4f7a3a', trunk: '#7a5230', trunkD: '#5e3f24',
  dead: '#4a382a', deadD: '#33251a', scar: '#241610', scorch: '#241a12',
  soil: '#7a5a40', soilD: '#6a4c34', soilL: '#8a6a4c', grass: '#5a8a3e',
};

function skyPalette(hour) {
  if (hour < 5 || hour >= 20) return { top: '#20304a', mid: '#38496a', night: true };
  if (hour < 8) return { top: '#e7b587', mid: '#cfe0e6', night: false };
  if (hour < 18) return { top: '#cfe8ec', mid: '#e4f1ee', night: false };
  return { top: '#e79f68', mid: '#caa0a0', night: false };
}

function brushAt(ctx, S, cx, gy) {
  return (dx, dy, color, w, h) => { ctx.fillStyle = color; ctx.fillRect(Math.round((cx + dx) * S), Math.round((gy + dy) * S), (w || 1) * S, (h || 1) * S); };
}

function drawSceneBg(ctx, S, W, H, GY, hour) {
  const P = (x, y, c, w, h) => { ctx.fillStyle = c; ctx.fillRect(x * S, y * S, (w || 1) * S, (h || 1) * S); };
  const sky = skyPalette(hour);
  P(0, 0, sky.top, W, GY); P(0, GY - 6, sky.mid, W, 6);
  if (sky.night) {
    for (let i = 0; i < Math.floor(W / 9); i++) { const sx = (i * 61) % (W - 2) + 1, sy = (i * 29) % (GY - 10) + 2; P(sx, sy, '#dfe4ee'); }
    const mx = W - 9; P(mx, 6, '#e9edf4', 3, 3); P(mx - 1, 7, '#cfd6e2'); P(mx + 2, 8, '#cfd6e2');
  } else {
    const sx = hour < 8 ? 6 : (hour >= 18 ? W - 12 : W - 12), sy = 7;
    P(sx, sy, '#f4d98b', 3, 3); P(sx - 1, sy + 1, '#f4d98b', 5, 1); P(sx + 1, sy - 1, '#f6e2a3', 1, 5);
    const cx = Math.floor(W * 0.32); P(cx, 6, '#eef4f2', 5, 1); P(cx + 1, 5, '#eef4f2', 3, 1);
  }
  P(0, GY, GC.soil, W, H - GY);
  for (let y = GY; y < H; y++) for (let x = 0; x < W; x++) { const d = (x * 7 + y * 13) % 6; if (d === 0) P(x, y, GC.soilD); else if (d === 3) P(x, y, GC.soilL); }
  for (let x = 0; x < W; x++) if ((x * 5) % 4 === 0) P(x, GY - 1, GC.grass);
}

// ---- plant forms: taller trunks + distinct silhouettes ----
function trunk(b, h, col, colD) { for (let i = 1; i <= h; i++) { b(0, -i, col, 2, 1); b(0, -i, colD, 1, 1); } }
function ellipseCanopy(b, cy, rx, ry, fo) {
  for (let dy = -ry - 1; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++)
    if (dx * dx / (rx * rx) + dy * dy / (ry * ry) <= 1) {
      const col = (dx < -1 && dy < 0) ? fo.l : ((dx > rx - 2 || dy > ry - 2) ? fo.d : fo.b);
      b(1 + dx, cy + dy, col);
    }
}
function drawSprout(b, fo, blossom) { b(0, -1, GC.stem); b(0, -2, GC.stem); b(-1, -2, fo.b); b(1, -3, fo.l); b(0, -4, blossom || fo.l); }

// broad, rounded — oak
function drawBroad(b, m, fo) {
  const Ht = 5 + Math.round(m * 0.7), trunkH = Math.max(2, Math.round(Ht * 0.5));
  trunk(b, trunkH, GC.trunk, GC.trunkD);
  const rx = 2 + Math.floor(m / 2.6), ry = 2 + Math.floor(m / 4);
  ellipseCanopy(b, -trunkH - ry + 1, rx, ry, fo);
}
// tall narrow cone — pine (evergreen), with tier bands
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
// round canopy heavy with pink blossom — cherry
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
// tall, slender, white-barked — birch
function drawSlender(b, m, fo) {
  const Ht = 6 + Math.round(m * 0.6), trunkH = Math.max(3, Math.round(Ht * 0.55));
  for (let i = 1; i <= trunkH; i++) { b(0, -i, '#dcd7c8', 2, 1); b(0, -i, '#c6c0af', 1, 1); if (i % 3 === 0) b(0, -i, '#5e564a', 1, 1); }
  const rx = 1 + Math.floor(m / 4.5), ry = 2 + Math.floor(m / 3.5);
  ellipseCanopy(b, -trunkH - ry + 2, Math.max(2, rx), ry, fo);
}
// drooping fronds — willow
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
function drawScarred(b, m) {
  const h = Math.min(15, 4 + m);
  for (let i = 1; i <= h; i++) { b(0, -i, GC.dead, 2, 1); b(0, -i, GC.deadD, 1, 1); }
  [[-1, -1], [-2, -2], [0, -2], [1, -3], [2, -2], [-2, -4], [1, -4], [0, -5], [-1, -6], [2, -6]].forEach(o => b(o[0], -h + o[1], GC.deadD));
  [[-2, 0], [2, 0], [-3, 0], [3, 0]].forEach(o => b(o[0], o[1], GC.scorch));
}

// maturity + harm -> living tree, marked veteran, or overwhelmed dead tree
function drawPlant(b, spKey, m, harm) {
  const sp = SPECIES_BY_KEY[spKey] || SPECIES[0];
  const fo = sp.foliage;
  const scarred = harm >= harmThreshold(m);
  if (scarred && harm > m) return drawScarred(b, m); // harm overwhelmed it
  if (stageOf(m) === 'sprout') { drawSprout(b, fo, sp.blossom); if (scarred) scarMark(b, 3); return; }
  switch (sp.shape) {
    case 'cone': drawCone(b, m, fo); break;
    case 'blossom': drawBlossom(b, m, fo, sp.blossom); break;
    case 'slender': drawSlender(b, m, fo); break;
    case 'willow': drawWillow(b, m, fo); break;
    default: drawBroad(b, m, fo);
  }
  if (scarred) scarMark(b, m); // survived, but marked — a veteran
}

// ---- a bed's garden into a canvas ----
function drawGardenStrip(ctx, S, opts) {
  const { W, H, GY, plants, scorch, hour, spacing, clip } = opts;
  ctx.imageSmoothingEnabled = false;
  drawSceneBg(ctx, S, W, H, GY, hour);
  for (let i = 0; i < Math.min(scorch || 0, 6); i++) { ctx.fillStyle = GC.scorch; ctx.fillRect((8 + i * 7) * S, GY * S, 3 * S, 1 * S); }
  const x0 = 6;
  for (let i = 0; i < plants.length; i++) {
    const cx = x0 + i * spacing;
    if (clip && cx > W - 3) break;
    const p = plants[i];
    drawPlant(brushAt(ctx, S, cx, GY - 1), p.species, plantMaturity(p), p.harm);
  }
}

// convenience: pixel width a detail strip needs to show every plant
function stripWidthFor(plantCount, spacing) { return 6 + Math.max(1, plantCount) * spacing + 6; }
