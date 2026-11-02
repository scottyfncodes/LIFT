// LIFT — the inspector's train: thief AI, clues, suspicion, duties and stations.
// Built on the core Sim (movement, pathfinding, journey, passengers), with the player as staff.
import { Sim } from './sim.js';
import { T, makeLook, boardPassengers } from './gen.js';
import { ARCHETYPES, CATEGORIES, RARITY_ORDER, TRAINS } from '../data/content.js';
import { UNIFORMS, TECHNIQUES, ROGUES, ANON_FIRST, ANON_LAST, ODDITIES, PLAIN_NOTES } from '../data/cast.js';
import { clamp, dist, RNG, uid } from '../util.js';
import { sfx, whistle } from '../audio.js';

const POCKET_NAME = { hip: 'hip pocket', breast: 'inside breast pocket', waist: 'waistcoat pocket', handbag: 'handbag', sleeve: 'cuff' };
const HAT_WORDS = { flatcap: 'a flat cap', bowler: 'a bowler hat', top: 'a top hat', homburg: 'a homburg', fedora: 'a fedora', cloche: 'a cloche hat', headscarf: 'a headscarf', pillbox: 'a porter’s cap', feather: 'a feathered hat', beret: 'a beret', tiara: 'a tiara', peaked: 'a peaked cap' };
export const pocketName = k => POCKET_NAME[k] || 'pocket';
export const ownedName = (owner, it) => (/^The /.test(it.name) ? it.name : `${owner}\u2019s ${it.name}`);
export const itemNoun = it => (it.cat === 'wallet' ? 'wallet' : CATEGORIES[it.cat] ? CATEGORIES[it.cat].single.toLowerCase() : 'trinket');

// ======================================================================= run preparation
// Turns a freshly generated train into the inspector's shift: removes rival staff, casts the
// mission's VIP and thieves, hands out tickets and destinations.
export function prepareRun(run, S, mission, uniform) {
  const rng = new RNG(run.seed ^ 0x51ed);
  const tr = TRAINS[run.trainId];
  run.cast = true;
  run.uniform = uniform;
  run.mission = mission;
  run.susp = 0; run.suspPeak = 0; run.reprimands = 0;
  run.satchel = []; run.returned = []; run.escaped = []; run.thefts = []; run.arrests = [];
  run.notes = []; run.falseLifts = 0; run.emptyLifts = 0; run.failedLifts = 0; run.tickets = 0; run.helped = 0; run.recovered = 0; run.witnessed = 0;
  run.whistleUsed = false; run.routine = { car: -1, n: 0, t: -99 }; run.lostProperty = [];
  run.weather = tr.time === 'night' ? rng.pick(['clear', 'rain', 'rain']) : rng.pick(['clear', 'clear', 'rain', 'fog']);
  run.heat = 0; run.coins = 0;
  // the inspector works the train; no other conductors or detectives aboard
  run.pax = run.pax.filter(p => p.staff !== 'conductor' && p.staff !== 'detective');
  const P = run.player;
  P.outfit = 'tweed'; P.inv = []; P.hiddenInv = [];
  const c0 = run.carriages[0];
  P.x = c0.x0 + 2.6 * T; P.y = (c0.type === 'compartment' || c0.type === 'sleeper') ? 5 * T : 3 * T; P.car = 0; P.comp = null; P.dir = 'r';
  run.playerComp = null;
  // tickets & destinations
  for (const p of run.pax) dressTicket(p, run, rng, 1);
  const civilians = () => run.pax.filter(p => !p.staff && !p.child && !p.thief && !p.vip && !p.informant && !p.family && p.state === 'seated');
  // VIP
  if (mission.vip) {
    const V = mission.vip;
    const cls = ARCHETYPES[V.arch].cls;
    const hosts = civilians().filter(p => { const car = run.carriages[p.car]; return cls === 'upper' ? car.cls !== 'third' || run.trainId === 'local' : true; });
    const host = rng.pick(hosts.length ? hosts : civilians());
    if (host) {
      host.arch = V.arch; host.cls = cls; host.female = !!V.female; host.name = V.name;
      host.look = makeLook(rng, V.arch, V.female);
      host.items = host.items.filter(i => i.cat !== V.item.cat).slice(0, 1);
      host.items.push({ id: uid(), ...V.item, noun: CATEGORIES[V.item.cat].single, owner: V.name, ownerCls: 'upper', train: tr.name, date: run.date, tech: CATEGORIES[V.item.cat].tech, missionItem: true, history: 'Entrusted to your care by the Divisional Office.' });
      host.vip = true; host.missionVip = true; host.dest = tr.legs; host.ethics = 'decent';
      host.ticket = { dest: tr.legs, text: `First-class single to ${tr.stations[tr.legs]}`, irregular: null };
      run.vipId = host.id;
    }
  }
  // thieves
  const specs = mission.thieves ? mission.thieves.slice() : patrolThieves(S, run, rng);
  const used = new Set();
  const crews = {};
  specs.forEach((spec, i) => {
    const R = spec.rogue ? ROGUES[spec.rogue] : null;
    const arch = R ? R.arch : null;
    const wantCls = arch ? ARCHETYPES[arch].cls : null;
    let pool = civilians().filter(p => !used.has(p.id) && p.id !== run.vipId);
    if (wantCls === 'working') pool = pool.filter(p => !['first', 'sleeper'].includes(run.carriages[p.car].cls));
    if (wantCls === 'upper') pool = pool.filter(p => run.carriages[p.car].cls !== 'third' || run.trainId === 'local');
    // spread thieves out: prefer carriages not yet used, crews start a carriage apart
    pool.sort((a, b) => (Math.abs(a.car - 1 - i) - Math.abs(b.car - 1 - i)) + rng.range(-1.5, 1.5));
    const host = pool[0];
    if (!host) return;
    used.add(host.id);
    makeThief(host, spec, R, run, rng, S);
    if (R && R.crew) (crews[R.crew] = crews[R.crew] || []).push(host);
  });
  for (const k in crews) for (const p of crews[k]) p.thief.mates = crews[k].filter(q => q !== p).map(q => q.id);
  // oddballs: innocent passengers who behave strangely (red herrings)
  for (const p of civilians()) if (rng.chance(0.14)) p.oddity = rng.pick(ODDITIES);
  // a friendly porter
  if (S.upgrades.net_porter) {
    const cands = run.pax.filter(p => (p.staff === 'porter' || p.cls === 'working') && !p.child && !p.thief && !p.bartender && !p.vip);
    if (cands.length) { const p = rng.pick(cands); p.informant = true; p.name = 'Old Sam the Porter'; p.tipUsed = false; }
  }
  // the rogues' gallery
  if (S.upgrades.net_gallery) for (const p of run.pax) if (p.thief && p.thief.rogue && S.cases[p.thief.rogue] && S.cases[p.thief.rogue].profiled) addClue(p, 'gallery', 2, `A face from the Rogues’ Gallery: ${ROGUES[p.thief.rogue].alias}.`, run);
  return run;
}

