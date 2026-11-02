// LIFT — run simulation (movement, AI, perception, suspicion, events)
import { T, ROWS, FLOOR_H, CELL, GW, addDetective, boardPassengers, makeLook } from './gen.js';
import { TRAINS, ARCHETYPES, ACTIVITY_INFO, OUTFITS, CATEGORIES } from '../data/content.js';
import { clamp, dist, angleDiff, RNG, rand } from '../util.js';
import { carryCapacity } from '../economy.js';
import { sfx, whistle, setTrainSpeed } from '../audio.js';

const DIR_ANG = { r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2 };
const angToDir = a => { const d = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); if (d < Math.PI / 4 || d >= 7 * Math.PI / 4) return 'r'; if (d < 3 * Math.PI / 4) return 'd'; if (d < 5 * Math.PI / 4) return 'l'; return 'u'; };
const ROWC = FLOOR_H / CELL; // 12
const DOOR_R0 = 4, DOOR_R1 = 7; // gangway cell rows

export class Sim {
  constructor(run, S, hooks) {
    this.run = run; this.S = S; this.hooks = hooks;
    this.tr = TRAINS[run.trainId];
    this.rng = new RNG((run.seed ^ 0xabcdef) + Math.floor(run.t * 1000));
    this.cols = Math.ceil(run.worldW / CELL);
    this.buildGrid();
    if (!run.compState) this.initCompState();
    this.paxById = new Map(run.pax.map(p => [p.id, p]));
    this.seatById = new Map();
    for (const c of run.carriages) for (const s of c.seats) this.seatById.set(s.id, s);
    this.propById = new Map();
    for (const c of run.carriages) for (const p of c.props) this.propById.set(p.id, p);
    this.target = null; this.interact = null; this.observeT = 0; this.observeTarget = null;
    this.shake = 0; this.flash = 0;
    this.cap = carryCapacity(S);
    this.footT = 0;
  }

