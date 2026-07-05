// Local-first storage. Only the item log is stored — the garden is replayed from it.
const STORE_KEY = 'stoic-garden-v3';
const STORE_KEY_V2 = 'stoic-garden-v2';

function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function loadState() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const s = JSON.parse(raw); if (!s.items) s.items = []; return s; } } catch (_) {}
  // carry v2 items forward — same shape, the garden derives from them
  try { const raw = localStorage.getItem(STORE_KEY_V2); if (raw) { const old = JSON.parse(raw); const s = { version: 3, items: old.items || [] }; saveState(s); return s; } } catch (_) {}
  return { version: 3, items: [] };
}
function saveState(state) { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

function newItem(f) {
  const now = Date.now(), outcome = f.outcome || 'open';
  return {
    id: makeId(), date: f.date || todayStr(), title: (f.title || '').trim(), desc: (f.desc || '').trim(),
    pillar: f.pillar || VIRTUES[0].key, weight: f.weight || 'notable', outcome,
    subtasks: f.subtasks || [], resolvedDate: outcome === 'open' ? null : (f.date || todayStr()),
    createdTs: now, updatedTs: now,
  };
}
function addItem(state, f) { state.items.push(newItem(f)); saveState(state); return state; }
function updateItem(state, id, patch) { const it = state.items.find(x => x.id === id); if (it) { Object.assign(it, patch, { updatedTs: Date.now() }); saveState(state); } return state; }
function setOutcome(state, id, outcome) {
  const it = state.items.find(x => x.id === id);
  if (it) { it.outcome = outcome; it.resolvedDate = outcome === 'open' ? null : todayStr(); it.updatedTs = Date.now(); saveState(state); }
  return state;
}
function removeItem(state, id) { state.items = state.items.filter(x => x.id !== id); saveState(state); return state; }
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
  a.href = url; a.download = `stoic-garden-${todayStr()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
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
        saveState(cur); resolve(cur);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
