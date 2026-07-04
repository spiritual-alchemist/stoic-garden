// The garden's knowledge lives here as data, not logic.
// The four cardinal virtues, the growth rules, and how evidence becomes a plant.

const VIRTUES = [
  { key: 'wisdom',     label: 'Wisdom',     greek: 'sophia',       accent: '#8a6fd6',
    prompt: 'Where did you see clearly — or fool yourself?' },
  { key: 'justice',    label: 'Justice',    greek: 'dikaiosyne',   accent: '#e0a52e',
    prompt: 'Where did fairness cost you something today?' },
  { key: 'courage',    label: 'Courage',    greek: 'andreia',      accent: '#d1503a',
    prompt: 'Where did you meet fear instead of flinch from it?' },
  { key: 'temperance', label: 'Temperance', greek: 'sophrosyne',   accent: '#3fa0a8',
    prompt: 'Where did you hold back when you wanted more?' },
];

const VIRTUE_BY_KEY = Object.fromEntries(VIRTUES.map(v => [v.key, v]));

// Growth is driven by EVIDENCE = number of distinct days a virtue actually showed up.
// A plant's stage is read off this table; the code just interprets the data.
const STAGES = [
  { name: 'seed',      minEvidence: 0,  label: 'unplanted' },
  { name: 'sprout',    minEvidence: 1,  label: 'sprouting' },
  { name: 'young',     minEvidence: 3,  label: 'growing' },
  { name: 'flowering', minEvidence: 6,  label: 'flowering' },
  { name: 'rooted',    minEvidence: 10, label: 'rooted · perennial' },
];

const ROOTED_MIN_EVIDENCE = 10; // enough real evidence => it becomes a trait, survives missed days

// Health is driven by RECENCY. A young plant wilts when neglected; a rooted one doesn't.
const GRACE_DAYS = 2;   // missed days forgiven before wilt begins
const WILT_WINDOW = 9;  // days of neglect from full health to fully wilted

// Stoic epigraphs, rotated one per day. Retrospection, not decoration.
const EPIGRAPHS = [
  { text: 'You have power over your mind — not outside events. Realize this, and you will find strength.', by: 'Marcus Aurelius' },
  { text: 'No man is free who is not master of himself.', by: 'Epictetus' },
  { text: 'We suffer more often in imagination than in reality.', by: 'Seneca' },
  { text: 'Waste no more time arguing what a good man should be. Be one.', by: 'Marcus Aurelius' },
  { text: 'First say to yourself what you would be; then do what you have to do.', by: 'Epictetus' },
  { text: 'How long are you going to wait before you demand the best for yourself?', by: 'Epictetus' },
  { text: 'It is not that we have a short time to live, but that we waste much of it.', by: 'Seneca' },
  { text: 'The happiness of your life depends upon the quality of your thoughts.', by: 'Marcus Aurelius' },
  { text: 'He who fears death will never do anything worthy of a living man.', by: 'Seneca' },
  { text: 'Difficulties show a person’s character. So when a hard test comes, know it is your training.', by: 'Epictetus' },
  { text: 'The soul becomes dyed with the color of its thoughts.', by: 'Marcus Aurelius' },
  { text: 'Luck is what happens when preparation meets opportunity.', by: 'Seneca' },
  { text: 'Confine yourself to the present.', by: 'Marcus Aurelius' },
  { text: 'Man is not worried by real problems so much as by his imagined anxieties.', by: 'Epictetus' },
];

const TOP_QUESTION = 'Where did today test you — and did you meet it?';

// ---- date helpers (local timezone, never UTC drift) ----
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayStr() { return ymd(new Date()); }
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function daysBetween(aStr, bStr) {
  return Math.round((parseYmd(bStr) - parseYmd(aStr)) / 86400000);
}
function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}
function humanDate(s) {
  const d = parseYmd(s);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---- growth model ----
// evidence = count of distinct days this virtue was logged
function evidenceFor(entries, key) {
  const days = new Set();
  for (const e of entries) if (e.virtue === key) days.add(e.date);
  return days.size;
}
function lastDateFor(entries, key) {
  let last = null;
  for (const e of entries) if (e.virtue === key) if (!last || e.date > last) last = e.date;
  return last;
}
function stageFor(evidence) {
  let s = STAGES[0];
  for (const st of STAGES) if (evidence >= st.minEvidence) s = st;
  return s;
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// health in [0,1]: rooted plants stay full (a trait, not a streak). Others wilt with neglect.
function healthFor(entries, key) {
  const evidence = evidenceFor(entries, key);
  if (evidence === 0) return 1;
  const rooted = evidence >= ROOTED_MIN_EVIDENCE;
  if (rooted) return 1;
  const last = lastDateFor(entries, key);
  const since = daysBetween(last, todayStr());
  const over = Math.max(0, since - GRACE_DAYS);
  return clamp(1 - over / WILT_WINDOW, 0, 1);
}

// one object per virtue describing what to draw and what to say
function gardenState(entries) {
  return VIRTUES.map(v => {
    const evidence = evidenceFor(entries, v.key);
    const stage = stageFor(evidence);
    const health = healthFor(entries, v.key);
    const rooted = evidence >= ROOTED_MIN_EVIDENCE;
    const last = lastDateFor(entries, v.key);
    return { ...v, evidence, stage: stage.name, stageLabel: stage.label, health, rooted, lastDate: last };
  });
}

// The mirror: the asymmetry between what you live and what you mean to.
function mirrorLine(state) {
  const total = state.reduce((a, s) => a + s.evidence, 0);
  if (total < 4) return null;
  const sorted = [...state].sort((a, b) => b.evidence - a.evidence);
  const top = sorted[0], bottom = sorted[sorted.length - 1];
  if (top.evidence === bottom.evidence) return null;
  return `You keep meeting ${top.label.toLowerCase()}. ${bottom.label} you keep meaning to.`;
}

// On-this-day: resurface a past line. Prefer a true anniversary, else the day-of-year picks one.
function echoFor(entries) {
  const today = todayStr();
  const withNotes = entries.filter(e => e.note && e.note.trim() && e.date !== today);
  if (!withNotes.length) return null;
  const md = today.slice(5);
  const anniversaries = withNotes.filter(e => e.date.slice(5) === md);
  const pool = anniversaries.length ? anniversaries : withNotes;
  const idx = dayOfYear(new Date()) % pool.length;
  return pool[idx];
}