function dressTicket(p, run, rng, fromLeg) {
  const tr = TRAINS[run.trainId];
  if (p.staff) { p.dest = tr.legs; p.ticket = { staff: true, text: 'Railway staff', dest: tr.legs }; return; }
  if (p.dest == null) p.dest = p.vip ? tr.legs : rng.int(Math.min(tr.legs, fromLeg + 1), tr.legs);
  const car = run.carriages[p.car] || run.carriages[0];
  const cls = car.cls === 'third' ? 'Third-class' : car.cls === 'second' ? 'Second-class' : car.cls === 'sleeper' ? 'Sleeper' : car.cls === 'first' ? 'First-class' : 'Third-class';
  p.ticket = { dest: p.dest, text: `${cls} single to ${tr.stations[p.dest]}`, irregular: null };
  if (!p.child && rng.chance(0.07)) p.ticket.irregular = rng.pick(['No ticket—“must have dropped it on the platform.”', 'Yesterday’s ticket, the date carefully smudged.']);
}

function patrolThieves(S, run, rng) {
  const rank = S.rank || 0;
  const out = [];
  const techs = ['bump', 'overhead', 'seated', 'distraction', 'crowd'];
  out.push({ anon: true, tech: rng.pick(techs.slice(0, 2 + rank)), strikes: 2 });
  out.push({ anon: true, tech: rng.pick(techs), strikes: 1 });
  const rogues = Object.keys(ROGUES).filter(k => !ROGUES[k].crew && ROGUES[k].rank <= rank && !(S.cases[k] && S.cases[k].arrested));
  if (rogues.length && rng.chance(0.45)) out.push({ rogue: rng.pick(rogues) });
  return out;
}

function makeThief(p, spec, R, run, rng, S) {
  const tr = TRAINS[run.trainId];
  if (R) {
    p.arch = R.arch; p.cls = ARCHETYPES[R.arch].cls; p.female = !!R.female; p.name = R.name;
    const L = makeLook(new RNG(hash(spec.rogue)), R.arch, R.female);
    p.look = { ...L, ...R.look };
  } else {
    p.name = `${rng.pick(ANON_FIRST)} ${rng.pick(ANON_LAST)}`;
  }
  p.items = p.items.slice(0, 1).filter(i => RARITY_ORDER.indexOf(i.rarity) <= 1);
  p.vip = true; // never wanders off at a random station
  const role = R ? (R.role || 'solo') : 'solo';
  const tech = spec.tech || (R && R.tech) || 'bump';
  const exitLeg = R ? tr.legs : rng.int(Math.min(2, tr.legs), tr.legs);
  p.dest = exitLeg;
  p.thief = {
    id: spec.rogue || ('anon-' + p.id), rogue: spec.rogue || null, tech, role, crew: R ? R.crew || null : null, mates: [],
    state: 'idle', t: 0, then: null, nextT: spec.firstTarget ? rng.range(16, 26) : rng.range(26, 60), strikes: 0,
    maxStrikes: role === 'runner' || role === 'blocker' ? 0 : (spec.strikes || (R && R.strikes) || 2),
    loot: [], alert: 0, targetId: null, firstTarget: spec.firstTarget === 'vip' ? run.vipId : null,
    exitLeg, missT: null, moved: false, interfered: 0, ditched: false, bolted: false,
  };
  p.ticket = { dest: exitLeg, text: `Single to ${tr.stations[exitLeg]}`, irregular: rng.chance(0.55) ? rng.pick([
    'A third-class ticket, though they’re sitting in better company.', 'The ticket was issued at a station this train doesn’t stop at.', 'A return half from a different line entirely.', 'Paid in cash on the platform—no name, no seat.']) : null };
  if (p.thief.role === 'runner') p.thief.nextT = 999;
}
function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

export function addClue(p, key, n, text, run) {
  p.clueKeys = p.clueKeys || [];
  if (p.clueKeys.includes(key)) return 0;
  p.clueKeys.push(key);
  p.notes = p.notes || [];
  p.notes.push(text);
  const before = p.clue || 0;
  p.clue = before + n;
  if (run) run.notes.push({ t: run.t, who: p.name, pid: p.id, text });
  return p.clue - before;
}

// ======================================================================= the simulation
export class PatrolSim extends Sim {
  constructor(run, S, hooks) {
    super(run, S, hooks);
    this.uni = UNIFORMS[run.uniform] || UNIFORMS.inspector;
    this.actions = [];
    this.obsRate = S.upgrades.craft_eye ? 1 / 0.8 : 1 / 1.6;
    this.suspDelta = 0;
    this.glints = [];
  }
  h(name, ...a) { const f = this.hooks[name]; if (f) return f(...a); }
  belongsHere(car) { return !car || this.uni.belongs.includes(car.cls) || car.cls === 'common'; }
  playerMayPass(d) {
    const next = this.run.carriages[d.between[1]];
    if (d.forced) return true;
    if (next.type === 'baggage') return this.uni.belongs.includes('baggage');
    if (next.type === 'vault') return this.uni.belongs.includes('vault');
    return false;
  }
  attnOf(p) { return clamp(super.attnOf(p) * (1 + (this.run.susp || 0) / 220), 0, 1); }
  dispatch() { /* no railway police in this game */ }
  updateSecurity(p, dt) { p.state = 'stand'; }

  update(dt, input) {
    super.update(dt, input);
    this.updateSuspicion(dt);
    if (this.run.whistleT > 0) this.run.whistleT -= dt;
    for (const g of this.glints) g.t -= dt;
    this.glints = this.glints.filter(g => g.t > 0);
  }
  updatePlayer(dt, input) {
    const P = this.run.player;
    if (P.busyT > 0) { P.busyT -= dt; P.moving = false; P.hurry = false; return; }
    super.updatePlayer(dt, input);
  }

  // ------------------------------------------------------------ suspicion of the inspector
  bumpSusp(n) { this.suspDelta += n; }
  updateSuspicion(dt) {
    const run = this.run;
    const before = run.susp;
    if (this.suspDelta > 0.0001) run.susp += this.suspDelta;
    else run.susp -= 0.55 * dt;
    this.suspDelta = 0;
    run.susp = clamp(run.susp, 0, 100);
    run.suspPeak = Math.max(run.suspPeak, run.susp);
    const lv = s => Math.min(3, Math.floor(s / 25));
    if (lv(run.susp) > lv(before)) this.h('suspLevel', lv(run.susp));
    if (run.susp >= 100 && !this.reprimanding) { this.reprimanding = true; this.h('reprimand'); }
  }
  perceive(p, dt) {
    const run = this.run, P = run.player;
    if (p.left || p.child || p.state === 'hidden' || p.act === 'sleep') { p.susp = Math.max(0, p.susp - 8 * dt); return; }
    const d = dist(p.x, p.y, P.x, P.y);
    // lingering: standing still beside someone with no duty to explain it
    if (d < 55 && !P.moving && !(p.dutyT > 0)) p.nearT = (p.nearT || 0) + dt; else p.nearT = Math.max(0, (p.nearT || 0) - dt * 2);
    if (p.dutyT > 0) p.dutyT -= dt;
    if (p.ticketCoverT > 0) p.ticketCoverT -= dt;
    const vis = d < 170 ? this.sees(p, P.x, P.y) : 0;
    if (vis <= 0 || p.attn < 0.15 || p.thief || p.staff) { p.susp = Math.max(0, p.susp - 6 * dt); return; }
    const k = this.uni.trust * p.attn * vis;
    let r = 0;
    if (P.hurry) r += 1.1;
    if (p.nearT > 4.5) r += 1.8;
    if (this.observeTarget === p && this.observeT > 0 && p.attn > 0.3) r += 1.6;
    if (!this.belongsHere(this.carAt(P.x))) r += 0.5;
    if (r > 0) { this.bumpSusp(r * k * dt); p.susp = clamp(p.susp + r * k * 22 * dt, 0, 100); }
    else p.susp = Math.max(0, p.susp - 6 * dt);
  }

