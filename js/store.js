// Settings and progress live in localStorage; recordings live in IndexedDB.

// Storage names keep the old 'ahla' prefix so existing progress and recordings survive the rename.
const KEY = 'ahla:v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode etc. */ }
}

const state = Object.assign(
  { show: { arabizi: true, arabic: true, english: true }, progress: {}, srs: {} },
  load()
);

export const settings = {
  get show() { return state.show; },
  toggle(key) {
    state.show[key] = !state.show[key];
    // Never hide every script at once.
    if (!state.show.arabizi && !state.show.arabic) state.show[key === 'arabizi' ? 'arabic' : 'arabizi'] = true;
    save(state);
  },
};

export const progress = {
  get(lessonId) { return state.progress[lessonId] || null; },
  complete(lessonId, score, total) {
    const prev = state.progress[lessonId];
    const best = prev ? Math.max(prev.best, score) : score;
    state.progress[lessonId] = { done: true, best, total, at: Date.now() };
    save(state);
  },
};

// ---- Review: spaced repetition (Leitner boxes) ----
// Each card is { box, due }. Box 0 = new. A right answer moves it up a box and
// pushes the next review further away; a miss sends it back to box 1.
const DAY = 864e5;
const GAPS = [0, 1, 3, 7, 16, 35, 90]; // days to wait after reaching each box
export const srs = {
  card(id) { return state.srs[id] || null; },
  all() { return state.srs; },
  grade(id, knew) {
    const c = state.srs[id] || { box: 0, due: 0 };
    c.box = knew ? Math.min(c.box + 1, GAPS.length - 1) : 1;
    c.due = Date.now() + (knew ? GAPS[c.box] * DAY : 0);
    c.seen = Date.now();
    state.srs[id] = c;
    save(state);
  },
};

// ---- IndexedDB: recordings made in the studio ----
const DB = 'ahla-audio';
const STORE = 'clips';

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export const clips = {
  async get(id) { try { return await tx('readonly', s => s.get(id)); } catch { return undefined; } },
  async put(id, blob) { return tx('readwrite', s => s.put(blob, id)); },
  async remove(id) { return tx('readwrite', s => s.delete(id)); },
  async keys() { try { return await tx('readonly', s => s.getAllKeys()); } catch { return []; } },
};
