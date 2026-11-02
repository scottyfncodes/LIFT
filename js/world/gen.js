// LIFT — procedural train generation
import { RNG, uid } from '../util.js';
import { TRAINS, CARRIAGE_TYPES, ARCHETYPES, NAMES, UNIQUES, CONSORTIUM_DOCS, HARTLEY_LOCKET, CATEGORIES, OUTFITS } from '../data/content.js';
import { rollRarity, makeItem, makeUnique, makeSignet, makeConsortiumDoc } from '../economy.js';

export const T = 32;          // tile size (world px)
export const ROWS = 6;        // interior depth in tiles
export const FLOOR_H = T * ROWS; // 192
export const WALL_H = 92;     // back wall height drawn above y=0
export const GW = 2;          // gangway length in tiles
export const CELL = 16;

const SKIN = ['#f2d3b3', '#e8c09a', '#d6a77a', '#b07d55', '#8a5a3a', '#5e3b25'];
const HAIR = ['#2a1c14', '#4a3020', '#7a5230', '#b08850', '#d8c8a0', '#8a8a8a', '#dcdcdc', '#8a3a1a'];
const COATS = {
  upper: ['#1b1b24', '#2a2440', '#3b1a24', '#1f3a30', '#3a2a1a', '#4a3a5a', '#5a1f2b', '#26324a'],
  upperF: ['#6e1f2b', '#1f5e4a', '#2e3550', '#7b3f8f', '#b8861b', '#d9c8a0', '#8e3140', '#3a5a6e', '#c27a8a'],
  middle: ['#5a4a3a', '#4a4a52', '#6b5a44', '#3d4a3a', '#5a3f2e', '#454a5e'],
  middleF: ['#5a6e5a', '#7a5a4a', '#4a5a7a', '#8a6a4a', '#6a4a5a'],
  working: ['#6b5a44', '#5b4a3a', '#4a5240', '#7a6a52', '#3f4a52', '#5e4636'],
  workingF: ['#7a5a4a', '#5a6a5a', '#8a7a5a', '#6a5a6a', '#4f5f6f'],
};

export function makeLook(rng, arch, female, child = false) {
  const A = ARCHETYPES[arch];
  const cls = A.cls;
  const look = {
    skin: rng.pick(SKIN), hair: rng.pick(HAIR), female: !!female, child,
    build: child ? 0.7 : rng.range(0.88, 1.22), tall: child ? 0.62 : rng.range(0.94, 1.08),
    hairStyle: 'short', hat: null, coat: '#555', trim: '#333', legs: '#2a2a2a', dress: false,
    beard: null, glasses: null, jewel: null, accent: '#c9a24a', scarf: null, prop: null,
  };
  const old = rng.chance(0.3);
  if (old && !child) look.hair = rng.pick(['#8a8a8a', '#dcdcdc', '#b0b0b0']);
  if (female) {
    look.hairStyle = rng.pick(['bob', 'bun', 'waves', 'bob']);
    look.dress = true;
  } else look.hairStyle = rng.pick(['short', 'parted', 'short', old ? 'bald' : 'parted']);
  if (cls === 'upper') {
    look.coat = rng.pick(female ? COATS.upperF : COATS.upper);
    look.trim = female ? rng.pick(['#f4e9d3', '#1a1512', '#c9a24a', '#e8d8b4']) : rng.pick(['#e8dccb', '#6e1f2b', '#c9a24a', '#2f2f3a']);
    look.legs = female ? look.coat : rng.pick(['#1a1a1f', '#2a2a30', '#3a3530']);
    look.hat = female ? rng.pick(['cloche', 'feather', null, 'cloche']) : rng.pick(['top', 'top', 'homburg', null, 'bowler']);
    if (!female && rng.chance(0.5)) look.beard = rng.pick(['mustache', 'mustache', 'mutton', 'full', 'goatee']);
    if (rng.chance(0.25)) look.glasses = female ? 'spectacles' : rng.pick(['monocle', 'spectacles', 'monocle']);
    if (female && rng.chance(0.6)) look.jewel = 'pearls';
    if (female && rng.chance(0.35)) look.scarf = rng.pick(['#f4e9d3', '#c27a8a', '#e8cf86']); // fur stole
    if (arch === 'royal') { look.hat = female ? 'tiara' : 'top'; look.trim = '#c9a24a'; look.sash = '#2f5c8f'; }
  } else if (cls === 'middle') {
    look.coat = rng.pick(female ? COATS.middleF : COATS.middle);
    look.trim = rng.pick(['#e8dccb', '#3a2e22', '#6e1f2b']);
    look.legs = female ? look.coat : rng.pick(['#3a3530', '#2a2a30', '#4a3f35']);
    look.hat = female ? rng.pick(['cloche', null]) : rng.pick(['bowler', 'fedora', 'flatcap', null]);
    if (!female && rng.chance(0.4)) look.beard = rng.pick(['mustache', 'goatee', 'full']);
    if (rng.chance(0.3)) look.glasses = 'spectacles';
    if (arch === 'magician') { look.coat = '#2a1a3a'; look.trim = '#b8861b'; look.hat = 'top'; look.cape = '#6e1f2b'; look.beard = female ? null : 'goatee'; }
    if (arch === 'journalist') { look.hat = female ? 'beret' : 'fedora'; look.trim = '#d9c8a0'; }
  } else if (cls === 'working') {
    look.coat = rng.pick(female ? COATS.workingF : COATS.working);
    look.trim = rng.pick(['#d9c8a0', '#8a7a62', '#4a3f35']);
    look.legs = female ? look.coat : rng.pick(['#4a3f35', '#3a3530', '#5a4a3a']);
    look.hat = female ? rng.pick(['headscarf', null, 'cloche']) : rng.pick(['flatcap', 'flatcap', null]);
    if (!female && rng.chance(0.45)) look.beard = rng.pick(['mustache', 'stubble', 'full']);
    look.patch = rng.chance(0.5);
  } else {
    // staff
    if (arch === 'conductor') { look.coat = '#4a121b'; look.trim = '#e0bf6e'; look.legs = '#1a1a1f'; look.hat = 'peaked'; look.beard = rng.pick(['mustache', 'mutton', null]); }
    if (arch === 'porter') { look.coat = '#3a3f5c'; look.trim = '#c9a24a'; look.legs = '#1e2233'; look.hat = 'pillbox'; }
    if (arch === 'detective') { look.coat = '#a08560'; look.trim = '#5a4a3a'; look.legs = '#3a3530'; look.hat = 'fedora'; look.trench = true; }
    if (arch === 'guard') { look.coat = '#1e2a44'; look.trim = '#c9a24a'; look.legs = '#14182a'; look.hat = 'peaked'; look.beard = rng.pick(['mustache', null]); look.build = rng.range(1.1, 1.3); }
  }
  if (child) { look.hat = rng.chance(0.4) ? (female ? null : 'flatcap') : null; look.beard = null; look.glasses = null; }
  return look;
}