  // ------------------------------------------------------------ passengers
  updatePax(p, dt) {
    if (p.left) return;
    // the VIP keeps their seat: they change activity but never wander off
    if (p.missionVip && p.state === 'seated' && p.actT - dt <= 0 && !['argue', 'watchshow', 'alarmed'].includes(p.act)) { this.chooseActivity(p); if (p.home && p.seat !== p.home.seat) this.goToSeat(p, p.home.seat); }
    if (!p.thief) return super.updatePax(p, dt);
    p.t = (p.t || 0) + dt;
    if (p.bubbleT > 0) p.bubbleT -= dt;
    if (p.distractT > 0) p.distractT -= dt;
    if (p.glancing > 0) p.glancing -= dt;
    p.attn = this.attnOf(p);
    if (p.state === 'leaving') { if (this.walkAlong(p, dt, 1.1)) p.left = true; return; }
    this.updateThief(p, dt);
    this.thiefPerceive(p, dt);
  }
  discover(p) {
    // a victim realises something is missing
    const run = this.run;
    const lostIds = (p.lostItems || []).filter(l => !l.returned && !l.discovered);
    if (!lostIds.length) return;
    for (const l of lostIds) l.discovered = true;
    const L = lostIds[lostIds.length - 1];
    const noun = L.noun;
    p.bubble = this.rng.pick([`My ${noun}! It’s gone!`, `Where’s my ${noun}?!`, `Someone’s taken my ${noun}!`]); p.bubbleT = 4;
    p.act = 'alarmed'; p.actT = 6; sfx.gasp();
    for (const q of run.pax) if (!q.staff && !q.left && q.car === p.car) q.aware = Math.min(1, q.aware + 0.06);
    this.h('victimNoticed', p, L);
    // description of the thief, if the player is near enough to hear it
    const thief = this.paxById.get(L.thiefPid);
    const P = run.player;
    if (thief && !thief.left && Math.abs(P.x - p.x) < 520) {
      const who = thief.female ? 'woman' : 'man';
      const hat = HAT_WORDS[thief.look.hat] || 'no hat at all';
      const text = `${p.name} remembers ${who === 'man' ? 'a man' : 'a woman'} wearing ${hat} close by.`;
      addClue(thief, 'report-' + L.id, 1, text, run);
      if (!this.S.upgrades.net_gossip) {
        const decoy = run.pax.find(q => q !== thief && !q.left && !q.staff && !q.child && q.car === thief.car && q.look.hat === thief.look.hat && q.female === thief.female && q.id !== p.id);
        if (decoy) addClue(decoy, 'report-' + L.id, 1, `${p.name} remembers someone wearing ${hat} close by…`, run);
      }
      this.h('report', p, thief, text);
    }
  }

