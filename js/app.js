// UI: the field of four plots (the mirror) on top, tap a plot to walk into that virtue's
// garden and pan it, and the daily item log below that drives everything.

let STATE = loadState();
let currentDay = todayStr();
let detailBed = null;
const composer = { id: null, weight: 'notable', outcome: 'open', subtasks: [] };

const $ = s => document.querySelector(s);
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
const nowHour = () => new Date().getHours();

const FIELD = { W: 64, H: 36, GY: 27, S: 5, gap: 2 };
const DETAIL = { H: 28, GY: 20, gap: 3, nominal: 14 };

function init() {
  $('#epigraph').innerHTML = epigraphHtml();
  buildPlots();
  gardenViewAttach($('#detailCanvas'), () => detailBed ? ({ W: detailW, H: DETAIL.H, GY: DETAIL.GY, S: detailS, gap: DETAIL.gap, clip: false, plants: STATE.gardens[detailBed].plants, scorch: STATE.gardens[detailBed].scorch, hour: nowHour(), season: currentSeason() }) : null);
  $('#dayPrev').addEventListener('click', () => { currentDay = addDays(currentDay, -1); renderDay(); });
  $('#dayNext').addEventListener('click', () => { if (currentDay < todayStr()) { currentDay = addDays(currentDay, 1); renderDay(); } });
  $('#addItem').addEventListener('click', () => openComposer(null));
  $('#export').addEventListener('click', () => exportState(STATE));
  $('#import').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', onImport);
  $('#detailBack').addEventListener('click', closeDetail);
  $('#detailPrev').addEventListener('click', () => panDetail(-1));
  $('#detailNext').addEventListener('click', () => panDetail(1));
  $('#cClose').addEventListener('click', closeComposer);
  $('#cSave').addEventListener('click', saveComposer);
  $('#cDelete').addEventListener('click', deleteFromComposer);
  $('#overlay').addEventListener('click', e => { if (e.target === $('#overlay')) closeComposer(); });
  $('#cSubAdd').addEventListener('click', addSubInput);
  $('#cSubInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSubInput(); } });
  $('#cWeight').addEventListener('click', e => segPick(e, 'weight', '#cWeight'));
  $('#cOutcome').addEventListener('click', e => segPick(e, 'outcome', '#cOutcome'));
  const sel = $('#cPillar'); VIRTUES.forEach(v => { const o = el('option'); o.value = v.key; o.textContent = v.label; sel.appendChild(o); });
  renderAll();
  window.addEventListener('resize', () => $('#detailScroll') && updateDetailArrows());
}

function epigraphHtml() {
  const list = (typeof EPIGRAPHS !== 'undefined' && EPIGRAPHS) ? EPIGRAPHS : [{ text: 'Waste no more time arguing what a good man should be. Be one.', by: 'Marcus Aurelius' }];
  const ep = list[Math.floor(Date.now() / 86400000) % list.length];
  return `“${ep.text}” <span class="by">— ${ep.by}</span>`;
}

function renderAll() {
  renderField();
  renderDay();
  if (detailBed) renderDetail();
}

// ---- the field (overview) ----
const PLOT_REFS = {};
function buildPlots() {
  const wrap = $('#plots'); wrap.innerHTML = '';
  VIRTUES.forEach(v => {
    const plot = el('button', 'plot'); plot.style.setProperty('--accent', v.accent);
    const cv = el('canvas', 'plot-canvas'); cv.width = FIELD.W * FIELD.S; cv.height = FIELD.H * FIELD.S;
    plot.appendChild(cv);
    const lab = el('div', 'plot-label'); const name = el('span', 'plot-name', v.label); lab.appendChild(name);
    plot.appendChild(lab);
    plot.addEventListener('click', () => openDetail(v.key));
    wrap.appendChild(plot);
    PLOT_REFS[v.key] = { canvas: cv, name };
    // the animation loop draws this plot live; skip while the detail panel covers the field
    gardenViewAttach(cv, () => detailBed ? null : ({ W: FIELD.W, H: FIELD.H, GY: FIELD.GY, S: FIELD.S, gap: FIELD.gap, clip: true, plants: STATE.gardens[v.key].plants, scorch: STATE.gardens[v.key].scorch, hour: nowHour(), season: currentSeason() }));
  });
}
function renderField() {
  const season = currentSeason();
  const st = $('#seasonTag'); if (st) st.textContent = `this week · ${season}`;
  VIRTUES.forEach(v => {
    const ref = PLOT_REFS[v.key]; if (!ref) return;
    const s = gardenStats(STATE.gardens[v.key]);
    ref.name.textContent = v.label + (s.scars ? ` · ${s.scars} scar${s.scars > 1 ? 's' : ''}` : '');
  });
  const line = mirrorLine(STATE.gardens);
  $('#mirrorLine').textContent = line || '';
  $('#mirrorLine').style.display = line ? '' : 'none';
}

// ---- the detail (one garden, pannable) ----
function openDetail(bed) {
  detailBed = bed; const v = VIRTUE_BY_KEY[bed];
  $('#detailTitle').textContent = v.label; $('#detailTitle').style.color = v.accent;
  $('#detailGreek').textContent = v.greek;
  $('#detail').classList.add('open');
  renderDetail();
}
function closeDetail() { $('#detail').classList.remove('open'); detailBed = null; }
let detailCssW = 0, detailW = 40, detailS = 8;
function renderDetail() {
  const g = STATE.gardens[detailBed];
  const W = gardenStripWidth(g.plants, DETAIL.gap);
  const effW = Math.min((window.innerWidth || 560) - 40, 1200); // fill the laptop
  const S = Math.max(7, Math.min(12, Math.floor(effW / (DETAIL.nominal * 4))));
  const cv = $('#detailCanvas');
  detailW = W; detailS = S; detailCssW = W * S;
  cv.width = W * S; cv.height = DETAIL.H * S;
  cv.style.width = detailCssW + 'px'; cv.style.height = 'auto';
  // the animation loop paints it (see the detail view attached in init)
  $('#detailStats').textContent = statLine(g);
  renderLedger();
  // measure after the panel has laid out, then park at the growing edge
  setTimeout(() => { const sc = $('#detailScroll'); if (sc && detailCssW > sc.clientWidth) sc.scrollLeft = sc.scrollWidth; updateDetailArrows(); }, 80);
}
// human-readable, no mystery numbers
function statLine(g) {
  const s = gardenStats(g);
  if (!s.trees && !s.scars) return 'bare ground — meet this virtue to plant it';
  const evs = STATE.items.filter(i => i.pillar === detailBed && (i.outcome === 'met' || i.outcome === 'fell_short'));
  const first = evs.length ? evs.map(e => e.resolvedDate || e.date).sort()[0] : null;
  const parts = [`${s.trees} ${s.trees === 1 ? 'tree' : 'trees'}`];
  if (s.scars) parts.push(`${s.scars} ${s.scars === 1 ? 'scar' : 'scars'}`);
  if (first) parts.push(`tended since ${shortDate(first)}`);
  return parts.join(' · ');
}
// the grove's history: the events that grew or scarred it, newest first
function renderLedger() {
  const led = $('#detailLedger'); led.innerHTML = '';
  const evs = STATE.items
    .filter(i => i.pillar === detailBed && (i.outcome === 'met' || i.outcome === 'fell_short'))
    .sort((a, b) => { const ka = a.resolvedDate || a.date, kb = b.resolvedDate || b.date; return ka === kb ? b.createdTs - a.createdTs : (ka < kb ? 1 : -1); });
  if (!evs.length) { led.appendChild(el('p', 'led-empty', 'No history yet. When you meet this virtue, it takes root here.')); return; }
  led.appendChild(el('h3', 'led-head', 'How this grove grew'));
  evs.forEach(e => {
    const row = el('div', 'led-row ' + (e.outcome === 'met' ? 'led-met' : 'led-short'));
    row.appendChild(el('span', 'led-mark', e.outcome === 'met' ? '✦' : '✗'));
    const body = el('div', 'led-body');
    body.appendChild(el('span', 'led-title', e.title || WEIGHTS[e.weight].label));
    const eff = effectSummary(e);
    body.appendChild(el('span', 'led-sub', `${WEIGHTS[e.weight].label.toLowerCase()} · ${humanDate(e.resolvedDate || e.date)}${eff ? ' · ' + eff.toLowerCase() : ''}`));
    row.appendChild(body);
    row.appendChild(el('span', 'led-chev', '›'));
    row.addEventListener('click', () => openComposer(e.id));
    led.appendChild(row);
  });
}
// what a task did to the garden — the metadata unique to this place
const VOWEL = /^[aeiou]/i;
function withArticle(w) { return (VOWEL.test(w) ? 'an ' : 'a ') + w; }
function effectSummary(item) {
  const e = item.effect; if (!e) return '';
  if (e.kind === 'scorch') return 'Scorched bare ground';
  const g = STATE.gardens[item.pillar];
  const p = g && g.plants.find(x => x.id === e.plantId);
  const what = p ? withArticle(p.species) : 'a tree';
  if (e.kind === 'plant') return `Planted ${what}`;
  if (e.kind === 'grow') return `Grew ${what}`;
  if (e.kind === 'harm') return `Wounded ${what}`;
  return '';
}
function updateDetailArrows() {
  const sc = $('#detailScroll'); if (!sc) return;
  const overflow = detailCssW > sc.clientWidth + 4;
  $('#detailPrev').style.display = overflow ? '' : 'none';
  $('#detailNext').style.display = overflow ? '' : 'none';
}
function panDetail(dir) { const sc = $('#detailScroll'); sc.scrollBy({ left: dir * sc.clientWidth * 0.8, behavior: 'smooth' }); }

// ---- the daily log ----
function renderDay() {
  const isToday = currentDay === todayStr();
  $('#dayLabel').textContent = isToday ? `Today · ${humanDate(currentDay)}` : humanDate(currentDay);
  $('#dayNext').disabled = isToday;
  const wrap = $('#items'); wrap.innerHTML = '';
  const list = itemsOn(STATE, currentDay);
  if (!list.length) { wrap.appendChild(el('p', 'items-empty', isToday ? 'Nothing here yet. Add what you mean to do, or what today already asked of you.' : 'No items on this day.')); return; }
  list.forEach(it => wrap.appendChild(itemCard(it)));
}

function weightBadge(w) { return el('span', `weight-badge w-${w}`, WEIGHTS[w].label.toLowerCase()); }
const OUTCOME_GLYPH = { open: '○', met: '✓', fell_short: '✗' };
function outcomeToggle(it) {
  const g = el('div', 'otoggle');
  Object.keys(OUTCOMES).forEach(o => {
    const b = el('button', 'otog o-' + o + (it.outcome === o ? ' active' : ''), OUTCOME_GLYPH[o]);
    b.setAttribute('aria-label', OUTCOMES[o].label);
    b.addEventListener('click', ev => { ev.stopPropagation(); STATE = setOutcome(STATE, it.id, o); renderAll(); });
    g.appendChild(b);
  });
  return g;
}
function itemCard(it) {
  const v = VIRTUE_BY_KEY[it.pillar];
  const card = el('div', 'item'); card.style.setProperty('--accent', v.accent);
  if (it.outcome === 'met') card.classList.add('is-met');
  if (it.outcome === 'fell_short') card.classList.add('is-short');
  card.addEventListener('click', () => openComposer(it.id));
  const head = el('div', 'item-head');
  const dot = el('span', 'item-dot'); dot.style.background = v.accent; head.appendChild(dot);
  head.appendChild(el('span', 'item-title', it.title || '(untitled)'));
  head.appendChild(weightBadge(it.weight));
  card.appendChild(head);
  const meta = el('div', 'item-meta');
  const pill = el('span', 'item-pillar', v.label); pill.style.color = v.accent; meta.appendChild(pill);
  if (it.subtasks && it.subtasks.length) meta.appendChild(el('span', 'item-sub-count', `${it.subtasks.filter(s => s.done).length}/${it.subtasks.length}`));
  meta.appendChild(outcomeToggle(it));
  card.appendChild(meta);
  if (it.desc) card.appendChild(el('p', 'item-desc', it.desc));
  if (it.subtasks && it.subtasks.length) {
    const sub = el('div', 'subtasks');
    it.subtasks.forEach(s => {
      const row = el('label', 'subtask'); row.addEventListener('click', ev => ev.stopPropagation());
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!s.done;
      cb.addEventListener('click', ev => ev.stopPropagation());
      cb.addEventListener('change', ev => { ev.stopPropagation(); STATE = toggleSubtask(STATE, it.id, s.id); renderAll(); });
      row.appendChild(cb); row.appendChild(el('span', s.done ? 'subtask-done' : '', s.title)); sub.appendChild(row);
    });
    card.appendChild(sub);
  }
  return card;
}

// ---- composer ----
function segPick(e, key, container) { const btn = e.target.closest('button'); if (!btn) return; composer[key] = btn.dataset[key === 'weight' ? 'w' : 'o']; paintSeg(container, key); }
function paintSeg(container, key) {
  const val = composer[key];
  $(container).querySelectorAll('button').forEach(b => { const bv = b.dataset[key === 'weight' ? 'w' : 'o']; b.className = 'seg-btn' + (bv === val ? ' active' + (key === 'outcome' ? ' o-' + bv : '') : ''); });
}
function renderComposerSubs() {
  const wrap = $('#cSubList'); wrap.innerHTML = '';
  composer.subtasks.forEach((s, i) => {
    const row = el('div', 'csub'); row.appendChild(el('span', 'csub-title', s.title));
    const x = el('button', 'icon-btn', '×'); x.addEventListener('click', () => { composer.subtasks.splice(i, 1); renderComposerSubs(); });
    row.appendChild(x); wrap.appendChild(row);
  });
}
function addSubInput() { const inp = $('#cSubInput'), t = inp.value.trim(); if (!t) return; composer.subtasks.push({ id: makeId(), title: t, done: false }); inp.value = ''; inp.focus(); renderComposerSubs(); }
function openComposer(id) {
  composer.id = id; composer.subtasks = [];
  if (id) {
    const it = STATE.items.find(x => x.id === id);
    $('#cTitle').value = it.title; $('#cDesc').value = it.desc || ''; $('#cPillar').value = it.pillar;
    composer.weight = it.weight; composer.outcome = it.outcome; composer.subtasks = (it.subtasks || []).map(s => ({ ...s }));
    $('#cHeading').textContent = 'Edit item'; $('#cDelete').style.display = '';
  } else {
    $('#cTitle').value = ''; $('#cDesc').value = ''; $('#cPillar').value = VIRTUES[0].key;
    composer.weight = 'notable'; composer.outcome = 'open'; $('#cHeading').textContent = 'New item'; $('#cDelete').style.display = 'none';
  }
  const eff = id ? effectSummary(STATE.items.find(x => x.id === id)) : '';
  $('#cEffect').textContent = eff; $('#cEffect').style.display = eff ? '' : 'none';
  paintSeg('#cWeight', 'weight'); paintSeg('#cOutcome', 'outcome'); renderComposerSubs();
  $('#overlay').classList.add('open'); setTimeout(() => $('#cTitle').focus(), 60);
}
function closeComposer() { $('#overlay').classList.remove('open'); composer.id = null; }
function saveComposer() {
  const fields = { title: $('#cTitle').value, desc: $('#cDesc').value, pillar: $('#cPillar').value, weight: composer.weight, outcome: composer.outcome, subtasks: composer.subtasks, date: currentDay };
  if (!fields.title.trim() && !composer.subtasks.length) { $('#cTitle').focus(); return; }
  if (composer.id) {
    const it = STATE.items.find(x => x.id === composer.id);
    // editing keeps the item's own date — never yank a past event to today
    const patch = { title: fields.title, desc: fields.desc, pillar: fields.pillar, weight: fields.weight, outcome: fields.outcome, subtasks: fields.subtasks };
    patch.resolvedDate = fields.outcome === 'open' ? null : (it.resolvedDate || it.date);
    STATE = updateItem(STATE, composer.id, patch);
  } else STATE = addItem(STATE, fields);
  if (navigator.vibrate) navigator.vibrate(10);
  closeComposer(); renderAll();
}
function deleteFromComposer() { if (composer.id && confirm('Delete this item?')) { STATE = removeItem(STATE, composer.id); closeComposer(); renderAll(); } }

function onImport(ev) {
  const file = ev.target.files[0]; if (!file) return;
  importState(file).then(s => { STATE = s; renderAll(); ev.target.value = ''; }).catch(() => { alert('That file could not be read as a garden.'); ev.target.value = ''; });
}

document.addEventListener('DOMContentLoaded', init);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
