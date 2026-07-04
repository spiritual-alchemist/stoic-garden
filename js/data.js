// The garden's knowledge as data. Pillars, weights, and how weighted, three-state
// items become growth and wilt. Growth from what you MET, wilt only from what you
// consciously mark FELL SHORT. Open items and neglect never punish.

const VIRTUES = [
  { key: 'wisdom',     label: 'Wisdom',     greek: 'sophia',     accent: '#8a6fd6' },
  { key: 'justice',    label: 'Justice',    greek: 'dikaiosyne', accent: '#e0a52e' },
  { key: 'courage',    label: 'Courage',    greek: 'andreia',    accent: '#d1503a' },
  { key: 'temperance', label: 'Temperance', greek: 'sophrosyne', accent: '#3fa0a8' },
];
const VIRTUE_BY_KEY = Object.fromEntries(VIRTUES.map(v => [v.key, v]));

// Weight scales both reward and punishment. Value is the growth/wilt magnitude.
const WEIGHTS = {
  light:   { value: 1, label: 'Light' },
  notable: { value: 2, label: 'Notable' },
  pivotal: { value: 3, label: 'Pivotal' },
};
const WEIGHT_ORDER = ['light', 'notable', 'pivotal'];

const OUTCOMES = {
  open:       { label: 'Open' },
  met:        { label: 'Met it' },
  fell_short: { label: 'Fell short' },
};

// Stage is read off accumulated GROWTH POINTS (weighted mets). The code interprets data.
const STAGES = [
  { name: 'seed',      minPoints: 0,  label: 'unplanted' },
  { name: 'sprout',    minPoints: 1,  label: 'sprouting' },
  { name: 'young',     minPoints: 4,  label: 'growing' },
  { name: 'flowering', minPoints: 9,  label: 'flowering' },
  { name: 'rooted',    minPoints: 16, label: 'rooted · perennial' },
];
const ROOTED_MIN_POINTS = 16;

// Wilt from fell-short items, fading over WILT_WINDOW days. Rooted plants have a floor.
const WILT_WINDOW = 10;
const HEALTH_SCALE = 5;
const ROOTED_FLOOR = 0.5;

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

// ---- date helpers (local, no UTC drift) ----
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr() { return ymd(new Date()); }
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }
function dayOfYear(d) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }
function humanDate(s) { return parseYmd(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// ---- growth model ----
function weightValue(item) { return (WEIGHTS[item.weight] || WEIGHTS.notable).value; }
function subtaskFraction(item) {
  const s = item.subtasks || [];
  if (!s.length) return item.outcome === 'met' ? 1 : 0;
  return s.filter(t => t.done).length / s.length;
}
// how much an item has grown its pillar, in [0,1] of its weight
function growthFraction(item) {
  if (item.outcome === 'met') return 1;
  if (item.outcome === 'fell_short') return 0;
  return subtaskFraction(item); // open: partial credit for subtask progress
}
function resolvedDay(item) { return item.resolvedDate || item.date; }

function pointsFor(items, key) {
  let p = 0;
  for (const it of items) if (it.pillar === key) p += weightValue(it) * growthFraction(it);
  return p;
}
function wiltPressureFor(items, key) {
  let pressure = 0;
  const today = todayStr();
  for (const it of items) {
    if (it.pillar !== key || it.outcome !== 'fell_short') continue;
    const age = daysBetween(resolvedDay(it), today);
    pressure += weightValue(it) * Math.max(0, 1 - age / WILT_WINDOW);
  }
  return pressure;
}
function stageForPoints(points) {
  let s = STAGES[0];
  for (const st of STAGES) if (points >= st.minPoints) s = st;
  return s;
}
function healthFor(points, pressure) {
  const rooted = points >= ROOTED_MIN_POINTS;
  return clamp(1 - pressure / HEALTH_SCALE, rooted ? ROOTED_FLOOR : 0, 1);
}

function gardenState(items) {
  return VIRTUES.map(v => {
    const points = pointsFor(items, v.key);
    const pressure = wiltPressureFor(items, v.key);
    const stage = stageForPoints(points);
    return {
      ...v, points, stage: stage.name, stageLabel: stage.label,
      rooted: points >= ROOTED_MIN_POINTS,
      health: healthFor(points, pressure),
    };
  });
}

// The mirror: the asymmetry between what you grow and what you let slip.
function mirrorLine(state) {
  const total = state.reduce((a, s) => a + s.points, 0);
  if (total < 3) return null;
  const sorted = [...state].sort((a, b) => b.points - a.points);
  const top = sorted[0], bottom = sorted[sorted.length - 1];
  if (top.points === bottom.points) return null;
  return `You keep growing ${top.label.toLowerCase()}. ${bottom.label} you keep leaving open.`;
}
