// Deterministic tests for the growth model in data.js (no DOM needed).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const m = new Function(src + ';return {evidenceFor,stageFor,healthFor,gardenState,mirrorLine,echoFor,todayStr,ymd,ROOTED_MIN_EVIDENCE};')();

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  FAIL:', msg); } }

// build a date N days ago in local YMD
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return m.ymd(d); }
function E(virtue, dateStr, note) { return { id: Math.random().toString(36), date: dateStr, virtue, note: note || '', ts: 0 }; }

// evidence counts DISTINCT days, not raw entries
{
  const es = [E('courage', daysAgo(0)), E('courage', daysAgo(0)), E('courage', daysAgo(1))];
  ok(m.evidenceFor(es, 'courage') === 2, 'two entries same day count as one evidence day');
}

// stage thresholds
{
  ok(m.stageFor(0).name === 'seed', 'stage 0 -> seed');
  ok(m.stageFor(1).name === 'sprout', 'stage 1 -> sprout');
  ok(m.stageFor(3).name === 'young', 'stage 3 -> young');
  ok(m.stageFor(6).name === 'flowering', 'stage 6 -> flowering');
  ok(m.stageFor(10).name === 'rooted', 'stage 10 -> rooted');
  ok(m.stageFor(50).name === 'rooted', 'stage 50 -> rooted');
}

// health: logged today = full; neglected young wilts; rooted survives
{
  const fresh = [E('wisdom', daysAgo(0)), E('wisdom', daysAgo(1)), E('wisdom', daysAgo(2))];
  ok(m.healthFor(fresh, 'wisdom') === 1, 'logged today -> full health');

  const neglected = [];
  for (let i = 0; i < 4; i++) neglected.push(E('justice', daysAgo(20 + i))); // 4 evidence, last 20 days ago
  const h = m.healthFor(neglected, 'justice');
  ok(h < 0.2, 'young + 20 days neglect -> nearly wilted (' + h.toFixed(2) + ')');

  const rooted = [];
  for (let i = 0; i < m.ROOTED_MIN_EVIDENCE; i++) rooted.push(E('temperance', daysAgo(30 + i))); // rooted, long neglect
  ok(m.healthFor(rooted, 'temperance') === 1, 'rooted survives long neglect (trait, not streak)');
}

// mirror line points at the asymmetry (all virtues present, courage most / temperance least)
{
  const es = [];
  const plan = { courage: 5, wisdom: 3, justice: 2, temperance: 1 };
  for (const [v, n] of Object.entries(plan)) for (let i = 0; i < n; i++) es.push(E(v, daysAgo(i)));
  const gs = m.gardenState(es);
  const line = m.mirrorLine(gs);
  ok(line && /courage/i.test(line) && /temperance/i.test(line), 'mirror names most- and least-lived: "' + line + '"');
}

// echo resurfaces a past note, never today's
{
  const es = [E('wisdom', daysAgo(9), 'let the driver merge'), E('courage', daysAgo(0), 'today line')];
  const e = m.echoFor(es);
  ok(e && e.date === daysAgo(9) && e.note === 'let the driver merge', 'echo returns a past note, not today');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