export function playerLook(outfitId) {
  const o = OUTFITS[outfitId] || OUTFITS.tweed;
  return {
    skin: '#e8c09a', hair: '#2a1c14', female: false, build: 1, tall: 1.04, hairStyle: 'parted', hat: o.hat,
    coat: o.coat, trim: o.trim, legs: outfitId === 'evening' ? '#111116' : outfitId === 'porter' ? '#1e2233' : '#3a3026', dress: false,
    beard: 'pencil', glasses: null, jewel: null, accent: '#c9a24a', scarf: outfitId === 'tweed' ? '#6e1f2b' : outfitId === 'evening' ? '#f4e9d3' : null,
    player: true, carnation: outfitId === 'evening' || outfitId === 'tweed',
  };
}

function personName(rng, arch, female) {
  const A = ARCHETYPES[arch];
  if (A.cls === 'working' || A.staff === 'porter') {
    return `${rng.pick(female ? NAMES.FIRST_WF : NAMES.FIRST_WM)} ${rng.pick(NAMES.LAST_W)}`;
  }
  const pre = rng.pick(A.titlePrefix || ['']);
  let p = pre;
  if (['Lady', 'Miss', 'Mrs.', 'Duchess', 'Countess', 'Mme.', 'Madame'].includes(pre)) female = true;
  if (['Lord', 'Sir', 'Mr.', 'Master', 'Prince', 'Grand Duke', 'Count', 'Signor', 'His Excellency'].includes(pre)) female = false;
  const first = rng.pick(female ? NAMES.FIRST_F : NAMES.FIRST_M);
  const last = rng.pick(NAMES.LAST_U);
  const name = pre.startsWith('The Great') ? `The Great ${last}ini` : `${p ? p + ' ' : ''}${first} ${last}`;
  return { name: name.trim(), female, last };
}

