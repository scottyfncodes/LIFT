// LIFT — mission objectives, ratings and rewards
import { MISSIONS, PATROL, ROGUES, RANKS, rankOf, MEMOIRS, ROUTE_RANK } from './data/cast.js';
import { RARITY_ORDER, TRAINS } from './data/content.js';

// status: 'done' | 'failed' | 'open'
function goalStatus(g, run, final) {
  const R = run.returned, pax = run.pax;
  const thieves = pax.filter(p => p.thief);
  switch (g.type) {
    case 'returnVip': return R.some(r => r.vip) ? 'done' : final ? 'failed' : 'open';
    case 'vipUnaware': {
      const r = R.find(x => x.vip);
      if (r) return r.unaware ? 'done' : 'failed';
      const v = pax.find(p => p.missionVip);
      if (v && (v.lostItems || []).some(l => l.discovered)) return 'failed';
      return final ? 'failed' : 'open';
    }
    case 'returnN': return R.length >= g.n ? 'done' : final ? 'failed' : 'open';
    case 'returnBefore': {
      const n = R.filter(r => r.leg < g.leg).length;
      if (n >= g.n) return 'done';
      return run.leg >= g.leg || final ? 'failed' : 'open';
    }
    case 'identifyRogue': return thieves.some(p => p.thief.rogue === g.rogue && p.identified) ? 'done' : final || thieves.some(p => p.thief.rogue === g.rogue && p.left && !p.identified) ? 'failed' : 'open';
    case 'identifyCrew': {
      const crew = thieves.filter(p => p.thief.crew === g.crew);
      if (crew.length && crew.every(p => p.identified)) return 'done';
      return final || crew.some(p => p.left && !p.identified) ? 'failed' : 'open';
    }
    case 'identifyAll': {
      const active = thieves.filter(p => p.thief.strikes > 0 || p.identified);
      if (active.length && active.every(p => p.identified)) return final ? 'done' : 'open';
      return final ? 'failed' : 'open';
    }
    case 'noFalse': return run.falseLifts > 0 ? 'failed' : final ? 'done' : 'open';
    case 'unawareAll': return R.some(r => !r.unaware) ? 'failed' : final ? (R.length ? 'done' : 'failed') : 'open';
    case 'coverHigh': return run.suspPeak >= 75 ? 'failed' : final ? 'done' : 'open';
    case 'tickets': return run.tickets >= g.n ? 'done' : final ? 'failed' : 'open';
    case 'noEscape': return run.escaped.length ? 'failed' : final ? 'done' : 'open';
  }
  return 'open';
}
export function evaluateMission(run, mission, final) {
  const goals = mission.goals.map(g => ({ text: g.text, type: g.type, status: goalStatus(g, run, final) }));
  const optional = (mission.optional || []).map(g => ({ text: g.text, type: g.type, status: goalStatus(g, run, final), optional: true }));
  const success = goals.every(g => g.status === 'done');
  const stars = success ? 1 + optional.filter(g => g.status === 'done').length : 0;
  return { goals, optional, success, stars };
}

export function missionsFor(routeId, S) {
  const rank = S.rank || 0;
  const story = MISSIONS.filter(m => m.routes.includes(routeId) && m.rank <= rank);
  return story.concat([PATROL]);
}
export function missionById(id) { return MISSIONS.find(m => m.id === id) || PATROL; }
export function routeOpen(id, S) { return (S.rank || 0) >= ROUTE_RANK[id]; }

// ------------------------------------------------------------ rewards
export function computeRewards(R) {
  let merits = 0;
  for (const r of R.returned) {
    const ri = Math.max(0, RARITY_ORDER.indexOf(r.item.rarity));
    let m = 6 + ri * 6;
    if (r.unaware) m *= 1.5; else if (r.how === 'plant') m *= 1.2;
    merits += m;
  }
  merits += R.lostProperty.length * 2;
  const identified = R.thieves.filter(t => t.identified).length;
  const arrests = R.thieves.filter(t => t.arrested).length;
  merits += identified * 8 + arrests * 12 + R.stars * 15 + R.tickets * 0.5 + R.helped * 3 - R.falseLifts * 5;
  if (R.reason === 'relieved') merits *= 0.6;
  merits = Math.max(0, Math.round(merits));
  const favours = R.favours + R.stars + arrests;
  const xp = Math.round(merits * 0.8 + R.stars * 12 + identified * 5);
  return { merits, favours, xp, identified, arrests };
}

