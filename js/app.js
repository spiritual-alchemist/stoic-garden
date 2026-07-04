// UI: the garden mirror on top, a day's list of weighted items below, a composer
// to add/edit them, and day-to-day history. Every outcome change re-grows the garden.

let STATE = loadState();
let RENDER;
let currentDay = todayStr();
const composer = { id: null, weight: 'notable', outcome: 'open', subtasks: [] };

const $ = s => document.querySelector(s);
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };

function init() {
  RENDER = initGarden($('#garden'));
  const ep = EPIGRAPHS[dayOfYear(new Date()) % EPIGRAPHS.length];
  $('#epigraph').innerHTML = `“${ep.text}” <span class="by">— ${ep.by}</span>`;

  $('#garden').addEventListener('click', onGardenClick);
  $('#dayPrev').addEventListener('click', () => { currentDay = addDays(currentDay, -1); renderAll(); });
  $('#dayNext').addEventListener('click', () => { if (currentDay < todayStr()) { currentDay = addDays(currentDay, 1); renderAll(); } });
  $('#addItem').addEventListener('click', () => openComposer(null));
  $('#export').addEventListener('click', () => exportState(STATE));
  $('#import').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', onImport);

  $('#cClose').addEventListener('click', closeComposer);
  $('#cSave').addEventListener('click', saveComposer);
  $('#cDelete').addEventListener('click', deleteFromComposer);
  $('#overlay').addEventListener('click', e => { if (e.target === $('#overlay')) closeComposer(); });
  $('#cSubAdd').addEventListener('click', addSubInput);
  $('#cSubInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSubInput(); } });
  $('#cWeight').addEventListener('click', e => segPick(e, 'weight', '#cWeight'));
  $('#cOutcome').addEventListener('click', e => segPick(e, 'outcome', '#cOutcome'));

  const sel = $('#cPillar');
  VIRTUES.forEach(v => { const o = el('option'); o.value = v.key; o.textContent = v.label; sel.appendChild(o); });

  renderAll();
}

function renderAll() {
  const gs = gardenState(STATE.items);
  RENDER.set(gs);
  renderDayNav();
  renderItems();
  renderMirror(gs);
}

function renderDayNav() {
  const isToday = currentDay === todayStr();
  $('#dayLabel').textContent = isToday ? `Today · ${humanDate(currentDay)}` : humanDate(currentDay);
  $('#dayNext').disabled = isToday;
}

function weightBadge(w) {
  const b = el('span', `weight-badge w-${w}`, WEIGHTS[w].label.toLowerCase());
  return b;
}

function renderItems() {
  const wrap = $('#items'); wrap.innerHTML = '';
  const list = itemsOn(STATE, currentDay);
  if (!list.length) {
    const empty = el('p', 'items-empty',
      currentDay === todayStr() ? 'Nothing here yet. Add what you mean to do, or what today already asked of you.'
        : 'No items on this day.');
    wrap.appendChild(empty);
    return;
  }
  list.forEach(it => wrap.appendChild(itemCard(it)));
}

function itemCard(it) {
  const v = VIRTUE_BY_KEY[it.pillar];
  const card = el('div', 'item');
  card.style.setProperty('--accent', v.accent);
  if (it.outcome === 'met') card.classList.add('is-met');
  if (it.outcome === 'fell_short') card.classList.add('is-short');

  const head = el('div', 'item-head');
  head.appendChild(el('span', 'item-dot'));
  head.appendChild(el('span', 'item-title', it.title || '(untitled)'));
  head.appendChild(weightBadge(it.weight));
  const acts = el('div', 'item-acts');
  const edit = el('button', 'icon-btn', '✎'); edit.title = 'Edit'; edit.addEventListener('click', () => openComposer(it.id));
  const del = el('button', 'icon-btn', '🗑'); del.title = 'Delete';
  del.addEventListener('click', () => { if (confirm('Delete this item?')) { STATE = removeItem(STATE, it.id); renderAll(); } });
  acts.appendChild(edit); acts.appendChild(del);
  head.appendChild(acts);
  card.appendChild(head);

  head.querySelector('.item-dot').style.background = v.accent;
  const pill = el('span', 'item-pillar', v.label);
  pill.style.color = v.accent;
  card.appendChild(pill);

  if (it.desc) card.appendChild(el('p', 'item-desc', it.desc));

  if (it.subtasks && it.subtasks.length) {
    const sub = el('div', 'subtasks');
    it.subtasks.forEach(s => {
      const row = el('label', 'subtask');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!s.done;
      cb.addEventListener('change', () => { STATE = toggleSubtask(STATE, it.id, s.id); renderAll(); });
      row.appendChild(cb);
      row.appendChild(el('span', s.done ? 'subtask-done' : '', s.title));
      sub.appendChild(row);
    });
    card.appendChild(sub);
  }

  const seg = el('div', 'outcome-seg');
  Object.keys(OUTCOMES).forEach(o => {
    const btn = el('button', 'seg-btn' + (it.outcome === o ? ' active o-' + o : ''), OUTCOMES[o].label);
    btn.addEventListener('click', () => { STATE = setOutcome(STATE, it.id, o); renderAll(); });
    seg.appendChild(btn);
  });
  card.appendChild(seg);
  return card;
}

function renderMirror(gs) {
  const wrap = $('#mirror'); wrap.innerHTML = '';
  const total = gs.reduce((a, s) => a + s.points, 0);
  if (total <= 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  wrap.appendChild(el('h2', 'section-label', 'The mirror'));
  const max = Math.max(1, ...gs.map(s => s.points));
  gs.forEach(s => {
    const row = el('div', 'mrow');
    row.appendChild(el('span', 'mrow-name', s.label));
    const track = el('span', 'mrow-track');
    const fill = el('span', 'mrow-fill');
    fill.style.width = `${Math.round((s.points / max) * 100)}%`;
    fill.style.background = s.accent;
    if (s.health < 0.55 && !s.rooted) fill.classList.add('wilting');
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el('span', 'mrow-stage', s.rooted ? 'rooted' : s.stageLabel));
    wrap.appendChild(row);
  });
  const line = mirrorLine(gs);
  if (line) wrap.appendChild(el('p', 'mirror-line', line));
}

// ---- composer ----
function segPick(e, key, container) {
  const btn = e.target.closest('button'); if (!btn) return;
  composer[key] = btn.dataset[key === 'weight' ? 'w' : 'o'];
  paintSeg(container, key);
}
function paintSeg(container, key) {
  const val = composer[key];
  $(container).querySelectorAll('button').forEach(b => {
    const bv = b.dataset[key === 'weight' ? 'w' : 'o'];
    b.classList.toggle('active', bv === val);
    b.className = 'seg-btn' + (bv === val ? ' active' + (key === 'outcome' ? ' o-' + bv : ' w-sel') : '');
  });
}
function renderComposerSubs() {
  const wrap = $('#cSubList'); wrap.innerHTML = '';
  composer.subtasks.forEach((s, i) => {
    const row = el('div', 'csub');
    row.appendChild(el('span', 'csub-title', s.title));
    const x = el('button', 'icon-btn', '×');
    x.addEventListener('click', () => { composer.subtasks.splice(i, 1); renderComposerSubs(); });
    row.appendChild(x);
    wrap.appendChild(row);
  });
}
function addSubInput() {
  const inp = $('#cSubInput');
  const t = inp.value.trim();
  if (!t) return;
  composer.subtasks.push({ id: makeId(), title: t, done: false });
  inp.value = ''; inp.focus();
  renderComposerSubs();
}
function openComposer(id) {
  composer.id = id; composer.subtasks = [];
  if (id) {
    const it = STATE.items.find(x => x.id === id);
    $('#cTitle').value = it.title; $('#cDesc').value = it.desc || '';
    $('#cPillar').value = it.pillar;
    composer.weight = it.weight; composer.outcome = it.outcome;
    composer.subtasks = (it.subtasks || []).map(s => ({ ...s }));
    $('#cHeading').textContent = 'Edit item';
    $('#cDelete').style.display = '';
  } else {
    $('#cTitle').value = ''; $('#cDesc').value = '';
    $('#cPillar').value = VIRTUES[0].key;
    composer.weight = 'notable'; composer.outcome = 'open';
    $('#cHeading').textContent = 'New item';
    $('#cDelete').style.display = 'none';
  }
  paintSeg('#cWeight', 'weight'); paintSeg('#cOutcome', 'outcome'); renderComposerSubs();
  $('#overlay').classList.add('open');
  setTimeout(() => $('#cTitle').focus(), 60);
}
function closeComposer() { $('#overlay').classList.remove('open'); composer.id = null; }
function saveComposer() {
  const fields = {
    title: $('#cTitle').value, desc: $('#cDesc').value, pillar: $('#cPillar').value,
    weight: composer.weight, outcome: composer.outcome,
    subtasks: composer.subtasks, date: currentDay,
  };
  if (!fields.title.trim() && !composer.subtasks.length) { $('#cTitle').focus(); return; }
  if (composer.id) {
    const patch = { ...fields };
    patch.resolvedDate = fields.outcome === 'open' ? null : (STATE.items.find(x => x.id === composer.id).resolvedDate || todayStr());
    STATE = updateItem(STATE, composer.id, patch);
  } else {
    STATE = addItem(STATE, fields);
  }
  if (navigator.vibrate) navigator.vibrate(10);
  closeComposer();
  renderAll();
}
function deleteFromComposer() {
  if (composer.id && confirm('Delete this item?')) { STATE = removeItem(STATE, composer.id); closeComposer(); renderAll(); }
}

function onGardenClick(ev) {
  const rect = ev.currentTarget.getBoundingClientRect();
  const lx = ((ev.clientX - rect.left) / rect.width) * 132;
  const centers = [22, 52, 81, 110];
  let best = -1, bestD = 99;
  centers.forEach((c, i) => { const d = Math.abs(c - lx); if (d < bestD) { bestD = d; best = i; } });
  if (best >= 0 && bestD < 18) { openComposer(null); $('#cPillar').value = VIRTUES[best].key; }
}

function onImport(ev) {
  const file = ev.target.files[0]; if (!file) return;
  importState(file).then(s => { STATE = s; renderAll(); ev.target.value = ''; })
    .catch(() => { alert('That file could not be read as a garden.'); ev.target.value = ''; });
}

document.addEventListener('DOMContentLoaded', init);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
