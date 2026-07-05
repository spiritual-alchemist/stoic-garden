// End-to-end smoke test with a DOM shim: loads the real scripts, drives the log,
// and checks the replayed garden reacts (and reverses) as outcomes change.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const ctxStub = new Proxy({ imageSmoothingEnabled: false, fillStyle: '' }, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
function Elem(tag) {
  const style = { setProperty(k, v) { this[k] = v; } };
  const e = {
    tagName: tag, children: [], _text: '', _cls: '', value: '', checked: false, disabled: false, scrollLeft: 0,
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
    removeChild(c) { this.children = this.children.filter(x => x !== c); }, remove() {},
    setAttribute(k, v) { this.attributes[k] = v; }, getAttribute(k) { return this.attributes[k]; },
    addEventListener(ev, fn) { (this._l[ev] = this._l[ev] || []).push(fn); },
    dispatch(ev, arg) { arg = arg || {}; if (!arg.stopPropagation) arg.stopPropagation = () => {}; if (!('target' in arg)) arg.target = this; (this._l[ev] || []).forEach(f => f(arg)); },
    click() { this.dispatch('click', { target: this }); },
    focus() {}, getContext() { return ctxStub; }, scrollBy() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 660, height: 400 }; },
    closest(sel) { let n = this; while (n) { if (sel === 'button' && n.tagName === 'button') return n; n = n.parentNode; } return null; },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) { const out = []; const tag = sel.replace('.', ''); (function rec(n) { for (const c of n.children) { if ((sel[0] === '.' && c.classList.contains(tag)) || c.tagName === sel) out.push(c); rec(c); } })(this); return out; },
  };
  return e;
}
const IDS = ['epigraph', 'seasonTag', 'plots', 'mirrorLine', 'dayPrev', 'dayNext', 'dayLabel', 'items', 'addItem', 'export', 'import', 'importFile',
  'detail', 'detailBack', 'detailPrev', 'detailNext', 'detailTitle', 'detailGreek', 'detailCanvas', 'detailScroll', 'detailStats', 'detailLedger',
  'overlay', 'cClose', 'cHeading', 'cEffect', 'cTitle', 'cDesc', 'cPillar', 'cWeight', 'cOutcome', 'cSubList', 'cSubInput', 'cSubAdd', 'cSave', 'cDelete'];
const byId = {}; IDS.forEach(id => byId[id] = Elem(id === 'detailCanvas' ? 'canvas' : 'div'));
function seg(parent, key, val, label) { const b = Elem('button'); b.dataset[key] = val; b.textContent = label; parent.appendChild(b); }
['light', 'notable', 'pivotal'].forEach(w => seg(byId.cWeight, 'w', w, w));
['open', 'met', 'fell_short'].forEach(o => seg(byId.cOutcome, 'o', o, o));

const docL = {};
global.document = { createElement: t => Elem(t), querySelector: sel => (sel[0] === '#' ? byId[sel.slice(1)] : null), addEventListener: (ev, fn) => { (docL[ev] = docL[ev] || []).push(fn); }, body: Elem('body'), _fire: ev => (docL[ev] || []).forEach(f => f()) };
global.requestAnimationFrame = () => {};
global.window = { addEventListener() {}, matchMedia: () => ({ matches: false }) };
global.navigator = { vibrate() {} };
global.setTimeout = fn => { try { fn(); } catch (_) {} return 0; };
global.clearTimeout = () => {};
global.alert = () => {}; global.confirm = () => true;
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
global.location = { origin: 'http://localhost' };

const combined = ['data.js', 'store.js', 'garden.js', 'app.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n;\n') + '\n;globalThis.getS=function(){return STATE;};';
new Function(combined)();
const G = () => getS().gardens;

try {
  document._fire('DOMContentLoaded');
  ok(byId.plots.children.length === 4, 'field renders 4 plots');
  ok(byId.items.children.length === 1 && byId.items.children[0].classList.contains('items-empty'), 'day starts empty');

  // add an OPEN courage pivotal item -> no plant yet
  byId.addItem.click();
  byId.cTitle.value = 'Finish the hard PR';
  byId.cPillar.value = 'courage';
  byId.cWeight.dispatch('click', { target: byId.cWeight.children[2] });
  byId.cSave.click();
  ok(JSON.parse(mem['stoic-garden-v4']).items.length === 1, 'item saved');
  ok(G().courage.plants.length === 0, 'open item plants nothing');

  // mark met via the compact toggle -> a plant appears
  let card = byId.items.children.find(c => c.classList.contains('item'));
  card.querySelectorAll('.otog').find(b => b.classList.contains('o-met')).click();
  ok(G().courage.plants.length === 1, 'marking met plants one thing in courage');

  // flip to fell short -> plant gone, and a fell-short on an otherwise-empty bed scorches (reversible replay)
  card = byId.items.children.find(c => c.classList.contains('item'));
  card.querySelectorAll('.otog').find(b => b.classList.contains('o-fell_short')).click();
  ok(G().courage.plants.length === 0 && G().courage.scorch === 1, 'flipping to fell short un-plants and scorches (replay is reversible)');

  // flip back to met -> plant returns, scorch gone
  card = byId.items.children.find(c => c.classList.contains('item'));
  card.querySelectorAll('.otog').find(b => b.classList.contains('o-met')).click();
  ok(G().courage.plants.length === 1 && G().courage.scorch === 0, 'flipping back to met restores the plant');

  // open the courage plot -> detail view renders without error
  byId.plots.children[2].click();
  ok(byId.detail.classList.contains('open'), 'tapping a plot opens the detail garden');
  ok(/tree|bare/.test(byId.detailStats._text), 'detail shows garden stats: "' + byId.detailStats._text + '"');
  const ledRow = byId.detailLedger.querySelectorAll('.led-row')[0];
  ok(!!ledRow, 'the grove history has a clickable row');
  if (ledRow) {
    ledRow.click();
    ok(byId.overlay.classList.contains('open'), 'clicking a ledger row opens the task metadata');
    ok(byId.cEffect._text.length > 0, 'the metadata shows its garden effect: "' + byId.cEffect._text + '"');
    byId.cClose.click();
  }
  byId.detailBack.click();
  ok(!byId.detail.classList.contains('open'), 'back returns to the field');

  // day nav
  byId.dayPrev.click(); ok(byId.dayNext.disabled === false, 'previous day enables next');
  byId.dayNext.click(); ok(byId.dayNext.disabled === true, 'back at today, next disabled');

  // delete via editor
  card = byId.items.children.find(c => c.classList.contains('item'));
  card.click(); byId.cDelete.click();
  ok(JSON.parse(mem['stoic-garden-v4']).items.length === 0 && G().courage.plants.length === 0, 'delete removes item and its plant');
} catch (e) {
  fail++; console.log('  THREW:', e.message, '\n', (e.stack || '').split('\n').slice(1, 5).join('\n'));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
