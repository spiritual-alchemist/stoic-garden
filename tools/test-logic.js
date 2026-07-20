// Tests for the stored-garden engine: apply/undo, reference counting, and — the whole
// point — that editing one task leaves every other tree untouched (no reshuffle).
const fs = require('fs');
const path = require('path');
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const src = ['data.js', 'store.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n;\n');
const m = new Function(src + ';return {applyEffect,undoEffect,plantMaturity,plantScarred,plantDead,harmThreshold,rebuildGardens,emptyGardens,gardenStats,addItem,setOutcome,updateItem,removeItem,todayStr,addDays,AREAS};')();

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  FAIL:', msg); } };
const scripted = vals => { let i = 0; return () => vals[i++ % vals.length]; };
const I = (o) => Object.assign({ outcome: 'met', weight: 'notable', pillar: 'understanding' }, o);

// apply: empty bed plants; existing bed can grow
{ const g = { plants: [], scorch: 0 }; const e = m.applyEffect(g, I({}), scripted([0.1])); ok(g.plants.length === 1 && g.plants[0].growth === 2 && e.kind === 'plant', 'met on empty -> plants a tree'); }
{ const g = { plants: [{ id: 'p', species: 'oak', growth: 3, harm: 0, refs: 1 }], scorch: 0 }; const e = m.applyEffect(g, I({}), scripted([0.9, 0.0])); ok(g.plants[0].growth === 5 && g.plants[0].refs === 2 && e.kind === 'grow', 'met can grow an existing tree'); }

// undo removes a solo tree
{ const g = { plants: [{ id: 'p', species: 'oak', growth: 2, harm: 0, refs: 1 }], scorch: 0 }; m.undoEffect(g, { kind: 'plant', plantId: 'p', base: 2 }); ok(g.plants.length === 0, 'undo a plant with one ref removes it'); }

// THE reference-count case: a tree grown by others survives undo of its planter
{
  const g = { plants: [], scorch: 0 };
  const eA = m.applyEffect(g, I({}), scripted([0.1]));                 // A plants tree P
  const eB = m.applyEffect(g, I({}), scripted([0.9, 0.0]));            // B grows P
  ok(g.plants.length === 1 && g.plants[0].refs === 2, 'A plants, B grows -> one tree, 2 refs');
  m.undoEffect(g, eA);                                                 // undo A (the planter)
  ok(g.plants.length === 1 && g.plants[0].growth === 2, 'undoing the planter leaves the tree alive on B\'s growth (no data loss)');
  m.undoEffect(g, eB);                                                 // undo B too
  ok(g.plants.length === 0, 'once nothing references it, the tree is gone');
}

// harm scars and un-scars exactly
{
  const g = { plants: [{ id: 'p', species: 'oak', growth: 3, harm: 0, refs: 1 }], scorch: 0 };
  const e = m.applyEffect(g, I({ outcome: 'fell_short' }), scripted([0.0]));
  ok(m.plantScarred(g.plants[0]) === true && g.plants[0].refs === 2, 'fell short scars a sapling');
  m.undoEffect(g, e);
  ok(m.plantScarred(g.plants[0]) === false && g.plants[0].refs === 1, 'undoing the harm un-scars it exactly');
}
{ const g = { plants: [], scorch: 0 }; const e = m.applyEffect(g, I({ outcome: 'fell_short' }), scripted([0])); m.undoEffect(g, e); ok(g.scorch === 0, 'scorch on empty bed, then undone'); }

// ---- the no-reshuffle guarantee, through the real store ----
// with fresh rolls, editing a task re-rolls ITS OWN effect (maybe a different tree); the
// guarantee is that no OTHER task is ever re-rolled — their effects stay identical.
{
  let seq = 0;
  const st = { version: 4, items: [], gardens: m.emptyGardens() };
  const add = (w) => { seq++; m.addItem(st, { title: 't' + seq, pillar: 'understanding', weight: w, outcome: 'met', date: m.addDays(m.todayStr(), -20 + seq) }); return st.items[st.items.length - 1]; };
  const a = add('notable'), b = add('pivotal'), c = add('notable'), d = add('light'), e2 = add('pivotal');
  const others = () => JSON.stringify(st.items.filter(i => i.id !== b.id).map(i => i.effect));
  const before = others();

  m.setOutcome(st, b.id, 'fell_short'); // flip ONE task
  ok(others() === before, 'flipping one task never re-rolls any OTHER task (their effects are identical)');
  ok(b.effect && (b.effect.kind === 'harm' || b.effect.kind === 'scorch'), 'the flipped task now carries a harm/scorch effect');

  m.setOutcome(st, b.id, 'met'); // flip it back
  ok(others() === before, 'flipping back still leaves every other task untouched');
}

// ---- the die genuinely samples plant-vs-grow each completion ----
{
  const g = { plants: [], scorch: 0 }; let planted = 0, grew = 0;
  for (let i = 0; i < 50; i++) { const e = m.applyEffect(g, { id: 'z' + i, outcome: 'met', weight: 'notable', pillar: 'understanding' }, Math.random); if (e.kind === 'plant') planted++; else grew++; }
  ok(planted > 0 && grew > 0, `die produces both outcomes over 50 rolls (${planted} planted, ${grew} grew)`);
}

// stats are human-countable
{
  const st = { version: 4, items: [], gardens: m.emptyGardens() };
  for (let i = 0; i < 4; i++) m.addItem(st, { title: 'x', pillar: 'character', weight: 'notable', outcome: 'met', date: m.addDays(m.todayStr(), -i) });
  const s = m.gardenStats(st.gardens.character);
  ok(s.trees >= 1 && s.scars === 0, `character: ${s.trees} trees, ${s.scars} scars`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
