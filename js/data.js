// The garden's knowledge and its engine. The garden is not stored separately — it is
// REPLAYED deterministically from your item log: each completed item rolls its own dice
// (seeded from its id), so the forest is identical every time you open it, yet un-marking
// or deleting an item just recomputes it correctly. Stable, and reversible for free.

const VIRTUES = [
  { key: 'wisdom',     label: 'Wisdom',     greek: 'sophia',     accent: '#8a6fd6' },
  { key: 'justice',    label: 'Justice',    greek: 'dikaiosyne', accent: '#e0a52e' },
  { key: 'courage',    label: 'Courage',    greek: 'andreia',    accent: '#d1503a' },
  { key: 'temperance', label: 'Temperance', greek: 'sophrosyne', accent: '#3fa0a8' },
];
const VIRTUE_BY_KEY = Object.fromEntries(VIRTUES.map(v => [v.key, v]));

const WEIGHTS = { light: { value: 1, label: 'Light' }, notable: { value: 2, label: 'Notable' }, pivotal: { value: 3, label: 'Pivotal' } };
const WEIGHT_ORDER = ['light', 'notable', 'pivotal'];
const OUTCOMES = { open: { label: 'Open' }, met: { label: 'Met it' }, fell_short: { label: 'Fell short' } };

// Plant species — data, not bespoke art. Each is a recipe the renderer reads.
// Distinct SILHOUETTES (broad / cone / slender / weeping / blossom), not just colors.
const SPECIES = [
  { key: 'oak',    shape: 'broad',   foliage: { b: '#6fae4e', l: '#8cc466', d: '#3f7330' } },
  { key: 'pine',   shape: 'cone',    foliage: { b: '#4e8a46', l: '#69a85e', d: '#2f5e2a' }, evergreen: true },
  { key: 'cherry', shape: 'blossom', foliage: { b: '#6fae4e', l: '#8cc466', d: '#3f7330' }, blossom: '#f2a8c8' },
  { key: 'birch',  shape: 'slender', foliage: { b: '#8cbf5e', l: '#a8d477', d: '#5f9440' } },
  { key: 'willow', shape: 'willow',  foliage: { b: '#9cb85a', l: '#bcd47a', d: '#6f8a3e' } },
];
const SPECIES_BY_KEY = Object.fromEntries(SPECIES.map(s => [s.key, s]));

// growth
const MAX_MATURITY = 12;
const GROW_NEW_PROB = 0.25; // ~75% grow an existing plant, ~25% plant a new sapling
function weightValue(item) { return (WEIGHTS[item.weight] || WEIGHTS.notable).value; }
function plantBaseMaturity(w) { return w; } // pivotal drops a sturdier sapling

// maturity -> stage
function stageOf(m) { return m < 2 ? 'sprout' : m < 4 ? 'sapling' : m < 7 ? 'young' : m < 10 ? 'mature' : 'old'; }
// harm needed to scar, by current maturity: young virtue is fragile, old virtue is tough
function harmThreshold(m) { return m < 4 ? 2 : m < 7 ? 4 : 7; }

// ---- deterministic PRNG, seeded per item id ----
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function makeRng(seedStr) {
  let a = hashStr(seedStr) || 1;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- the replay: items -> gardens ----
function completedInOrder(items) {
  return items
    .filter(i => i.outcome === 'met' || i.outcome === 'fell_short')
    .slice()
    .sort((a, b) => {
      const ka = (a.resolvedDate || a.date), kb = (b.resolvedDate || b.date);
      if (ka !== kb) return ka < kb ? -1 : 1;
      if ((a.createdTs || 0) !== (b.createdTs || 0)) return (a.createdTs || 0) - (b.createdTs || 0);
      return a.id < b.id ? -1 : 1;
    });
}

function applyMet(g, item, w, rng) {
  const growable = g.plants.filter(p => p.m < MAX_MATURITY);
  const plantNew = g.plants.length === 0 || growable.length === 0 || rng() < GROW_NEW_PROB;
  if (plantNew) {
    const sp = SPECIES[Math.floor(rng() * SPECIES.length)];
    g.plants.push({ id: item.id, species: sp.key, m: plantBaseMaturity(w), harm: 0, scarred: false, healed: false, seq: g.plants.length });
  } else {
    const p = growable[Math.floor(rng() * growable.length)];
    p.m = Math.min(MAX_MATURITY, p.m + w);
    if (p.scarred) p.healed = true; // fought back to it -> a marked veteran
  }
}

function applyHarm(g, item, w, rng) {
  if (g.plants.length === 0) { g.scorch += 1; return; } // failing a virtue you don't even tend
  const p = g.plants[Math.floor(rng() * g.plants.length)];
  p.harm += w;
  if (!p.scarred && p.harm >= harmThreshold(p.m)) { p.scarred = true; p.healed = false; p.m = Math.max(0, p.m - 2); }
}

function buildGardens(items) {
  const gardens = {};
  for (const v of VIRTUES) gardens[v.key] = { plants: [], scorch: 0 };
  for (const item of completedInOrder(items)) {
    const g = gardens[item.pillar];
    if (!g) continue;
    const rng = makeRng(item.id);
    const w = weightValue(item);
    if (item.outcome === 'met') applyMet(g, item, w, rng);
    else applyHarm(g, item, w, rng);
  }
  return gardens;
}

// summaries for the field view and the mirror line
function gardenDepth(g) { return g.plants.reduce((s, p) => s + p.m, 0); }
function gardenSummary(g) {
  return {
    count: g.plants.length,
    depth: gardenDepth(g),
    scarred: g.plants.filter(p => p.scarred && !p.healed).length,
    scorch: g.scorch,
  };
}

function mirrorLine(gardens) {
  const rows = VIRTUES.map(v => ({ label: v.label, depth: gardenDepth(gardens[v.key]) }));
  const total = rows.reduce((s, r) => s + r.depth, 0);
  if (total < 3) return null;
  const sorted = rows.slice().sort((a, b) => b.depth - a.depth);
  const top = sorted[0], bottom = sorted[sorted.length - 1];
  if (top.depth === bottom.depth) return null;
  return `${top.label} is your deepest grove. ${bottom.label} is still bare ground.`;
}

const EPIGRAPHS = [
  { text: 'You have power over your mind — not outside events. Realize this, and you will find strength.', by: 'Marcus Aurelius' },
  { text: 'No man is free who is not master of himself.', by: 'Epictetus' },
  { text: 'We suffer more often in imagination than in reality.', by: 'Seneca' },
  { text: 'Waste no more time arguing what a good man should be. Be one.', by: 'Marcus Aurelius' },
  { text: 'First say to yourself what you would be; then do what you have to do.', by: 'Epictetus' },
  { text: 'It is not that we have a short time to live, but that we waste much of it.', by: 'Seneca' },
  { text: 'The happiness of your life depends upon the quality of your thoughts.', by: 'Marcus Aurelius' },
  { text: 'Difficulties show a person’s character. When a hard test comes, know it is your training.', by: 'Epictetus' },
  { text: 'The soul becomes dyed with the color of its thoughts.', by: 'Marcus Aurelius' },
  { text: 'Confine yourself to the present.', by: 'Marcus Aurelius' },
];

// ---- date helpers ----
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function todayStr() { return ymd(new Date()); }
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
function humanDate(s) { return parseYmd(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
