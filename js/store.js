// Local-first storage. The garden is STORED alongside the item log. Every change to a
// task reconciles the garden: undo the task's old effect, apply its new one. Nothing else.

// New key: the old Stoic-virtue data doesn't map to these values, so it starts fresh.
const STORE_KEY = 'garden-v5';

function loadState() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const s = JSON.parse(raw); return ensure(s); } } catch (_) {}
  return { version: 5, items: [], gardens: emptyGardens() };
}
function ensure(s) {
  if (!s.items) s.items = [];
  if (!s.gardens) s.gardens = rebuildGardens(s.items);
  for (const a of AREAS) if (!s.gardens[a.key]) s.gardens[a.key] = { plants: [], scorch: 0 }; // fill any missing value
  return s;
}
function saveState(state) { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

// undo the task's previous effect, then apply its current one — with a FRESH die roll
// each time, so completing (or re-completing) a task genuinely samples plant-vs-grow.
function reconcile(state, item, prevPillar, prevEffect) {
  if (prevEffect && state.gardens[prevPillar]) undoEffect(state.gardens[prevPillar], prevEffect);
  if (item.outcome === 'met' || item.outcome === 'fell_short') {
    item.effect = applyEffect(state.gardens[item.pillar], item, Math.random);
  } else {
    item.effect = null;
  }
}

function newItem(f) {
  const now = Date.now(), outcome = f.outcome || 'open';
  return {
    id: makeId(), date: f.date || todayStr(), title: (f.title || '').trim(), desc: (f.desc || '').trim(),
    pillar: f.pillar || AREAS[0].key, weight: f.weight || 'notable', outcome,
    subtasks: f.subtasks || [], resolvedDate: outcome === 'open' ? null : (f.date || todayStr()),
    createdTs: now, updatedTs: now, effect: null,
  };
}
function addItem(state, f) {
  const item = newItem(f);
  state.items.push(item);
  reconcile(state, item, item.pillar, null);
  saveState(state);
  return state;
}
function setOutcome(state, id, outcome) {
  const it = state.items.find(x => x.id === id); if (!it) return state;
  const prevEffect = it.effect, prevPillar = it.pillar;
  it.outcome = outcome; it.resolvedDate = outcome === 'open' ? null : todayStr(); it.updatedTs = Date.now();
  reconcile(state, it, prevPillar, prevEffect);
  saveState(state);
  return state;
}
function updateItem(state, id, patch) {
  const it = state.items.find(x => x.id === id); if (!it) return state;
  const prevEffect = it.effect, prevPillar = it.pillar, prevW = it.weight, prevO = it.outcome;
  Object.assign(it, patch, { updatedTs: Date.now() });
  if (it.pillar !== prevPillar || it.weight !== prevW || it.outcome !== prevO) reconcile(state, it, prevPillar, prevEffect);
  saveState(state);
  return state;
}
function removeItem(state, id) {
  const it = state.items.find(x => x.id === id);
  if (it && it.effect && state.gardens[it.pillar]) undoEffect(state.gardens[it.pillar], it.effect);
  state.items = state.items.filter(x => x.id !== id);
  saveState(state);
  return state;
}
function toggleSubtask(state, id, subId) {
  const it = state.items.find(x => x.id === id); if (!it) return state;
  const st = (it.subtasks || []).find(s => s.id === subId);
  if (st) { st.done = !st.done; it.updatedTs = Date.now(); saveState(state); }
  return state;
}
function itemsOn(state, dateStr) { return state.items.filter(i => i.date === dateStr).sort((a, b) => a.createdTs - b.createdTs); }

function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `garden-${todayStr()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function importState(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result), incoming = parsed.items || [];
        if (!Array.isArray(incoming)) throw new Error('Not a garden file');
        const cur = loadState(), seen = new Set(cur.items.map(i => i.id));
        for (const i of incoming) if (!seen.has(i.id)) cur.items.push(i);
        cur.gardens = rebuildGardens(cur.items); // recompute from the merged log
        saveState(cur); resolve(cur);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