// Applies a finished shift to the save; returns notes to show
export function applyReport(S, R) {
  const notes = [];
  const rw = computeRewards(R);
  const st = S.stats;
  const rankBefore = S.rank || 0;
  S.merits += rw.merits; S.favours += rw.favours; S.xp += rw.xp;
  S.rank = rankOf(S.xp);
  st.runs++;
  st.returned += R.returned.length; st.unaware += R.returned.filter(r => r.unaware).length;
  st.recovered += R.recovered; st.escaped += R.escaped.length; st.falseLifts += R.falseLifts;
  st.tickets += R.tickets; st.helped += R.helped; st.identified += rw.identified; st.arrests += rw.arrests;
  st.witnessed += R.witnessed; st.reprimands += R.reprimands; st.stars += R.stars; st.bestStars = Math.max(st.bestStars, R.stars);
  st.observed += R.observed;
  // the ledger of returns
  for (const r of R.returned) {
    const it = r.item;
    S.returns.unshift({ id: it.id, name: it.name, cat: it.cat, rarity: it.rarity, material: it.material || '', value: it.value, owner: r.owner, unaware: r.unaware, route: R.routeName, date: R.date, desc: it.desc || '' });
    if (RARITY_ORDER.indexOf(it.rarity) >= 3) { st.rare++; notes.push(`A ${it.rarity} piece—${it.name}—went home to ${r.owner}. It’s in your ledger.`); }
  }
  S.returns = S.returns.slice(0, 200);
  // case files
  for (const t of R.thieves) {
    if (t.rogue) {
      const c = S.cases[t.rogue] = S.cases[t.rogue] || { seen: 0, profiled: false, identified: 0, arrested: false, notes: [] };
      c.seen++;
      if (t.identified) { if (!c.profiled) notes.push(`New case file: ${ROGUES[t.rogue].name}, “${ROGUES[t.rogue].alias}”.`); c.profiled = true; c.identified++; }
      if (t.arrested && !c.arrested) { c.arrested = true; notes.push(`${ROGUES[t.rogue].alias} is behind bars. Case closed.`); }
      for (const n of t.notes) if (!c.notes.includes(n)) c.notes.push(n);
      c.notes = c.notes.slice(-8);
    } else {
      S.anon.seen++;
      if (t.identified) S.anon.identified++;
      if (t.arrested) S.anon.arrested++;
    }
  }
  // investigations
  S.investigations.unshift({ title: R.missionTitle, route: R.routeName, date: R.date, stars: R.stars, success: R.success, returned: R.returned.length });
  S.investigations = S.investigations.slice(0, 60);
  if (!R.patrol && R.success) S.missionsDone[R.missionId] = Math.max(S.missionsDone[R.missionId] || 0, R.stars);
  // rank & memoirs
  if (S.rank > rankBefore) {
    notes.push(`Promoted: ${RANKS[S.rank].name}.`);
    const opened = Object.keys(ROUTE_RANK).filter(k => ROUTE_RANK[k] === S.rank).map(k => TRAINS[k].name);
    if (opened.length) notes.push(`New route assigned to you: ${opened.join(', ')}.`);
  }
  const unlock = id => { if (!S.memoirs[id]) { S.memoirs[id] = true; const m = MEMOIRS.find(x => x.id === id); notes.push(`A page from your memoirs: “${m.title}”.`); } };
  if (st.returned > 0) unlock('m1');
  if (S.rank >= 1) unlock('m2');
  if (S.rank >= 2) unlock('m4');
  if (S.rank >= 3) unlock('m5');
  if (S.rank >= 4) unlock('m6');
  if (R.goals.some(g => g.type === 'identifyCrew' && g.status === 'done')) unlock('m3');
  if (R.thieves.some(t => t.rogue === 'hawthorne' && t.identified) && R.success) unlock('m7');
  S.log.unshift({ date: `${R.date} · ${R.routeName}`, text: `${R.missionTitle}: ${R.returned.length} returned, ${R.escaped.length} escaped, ${'★'.repeat(R.stars) || 'no stars'}.` });
  S.log = S.log.slice(0, 40);
  S.tutorial.done = true;
  S.pending = null;
  return { notes, rw };
}