// ------- carriage layouts ------------------------------------------------
// Returns props & seats in carriage-local px coordinates.
function layoutCarriage(type, len, rng, trainId) {
  const props = [], seats = [], spots = [];
  const P = (kind, tx, ty, tw, th, extra = {}) => {
    const p = { id: uid(), kind, x: tx * T, y: ty * T, w: tw * T, h: th * T, ...extra };
    if (p.solid === undefined) p.solid = [[p.x, p.y, p.w, p.h]];
    props.push(p); return p;
  };
  const S = (x, y, dir, kind, extra = {}) => { const s = { id: uid(), x, y, dir, kind, occ: null, ...extra }; seats.push(s); return s; };

  if (type === 'coach3' || type === 'coach2') {
    P('lav', 0, 0, 2, 2, { door: 'r' });
    P('rack', 0, 4, 2, 2, { solid: [[0, 4 * T + 8, 2 * T, 2 * T - 8]] });
    const bay = type === 'coach2' ? 4 : 3;
    let group = 0;
    for (let tx = 2; tx + bay - 1 < len; tx += bay) {
      for (const side of ['top', 'bot']) {
        const g = 'g' + (group++);
        const rows = side === 'top' ? [0, 1] : [5, 4];
        const y0 = side === 'top' ? 0 : 4;
        P('bench', tx, y0, 1, 2, { dir: 'r', side });
        P('bench', tx + bay - 1, y0, 1, 2, { dir: 'l', side });
        const tblRow = side === 'top' ? 0 : 5;
        if (type === 'coach2' || rng.chance(0.6)) P('wtable', tx + 1, tblRow, bay - 2, 1, { side, solid: [[(tx + 1) * T + 4, tblRow * T + (side === 'top' ? 0 : 8), (bay - 2) * T - 8, T - 8]] });
        for (const r of rows) {
          S((tx + 0.62) * T, (r + 0.5) * T, 'r', 'bench', { group: g, aisle: r === 1 || r === 4 });
          S((tx + bay - 1 + 0.38) * T, (r + 0.5) * T, 'l', 'bench', { group: g, aisle: r === 1 || r === 4 });
        }
      }
    }
  } else if (type === 'dining') {
    P('bar', 0, 0, 4, 1.6, { solid: [[0, 0, 4 * T, 1.6 * T]] });
    for (let i = 0; i < 3; i++) S((0.6 + i * 1.2) * T, 2.1 * T, 'u', 'stool', { group: 'bar', bar: true });
    spots.push({ kind: 'bartender', x: 2 * T, y: 0.6 * T });
    let g = 0;
    for (let tx = 5; tx + 2 < len; tx += 4) {
      for (const side of ['top', 'bot']) {
        const grp = 'd' + (g++);
        const y0 = side === 'top' ? 0 : 4;
        P('dtable', tx + 1, y0, 1, 2, { side, solid: [[(tx + 1) * T + 2, y0 * T + 4, T - 4, 2 * T - 8]] });
        P('chair', tx, y0, 1, 2, { dir: 'r', side });
        P('chair', tx + 2, y0, 1, 2, { dir: 'l', side });
        const rows = side === 'top' ? [0, 1] : [5, 4];
        for (const r of rows) {
          S((tx + 0.6) * T, (r + 0.5) * T, 'r', 'dining', { group: grp, aisle: r === 1 || r === 4 });
          S((tx + 2.4) * T, (r + 0.5) * T, 'l', 'dining', { group: grp, aisle: r === 1 || r === 4 });
        }
      }
    }
  } else if (type === 'lounge' || type === 'salon') {
    const lux = type === 'salon';
    const groups = lux ? [2, 7, 15] : [2, 7, 15];
    let g = 0;
    for (const tx of groups) {
      const grp = 'l' + (g++);
      P('armchair', tx, 0, 1, 1.5, { dir: 'r', solid: [[tx * T + 2, 2, T - 4, 1.3 * T]] });
      P('ltable', tx + 1, 0.2, 1, 1, { solid: [[(tx + 1) * T + 6, 0.2 * T + 4, T - 12, T - 8]] });
      P('armchair', tx + 2, 0, 1, 1.5, { dir: 'l', solid: [[(tx + 2) * T + 2, 2, T - 4, 1.3 * T]] });
      S((tx + 0.55) * T, 0.85 * T, 'r', 'armchair', { group: grp, open: true });
      S((tx + 2.45) * T, 0.85 * T, 'l', 'armchair', { group: grp, open: true });
    }
    // card table in the middle
    const cx = 11;
    P('cardtable', cx, 2.3, 2, 1.4, { solid: [[cx * T + 4, 2.3 * T + 4, 2 * T - 8, 1.4 * T - 8]] });
    S((cx - 0.4) * T, 3.0 * T, 'r', 'cardchair', { group: 'cards', open: true, cards: true });
    S((cx + 2.4) * T, 3.0 * T, 'l', 'cardchair', { group: 'cards', open: true, cards: true });
    S((cx + 1) * T, 1.75 * T, 'd', 'cardchair', { group: 'cards', open: true, cards: true });
    for (const s of seats.slice(-3)) P('chairsm', s.x / T - 0.4, s.y / T - 0.4, 0.8, 0.8, { dir: s.dir, solid: [[s.x - 9, s.y - 9, 18, 18]], seatRef: s.id });
    // sofa along front
    P('sofa', 15, 5, 3, 1, { dir: 'u', solid: [[15 * T, 5.3 * T, 3 * T, 0.7 * T]] });
    for (let i = 0; i < 3; i++) S((15.5 + i) * T, 5.35 * T, 'u', 'sofa', { group: 'sofa' });
    if (!lux) P('piano', len - 3, 0, 2, 1.4, { solid: [[(len - 3) * T, 0, 2 * T, 1.4 * T]] });
    else P('plant', len - 2, 0, 1, 1, {});
    P('plant', 5, 0, 1, 1, {});
    P('barcart', 1, 4.6, 1.2, 1, { solid: [[T, 4.6 * T, 1.2 * T, T - 4]] });
    spots.push({ kind: 'stand', x: 3.5 * T, y: 3.2 * T }, { kind: 'stand', x: 4.3 * T, y: 3.4 * T }, { kind: 'stand', x: 8 * T, y: 3.1 * T }, { kind: 'stand', x: 19 * T, y: 3.2 * T }, { kind: 'stand', x: 19.8 * T, y: 2.8 * T });
    if (lux) spots.push({ kind: 'guard', x: (len - 1) * T, y: 3 * T }, { kind: 'guard', x: 1 * T, y: 2.4 * T });
  } else if (type === 'compartment' || type === 'sleeper') {
    const sleeper = type === 'sleeper';
    const cw = 4;
    let ci = 0;
    for (let tx = 0; tx + cw <= len; tx += cw) {
      const comp = 'c' + (ci++);
      // partition at left edge of compartment (except first which is the end wall)
      if (tx > 0) P('partition', tx - 0.25, 0, 0.5, 3.75, { solid: [[tx * T - 4, 0, 8, 3.75 * T]] });
      // front glass wall with door gap
      P('cwall', tx, 3.5, 1.25, 0.5, { solid: [[tx * T, 3.62 * T, 1.25 * T, 0.38 * T]], comp });
      P('cwall', tx + 2.75, 3.5, 1.25, 0.5, { solid: [[(tx + 2.75) * T, 3.62 * T, 1.25 * T, 0.38 * T]], comp });
      P('cdoor', tx + 1.25, 3.5, 1.5, 0.5, { comp, solid: [], doorRect: [(tx + 1.25) * T, 3.62 * T, 1.5 * T, 0.38 * T] });
      if (sleeper) {
        P('berth', tx + 0.25, 0.1, 3.5, 1.4, { comp, solid: [[(tx + 0.25) * T, 0.1 * T, 3.5 * T, 1.4 * T]] });
        S((tx + 1.5) * T, 0.75 * T, 'd', 'berth', { group: comp, comp, lie: true });
        S((tx + 3.2) * T, 2.4 * T, 'l', 'cseat', { group: comp, comp });
        P('chairsm', tx + 2.9, 2.0, 0.8, 0.8, { dir: 'l', solid: [[(tx + 3.2) * T - 9, 2.4 * T - 9, 18, 18]] });
      } else {
        P('bench', tx + 0.15, 0, 0.85, 2.4, { dir: 'r', comp, solid: [[(tx + 0.15) * T, 0, 0.85 * T, 2.4 * T]] });
        P('bench', tx + 3, 0, 0.85, 2.4, { dir: 'l', comp, solid: [[(tx + 3) * T, 0, 0.85 * T, 2.4 * T]] });
        P('wtable', tx + 1.5, 0, 1, 0.7, { comp, solid: [[(tx + 1.5) * T, 0, T, 0.6 * T]] });
        S((tx + 0.75) * T, 0.8 * T, 'r', 'cseat', { group: comp, comp });
        S((tx + 0.75) * T, 1.8 * T, 'r', 'cseat', { group: comp, comp });
        S((tx + 3.25) * T, 0.8 * T, 'l', 'cseat', { group: comp, comp });
        S((tx + 3.25) * T, 1.8 * T, 'l', 'cseat', { group: comp, comp });
      }
      P('luggage', tx + 1.55, 2.35, 0.9, 0.6, { comp, solid: [[(tx + 1.6) * T, 2.45 * T, 0.8 * T, 0.45 * T]], lock: true, pins: sleeper ? 4 : 3, contents: null });
    }
    P('lamp', 0, 4.1, 0.1, 0.1, { solid: [] });
  } else if (type === 'baggage' || type === 'vault') {
    if (type === 'baggage') {
      const spotsX = rng.shuffle([2, 4.5, 7, 9.5, 12, 14.5]);
      P('crate', 1, 0, 1.4, 1.2, {});
      P('sacks', 0.3, 4.6, 2, 1.2, { solid: [[0.3 * T, 4.8 * T, 2 * T, T]] });
      for (let i = 0; i < 5; i++) {
        const tx = spotsX[i];
        const top = i % 2 === 0;
        if (rng.chance(0.5)) P('crate', tx, top ? 0 : 4.6, 1.4, 1.3, {});
        else P('trunk', tx, top ? 0.1 : 4.7, 1.6, 1, { lock: true, pins: 4, contents: null });
      }
      P('trunk', 16, 0.2, 1.4, 0.9, { lock: true, pins: 4, contents: null });
      P('strongbox', 16.2, 4.6, 1.2, 1.1, { lock: true, pins: 5, contents: null, strong: true });
      spots.push({ kind: 'porter', x: 8 * T, y: 3 * T });
    } else {
      P('vaultdoor', 6, 0, 4, 1.6, { lock: true, pins: 6, contents: null, strong: true, vault: true });
      P('crate', 1, 4.6, 1.4, 1.3, {});
      P('crate', 13, 0, 1.4, 1.3, {});
      spots.push({ kind: 'guard', x: 4 * T, y: 2.8 * T }, { kind: 'guard', x: 12 * T, y: 2.8 * T });
    }
  }
  return { props, seats, spots };
}

