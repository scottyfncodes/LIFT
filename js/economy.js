// LIFT — items, economy, reputation
import { CATEGORIES, RARITY, RARITY_ORDER, GEN, HISTORY, SETS, CRESTS, CONSORTIUM_DOCS, UNIQUES, REPUTATIONS, CAUSES } from './data/content.js';
import { uid } from './util.js';

export function rollRarity(rng, bias = 1, shift = 0) {
  // bias multiplies weights of higher rarities; shift moves distribution up
  const list = RARITY_ORDER.map((r, i) => ({ r, w: RARITY[r].w * Math.pow(bias, i) * Math.pow(1.9, shift * i) * (i === 0 ? Math.max(0.15, 1 - shift * 0.25) : 1) }));
  return rng.weighted(list).r;
}

export function makeItem(rng, cat, rarity, ctx = {}) {
  const C = CATEGORIES[cat];
  const noun = rng.pick(GEN.NOUNS[cat]);
  const material = rng.pick(GEN.MATERIALS[rarity]);
  const maker = ['watch', 'wristwatch', 'cigcase', 'lighter', 'compass', 'accessory', 'ring', 'bracelet', 'necklace'].includes(cat) ? rng.pick(GEN.MAKERS) : null;
  const value = Math.round(C.base * RARITY[rarity].mult * rng.range(0.8, 1.35));
  let name;
  if (cat === 'coin') name = `${noun}`;
  else if (cat === 'letter' || cat === 'document') name = noun;
  else if (cat === 'book' || cat === 'art' || cat === 'antique') name = `${noun}`;
  else if (maker && rng.chance(0.6)) name = `${maker} ${noun}`;
  else name = `${cap1(material)} ${noun}`;
  const it = {
    id: uid(), name, cat, rarity, value, noun, maker, material,
    desc: describe(rng, cat, material, noun, maker, ctx),
    history: rng.pick(HISTORY[cat]),
    owner: ctx.owner || 'Unknown', ownerCls: ctx.ownerCls || 'upper', ownerEthics: ctx.ownerEthics ?? 0.3,
    train: ctx.train || '', date: ctx.date || '',
    tech: C.tech,
    intel: C.intel ? C.intel + (RARITY_ORDER.indexOf(rarity)) * 2 : 0,
  };
  if (cat === 'coin' && rarity === 'common') it.value = Math.round(it.value * 1.2);
  if (ctx.socialite) it.socialite = true;
  if (ctx.poor && cat === 'heirloom') { it.heirloomOf = ctx.owner; it.value = Math.round(it.value * 0.6); }
  return it;
}
function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function describe(rng, cat, material, noun, maker, ctx) {
  const a = {
    watch: `A ${material} ${noun.toLowerCase()} with a ${rng.pick(['guilloché dial', 'railway-pattern face', 'cracked crystal', 'moonphase window', 'hand-chased case'])}.`,
    wristwatch: `A ${material} ${noun.toLowerCase()} on a ${rng.pick(['crocodile strap', 'silk ribbon', 'mesh bracelet', 'worn leather band'])}.`,
    ring: `A ${material} ${noun.toLowerCase()}${rng.chance(0.5) ? ' set with a ' + rng.pick(['garnet', 'moonstone', 'carnelian', 'jet cabochon', 'tiny diamond']) : ''}.`,
    necklace: `A ${noun.toLowerCase()} in ${material}, ${rng.pick(['warm from wear', 'fastened with a box clasp', 'with a deco pendant', 'heavier than it looks'])}.`,
    bracelet: `A ${material} ${noun.toLowerCase()} that ${rng.pick(['chimes softly', 'catches the lamplight', 'bears tiny initials', 'is a size too large'])}.`,
    coin: `A ${noun} struck in ${material}. ${rng.pick(['The profile is worn smooth.', 'Mint-bright, never spent.', 'Pierced once to be worn as a charm.'])}`,
    cigcase: `A ${material} ${noun.toLowerCase()}, ${rng.pick(['engine-turned', 'enamelled with a racing yacht', 'monogrammed', 'still holding three Turkish cigarettes'])}.`,
    lighter: `A ${material} ${noun.toLowerCase()}, ${rng.pick(['dented at the corner', 'with a windguard', 'engraved with a regimental badge', 'smelling of petrol'])}.`,
    compass: `A ${material} ${noun.toLowerCase()} whose needle ${rng.pick(['trembles north', 'sticks a little', 'glows faintly with radium paint'])}.`,
    book: `A ${noun.toLowerCase()} bound in ${rng.pick(['calfskin', 'morocco', 'green cloth', 'vellum'])}.`,
    letter: `${rng.pick(['Folded thrice', 'Perfumed', 'Sealed in red wax', 'Hastily scrawled'])}. ${rng.pick(['It names names.', 'It mentions a meeting at midnight.', 'It apologises for nothing.', 'It is not addressed to the person who carried it.'])}`,
    document: `${rng.pick(['Typed', 'Stamped CONFIDENTIAL', 'Annotated in green ink', 'Countersigned'])}. ${rng.pick(['The figures do not add up—on purpose.', 'It concerns a railway that doesn’t exist yet.', 'It would interest the Clarion.', 'Someone would pay to have it back.'])}`,
    art: `A ${noun.toLowerCase()} ${rng.pick(['in a gilt frame', 'wrapped in oilcloth', 'signed in the corner', 'of a woman by the sea'])}.`,
    antique: `A ${material} ${noun.toLowerCase()}, ${rng.pick(['older than the railway', 'with a hidden drawer', 'faintly scented with sandalwood'])}.`,
    heirloom: `A humble ${noun.toLowerCase()}, ${rng.pick(['polished by generations of thumbs', 'mended with wire', 'wrapped in a handkerchief'])}.`,
    accessory: `${cap1(material)} ${noun.toLowerCase()}, ${rng.pick(['initialled', 'in a fitted case', 'barely used', 'very much used'])}.`,
  };
  return a[cat];
}