  // ------------------------------------------------------------ thieves
  thiefPerceive(p, dt) {
    const T = p.thief, run = this.run, P = run.player;
    const d = dist(p.x, p.y, P.x, P.y);
    const sees = d < 160 && this.sees(p, P.x, P.y) > 0 && p.act !== 'sleep';
    if (d < 55 && !P.moving) p.nearT = (p.nearT || 0) + dt; else p.nearT = Math.max(0, (p.nearT || 0) - dt * 2);
    if (p.ticketCoverT > 0) p.ticketCoverT -= dt;
    if (p.dutyT > 0) p.dutyT -= dt;
    if (sees) {
      // a uniform at the far end of the carriage is mildly worrying; one hovering close is alarming
      const close = d < 75;
      let r = (close ? 4.5 : 0.9) * this.uni.wary * (1 + run.susp / 90) * (1 + T.interfered * 0.5);
      const lingering = p.nearT > 3.5 && !(p.dutyT > 0);
      const staring = this.observeTarget === p && this.observeT > 0;
      if (lingering) r *= 2.2;
      if (staring) r *= 2.4;
      if (T.state === 'eye' || T.state === 'strike' || T.state === 'assist') r *= 0.25; // busy with the mark
      if (P.hurry) r *= 1.5;
      const cap = close || lingering || staring || T.interfered ? 100 : 35;
      if (T.alert < cap) T.alert = Math.min(cap, T.alert + r * dt);
    } else T.alert = Math.max(0, T.alert - 2.2 * dt);
    if (T.missT != null) {
      T.missT -= dt;
      if (T.missT <= 0) {
        T.missT = null;
        p.bubble = this.rng.pick(['?!', 'Hang on…', 'Where’d it go?']); p.bubbleT = 2.5;
        T.alert = clamp(T.alert + 45, 0, 100);
        if (d < 160 && sees) { this.bumpSusp(8); this.h('thiefGlare', p); }
      }
    }
    // escalating caution
    if (T.loot.length && !T.moved && T.alert >= 45 && d < 100 && T.state === 'idle') {
      T.moved = true;
      const seen = this.playerCanSee(p, 160);
      for (const l of T.loot) { l.pocket = this.pickPocket(p, T.tech, l.pocket); if (!seen) l.known = false; }
      if (seen) { this.h('witness', p, null, null, 'moved', `${p.name} just shifted something into the ${pocketName(T.loot[0].pocket)}. Saw that.`); }
    }
    if (T.loot.length && T.alert >= 78 && !T.ditched && T.state === 'idle') this.spook(p);
    if (T.alert >= 100 && !T.bolted && (T.state === 'idle' || T.state === 'eye')) this.bolt(p);
  }
  playerCanSee(p, range) {
    const P = this.run.player;
    if (P.hidden || this.carAt(p.x) !== this.carAt(P.x)) return false;
    const d = dist(p.x, p.y, P.x, P.y);
    const R = range * (this.run.tunnelT > 0 ? 0.6 : 1);
    if (d > R) return false;
    if (d < 110) return true;
    if (this.observeTarget === p) return true;
    const fx = P.dir === 'r' ? 1 : P.dir === 'l' ? -1 : 0;
    return fx === 0 || (p.x - P.x) * fx > -12;
  }
  pickPocket(p, tech, avoid) {
    let opts = (TECHNIQUES[tech] || TECHNIQUES.bump).pockets.slice();
    if (!p.female) opts = opts.map(k => (k === 'handbag' ? 'hip' : k));
    if (p.female && this.rng.chance(0.5)) opts.push('handbag');
    const o = opts.filter(k => k !== avoid);
    return this.rng.pick(o.length ? o : ['hip', 'breast', 'waist'].filter(k => k !== avoid));
  }
  go(p, x, y, then, speedMul = 1) {
    const T = p.thief;
    if (p.state === 'seated') this.leaveSeat(p);
    p.path = this.findPath(p.x, p.y, x, y, p);
    T.speedMul = speedMul;
    if (!p.path || !p.path.length) { T.state = then; p.state = 'stand'; return; }
    p.state = 'walk'; p.act = 'walk';
    T.state = 'move'; T.then = then;
  }
  leaveSeat(p) {
    const s = p.seat && this.seatById.get(p.seat);
    if (s && s.occ === p.id && (!p.home || p.home.seat !== s.id)) s.occ = null;
    p.seat = null; p.lie = false;
  }
  sitAt(p, seatId, then) {
    const s = this.seatById.get(seatId);
    if (!s) { p.thief.state = then; return; }
    if (!s.occ) s.occ = p.id;
    this.go(p, s.x, s.y, 'sitting');
    p.thief.sitSeat = seatId; p.thief.afterSit = then;
  }
  goHome(p) {
    const T = p.thief;
    if (p.home && p.home.seat && T.role !== 'runner') this.sitAt(p, p.home.seat, 'idle');
    else { p.state = 'stand'; T.state = 'idle'; }
  }
  updateThief(p, dt) {
    const T = p.thief, run = this.run, P = run.player;
    const target = T.targetId ? this.paxById.get(T.targetId) : null;
    switch (T.state) {
      case 'move': {
        if (this.walkAlong(p, dt, T.speedMul || 1)) {
          p.state = 'stand'; p.act = 'idle';
          T.state = T.then;
          if (T.state === 'eye' || T.state === 'strike') this.face(p, target);
        }
        break;
      }
      case 'sitting': {
        const s = this.seatById.get(T.sitSeat);
        if (s) { p.x = s.x; p.y = s.y; p.dir = s.dir; p.seat = s.id; s.occ = p.id; p.lie = !!s.lie; }
        p.state = 'seated'; p.act = T.afterSit === 'eye' ? 'read' : 'idle';
        T.state = T.afterSit || 'idle';
        if (T.state === 'eye') T.t = this.rng.range(...TECHNIQUES[T.tech].eye);
        break;
      }
      case 'idle': {
        if (p.state === 'seated') { p.actT -= dt; if (p.actT <= 0) { this.chooseActivity(p); if (p.act === 'sleep') p.act = 'read'; } }
        if (T.bolted || T.ditched && T.loot.length === 0 && T.alert > 60) break;
        T.nextT -= dt;
        if (run.tunnelT > 0 && T.nextT > 4) T.nextT -= dt * 3; // darkness is an invitation
        const canStrike = T.strikes < T.maxStrikes && T.loot.length < 3 && run.phase === 'moving' && T.alert < 55;
        if (T.nextT <= 0 && canStrike) {
          // cautious when the inspector is the talk of the train or standing close
          if ((run.susp > 50 && this.carAt(P.x) === this.carAt(p.x)) || dist(P.x, P.y, p.x, p.y) < 90) { T.nextT = this.rng.range(6, 12); break; }
          const tgt = this.pickTarget(p);
          if (tgt) this.beginTheft(p, tgt); else T.nextT = this.rng.range(8, 15);
        }
        break;
      }
      case 'eye': {
        if (!target || target.left || target.state === 'walk' || target.state === 'hidden' || target.state === 'leaving') { this.abort(p); break; }
        this.face(p, target);
        p.tellT = 1;
        T.t -= dt;
        // the inspector looming nearby puts them off
        if (T.alert > 40 && dist(P.x, P.y, p.x, p.y) < 80) { this.abort(p); break; }
        if (T.t <= 0) this.strike(p, target);
        break;
      }
      case 'strike': {
        if (!target || target.left) { this.abort(p); break; }
        this.face(p, target);
        T.t -= dt;
        if (T.t <= 0) this.steal(p, target);
        break;
      }
      case 'assist': { // a blocker keeping the mark busy
        if (!target || target.left) { T.state = 'idle'; this.goHome(p); break; }
        this.face(p, target);
        target.distractT = Math.max(target.distractT || 0, 0.5); target.distractX = p.x; target.distractY = p.y;
        T.t -= dt;
        if (T.t <= 0) { T.targetId = null; this.goHome(p); }
        break;
      }
      case 'handoff': { // dipper waiting beside the runner
        const mate = this.paxById.get(T.passTo);
        if (!mate || mate.left) { this.goHome(p); break; }
        this.face(p, mate); this.face(mate, p);
        T.t -= dt;
        if (T.t <= 0) this.passLoot(p, mate);
        break;
      }
      case 'ditching': {
        T.t -= dt;
        if (T.t <= 0) this.ditchLoot(p);
        break;
      }
      case 'bolted': { p.dir = 'd'; p.state = 'stand'; p.act = 'idle'; break; }
      case 'relocate': { this.goHome(p); break; }
      default: T.state = 'idle';
    }
  }
  face(p, q) {
    if (!q) return;
    const dx = q.x - p.x, dy = q.y - p.y;
    p.dir = Math.abs(dx) > Math.abs(dy) * 0.7 ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u');
  }
  pickTarget(p) {
    const T = p.thief, run = this.run;
    if (T.firstTarget) {
      // fixated on one prize: wait for the moment rather than settle for less
      const v = this.paxById.get(T.firstTarget);
      if (v && !v.left && v.items.some(i => i.missionItem)) return v.state === 'seated' ? v : null;
      T.firstTarget = null;
    }
    let best = null, bv = 0;
    for (const q of run.pax) {
      if (q === p || q.left || q.staff || q.child || q.thief || q.informant || !q.items.length) continue;
      if (q.state !== 'seated' && q.state !== 'stand') continue;
      const dc = Math.abs(q.car - p.car);
      if (dc > 1) continue;
      if (run.carriages[q.car].type === 'baggage' || run.carriages[q.car].type === 'vault') continue;
      const val = q.items.reduce((s, i) => s + i.value, 0);
      let score = val * (q.cls === 'upper' ? 1.4 : 1) * (dc ? 0.7 : 1) * (q.act === 'sleep' ? 1.5 : 1) * this.rng.range(0.7, 1.3);
      if (T.tech === 'crowd' && !['dining', 'lounge', 'salon'].includes(run.carriages[q.car].type)) score *= 0.5;
      if (score > bv) { bv = score; best = q; }
    }
    return best;
  }
  approachPoint(p, tgt) {
    const side = p.x < tgt.x ? -1 : 1;
    const y = tgt.state === 'seated' ? (tgt.y < 96 ? tgt.y + 34 : tgt.y - 34) : tgt.y;
    return [tgt.x + side * 22, clamp(y, 30, 170)];
  }
  beginTheft(p, tgt) {
    const T = p.thief;
    T.targetId = tgt.id;
    T.t = this.rng.range(...TECHNIQUES[T.tech].eye);
    if (T.tech === 'seated' || T.tech === 'confidence') {
      const seat = tgt.seat && this.seatById.get(tgt.seat);
      const free = seat && [...this.seatById.values()].find(s => s.group === seat.group && s.car === seat.car && !s.occ);
      if (free && T.tech === 'seated') { this.sitAt(p, free.id, 'eye'); return; }
    }
    const [x, y] = this.approachPoint(p, tgt);
    this.go(p, x, y, 'eye', 1.1);
    // a crew blocker joins in
    for (const mid of T.mates) {
      const m = this.paxById.get(mid);
      if (m && !m.left && m.thief.role === 'blocker' && m.thief.state === 'idle') {
        m.thief.targetId = tgt.id; m.thief.t = 6;
        const ax = tgt.x + (x < tgt.x ? 24 : -24);
        this.go(m, ax, y, 'assist');
      }
    }
  }
  strike(p, tgt) {
    const T = p.thief, tech = TECHNIQUES[T.tech];
    T.state = 'strike'; T.t = tech.strike;
    p.act = T.tech === 'overhead' ? 'inspect' : T.tech === 'confidence' ? 'talk' : T.tech === 'seated' ? 'read' : 'idle';
    if (T.tech !== 'seated') { p.bubble = this.rng.pick(tech.thiefSay); p.bubbleT = Math.min(3, tech.strike + 1); }
    if (T.tech === 'distraction' || T.tech === 'confidence' || T.tech === 'overhead') { tgt.distractT = tech.strike + 0.5; tgt.distractX = p.x; tgt.distractY = p.y; if (T.tech === 'confidence') { tgt.act = 'talk'; tgt.actT = 6; } }
    if (T.tech === 'bump') { tgt.bubble = 'Oh!'; tgt.bubbleT = 1.2; }
  }
  abort(p) {
    const T = p.thief;
    T.targetId = null; T.nextT = this.rng.range(14, 26);
    this.goHome(p);
  }
  steal(p, tgt) {
    const T = p.thief, run = this.run;
    const it = tgt.items.find(i => i.missionItem) || tgt.items.slice().sort((a, b) => b.value - a.value)[0];
    if (!it) { this.abort(p); return; }
    tgt.items = tgt.items.filter(i => i !== it);
    tgt.robbed = tgt.robbed || []; tgt.robbed.push({ cat: it.cat });
    const L = { id: it.id, noun: itemNoun(it), name: it.name, thiefPid: p.id, returned: false, discovered: false, t: run.t };
    tgt.lostItems = tgt.lostItems || []; tgt.lostItems.push(L);
    if (tgt.discoverT == null) tgt.discoverT = this.rng.range(40, 95);
    const entry = { item: it, ownerId: tgt.id, ownerName: tgt.name, pocket: this.pickPocket(p, T.tech), known: false, stolenBy: p.id };
    T.loot.push(entry);
    T.strikes++; T.targetId = null;
    run.thefts.push({ t: run.t, thief: p.id, victim: tgt.id, item: it.id, tech: T.tech });
    const seen = this.playerCanSee(tgt, this.S.upgrades.craft_practised ? 330 : 210);
    if (seen) {
      entry.known = true; run.witnessed++;
      addClue(p, 'witness-' + it.id, 3, `Saw ${p.name} lift ${tgt.name}’s ${itemNoun(it)} — ${TECHNIQUES[T.tech].name.toLowerCase()}, into the ${pocketName(entry.pocket)}.`, run);
      this.h('witness', p, tgt, it, 'theft');
    } else if (this.carAt(tgt.x) === this.carAt(run.player.x) && Math.abs(tgt.x - run.player.x) < 520) {
      this.glints.push({ x: tgt.x, y: tgt.y, t: 1.2 });
      this.h('glint', tgt);
    }
    // getaway
    const mate = T.mates.map(id => this.paxById.get(id)).find(m => m && !m.left && m.thief.role === 'runner');
    if (mate) {
      T.passTo = mate.id;
      this.go(p, mate.x + (mate.x > p.x ? -20 : 20), mate.state === 'seated' ? (mate.y < 96 ? mate.y + 30 : mate.y - 30) : mate.y, 'handoff', 1.05);
      T.t = 1.4;
    } else if (T.tech === 'bump' || T.tech === 'crowd') {
      const dir = p.x < tgt.x ? 1 : -1;
      const car = run.carriages[tgt.car];
      this.go(p, clamp(tgt.x + dir * 90, car.x0 + 30, car.x0 + car.w - 30), 3 * T_, 'relocate', 1.15);
    } else this.goHome(p);
    T.nextT = this.rng.range(35, 65);
  }
  passLoot(from, to) {
    const run = this.run;
    const A = from.thief, B = to.thief;
    if (!A.loot.length) { this.goHome(from); return; }
    for (const l of A.loot) { l.pocket = this.pickPocket(to, B.tech); l.known = false; B.loot.push(l); }
    const passed = A.loot.splice(0);
    const seen = this.playerCanSee(to, this.S.upgrades.craft_practised ? 330 : 210);
    if (seen) {
      const n = this.S.upgrades.craft_practised ? 3 : 2;
      for (const l of passed) l.known = true;
      addClue(from, 'pass-' + to.id, n, `Saw ${from.name} pass something to ${to.name}.`, run);
      addClue(to, 'pass-' + from.id, n, `Took something from ${from.name} in passing—now in the ${pocketName(passed[0].pocket)}.`, run);
      this.h('witness', from, to, passed[0].item, 'handoff');
    }
    this.goHome(from);
    // the runner walks the goods to another carriage
    const cars = run.carriages.filter(c => c.type !== 'baggage' && c.type !== 'vault' && Math.abs(c.idx - to.car) >= 1);
    const car = this.rng.pick(cars) || run.carriages[to.car];
    const spot = car.spots.find(s => s.kind === 'stand');
    this.go(to, spot ? spot.x : car.x0 + car.w * this.rng.range(0.3, 0.7), spot ? spot.y : 3 * T_, 'idle', 0.95);
  }
  spook(p) {
    const T = p.thief;
    T.ditched = true;
    const mate = T.mates.map(id => this.paxById.get(id)).find(m => m && !m.left && m.thief.state !== 'bolted');
    if (mate) {
      T.passTo = mate.id; T.t = 1.2;
      this.go(p, mate.x + (mate.x > p.x ? -20 : 20), mate.state === 'seated' ? (mate.y < 96 ? mate.y + 30 : mate.y - 30) : mate.y, 'handoff', 1.1);
    } else {
      // stuff it somewhere and walk away clean
      const car = this.run.carriages[p.car];
      const props = car.props.filter(pr => pr.kind === 'lav' || pr.kind === 'rack');
      const pr = props.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
      if (!pr) return;
      T.ditchProp = pr.id; T.t = 2.2;
      this.go(p, pr.kind === 'lav' ? pr.x + pr.w + 8 : pr.x + pr.w / 2, pr.kind === 'lav' ? pr.y + pr.h * 0.6 : pr.y - 6, 'ditching', 1.1);
    }
    T.exitLeg = Math.min(T.exitLeg, this.run.leg + 1);
    this.h('spooked', p);
  }
  ditchLoot(p) {
    const T = p.thief, run = this.run;
    const pr = this.propById.get(T.ditchProp);
    if (pr && T.loot.length) {
      pr.stash = (pr.stash || []).concat(T.loot.splice(0));
      if (this.playerCanSee(p, 260)) {
        pr.seen = true;
        addClue(p, 'ditch', 2, `${p.name} stuffed something into the ${pr.kind === 'lav' ? 'W.C.' : 'luggage rack'} and walked off.`, run);
        this.h('witness', p, null, pr.stash[0].item, 'ditch');
      }
    }
    this.goHome(p);
  }
  bolt(p) {
    const T = p.thief;
    T.bolted = true;
    T.exitLeg = Math.min(T.exitLeg, this.run.leg + 1);
    const gx = this.nearestGangway(p.x);
    this.go(p, gx, 3 * T_, 'bolted', 1.2);
    this.h('bolted', p);
  }