// ------- train generation -------------------------------------------------
export function generateRun(trainId, S, seed = (Math.random() * 1e9) | 0) {
  const rng = new RNG(seed);
  const tr = TRAINS[trainId];
  const run = {
    trainId, seed, carriages: [], pax: [], doors: [], items: {},
    worldW: 0, t: 0, leg: 0, legT: 0, phase: 'moving', stationT: 0,
    heat: 0, heatPeak: 0, desc: null, alibiT: 0, events: [], nextEventT: 25 + rng.range(0, 15),
    nextJolt: 14 + rng.range(0, 10), joltT: 0, tunnelT: 0, tunnelDone: {},
    haul: [], cash: 0, stash: [], log: [], toasts: [],
    player: null, playerSeat: null, caughtCount: 0, phantomUsed: false, incidentUsed: false,
    coins: S.upgrades.distract_purse ? 4 : S.upgrades.distract_coin ? 2 : 0,
    dossierGain: 0, observedCount: 0, stats: { lifts: 0, clean: 0, critical: 0, fails: 0, locks: 0, observed: 0, poor: 0 },
    date: `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][rng.int(0, 6)]}, ${rng.int(1, 28)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][rng.int(0, 11)]} 1931`,
    informantUses: 0, familyHelped: false,
  };
  // carriage order (shuffle middle slightly for variety but keep baggage/vault at end)
  let order = tr.carriages.slice();
  const tail = order.filter(t => t === 'baggage' || t === 'vault');
  let body = order.filter(t => t !== 'baggage' && t !== 'vault');
  if (rng.chance(0.6)) { const i = rng.int(0, body.length - 2); [body[i], body[i + 1]] = [body[i + 1], body[i]]; }
  order = body.concat(tail);

  let x = 0;
  order.forEach((type, idx) => {
    const C = CARRIAGE_TYPES[type];
    const len = C.len;
    const lay = layoutCarriage(type, len, rng, trainId);
    const car = { idx, type, name: C.name, x0: x, len, w: len * T, restricted: !!C.restricted, palette: C.palette, alert: 0, props: [], seats: [], spots: [] };
    for (const p of lay.props) { p.x += x; p.solid = p.solid.map(r => [r[0] + x, r[1], r[2], r[3]]); if (p.doorRect) p.doorRect[0] += x; p.car = idx; car.props.push(p); }
    for (const s of lay.seats) { s.x += x; s.car = idx; car.seats.push(s); }
    for (const sp of lay.spots) { sp.x += x; sp.car = idx; car.spots.push(sp); }
    car.cls = type === 'coach3' ? 'third' : type === 'coach2' ? 'second' : type === 'baggage' ? 'baggage' : type === 'vault' ? 'vault' : type === 'sleeper' ? 'sleeper' : (type === 'compartment' || type === 'salon') ? 'first' : 'common';
    run.carriages.push(car);
    x += len * T;
    if (idx < order.length - 1) {
      const next = order[idx + 1];
      const restricted = !!CARRIAGE_TYPES[next].restricted;
      run.doors.push({ id: 'g' + idx, x0: x, x1: x + GW * T, between: [idx, idx + 1], locked: restricted, restrictedTo: restricted ? CARRIAGE_TYPES[next].name : null, pins: next === 'vault' ? 5 : 3, open: 0 });
      x += GW * T;
    }
  });
  run.worldW = x;

  // hidden caches
  const caches = S.upgrades.intel_compart || S.sets.expedition;
  if (caches) for (const car of run.carriages) {
    if (rng.chance(0.75)) {
      const cx = car.x0 + rng.range(3, car.len - 3) * T;
      const top = rng.chance(0.5);
      car.props.push({ id: uid(), kind: 'cache', x: cx, y: top ? 2 : 5.6 * T, w: 20, h: 12, solid: [], car: car.idx, contents: null, hidden: true });
    }
  }

  // passengers
  const nPax = rng.int(tr.pax[0], tr.pax[1]);
  const mix = Object.entries(tr.mix).map(([a, w]) => ({ a, w }));
  const allSeats = run.carriages.flatMap(c => c.seats);
  const seatOK = (s, cls) => {
    const car = run.carriages[s.car];
    if (s.occ) return false;
    if (car.type === 'baggage' || car.type === 'vault') return false;
    if (s.bar || s.cards) return true;
    if (cls === 'working' && (car.cls === 'first' || car.cls === 'sleeper' || car.cls === 'second')) return false;
    if (cls === 'upper' && car.cls === 'third' && trainId !== 'local') return false;
    return true;
  };
  // player seat: in appropriate class carriage near the front
  const pcls = tr.playerClass;
  const pref = run.carriages.filter(c => (pcls === 'third' && c.cls === 'third') || (pcls === 'second' && c.cls === 'second') || (pcls === 'sleeper' && c.cls === 'sleeper') || (pcls === 'first' && c.cls === 'first'));
  const pcar = pref[0] || run.carriages[0];
  const pseat = pcar.seats.find(s => s.aisle || s.kind === 'cseat') || pcar.seats[0];
  pseat.occ = 'player';
  run.playerSeat = pseat.id;
  if (pseat.comp) run.playerComp = pcar.idx + ':' + pseat.comp;

  const used = new Set();
  const makePax = (arch, opts = {}) => {
    const A = ARCHETYPES[arch];
    let female = A.female ? true : rng.chance(0.42);
    let nm;
    if (A.cls === 'working' || A.staff) { nm = { name: personName(rng, arch, female), female }; }
    else { nm = personName(rng, arch, female); female = nm.female; }
    let name = typeof nm.name === 'string' ? nm.name : nm.name.name;
    if (used.has(name)) name += ' Jr.';
    used.add(name);
    const p = {
      id: uid(), arch, name, female, cls: A.cls, look: makeLook(rng, arch, female, opts.child),
      x: 0, y: 0, dir: 'd', seat: null, home: null, car: 0,
      act: 'idle', actT: rng.range(3, 12), attn: 0.4, susp: 0, glanceT: rng.range(3, 10), glancing: 0, stirWarn: 0,
      aware: A.aware * rng.range(0.85, 1.15), ethics: rng.chance(A.ethics) ? 'decent' : (A.cls === 'upper' ? rng.pick(['ruthless', 'callous', 'vain', 'greedy']) : rng.pick(['honest', 'proud', 'weary'])),
      cash: rng.int(A.cash[0], A.cash[1]), items: [], robbed: [], discoverT: null, observed: false,
      bio: rng.pick(A.bio), secret: null, rel: null, state: 'seated', path: null, walkTarget: null,
      lastSawPlayer: -99, sawOutfit: null, mood: 0, bubble: null, bubbleT: 0, distractT: 0, distractX: 0, distractY: 0,
      child: !!opts.child, staff: A.staff || null, walkPhase: 0, speed: A.staff ? 46 : rng.range(34, 44),
      ally: !!A.ally && rng.chance(0.5), charmed: false, informant: false, left: false,
      stopT: 0,
    };
    if (p.child) { p.cash = 0; p.speed = 40; p.aware = 0.3; }
    return p;
  };
  const ctxFor = p => ({ owner: p.name, ownerCls: p.cls, ownerEthics: p.ethics === 'decent' || p.ethics === 'honest' ? 0.8 : 0.15, train: tr.name, date: run.date, socialite: ARCHETYPES[p.arch].socialite, poor: ARCHETYPES[p.arch].poor });
  const giveItems = p => {
    const A = ARCHETYPES[p.arch];
    if (p.child || p.staff === 'guard') return;
    const n = A.cls === 'upper' ? rng.int(1, 3) : A.staff ? (rng.chance(0.3) ? 1 : 0) : rng.int(0, 2);
    const cats = A.items.filter(([c, w]) => w > 0).map(([c, w]) => ({ c, w }));
    const have = new Set();
    for (let i = 0; i < n; i++) {
      const c = rng.weighted(cats).c;
      if (have.has(c) || CATEGORIES[c].tech === 'lock') continue;
      have.add(c);
      const rar = rollRarity(rng, A.rarityBias, tr.rarityShift);
      p.items.push(makeItem(rng, c, rar, ctxFor(p)));
    }
    if (A.crestChance && rng.chance(A.crestChance * (trainId === 'local' ? 0.3 : 1))) {
      const crest = p.name.match(/(Crane|Mortlake|Vane|Ashgrove)/);
      const ck = crest ? crest[1].toLowerCase() : rng.pick(['crane', 'mortlake', 'vane', 'ashgrove']);
      if (!S.collection.some(it => it.crest === ck) && !p.items.some(it => it.cat === 'ring')) p.items.push(makeSignet(rng, ck, ctxFor(p)));
    }
    if (A.docChance && trainId !== 'local' && rng.chance(A.docChance * 0.5)) {
      const missing = CONSORTIUM_DOCS.filter(d => !S.collection.some(it => it.consortium === d.key) && !run.pax.some(q => q.items.some(it => it.consortium === d.key)));
      if (missing.length) { p.items = p.items.filter(it => it.cat !== 'document'); p.items.push(makeConsortiumDoc(rng.pick(missing).key, ctxFor(p))); }
    }
    // secrets & hidden documents
    if (rng.chance(0.35)) p.secret = rng.pick(['Owes a fortune to a card sharp in Kingsgate.', 'Is travelling under a false name.', 'Is secretly funding the strike.', 'Has a second family in Coldharbour.', 'Is carrying a bribe for a magistrate.', 'Is the anonymous author of the Clarion’s best columns.', 'Forged the deed to his own estate.', 'Is being blackmailed by a business partner.', 'Pawned the family silver last week.']);
  };

  const pickArch = () => rng.weighted(mix).a;
  let attempts = 0;
  while (run.pax.length < nPax && attempts++ < 200) {
    const arch = pickArch();
    const A = ARCHETYPES[arch];
    const cands = allSeats.filter(s => seatOK(s, A.cls) && !s.bar && !(s.cards && arch !== 'magician' && arch !== 'bankheir' && rng.chance(0.6)));
    if (!cands.length) break;
    // prefer seats in groups that already have people (social), sometimes
    const seat = rng.pick(cands);
    const p = makePax(arch);
    giveItems(p);
    seatPax(p, seat, run);
    run.pax.push(p);
    if (A.family) {
      // add a child next to them
      const sib = allSeats.find(s => !s.occ && s.group === seat.group && s.car === seat.car);
      if (sib) { const c = makePax('family', { child: true }); c.name = `${c.name.split(' ')[0]} (child)`; c.family = p.id; p.familyChild = c.id; seatPax(c, sib, run); run.pax.push(c); }
    } else if (rng.chance(0.4)) {
      // companion
      const sib = allSeats.find(s => !s.occ && s.group === seat.group && s.car === seat.car && seatOK(s, A.cls));
      if (sib && run.pax.length < nPax) {
        const arch2 = A.cls === 'upper' ? rng.pick(['aristocrat', 'socialite', 'magnate', 'bankheir', 'politician'].filter(a => tr.mix[a])) || arch : arch;
        const q = makePax(arch2 || arch); giveItems(q); seatPax(q, sib, run); run.pax.push(q);
        const relType = rng.pick(['spouses', 'business partners', 'rivals', 'old friends', 'creditor & debtor', 'siblings']);
        p.rel = { id: q.id, type: relType }; q.rel = { id: p.id, type: relType };
      }
    }
  }
  // special uniques: rare chance on higher trains
  const uniq = UNIQUES.filter(u => u.trains.includes(trainId) && !S.collection.some(it => it.uid === u.id));
  const upper = run.pax.filter(p => p.cls === 'upper' && !p.child);
  const uniqChance = 0.18 + (S.milestones.vip_tip ? 0.15 : 0) + (trainId === 'royal' ? 0.5 : 0);
  if (uniq.length && upper.length && rng.chance(uniqChance)) {
    const u = rng.pick(uniq);
    const p = rng.pick(upper);
    const it = makeUnique(u, ctxFor(p)); it.owner = p.name;
    if (CATEGORIES[u.cat].tech === 'lock') run.pendingLuggageUnique = it; else p.items.push(it);
    p.vip = true;
  }
  if (trainId === 'royal' && !S.collection.some(it => it.uid === 'meridian_charter')) {
    run.pendingVaultUnique = makeUnique(UNIQUES.find(u => u.id === 'meridian_charter'), { train: tr.name, date: run.date });
  }
  // Hartley locket: once the debt is cleared, Mortlake rides the Regional
  if (S.milestones.hartley_done && !S.story.locketFound && (trainId === 'regional' || trainId === 'night')) {
    const p = makePax('magnate'); p.name = 'Mr. Silas Mortlake'; p.vip = true; p.ethics = 'ruthless';
    giveItems(p);
    const it = { ...HARTLEY_LOCKET, id: uid(), tech: 'dip', noun: 'Locket', history: 'Seized for a debt that was already paid.', train: tr.name, date: run.date, ownerCls: 'upper', ownerEthics: 0 };
    p.items.push(it);
    const seat = allSeats.find(s => seatOK(s, 'upper'));
    if (seat) { seatPax(p, seat, run); run.pax.push(p); }
  }

  // staff
  const carsWalk = run.carriages.filter(c => c.type !== 'vault');
  for (let i = 0; i < tr.conductors; i++) {
    const c = makePax('conductor');
    const car = carsWalk[Math.floor((i + 0.5) * carsWalk.length / tr.conductors)] || carsWalk[0];
    c.x = car.x0 + car.w / 2; c.y = 2.5 * T; c.car = car.idx; c.state = 'patrol'; c.act = 'patrol';
    c.patrolDir = i % 2 ? -1 : 1;
    run.pax.push(c);
  }
  for (const car of run.carriages) for (const sp of car.spots) {
    if (sp.kind === 'porter' && rng.chance(0.7)) { const p = makePax('porter'); p.x = sp.x; p.y = sp.y; p.car = car.idx; p.state = 'stand'; p.act = 'idle'; p.post = { x: sp.x, y: sp.y }; giveItems(p); run.pax.push(p); }
    if (sp.kind === 'guard') { const p = makePax('guard'); p.x = sp.x; p.y = sp.y; p.car = car.idx; p.state = 'stand'; p.act = 'patrol'; p.post = { x: sp.x, y: sp.y }; p.dir = 'd'; run.pax.push(p); }
    if (sp.kind === 'bartender') { const p = makePax('porter'); p.name = p.name.split(' ')[0] + ' the Steward'; p.look.coat = '#f4e9d3'; p.look.trim = '#1a1512'; p.look.hat = null; p.x = sp.x; p.y = sp.y; p.car = car.idx; p.state = 'stand'; p.act = 'idle'; p.post = { x: sp.x, y: sp.y }; p.dir = 'd'; p.bartender = true; p.items = []; run.pax.push(p); }
    if (sp.kind === 'stand' && rng.chance(0.35) && run.pax.length < nPax + 6) {
      const arch = pickArch(); const A = ARCHETYPES[arch];
      if (A.cls !== 'working') { const p = makePax(arch); giveItems(p); p.x = sp.x; p.y = sp.y; p.car = car.idx; p.state = 'stand'; p.act = rng.pick(['talk', 'drink']); p.post = { x: sp.x, y: sp.y }; p.dir = rng.pick(['l', 'r', 'd', 'u']); run.pax.push(p); }
    }
  }
  if (rng.chance(tr.detective) || S.notoriety >= 6) addDetective(run, rng, S);

  // informant
  if (S.upgrades.net_informant) {
    const cands = run.pax.filter(p => (p.cls === 'working' || p.staff === 'porter') && !p.child && !p.bartender);
    if (cands.length) { const p = rng.pick(cands); p.informant = true; p.items = []; }
  }
  // magician pairing for events
  // luggage contents
  for (const car of run.carriages) for (const pr of car.props) {
    if (!pr.lock && pr.kind !== 'cache') continue;
    const contents = [];
    let cashIn = 0;
    if (pr.kind === 'cache') { cashIn = rng.int(10, 40) * (1 + TRAINS[trainId].tier * 0.5); if (rng.chance(0.6)) contents.push(makeItem(rng, rng.pick(['coin', 'letter', 'compass', 'lighter']), rollRarity(rng, 1.5, tr.rarityShift + 0.5), { owner: 'A forgotten hiding place', train: tr.name, date: run.date })); }
    else if (pr.vault) {
      cashIn = rng.int(400, 900);
      contents.push(makeItem(rng, 'antique', rollRarity(rng, 3, tr.rarityShift + 1), { owner: 'The Royal Household', train: tr.name, date: run.date }));
      contents.push(makeItem(rng, 'art', rollRarity(rng, 3, tr.rarityShift + 1), { owner: 'The Royal Household', train: tr.name, date: run.date }));
      if (run.pendingVaultUnique) contents.push(run.pendingVaultUnique);
    } else {
      // assign owner: compartment occupants or random upper
      let owner = null;
      if (pr.comp) owner = run.pax.find(p => p.home && p.home.car === car.idx && p.home.comp === pr.comp && !p.child);
      const ownName = owner ? owner.name : 'Unclaimed luggage';
      pr.owner = owner ? owner.id : null;
      const ctx = owner ? ctxFor(owner) : { owner: ownName, train: tr.name, date: run.date };
      cashIn = rng.int(5, 30) * (1 + tr.tier * 0.6) * (pr.strong ? 4 : 1);
      const n = pr.strong ? 2 : rng.int(0, 2);
      for (let i = 0; i < n; i++) contents.push(makeItem(rng, rng.pick(['book', 'art', 'antique', 'letter', 'document', 'coin']), rollRarity(rng, pr.strong ? 2.2 : 1.3, tr.rarityShift + (pr.strong ? 1 : 0)), ctx));
      if (run.pendingLuggageUnique && (pr.strong || (owner && owner.vip))) { contents.push(run.pendingLuggageUnique); run.pendingLuggageUnique = null; }
      if (pr.comp && run.playerComp === car.idx + ':' + pr.comp) { pr.lock = false; pr.mine = true; contents.length = 0; cashIn = 0; }
    }
    pr.contents = { items: contents, cash: Math.round(cashIn) };
  }
  if (run.pendingLuggageUnique) {
    const strong = run.carriages.flatMap(c => c.props).find(p => p.lock && p.contents);
    if (strong) strong.contents.items.push(run.pendingLuggageUnique);
  }
  delete run.pendingLuggageUnique; delete run.pendingVaultUnique;

  // player
  const pc = run.carriages[pseat.car];
  run.player = { x: pseat.x + (pseat.dir === 'r' ? 22 : pseat.dir === 'l' ? -22 : 0), y: Math.min(pseat.y + 34, 3 * T + 16), dir: 'd', car: pc.idx, walkPhase: 0, moving: false, hurry: false, hidden: false, outfit: S.outfit, inv: [], hiddenInv: [], coatChanged: false };
  if (pseat.comp) { run.player.x = pseat.x + (pseat.dir === 'r' ? 24 : -24); run.player.y = 2.6 * T; }
  return run;
}

