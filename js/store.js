// Local-first storage. Your lines never leave the device.
// One JSON blob in localStorage, plus export/import so you can back it up and carry it.

const STORE_KEY = 'stoic-garden-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { version: 1, entries: [] };
    const s = JSON.parse(raw);
    if (!s.entries) s.entries = [];
    return s;
  } catch (_) {
    return { version: 1, entries: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addEntry(state, virtue, note) {
  state.entries.push({
    id: makeId(),
    date: todayStr(),
    virtue,
    note: (note || '').trim(),
    ts: Date.now(),
  });
  saveState(state);
  return state;
}

function removeEntry(state, id) {
  state.entries = state.entries.filter(e => e.id !== id);
  saveState(state);
  return state;
}

function entriesOn(state, dateStr) {
  return state.entries.filter(e => e.date === dateStr);
}

function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stoic-garden-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importState(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed.entries)) throw new Error('Not a garden file');
        // merge by id so re-importing on another device is additive, not destructive
        const cur = loadState();
        const seen = new Set(cur.entries.map(e => e.id));
        for (const e of parsed.entries) if (!seen.has(e.id)) cur.entries.push(e);
        saveState(cur);
        resolve(cur);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