  // ------------------------------------------------------------ stations
  arriveStation() {
    const run = this.run, tr = this.tr;
    run.leg++;
    run.phase = 'station'; run.stationT = 15; run.stationSlide = 0;
    const st = tr.stations[run.leg];
    whistle();
    if (run.leg >= tr.legs) { this.h('toast', `${st} — end of the line.`, 'event'); this.hooks.end('arrived'); return; }
    // the constabulary
    if (this.S.upgrades.net_constable) {
      for (const p of run.pax) {
        const T = p.thief;
        if (!T || p.left || (p.clue || 0) < 3 || T.loot.length || !T.strikes) continue;
        run.arrests.push({ id: T.id, name: p.name, rogue: T.rogue });
        this.leave(p); p.arrested = true;
        this.h('arrested', p);
      }
    }
    // thieves leave with whatever they still carry
    for (const p of run.pax) {
      const T = p.thief;
      if (!T || p.left || p.arrested || T.exitLeg > run.leg) continue;
      if (T.loot.length) { for (const l of T.loot) run.escaped.push({ ...l, thief: p.name }); this.h('escaped', p, T.loot.slice()); T.loot = []; }
      this.leave(p);
    }
    // ordinary passengers reach their stops
    for (const p of run.pax) {
      if (p.left || p.thief || p.staff || p.child || p.missionVip || p.dest !== run.leg) continue;
      if (p.familyChild) { const ch = this.paxById.get(p.familyChild); if (ch) this.leave(ch); }
      this.leave(p);
      if (run.satchel.some(e => e.ownerId === p.id)) this.h('ownerLeft', p);
    }
    if (run.familyEvent && !run.familyHelped && !run.familyEvent.resolved) {
      const fam = this.paxById.get(run.familyEvent.id);
      if (fam && !fam.left) { this.leave(fam); this.h('toast', `The guard puts the ${fam.name.split(' ').pop()} family off at ${st}.`, 'warn'); }
      run.familyEvent.resolved = true;
    }
    // boarding
    const newcomers = boardPassengers(run, this.S, this.rng.int(1, 3), this.rng);
    const flagged = [];
    for (const p of newcomers) {
      this.paxById.set(p.id, p);
      const seat = this.seatById.get(p.seat);
      p.x = this.nearestGangway(seat.x); p.y = 3 * T_; p.car = seat.car; p.state = 'walk'; p.act = 'walk';
      p.path = this.findPath(p.x, p.y, seat.x, seat.y, p);
      p.walkTarget = { kind: 'seat', seat: seat.id };
      p.dest = null; dressTicket(p, run, this.rng, run.leg);
      const aboard = run.pax.filter(q => q.thief && !q.left).length;
      if (!p.child && aboard < (run.mission.patrol ? 4 : 3)) {
        if (this.rng.chance(run.mission.patrol ? 0.22 : 0.1)) {
          makeThief(p, { anon: true, tech: this.rng.pick(['bump', 'overhead', 'seated', 'distraction']), strikes: 1 }, null, run, this.rng, this.S);
          p.thief.exitLeg = Math.min(tr.legs, run.leg + this.rng.int(1, 2)); p.dest = p.thief.exitLeg;
          p.thief.nextT = this.rng.range(25, 45);
        }
      }
      if (this.S.upgrades.net_manifest && p.ticket && p.ticket.irregular) { addClue(p, 'manifest', 1, `Flagged on the manifest: ${p.ticket.irregular}`, run); flagged.push(p.name); }
    }
    this.h('station', st, newcomers.length, flagged);
  }