function seatPax(p, seat, run) {
  seat.occ = p.id;
  p.seat = seat.id; p.home = { seat: seat.id, car: seat.car, comp: seat.comp || null };
  p.x = seat.x; p.y = seat.y; p.dir = seat.dir; p.car = seat.car; p.state = 'seated';
  if (seat.lie) p.lie = true;
  p.act = seat.cards ? 'cards' : seat.kind === 'dining' ? 'eat' : 'idle';
}

export function addDetective(run, rng, S, atStation = false) {
  if (run.pax.some(p => p.staff === 'detective')) return null;
  const d = {
    id: uid(), arch: 'detective', name: 'Inspector Mabel Hollis', female: true, cls: 'staff', look: makeLook(rng, 'detective', true),
    x: 0, y: 2.6 * T, dir: 'r', car: 0, act: 'patrol', actT: 5, attn: 0.9, susp: Math.min(60, (S.upgrades.disguise_faces ? 0.3 : 1) * S.notoriety * 8), glanceT: 5, glancing: 0, stirWarn: 0,
    aware: 0.95, ethics: 'honest', cash: 20, items: [], robbed: [], observed: false, bio: 'The sharpest detective on the line.', state: 'patrol', path: null,
    lastSawPlayer: -99, staff: 'detective', walkPhase: 0, speed: 44, bubble: null, bubbleT: 0, distractT: 0, patrolDir: 1, stopT: 0, recurring: 'hollis',
  };
  d.look.hairStyle = 'bun'; d.look.hat = 'fedora'; d.look.trench = true;
  const car = run.carriages[0];
  d.x = car.x0 + 3 * T; d.car = 0;
  run.pax.push(d);
  return d;
}

