// Generates the app icons as PNGs with zero dependencies (hand-encoded PNG + Node zlib).
// The emblem: a small tree over soil with four blossoms — one per virtue.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const crcTable = (() => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const hx = h => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const COL = {
  bg: hx('#efe7d8'), soil: hx('#7a5a40'), soilD: hx('#6a4c34'), trunk: hx('#7a5230'), trunkD: hx('#5e3f24'),
  leaf: hx('#6fae4e'), leafL: hx('#8cc466'), leafD: hx('#3f7330'),
  wisdom: hx('#8a6fd6'), justice: hx('#e0a52e'), courage: hx('#d1503a'), temperance: hx('#3fa0a8'),
};

// emblem on a 32x32 logical grid -> returns [r,g,b] or null for transparent
function pixel(x, y) {
  const cx = 16, cyCanopy = 13;
  // soil
  if (y >= 24) return ((x * 7 + y * 13) % 5 === 0) ? COL.soilD : COL.soil;
  // trunk
  if (x >= 15 && x <= 16 && y >= 17 && y < 24) return x === 15 ? COL.trunkD : COL.trunk;
  // canopy ellipse
  const dx = x - cx, dy = y - cyCanopy, rx = 8, ry = 7;
  if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
    // blossoms
    const bl = [[cx, cyCanopy - 6, COL.wisdom], [cx + 6, cyCanopy - 1, COL.justice], [cx - 5, cyCanopy + 4, COL.courage], [cx - 6, cyCanopy - 2, COL.temperance]];
    for (const [bx, by, c] of bl) if (Math.abs(x - bx) <= 1 && Math.abs(y - by) <= 1) return c;
    if (dx < -1 && dy < 0) return COL.leafL;
    if (dx > rx - 3 || dy > ry - 2) return COL.leafD;
    return COL.leaf;
  }
  return COL.bg;
}

function build(size) {
  const L = 32, scale = size / L;
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = pixel(Math.floor(x / scale), Math.floor(y / scale)) || COL.bg;
    const i = (y * size + x) * 4;
    rgba[i] = p[0]; rgba[i + 1] = p[1]; rgba[i + 2] = p[2]; rgba[i + 3] = 255;
  }
  return png(size, size, rgba);
}

const dir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon-192.png'), build(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), build(512));
fs.writeFileSync(path.join(dir, 'icon-512-maskable.png'), build(512));
console.log('icons written to', dir);
