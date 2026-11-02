// LIFT — in-run controller: the inspector's shift.
// Camera, rendering, input, HUD, duties, observation, the double lift, returns, objectives.
import { generateRun, playerLook, T, WALL_H } from './world/gen.js';
import { PatrolSim, prepareRun, pocketName, itemNoun, addClue, ownedName } from './world/patrol.js';
import {
  buildCarriageLayer, drawGangway, drawFrontLip, drawWheels, drawScenery, drawProp, propSortY,
  drawCone, drawEye, drawHandMarker, drawSparkle, drawCharacter, drawBubble, windowsFor, TOP, BOTTOM,
} from './world/render.js';
import { DipGame, SearchGame } from './mini/pickpocket.js';
import { PlantGame } from './mini/plant.js';
import { LockGame } from './mini/lockpick.js';
import { iconURL } from './world/icons.js';
import { TRAINS, ARCHETYPES, ACTIVITY_INFO, RARITY, RARITY_ORDER } from './data/content.js';
import { UNIFORMS, ROGUES, TECHNIQUES, SUSPICION_LEVELS } from './data/cast.js';
import { clamp, dist, el, haptic, rand } from './util.js';
import { sfx, startTrainAmbience, stopTrainAmbience, setMood, whistle } from './audio.js';
import { toast, modal, closeModal, modalOpen, meter } from './ui.js';
import { evaluateMission } from './missions.js';

const WORLD_H = BOTTOM - TOP;
const WIN_Y0 = -WALL_H + 20, WIN_Y1 = -22;

export function satchelCap(S) { return S.upgrades.craft_satchel ? 4 : 2; }

export class RunController {
  constructor(S, routeId, cb, saved = null, mission = null) {
    this.S = S; this.cb = cb;
    this.tr = TRAINS[routeId];
    if (saved) this.run = saved.run;
    else { this.run = generateRun(routeId, S); prepareRun(this.run, S, mission, S.uniform || 'inspector'); }
    const run = this.run;
    this.uni = UNIFORMS[run.uniform] || UNIFORMS.inspector;
    this.mission = run.mission;
    this.time = 0; this.hudT = 0; this.endReason = null; this.ended = false;
    this.paused = false; this.mini = null;
    this.ctl = { seenCars: [run.player.car], tips: !S.tutorial.done, tipStep: 0, favours: 0, murmurT: 3 };
    if (saved && saved.ctl) Object.assign(this.ctl, saved.ctl);
    this.tipT = this.ctl.tips ? (saved ? 3 : 1.5) : 0;
    this.lookCache = new Map(); this.layers = new Map();
    this.sim = new PatrolSim(run, S, {
      toast: (t, k) => toast(t, k),
      end: r => this.queueEnd(r),
      enterCarriage: car => this.onEnterCarriage(car),
      observed: (p, notes, first) => this.onObserved(p, notes, first),
      identified: p => this.onIdentified(p),
      witness: (a, b, item, kind, text) => this.onWitness(a, b, item, kind, text),
      glint: () => sfx.rustle(0.35),
      victimNoticed: (p, L) => this.onVictimNoticed(p, L),
      report: (v, th, text) => { toast(text, 'tip'); },
      thiefGlare: p => toast(`${p.name} pats an empty pocket—and looks straight at you.`, 'warn'),
      spooked: p => { if ((p.clue || 0) >= 2) toast(`${p.name} looks rattled. They’ll try to get rid of it.`, 'warn'); },
      bolted: p => { if ((p.clue || 0) >= 2) toast(`${p.name} is heading for the gangway—they’ll jump off at the next stop.`, 'warn'); },
      arrested: p => { sfx.chime(); toast(`Constables meet ${p.name} on the platform. Case closed.`, 'good'); },
      escaped: (p, loot) => { if ((p.clue || 0) >= 1 || loot.some(l => l.known)) toast(`${p.name} stepped off with ${loot.length} stolen item${loot.length > 1 ? 's' : ''}.`, 'danger'); },
      ownerLeft: p => toast(`${p.name} got off before you could return their belongings. They’ll go to Lost Property.`, 'warn'),
      station: (st, n, flagged) => this.onStation(st, n, flagged),
      suspLevel: lv => this.onSuspLevel(lv),
      reprimand: () => this.onReprimand(),
    });
    this.cv = document.getElementById('world');
    this.c = this.cv.getContext('2d');
    this.miniCv = document.getElementById('mini');
    this.miniUi = document.getElementById('miniUi');
    this.input = { mx: 0, my: 0, hurry: false, observe: false };
    this.keys = new Set(); this.joy = null; this.obsHeld = false;
    this.cam = { x: 0 };
    this.buildHud(); this.bind(); this.resize();
    this.cam.x = this.targetCamX();
    startTrainAmbience(this.tr.time === 'night');
    setMood('calm');
    if (saved) setTimeout(() => toast(`Shift resumed aboard ${this.tr.name}.`, 'event'), 300);
    else {
      whistle(true);
      setTimeout(() => toast(`${this.tr.name} departs ${this.tr.stations[0]}. Next stop: ${this.tr.stations[1]}.`, 'event'), 300);
    }
    this.saveT = 0; this.saveNow();
  }