// Boarding passengers at stations
export function boardPassengers(run, S, n, rng) {
  const tr = TRAINS[run.trainId];
  const mix = Object.entries(tr.mix).map(([a, w]) => ({ a, w }));
  const allSeats = run.carriages.flatMap(c => c.seats).filter(s => !s.occ && !s.bar && !s.cards && run.carriages[s.car].type !== 'baggage');
  const out = [];
  for (let i = 0; i < n && allSeats.length; i++) {
    const arch = rng.weighted(mix).a; const A = ARCHETYPES[arch];
    const cands = allSeats.filter(s => {
      const car = run.carriages[s.car];
      if (s.occ) return false;
      if (A.cls === 'working' && (car.cls === 'first' || car.cls === 'sleeper' || car.cls === 'second')) return false;
      if (A.cls === 'upper' && car.cls === 'third' && run.trainId !== 'local') return false;
      return true;
    });
    if (!cands.length) continue;
    const seat = rng.pick(cands);
    const female = A.female ? true : rng.chance(0.45);
    const nm = personName(rng, arch, female);
    const name = typeof nm === 'string' ? nm : nm.name;
    const p = {
      id: uid(), arch, name, female: typeof nm === 'string' ? female : nm.female, cls: A.cls, look: makeLook(rng, arch, typeof nm === 'string' ? female : nm.female),
      x: 0, y: 0, dir: 'd', seat: null, home: null, car: 0, act: 'idle', actT: rng.range(3, 8), attn: 0.5, susp: 0, glanceT: rng.range(3, 8), glancing: 0, stirWarn: 0,
      aware: A.aware * rng.range(0.9, 1.1), ethics: rng.chance(A.ethics) ? 'decent' : 'callous', cash: rng.int(A.cash[0], A.cash[1]), items: [], robbed: [], discoverT: null, observed: false,
      bio: rng.pick(A.bio), secret: null, rel: null, state: 'seated', lastSawPlayer: -99, walkPhase: 0, speed: rng.range(34, 44), bubble: null, bubbleT: 0, distractT: 0, stopT: 0, newcomer: true,
    };
    const cats = A.items.filter(([c, w]) => w > 0 && CATEGORIES[c].tech !== 'lock').map(([c, w]) => ({ c, w }));
    const k = A.cls === 'upper' ? rng.int(1, 2) : rng.int(0, 1);
    for (let j = 0; j < k; j++) { const c = rng.weighted(cats).c; if (!p.items.some(it => it.cat === c)) p.items.push(makeItem(rng, c, rollRarity(rng, A.rarityBias, tr.rarityShift), { owner: p.name, ownerCls: p.cls, ownerEthics: p.ethics === 'decent' ? 0.8 : 0.15, train: tr.name, date: run.date, socialite: A.socialite, poor: A.poor })); }
    seatPax(p, seat, run);
    run.pax.push(p);
    out.push(p);
  }
  return out;
}
