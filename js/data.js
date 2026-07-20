// The garden's knowledge and its engine. The garden is STORED, not replayed. Each task
// records what its completion did (its "effect"); changing a task undoes its old effect
// and applies the new one. Trees are reference-counted, so undo is local and lossless —
// editing one task never disturbs the rest of the forest.

// The values you tend. Each is a bed in the garden — labels/colors/icons are data.
const AREAS = [
  { key: 'understanding', label: 'Understanding', icon: 'eye',     sub: 'Seeing more clearly',                  accent: '#6d8fd6' },
  { key: 'competence',    label: 'Competence',    icon: 'mallet',  sub: 'Developing and exercising abilities',  accent: '#e0a52e' },
  { key: 'character',     label: 'Character',      icon: 'compass', sub: 'Acting well',                          accent: '#d1503a' },
  { key: 'health',        label: 'Health',         icon: 'heart',   sub: 'Caring for the body',                  accent: '#5aa04a' },
];
const AREA_BY_KEY = Object.fromEntries(AREAS.map(v => [v.key, v]));

const WEIGHTS = { light: { value: 1, label: 'Light' }, notable: { value: 2, label: 'Notable' }, pivotal: { value: 3, label: 'Pivotal' } };
const WEIGHT_ORDER = ['light', 'notable', 'pivotal'];
const OUTCOMES = { open: { label: 'Open' }, met: { label: 'Met it' }, fell_short: { label: 'Fell short' } };

// Distinct SILHOUETTES, not just colors — eight species, so any one is rare.
const SPECIES = [
  { key: 'oak',    shape: 'broad',   foliage: { b: '#6fae4e', l: '#8cc466', d: '#3f7330' } },
  { key: 'pine',   shape: 'cone',    foliage: { b: '#4e8a46', l: '#69a85e', d: '#2f5e2a' }, evergreen: true },
  { key: 'cherry', shape: 'blossom', foliage: { b: '#6fae4e', l: '#8cc466', d: '#3f7330' }, blossom: '#f2a8c8' },
  { key: 'birch',  shape: 'slender', foliage: { b: '#8cbf5e', l: '#a8d477', d: '#5f9440' } },
  { key: 'willow', shape: 'willow',  foliage: { b: '#9cb85a', l: '#bcd47a', d: '#6f8a3e' } },
  { key: 'poplar', shape: 'column',  foliage: { b: '#84b84e', l: '#a3d06a', d: '#5a8a38' } },
  { key: 'hazel',  shape: 'bush',    foliage: { b: '#5fa048', l: '#7cbb5e', d: '#3d7330' } },
  { key: 'acacia', shape: 'spread',  foliage: { b: '#8faa4e', l: '#adc46e', d: '#647d34' } },
];
const SPECIES_BY_KEY = Object.fromEntries(SPECIES.map(s => [s.key, s]));

const MAX_MATURITY = 12;
const GROW_NEW_PROB = 0.25; // ~75% grow an existing tree, ~25% plant a new one
function weightValue(item) { return (WEIGHTS[item.weight] || WEIGHTS.notable).value; }

// ---- a tree's derived state (pure functions of its stored growth + harm) ----
function plantMaturity(p) { return Math.min(MAX_MATURITY, p.growth); }
function stageOf(m) { return m < 2 ? 'sprout' : m < 4 ? 'sapling' : m < 7 ? 'young' : m < 10 ? 'mature' : 'old'; }
function harmThreshold(m) { return m < 4 ? 2 : m < 7 ? 4 : 7; }
function plantScarred(p) { return p.harm >= harmThreshold(plantMaturity(p)); }
function plantDead(p) { return plantScarred(p) && p.harm > plantMaturity(p); } // harm overwhelmed it