  // ================= lifecycle & saving =================
  snapshot() { return { v: 2, trainId: this.tr.id, run: this.run, ctl: this.ctl }; }
  saveNow() { if (this.ended || this.endReason) return; this.S.run = this.snapshot(); this.cb.persist(); }
  destroy() {
    this.ended = true; this.unbind();
    if (this.mini) { this.mini.destroy(); this.mini = null; }
    this.miniCv.hidden = true; this.miniUi.hidden = true;
    document.body.classList.remove('mini-open');
    this.hud.hidden = true; this.hud.innerHTML = '';
    if (this.joyEl) this.joyEl.remove();
    document.documentElement.style.removeProperty('--toast-top');
    stopTrainAmbience();
    const c = this.c; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height);
  }
  blocked() { return this.paused || !!this.mini || modalOpen() || !!this.endReason; }
  queueEnd(reason) { if (!this.endReason) this.endReason = reason; }

  frame(dt) {
    if (this.ended) return;
    this.time += dt;
    if (this.mini) { this.mini.update(dt); this.mini.draw(); return; }
    if (!this.blocked()) {
      this.readInput();
      this.sim.update(dt, this.input);
      this.postUpdate(dt);
      this.saveT -= dt;
      if (this.saveT <= 0) { this.saveT = 4; this.saveNow(); }
    }
    if (this.endReason && !this.finishing) { this.finishing = true; this.finish(this.endReason); return; }
    this.render(dt);
    this.hudT -= dt;
    if (this.hudT <= 0) { this.updateHud(); this.hudT = 0.12; }
    this.updateActButtons();
  }

  pause() {
    if (this.ended || this.endReason || this.mini || modalOpen()) return;
    this.paused = true;
    const S = this.S;
    const body = el('div', {},
      el('p', { class: 'muted small', style: { textAlign: 'center' } }, `${this.tr.name} · ${this.run.date}`),
      el('div', { class: 'row', style: { justifyContent: 'center', margin: '6px 0' } },
        toggleBtn('Sound', () => S.settings.sound, v => { S.settings.sound = v; this.cb.onSettings(); }),
        toggleBtn('Music', () => S.settings.music, v => { S.settings.music = v; this.cb.onSettings(); })));
    modal({ title: 'Paused', body, dismiss: 'resume', buttons: [
      { label: 'Resume', value: 'resume', kind: 'primary' }, { label: 'Notebook', value: 'notes' }, { label: 'How to play', value: 'help' },
      { label: 'End shift early', value: 'quit', kind: 'danger', sub: 'Unreturned items go to Lost Property' }] })
      .then(v => {
        this.paused = false;
        if (v === 'help') { this.paused = true; showHelp().then(() => { this.paused = false; }); }
        if (v === 'notes') this.openNotebook();
        if (v === 'quit') modal({ title: 'End your shift?', body: '<p>You hand the train to the relief inspector at the next stop.</p>', dismiss: false, buttons: [{ label: 'Keep working', value: false }, { label: 'End shift', value: true, kind: 'danger' }] })
          .then(ok => { if (ok) this.queueEnd('quit'); });
      });
  }

  // ================= input =================
  bind() {
    this._kd = e => this.onKey(e, true); this._ku = e => this.onKey(e, false);
    this._resize = () => this.resize();
    this._blur = () => { this.keys.clear(); this.obsHeld = false; this.joy = null; this.updateJoyEl(); };
    window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
    window.addEventListener('resize', this._resize); window.addEventListener('blur', this._blur);
    this._pd = e => this.onPointerDown(e); this._pm = e => this.onPointerMove(e); this._pu = e => this.onPointerUp(e);
    this.cv.addEventListener('pointerdown', this._pd);
    window.addEventListener('pointermove', this._pm); window.addEventListener('pointerup', this._pu); window.addEventListener('pointercancel', this._pu);
    this._abort = () => { if (this.mini && !this.mini.done) this.mini.abort(); };
    document.getElementById('miniAbort').addEventListener('click', this._abort);
  }
  unbind() {
    window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku);
    window.removeEventListener('resize', this._resize); window.removeEventListener('blur', this._blur);
    this.cv.removeEventListener('pointerdown', this._pd);
    window.removeEventListener('pointermove', this._pm); window.removeEventListener('pointerup', this._pu); window.removeEventListener('pointercancel', this._pu);
    document.getElementById('miniAbort').removeEventListener('click', this._abort);
  }
  onKey(e, down) {
    if (this.ended) return;
    const k = e.code;
    if (down && modalOpen()) return;
    if (this.mini) { if (down && k === 'Escape') this._abort(); return; }
    if (down) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      if (e.repeat) { this.keys.add(k); return; }
      if (k === 'KeyE' || k === 'Space' || k === 'Enter') { this.doAction(0); return; }
      if (k === 'KeyR') { this.doAction(1); return; }
      if (k === 'Escape' || k === 'KeyP') { this.pause(); return; }
      if (k === 'KeyN' || k === 'Tab') { e.preventDefault(); this.openNotebook(); return; }
      if (k === 'KeyB') { this.openSatchel(); return; }
      if (k === 'KeyH') { this.useWhistle(); return; }
      this.keys.add(k);
    } else this.keys.delete(k);
  }
  readInput() {
    const K = this.keys;
    let mx = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    let my = (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0) - (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0);
    let hurry = K.has('ShiftLeft') || K.has('ShiftRight');
    if (this.joy && this.joy.active) {
      const dx = this.joy.x - this.joy.x0, dy = this.joy.y - this.joy.y0;
      const d = Math.hypot(dx, dy), R = 50;
      if (d > 6) { const m = Math.min(1, d / R); mx = dx / d * m; my = dy / d * m; }
      if (d > R * 1.25) hurry = true;
    }
    this.input.mx = mx; this.input.my = my; this.input.hurry = hurry;
    this.input.observe = this.obsHeld || K.has('KeyQ');
  }
  onPointerDown(e) {
    if (this.blocked()) return;
    e.preventDefault();
    if (this.joy && this.joy.active) return;
    this.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: true };
    this.updateJoyEl();
  }
  onPointerMove(e) {
    if (!this.joy || e.pointerId !== this.joy.id) return;
    this.joy.x = e.clientX; this.joy.y = e.clientY;
    const dx = this.joy.x - this.joy.x0, dy = this.joy.y - this.joy.y0, d = Math.hypot(dx, dy), max = 80;
    if (d > max) { this.joy.x0 = this.joy.x - dx / d * max; this.joy.y0 = this.joy.y - dy / d * max; }
    this.updateJoyEl();
  }
  onPointerUp(e) { if (this.joy && e.pointerId === this.joy.id) { this.joy = null; this.updateJoyEl(); } }
  updateJoyEl() {
    if (!this.joyEl) { this.joyEl = el('div', { class: 'joy' }, el('div', { class: 'nub' })); document.getElementById('app').append(this.joyEl); }
    const j = this.joy;
    this.joyEl.hidden = !j;
    if (!j) return;
    this.joyEl.style.left = j.x0 + 'px'; this.joyEl.style.top = j.y0 + 'px';
    this.joyEl.firstChild.style.transform = `translate(${clamp(j.x - j.x0, -60, 60)}px, ${clamp(j.y - j.y0, -60, 60)}px)`;
  }

  // ================= view =================
  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr; this.W = W; this.H = H;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    const portrait = H > W * 1.15;
    const topH = portrait ? 118 : 96, botH = portrait ? 170 : 40;
    const availH = Math.max(160, H - topH - botH);
    this.scale = clamp(Math.min(availH / WORLD_H, W / 300), 0.7, 3.2);
    this.viewW = W / this.scale;
    this.offY = portrait ? topH + 4 : topH + Math.max(0, (availH - WORLD_H * this.scale) / 2);
    const below = this.offY + WORLD_H * this.scale + 8;
    document.documentElement.style.setProperty('--toast-top', portrait && H - below > 200 ? below + 'px' : '');
    const ls = Math.min(2.5, this.scale * dpr);
    if (ls !== this.layerScale) { this.layerScale = ls; this.layers.clear(); }
    if (this.mini) this.mini.layout();
  }
  targetCamX() {
    const P = this.run.player, worldW = this.run.worldW;
    const look = P.dir === 'r' ? 40 : P.dir === 'l' ? -40 : 0;
    if (worldW <= this.viewW) return (worldW - this.viewW) / 2;
    return clamp(P.x + look - this.viewW / 2, -20, worldW - this.viewW + 20);
  }
  layerFor(car) {
    let L = this.layers.get(car.idx);
    if (!L) { L = buildCarriageLayer(car, this.layerScale, this.tr); this.layers.set(car.idx, L); }
    return L;
  }

  render(dt) {
    const c = this.c, run = this.run, sim = this.sim, P = run.player;
    this.cam.x += (this.targetCamX() - this.cam.x) * Math.min(1, dt * 5);
    const shake = sim.shake || 0;
    const sx = shake > 0 ? (Math.random() - 0.5) * 6 * shake : 0, sy = shake > 0 ? (Math.random() - 0.5) * 4 * shake : 0;
    const sway = run.speed > 0.1 ? Math.sin(this.time * 7.3) * 0.6 * run.speed : 0;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#120c09'; c.fillRect(0, 0, this.W, this.H);
    const k = this.scale * this.dpr;
    c.setTransform(k, 0, 0, k, -this.cam.x * k + sx * this.dpr, (this.offY - TOP * this.scale) * this.dpr + (sy + sway) * this.dpr);
    const vx0 = this.cam.x - 60, vx1 = this.cam.x + this.viewW + 60;
    const t = this.time;
    c.save(); c.beginPath(); c.rect(Math.max(0, vx0), TOP, Math.min(run.worldW, vx1) - Math.max(0, vx0), WORLD_H); c.clip();
    drawScenery(c, run, vx0, vx1, t);
    if (run.weather !== 'clear' && run.tunnelT <= 0) this.drawWeatherSky(c, vx0, vx1, t);
    c.restore();
    const cars = run.carriages.filter(car => car.x0 + car.w > vx0 && car.x0 < vx1);
    for (const car of cars) c.drawImage(this.layerFor(car), car.x0, TOP, car.w, WORLD_H);
    if (run.weather === 'rain' && run.tunnelT <= 0) for (const car of cars) this.drawRainOnGlass(c, car, t);
    for (const d of run.doors) if (d.x1 > vx0 && d.x0 < vx1) drawGangway(c, d, run, t);
    const list = [];
    for (const car of cars) for (const pr of car.props) {
      if (pr.x + pr.w < vx0 - 40 || pr.x > vx1 + 40 || pr.kind === 'cache') continue;
      list.push({ y: propSortY(pr), f: () => drawProp(c, pr, car, run, t, {}) });
    }
    for (const p of run.pax) {
      if (p.left || p.state === 'hidden' || p.x < vx0 - 40 || p.x > vx1 + 40) continue;
      list.push({ y: p.y + (p.state === 'seated' ? 0.5 : 1), f: () => this.drawPax(c, p) });
    }
    list.push({ y: P.y + 1, f: () => this.drawPlayer(c) });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.f();
    for (const car of cars) { drawFrontLip(c, car); drawWheels(c, car, (run.dist || 0) * 0.045); }
    this.drawOverlays(c, vx0, vx1);
    if (this.tr.time === 'night') { c.fillStyle = 'rgba(10,14,40,0.16)'; c.fillRect(vx0, TOP, vx1 - vx0, WORLD_H); }
    if (run.weather === 'rain') { c.fillStyle = 'rgba(20,30,50,0.08)'; c.fillRect(vx0, TOP, vx1 - vx0, WORLD_H); }
    if (run.tunnelT > 0) {
      const a = Math.min(1, run.tunnelT, (9 - run.tunnelT) * 2) * 0.7;
      c.save(); c.fillStyle = `rgba(4,2,1,${a})`;
      c.beginPath(); c.rect(vx0, TOP, vx1 - vx0, WORLD_H); c.arc(P.x, P.y - 20, 80, 0, Math.PI * 2, true); c.fill('evenodd');
      const g = c.createRadialGradient(P.x, P.y - 20, 34, P.x, P.y - 20, 82);
      g.addColorStop(0, 'rgba(4,2,1,0)'); g.addColorStop(1, `rgba(4,2,1,${a})`);
      c.fillStyle = g; c.beginPath(); c.arc(P.x, P.y - 20, 82, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }
  drawWeatherSky(c, vx0, vx1) {
    if (this.run.weather === 'fog') { c.fillStyle = 'rgba(220,215,205,0.45)'; c.fillRect(vx0, -WALL_H, vx1 - vx0, WALL_H); return; }
    c.fillStyle = 'rgba(40,50,70,0.35)'; c.fillRect(vx0, -WALL_H, vx1 - vx0, WALL_H);
  }
  drawRainOnGlass(c, car, t) {
    const sp = this.run.speed || 0;
    c.save();
    c.strokeStyle = 'rgba(210,225,240,0.35)'; c.lineWidth = 0.7;
    for (const wx of windowsFor(car)) {
      c.save(); c.beginPath(); c.rect(wx - 20, WIN_Y0, 40, WIN_Y1 - WIN_Y0); c.clip();
      for (let i = 0; i < 9; i++) {
        const seed = (wx * 7 + i * 131) % 97;
        const x = wx - 20 + ((seed * 13 + t * (30 + sp * 90)) % 46) - 3;
        const y = WIN_Y0 + ((seed * 29 + t * 60) % 60) - 6;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - 6 - sp * 6, y + 7 - sp * 3); c.stroke();
      }
      c.restore();
    }
    c.restore();
  }
  drawPax(c, p) {
    const moved = p._px != null && (Math.abs(p.x - p._px) + Math.abs(p.y - p._py)) > 0.05;
    p._px = p.x; p._py = p.y;
    const seated = p.state === 'seated';
    const reaching = p.thief && p.thief.state === 'strike';
    const pose = {
      dir: p.dir, walk: moved ? p.walkPhase : null, sit: seated && !p.lie, lie: seated && p.lie, act: p.act, t: p.t || this.time,
      alert: p.act === 'alarmed', susp: (p.susp || 0) / 100, standAct: p.state === 'stand' || p.state === 'perform', reach: reaching,
    };
    c.save(); c.translate(p.x, p.y); drawCharacter(c, p.look, pose); c.restore();
  }
  heroLook() {
    const key = this.run.uniform;
    let L = this.lookCache.get(key);
    if (!L) {
      const U = this.uni;
      L = { ...playerLook('tweed'), coat: U.coat, trim: U.trim, legs: U.legs, hat: U.hat, hair: '#b8b2a8', beard: 'mustache', glasses: 'spectacles', scarf: null, carnation: false, build: 1.06, tall: 1.02 };
      this.lookCache.set(key, L);
    }
    return L;
  }
  drawPlayer(c) {
    const P = this.run.player;
    c.save(); c.translate(P.x, P.y);
    drawCharacter(c, this.heroLook(), { dir: P.dir, walk: P.moving ? P.walkPhase : null, t: this.time, reach: P.busyT > 0 || this.reachT > 0, happy: true });
    c.restore();
    if (this.reachT > 0) this.reachT -= 0.016;
    if (P.busyT > 0 && this.dutyFx) {
      const q = this.dutyFx;
      const mx = (P.x + q.x) / 2, my = Math.min(P.y, q.y) - 34;
      c.save(); c.translate(mx, my); c.rotate(Math.sin(this.time * 9) * 0.08);
      if (q.kind === 'refresh') { c.fillStyle = '#e8e0d0'; c.beginPath(); c.ellipse(0, 0, 9, 3, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#c9a24a'; c.fillRect(-2, -8, 4, 7); }
      else { c.fillStyle = '#f4e9d3'; c.fillRect(-7, -4.5, 14, 9); c.fillStyle = '#6e1f2b'; c.fillRect(-7, -4.5, 3, 9); c.fillStyle = '#2a1c14'; c.beginPath(); c.arc(3, 0, 1.4, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
  }
  drawOverlays(c, vx0, vx1) {
    const run = this.run, sim = this.sim, P = run.player, S = this.S, t = this.time;
    const pCar = sim.carAt(P.x);
    const owners = new Set(run.satchel.map(e => e.ownerId));
    for (const p of run.pax) {
      if (p.left || p.state === 'hidden' || p.x < vx0 || p.x > vx1 || p.child) continue;
      const d = dist(p.x, p.y, P.x, P.y);
      const sameCar = sim.carAt(p.x) === pCar;
      const head = p.state === 'seated' ? (p.lie ? 22 : 50) : 62;
      if (sameCar && p.act !== 'sleep' && d < 170 && (p.attn > 0.5 || p.glancing > 0) && !p.staff) {
        c.globalAlpha = clamp(p.attn * 0.8, 0.2, 0.8);
        drawCone(c, p, sim.faceAngle(p), sim.coneHalf(p), Math.min(110, sim.coneRange(p)), p.susp > 50);
        c.globalAlpha = 1;
      }
      const TH = p.thief;
      if (TH && S.upgrades.craft_glance && sameCar && (TH.state === 'eye' || TH.state === 'strike') && d < 260) {
        const q = sim.paxById.get(TH.targetId);
        if (q) { c.save(); c.strokeStyle = 'rgba(232,160,64,0.55)'; c.setLineDash([3, 5]); c.lineWidth = 1.2; c.beginPath(); c.moveTo(p.x, p.y - head + 8); c.lineTo(q.x, q.y - 30); c.stroke(); c.restore(); }
      }
      if (p.observed && !p.staff && p.items.length && sameCar && d < 220) {
        const best = p.items.reduce((m, it) => Math.max(m, RARITY_ORDER.indexOf(it.rarity)), 0);
        const col = RARITY[RARITY_ORDER[best]].color;
        drawSparkle(c, p.x + 12, p.y - head + 18, col === '#8b7e6a' ? '#e8cf86' : col, t + p.x * 0.01, Math.min(3, p.items.length));
      }
      if (sameCar && !TH && (p.susp > 6 || p.stirWarn > 0)) drawEye(c, p.x, p.y - head - 8, clamp(p.susp / 100, 0, 1), p.glancing > 0 || p.stirWarn > 0);
      if ((p.clue || 0) > 0) this.drawClueMark(c, p.x - 14, p.y - head - 8, p);
      if (owners.has(p.id)) this.drawOwnerMark(c, p.x + 14, p.y - head - 8, t);
      if (p.bubbleT > 0 && p.bubble) drawBubble(c, p.x, p.y - head - (sameCar ? 18 : 6), p.bubble, Math.min(1, p.bubbleT * 2), p.act === 'alarmed' ? 'alarm' : 'say');
    }
    for (const g of sim.glints) drawSparkle(c, g.x, g.y - 30, '#fff2c0', t * 3, 2);
    const it = sim.interact;
    if (it && it.kind === 'lift' && it.p) {
      const q = sim.liftOdds(it.p).q;
      const head = it.p.state === 'seated' ? 50 : 62;
      drawHandMarker(c, it.p.x, it.p.y - head - 28, q, t);
    } else if (it && (it.pr || it.door || it.key)) {
      let mx, my;
      if (it.pr) { mx = it.pr.x + it.pr.w / 2; my = it.pr.y - 24; }
      else if (it.door) { mx = it.door.x1 - 6; my = 2 * T - 10; }
      else { const s = run.compState[it.key]; mx = s.rect[0] + s.rect[2] / 2; my = s.rect[1] - 44; }
      c.save(); c.translate(mx, my + Math.sin(t * 5) * 2); c.rotate(Math.PI / 4);
      c.fillStyle = 'rgba(25,15,10,0.85)'; c.fillRect(-6, -6, 12, 12); c.strokeStyle = '#e8cf86'; c.lineWidth = 1.5; c.strokeRect(-6, -6, 12, 12);
      c.restore();
    }
    if (sim.observeTarget && sim.observeT > 0) {
      const p = sim.observeTarget, head = p.state === 'seated' ? 50 : 62;
      c.strokeStyle = '#a8e8b0'; c.lineWidth = 2.2;
      c.beginPath(); c.arc(p.x, p.y - head / 2, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sim.observeT); c.stroke();
    }
  }
  drawClueMark(c, x, y, p) {
    const n = Math.min(3, p.clue || 0), id = p.identified;
    c.save(); c.translate(x, y);
    c.fillStyle = id ? 'rgba(120,20,30,0.92)' : 'rgba(25,15,10,0.85)';
    c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill();
    c.strokeStyle = id ? '#ff8a7a' : '#e8cf86'; c.lineWidth = 1.2; c.stroke();
    if (id) { c.fillStyle = '#ffe0d8'; c.font = 'bold 9px "Josefin Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 0, 0.5); }
    else {
      c.strokeStyle = '#e8cf86'; c.lineWidth = 1.2; c.beginPath(); c.arc(-1, -1, 2.6, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(1, 1); c.lineTo(3.4, 3.4); c.stroke();
      for (let i = 0; i < 3; i++) { c.fillStyle = i < n ? '#e8cf86' : 'rgba(232,207,134,0.25)'; c.beginPath(); c.arc(-4 + i * 4, 10, 1.4, 0, Math.PI * 2); c.fill(); }
    }
    c.restore();
  }
  drawOwnerMark(c, x, y, t) {
    c.save(); c.translate(x, y + Math.sin(t * 4) * 1.5);
    c.fillStyle = 'rgba(31,94,74,0.95)'; c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#a8e8b0'; c.lineWidth = 1.3; c.stroke();
    c.strokeStyle = '#f4e9d3'; c.lineWidth = 1.4; c.beginPath(); c.arc(0, 0.5, 3, Math.PI * 1.1, Math.PI * 0.2); c.stroke();
    c.beginPath(); c.moveTo(-3.4, -1.6); c.lineTo(-3.2, 1.2); c.lineTo(-0.6, 0.2); c.stroke();
    c.restore();
  }

  // ================= per-frame logic =================
  postUpdate(dt) {
    const run = this.run;
    if (this.ctl.tips) {
      this.tipT -= dt;
      if (this.tipT <= 0) {
        const touch = matchMedia('(hover: none)').matches;
        const tips = [
          touch ? 'Drag anywhere to walk the train. Drag further to hurry—passengers notice an inspector in a rush.' : 'Walk the train with WASD or the arrows. Shift hurries—passengers notice an inspector in a rush.',
          `Check tickets (${touch ? 'the round button' : 'E'}). It’s your job, it calms suspicion, and it lets you stand close to anyone.`,
          `Hold ${touch ? 'OBSERVE' : 'Q'} beside a passenger to study them. Three clues and you’ve identified a thief.`,
          'When you see a lift, the thief’s pocket is marked. Get beside them and lift it back—ideally while they’re busy with their next mark.',
          'Green markers show whose belongings you’re carrying. Slip them back before they notice, and nobody ever knows.',
        ];
        if (this.ctl.tipStep < tips.length) { toast(tips[this.ctl.tipStep], 'tip'); this.ctl.tipStep++; this.tipT = 13; }
        else this.ctl.tips = false;
      }
    }
    this.ctl.murmurT -= dt;
    if (this.ctl.murmurT <= 0) { this.ctl.murmurT = 2.5 + Math.random() * 3; const n = run.pax.filter(p => !p.left && p.act === 'talk' && Math.abs(p.x - run.player.x) < 200).length; if (n) sfx.murmur(Math.min(1.5, n * 0.5)); }
    const tense = run.susp >= 50 || run.pax.some(p => p.thief && !p.left && p.identified && p.thief.loot.length && Math.abs(p.x - run.player.x) < 260);
    if (tense !== this.tense) { this.tense = tense; setMood(tense ? 'tense' : 'calm'); }
  }
  onEnterCarriage(car) {
    if (this.ctl.seenCars.includes(car.idx)) return;
    this.ctl.seenCars.push(car.idx);
    const own = this.sim.belongsHere(car);
    toast(own ? car.name : `${car.name} — not your beat in that uniform. Don’t linger.`, own ? 'info' : 'warn', 2600);
  }
  onStation(st, n, flagged) {
    toast(`${st}. ${n} boarding.${flagged.length ? ` Manifest flags: ${flagged.join(', ')}.` : ''}`, 'event');
    this.saveNow();
  }
  onSuspLevel(lv) {
    const msg = ['', 'A few passengers have noticed you hovering.', 'People are talking about the inspector. Thieves will be warier.', 'You’re under scrutiny. Someone has sent for the Superintendent.'][lv];
    if (msg) toast(msg, lv >= 2 ? 'danger' : 'warn');
  }
  onObserved(p, notes, first) {
    const A = ARCHETYPES[p.arch] || {};
    const has = p.items.length ? p.items.map(i => i.name).join(', ') : 'nothing of note';
    if (first && !p.staff) toast(`${p.name} — ${A.title || 'passenger'}. Carrying ${has}.`, 'info', 4200);
    for (const n of notes) toast(n, 'tip', 5200);
    if (!notes.length && !first) toast(`Nothing new about ${p.name}.`, 'info', 1600);
  }
  onIdentified(p) {
    const TH = p.thief;
    sfx.witness(); haptic(30);
    if (TH && TH.rogue) toast(`Identified: ${p.name}, “${ROGUES[TH.rogue].alias}”. ${TECHNIQUES[TH.tech].name}.`, 'good', 6000);
    else toast(`You’re sure of it now: ${p.name} is working this train.`, 'good', 5000);
  }
  onWitness(a, b, item, kind, text) {
    sfx.witness(); haptic(20);
    if (kind === 'theft') {
      const l = a.thief.loot.find(x => x.item === item);
      toast(`You saw that. ${a.name} just lifted ${b.name}’s ${itemNoun(item)}${l ? ' — into the ' + pocketName(l.pocket) : ''}.`, 'good', 6000);
      this.sim.checkIdentified(a);
    } else if (kind === 'handoff') toast(`A handoff! ${a.name} slipped something to ${b.name}.`, 'good', 5500);
    else if (kind === 'ditch') toast(`${a.name} has stuffed something into hiding nearby. Search it.`, 'good', 5500);
    else if (text) toast(text, 'tip');
  }
  onVictimNoticed(p, L) {
    if (Math.abs(p.x - this.run.player.x) < 500) toast(`${p.name} has noticed their ${L.noun} is missing.`, 'warn');
  }
  onReprimand() {
    const run = this.run, S = this.S;
    this.keys.clear(); this.joy = null; this.updateJoyEl();
    sfx.caught();
    const keep = S.upgrades.craft_lining;
    const lost = keep ? [] : run.satchel.splice(0);
    for (const e of lost) run.lostProperty.push({ ...e, why: 'confiscated' });
    run.reprimands++;
    const last = run.reprimands >= 3;
    const body = `<p class="quote">“Tull. A word. Passengers are complaining about an inspector who hovers, stares and puts his hands where they don’t belong.”</p>
<p>Superintendent Crabbe walks you back to the front of the train.${lost.length ? ` He takes the ${lost.length} item${lost.length > 1 ? 's' : ''} in your satchel to Lost Property.` : keep && run.satchel.length ? ' Your lined coat keeps the satchel’s contents out of sight.' : ''}</p>
<p class="muted small">${last ? 'Third reprimand. You’re relieved of duty for the rest of the journey.' : `Reprimand ${run.reprimands} of 3.`}</p>`;
    modal({ title: 'The Superintendent', body, dismiss: true, buttons: [{ label: last ? 'Hand over your punch' : 'Back to work', value: true, kind: 'primary' }] }).then(() => {
      if (last) { this.queueEnd('relieved'); return; }
      const P = run.player, c0 = run.carriages[0];
      P.x = c0.x0 + 2.6 * T; P.y = (c0.type === 'compartment' || c0.type === 'sleeper') ? 5 * T : 3 * T;
      run.susp = 55; this.sim.reprimanding = false;
      for (const p of run.pax) p.susp = 0;
    });
  }

  // ================= actions =================
  doAction(i) {
    if (this.blocked()) return;
    const it = this.actionPair()[i];
    if (!it) { if (i === 0) toast('Nothing within reach.', 'info', 1200); return; }
    const run = this.run, sim = this.sim, P = run.player;
    switch (it.kind) {
      case 'ticket': return this.doTicket(it.p);
      case 'refresh': return this.doRefresh(it.p);
      case 'lift': return this.startLift(it.p);
      case 'return': return this.startReturn(it.p);
      case 'help': {
        const kind = sim.helpPassenger(it.p); this.ctl.favours += 1; sfx.chime();
        toast(kind === 'tickets' ? 'You punch them a courtesy ticket. The whole carriage warms to you. (+1 favour)' : 'You heave the case onto the rack. Ever so helpful, the inspector. (+1 favour)', 'good');
        return;
      }
      case 'informant': return this.talkInformant(it.p);
      case 'search': {
        P.busyT = 1.1; sfx.rustle(1);
        const got = sim.searchStash(it.pr);
        setTimeout(() => toast(got.length ? `Tucked out of sight: ${got.map(l => l.item.name).join(', ')}. In your satchel now.` : 'Nothing there after all.', got.length ? 'good' : 'info'), 500);
        return;
      }
      case 'compdoor': {
        if (this.uni.keys || this.S.upgrades.cover_keys) { const s = run.compState[it.key]; s.forced = true; s.locked = false; sfx.unlock(); toast('Your key turns smoothly.', 'info', 1500); return; }
        return this.openMini(cv => new LockGame(cv, { S: this.S, pins: 3, title: 'THE PICK — Compartment door', subtitle: 'An inspector really ought to have a key' }), res => {
          if (res.success) { const s = run.compState[it.key]; s.forced = true; s.locked = false; toast('The compartment door clicks open.', 'good'); }
          else if (!res.aborted) { sim.bumpSusp(6); toast('Fumbling at a private compartment door—someone noticed.', 'warn'); }
        });
      }
      case 'door': {
        const next = run.carriages[it.door.between[1]];
        toast(next.type === 'vault' ? 'The Royal Household’s car. Only a Chief Inspector is admitted.' : `The ${next.name} is locked to you in this uniform.`, 'info');
        return;
      }
    }
  }
  faceTo(p) { const P = this.run.player; const dx = p.x - P.x; P.dir = Math.abs(dx) > 4 ? (dx > 0 ? 'r' : 'l') : (p.y > P.y ? 'd' : 'u'); }
  doTicket(p) {
    const P = this.run.player;
    this.faceTo(p);
    P.busyT = this.S.upgrades.cover_punch ? 0.5 : 0.85;
    this.dutyFx = { x: p.x, y: p.y, kind: 'ticket' };
    sfx.punch();
    const r = this.sim.checkTicket(p);
    const tk = p.ticket ? p.ticket.text : 'A ticket';
    toast(`${p.name}: ${tk}.${r.routine >= 3 ? ' (Brisk and routine—nobody looks twice.)' : ''}`, 'info', 2600);
    for (const n of r.notes) toast(n, 'tip', 5200);
  }
  doRefresh(p) {
    const P = this.run.player;
    this.faceTo(p);
    P.busyT = 0.8; this.dutyFx = { x: p.x, y: p.y, kind: 'refresh' };
    sfx.softclick();
    const r = this.sim.offerRefreshment(p);
    toast(`“Tea, ${p.female ? 'madam' : 'sir'}?” ${p.name} takes a cup.`, 'info', 2200);
    for (const n of r.notes) toast(n, 'tip', 5200);
  }
  talkInformant(p) {
    const run = this.run, sim = this.sim;
    modal({ title: p.name, body: '<p class="quote">“Evening, Mr. Tull. Keeping your eyes open?”</p>', dismiss: null, buttons: [
      { label: 'Any faces I should know?', value: 'tip', kind: 'primary' }, { label: 'Never mind', value: null }] }).then(v => {
      if (!v) return;
      p.tipUsed = true;
      const ditched = run.carriages.flatMap(c => c.props).find(pr => pr.stash && pr.stash.length && !pr.seen);
      if (ditched) { ditched.seen = true; toast(`“Saw a fellow stuff something in the ${ditched.kind === 'lav' ? 'W.C.' : 'rack'} in the ${run.carriages[ditched.car].name}.”`, 'tip', 6000); return; }
      const q = run.pax.filter(x => x.thief && !x.left && !x.identified).sort((a, b) => b.thief.loot.length - a.thief.loot.length)[0];
      if (!q) { toast('“Quiet train tonight, far as I can tell.”', 'info'); return; }
      addClue(q, 'porter', 1, `Old Sam the porter has seen ${q.name} working trains before.`, run);
      sim.checkIdentified(q);
      toast(`“Keep an eye on ${q.name} in the ${run.carriages[q.car].name}. Seen ${q.female ? 'her' : 'him'} working the crowds at Kingsgate.”`, 'tip', 6500);
    });
  }
  useWhistle() {
    if (this.blocked() || !this.S.upgrades.net_whistle) return;
    if (this.sim.blowWhistle()) toast('A porter’s whistle shrills outside. Every head in the carriage turns to the window.', 'event');
    else toast('The porters have done their bit this trip.', 'info', 1600);
  }

  // ---------- the double lift ----------
  startLift(p) {
    const run = this.run, S = this.S, sim = this.sim;
    if (run.satchel.length >= satchelCap(S)) { toast('Your satchel is full. Return something first.', 'warn'); return; }
    const odds = sim.liftOdds(p);
    const TH = p.thief;
    const knownLoot = TH ? TH.loot.filter(l => l.known) : [];
    const A = ARCHETYPES[p.arch] || {};
    const body = el('div');
    body.append(el('div', { class: 'mark-card' },
      el('div', { style: { flex: 1 } }, el('div', { style: { fontWeight: 600, fontSize: '18px' } }, p.name),
        el('div', { class: 'muted small' }, `${A.title || 'Passenger'} · ${(ACTIVITY_INFO[p.act] || ACTIVITY_INFO.idle).label}`)),
      el('span', { class: 'quality ' + odds.q }, odds.q === 'good' ? 'Clean opening' : odds.q === 'risky' ? 'Risky' : 'Eyes on you')));
    if (odds.busy) body.append(el('p', { class: 'small', style: { color: '#a8e8b0' } }, 'They’re busy with a mark of their own. They won’t feel a thing.'));
    if (odds.watchers) body.append(el('p', { class: 'small muted' }, `${odds.watchers} other ${odds.watchers === 1 ? 'passenger' : 'passengers'} could see your hands.`));
    if (!p.identified) body.append(el('p', { class: 'small', style: { color: '#ffd793' } }, (p.clue || 0) ? `You have ${p.clue} clue${p.clue > 1 ? 's' : ''}—not certain. A wrong lift will cost you.` : 'You have nothing on this passenger. A wrong lift will cost you.'));
    const list = el('div', { class: 'pick-list' });
    const choose = v => closeModal(v);
    for (const l of knownLoot) {
      const b = el('button', { class: 'pick' }, el('img', { src: iconURL(l.item, 88), alt: '' }),
        el('div', { class: 't' }, ownedName(l.ownerName, l.item), el('small', {}, `In the ${pocketName(l.pocket)} · The Dip`)));
      b.addEventListener('click', () => choose({ loot: l }));
      list.append(b);
    }
    const blind = el('button', { class: 'pick' }, el('div', { class: 't' }, knownLoot.length ? 'Pat down for anything else' : 'Pat them down', el('small', {}, 'Find the right pocket by touch, then dip.')));
    blind.addEventListener('click', () => choose({ blind: true }));
    list.append(blind);
    body.append(list);
    modal({ title: 'The Double Lift', body, dismiss: null, buttons: [{ label: 'Walk on', value: null }] }).then(v => {
      if (!v) return;
      this.runLift(p, v.loot || null, odds);
    });
  }
  runLift(p, chosen, odds) {
    const S = this.S, TH = p.thief;
    const loot = chosen || (TH && TH.loot.length ? TH.loot[0] : null);
    const own = p.items[0] || { id: 'wallet-' + p.id, cat: 'wallet', name: 'Wallet', rarity: 'common', value: p.cash };
    const item = loot ? loot.item : own;
    const rarityIdx = Math.max(0, RARITY_ORDER.indexOf(item.rarity));
    const opts = {
      S, item, look: p.look, female: p.female, act: odds.busy ? 'argue' : p.act, aware: p.aware, rarityIdx,
      start: odds.start, glanceMul: odds.busy ? 0.4 : 1, patience: 26, techName: 'The Double Lift',
      title: chosen ? `THE DOUBLE LIFT — ${pocketName(loot.pocket).toUpperCase()}` : 'THE PAT-DOWN', subtitle: p.name,
    };
    this.reachT = 0.6;
    const ctx = { watchers: odds.watchers, loot };
    this.openMini(cv => chosen ? new DipGame(cv, { ...opts, pocket: loot.pocket }) : new SearchGame(cv, opts), res => this.liftResult(p, res, ctx));
  }
  liftResult(p, res, ctx) {
    const r = this.sim.applyLift(p, res, ctx);
    if (r.kind === 'aborted') { toast('You ease your hand away. Nobody the wiser.', 'info', 1800); return; }
    if (r.kind === 'aborted-felt') { toast(`You pull back—but ${p.name} felt something.`, 'warn'); return; }
    if (r.kind === 'failed') { sfx.caught(); haptic(80); this.sim.shake = 0.5; toast(`${p.name} catches your hand! Heads turn all along the carriage.`, 'danger', 5000); return; }
    if (r.kind === 'recovered') {
      sfx.success(r.quality === 'critical'); haptic(30);
      const e = r.entry;
      toast(`${r.quality === 'critical' ? 'Flawless. ' : r.quality === 'sloppy' ? 'Clumsy—they’ll notice soon. ' : ''}${ownedName(e.ownerName, e.item)} is in your satchel. Now walk away${r.quality === 'sloppy' ? ', quickly' : ''}.`, r.quality === 'sloppy' ? 'warn' : 'good', 5200);
      return;
    }
    if (r.kind === 'empty') { sfx.softclick(); toast(`Nothing stolen on ${p.name}—not yet, anyway. You slip their own things back.`, 'warn'); return; }
    if (r.kind === 'false') { sfx.brush(); toast(`Only ${p.name}’s own belongings. Wrong passenger—you slip them back with a red face.`, 'danger'); }
  }

  // ---------- returns ----------
  startReturn(p) {
    const entries = this.sim.satchelFor(p);
    if (!entries.length) return;
    const e = entries[0];
    const L = (p.lostItems || []).find(l => l.id === e.item.id);
    const noticed = L && L.discovered;
    const body = el('div', {}, el('div', { class: 'mark-card' }, el('img', { src: iconURL(e.item, 88), alt: '', style: { width: '52px', height: '52px' } }),
      el('div', { style: { flex: 1 } }, el('div', { style: { fontWeight: 600 } }, e.item.name), el('div', { class: 'muted small' }, `${p.name} ${noticed ? 'knows it’s gone' : 'hasn’t noticed yet'}.`))),
      el('p', { class: 'small' }, noticed ? 'Slip it back and they’ll think they mislaid it. Hand it over and they’ll thank you warmly.' : 'Slip it back and they’ll never know it left. Hand it over and they’ll be grateful—and anyone watching will know you’re onto something.'));
    modal({ title: 'Return', body, dismiss: null, buttons: [
      { label: 'Slip it back', value: 'plant', kind: 'primary', sub: 'Discreet · best reward' },
      { label: 'Hand it over', value: 'hand', sub: '“I believe you dropped this”' }, { label: 'Not yet', value: null }] }).then(v => {
      if (v === 'hand') this.finishReturn(p, e, 'hand', null);
      if (v === 'plant') {
        const odds = this.sim.liftOdds(p);
        const pocket = p.female ? 'handbag' : rand.pick(['hip', 'breast']);
        this.openMini(cv => new PlantGame(cv, {
          S: this.S, item: e.item, look: p.look, female: p.female, act: p.act, aware: p.aware, rarityIdx: 0, pocket,
          start: odds.start * (this.S.upgrades.craft_feather ? 0.6 : 0.85), glanceMul: 1, patience: 26, techName: 'The Plant',
          title: `THE PLANT — ${e.item.name}`, subtitle: p.name,
        }), res => { if (res.aborted) { toast('You keep it for now.', 'info', 1600); return; } this.finishReturn(p, e, 'plant', res); });
      }
    });
  }
  finishReturn(p, e, how, res) {
    const rec = this.sim.applyReturn(p, e, how, res);
    sfx.ret(); haptic(25);
    const rare = RARITY_ORDER.indexOf(e.item.rarity) >= 3;
    if (how === 'plant' && res && !res.success) toast(`${p.name} feels your hand. You explain it’s theirs—awkward, but it’s home.`, 'warn', 5000);
    else if (rec.unaware) toast(`${e.item.name} is back where it belongs. ${p.name} never knew it was gone.`, 'good', 5200);
    else if (how === 'plant') toast(`${p.name} pats a pocket and finds their ${itemNoun(e.item)}. “Well I never!”`, 'good', 5000);
    else { this.ctl.favours += 1; toast(`${p.name} is overjoyed. Word of a kind inspector gets around. (+1 favour)`, 'good', 5000); }
    if (rare) { setTimeout(() => sfx.success(true), 300); toast(`A ${RARITY[e.item.rarity].name.toLowerCase()} piece, safely home.`, 'event', 4000); }
  }

  // ---------- notebook & satchel ----------
  openNotebook() {
    if (this.blocked()) return;
    const run = this.run;
    const body = el('div', { class: 'pockets' });
    const ev = evaluateMission(run, this.mission, false);
    const og = el('div', {}, el('h4', {}, this.mission.title));
    for (const g of ev.goals.concat(ev.optional)) og.append(el('div', { class: 'small obj ' + g.status }, (g.status === 'done' ? '✓ ' : g.status === 'failed' ? '✗ ' : '○ ') + g.text + (g.optional ? ' (optional)' : '')));
    body.append(og);
    const people = run.pax.filter(p => (p.clue || 0) > 0).sort((a, b) => (b.clue || 0) - (a.clue || 0));
    const pg = el('div', {}, el('h4', {}, 'Persons of interest'));
    if (!people.length) pg.append(el('p', { class: 'muted small' }, 'Nobody yet. Watch hands, not faces.'));
    for (const p of people) {
      const TH = p.thief;
      const status = p.left ? (p.arrested ? 'Arrested' : 'Left the train') : p.identified ? 'IDENTIFIED' : `${Math.min(3, p.clue)}/3 clues`;
      const box = el('div', { class: 'note-card' + (p.identified ? ' id' : '') },
        el('div', { class: 'row' }, el('b', {}, p.name), el('span', { class: 'tag' + (p.identified ? ' red' : '') }, status), el('span', { class: 'muted small' }, run.carriages[p.car] ? run.carriages[p.car].name : '')));
      if (p.identified && TH && TH.rogue) box.append(el('div', { class: 'small', style: { color: '#ffb0a8' } }, `“${ROGUES[TH.rogue].alias}” — ${TECHNIQUES[TH.tech].name}`));
      for (const n of p.notes || []) box.append(el('div', { class: 'small' }, '• ' + n));
      if (TH) for (const l of TH.loot.filter(x => x.known)) box.append(el('div', { class: 'small', style: { color: '#ffd793' } }, `Carrying ${ownedName(l.ownerName, l.item)} — ${pocketName(l.pocket)}`));
      pg.append(box);
    }
    body.append(pg);
    const lost = run.pax.filter(p => (p.lostItems || []).some(l => l.discovered && !l.returned));
    if (lost.length) {
      const lg = el('div', {}, el('h4', {}, 'Reported stolen'));
      for (const p of lost) for (const l of p.lostItems.filter(x => x.discovered && !x.returned)) lg.append(el('div', { class: 'small' }, `${p.name}: ${l.name}${p.left ? ' (left the train)' : ''}`));
      body.append(lg);
    }
    this.paused = true;
    modal({ title: 'Notebook', body, cls: 'wide', dismiss: true, buttons: [{ label: 'Close', value: true }] }).then(() => { this.paused = false; });
  }
  openSatchel() {
    if (this.blocked()) return;
    const run = this.run;
    const body = el('div', { class: 'pockets' });
    body.append(el('h4', {}, `Lost-property satchel ${run.satchel.length}/${satchelCap(this.S)}`));
    if (!run.satchel.length) body.append(el('p', { class: 'muted small' }, 'Empty. Recover something.'));
    for (const e of run.satchel) {
      const owner = this.sim.paxById.get(e.ownerId);
      body.append(el('div', { class: 'pocket-row' }, el('img', { src: iconURL(e.item, 80), alt: '' }),
        el('div', { class: 'nm' }, e.item.name, el('div', { class: 'small muted' }, `Belongs to ${e.ownerName}${owner && !owner.left ? ` · ${run.carriages[owner.car].name}` : ' · left the train'}`))));
    }
    if (run.returned.length) body.append(el('p', { class: 'small', style: { color: '#a8e8b0' } }, `Returned this shift: ${run.returned.length}`));
    this.paused = true;
    modal({ title: 'Satchel', body, dismiss: true, buttons: [{ label: 'Close', value: true }] }).then(() => { this.paused = false; });
  }

  // ---------- minigames ----------
  openMini(make, onResult) {
    this.joy = null; this.updateJoyEl(); this.keys.clear(); this.obsHeld = false;
    this.miniCv.hidden = false; this.miniUi.hidden = false;
    document.body.classList.add('mini-open');
    let fired = false;
    const game = make(this.miniCv);
    game.o.onDone = res => {
      if (fired) return; fired = true;
      setTimeout(() => { if (this.ended) return; this.closeMini(); onResult(res); }, res.aborted ? 50 : 650);
    };
    this.mini = game;
  }
  closeMini() {
    if (this.mini) this.mini.destroy();
    this.mini = null;
    this.miniCv.hidden = true; this.miniUi.hidden = true;
    document.body.classList.remove('mini-open');
  }

  // ================= HUD =================
  buildHud() {
    const hud = document.getElementById('hud');
    this.hud = hud; hud.innerHTML = ''; hud.hidden = false;
    const touch = matchMedia('(hover: none)').matches;
    const pauseB = el('button', { class: 'btn ghost hud-pause', 'aria-label': 'Pause' }, '❚❚');
    pauseB.addEventListener('click', () => this.pause());
    const h = this.h = {};
    h.st = el('div', { class: 'st' }, '');
    h.leg = meter(0);
    h.suspLvl = el('span', {}, 'Unremarkable');
    h.suspLbl = el('div', { class: 'lbl' }, el('span', { class: 'pre' }, 'Suspicion: '), h.suspLvl);
    h.suspM = meter(0);
    h.susp = el('div', { class: 'hud-heat heat-0' }, h.suspLbl, h.suspM);
    h.sat = el('div', { class: 'cash' }, '');
    h.pk = el('div', { class: 'pk' }, '');
    const top = el('div', { class: 'hud-top' }, pauseB, el('div', { class: 'hud-journey' }, el('div', { class: 'tn' }, this.tr.name), h.st, h.leg), h.susp, el('div', { class: 'hud-purse' }, h.sat, h.pk));
    h.map = el('div', { class: 'hud-map' });
    const W = this.run.worldW;
    this.segs = new Map();
    for (const car of this.run.carriages) {
      const seg = el('div', { class: 'seg' + (this.sim.belongsHere(car) ? '' : ' restricted') });
      seg.style.position = 'absolute'; seg.style.left = (car.x0 / W * 100) + '%'; seg.style.width = (car.w / W * 100) + '%';
      this.segs.set(car.idx, seg); h.map.append(seg);
    }
    h.me = el('div', { class: 'dot me' }); h.map.append(h.me);
    h.dots = [];
    h.obj = el('button', { class: 'hud-obj', 'aria-label': 'Objectives' });
    h.obj.addEventListener('click', () => this.openNotebook());
    h.badges = el('div', { class: 'hud-badges' });
    h.target = el('div', { class: 'hud-target' });
    h.act = el('button', { class: 'btn btn-act none' }, '—');
    h.act.addEventListener('pointerdown', e => { e.preventDefault(); this.doAction(0); });
    h.act2 = el('button', { class: 'btn btn-act2' }, '');
    h.act2.addEventListener('pointerdown', e => { e.preventDefault(); this.doAction(1); });
    h.obs = el('button', { class: 'btn btn-observe' }, 'Observe');
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('viewBox', '0 0 100 100');
    ring.innerHTML = '<circle cx="50" cy="50" r="46" fill="none" stroke="#a8e8b0" stroke-width="5" stroke-dasharray="289" stroke-dashoffset="289" stroke-linecap="round"/>';
    h.obs.append(ring); h.obsRing = ring.firstChild;
    if (!touch) h.obs.append(el('span', { class: 'kbd' }, 'hold Q'));
    const obsOn = e => { e.preventDefault(); this.obsHeld = true; h.obs.classList.add('on'); try { h.obs.setPointerCapture(e.pointerId); } catch (_) {} };
    const obsOff = () => { this.obsHeld = false; h.obs.classList.remove('on'); };
    h.obs.addEventListener('pointerdown', obsOn); h.obs.addEventListener('pointerup', obsOff);
    h.obs.addEventListener('pointercancel', obsOff); h.obs.addEventListener('lostpointercapture', obsOff);
    const small = (label, key, fn) => { const b = el('button', { class: 'btn ghost' }, label, touch ? null : el('span', { class: 'kbd' }, key)); b.addEventListener('click', fn); return b; };
    h.noteB = small('Notebook', 'N', () => this.openNotebook());
    h.satB = small('Satchel', 'B', () => this.openSatchel());
    h.whB = small('Whistle', 'H', () => this.useWhistle());
    const acts = el('div', { class: 'hud-acts' }, el('div', { class: 'small-row' }, h.whB, h.noteB, h.satB), el('div', { class: 'act-row' }, h.obs, el('div', { class: 'act-stack' }, h.act2, h.act)));
    const hint = el('div', { class: 'hud-hint' }, touch ? '' : 'WASD walk · Shift hurry · E act · R alt · Q observe · N notebook');
    hud.append(top, h.map, h.obj, h.badges, h.target, acts, hint);
  }
  // the big button never offers an unfounded lift; that's always a deliberate second choice
  actionPair() {
    const acts = this.sim.actions || [];
    const a = acts.find(x => !x.secondaryOnly) || null;
    const b = acts.find(x => x !== a) || null;
    return [a, b];
  }
  updateActButtons() {
    const h = this.h;
    const blocked = this.blocked();
    const [pa, pb] = this.actionPair();
    const a = !blocked && pa, b = !blocked && pb;
    let label = '—', cls = 'btn btn-act none';
    if (a) { label = a.label; cls = 'btn btn-act k-' + a.kind; if (a.kind === 'lift') cls += ' q-' + this.sim.liftOdds(a.p).q; }
    if (h.act._l !== label) { h.act._l = label; h.act.textContent = label; }
    if (h.act.className !== cls) h.act.className = cls;
    const l2 = b ? b.label : '';
    if (h.act2._l !== l2) { h.act2._l = l2; h.act2.textContent = l2; }
    h.act2.hidden = !b;
    h.obsRing.setAttribute('stroke-dashoffset', String(289 * (1 - (this.sim.observeT || 0))));
  }
  updateHud() {
    const run = this.run, sim = this.sim, S = this.S, P = run.player, tr = this.tr, h = this.h;
    const next = tr.stations[Math.min(run.leg + 1, tr.stations.length - 1)];
    let st, prog;
    if (run.phase === 'station') { st = `${tr.stations[run.leg]} · departing in ${Math.ceil(run.stationT)}s`; prog = 1; }
    else if (run.phase === 'arriving') { st = `Arriving: ${next}`; prog = 1; }
    else if (run.phase === 'departing') { st = `Departing ${tr.stations[run.leg]}`; prog = 0; }
    else { st = `Next: ${next} · stop ${run.leg + 1} of ${tr.legs}`; prog = run.legT / tr.legTime; }
    if (h.st.textContent !== st) h.st.textContent = st;
    h.leg.firstChild.style.width = Math.round(clamp(prog, 0, 1) * 100) + '%';
    const lvl = Math.min(3, Math.floor(run.susp / 25));
    h.susp.className = 'hud-heat heat-' + lvl;
    h.suspLvl.textContent = SUSPICION_LEVELS[lvl];
    h.suspM.firstChild.style.width = Math.round(run.susp) + '%';
    h.sat.textContent = `Satchel ${run.satchel.length}/${satchelCap(S)}`;
    h.pk.textContent = `Returned ${run.returned.length}${run.reprimands ? ` · reprimands ${run.reprimands}/3` : ''}`;
    const W = run.worldW, curCar = sim.carAt(P.x);
    for (const car of run.carriages) this.segs.get(car.idx).classList.toggle('cur', car === curCar);
    h.me.style.left = (P.x / W * 100) + '%';
    const marks = [];
    const owners = new Set(run.satchel.map(e => e.ownerId));
    for (const p of run.pax) {
      if (p.left) continue;
      if (p.identified) marks.push([p.x, 'cop']);
      else if (owners.has(p.id)) marks.push([p.x, 'own']);
      else if (p.missionVip) marks.push([p.x, 'vip']);
    }
    while (h.dots.length < marks.length) { const d = el('div', { class: 'dot' }); h.map.append(d); h.dots.push(d); }
    h.dots.forEach((d, i) => { const m = marks[i]; d.hidden = !m; if (m) { d.style.left = (m[0] / W * 100) + '%'; d.className = 'dot ' + m[1]; } });
    const ev = evaluateMission(run, this.mission, false);
    const done = ev.goals.filter(g => g.status === 'done').length;
    const key = ev.goals.map(g => g.status).join('') + ev.optional.map(g => g.status).join('');
    if (key !== this._objKey) {
      this._objKey = key;
      h.obj.innerHTML = '';
      h.obj.append(el('span', { class: 'ot' }, this.mission.title), el('span', { class: 'oc' }, ` ${done}/${ev.goals.length}`));
      const cur = ev.goals.find(g => g.status === 'open');
      if (cur) h.obj.append(el('span', { class: 'og' }, ' · ' + cur.text));
    }
    const badges = [];
    const it = sim.interact;
    if (!sim.belongsHere(curCar)) badges.push(['red', 'Not your beat']);
    if (it && it.p && it.p.ticketCoverT > 0) badges.push(['green', 'Ticket cover']);
    if (run.whistleT > 0) badges.push(['green', 'Whistle — all eyes away']);
    if (run.tunnelT > 0) badges.push(['', 'Tunnel — thieves love the dark']);
    if (run.joltT > 0) badges.push(['green', 'Jolt — hands masked']);
    const bk = badges.map(b => b.join(':')).join('|');
    if (bk !== this._badgeKey) { this._badgeKey = bk; h.badges.innerHTML = ''; for (const [c, tx] of badges) h.badges.append(el('span', { class: 'tag ' + c }, tx)); }
    h.whB.hidden = !S.upgrades.net_whistle; h.whB.disabled = !!run.whistleUsed;
    h.satB.firstChild.textContent = run.satchel.length ? `Satchel ${run.satchel.length}` : 'Satchel';
    const p = (it && it.p) || sim.obsCandidate;
    const tg = h.target;
    if (!p) { tg.style.opacity = 0; this._tgKey = null; return; }
    tg.style.opacity = 1;
    const A = ARCHETYPES[p.arch] || {};
    const tkey = [p.id, p.observed, p.items.length, p.act, p.clue, p.identified, p.ticketChecked, (p.notes || []).length, p.thief ? p.thief.loot.filter(l => l.known).length : 0].join(':');
    if (tkey !== this._tgKey) {
      this._tgKey = tkey;
      tg.innerHTML = '';
      const title = p.informant ? 'Your informant' : p.missionVip ? 'Under your protection' : p.staff ? 'Railway staff' : (A.title || 'Passenger');
      tg.append(el('div', { class: 'ti' }, title), el('div', { class: 'nm' }, p.name, p.identified ? el('span', { class: 'idtag' }, ' IDENTIFIED') : null),
        el('div', { class: 'act' }, (ACTIVITY_INFO[p.act] || ACTIVITY_INFO.idle).label + (p.ticketChecked && p.ticket ? ` · ${p.ticket.text}` : '')));
      if (!p.staff) {
        const pips = el('div', { class: 'pips' });
        for (let i = 0; i < 3; i++) pips.append(el('span', { class: i < (p.clue || 0) ? 'on' : '' }));
        pips.append(el('span', { class: 'lbl' }, p.identified ? 'Thief' : (p.clue ? 'Clues' : 'No clues')));
        tg.append(pips);
      }
      const known = p.thief ? p.thief.loot.filter(l => l.known) : [];
      if (known.length) tg.append(el('div', { class: 'loot' }, known.map(l => `${l.ownerName}’s ${itemNoun(l.item)} → ${pocketName(l.pocket)}`).join('; ')));
      else if (p.notes && p.notes.length) tg.append(el('div', { class: 'note' }, p.notes[p.notes.length - 1]));
      else if (!p.observed && !p.staff) tg.append(el('div', { class: 'note muted' }, 'Hold Observe to study them'));
      if (p.observed && p.items.length) { const its = el('div', { class: 'its' }); for (const x of p.items.slice(0, 5)) its.append(el('img', { src: iconURL(x, 52), alt: x.name, title: x.name })); tg.append(its); }
    }
  }

  // ================= ending =================
  finish(reason) {
    const run = this.run, S = this.S, tr = this.tr;
    this.closeMini(); closeModal(null, true);
    for (const e of run.satchel) run.lostProperty.push({ ...e, why: 'unreturned' });
    run.satchel = [];
    const ev = evaluateMission(run, this.mission, true);
    const thieves = run.pax.filter(p => p.thief);
    const result = {
      reason, routeId: tr.id, routeName: tr.name, date: run.date, missionId: this.mission.id, missionTitle: this.mission.title, patrol: !!this.mission.patrol,
      station: reason === 'arrived' ? tr.stations[tr.legs] : tr.stations[Math.min(run.leg + 1, tr.legs)],
      goals: ev.goals, optional: ev.optional, stars: ev.stars, success: ev.success,
      returned: run.returned.map(r => ({ ...r })), escaped: run.escaped.map(e => ({ item: e.item, ownerName: e.ownerName, thief: e.thief })),
      lostProperty: run.lostProperty.map(e => ({ item: e.item, ownerName: e.ownerName, why: e.why })),
      ditched: run.carriages.flatMap(c => c.props).filter(pr => pr.stash && pr.stash.length).flatMap(pr => pr.stash.map(l => ({ item: l.item, ownerName: l.ownerName }))),
      thieves: thieves.map(p => ({ name: p.name, rogue: p.thief.rogue, tech: p.thief.tech, identified: !!p.identified, arrested: !!p.arrested, struck: p.thief.strikes, notes: (p.notes || []).slice(-3) })),
      recovered: run.recovered, tickets: run.tickets, helped: run.helped, falseLifts: run.falseLifts, emptyLifts: run.emptyLifts, failedLifts: run.failedLifts,
      witnessed: run.witnessed, suspPeak: Math.round(run.suspPeak), reprimands: run.reprimands, favours: this.ctl.favours, observed: run.stats.observed || 0,
      thefts: run.thefts.length, uniform: run.uniform,
    };
    S.run = null; S.pending = result; this.cb.persist();
    if (reason === 'relieved') stopTrainAmbience();
    this.cb.onEnd(result);
  }
}

function toggleBtn(label, get, set) {
  const b = el('button', { class: 'btn small' + (get() ? ' sel' : '') }, `${label}: ${get() ? 'On' : 'Off'}`);
  b.addEventListener('click', () => { set(!get()); b.textContent = `${label}: ${get() ? 'On' : 'Off'}`; b.classList.toggle('sel', get()); sfx.ui(); });
  return b;
}

export function showHelp() {
  const touch = matchMedia('(hover: none)').matches;
  return modal({
    title: 'How to work a train', cls: 'wide', dismiss: true,
    body: `
<p><b>You are Ambrose Tull, ticket inspector.</b> Thirty years on the line taught you every trick the pickpockets know. Now you use them to take stolen things back—and return them before anyone is the wiser.</p>
<p><b>Patrol</b> — ${touch ? 'drag anywhere to walk (further to hurry)' : 'WASD / arrows to walk, Shift to hurry'}. Checking tickets (${touch ? 'round button' : 'E'}) is your cover: it calms suspicion and puts you right beside anyone.</p>
<p><b>Observe</b> — hold ${touch ? 'OBSERVE' : 'Q'} near someone to study them. Thieves give themselves away: lingering by a mark, odd tickets, glances at a partner. Three clues and they’re <b>identified</b>. Some honest people just behave strangely.</p>
<p><b>Witness</b> — keep your eyes on the carriage. Catch a lift as it happens and you’ll know the thief and the pocket at once.</p>
<p><b>The Double Lift</b> — get close and lift the stolen item back. Best of all while they’re busy working their next mark. Lifting from an honest passenger costs you dearly.</p>
<p><b>Return</b> — green markers show whose belongings you carry. Slip it back unnoticed for the best reward, or simply hand it over.</p>
<p><b>Suspicion</b> — hovering, staring and hurrying get you talked about. Too much and the Superintendent takes you aside. Duties, kindness and returns calm things down.</p>`,
    buttons: [{ label: 'To work', value: true, kind: 'primary' }],
  });
}