  // ------------------------------------------------------------ ambient events
  updateEvents(dt) {
    const run = this.run;
    if (run.phase !== 'moving') return;
    run.nextEventT -= dt;
    if (run.nextEventT > 0) return;
    run.nextEventT = this.rng.range(30, 55);
    const alive = run.pax.filter(p => !p.left && !p.staff && !p.child && !p.thief);
    const opts = [
      { k: 'argue', w: 2 }, { k: 'magic', w: alive.some(p => p.arch === 'magician') ? 2 : 0 },
      { k: 'family', w: !run.familyEvent && alive.some(p => p.arch === 'family' && p.state === 'seated') ? 2 : 0 },
      { k: 'drunk', w: alive.some(p => p.cls === 'upper' && p.state === 'seated' && p.act !== 'sleep') ? 1.4 : 0 },
      { k: 'luggage', w: 2 }, { k: 'watchcheck', w: 1 },
    ];
    const ev = this.rng.weighted(opts).k;
    if (ev === 'luggage') {
      const p = this.rng.pick(alive.filter(q => q.state === 'seated' && !q.needsHelp && !q.missionVip));
      if (!p) return;
      p.needsHelp = 'luggage'; p.bubble = 'Could someone help with this case?'; p.bubbleT = 4;
      this.h('toast', `${p.name} is struggling with a heavy case in the ${run.carriages[p.car].name}.`, 'info');
      return;
    }
    if (ev === 'family') {
      const f = alive.find(p => p.arch === 'family' && p.state === 'seated');
      if (!f) return;
      run.familyEvent = { id: f.id, resolved: false };
      f.needsHelp = 'tickets'; f.bubble = 'Please—we’ve lost our tickets!'; f.bubbleT = 5;
      this.h('toast', `The ${f.name.split(' ').pop()} family can’t find their tickets.`, 'event');
      return;
    }
    if (ev === 'argue' || ev === 'magic' || ev === 'drunk' || ev === 'watchcheck') this.fireEvent(ev);
  }