// ---- ids + deterministic dice ----
let _idc = 0;
function makeId() { _idc = (_idc + 1) % 100000; return Date.now().toString(36) + '_' + _idc.toString(36) + Math.random().toString(36).slice(2, 5); }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function makeRng(seedStr) {
  let a = hashStr(seedStr) || 1;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- apply / undo a task's effect on a stored garden (reference-counted) ----
function applyEffect(garden, item, rng) {
  const w = weightValue(item);
  if (item.outcome === 'met') {
    const growable = garden.plants.filter(p => plantMaturity(p) < MAX_MATURITY && !plantDead(p));
    const plantNew = garden.plants.length === 0 || growable.length === 0 || rng() < GROW_NEW_PROB;
    if (plantNew) {
      const species = SPECIES[Math.floor(rng() * SPECIES.length)].key;
      const id = makeId();
      garden.plants.push({ id, species, growth: w, harm: 0, refs: 1 });
      return { kind: 'plant', plantId: id, base: w };
    }
    const p = growable[Math.floor(rng() * growable.length)];
    p.growth += w; p.refs++;
    return { kind: 'grow', plantId: p.id, amount: w };
  }
  if (item.outcome === 'fell_short') {
    if (garden.plants.length === 0) { garden.scorch++; return { kind: 'scorch' }; }
    const p = garden.plants[Math.floor(rng() * garden.plants.length)];
    p.harm += w; p.refs++;
    return { kind: 'harm', plantId: p.id, amount: w };
  }
  return null;
}
function undoEffect(garden, eff) {
  if (!eff) return;
  if (eff.kind === 'scorch') { garden.scorch = Math.max(0, garden.scorch - 1); return; }
  const p = garden.plants.find(x => x.id === eff.plantId);
  if (!p) return; // already gone (its other refs were removed) — nothing to undo
  if (eff.kind === 'plant') p.growth -= eff.base;
  else if (eff.kind === 'grow') p.growth -= eff.amount;
  else if (eff.kind === 'harm') p.harm -= eff.amount;
  p.refs--;
  if (p.refs <= 0) garden.plants = garden.plants.filter(x => x.id !== p.id);
}

function emptyGardens() { const g = {}; for (const v of AREAS) g[v.key] = { plants: [], scorch: 0 }; return g; }
function completedInOrder(items) {
  return items.filter(i => i.outcome === 'met' || i.outcome === 'fell_short').slice().sort((a, b) => {
    const ka = a.resolvedDate || a.date, kb = b.resolvedDate || b.date;
    if (ka !== kb) return ka < kb ? -1 : 1;
    if ((a.createdTs || 0) !== (b.createdTs || 0)) return (a.createdTs || 0) - (b.createdTs || 0);
    return a.id < b.id ? -1 : 1;
  });
}
// build the stored garden from scratch, stamping each item's effect (migration + import)
function rebuildGardens(items) {
  const gardens = emptyGardens();
  for (const it of items) it.effect = null;
  for (const it of completedInOrder(items)) { const g = gardens[it.pillar]; it.effect = g ? applyEffect(g, it, Math.random) : null; }
  return gardens;
}

// ---- summaries ----
function livingDepth(garden) { return garden.plants.filter(p => !plantDead(p)).reduce((s, p) => s + plantMaturity(p), 0); }
function gardenStats(garden) {
  let trees = 0, scars = garden.scorch;
  for (const p of garden.plants) { if (plantDead(p)) scars++; else trees++; }
  return { trees, scars };
}
function mirrorLine(gardens) {
  const rows = AREAS.map(v => ({ label: v.label, depth: livingDepth(gardens[v.key]) }));
  const total = rows.reduce((s, r) => s + r.depth, 0);
  if (total < 3) return null;
  const sorted = rows.slice().sort((a, b) => b.depth - a.depth);
  const top = sorted[0], bottom = sorted[sorted.length - 1];
  if (top.depth === bottom.depth) return null;
  return `${top.label} is your deepest grove. ${bottom.label} is still bare ground.`;
}

// a quiet daily prompt, rotated by day — the ritual voice, not attributed quotes
const PROMPTS = [
  'Where did you see more clearly today?',
  'What can you do now that you couldn’t before?',
  'Where did your character show?',
  'What did you do for your body?',
  'What did today teach you?',
  'Where did you grow, even a little?',
  'What did you meet well — and where did you fall short?',
];

// ---- seasons: a new one every week, straight off the clock (no bookkeeping) ----
const SEASONS = ['spring', 'summer', 'monsoon', 'autumn', 'winter'];
function weekIndex(d) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000 / 7); }
function currentSeason() { return SEASONS[((weekIndex(new Date()) % SEASONS.length) + SEASONS.length) % SEASONS.length]; }

// ---- date helpers ----
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function todayStr() { return ymd(new Date()); }
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
function humanDate(s) { return parseYmd(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
function shortDate(s) { return parseYmd(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
