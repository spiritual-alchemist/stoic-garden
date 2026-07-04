// The pixel-art engine. Custom plants, one species per virtue, drawn procedurally
// so growth stage, wilt, wind and time-of-day are all live — nothing pre-rendered.

// ---- color helpers ----
function _hx(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function _toHx(r, g, b) { const c = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'); return '#' + c(r) + c(g) + c(b); }
function lerpC(a, b, t) { const A = _hx(a), B = _hx(b); return _toHx(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }

const WILT_GRAY = '#93967a';
function wilt(color, health) {
  if (health >= 0.9) return color;
  const t = Math.min(0.72, (0.9 - health) * 0.9);
  return lerpC(color, WILT_GRAY, t);
}

// shared plant palette
const C = {
  stem: '#4f7a3a', stemD: '#3d5f2c', leaf: '#6fae4e', leafL: '#8cc466', leafD: '#3f7330',
  trunk: '#7a5230', trunkD: '#5e3f24', olive: '#7fa27a', oliveD: '#5f8060',
  gold: '#e0a52e', goldL: '#f2c65a', goldD: '#b07d18',
  bushD: '#356b2e', bushL: '#5aa04a', pale: '#efe7f7', flame: '#f0a24a',
  cool: '#7fd4d8', seed: '#3d2a1a',
};

// A brush knows the plant's base, its wilt (droop + desaturation) and the wind sway.
function brushFor(g, S, cx, gy, health, wind) {
  const droop = 1 - health;
  return (dx, dy, color, w = 1, h = 1) => {
    const up = -dy;
    const sway = up > 3 ? wind : 0;
    const bend = Math.round(droop * up * 0.45);
    const x = cx + dx + sway + bend, y = gy + dy;
    g.fillStyle = wilt(color, health);
    g.fillRect(Math.round(x * S), Math.round(y * S), w * S, h * S);
  };
}

function canopy(b, cxo, cyo, rx, ry, base, light, dark) {
  for (let dy = -ry - 1; dy <= ry; dy++)
    for (let dx = -rx; dx <= rx; dx++)
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        const col = (dx < -1 && dy < 0) ? light : ((dx > rx - 2 || dy > ry - 2) ? dark : base);
        b(cxo + dx, cyo + dy, col);
      }
}

// ---- shared early stages ----
function drawSeed(b) { b(0, -1, C.seed); b(-1, -1, '#59422f'); }
function drawSprout(b, accent) {
  b(0, -1, C.stem); b(0, -2, C.stem); b(0, -3, C.stem);
  b(-1, -2, C.leaf); b(1, -3, C.leafL);
  b(0, -4, accent);
}

// ---- wisdom: olive / laurel — silver-green, pale blooms, dark drupes ----
const wisdom = {
  young(b, a) {
    for (let i = 1; i <= 6; i++) b(0, -i, i > 3 ? C.stemD : C.stem);
    b(-1, -3, C.olive); b(-2, -3, C.oliveD); b(1, -4, C.olive); b(2, -5, C.oliveD);
    b(0, -7, a);
  },
  flowering(b, a) {
    for (let i = 1; i <= 8; i++) b(0, -i, i > 4 ? C.stemD : C.stem);
    b(-1, -3, C.olive); b(-2, -4, C.oliveD); b(1, -5, C.olive); b(2, -6, C.oliveD); b(-1, -6, C.olive);
    b(-2, -8, C.pale); b(2, -8, a); b(0, -9, C.pale); b(1, -9, a);
  },
  rooted(b, a) {
    for (let i = 1; i <= 8; i++) { b(0, -i, C.trunk, 2, 1); b(0, -i, C.trunkD); }
    canopy(b, 1, -12, 6, 5, C.olive, '#96b892', C.oliveD);
    [[-3, -12], [2, -13], [4, -10], [-4, -10], [0, -15], [3, -14]].forEach(o => b(o[0] + 1, o[1], C.oliveD));
    [[-2, -11], [1, -14], [3, -11], [-1, -13]].forEach(o => b(o[0] + 1, o[1], a));
  },
};

// ---- justice: wheat — tall, symmetric, golden. Balance. ----
function wheatHead(b, dx, topY) {
  for (let k = 0; k <= 3; k++) {
    b(dx, topY - k, C.gold);
    b(dx - 1, topY - k, k % 2 ? C.goldD : C.goldL);
    b(dx + 1, topY - k, k % 2 ? C.goldL : C.goldD);
  }
  b(dx, topY - 4, C.goldL);
}
const justice = {
  young(b) { for (let i = 1; i <= 6; i++) b(0, -i, C.stem); b(0, -7, C.gold); b(-1, -7, C.goldD); b(1, -7, C.goldL); },
  flowering(b) { for (let i = 1; i <= 8; i++) b(0, -i, i > 5 ? C.stemD : C.stem); b(-1, -4, C.leaf); b(1, -5, C.leafD); wheatHead(b, 0, -9); },
  rooted(b) {
    for (let i = 1; i <= 7; i++) { b(0, -i, C.stem); b(-3, -i, C.stemD); b(3, -i, C.stemD); }
    b(-1, -3, C.leafD); b(1, -4, C.leafD);
    wheatHead(b, 0, -8); wheatHead(b, -3, -8); wheatHead(b, 3, -8);
  },
};

// ---- courage: thorned stem, a bold flame-red bloom, a hardy bush ----
function thorn(b, dx, dy, dir) { b(dx, dy, C.stemD); b(dx + dir, dy, C.stemD); }
function bloomRed(b, a, cx, cy) {
  b(cx, cy, a); b(cx - 1, cy, a); b(cx + 1, cy, a); b(cx, cy - 1, a); b(cx, cy + 1, a);
  b(cx, cy, C.flame); b(cx - 1, cy - 1, C.flame);
}
const courage = {
  young(b, a) { for (let i = 1; i <= 6; i++) b(0, -i, i > 3 ? C.stemD : C.stem); thorn(b, -1, -3, -1); thorn(b, 1, -5, 1); b(0, -7, a); },
  flowering(b, a) {
    for (let i = 1; i <= 8; i++) b(0, -i, i > 4 ? C.stemD : C.stem);
    thorn(b, -1, -3, -1); thorn(b, 1, -6, 1); b(-1, -5, C.leafD); b(1, -4, C.leafD);
    bloomRed(b, a, 0, -9);
  },
  rooted(b, a) {
    canopy(b, 0, -4, 6, 4, C.bushD, C.bushL, '#2a5424');
    for (let i = 1; i <= 2; i++) b(0, -i, C.trunkD);
    [[-3, -5], [3, -6], [0, -8], [-2, -8]].forEach(o => bloomRed(b, a, o[0], o[1]));
    thorn(b, -5, -3, -1); thorn(b, 5, -4, 1);
  },
};

// ---- temperance: measured — tidy stem, one cool bloom, a restrained shrub ----
function bloomCool(b, a, cx, cy) {
  b(cx, cy - 1, a); b(cx - 1, cy, a); b(cx + 1, cy, a); b(cx, cy + 1, a);
  b(cx, cy, C.pale);
}
const temperance = {
  young(b, a) { for (let i = 1; i <= 5; i++) b(0, -i, C.stem); b(-1, -3, C.leaf); b(1, -4, C.leafL); b(0, -6, a); },
  flowering(b, a) { for (let i = 1; i <= 7; i++) b(0, -i, i > 4 ? C.stemD : C.stem); b(-1, -4, C.leaf); b(1, -5, C.leafD); bloomCool(b, a, 0, -8); },
  rooted(b, a) {
    canopy(b, 0, -5, 5, 4, C.leafD, C.leaf, '#2f5e2a');
    for (let i = 1; i <= 2; i++) b(0, -i, C.trunkD);
    [[-2, -6], [2, -6], [0, -8]].forEach(o => bloomCool(b, a, o[0], o[1]));
  },
};

const PLANTS = { wisdom, justice, courage, temperance };

function drawPlant(b, key, stage, accent) {
  if (stage === 'seed') return drawSeed(b);
  if (stage === 'sprout') return drawSprout(b, accent);
  PLANTS[key][stage](b, accent);
}

// ---- the scene: sky by hour, ground, beds, fence ----
function skyPalette(hour) {
  if (hour < 5 || hour >= 20) return { top: '#20304a', mid: '#38496a', ground: 'night' };
  if (hour < 8) return { top: '#e7b587', mid: '#cfe0e6', ground: 'day' };
  if (hour < 18) return { top: '#cfe8ec', mid: '#e4f1ee', ground: 'day' };
  return { top: '#e79f68', mid: '#caa0a0', ground: 'day' };
}

function drawScene(g, S, W, H, GY, hour) {
  const P = (x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x * S, y * S, w * S, h * S); };
  const sky = skyPalette(hour);
  P(0, 0, sky.top, W, GY);
  P(0, GY - 8, sky.mid, W, 8);

  if (sky.ground === 'night') {
    [[18, 8], [34, 5], [52, 12], [70, 7], [96, 6], [112, 11], [26, 16], [84, 15]].forEach(s => P(s[0], s[1], '#e9ecf5'));
    // moon
    canopyRect(g, S, 104, 10, '#eef1f6'); P(102, 9, '#cfd6e2'); P(101, 11, '#cfd6e2');
  } else {
    // sun
    const sx = hour < 8 ? 24 : (hour >= 18 ? 108 : 100), sy = 12;
    P(sx, sy, '#f4d98b', 4, 1); P(sx, sy - 1, '#f4d98b', 4, 1); P(sx + 1, sy - 2, '#f6e2a3', 2, 1); P(sx + 1, sy + 2, '#f6e2a3', 2, 1);
    P(sx - 1, sy, '#f6e2a3', 1, 2); P(sx + 4, sy, '#f6e2a3', 1, 2);
    // clouds
    [[40, 8], [41, 8], [42, 7], [43, 8], [44, 8], [62, 5], [63, 4], [64, 5], [65, 5]].forEach(c => P(c[0], c[1], '#f3f7f4'));
  }

  // ground
  P(0, GY, '#7a5a40', W, H - GY);
  for (let y = GY; y < H; y++) for (let x = 0; x < W; x++) {
    const hsh = (x * 7 + y * 13) % 6;
    if (hsh === 0) P(x, y, '#6a4c34'); else if (hsh === 3) P(x, y, '#8a6a4c');
  }
  // grass line on top of soil
  for (let x = 0; x < W; x++) if ((x * 5) % 4 === 0) P(x, GY - 1, '#5a8a3e');

  // fence across the back
  for (let x = 4; x < W; x += 10) { P(x, GY - 6, '#8a6a4c', 1, 5); P(x, GY - 6, '#6a4c34'); }
  P(2, GY - 5, '#8a6a4c', W - 4, 1); P(2, GY - 3, '#8a6a4c', W - 4, 1);

  // tilled beds
  const centers = [22, 52, 81, 110];
  centers.forEach(cx => { P(cx - 9, GY - 1, '#5f4530', 18, 2); for (let x = cx - 9; x < cx + 9; x += 3) P(x, GY - 1, '#4c3524'); });
}
function canopyRect(g, S, x, y, c) { g.fillStyle = c; g.fillRect((x - 1) * S, (y - 1) * S, 3 * S, 3 * S); }

// ---- public: a self-driving renderer that reads the latest state each frame ----
function initGarden(canvas) {
  const W = 132, H = 82, GY = 54;
  const centers = [22, 52, 81, 110];
  let S = 5, state = [], bgHour = -1;
  const bg = document.createElement('canvas');

  function resize() {
    const cw = canvas.clientWidth || 330;
    S = Math.max(2, Math.floor(cw / W));
    canvas.width = W * S; canvas.height = H * S;
    bgHour = -1;
  }
  function buildBg(hour) {
    bg.width = canvas.width; bg.height = canvas.height;
    drawScene(bg.getContext('2d'), S, W, H, GY, hour);
    bgHour = hour;
  }
  function frame(ts) {
    const hour = new Date().getHours();
    if (bgHour !== hour) buildBg(hour);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, 0, 0);
    state.forEach((s, i) => {
      const wind = Math.round(Math.sin(ts / 1400 + i * 0.7));
      const b = brushFor(ctx, S, centers[i], GY - 1, s.rooted ? 1 : s.health, wind);
      drawPlant(b, s.key, s.stage, s.accent);
    });
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', () => { clearTimeout(resize._t); resize._t = setTimeout(resize, 120); });
  resize();
  requestAnimationFrame(frame);
  return { set(s) { state = s; } };
}
