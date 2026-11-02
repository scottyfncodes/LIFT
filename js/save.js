// LIFT — persistence (v2: the inspector)
const KEY = 'lift.save.v1';
export const SAVE_VERSION = 2;

export function freshState(settings) {
  return {
    v: SAVE_VERSION,
    merits: 30, favours: 0, xp: 0, rank: 0,
    upgrades: {}, uniform: 'inspector',
    cases: {},            // rogue id -> { seen, profiled, identified, arrested, notes[] }
    anon: { seen: 0, identified: 0, arrested: 0 },
    returns: [],          // ledger of returned belongings
    investigations: [],   // completed missions with ratings
    memoirs: { m0: true },
    missionsDone: {},
    stats: { runs: 0, returned: 0, unaware: 0, recovered: 0, escaped: 0, falseLifts: 0, tickets: 0, helped: 0, identified: 0, arrests: 0, witnessed: 0, reprimands: 0, stars: 0, bestStars: 0, lifts: 0, observed: 0, rare: 0 },
    log: [],
    settings: settings || { sound: true, music: true, haptics: true },
    run: null, pending: null,
    tutorial: { done: false, steps: {} },
    // fields read by the shared world generator
    collection: [], sets: {}, milestones: {}, notoriety: 0, outfit: 'tweed', story: {},
    created: Date.now(),
  };
}

function migrate(s) {
  // v1 saves belonged to the old gentleman-thief game; start the inspector fresh, keep settings
  if (!s.v || s.v < 2) return freshState(s.settings);
  const f = freshState();
  for (const k in f) if (s[k] === undefined) s[k] = f[k];
  for (const k in f.stats) if (s.stats[k] === undefined) s.stats[k] = 0;
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