  // ---------- grid & collision ----------
  buildGrid() {
    const run = this.run, cols = this.cols;
    const g = new Uint8Array(cols * ROWC);
    const mark = (x, y, w, h, v = 1) => {
      const c0 = Math.floor((x + 2) / CELL), c1 = Math.floor((x + w - 2) / CELL);
      const r0 = Math.floor((y + 2) / CELL), r1 = Math.floor((y + h - 2) / CELL);
      for (let r = Math.max(0, r0); r <= Math.min(ROWC - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(cols - 1, c1); c++) g[r * cols + c] = v;
    };
    for (const car of run.carriages) {
      for (const p of car.props) for (const s of p.solid) mark(s[0], s[1], s[2], s[3]);
      // end walls
      for (const ex of [car.x0, car.x0 + car.w]) {
        const c = Math.floor(ex / CELL);
        for (let r = 0; r < ROWC; r++) if (r < DOOR_R0 || r > DOOR_R1) { if (c - 1 >= 0) g[r * cols + c - 1] = 1; if (c < cols) g[r * cols + c] = 1; }
      }
    }
    // gangways
    for (const d of run.doors) {
      const c0 = Math.floor(d.x0 / CELL), c1 = Math.floor((d.x1 - 1) / CELL);
      for (let c = c0; c <= c1; c++) for (let r = 0; r < ROWC; r++) if (r < DOOR_R0 || r > DOOR_R1) g[r * cols + c] = 1;
      d.cell = c1;
    }
    // train ends
    for (let r = 0; r < ROWC; r++) { g[r * cols] = 1; g[r * cols + cols - 1] = 1; }
    this.grid = g;
  }
  initCompState() {
    const cs = {};
    for (const car of this.run.carriages) for (const p of car.props) if (p.kind === 'cdoor') cs[p.car + ':' + p.comp] = { open: 0, locked: false, forced: false, rect: p.doorRect };
    this.run.compState = cs;
  }
  cellAt(x, y) { return [Math.floor(x / CELL), Math.floor(y / CELL)]; }
  solidCell(c, r, who) {
    if (c < 0 || r < 0 || c >= this.cols || r >= ROWC) return true;
    if (this.grid[r * this.cols + c]) return true;
    // dynamic: gangway doors
    for (const d of this.run.doors) if (d.cell === c && r >= DOOR_R0 && r <= DOOR_R1) {
      if (d.locked && !(who && who.staff) && !(who === 'player' && this.playerMayPass(d))) return true;
    }
    // compartment doors
    if (r === 7) {
      for (const k in this.run.compState) {
        const s = this.run.compState[k];
        if (s.locked && !(who && who.staff)) {
          const R = s.rect;
          const c0 = Math.floor((R[0] + 2) / CELL), c1 = Math.floor((R[0] + R[2] - 2) / CELL);
          if (c >= c0 && c <= c1) { if (who === 'player' && this.playerOutfit().access.includes('baggage') && this.run.player.outfit === 'conductor') return false; return true; }
        }
      }
    }
    return false;
  }
  blockedAt(x, y, rad, who) {
    for (const [ox, oy] of [[-rad, -rad], [rad, -rad], [-rad, rad], [rad, rad], [0, -rad], [0, rad], [-rad, 0], [rad, 0]]) {
      const [c, r] = this.cellAt(x + ox, y + oy);
      if (this.solidCell(c, r, who)) return true;
    }
    return false;
  }
  playerOutfit() { return OUTFITS[this.run.player.outfit] || OUTFITS.tweed; }
  playerMayPass(d) {
    const next = this.run.carriages[d.between[1]];
    if (d.forced) return true;
    if (next.type === 'baggage') return this.playerOutfit().access.includes('baggage') || this.S.milestones.baggage_open;
    if (next.type === 'vault') return false;
    return false;
  }
  carAt(x) {
    for (const c of this.run.carriages) if (x >= c.x0 && x < c.x0 + c.w) return c;
    return null;
  }
  gangAt(x) { return this.run.doors.find(d => x >= d.x0 && x < d.x1) || null; }

  // ---------- pathfinding (A*) ----------
  nearestFree(x, y, who) {
    let [c, r] = this.cellAt(x, y);
    if (!this.solidCell(c, r, who)) return [c, r];
    for (let rad = 1; rad < 8; rad++) {
      let best = null, bd = 1e9;
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const cc = c + dc, rr = r + dr;
        if (!this.solidCell(cc, rr, who)) { const dd = Math.abs(dr) * 1.2 + Math.abs(dc); if (dd < bd) { bd = dd; best = [cc, rr]; } }
      }
      if (best) return best;
    }
    return [c, r];
  }
  findPath(x0, y0, x1, y1, who) {
    const [sc, sr] = this.nearestFree(x0, y0, who), [ec, er] = this.nearestFree(x1, y1, who);
    const cols = this.cols;
    const minC = Math.max(0, Math.min(sc, ec) - 40), maxC = Math.min(cols - 1, Math.max(sc, ec) + 40);
    const W = maxC - minC + 1;
    const idx = (c, r) => r * W + (c - minC);
    const N = W * ROWC;
    const gS = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const open = [];
    const h = (c, r) => Math.abs(c - ec) + Math.abs(r - er);
    gS[idx(sc, sr)] = 0; open.push([h(sc, sr), sc, sr]);
    let found = false, iter = 0;
    while (open.length && iter++ < 6000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, c, r] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      const ci = idx(c, r);
      if (closed[ci]) continue; closed[ci] = 1;
      if (c === ec && r === er) { found = true; break; }
      for (const [dc, dr, cost] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.42], [-1, 1, 1.42], [1, -1, 1.42], [-1, -1, 1.42]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < minC || nc > maxC || nr < 0 || nr >= ROWC) continue;
        if (this.solidCell(nc, nr, who)) continue;
        if (dc && dr && (this.solidCell(c + dc, r, who) || this.solidCell(c, r + dr, who))) continue;
        const ni = idx(nc, nr);
        const ng = gS[ci] + cost + (nr <= 1 || nr >= 10 ? 0.4 : 0);
        if (ng < gS[ni]) { gS[ni] = ng; came[ni] = ci; open.push([ng + h(nc, nr), nc, nr]); }
      }
    }
    if (!found) return null;
    const pts = [];
    let ci = idx(ec, er);
    while (ci !== -1) { const r = Math.floor(ci / W), c = (ci % W) + minC; pts.push([c * CELL + CELL / 2, r * CELL + CELL / 2]); ci = came[ci]; }
    pts.reverse();
    // simplify: keep every 2nd point + last
    const out = [];
    for (let i = 1; i < pts.length; i++) if (i % 2 === 0 || i === pts.length - 1) out.push(pts[i]);
    return out;
  }

  // ---------- main update ----------
  update(dt, input) {
    const run = this.run;
    run.t += dt;
    this.updateJourney(dt);
    this.updatePlayer(dt, input);
    for (const p of run.pax) this.updatePax(p, dt);
    this.updateDoors(dt);
    this.updateHeat(dt);
    this.updateEvents(dt);
    this.updateInteract(dt, input);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2);
    if (run.alibiT > 0) run.alibiT -= dt;
    if (run.toastQ && run.toastQ.length) { for (const m of run.toastQ) this.hooks.toast(m.text, m.kind); run.toastQ.length = 0; }
  }

  // ---------- journey: legs, stations, jolts, tunnels ----------
  updateJourney(dt) {
    const run = this.run, tr = this.tr;
    let speed = 1;
    if (run.phase === 'moving') {
      run.legT += dt;
      if (run.legT >= tr.legTime) { run.phase = 'arriving'; run.phaseT = 0; whistle(); this.hooks.toast(`Approaching ${tr.stations[run.leg + 1]}`, 'info'); }
      // jolts
      run.nextJolt -= dt;
      if (run.nextJolt < 3 && !run.joltWarned && this.S.milestones.tunnel_warn) { run.joltWarned = true; this.hooks.toast('Curve ahead—a jolt is coming', 'tip'); }
      if (run.nextJolt <= 0) { run.joltT = 1.6; run.nextJolt = this.rng.range(16, 30); run.joltWarned = false; this.shake = 0.6; sfx.jolt(); }
      // tunnels
      const key = 'L' + run.leg;
      if (!run.tunnelDone[key] && run.legT > tr.legTime * 0.45 && run.legT < tr.legTime * 0.5) {
        run.tunnelDone[key] = true;
        if (this.rng.chance(0.65)) { run.tunnelPending = 2.6; whistle(); if (this.S.milestones.tunnel_warn) this.hooks.toast('Tunnel ahead—darkness in moments', 'tip'); }
      }
      if (run.tunnelPending > 0) { run.tunnelPending -= dt; if (run.tunnelPending <= 0) { run.tunnelT = 9; sfx.tunnel(); this.hooks.toast('Darkness! The train plunges into a tunnel.', 'event'); } }
    } else if (run.phase === 'arriving') {
      run.phaseT += dt; speed = Math.max(0, 1 - run.phaseT / 4);
      if (run.phaseT >= 4) this.arriveStation();
    } else if (run.phase === 'station') {
      speed = 0; run.stationT -= dt;
      if (run.stationT <= 0) { run.phase = 'departing'; run.phaseT = 0; whistle(); this.hooks.toast('All aboard! The train departs.', 'info'); }
    } else if (run.phase === 'departing') {
      run.phaseT += dt; speed = Math.min(1, run.phaseT / 4);
      if (run.phaseT >= 4) { run.phase = 'moving'; run.legT = 0; }
    }
    if (run.joltT > 0) run.joltT -= dt;
    if (run.tunnelT > 0) run.tunnelT -= dt;
    run.speed = speed;
    run.dist = (run.dist || 0) + speed * 900 * dt;
    if (run.phase === 'station') run.stationSlide = run.stationSlide || 0;
    else if (run.phase === 'arriving') run.stationSlide = (1 - Math.min(1, run.phaseT / 4)) * 400;
    else if (run.phase === 'departing') run.stationSlide = -run.phaseT * run.phaseT * 30;
    setTrainSpeed(speed);
  }

  arriveStation() {
    const run = this.run, tr = this.tr;
    run.leg++;
    run.phase = 'station'; run.stationT = 15; run.stationSlide = 0;
    const st = tr.stations[run.leg];
    if (run.leg >= tr.legs) { this.hooks.toast(`${st} — end of the line.`, 'event'); this.hooks.end('arrived'); return; }
    this.hooks.toast(`${st}. Doors open for 15 seconds—step off at a gangway if you wish.`, 'event');
    // heat relief
    const relief = 14 + (this.S.milestones.urchins ? run.heat * 0.1 : 0);
    run.heat = Math.max(0, run.heat - relief);
    // passengers disembark
    const leavers = this.rng.shuffle(run.pax.filter(p => p.state === 'seated' && !p.staff && !p.child && !p.left && !p.vip)).slice(0, this.rng.int(1, 3));
    for (const p of leavers) {
      if (p.familyChild) { const ch = this.paxById.get(p.familyChild); if (ch) this.leave(ch); }
      this.leave(p);
      if (p.robbed.length && p.discoverT != null) { run.log.push(`${p.name} stepped off at ${st}, none the wiser.`); }
    }
    // family thrown off if not helped
    if (run.familyEvent && !run.familyHelped && !run.familyEvent.resolved) {
      const fam = this.paxById.get(run.familyEvent.id);
      if (fam) { this.leave(fam); this.hooks.toast(`The conductor puts the ${fam.name.split(' ').pop()} family off the train.`, 'warn'); run.familyEvent.resolved = true; }
    }
    // boarding
    const newcomers = boardPassengers(run, this.S, this.rng.int(1, 3), this.rng);
    for (const p of newcomers) {
      this.paxById.set(p.id, p);
      const seat = this.seatById.get(p.seat);
      const g = this.nearestGangway(seat.x);
      p.x = g; p.y = 3 * T; p.car = seat.car; p.state = 'walk'; p.act = 'walk';
      p.path = this.findPath(p.x, p.y, seat.x, seat.y, p);
      p.walkTarget = { kind: 'seat', seat: seat.id };
      if (this.S.notoriety >= 3 && this.rng.chance(Math.min(0.5, this.S.notoriety * 0.06))) { p.susp = 45; p.recognizes = true; p.aware = Math.min(1, p.aware + 0.25); this.hooks.toast('A face from a past train boards. They may recognise you.', 'warn'); }
    }
    // detective may board
    if (run.heat >= 45 || (this.rng.chance(0.2) && this.S.notoriety >= 2)) {
      const d = addDetective(run, this.rng, this.S, true);
      if (d) { this.paxById.set(d.id, d); d.x = this.nearestGangway(run.player.x); this.hooks.toast('Inspector Hollis boards the train.', 'danger'); sfx.warn(); }
    }
  }
  nearestGangway(x) {
    let best = this.run.doors[0], bd = 1e9;
    for (const d of this.run.doors) { const dd = Math.abs((d.x0 + d.x1) / 2 - x); if (dd < bd) { bd = dd; best = d; } }
    return best ? (best.x0 + best.x1) / 2 : x;
  }
  leave(p) {
    const seat = p.seat && this.seatById.get(p.seat);
    p.state = 'leaving'; p.act = 'walk';
    p.path = this.findPath(p.x, p.y, this.nearestGangway(p.x), 3 * T, p);
    if (seat && seat.occ === p.id) seat.occ = null;
    p.seat = null;
  }

  // ---------- player ----------
  updatePlayer(dt, input) {
    const P = this.run.player;
    if (P.hidden) { P.moving = false; return; }
    let { mx, my, hurry } = input;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    const sp = (hurry ? 104 : 64) * (this.run.joltT > 0 ? 0.8 : 1);
    P.moving = m > 0.08;
    P.hurry = P.moving && hurry;
    if (P.moving) {
      const vx = mx * sp * Math.min(1, m * 1.4), vy = my * sp * Math.min(1, m * 1.4);
      const nx = P.x + vx * dt, ny = P.y + vy * dt;
      if (!this.blockedAt(nx, P.y, 6, 'player')) P.x = nx;
      else if (!this.blockedAt(nx, P.y - 4, 6, 'player') && vy <= 0) { P.x = nx; P.y -= 40 * dt; }
      else if (!this.blockedAt(nx, P.y + 4, 6, 'player') && vy >= 0) { P.x = nx; P.y += 40 * dt; }
      if (!this.blockedAt(P.x, ny, 6, 'player')) P.y = ny;
      P.dir = Math.abs(mx) > Math.abs(my) * 0.8 ? (mx > 0 ? 'r' : 'l') : (my > 0 ? 'd' : 'u');
      P.walkPhase += dt * (hurry ? 14 : 9.5);
      this.footT -= dt;
      if (this.footT <= 0) { sfx.step(); this.footT = hurry ? 0.22 : 0.34; }
      // soft push from standing NPCs
      for (const p of this.run.pax) {
        if (p.state === 'seated' || p.left || p.state === 'hidden') continue;
        const d = dist(P.x, P.y, p.x, p.y);
        if (d < 12 && d > 0.01) { const k = (12 - d) / d; const ox = P.x + (P.x - p.x) * k, oy = P.y + (P.y - p.y) * k; if (!this.blockedAt(ox, oy, 6, 'player')) { P.x = ox; P.y = oy; } }
      }
    }
    const car = this.carAt(P.x);
    if (car && car.idx !== P.car) { P.car = car.idx; this.hooks.enterCarriage && this.hooks.enterCarriage(car); }
    P.inGang = !car;
    // inside a compartment?
    P.comp = null;
    if (car && (car.type === 'compartment' || car.type === 'sleeper') && P.y < 3.6 * T) {
      const ci = Math.floor((P.x - car.x0) / (4 * T));
      P.comp = car.idx + ':c' + ci;
    }
  }

  // ---------- passenger AI ----------
  attnOf(p) {
    const run = this.run;
    const ai = ACTIVITY_INFO[p.act] || ACTIVITY_INFO.idle;
    let a = ai.attn * (0.55 + p.aware * 0.9);
    const lvl = Math.floor(run.heat / 25);
    a *= [1, 1.15, 1.3, 1.55][Math.min(3, lvl)];
    if (p.glancing > 0) a = Math.max(a, 0.92);
    if (p.distractT > 0) a *= 0.15;
    if (run.joltT > 0) a *= 0.45;
    if (run.tunnelT > 0) a *= 0.22;
    if (run.incidentT > 0 && p.car === run.incidentCar) a *= 0.1;
    if (p.susp > 50) a = Math.max(a, 0.5 + p.susp / 250);
    return clamp(a, 0, 1);
  }
  faceAngle(p) {
    if (p.distractT > 0) return Math.atan2(p.distractY - p.y, p.distractX - p.x);
    return DIR_ANG[p.dir] ?? Math.PI / 2;
  }
  coneHalf(p) {
    if (p.act === 'sleep') return 0.2;
    let h = p.staff ? 1.15 : 0.95;
    if (p.glancing > 0) h += 0.6;
    return h;
  }
  coneRange(p) {
    let r = p.staff === 'detective' ? 170 : p.staff ? 140 : 120;
    if (this.tr.time === 'night') r *= 0.75;
    if (this.run.tunnelT > 0) r *= 0.4;
    return r;
  }
  sees(p, x, y) {
    const d = dist(p.x, p.y - 8, x, y - 8);
    if (d > this.coneRange(p)) return 0;
    if (d < 20 && p.act !== 'sleep') return 0.8;
    const ang = Math.atan2(y - p.y, x - p.x);
    if (Math.abs(angleDiff(this.faceAngle(p), ang)) > this.coneHalf(p)) return 0;
    // walls: different carriage => no
    const cp = this.carAt(p.x), cx = this.carAt(x);
    if (cp !== cx) return 0;
    // compartment glass: from corridor into compartment visible but reduced
    return 1 - d / this.coneRange(p);
  }

  updatePax(p, dt) {
    const run = this.run, P = run.player;
    if (p.left) return;
    p.t = (p.t || 0) + dt;
    if (p.bubbleT > 0) p.bubbleT -= dt;
    if (p.distractT > 0) p.distractT -= dt;
    if (p.stirWarn > 0) p.stirWarn -= dt;
    // glances
    if (p.glancing > 0) p.glancing -= dt;
    else {
      p.glanceT -= dt;
      if (p.glanceT <= 0.6 && p.glanceT + dt > 0.6) p.stirWarn = 0.6;
      if (p.glanceT <= 0) {
        const ai = ACTIVITY_INFO[p.act] || ACTIVITY_INFO.idle;
        p.glancing = this.rng.range(0.7, 1.3) * (ai.stir > 0.5 ? 1 : 0.6);
        p.glanceT = this.rng.range(5, 13) / Math.max(0.2, ai.stir) * (1.2 - p.aware * 0.5);
      }
    }
    p.attn = this.attnOf(p);

    // discovery of theft
    if (p.discoverT != null && !p.staff) {
      let rate = 1;
      if (p.act === 'sleep') rate = 0.4;
      if (run.tunnelT > 0) rate = 0;
      if (p.act === 'watch' && p.robbed.some(r => r.cat === 'watch' || r.cat === 'wristwatch')) rate = 30;
      if (p.act === 'eat' && p.robbed.some(r => r.cat === 'wallet')) rate = 3;
      p.discoverT -= dt * rate;
      if (p.discoverT <= 0) { p.discoverT = null; this.discover(p); }
    }

    // state machine
    if (p.staff === 'conductor' || p.staff === 'detective') this.updateSecurity(p, dt);
    else if (p.staff === 'guard' || p.staff === 'porter' || p.bartender) this.updateStander(p, dt);
    else this.updateCivilian(p, dt);

    // perception of the player
    this.perceive(p, dt);
  }

  walkAlong(p, dt, speedMul = 1) {
    if (!p.path || !p.path.length) return true;
    const [tx, ty] = p.path[0];
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    const sp = p.speed * speedMul * (this.run.joltT > 0 ? 0.6 : 1);
    if (d < sp * dt + 1) { p.x = tx; p.y = ty; p.path.shift(); }
    else { p.x += dx / d * sp * dt; p.y += dy / d * sp * dt; }
    if (d > 0.5) p.dir = angToDir(Math.atan2(dy, dx));
    p.walkPhase += dt * 9;
    const car = this.carAt(p.x); if (car) p.car = car.idx;
    return !p.path.length;
  }

  updateCivilian(p, dt) {
    const run = this.run;
    if (p.state === 'seated') {
      p.actT -= dt;
      if (p.act === 'argue' || p.act === 'watchshow' || p.act === 'alarmed') { if (p.actT <= 0) { p.act = 'idle'; p.actT = 2; } return; }
      if (p.actT <= 0) {
        // maybe take a walk
        const walkers = run.pax.filter(q => q.state === 'walk' && !q.staff).length;
        const away = p.home && p.seat !== p.home.seat;
        if (away && this.rng.chance(0.6)) { this.goToSeat(p, p.home.seat); return; }
        if (!p.child && walkers < 3 && this.rng.chance(0.09 + (p.cls === 'upper' ? 0.04 : 0)) && run.phase === 'moving') { if (this.planTrip(p)) return; }
        this.chooseActivity(p);
      }
    } else if (p.state === 'walk') {
      if (this.walkAlong(p, dt)) {
        const wt = p.walkTarget;
        if (wt && wt.kind === 'seat') {
          const seat = this.seatById.get(wt.seat);
          if (seat && (!seat.occ || seat.occ === p.id)) { seat.occ = p.id; p.seat = seat.id; p.x = seat.x; p.y = seat.y; p.dir = seat.dir; p.state = 'seated'; p.lie = !!seat.lie; this.chooseActivity(p); p.actT = this.rng.range(15, 40); }
          else { p.state = 'seated'; this.goToSeat(p, p.home.seat); }
        } else if (wt && wt.kind === 'lav') { p.state = 'hidden'; p.hideT = this.rng.range(6, 12); }
        else if (wt && wt.kind === 'spot') { p.state = 'stand'; p.post = { x: p.x, y: p.y }; p.act = this.rng.pick(['talk', 'drink', 'window']); p.actT = this.rng.range(15, 30); p.dir = this.rng.pick(['d', 'l', 'r']); }
        else { p.state = 'stand'; p.actT = 4; }
      }
    } else if (p.state === 'hidden') {
      p.hideT -= dt; if (p.hideT <= 0) this.goToSeat(p, p.home ? p.home.seat : null);
    } else if (p.state === 'stand') {
      p.actT -= dt;
      if (p.act === 'argue' || p.act === 'watchshow' || p.act === 'alarmed') { if (p.actT <= 0) { p.act = 'talk'; p.actT = 6; } return; }
      if (p.actT <= 0) { if (p.home) this.goToSeat(p, p.home.seat); else { p.act = this.rng.pick(['talk', 'drink', 'window']); p.actT = this.rng.range(10, 25); if (this.rng.chance(0.3)) p.dir = this.rng.pick(['l', 'r', 'd']); } }
    } else if (p.state === 'leaving') {
      if (this.walkAlong(p, dt)) { p.left = true; }
    } else if (p.state === 'perform') {
      p.actT -= dt; p.dir = 'd';
      if (p.actT <= 0) { if (p.home) this.goToSeat(p, p.home.seat); else p.state = 'stand'; p.act = 'idle'; }
    }
  }
  chooseActivity(p) {
    const A = ARCHETYPES[p.arch];
    const seat = p.seat && this.seatById.get(p.seat);
    const comp = seat && this.run.pax.find(q => q !== p && q.seat && this.seatById.get(q.seat) && this.seatById.get(q.seat).group === seat.group && q.state === 'seated' && q.act !== 'sleep' && !q.left);
    const opts = [];
    for (const k in A.acts) {
      let w = A.acts[k];
      if (k === 'talk' && !comp) w = 0;
      if (k === 'cards' && !(seat && seat.cards) && !comp) w = 0;
      if (k === 'eat' && seat && seat.kind !== 'dining') w *= 0.3;
      if (k === 'inspect' && !(seat && (seat.kind === 'cseat' || seat.kind === 'bench'))) w *= 0.3;
      if (k === 'sleep' && this.tr.time === 'night') w *= 4;
      if (k === 'window' && seat && seat.kind === 'stool') w = 0;
      opts.push({ k, w });
    }
    if (seat && seat.cards) opts.push({ k: 'cards', w: 6 });
    if (seat && seat.kind === 'dining') opts.push({ k: 'eat', w: 4 }, { k: 'drink', w: 2 });
    if (seat && seat.bar) opts.push({ k: 'drink', w: 6 });
    if (p.child) { opts.length = 0; opts.push({ k: 'window', w: 3 }, { k: 'sleep', w: 1 }, { k: 'idle', w: 1 }); }
    opts.push({ k: 'idle', w: 1 });
    const pick = this.rng.weighted(opts).k;
    p.act = pick;
    p.actT = pick === 'watch' ? this.rng.range(2.5, 4) : pick === 'sleep' ? this.rng.range(30, 70) : this.rng.range(9, 24);
    if (seat && seat.lie) p.lie = pick === 'sleep' || this.tr.time === 'night';
    if (pick === 'talk' && comp) { comp.act = 'talk'; comp.actT = p.actT; }
  }
  planTrip(p) {
    const run = this.run;
    const r = this.rng.next();
    const myCar = run.carriages[p.car];
    if (r < 0.5) {
      // dining / lounge seat in another carriage
      const targets = run.carriages.filter(c => (c.type === 'dining' || c.type === 'lounge' || c.type === 'salon') && c.idx !== p.car);
      if (!targets.length) return false;
      const c = this.rng.pick(targets);
      const seat = this.rng.pick(c.seats.filter(s => !s.occ));
      if (!seat) return false;
      this.goToSeat(p, seat.id);
      return true;
    } else if (r < 0.75) {
      const lav = myCar.props.find(pr => pr.kind === 'lav');
      if (!lav) return false;
      this.vacate(p);
      p.path = this.findPath(p.x, p.y, lav.x + lav.w + 8, lav.y + T, p); p.state = 'walk'; p.act = 'walk'; p.walkTarget = { kind: 'lav' };
      return !!p.path;
    } else {
      const spots = run.carriages.flatMap(c => c.spots.filter(s => s.kind === 'stand'));
      if (!spots.length) return false;
      const s = this.rng.pick(spots);
      this.vacate(p);
      p.path = this.findPath(p.x, p.y, s.x, s.y, p); p.state = 'walk'; p.act = 'walk'; p.walkTarget = { kind: 'spot' };
      return !!p.path;
    }
  }
  vacate(p) {
    const seat = p.seat && this.seatById.get(p.seat);
    if (seat && seat.occ === p.id && (!p.home || p.home.seat !== seat.id)) seat.occ = null;
    p.seat = null; p.lie = false;
    // home seat stays reserved
  }
  goToSeat(p, seatId) {
    if (!seatId) { p.state = 'stand'; return; }
    const seat = this.seatById.get(seatId);
    this.vacate(p);
    if (!seat) return;
    if (!seat.occ) seat.occ = p.id;
    const path = this.findPath(p.x, p.y, seat.x, seat.y, p);
    if (!path) { p.x = seat.x; p.y = seat.y; p.state = 'seated'; p.seat = seat.id; p.dir = seat.dir; return; }
    p.path = path; p.state = 'walk'; p.act = 'walk'; p.walkTarget = { kind: 'seat', seat: seatId };
  }

  updateStander(p, dt) {
    if (p.state === 'walk') { if (this.walkAlong(p, dt)) { p.state = 'stand'; } return; }
    p.actT = (p.actT || 5) - dt;
    if (p.actT <= 0) {
      p.actT = this.rng.range(4, 10);
      if (p.staff === 'guard') p.dir = this.rng.pick(['l', 'r', 'd']);
      else if (p.bartender) { p.dir = 'd'; p.act = this.rng.pick(['idle', 'inspect']); }
      else if (p.staff === 'porter' && p.post && this.rng.chance(0.4)) {
        const car = this.run.carriages[p.car];
        const tx = clamp(p.post.x + this.rng.range(-80, 80), car.x0 + 30, car.x0 + car.w - 30);
        p.path = this.findPath(p.x, p.y, tx, this.rng.range(2.2, 3.8) * T, p); if (p.path) p.state = 'walk';
      } else p.dir = this.rng.pick(['l', 'r', 'd', 'u']);
    }
  }

  // ---------- security ----------
  updateSecurity(p, dt) {
    const run = this.run, P = run.player;
    const det = p.staff === 'detective';
    const lvl = Math.floor(run.heat / 25);
    const slow = this.S.milestones.slow_conductors ? 0.75 : 1;
    switch (p.state) {
      case 'patrol': {
        p.act = 'patrol';
        if (p.stopT > 0) { p.stopT -= dt; if (p.stopT <= 0) p.dir = p.patrolDir > 0 ? 'r' : 'l'; return; }
        if (!p.path || !p.path.length) {
          // pick next waypoint: next carriage in patrol direction
          const cars = run.carriages.filter(c => c.type !== 'vault');
          let ci = cars.findIndex(c => c.idx === p.car);
          if (ci < 0) ci = 0;
          let ni = ci + p.patrolDir;
          if (ni < 0 || ni >= cars.length) { p.patrolDir *= -1; ni = ci + p.patrolDir; }
          const c = cars[clamp(ni, 0, cars.length - 1)];
          const tx = c.x0 + this.rng.range(0.25, 0.75) * c.w;
          const ty = (c.type === 'compartment' || c.type === 'sleeper') ? 5 * T : this.rng.range(2.3, 3.7) * T;
          p.path = this.findPath(p.x, p.y, tx, ty, p);
          if (!p.path) { p.patrolDir *= -1; return; }
          p.stopT = 0;
          if (this.rng.chance(0.5)) { p.pendingStop = this.rng.range(2, 5); }
        }
        const sp = (det ? 0.8 : 1) * (lvl >= 2 ? 1.2 : 1) * slow;
        if (this.walkAlong(p, dt, sp) && p.pendingStop) { p.stopT = p.pendingStop; p.pendingStop = 0; p.dir = 'd'; }
        // lockdown: post at gangway
        if (lvl >= 3 && !det && !p.posted && run.lastAlarmX != null) {
          const gx = this.nearestGangway(run.lastAlarmX + (p.patrolDir > 0 ? 300 : -300));
          if (!run.pax.some(q => q !== p && q.posted && Math.abs(q.post.x - gx) < 20)) {
            p.posted = true; p.post = { x: gx, y: 3 * T }; p.path = this.findPath(p.x, p.y, gx, 3 * T, p); p.state = 'post';
            this.hooks.toast('A conductor takes up a post at a gangway, searching all who pass.', 'warn');
          }
        }
        break;
      }
      case 'respond': {
        p.act = 'investigate';
        if (this.walkAlong(p, dt, 1.35 * slow)) { p.state = 'investigate'; p.actT = 4; p.bubble = det ? 'Tell me everything.' : 'Calm yourself—what was taken?'; p.bubbleT = 3; }
        break;
      }
      case 'investigate': {
        p.actT -= dt; p.dir = 'd';
        if (p.actT <= 0) { p.state = 'hunt'; p.huntT = det ? 40 : 22; p.path = null; }
        break;
      }
      case 'hunt': {
        p.act = 'investigate';
        p.huntT -= dt;
        if (!p.path || !p.path.length) {
          const car = run.carriages[p.car] || run.carriages[0];
          const nc = run.carriages[clamp(p.car + this.rng.int(-1, 1), 0, run.carriages.length - 1)];
          const c = nc.type === 'vault' ? car : nc;
          p.path = this.findPath(p.x, p.y, c.x0 + this.rng.range(0.2, 0.8) * c.w, this.rng.range(2.3, 3.7) * T, p);
        }
        this.walkAlong(p, dt, 1.05 * slow);
        if (p.huntT <= 0) p.state = 'patrol';
        break;
      }
      case 'approach': {
        p.act = 'investigate';
        p.repathT = (p.repathT || 0) - dt;
        if (p.repathT <= 0 || !p.path || !p.path.length) { p.path = this.findPath(p.x, p.y, P.x, P.y, p); p.repathT = 0.6; }
        this.walkAlong(p, dt, 1.3 * slow);
        if (dist(p.x, p.y, P.x, P.y) < 26 && !P.hidden) { p.state = 'searching'; this.hooks.search(p, p.searchReason || 'suspicion'); }
        if (P.hidden || p.approachT-- < -400) { p.state = 'hunt'; p.huntT = 15; }
        break;
      }
      case 'chase': {
        p.act = 'alarmed';
        p.repathT = (p.repathT || 0) - dt;
        if (p.repathT <= 0 || !p.path || !p.path.length) { p.path = this.findPath(p.x, p.y, P.x, P.y, p); p.repathT = 0.4; }
        const sp = (this.S.upgrades.net_route ? 1.45 : 2.05) * slow;
        this.walkAlong(p, dt, sp);
        p.chaseT -= dt;
        const seen = this.sees(p, P.x, P.y) > 0;
        if (seen) p.lostT = 0; else p.lostT = (p.lostT || 0) + dt;
        if (!P.hidden && dist(p.x, p.y, P.x, P.y) < 18) { p.state = 'patrol'; this.hooks.chaseCaught(p); }
        else if (P.hidden || p.lostT > 5 || p.chaseT <= 0) { p.state = 'hunt'; p.huntT = 20; this.hooks.chaseEscaped(p); }
        break;
      }
      case 'post': {
        if (p.path && p.path.length) this.walkAlong(p, dt, 1.2);
        else { p.dir = 'd'; p.act = 'patrol'; }
        if (!P.hidden && dist(p.x, p.y, P.x, P.y) < 30 && P.outfit !== 'conductor' && !p.searchedRecently) { p.state = 'searching'; p.searchedRecently = 30; this.hooks.search(p, 'checkpoint'); }
        if (p.searchedRecently > 0) p.searchedRecently -= dt;
        if (lvl < 3) { p.posted = false; p.state = 'patrol'; }
        break;
      }
      case 'searching': p.dir = angToDir(Math.atan2(P.y - p.y, P.x - p.x)); break;
      case 'cooldown': p.actT -= dt; if (p.actT <= 0) p.state = 'patrol'; break;
      default: p.state = 'patrol';
    }
  }

  // Player matches the circulating description?
  matchesDesc() {
    const d = this.run.desc, P = this.run.player;
    if (!d) return false;
    return d.outfit === P.outfit && d.variant === (P.variant || 0);
  }
  inForbidden() {
    const P = this.run.player, car = this.carAt(P.x);
    if (!car) return false;
    const acc = this.playerOutfit().access;
    if (car.cls === 'first' && !acc.includes('first') && this.tr.playerClass !== 'first') return true;
    if (car.cls === 'sleeper' && !acc.includes('sleeper') && this.tr.playerClass !== 'sleeper') return true;
    if (car.cls === 'baggage' && !acc.includes('baggage')) return true;
    if (car.cls === 'vault') return true;
    if (P.comp && P.comp !== this.run.playerComp) return true;
    return false;
  }

  perceive(p, dt) {
    const run = this.run, P = run.player;
    if (P.hidden || p.state === 'hidden' || p.left || p.child) { p.susp = Math.max(0, p.susp - 8 * dt); return; }
    const vis = this.sees(p, P.x, P.y);
    const d = dist(p.x, p.y, P.x, P.y);
    if (vis > 0 && p.attn > 0.1) {
      p.lastSawPlayer = run.t; p.sawOutfit = P.outfit; p.sawVariant = P.variant || 0;
      const outfit = this.playerOutfit();
      const trustK = outfit.trust[p.cls] ?? 1;
      let trustMod = trustK;
      if (p.cls === 'working' && this.S.milestones.trust_working) trustMod *= 0.65;
      if (p.cls === 'upper' && this.S.sets.season) trustMod *= 0.85;
      if (p.staff) {
        // security only grows suspicion with cause
        let cause = 0;
        if (this.matchesDesc()) cause += 2.2;
        if (this.inForbidden()) cause += 1.6;
        if (P.hurry) cause += 0.7;
        if (run.heat >= 50) cause += 0.4;
        if (p.staff === 'detective') { cause += 0.25 + this.S.notoriety * (this.S.upgrades.disguise_faces ? 0.03 : 0.12) + (P.outfit === 'conductor' ? 0.6 : 0); }
        if (run.alibiT > 0) cause *= 0.3;
        p.susp += cause * vis * p.attn * 26 * dt * (OUTFITS[P.outfit].detective && p.staff === 'detective' ? OUTFITS[P.outfit].detective : 1);
        if (p.susp >= 100 && (p.state === 'patrol' || p.state === 'hunt')) {
          p.state = 'approach'; p.path = null; p.approachT = 0; p.searchReason = this.inForbidden() && !this.matchesDesc() ? 'trespass' : 'suspicion';
          p.bubble = p.searchReason === 'trespass' ? 'You there! Ticket, please.' : 'A word, sir.'; p.bubbleT = 2.5;
          sfx.warn();
        }
      } else {
        const near = d < 60 ? 1 : d < 90 ? 0.45 : 0.15;
        let rate = p.attn * vis * near * trustMod;
        if (P.hurry) rate *= 1.7;
        if (P.comp && P.comp !== run.playerComp && p.home && P.comp === p.car + ':' + p.home.comp) rate *= 2.5;
        if (this.observeTarget === p && this.observeT > 0) rate *= 2.2;
        if (p.recognizes) rate *= 1.8;
        p.susp += rate * 24 * dt;
        if (p.susp >= 100 && !p.reported) this.confront(p);
      }
    } else {
      p.susp = Math.max(0, p.susp - (p.staff ? 3 : 6) * dt);
      if (p.susp < 40) p.reported = false;
    }
    p.susp = clamp(p.susp, 0, 110);
  }

  confront(p) {
    const run = this.run;
    p.reported = true;
    p.bubble = this.rng.pick(['What are you about, sir?', 'I’ve got my eye on you.', 'Conductor! This man is lurking!', 'Keep your distance!']);
    p.bubbleT = 3;
    p.mood = 1;
    this.raiseHeat(8, p.car, p.x);
    run.desc = { outfit: run.player.outfit, variant: run.player.variant || 0, t: run.t };
    this.hooks.toast(`${p.name} is suspicious and describes you to the staff.`, 'warn');
    sfx.warn();
    this.dispatch(p.x, p.y, p.car, false);
  }

  discover(p) {
    const run = this.run;
    const r = p.robbed[p.robbed.length - 1];
    const what = r ? (r.cat === 'wallet' ? 'wallet' : CATEGORIES[r.cat] ? CATEGORIES[r.cat].single.toLowerCase() : 'valuables') : 'valuables';
    p.bubble = this.rng.pick([`My ${what}! Thief!`, `Where is my ${what}?!`, `I’ve been robbed!`]); p.bubbleT = 4;
    p.act = 'alarmed'; p.actT = 7;
    sfx.gasp();
    const rarIdx = r && r.rarityIdx ? r.rarityIdx : 0;
    this.raiseHeat(10 + rarIdx * 4 + (r && r.quality === 'sloppy' ? 6 : 0), p.car, p.x);
    run.log.push(`${p.name} discovered the loss of a ${what}.`);
    this.hooks.toast(`${p.name} discovers the missing ${what}! The ${run.carriages[p.car].name} stirs.`, 'danger');
    // description if they saw the player recently
    const saw = run.t - p.lastSawPlayer < 45;
    if (saw || (r && r.quality === 'sloppy')) {
      if (run.alibiT > 0) { this.hooks.toast('Your alibi at the bar holds—the staff dismiss the description.', 'tip'); }
      else { run.desc = { outfit: p.sawOutfit || run.player.outfit, variant: p.sawVariant || 0, t: run.t }; this.hooks.toast('They describe a gentleman matching your outfit.', 'warn'); }
    }
    // nearby passengers clutch belongings
    for (const q of run.pax) if (!q.staff && q.car === p.car && !q.left) { q.aware = Math.min(1, q.aware + 0.08); }
    this.dispatch(p.x, p.y, p.car, true);
    // detective with pattern memory
    for (const q of run.pax) if (q.staff === 'detective' && dist(q.x, q.y, run.player.x, run.player.y) < 300) q.susp += 25;
  }

  raiseHeat(n, carIdx, x) {
    const run = this.run;
    const before = Math.floor(run.heat / 25);
    run.heat = clamp(run.heat + n, 0, 100);
    run.heatPeak = Math.max(run.heatPeak, run.heat);
    run.lastIncident = run.t; run.lastAlarmX = x;
    if (carIdx != null) run.carriages[carIdx].alert = clamp(run.carriages[carIdx].alert + n * 2, 0, 100);
    const after = Math.floor(run.heat / 25);
    if (after > before) {
      const msg = ['', 'Whispers spread through the train. Passengers grow watchful.', 'Investigation! Staff are searching for a thief.', 'LOCKDOWN. Conductors are searching everyone.'][after];
      if (msg) { this.hooks.toast(msg, after >= 2 ? 'danger' : 'warn'); sfx.alarm(); }
      if (after >= 2 && !run.pax.some(q => q.staff === 'detective') && this.rng.chance(0.5)) run.detectiveDue = true;
    }
  }
  dispatch(x, y, carIdx, alarm) {
    const run = this.run;
    const sec = run.pax.filter(q => (q.staff === 'conductor' || q.staff === 'detective') && !q.left && q.state !== 'searching' && q.state !== 'chase' && q.state !== 'approach');
    if (!sec.length) return;
    sec.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
    const n = alarm ? Math.min(2, sec.length) : 1;
    for (let i = 0; i < n; i++) {
      const c = sec[i];
      if (c.posted) continue;
      c.state = 'respond'; c.path = this.findPath(c.x, c.y, x + (i ? 30 : -20), 3 * T, c);
      if (!c.path) c.state = 'hunt', c.huntT = 15;
    }
  }

  updateHeat(dt) {
    const run = this.run;
    if (run.t - (run.lastIncident || -99) > 18) run.heat = Math.max(0, run.heat - 0.45 * dt);
    for (const c of run.carriages) c.alert = Math.max(0, c.alert - 0.8 * dt);
    if (run.incidentT > 0) run.incidentT -= dt;
    // descriptions fade after a long time
    if (run.desc && run.t - run.desc.t > 150 && run.heat < 30) { run.desc = null; this.hooks.toast('The description of the thief has gone stale.', 'tip'); }
  }

  updateDoors(dt) {
    const run = this.run, P = run.player;
    for (const d of run.doors) {
      const dx = (d.x1 - 6);
      let want = 0;
      const near = (x, y) => Math.abs(x - dx) < 40 && y > 1.5 * T && y < 4.5 * T;
      if (near(P.x, P.y) && (!d.locked || this.playerMayPass(d))) want = 1;
      for (const p of run.pax) if (!p.left && near(p.x, p.y) && (!d.locked || p.staff)) want = 1;
      const prev = d.open;
      d.open = clamp(d.open + (want ? 4 : -3) * dt, 0, 1);
      if (prev === 0 && d.open > 0 && Math.abs(P.x - dx) < 200) sfx.door();
    }
    // compartment doors open when someone is close; lock when owners away
    for (const k in run.compState) {
      const s = run.compState[k];
      const [ci, comp] = k.split(':');
      const cx = s.rect[0] + s.rect[2] / 2, cy = s.rect[1];
      let want = 0;
      if (dist(P.x, P.y, cx, cy) < 30 && !s.locked) want = 1;
      for (const p of run.pax) if (!p.left && dist(p.x, p.y, cx, cy) < 30) want = 1;
      s.open = clamp(s.open + (want ? 4 : -3) * dt, 0, 1);
      if (!s.forced && k !== run.playerComp && this.tr.time !== 'xx') {
        const owners = run.pax.filter(p => p.home && p.home.car === +ci && p.home.comp === comp && !p.left);
        const present = owners.some(p => p.seat && this.seatById.get(p.seat) && this.seatById.get(p.seat).comp === comp && p.car === +ci);
        const wasLocked = s.locked;
        s.locked = owners.length > 0 && !present && !run.pax.some(p => !p.left && Math.abs(p.x - cx) < 18 && Math.abs(p.y - cy) < 18);
        // never lock with the player inside
        if (P.comp === k) s.locked = false;
        if (wasLocked !== s.locked && s.locked && dist(P.x, P.y, cx, cy) < 160) sfx.softclick();
      }
    }
  }

  // ---------- events ----------
  updateEvents(dt) {
    const run = this.run;
    if (run.phase !== 'moving') return;
    run.nextEventT -= dt;
    if (run.detectiveDue && run.phase === 'moving') { /* boards at next station */ }
    if (run.nextEventT > 0) return;
    run.nextEventT = this.rng.range(28, 50);
    const opts = [
      { k: 'argue', w: 3 }, { k: 'magic', w: run.pax.some(p => p.arch === 'magician' && !p.left) ? 3 : 0 },
      { k: 'family', w: !run.familyEvent && run.pax.some(p => p.arch === 'family' && !p.child && !p.left) ? 2.5 : 0 },
      { k: 'rival', w: run.rivalDone ? 0 : 1.6 }, { k: 'courier', w: run.pax.some(p => p.cls === 'upper' && p.state === 'seated' && p.items.some(i => i.cat === 'document' || i.cat === 'letter')) ? 2 : 0 },
      { k: 'patrol', w: 1.2 }, { k: 'drunk', w: run.pax.some(p => (p.arch === 'bankheir' || p.arch === 'aristocrat') && p.state === 'seated' && p.act !== 'sleep') ? 1.5 : 0 },
      { k: 'watchcheck', w: 1.2 },
    ];
    const ev = this.rng.weighted(opts).k;
    this.fireEvent(ev);
  }
  fireEvent(ev) {
    const run = this.run, P = run.player;
    const alive = run.pax.filter(p => !p.left && !p.staff && !p.child);
    if (ev === 'argue') {
      let a = alive.find(p => p.rel && (p.rel.type === 'rivals' || p.rel.type === 'creditor & debtor' || p.rel.type === 'spouses') && p.state === 'seated');
      let b = a && this.paxById.get(a.rel.id);
      if (!a || !b || b.left) { const seated = alive.filter(p => p.state === 'seated' && p.act !== 'sleep'); a = this.rng.pick(seated); b = seated.filter(q => q !== a && q.car === (a && a.car)).sort((x, y) => dist(x.x, x.y, a.x, a.y) - dist(y.x, y.y, a.x, a.y))[0]; }
      if (!a || !b) return;
      for (const p of [a, b]) { p.act = 'argue'; p.actT = 18; }
      a.bubble = this.rng.pick(['You swindling cad!', 'That was MY share!', 'How dare you, sir!']); a.bubbleT = 3;
      setTimeout(() => { if (!b.left) { b.bubble = this.rng.pick(['Lower your voice!', 'I’ll ruin you!', 'Liar!']); b.bubbleT = 3; } }, 2200);
      for (const q of alive) if (q !== a && q !== b && q.car === a.car && dist(q.x, q.y, a.x, a.y) < 140 && q.act !== 'sleep') { q.distractT = 16; q.distractX = a.x; q.distractY = a.y; }
      this.hooks.toast(`A quarrel erupts in the ${run.carriages[a.car].name}! Every head turns.`, 'event');
      a.argueEvent = true;
      setTimeout(() => this.dispatch(a.x, a.y, a.car, false), 6000);
    } else if (ev === 'magic') {
      const m = alive.find(p => p.arch === 'magician');
      if (!m) return;
      m.state = 'perform'; m.act = 'cards'; m.actT = 22; m.bubble = 'Pick a card, any card!'; m.bubbleT = 4;
      for (const q of alive) if (q !== m && q.car === m.car && dist(q.x, q.y, m.x, m.y) < 170 && q.act !== 'sleep') { q.act = 'watchshow'; q.actT = 20; q.distractT = 20; q.distractX = m.x; q.distractY = m.y; }
      this.hooks.toast(`${m.name} begins a card show in the ${run.carriages[m.car].name}. All eyes are on the cards.`, 'event');
    } else if (ev === 'family') {
      const f = alive.find(p => p.arch === 'family' && !p.child && p.state === 'seated');
      if (!f) return;
      run.familyEvent = { id: f.id, resolved: false, cost: 8 + this.tr.tier * 4 };
      f.bubble = 'Please—we’ve lost our tickets!'; f.bubbleT = 5; f.needsHelp = true;
      this.hooks.toast(`The ${f.name.split(' ').pop()} family can’t find their tickets. The conductor is coming.`, 'event');
      this.dispatch(f.x, f.y, f.car, false);
    } else if (ev === 'rival') {
      if (!run.cash && !P.inv.length) return;
      run.rivalDone = true;
      const look = makeLook(this.rng, 'worker', false);
      const g = this.nearestGangway(P.x + 200);
      const r = { id: 'rival', arch: 'worker', name: 'A light-fingered stranger', cls: 'working', look, x: g, y: 3 * T, dir: 'l', car: P.car, act: 'walk', state: 'rival', speed: 52, susp: 0, attn: 0.3, aware: 0.5, items: [], robbed: [], cash: this.rng.int(10, 40), walkPhase: 0, glanceT: 99, glancing: 0, stirWarn: 0, t: 0, rival: true, lastSawPlayer: -99, distractT: 0 };
      run.pax.push(r); this.paxById.set(r.id, r);
      this.rivalRef = r;
    } else if (ev === 'courier') {
      const c = alive.find(p => p.cls === 'upper' && p.state === 'seated' && p.items.some(i => i.cat === 'document' || i.cat === 'letter'));
      if (!c) return;
      const others = run.carriages.filter(k => k.idx !== c.car && k.type !== 'baggage' && k.type !== 'vault');
      const tc = this.rng.pick(others);
      const seat = tc && this.rng.pick(tc.seats.filter(s => !s.occ));
      if (!seat) return;
      this.goToSeat(c, seat.id); c.courier = true; c.speed = 30;
      this.hooks.toast(`${c.name} carries a dispatch case toward the ${tc.name}. Walking marks can't see behind them.`, 'event');
    } else if (ev === 'patrol') {
      const c = run.pax.find(p => p.staff === 'conductor' && p.state === 'patrol');
      if (!c) return;
      c.patrolDir *= -1; c.path = null;
      this.hooks.toast('A conductor abruptly reverses his patrol.', 'info');
    } else if (ev === 'drunk') {
      const d = alive.find(p => (p.arch === 'bankheir' || p.arch === 'aristocrat') && p.state === 'seated' && p.act !== 'sleep');
      if (!d) return;
      d.act = 'sleep'; d.actT = 60; d.bubble = '*hic*… just resting my eyes…'; d.bubbleT = 3;
      this.hooks.toast(`${d.name} has had one brandy too many and nods off.`, 'event');
    } else if (ev === 'watchcheck') {
      // all upper-class passengers in one carriage check watches — discoveries!
      const car = run.carriages[P.car];
      for (const q of alive) if (q.car === car.idx && q.state === 'seated' && q.cls === 'upper' && this.rng.chance(0.6)) { q.act = 'watch'; q.actT = 3; }
      this.hooks.toast('The train runs late. Passengers check their watches.', 'info');
    }
  }

  updateRival(dt) {
    const r = this.rivalRef; if (!r || r.left) return;
    const P = this.run.player;
    r.path = [[P.x + (P.dir === 'l' ? 14 : -14), P.y]];
    this.walkAlong(r, dt);
    if (dist(r.x, r.y, P.x, P.y) < 18 && !r.triggered) { r.triggered = true; this.hooks.rival(r); }
  }

  // ---------- interactions ----------
  updateInteract(dt, input) {
    const run = this.run, P = run.player;
    if (this.rivalRef && !this.rivalRef.left && !this.rivalRef.triggered) this.updateRival(dt);
    if (this.rivalRef && this.rivalRef.state === 'flee') { if (this.walkAlong(this.rivalRef, dt, 1.5)) this.rivalRef.left = true; }
    this.interact = this.findInteract();
    // observation
    const obsT = this.observeCandidate();
    this.obsCandidate = obsT;
    if (input.observe && obsT && !obsT.observed) {
      if (this.observeTarget !== obsT) { this.observeTarget = obsT; this.observeT = 0; }
      this.observeT += dt / 1.6;
      if (this.observeT >= 1) { this.observeT = 0; this.completeObserve(obsT); }
    } else { this.observeT = Math.max(0, this.observeT - dt * 2); if (this.observeT === 0) this.observeTarget = null; }
  }
  observeCandidate() {
    const P = this.run.player;
    let best = null, bd = 95;
    for (const p of this.run.pax) {
      if (p.left || p.child || p.state === 'hidden' || p.rival) continue;
      const d = dist(P.x, P.y, p.x, p.y);
      if (d < bd && this.carAt(p.x) === this.carAt(P.x)) { bd = d; best = p; }
    }
    return best;
  }
  completeObserve(p) {
    const run = this.run;
    p.observed = true;
    run.stats.observed++;
    sfx.discover(0);
    let intel = 0;
    if (!p.staff && p.cls === 'upper' && run.dossierGain < 6) { intel = 1; run.dossierGain++; }
    if (p.secret && !p.staff) intel += 1;
    run.intelGain = (run.intelGain || 0) + intel;
    this.hooks.observed(p, intel);
  }
  liftQuality(p) {
    // returns {q, start, watchers}
    const run = this.run, P = run.player;
    const seen = this.sees(p, P.x, P.y);
    let watchers = 0;
    for (const q of run.pax) {
      if (q === p || q.left || q.child || q.state === 'hidden') continue;
      if (dist(q.x, q.y, P.x, P.y) > 110) continue;
      if (this.sees(q, P.x, P.y) > 0 && q.attn > 0.35) watchers++;
    }
    const a = p.attn;
    let start = a * 38 + watchers * 14 + p.susp * 0.45 + (seen > 0 ? 18 : 0);
    if (p.charmed) start *= 0.6;
    start = clamp(start, 0, 85);
    const q = (seen > 0 && a > 0.3) || start > 55 ? 'bad' : start > 26 ? 'risky' : 'good';
    return { q, start, watchers, seen: seen > 0 };
  }
  liftable(p) {
    if (p.left || p.child || p.rival || p.state === 'hidden') return false;
    if (p.staff === 'detective' || p.staff === 'guard') return false;
    if (p.informant) return false;
    return p.items.length > 0 || p.cash > 0;
  }
  findInteract() {
    const run = this.run, P = run.player;
    if (P.hidden) {
      return { kind: 'unhide', label: 'Step out', x: P.x, y: P.y };
    }
    const opts = [];
    const add = (o, d) => { o.d = d; opts.push(o); };
    for (const p of run.pax) {
      if (p.left || p.state === 'hidden') continue;
      const d = dist(P.x, P.y, p.x, p.y - (p.state === 'seated' ? 2 : 0));
      if (d > 36) continue;
      if (this.carAt(p.x) !== this.carAt(P.x)) continue;
      if (p.needsHelp && run.familyEvent && !run.familyEvent.resolved) { add({ kind: 'help', label: 'Help family', p }, d - 20); continue; }
      if (p.informant) { add({ kind: 'informant', label: 'Talk', p }, d - 5); continue; }
      if (p.child) continue;
      if (this.liftable(p)) add({ kind: 'lift', label: 'Lift', p }, d);
    }
    for (const car of run.carriages) {
      if (Math.abs(car.x0 + car.w / 2 - P.x) > car.w / 2 + 60) continue;
      for (const pr of car.props) {
        const cx = pr.x + pr.w / 2, cy = pr.y + pr.h / 2;
        if (pr.kind === 'luggage' || pr.kind === 'trunk' || pr.kind === 'strongbox' || pr.kind === 'vaultdoor') {
          const d = dist(P.x, P.y, cx, pr.y + pr.h + 6);
          if (d < (pr.kind === 'vaultdoor' ? 50 : 30) && !pr.looted && !pr.mine) {
            if (pr.comp && P.comp !== pr.car + ':' + pr.comp) continue;
            add({ kind: 'lock', label: pr.kind === 'vaultdoor' ? 'Crack vault' : pr.kind === 'strongbox' ? 'Crack strongbox' : 'Pick lock', pr }, d);
          }
        } else if (pr.kind === 'lav') {
          const d = dist(P.x, P.y, pr.x + pr.w + 4, pr.y + pr.h * 0.6);
          if (d < 30) add({ kind: 'lav', label: this.S.upgrades.disguise_spare ? 'Hide / Turn coat' : 'Hide', pr }, d);
        } else if (pr.kind === 'rack' && car.idx === this.run.carriages.find(c => c.seats.some(s => s.id === run.playerSeat)).idx) {
          const d = dist(P.x, P.y, cx, pr.y + pr.h);
          if (d < 40) add({ kind: 'stash', label: 'Your valise', pr }, d);
        } else if (pr.kind === 'luggage' && pr.mine) {
          const d = dist(P.x, P.y, cx, pr.y + pr.h + 6);
          if (d < 34) add({ kind: 'stash', label: 'Your valise', pr }, d);
        } else if (pr.kind === 'bar') {
          const d = Math.abs(P.x - cx) < pr.w / 2 + 10 && P.y < pr.y + pr.h + 40 ? P.y - (pr.y + pr.h) : 999;
          if (d < 40) add({ kind: 'bar', label: 'Order a drink', pr }, d + 10);
        } else if (pr.kind === 'cache' && !pr.looted) {
          const d = dist(P.x, P.y, pr.x, pr.y + 6);
          if (d < 30) add({ kind: 'cache', label: 'Loose panel', pr }, d);
        }
      }
      // my luggage in compartment
    }
    for (const dd of run.doors) {
      const dx = dd.x1 - 6;
      const d = Math.abs(P.x - dx);
      if (dd.locked && !this.playerMayPass(dd) && d < 30 && P.y > 1.8 * T && P.y < 4.2 * T) add({ kind: 'door', label: 'Pick lock', door: dd }, d);
      if (run.phase === 'station' && P.x > dd.x0 - 4 && P.x < dd.x1 + 4) add({ kind: 'exit', label: 'Step off here', door: dd }, 1);
    }
    for (const k in run.compState) {
      const s = run.compState[k];
      if (!s.locked) continue;
      const cx = s.rect[0] + s.rect[2] / 2, cy = s.rect[1] + 10;
      const d = dist(P.x, P.y, cx, cy + 10);
      if (d < 30) add({ kind: 'compdoor', label: 'Pick lock', key: k }, d);
    }
    opts.sort((a, b) => a.d - b.d);
    return opts[0] || null;
  }

  // effects called by UI
  throwCoin() {
    const run = this.run, P = run.player;
    if (run.coins <= 0) return false;
    run.coins--;
    const ang = DIR_ANG[P.dir];
    const tx = P.x + Math.cos(ang) * 110, ty = clamp(P.y + Math.sin(ang) * 60, 20, FLOOR_H - 20);
    run.coinFx = { x: P.x, y: P.y, tx, ty, t: 0 };
    sfx.coin();
    const R = this.S.upgrades.distract_purse ? 200 : 130;
    setTimeout(() => {
      for (const p of run.pax) if (!p.left && !p.staff && p.act !== 'sleep' && dist(p.x, p.y, tx, ty) < R && this.carAt(p.x) === this.carAt(tx)) { p.distractT = 5.5; p.distractX = tx; p.distractY = ty; p.glancing = 0; }
      for (const p of run.pax) if (!p.left && p.staff && dist(p.x, p.y, tx, ty) < R * 0.6) { p.distractT = 2.5; p.distractX = tx; p.distractY = ty; }
    }, 350);
    return true;
  }
  stageIncident() {
    const run = this.run, P = run.player;
    if (run.incidentUsed) return false;
    run.incidentUsed = true; run.incidentT = 12; run.incidentCar = P.car;
    for (const p of run.pax) if (!p.left && p.car === P.car && !p.staff) { p.distractT = 12; p.distractX = P.x + 120; p.distractY = 3 * T; }
    this.hooks.toast('A waiter "faints" with a full tray. The whole carriage gasps and looks away!', 'event');
    this.dispatch(P.x + 120, 3 * T, P.car, false);
    return true;
  }
  orderDrink() {
    const run = this.run;
    const cost = 3;
    if (run.cash < cost && this.S.wealth < cost) return { ok: false, msg: 'You can’t cover the bill.' };
    if (run.cash >= cost) run.cash -= cost; else this.S.wealth -= cost;
    run.alibiT = 75;
    run.desc = run.desc && run.t - run.desc.t > 30 ? null : run.desc;
    return { ok: true };
  }
  hide(on) {
    const P = this.run.player;
    P.hidden = on;
    if (on) { for (const p of this.run.pax) if (p.state === 'chase' || p.state === 'approach') { p.state = 'hunt'; p.huntT = 12; } }
  }
  turnCoat() {
    const P = this.run.player;
    P.variant = (P.variant || 0) ? 0 : 1;
    if (this.run.desc) { this.run.desc = null; }
    for (const p of this.run.pax) if (p.staff) p.susp *= 0.3;
  }
  changeOutfit(id) {
    const P = this.run.player;
    if (P.outfit === id) return;
    P.outfit = id;
    if (this.run.desc && this.run.desc.outfit !== id) this.run.desc = null;
    for (const p of this.run.pax) if (p.staff) p.susp *= 0.4;
  }
  carried() { return this.run.player.inv.length; }
  capacity() { return this.cap; }
}

export { DIR_ANG, angToDir };
