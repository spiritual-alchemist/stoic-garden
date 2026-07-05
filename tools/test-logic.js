// Tests for the deterministic garden replay engine.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const m = new Function(src + ';return {buildGardens,applyMet,applyHarm,harmThreshold,stageOf,gardenDepth,gardenSummary,mirrorLine,plantBaseMaturity,MAX_MATURITY,SPECIES,todayStr,addDays};')();

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  FAIL:', msg); } };
const scripted = vals => { let i = 0; return () => vals[i++ % vals.length]; };
function daysAgo(n) { return m.addDays(m.todayStr(), -n); }
let seq = 0;
function E(pillar, outcome, weight, opts) { seq++; return Object.assign({ id: 'i' + seq + Math.random().toString(36).slice(2), pillar, outcome, weight: weight || 'notable', date: daysAgo(30 - seq), resolvedDate: daysAgo(30 - seq), createdTs: seq }, opts); }

// stage + threshold tables
ok(m.stageOf(0) === 'sprout' && m.stageOf(3) === 'sapling' && m.stageOf(5) === 'young' && m.stageOf(8) === 'mature' && m.stageOf(11) === 'old', 'maturity -> stage');
ok(m.harmThreshold(1) === 2 && m.harmThreshold(5) === 4 && m.harmThreshold(9) === 7, 'harm threshold rises with maturity');

// applyMet: empty bed always plants
{ const g = { plants: [], scorch: 0 }; m.applyMet(g, { id: 'a' }, 2, scripted([0.9])); ok(g.plants.length === 1 && g.plants[0].m === 2, 'first met plants a sapling sized by weight'); }
// applyMet: grows an existing plant when the die says so
{ const g = { plants: [{ id: 'p', m: 3, harm: 0, scarred: false, healed: false, seq: 0 }], scorch: 0 }; m.applyMet(g, { id: 'b' }, 2, scripted([0.9, 0.0])); ok(g.plants.length === 1 && g.plants[0].m === 5, 'met can grow an existing plant (3 + notable = 5)'); }
// applyMet: all at max forces a new plant
{ const g = { plants: [{ id: 'p', m: m.MAX_MATURITY, harm: 0, scarred: false, healed: false, seq: 0 }], scorch: 0 }; m.applyMet(g, { id: 'c' }, 3, scripted([0.5, 0.5])); ok(g.plants.length === 2, 'all plants maxed -> a met plants a new one (the garden expands)'); }
// applyMet: growing a scarred plant heals it (marked veteran)
{ const g = { plants: [{ id: 'p', m: 5, harm: 5, scarred: true, healed: false, seq: 0 }], scorch: 0 }; m.applyMet(g, { id: 'd' }, 2, scripted([0.9, 0.0])); ok(g.plants[0].healed === true, 'growing a scarred plant heals it into a veteran'); }

// applyHarm: sapling scars easily; old tree resists three hits
{ const g = { plants: [{ id: 'p', m: 3, harm: 0, scarred: false, healed: false, seq: 0 }], scorch: 0 }; m.applyHarm(g, { id: 'e' }, 2, scripted([0.0])); ok(g.plants[0].scarred === true, 'notable fell-short scars a sapling'); }
{
  const g = { plants: [{ id: 'p', m: 9, harm: 0, scarred: false, healed: false, seq: 0 }], scorch: 0 };
  m.applyHarm(g, { id: 'f' }, 3, scripted([0.0])); ok(g.plants[0].scarred === false, 'one pivotal fell-short only dents an old tree');
  m.applyHarm(g, { id: 'g' }, 3, scripted([0.0])); ok(g.plants[0].scarred === false, 'two pivotal fell-shorts still not scarred');
  m.applyHarm(g, { id: 'h' }, 3, scripted([0.0])); ok(g.plants[0].scarred === true, 'three pivotal fell-shorts scar even an old tree (resists, not immune)');
}
// applyHarm: failing an untended virtue leaves a scorch
{ const g = { plants: [], scorch: 0 }; m.applyHarm(g, { id: 'k' }, 2, scripted([0.0])); ok(g.scorch === 1, 'fell-short on an empty bed leaves a scorch'); }

// buildGardens: deterministic, and reversible by omission
{
  const items = [E('wisdom', 'met', 'pivotal'), E('courage', 'met', 'notable'), E('wisdom', 'fell_short', 'notable'), E('wisdom', 'met', 'light')];
  const a = JSON.stringify(m.buildGardens(items));
  const b = JSON.stringify(m.buildGardens(items));
  ok(a === b, 'buildGardens is deterministic (same log -> same forest)');
  const single = [E('temperance', 'met', 'notable')];
  ok(m.buildGardens(single).temperance.plants.length === 1, 'one met -> one plant');
  ok(m.buildGardens([]).temperance.plants.length === 0, 'removing it (empty log) -> bare bed (reversible)');
}
// fill-then-mature keeps plant count bounded well under the number of mets
{
  const items = []; for (let i = 0; i < 30; i++) items.push(E('courage', 'met', 'pivotal'));
  const g = m.buildGardens(items).courage;
  ok(g.plants.length >= 1 && g.plants.length < 30, `30 mets -> ${g.plants.length} plants (bounded), depth ${m.gardenDepth(g)}`);
  ok(m.gardenDepth(g) > 20, 'sustained practice builds real depth');
}
// mirror names deepest grove vs bare ground
{
  const items = [];
  for (let i = 0; i < 6; i++) items.push(E('wisdom', 'met', 'pivotal'));
  items.push(E('courage', 'met', 'light'));
  const line = m.mirrorLine(m.buildGardens(items));
  ok(line && /wisdom/i.test(line) && /bare/i.test(line), 'mirror line: "' + line + '"');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
