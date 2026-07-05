// Diagnostic: is the die random, and what happens on re-completion?
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const m = new Function(src + ';return {applyEffect,undoEffect,makeRng,makeId,emptyGardens};')();

// distribution across many DIFFERENT tasks
let plant = 0, grow = 0;
const g = { plants: [], scorch: 0 };
for (let i = 0; i < 300; i++) {
  const item = { id: m.makeId(), outcome: 'met', weight: 'notable', pillar: 'wisdom' };
  const e = m.applyEffect(g, item, m.makeRng(item.id));
  if (e.kind === 'plant') plant++; else grow++;
}
console.log(`across 300 tasks:  planted ${plant}  /  grew ${grow}   (target ~25/75)`);

// determinism: complete the SAME task twice on a fresh garden
function firstRoll() {
  const item = { id: 'FIXED_ID_123', outcome: 'met', weight: 'notable', pillar: 'wisdom' };
  const gg = { plants: [{ id: 'x', species: 'oak', growth: 3, harm: 0, refs: 1 }], scorch: 0 };
  return m.applyEffect(gg, item, m.makeRng(item.id));
}
const a = firstRoll(), b = firstRoll();
console.log(`same task, rolled twice (seeded by id):  ${a.kind} vs ${b.kind}  -> ${a.kind === b.kind ? 'IDENTICAL (deterministic)' : 'different'}`);

// what a fresh (Math.random) roll would give across 8 re-completions of one task
const kinds = [];
for (let i = 0; i < 8; i++) {
  const item = { id: 'x', outcome: 'met', weight: 'notable', pillar: 'wisdom' };
  const gg = { plants: [{ id: 'a', species: 'oak', growth: 3, harm: 0, refs: 1 }, { id: 'b', species: 'pine', growth: 5, harm: 0, refs: 1 }], scorch: 0 };
  kinds.push(m.applyEffect(gg, item, Math.random).kind);
}
console.log(`same task re-rolled 8x with Math.random:  ${kinds.join(', ')}`);
