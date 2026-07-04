// Deterministic tests for the weighted item growth model in data.js.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const m = new Function(src + ';return {pointsFor,growthFraction,subtaskFraction,harmFor,toleranceFor,stageForPoints,healthFor,gardenState,mirrorLine,todayStr,ymd,addDays};')();

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  FAIL:', msg); } };
const near = (a, b) => Math.abs(a - b) < 1e-6;
function daysAgo(n) { return m.addDays(m.todayStr(), -n); }
function I(o) { return Object.assign({ id: Math.random().toString(36), date: daysAgo(0), title: 't', desc: '', pillar: 'wisdom', weight: 'notable', outcome: 'open', subtasks: [], resolvedDate: null }, o); }

// growth fraction by outcome + subtasks
ok(m.growthFraction(I({ outcome: 'met' })) === 1, 'met -> full growth');
ok(m.growthFraction(I({ outcome: 'fell_short' })) === 0, 'fell short -> no growth');
ok(near(m.growthFraction(I({ outcome: 'open', subtasks: [{ done: true }, { done: false }, { done: false }, { done: false }] })), 0.25), 'open with 1/4 subtasks -> quarter growth');

// weighted points
{
  const items = [I({ pillar: 'courage', weight: 'pivotal', outcome: 'met' }), I({ pillar: 'courage', weight: 'light', outcome: 'met' }), I({ pillar: 'courage', weight: 'notable', outcome: 'fell_short' })];
  ok(m.pointsFor(items, 'courage') === 4, 'pivotal(3) + light(1) met, fell-short adds 0 -> 4 points');
}

// stage thresholds on points
ok(m.stageForPoints(0).name === 'seed' && m.stageForPoints(1).name === 'sprout' && m.stageForPoints(4).name === 'young' && m.stageForPoints(9).name === 'flowering' && m.stageForPoints(16).name === 'rooted', 'stage thresholds by points');

// wilt: accumulated harm vs growth-scaled tolerance; heal by growing, not waiting
{
  const notable = [I({ pillar: 'justice', weight: 'notable', outcome: 'fell_short' })];
  ok(near(m.healthFor(0, m.harmFor(notable, 'justice')), 1 / 3), 'fresh notable fell-short on ungrown pillar -> health 0.33');
  const piv = [I({ pillar: 'justice', weight: 'pivotal', outcome: 'fell_short' })];
  ok(m.healthFor(0, m.harmFor(piv, 'justice')) === 0, 'pivotal fell-short on ungrown pillar -> fully wilted (fragile)');
  // rooted (growth 16 -> tolerance 11) resists but is NOT immune
  const oneOnRooted = [I({ pillar: 'justice', weight: 'pivotal', outcome: 'fell_short' })];
  ok(near(m.healthFor(16, m.harmFor(oneOnRooted, 'justice')), 1 - 3 / 11), 'rooted resists one pivotal (~0.73)');
  const manyOnRooted = [];
  for (let i = 0; i < 4; i++) manyOnRooted.push(I({ pillar: 'justice', weight: 'pivotal', outcome: 'fell_short' }));
  ok(m.healthFor(16, m.harmFor(manyOnRooted, 'justice')) === 0, 'enough harm wilts even a rooted plant (no immunity)');
  // failures never fade; you heal only by growing
  const stale = [I({ pillar: 'justice', weight: 'notable', outcome: 'fell_short', date: daysAgo(60), resolvedDate: daysAgo(60) })];
  ok(m.harmFor(stale, 'justice') === 2, 'old failures still count fully (no time decay)');
  ok(m.healthFor(2, 2) < m.healthFor(16, 2), 'same harm hurts less as the plant grows (heal by doing better)');
}

// gardenState + mirror
{
  const items = [];
  for (let i = 0; i < 6; i++) items.push(I({ pillar: 'courage', weight: 'pivotal', outcome: 'met', resolvedDate: daysAgo(i) })); // 18 pts -> rooted
  items.push(I({ pillar: 'wisdom', weight: 'notable', outcome: 'met' }), I({ pillar: 'wisdom', weight: 'notable', outcome: 'met' })); // 4
  items.push(I({ pillar: 'justice', weight: 'notable', outcome: 'met' })); // 2
  items.push(I({ pillar: 'temperance', weight: 'light', outcome: 'met' })); // 1 -> least
  const gs = m.gardenState(items);
  const c = gs.find(g => g.key === 'courage'), t = gs.find(g => g.key === 'temperance');
  ok(c.rooted && c.stage === 'rooted', '18 points -> courage rooted');
  ok(t.stage === 'sprout', '1 point -> temperance sprouting');
  const line = m.mirrorLine(gs);
  ok(line && /courage/i.test(line) && /temperance/i.test(line), 'mirror names most-grown and least: "' + line + '"');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