  // ------------------------------------------------------------ observation & actions
  updateInteract(dt, input) {
    const run = this.run, P = run.player;
    this.actions = this.findActions();
    this.interact = this.actions[0] || null;
    const cand = this.observeCandidate();
    this.obsCandidate = cand;
    if (input.observe && cand) {
      if (this.observeTarget !== cand) { this.observeTarget = cand; this.observeT = 0; }
      this.observeT += dt * this.obsRate;
      if (this.observeT >= 1) { this.observeT = 0; this.study(cand); }
    } else { this.observeT = Math.max(0, this.observeT - dt * 2); if (this.observeT === 0) this.observeTarget = null; }
  }
  observeCandidate() {
    const P = this.run.player;
    let best = null, bd = 120;
    for (const p of this.run.pax) {
      if (p.left || p.child || p.state === 'hidden' || p.rival) continue;
      const d = dist(P.x, P.y, p.x, p.y);
      if (d < bd && this.carAt(p.x) === this.carAt(P.x)) { bd = d; best = p; }
    }
    return best;
  }
  study(p) {
    const run = this.run, P = run.player, T = p.thief;
    const fresh = [];
    const add = (key, n, text) => { if (addClue(p, key, n, text, run)) fresh.push(text); };
    const firstLook = !p.observed;
    p.observed = true;
    if (firstLook) run.stats.observed++;
    if (T) {
      const tgt = T.targetId && this.paxById.get(T.targetId);
      if (tgt && ['eye', 'strike', 'move'].includes(T.state)) add('eyeing-' + tgt.id, 1, `Watching ${tgt.name}’s pockets a little too closely.`);
      if (T.state === 'assist' && tgt) add('assist-' + tgt.id, 1, `Keeping ${tgt.name} talking—and facing the wrong way.`);
      if (T.loot.length) {
        const close = dist(p.x, p.y, P.x, P.y) < 85;
        if (close) { const l = T.loot[0]; l.known = true; add('loot-' + l.item.id, 1, `A ${itemNoun(l.item)} that doesn’t suit them peeks from the ${pocketName(l.pocket)}.`); }
        else add('lootfar', 1, 'Keeps touching a pocket, as if checking something is still there.');
      }
      if (!fresh.length) add('tell', 1, TECHNIQUES[T.tech].tell);
      for (const mid of T.mates) { const m = this.paxById.get(mid); if (m && !m.left && m.car === p.car) { add('crew-' + m.id, 1, `Exchanged a look with ${m.name}.`); addClue(m, 'crew-' + p.id, 1, `Exchanged a look with ${p.name}.`, run); } }
    } else if (p.oddity) add('odd', 1, p.oddity);
    if (!fresh.length && firstLook && !T) fresh.push(this.rng.pick(PLAIN_NOTES));
    sfx.discover(0);
    this.h('observed', p, fresh, firstLook);
    if ((p.clue || 0) >= 3 && !p.identified) { p.identified = true; this.h('identified', p); }
  }
  checkIdentified(p) { if ((p.clue || 0) >= 3 && !p.identified) { p.identified = true; this.h('identified', p); } }

