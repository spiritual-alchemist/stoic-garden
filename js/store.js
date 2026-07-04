// Local-first storage: one list of items in localStorage, with full CRUD,
// subtask ops, and JSON export/import. Migrates the old v1 tap-log if present.

const STORE_KEY = 'stoic-garden-v2';
const STORE_KEY_V1 = 'stoic-garden-v1';

function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const s = JSON.parse(raw); if (!s.items) s.items = []; return s; }
  } catch (_) {}
  return migrateFromV1();
}

function migrateFromV1() {
  const fresh = { version: 2, items: [] };
  try {
    const raw = localStorage.getItem(STORE_KEY_V1);
    if (!raw) return fresh;
    const old = JSON.parse(raw);
    for (const e of (old.entries || [])) {
      fresh.items.push({
        id: e.id || makeId(), date: e.date, pillar: e.virtue,
        title: e.note && e.note.trim() ? e.note.trim() : VIRTUE_BY_KEY[e.virtue].label,
        desc: '', weight: 'notable', outcome: 'met', subtasks: [],
        resolvedDate: e.date, createdTs: e.ts || 0, updatedTs: e.ts || 0,
      });
    }
    if (fresh.items.length) saveState(fresh);
  } catch (_) {}
  return fresh;
}

function saveState(state) { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

function newItem(fields) {
  const now = Date.now();
  const outcome = fields.outcome || 'open';
  return {
    id: makeId(),
    date: fields.date || todayStr(),
    title: (fields.title || '').trim(),
    desc: (fields.desc || '').trim(),
    pillar: fields.pillar || VIRTUES[0].key,
    weight: fields.weight || 'notable',
    outcome,
    subtasks: fields.subtasks || [],
    resolvedDate: outcome === 'open' ? null : (fields.date || todayStr()),
    createdTs: now, updatedTs: now,
  };
}

function addItem(state, fields) { state.items.push(newItem(fields)); saveState(state); return state; }

function updateItem(state, id, patch) {
  const it = state.items.find(x => x.id === id);
  if (!it) return state;
  Object.assign(it, patch, { updatedTs: Date.now() });
  saveState(state);
  return state;
}

function setOutcome(state, id, outcome) {
  const it = state.items.find(x => x.id === id);
  if (!it) return state;
  it.outcome = outcome;
  it.resolvedDate = outcome === 'open' ? null : todayStr();
  it.updatedTs = Date.now();
  saveState(state);
  return state;
}

function removeItem(state, id) { state.items = state.items.filter(x => x.id !== id); saveState(state); return state; }

function toggleSubtask(state, id, subId) {
  const it = state.items.find(x => x.id === id);
  if (!it) return state;
  const st = (it.subtasks || []).find(s => s.id === subId);
  if (st) { st.done = !st.done; it.updatedTs = Date.now(); saveState(state); }
  return state;
}

function itemsOn(state, dateStr) {
  return state.items.filter(i => i.date === dateStr).sort((a, b) => a.createdTs - b.createdTs);
}
function daysWithItems(state) {
  return [...new Set(state.items.map(i => i.date))].sort().reverse();
}

function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `stoic-garden-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function importState(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = parsed.items || [];
        if (!Array.isArray(incoming)) throw new Error('Not a garden file');
        const cur = loadState();
        const seen = new Set(cur.items.map(i => i.id));
        for (const i of incoming) if (!seen.has(i.id)) cur.items.push(i);
        saveState(cur);
        resolve(cur);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
