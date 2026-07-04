// Wires the garden engine to the screen: the daily prompt, the beds you tap,
// the mirror of your asymmetry, and the echo of a past line.

let STATE = loadState();
let RENDER;

const $ = sel => document.querySelector(sel);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

function init() {
  RENDER = initGarden($('#garden'));

  const now = new Date();
  $('#date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  $('#question').textContent = TOP_QUESTION;

  const ep = EPIGRAPHS[dayOfYear(now) % EPIGRAPHS.length];
  $('#epigraph').innerHTML = `“${ep.text}” <span class="by">— ${ep.by}</span>`;

  $('#garden').addEventListener('click', onGardenClick);
  $('#export').addEventListener('click', () => exportState(STATE));
  $('#import').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', onImport);
  $('#reset').addEventListener('click', onReset);
  $('#composerClose').addEventListener('click', closeComposer);
  $('#composerSave').addEventListener('click', saveComposer);
  $('#overlay').addEventListener('click', e => { if (e.target === $('#overlay')) closeComposer(); });

  renderAll();
}

function renderAll() {
  const gs = gardenState(STATE.entries);
  RENDER.set(gs);
  renderBeds(gs);
  renderToday();
  renderMirror(gs);
  renderEcho();
}

function renderBeds(gs) {
  const wrap = $('#beds'); wrap.innerHTML = '';
  gs.forEach(s => {
    const card = el('button', 'bed');
    card.style.setProperty('--accent', s.accent);
    card.appendChild(el('span', 'bed-name', s.label));
    card.appendChild(el('span', 'bed-greek', s.greek));
    const stage = el('span', 'bed-stage', s.stageLabel);
    if (s.health < 0.55 && s.evidence > 0 && !s.rooted) stage.classList.add('wilting');
    if (s.rooted) stage.classList.add('rooted');
    card.appendChild(stage);
    const pips = el('span', 'bed-pips');
    for (let i = 0; i < Math.min(s.evidence, 10); i++) pips.appendChild(el('i', 'pip'));
    card.appendChild(pips);
    card.addEventListener('click', () => openComposer(s.key));
    wrap.appendChild(card);
  });
}

function renderToday() {
  const wrap = $('#today'); wrap.innerHTML = '';
  const list = entriesOn(STATE, todayStr());
  if (!list.length) {
    wrap.appendChild(el('p', 'today-empty', 'Nothing planted today. A bare bed is honest too.'));
    return;
  }
  wrap.appendChild(el('h2', 'section-label', 'Today you met'));
  list.forEach(e => {
    const v = VIRTUE_BY_KEY[e.virtue];
    const chip = el('div', 'log');
    chip.style.setProperty('--accent', v.accent);
    chip.appendChild(el('span', 'log-dot'));
    const body = el('div', 'log-body');
    body.appendChild(el('span', 'log-virtue', v.label));
    if (e.note) body.appendChild(el('span', 'log-note', e.note));
    chip.appendChild(body);
    const del = el('button', 'log-del', '×');
    del.setAttribute('aria-label', 'Remove');
    del.addEventListener('click', () => { STATE = removeEntry(STATE, e.id); renderAll(); });
    chip.appendChild(del);
    wrap.appendChild(chip);
  });
}

function renderMirror(gs) {
  const wrap = $('#mirror'); wrap.innerHTML = '';
  const total = gs.reduce((a, s) => a + s.evidence, 0);
  if (total < 1) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  wrap.appendChild(el('h2', 'section-label', 'The mirror'));
  const max = Math.max(1, ...gs.map(s => s.evidence));
  gs.forEach(s => {
    const row = el('div', 'mrow');
    row.appendChild(el('span', 'mrow-name', s.label));
    const track = el('span', 'mrow-track');
    const fill = el('span', 'mrow-fill');
    fill.style.width = `${Math.round((s.evidence / max) * 100)}%`;
    fill.style.background = s.accent;
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el('span', 'mrow-val', String(s.evidence)));
    wrap.appendChild(row);
  });
  const line = mirrorLine(gs);
  if (line) wrap.appendChild(el('p', 'mirror-line', line));
}

function renderEcho() {
  const wrap = $('#echo'); wrap.innerHTML = '';
  const e = echoFor(STATE.entries);
  if (!e) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const v = VIRTUE_BY_KEY[e.virtue];
  wrap.appendChild(el('h2', 'section-label', 'An echo'));
  const card = el('div', 'echo-card');
  card.style.setProperty('--accent', v.accent);
  card.appendChild(el('span', 'echo-date', `${humanDate(e.date)} · ${v.label}`));
  card.appendChild(el('p', 'echo-note', `“${e.note}”`));
  wrap.appendChild(card);
}

// ---- composer ----
let composerKey = null;
function openComposer(key) {
  composerKey = key;
  const v = VIRTUE_BY_KEY[key];
  $('#composerTitle').textContent = v.label;
  $('#composerTitle').style.color = v.accent;
  $('#composerGreek').textContent = v.greek;
  $('#composerPrompt').textContent = v.prompt;
  $('#composerNote').value = '';
  $('#overlay').classList.add('open');
  setTimeout(() => $('#composerNote').focus(), 60);
}
function closeComposer() { $('#overlay').classList.remove('open'); composerKey = null; }
function saveComposer() {
  if (!composerKey) return;
  STATE = addEntry(STATE, composerKey, $('#composerNote').value);
  if (navigator.vibrate) navigator.vibrate(12);
  closeComposer();
  renderAll();
}

function onGardenClick(ev) {
  const rect = ev.currentTarget.getBoundingClientRect();
  const lx = ((ev.clientX - rect.left) / rect.width) * 132;
  const centers = [22, 52, 81, 110];
  let best = -1, bestD = 99;
  centers.forEach((c, i) => { const d = Math.abs(c - lx); if (d < bestD) { bestD = d; best = i; } });
  if (best >= 0 && bestD < 18) openComposer(VIRTUES[best].key);
}

function onImport(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  importState(file).then(s => { STATE = s; renderAll(); ev.target.value = ''; })
    .catch(() => { alert('That file could not be read as a garden.'); ev.target.value = ''; });
}
function onReset() {
  if (!confirm('Clear the whole garden? Export first if you want to keep it. This cannot be undone.')) return;
  STATE = { version: 1, entries: [] };
  saveState(STATE);
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
