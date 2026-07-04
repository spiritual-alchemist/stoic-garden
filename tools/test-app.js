// End-to-end smoke test with a tiny DOM shim: loads the real app scripts and
// simulates tap -> type -> save -> remove, asserting persistence and UI updates.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// ---- minimal DOM ----
const ctxStub = new Proxy({ fillRect() {}, drawImage() {}, clearRect() {}, imageSmoothingEnabled: false, fillStyle: '' }, { get: (t, k) => (k in t ? t[k] : () => {}) });
function Elem(tag) {
  const style = { setProperty(k, v) { this[k] = v; } };
  return {
    tagName: tag, children: [], _text: '', _cls: '', value: '', attributes: {}, style,
    clientWidth: 660, width: 0, height: 0,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    get className() { return this._cls; },
    set className(v) { this._cls = String(v); this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
    _l: {},
    set textContent(v) { this._text = String(v); this.children = []; },
    get textContent() { return this._text; },
    set innerHTML(v) { this._html = v; if (v === '') this.children = []; },
    get innerHTML() { return this._html || ''; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    remove() {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; },
    addEventListener(ev, fn) { (this._l[ev] = this._l[ev] || []).push(fn); },
    dispatch(ev, arg) { (this._l[ev] || []).forEach(f => f(arg || {})); },
    click() { this.dispatch('click', {}); },
    focus() {}, getContext() { return ctxStub; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 660, height: 400 }; },
    querySelector() { return null; },
  };
}
const IDS = ['date', 'question', 'epigraph', 'garden', 'beds', 'today', 'mirror', 'echo',
  'export', 'import', 'importFile', 'reset', 'overlay', 'composerClose', 'composerSave',
  'composerTitle', 'composerGreek', 'composerPrompt', 'composerNote'];
const byId = {}; IDS.forEach(id => byId[id] = Elem('div'));
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
global.setTimeout = (fn) => { try { fn(); } catch (_) {} return 0; };
global.clearTimeout = () => {};
global.alert = () => {}; global.confirm = () => true;
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
global.location = { origin: 'http://localhost' };

// ---- load the real scripts as one shared scope (as the browser does) ----
const combined = ['data.js', 'store.js', 'garden.js', 'app.js']
  .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'))
  .join('\n;\n') + '\n;globalThis.gardenState = gardenState;';
new Function(combined)();

// ---- run ----
try {
  document._fire('DOMContentLoaded'); // triggers init()
  ok(byId.beds.children.length === 4, 'init renders 4 beds');
  ok(byId.question._text.length > 0, 'daily question set');
  ok(byId.epigraph.innerHTML.includes('—'), 'epigraph rendered');

  // tap the first bed (wisdom) -> composer opens
  byId.beds.children[0].click();
  ok(byId.overlay.classList.contains('open'), 'tapping a bed opens the composer');
  ok(byId.composerTitle._text === 'Wisdom', 'composer titled with tapped virtue');

  // type a note and save
  byId.composerNote.value = 'let the driver merge';
  byId.composerSave.click();

  const saved = JSON.parse(mem['stoic-garden-v1']);
  ok(saved.entries.length === 1, 'saving plants one entry');
  ok(saved.entries[0].virtue === 'wisdom' && saved.entries[0].note === 'let the driver merge', 'entry has right virtue + note');
  ok(!byId.overlay.classList.contains('open'), 'composer closes after save');

  // today's list shows the log
  const hasLog = byId.today.children.some(c => c.classList.contains('log'));
  ok(hasLog, "today's list shows the planting");

  // remove it
  const log = byId.today.children.find(c => c.classList.contains('log'));
  const del = log.children.find(c => c.className === 'log-del');
  del.click();
  ok(JSON.parse(mem['stoic-garden-v1']).entries.length === 0, 'removing a log deletes the entry');

  // log enough evidence to root a virtue, verify state flips to rooted
  const st = JSON.parse(mem['stoic-garden-v1']);
  for (let i = 0; i < 10; i++) st.entries.push({ id: 'x' + i, date: '2026-06-' + String(20 - i).padStart(2, '0'), virtue: 'courage', note: '', ts: 0 });
  mem['stoic-garden-v1'] = JSON.stringify(st);
  const gs = gardenState(st.entries);
  const courage = gs.find(g => g.key === 'courage');
  ok(courage.rooted && courage.stage === 'rooted', '10 evidence days -> courage is a rooted perennial');
} catch (e) {
  fail++; console.log('  THREW:', e.message, '\n', e.stack.split('\n').slice(0, 4).join('\n'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