  satchelFor(p) { return this.run.satchel.filter(e => e.ownerId === p.id); }
  findActions() {
    const run = this.run, P = run.player, S = this.S;
    const out = [];
    const add = (o, prio, d) => { o.prio = prio; o.d = d; out.push(o); };
    const duty = this.uni.duties;
    for (const p of run.pax) {
      if (p.left || p.state === 'hidden') continue;
      if (this.carAt(p.x) !== this.carAt(P.x)) continue;
      const d = dist(P.x, P.y, p.x, p.y - (p.state === 'seated' ? 2 : 0));
      if (d > 42) continue;
      if (this.satchelFor(p).length && !p.thief) add({ kind: 'return', label: 'Return', p }, 0, d);
      if (p.needsHelp && !(p.needsHelp === 'tickets' && run.familyEvent && run.familyEvent.resolved)) add({ kind: 'help', label: p.needsHelp === 'tickets' ? 'Let it slide' : 'Help', p }, 0.5, d);
      if (p.informant && !p.tipUsed) add({ kind: 'informant', label: 'Talk', p }, 1, d);
      if (p.child || p.staff) continue;
      if (d < 36) {
        const flagged = (p.clue || 0) >= 1 || (p.thief && p.thief.loot.some(l => l.known));
        add({ kind: 'lift', label: 'Lift', p, secondaryOnly: !flagged }, flagged ? 1 : 3, d);
      }
      if (duty.includes('tickets') && !p.ticketChecked) add({ kind: 'ticket', label: 'Ticket', p }, 2, d);
      if (duty.includes('refresh') && p.state === 'seated' && run.t - (p.refreshT || -99) > 40) add({ kind: 'refresh', label: 'Serve tea', p }, 2, d);
    }
    for (const car of run.carriages) {
      if (Math.abs(car.x0 + car.w / 2 - P.x) > car.w / 2 + 40) continue;
      for (const pr of car.props) {
        if ((pr.kind === 'lav' || pr.kind === 'rack') && pr.stash && pr.stash.length && pr.seen) {
          const d = pr.kind === 'lav' ? dist(P.x, P.y, pr.x + pr.w + 4, pr.y + pr.h * 0.6) : dist(P.x, P.y, pr.x + pr.w / 2, pr.y + pr.h);
          if (d < 44) add({ kind: 'search', label: 'Search', pr }, 0.8, d);
        }
      }
    }
    for (const k in run.compState) {
      const s = run.compState[k];
      if (!s.locked) continue;
      const cx = s.rect[0] + s.rect[2] / 2, cy = s.rect[1] + 10;
      const d = dist(P.x, P.y, cx, cy + 10);
      if (d < 32) add({ kind: 'compdoor', label: this.uni.keys || S.upgrades.cover_keys ? 'Unlock' : 'Pick lock', key: k }, 3, d);
    }
    for (const dd of run.doors) {
      const dx = dd.x1 - 6;
      if (dd.locked && !this.playerMayPass(dd) && Math.abs(P.x - dx) < 30 && P.y > 1.8 * T_ && P.y < 4.2 * T_) add({ kind: 'door', label: 'Locked', door: dd }, 4, Math.abs(P.x - dx));
    }
    out.sort((a, b) => a.prio - b.prio || a.d - b.d);
    // keep one action per kind+person, best first
    const seen = new Set();
    return out.filter(o => { const k = o.kind + (o.p ? o.p.id : o.pr ? o.pr.id : o.key || ''); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  // ------------------------------------------------------------ duties
  checkTicket(p) {
    const run = this.run, S = this.S, T = p.thief;
    const notes = [];
    p.ticketChecked = true; run.tickets++;
    p.dutyT = 8; p.ticketCoverT = 6;
    const routine = run.routine;
    const inRoutine = routine.car === p.car && run.t - routine.t < 25;
    routine.n = inRoutine ? routine.n + 1 : 1; routine.car = p.car; routine.t = run.t;
    const relief = (S.upgrades.cover_punch ? 6 : 4) + Math.min(3, routine.n - 1);
    run.susp = Math.max(0, run.susp - relief);
    if (p.ticket && p.ticket.irregular) { if (addClue(p, 'ticket', 1, p.ticket.irregular, run)) notes.push(p.ticket.irregular); }
    if (T) {
      T.alert = clamp(T.alert + (routine.n >= 2 ? 2 : 8) * this.uni.wary, 0, 100);
      if (T.loot.length) {
        const l = T.loot[0];
        l.known = true;
        const t = `As they reach for the ticket, you see the outline of a ${itemNoun(l.item)} in the ${pocketName(l.pocket)}.`;
        if (addClue(p, 'ticketloot-' + l.item.id, 1, t, run)) notes.push(t);
      }
    }
    // a victim who has noticed their loss tells you about it
    const lost = (p.lostItems || []).filter(l => l.discovered && !l.returned);
    if (lost.length) notes.push(`“Inspector, my ${lost[0].noun} has been stolen!”`);
    this.checkIdentified(p);
    return { notes, routine: routine.n, relief };
  }
  offerRefreshment(p) {
    const run = this.run, T = p.thief;
    p.refreshT = run.t; p.dutyT = 10; p.ticketCoverT = 6; p.observed = true;
    run.susp = Math.max(0, run.susp - 4);
    const notes = [];
    if (T && T.loot.length && this.rng.chance(0.6)) {
      const l = T.loot[0]; l.known = true;
      const t = `Leaning in with the tray, you glimpse a ${itemNoun(l.item)} in the ${pocketName(l.pocket)}.`;
      if (addClue(p, 'tray-' + l.item.id, 1, t, run)) notes.push(t);
    }
    this.checkIdentified(p);
    return { notes };
  }
  helpPassenger(p) {
    const run = this.run;
    const kind = p.needsHelp;
    p.needsHelp = null; p.dutyT = 10;
    run.helped++;
    run.susp = Math.max(0, run.susp - 10);
    if (kind === 'tickets' && run.familyEvent) { run.familyEvent.resolved = true; run.familyHelped = true; }
    p.bubble = kind === 'tickets' ? 'Bless you, Inspector!' : 'Oh, thank you!'; p.bubbleT = 2.5;
    for (const q of run.pax) if (q.car === p.car && !q.staff) q.susp = Math.max(0, q.susp - 25);
    return kind;
  }

  // ------------------------------------------------------------ the double lift
  liftOdds(p) {
    const run = this.run, P = run.player, T = p.thief;
    let watchers = 0;
    for (const q of run.pax) {
      if (q === p || q.left || q.child || q.state === 'hidden' || q.act === 'sleep') continue;
      if (dist(q.x, q.y, P.x, P.y) > 115) continue;
      if (this.sees(q, P.x, P.y) > 0 && q.attn > 0.35 && !(q.distractT > 0)) watchers++;
    }
    let start = p.attn * 30 + watchers * 11 + (T ? T.alert * 0.45 : p.susp * 0.4);
    const busy = T && (T.state === 'eye' || T.state === 'strike' || T.state === 'assist');
    if (busy) start *= 0.3;
    if (p.ticketCoverT > 0) start *= 0.6;
    if (this.sees(p, P.x, P.y) > 0 && p.attn > 0.4 && !busy) start += 14;
    if (run.whistleT > 0) start *= 0.4;
    start = clamp(start, 0, 85);
    const q = start > 55 ? 'bad' : start > 26 ? 'risky' : 'good';
    return { start, watchers, q, busy };
  }
  applyLift(p, res, ctx) {
    const run = this.run, T = p.thief;
    if (res.aborted) {
      if ((res.aw || 0) > 55) { if (T) T.alert = clamp(T.alert + 25, 0, 100); else p.susp = Math.min(99, p.susp + 30); this.bumpSusp(4); return { kind: 'aborted-felt' }; }
      return { kind: 'aborted' };
    }
    if (T) T.interfered++;
    if (!res.success) {
      run.failedLifts++;
      this.bumpSusp(20 + ctx.watchers * 3);
      p.bubble = T ? this.rng.pick(['Oi! Hands off, mister!', 'Here—what’s your game?!']) : this.rng.pick(['Inspector! What on earth—?!', 'How dare you!']);
      p.bubbleT = 3.5; p.act = 'alarmed'; p.actT = 6;
      for (const q of run.pax) if (!q.left && !q.staff && q.car === p.car) { q.glancing = 1.5; q.susp = Math.min(100, q.susp + 25); }
      if (T) {
        T.alert = 100;
        // caught at it: get rid of the goods, or get off the train
        if (T.loot.length && !T.ditched) { T.state = 'idle'; this.spook(p); } else if (!T.bolted) { T.state = 'idle'; this.bolt(p); }
      } else p.susp = 100;
      return { kind: 'failed' };
    }
    const quality = res.quality;
    if (T && ctx.loot && T.loot.includes(ctx.loot)) {
      T.loot = T.loot.filter(l => l !== ctx.loot);
      run.satchel.push({ ...ctx.loot, recoveredT: run.t, from: p.name });
      run.recovered++;
      T.missT = quality === 'critical' ? null : quality === 'clean' ? this.rng.range(25, 50) : this.rng.range(3, 7);
      this.bumpSusp(ctx.watchers * (quality === 'sloppy' ? 6 : 1.5));
      if (!p.identified) addClue(p, 'caught-red-' + ctx.loot.item.id, 3, `Found ${ctx.loot.ownerName}’s ${itemNoun(ctx.loot.item)} in ${p.name}’s ${pocketName(ctx.loot.pocket)}.`, run);
      this.checkIdentified(p);
      return { kind: 'recovered', entry: ctx.loot, quality };
    }
    // nothing stolen in that pocket
    this.bumpSusp(5 + ctx.watchers * 3);
    if (T) { run.emptyLifts++; return { kind: 'empty', quality }; }
    run.falseLifts++;
    p.susp = Math.min(100, p.susp + 20);
    return { kind: 'false', quality };
  }
  applyReturn(p, entry, how, res) {
    const run = this.run;
    const L = (p.lostItems || []).find(l => l.id === entry.item.id);
    const wasDiscovered = !!(L && L.discovered);
    let unaware = !wasDiscovered && how === 'plant' && res && res.success;
    if (how === 'plant' && res && !res.success) {
      this.bumpSusp(14);
      p.bubble = 'Inspector! What are you doing in my—oh! My things!'; p.bubbleT = 3;
    } else if (how === 'plant') {
      run.susp = Math.max(0, run.susp - 2);
      if (wasDiscovered) { p.bubble = 'Oh! It was here all along?'; p.bubbleT = 3; }
    } else {
      run.susp = Math.max(0, run.susp - 6);
      p.bubble = wasDiscovered ? 'My ' + itemNoun(entry.item) + '! Bless you, Inspector!' : 'Good heavens—I hadn’t even noticed!'; p.bubbleT = 3;
      // the thief, if watching, realises the inspector is onto them
      const th = this.paxById.get(entry.stolenBy);
      if (th && th.thief && !th.left && this.sees(th, p.x, p.y) > 0 && dist(th.x, th.y, p.x, p.y) < 220) th.thief.alert = clamp(th.thief.alert + 30, 0, 100);
    }
    run.satchel = run.satchel.filter(e => e !== entry);
    p.items.push(entry.item);
    if (L) L.returned = true;
    if (!(p.lostItems || []).some(l => !l.returned && !l.discovered)) p.discoverT = null;
    p.dutyT = 8;
    const rec = { item: entry.item, owner: p.name, ownerId: p.id, unaware, how, discovered: wasDiscovered, leg: run.leg, vip: !!entry.item.missionItem, t: run.t };
    run.returned.push(rec);
    return rec;
  }
  searchStash(pr) {
    const got = pr.stash || [];
    pr.stash = []; pr.seen = false;
    for (const l of got) { this.run.satchel.push({ ...l, recoveredT: this.run.t, from: 'a hiding place' }); this.run.recovered++; }
    return got;
  }
  blowWhistle() {
    const run = this.run, P = run.player;
    if (run.whistleUsed) return false;
    run.whistleUsed = true; run.whistleT = 10;
    for (const p of run.pax) if (!p.left && p.car === P.car) { p.distractT = 10; p.distractX = p.x; p.distractY = -40; p.glancing = 0; }
    whistle();
    return true;
  }
}
const T_ = T;
