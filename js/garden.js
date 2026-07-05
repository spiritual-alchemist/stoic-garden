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

// ---- plant forms ----
function trunk(b, h) { for (let i = 1; i <= h; i++) { b(0, -i, GC.trunk, 2, 1); b(0, -i, GC.trunkD, 1, 1); } }
function roundCanopy(b, cy, rx, ry, fo, blossom) {
  for (let dy = -ry - 1; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++)
    if (dx * dx / (rx * rx) + dy * dy / (ry * ry) <= 1) {
      const col = (dx < -1 && dy < 0) ? fo.l : ((dx > rx - 2 || dy > ry - 2) ? fo.d : fo.b);
      b(1 + dx, cy + dy, col);
    }
  if (blossom) [[-2, -2], [2, -3], [0, -4], [3, 0], [-3, 1], [1, 2]].forEach(o => b(1 + o[0], cy + o[1], blossom));
}
function drawSprout(b, fo, blossom) { b(0, -1, GC.stem); b(0, -2, GC.stem); b(-1, -2, fo.b); b(1, -3, fo.l); b(0, -4, blossom || fo.l); }
function drawRound(b, h, r, fo, blossom) { trunk(b, h); roundCanopy(b, -h - Math.max(1, r - 2), r, r - 1, fo, blossom); }
function drawPine(b, h, fo) {
  b(0, -1, GC.trunkD, 1, 1); b(0, -2, GC.trunkD, 1, 1);
  const top = -(h + 2), maxW = 2 + Math.floor(h / 3);
  for (let yy = -2; yy >= top; yy--) {
    const frac = (yy + 2) / (top + 2), ww = Math.max(0, Math.round((1 - frac) * maxW));
    b(-ww, yy, fo.b, 2 * ww + 1, 1);
    if (ww > 0) { b(-ww, yy, fo.d); b(ww, yy, fo.d); }
  }
  b(0, top, fo.l);
}
function drawBirch(b, h, r, fo, blossom) {
  for (let i = 1; i <= h; i++) { b(0, -i, '#d9d3c4', 1, 1); if (i % 3 === 0) b(0, -i, '#5e564a'); }
  roundCanopy(b, -h - Math.max(1, r - 2), Math.max(2, r - 1), r, fo, blossom);
}
function scarMark(b, h) { for (let i = 3; i <= Math.min(h - 1, 7); i++) b(0, -i, GC.scar); b(2, -h + 1, GC.deadD); }
function drawScarred(b, m) {
  const h = Math.min(12, 3 + m);
  for (let i = 1; i <= h; i++) { b(0, -i, GC.dead, 2, 1); b(0, -i, GC.deadD, 1, 1); }
  [[-1, -1], [-2, -2], [0, -2], [1, -3], [2, -2], [-2, -4], [1, -4], [0, -5]].forEach(o => b(o[0], -h + o[1], GC.deadD));
  [[-2, 0], [2, 0], [-3, 0]].forEach(o => b(o[0], o[1], GC.scorch));
}

function drawPlant(b, spKey, m, scarred, healed) {
  const sp = SPECIES_BY_KEY[spKey] || SPECIES[0];
  const fo = sp.foliage, blossom = sp.blossom;
  if (scarred && !healed) return drawScarred(b, m);
  const st = stageOf(m);
  if (st === 'sprout') { drawSprout(b, fo, blossom); return; }
  const h = Math.min(14, 2 + m), r = Math.min(6, 2 + Math.floor(m / 2.5));
  if (sp.shape === 'pine') drawPine(b, h, fo);
  else if (sp.shape === 'birch') drawBirch(b, h, r, fo, blossom);
  else drawRound(b, h, r, fo, blossom);
  if (scarred && healed) scarMark(b, h);
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
    drawPlant(brushAt(ctx, S, cx, GY - 1), p.species, p.m, p.scarred, p.healed);
  }
}

// convenience: pixel width a detail strip needs to show every plant
function stripWidthFor(plantCount, spacing) { return 6 + Math.max(1, plantCount) * spacing + 6; }