export function makeUnique(u, ctx = {}) {
  return {
    id: uid(), uid: u.id, name: u.name, cat: u.cat, rarity: u.rarity, value: u.value, noun: CATEGORIES[u.cat].single,
    maker: u.maker || null, material: '', desc: u.desc, history: HISTORY[u.cat][0], owner: u.owner, ownerCls: 'upper', ownerEthics: 0.1,
    train: ctx.train || '', date: ctx.date || '', tech: CATEGORIES[u.cat].tech, intel: u.intel || (CATEGORIES[u.cat].intel ? 8 : 0),
    unique: true, socialite: !!u.socialite, expedition: !!u.expedition, story: !!u.story, hartley: !!u.hartley,
  };
}
export function makeSignet(rng, crestKey, ctx) {
  const it = makeItem(rng, 'ring', 'rare', ctx);
  it.name = `${CRESTS[crestKey]} Family Signet`;
  it.crest = crestKey; it.noun = 'Signet Ring';
  it.value = 260 + rng.int(0, 80);
  it.desc = `A heavy gold signet bearing the ${CRESTS[crestKey]} crest. Pressed into wax, it opens doors that money alone cannot.`;
  return it;
}
export function makeConsortiumDoc(key, ctx) {
  const d = CONSORTIUM_DOCS.find(x => x.key === key);
  return { id: uid(), name: d.name, cat: 'document', rarity: 'exceptional', value: 300, noun: 'Document', desc: d.desc, history: 'Part of the paper trail of the Meridian Compact.', owner: ctx.owner, ownerCls: 'upper', ownerEthics: 0.05, train: ctx.train, date: ctx.date, tech: 'search', intel: 10, consortium: key };
}

export function fencePrice(item, S) {
  let r = 0.5;
  if (S.milestones.fence_bonus) r += 0.1;
  if (S.sets.republic) r += 0.1;
  const rep = reputation(S).key;
  if (rep === 'greedy') r += 0.12;
  if (rep === 'collector' && RARITY_ORDER.indexOf(item.rarity) >= 3) r += 0.08;
  if (item.cat === 'heirloom') r = Math.min(r, 0.35);
  if (item.consortium || item.story) r = 0.2;
  return Math.max(1, Math.round(item.value * r));
}
export function goodwillMult(S) {
  let m = 1;
  if (S.milestones.gw_bonus) m += 0.25;
  if (reputation(S).key === 'greedy') m -= 0.25;
  return m;
}
export function donateGoodwill(item, S) { return Math.max(1, Math.round((item.value / 9) * goodwillMult(S))); }
export function returnGoodwill(item, S) {
  // Returning to the deserving earns a lot; returning to a villain earns little but lowers heat on you
  const poor = item.ownerCls === 'working' || item.ownerCls === 'middle' || item.ownerCls === 'staff';
  const base = poor ? item.value / 3 + 12 : item.ownerEthics > 0.5 ? item.value / 10 + 4 : 1;
  return Math.max(1, Math.round(base * goodwillMult(S)));
}
export function leakGoodwill(item, S) {
  // documents can be leaked to the Clarion
  const base = 6 + item.intel * 2;
  return Math.round(base * (S.milestones.press_double ? 2 : 1) * goodwillMult(S));
}

export function setProgress(S, setKey, items = S.collection) {
  const def = SETS[setKey];
  const matching = items.filter(def.match);
  if (def.distinctKey) {
    const keys = new Set(matching.map(def.distinctKey));
    return { have: keys.size, need: def.need, keys };
  }
  return { have: Math.min(def.need, matching.length), need: def.need };
}

export function reputation(S) {
  const st = S.stats;
  const runs = Math.max(1, st.runs);
  const totalOut = st.given + st.kept + 1;
  const giveRatio = st.given / totalOut;
  const scores = {
    friend: giveRatio * 100 + S.goodwillTotal * 0.05 - st.poorVictims * 4,
    gentleman: (st.critical * 3 + st.clean) / runs * 6 + giveRatio * 25 - st.caught * 3,
    ghost: (st.clean / Math.max(1, st.lifts)) * 60 + (st.runs > 2 ? 15 : 0) - st.caught * 12 - S.notoriety * 2,
    outlaw: S.notoriety * 6 + giveRatio * 40 + st.caught * 3,
    greedy: (1 - giveRatio) * 70 + st.poorVictims * 6 - S.goodwillTotal * 0.03,
    collector: S.collection.length * 3 + S.collection.filter(i => RARITY_ORDER.indexOf(i.rarity) >= 3).length * 8,
  };
  if (st.runs < 2) return { key: 'unknown', ...REPUTATIONS.unknown, scores };
  let best = 'unknown', bv = 25;
  for (const k in scores) if (scores[k] > bv) { bv = scores[k]; best = k; }
  return { key: best, ...REPUTATIONS[best], scores };
}

export function causeMilestonesReached(cause, before, after) {
  return cause.milestones.filter(m => before < m.at && after >= m.at);
}
export function causeById(id) { return CAUSES.find(c => c.id === id); }

export function carryCapacity(S) {
  if (S.upgrades.store_tailored) return { slots: 9, hidden: 2 };
  return { slots: S.upgrades.store_pockets ? 6 : 4, hidden: S.upgrades.store_sleeve ? 1 : 0 };
}
