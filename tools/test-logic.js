// Deterministic tests for the weighted item growth model in data.js.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const m = new Function(src + ';return {pointsFor,growthFraction,subtaskFraction,stageForPoints,wiltPressureFor,healthFor,gardenState,mirrorLine,todayStr,ymd,addDays};')();

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

// wilt: weighted, decays with age, rooted has a floor
{
  const fresh = [I({ pillar: 'justice', weight: 'notable', outcome: 'fell_short', resolvedDate: daysAgo(0) })];
  ok(near(m.healthFor(0, m.wiltPressureFor(fresh, 'justice')), 0.6), 'fresh notable fell-short -> health 0.6');
  const piv = [I({ pillar: 'justice', weight: 'pivotal', outcome: 'fell_short', resolvedDate: daysAgo(0) })];
  ok(near(m.healthFor(0, m.wiltPressureFor(piv, 'justice')), 0.4), 'fresh pivotal fell-short -> health 0.4 (bigger weight hurts more)');
  const old = [I({ pillar: 'justice', weight: 'pivotal', outcome: 'fell_short', resolvedDate: daysAgo(10) })];
  ok(m.healthFor(0, m.wiltPressureFor(old, 'justice')) === 1, 'fell-short fully faded after the wilt window');
  const rooted = [I({ pillar: 'justice', weight: 'pivotal', outcome: 'fell_short', resolvedDate: daysAgo(0) })];
  ok(m.healthFor(16, m.wiltPressureFor(rooted, 'justice')) === 0.5, 'rooted plant resists: health floored at 0.5');
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
