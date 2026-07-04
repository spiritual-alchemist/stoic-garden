// End-to-end smoke test with a DOM shim: loads the real scripts, drives the composer
// (add item, weight, subtasks, outcome), then checks persistence and the garden state.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const ctxStub = new Proxy({ fillRect() {}, drawImage() {}, clearRect() {}, imageSmoothingEnabled: false, fillStyle: '' }, { get: (t, k) => (k in t ? t[k] : () => {}) });
function Elem(tag) {
  const style = { setProperty(k, v) { this[k] = v; } };
  const e = {
    tagName: tag, children: [], _text: '', _cls: '', value: '', checked: false, disabled: false,
    attributes: {}, dataset: {}, style, clientWidth: 660, width: 0, height: 0, title: '', type: '',
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    _l: {},
    get className() { return this._cls; },
    set className(v) { this._cls = String(v); this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
    set textContent(v) { this._text = String(v); this.children = []; },
    get textContent() { return this._text; },
    set innerHTML(v) { this._html = v; if (v === '') this.children = []; },
    get innerHTML() { return this._html || ''; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    remove() {},
    setAttribute(k, v) { this.attributes[k] = v; }, getAttribute(k) { return this.attributes[k]; },
    addEventListener(ev, fn) { (this._l[ev] = this._l[ev] || []).push(fn); },
    dispatch(ev, arg) { arg = arg || {}; if (!arg.stopPropagation) arg.stopPropagation = () => {}; if (!('target' in arg)) arg.target = this; (this._l[ev] || []).forEach(f => f(arg)); },
    click() { this.dispatch('click', { target: this }); },
    focus() {}, getContext() { return ctxStub; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 660, height: 400 }; },
    closest(sel) { let n = this; while (n) { if (sel === 'button' && n.tagName === 'button') return n; n = n.parentNode; } return null; },
    querySelector(sel) { const all = this.querySelectorAll(sel); return all[0] || null; },
    querySelectorAll(sel) { const out = []; const tag = sel.replace('.', ''); (function rec(n) { for (const c of n.children) { if ((sel[0] === '.' && c.classList.contains(tag)) || c.tagName === sel) out.push(c); rec(c); } })(this); return out; },
  };
  return e;
}
const IDS = ['garden', 'epigraph', 'mirror', 'dayPrev', 'dayNext', 'dayLabel', 'items', 'addItem',
  'export', 'import', 'importFile', 'overlay', 'cClose', 'cHeading', 'cTitle', 'cDesc', 'cPillar',
  'cWeight', 'cOutcome', 'cSubList', 'cSubInput', 'cSubAdd', 'cSave', 'cDelete'];
const byId = {}; IDS.forEach(id => byId[id] = Elem('div'));
// static composer seg buttons (as in index.html)
function seg(parent, key, val, label) { const b = Elem('button'); b.dataset[key] = val; b.textContent = label; parent.appendChild(b); }
['light', 'notable', 'pivotal'].forEach(w => seg(byId.cWeight, 'w', w, w));
['open', 'met', 'fell_short'].forEach(o => seg(byId.cOutcome, 'o', o, o));

const docL = {};
global.document = {
  createElement: t => Elem(t),
  querySelector: sel => (sel[0] === '#' ? byId[sel.slice(1)] : null),
  addEventListener: (ev, fn) => { (docL[ev] = docL[ev] || []).push(fn); },
  body: Elem('body'),
  _fire: ev => (docL[ev] || []).forEach(f => f()),
};
let rafCount = 0;
global.requestAnimationFrame = cb => { if (rafCount++ < 2) cb(0); };
global.window = { addEventListener() {}, matchMedia: () => ({ matches: false }) };
global.navigator = { vibrate() {} };
global.setTimeout = fn => { try { fn(); } catch (_) {} return 0; };
global.clearTimeout = () => {};
global.alert = () => {}; global.confirm = () => true;
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
global.location = { origin: 'http://localhost' };

const combined = ['data.js', 'store.js', 'garden.js', 'app.js']
  .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n;\n') + '\n;globalThis.gardenState = gardenState;';
new Function(combined)();

function pillarState(key) { return gardenState(JSON.parse(mem['stoic-garden-v2']).items).find(g => g.key === key); }

try {
  document._fire('DOMContentLoaded');
  ok(byId.cPillar.children.length === 4, 'pillar dropdown populated with 4 options');
  ok(byId.items.children.length === 1 && byId.items.children[0].classList.contains('items-empty'), 'starts with empty state');

  // add an OPEN pivotal courage item with two subtasks
  byId.addItem.click();
  ok(byId.overlay.classList.contains('open'), 'add opens composer');
  byId.cTitle.value = 'Finish the hard PR';
  byId.cPillar.value = 'courage';
  byId.cWeight.dispatch('click', { target: byId.cWeight.children[2] }); // pivotal
  byId.cSubInput.value = 'read the diff'; byId.cSubAdd.click();
  byId.cSubInput.value = 'write comments'; byId.cSubAdd.click();
  ok(byId.cSubList.children.length === 2, 'two subtasks added in composer');
  byId.cSave.click();

  let items = JSON.parse(mem['stoic-garden-v2']).items;
  ok(items.length === 1, 'one item saved');
  ok(items[0].pillar === 'courage' && items[0].weight === 'pivotal' && items[0].outcome === 'open', 'saved with right pillar/weight/outcome');
  ok(items[0].subtasks.length === 2, 'subtasks persisted');
  ok(pillarState('courage').points === 0, 'open item with no ticks -> 0 growth');

  // tick one subtask -> partial growth (pivotal=3, 1/2 done -> 1.5)
  const card = byId.items.children.find(c => c.classList.contains('item'));
  const firstCb = card.querySelectorAll('input')[0];
  firstCb.dispatch('change');
  ok(Math.abs(pillarState('courage').points - 1.5) < 1e-6, 'ticking 1 of 2 subtasks -> half of pivotal growth (1.5)');

  // mark it MET via the compact toggle -> full pivotal growth (3)
  const metBtn = card.querySelectorAll('.otog').find(b => b.classList.contains('o-met'));
  metBtn.click();
  ok(pillarState('courage').points === 3, 'marking met -> full pivotal points (3)');
  ok(pillarState('courage').health === 1, 'met item does not wilt');

  // add a fell-short notable justice item -> justice wilts, no growth
  byId.addItem.click();
  byId.cTitle.value = 'snapped at a teammate';
  byId.cPillar.value = 'justice';
  byId.cWeight.dispatch('click', { target: byId.cWeight.children[1] }); // notable
  byId.cOutcome.dispatch('click', { target: byId.cOutcome.children[2] }); // fell_short
  byId.cSave.click();
  ok(pillarState('justice').points === 0, 'fell-short gives no growth');
  ok(Math.abs(pillarState('justice').health - 1 / 3) < 1e-6, 'fresh notable fell-short on ungrown justice -> health 0.33');

  // day navigation: go back a day, list is that day (empty), cannot go past today
  byId.dayPrev.click();
  ok(byId.dayNext.disabled === false, 'after going back, next-day is enabled');
  byId.dayNext.click();
  ok(byId.dayNext.disabled === true, 'back at today, next-day disabled');

  // delete the courage item: tap the card to open the editor, then delete
  const cCard = byId.items.children.find(c => c.classList.contains('item') && c.querySelectorAll('.item-title')[0]._text.includes('PR'));
  cCard.click();
  ok(byId.overlay.classList.contains('open'), 'tapping a card opens the editor');
  byId.cDelete.click();
  ok(JSON.parse(mem['stoic-garden-v2']).items.length === 1, 'delete from editor removes the item');
} catch (e) {
  fail++; console.log('  THREW:', e.message, '\n', (e.stack || '').split('\n').slice(1, 4).join('\n'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
