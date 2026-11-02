// LIFT — persistence
const KEY = 'lift.save.v1';
export const SAVE_VERSION = 1;

export function freshState() {
  return {
    v: SAVE_VERSION,
    wealth: 30, goodwill: 0, intel: 0,
    goodwillTotal: 0,
    upgrades: {},
    outfits: ['tweed'], outfit: 'tweed',
    collection: [],
    causes: { families: 0, union: 0, hartley: 0, orphanage: 0, clarion: 0 },
    milestones: {},
    trainsUnlocked: ['local'],
    notoriety: 0,
    stats: { runs: 0, lifts: 0, clean: 0, critical: 0, caught: 0, fails: 0, given: 0, kept: 0, sold: 0, returned: 0, donated: 0, poorVictims: 0, cashTotal: 0, ejected: 0, leaked: 0, bestHaul: 0, observed: 0, locks: 0 },
    dossiers: {},
    story: {},
    log: [],
    sets: {},
    settings: { sound: true, music: true, haptics: true },
    run: null,
    pending: null,
    tutorial: { done: false, steps: {} },
    created: Date.now(),
  };
}

function migrate(s) {
  const f = freshState();
  for (const k in f) if (s[k] === undefined) s[k] = f[k];
  for (const k in f.stats) if (s.stats[k] === undefined) s.stats[k] = 0;
  for (const k in f.causes) if (s.causes[k] === undefined) s.causes[k] = 0;
  for (const k in f.settings) if (s.settings[k] === undefined) s.settings[k] = f.settings[k];
  s.v = SAVE_VERSION;
  return s;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    return migrate(s);
  } catch (e) {
    console.warn('Save load failed', e);
    return null;
  }
}

let lastWrite = 0;
export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    lastWrite = Date.now();
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}
export function wipe() { try { localStorage.removeItem(KEY); } catch (e) {} }
export function lastSaved() { return lastWrite; }
