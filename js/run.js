// LIFT — in-run controller: camera, rendering, input, HUD, interactions, minigames
import { generateRun, playerLook, T, FLOOR_H, WALL_H } from './world/gen.js';
import { Sim } from './world/sim.js';
import {
  buildCarriageLayer, drawGangway, drawFrontLip, drawWheels, drawScenery, drawProp, propSortY,
  drawCone, drawEye, drawHandMarker, drawSparkle, drawCharacter, drawBubble, TOP, BOTTOM,
} from './world/render.js';
import { makeLiftGame } from './mini/pickpocket.js';
import { LockGame } from './mini/lockpick.js';
import { iconURL } from './world/icons.js';
import { TRAINS, ARCHETYPES, ACTIVITY_INFO, CATEGORIES, RARITY, RARITY_ORDER, TECH_INFO, OUTFITS } from './data/content.js';
import { clamp, dist, el, money, shade, haptic, rand } from './util.js';
import {
  sfx, startTrainAmbience, stopTrainAmbience, setMood, whistle,
} from './audio.js';
import { toast, modal, closeModal, modalOpen, meter } from './ui.js';

const WORLD_H = BOTTOM - TOP;
const HEAT_NAMES = ['Calm', 'Whispers', 'Investigation', 'Lockdown'];
const MOVING_STATES = new Set(['walk', 'leaving', 'chase', 'approach', 'respond', 'hunt', 'patrol', 'flee', 'rival', 'post']);

export class RunController {
  constructor(S, trainId, cb) {
    this.S = S; this.cb = cb;
    this.tr = TRAINS[trainId];
    this.run = generateRun(trainId, S);
    this.run.stash = this.run.stash || [];
    this.held = [];             // items an informant holds for you
    this.goodwillGain = 0;
    this.flourishes = S.upgrades.distract_cards ? 3 : 0;
    this.time = 0; this.hudT = 0; this.endReason = null; this.ended = false;
    this.paused = false; this.mini = null; this.reflex = null;
    this.seenCars = new Set();
    this.tips = !S.tutorial.done;
    this.tipStep = 0; this.tipT = 0;
    this.warned = {};
    this.coinFx = null;
    this.lookCache = new Map();
    this.layers = new Map();
    const P = this.run.player;
    this.homePos = { x: P.x, y: P.y };
    this.sim = new Sim(this.run, S, {
      toast: (t, k) => this.toast(t, k),
      end: r => this.queueEnd(r),
      enterCarriage: car => this.onEnterCarriage(car),
      search: (p, why) => this.onSearch(p, why),
      chaseCaught: p => this.onChaseCaught(p),
      chaseEscaped: p => { this.toast('You’ve given them the slip.', 'good'); setMood('calm'); },
      rival: r => this.onRival(r),
      observed: (p, intel) => this.onObserved(p, intel),
    });
    this.seenCars.add(P.car);

    this.cv = document.getElementById('world');
    this.c = this.cv.getContext('2d');
    this.miniCv = document.getElementById('mini');
    this.miniUi = document.getElementById('miniUi');
    this.input = { mx: 0, my: 0, hurry: false, observe: false };
    this.keys = new Set();
    this.joy = null; this.obsHeld = false;
    this.cam = { x: P.x - 300, shakeX: 0, shakeY: 0 };
    this.buildHud();
    this.bind();
    this.resize();
    this.cam.x = this.targetCamX();
    startTrainAmbience(this.tr.time === 'night');
    setMood('calm');
    whistle(true);
    setTimeout(() => this.toast(`${this.tr.name} departs ${this.tr.stations[0]}. Next stop: ${this.tr.stations[1]}.`, 'event'), 400);
    if (this.tips) this.tipT = 1.2;
  }

  // ================= lifecycle =================
  destroy() {
    this.ended = true;
    this.unbind();
    if (this.mini) { this.mini.destroy(); this.mini = null; }
    this.miniCv.hidden = true; this.miniUi.hidden = true;
    this.hud.hidden = true; this.hud.innerHTML = '';
    if (this.joyEl) this.joyEl.remove();
    stopTrainAmbience();
    document.documentElement.style.removeProperty('--toast-top');
    const c = this.c; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height);
  }
  blocked() { return this.paused || !!this.mini || modalOpen() || !!this.endReason; }
  queueEnd(reason) { if (!this.endReason) this.endReason = reason; }

  frame(dt) {
    if (this.ended) return;
    this.time += dt;
    if (this.reflex) this.updateReflex(dt);
    if (this.mini) {
      this.mini.update(dt);
      this.mini.draw();
      return;
    }
    if (!this.blocked()) {
      this.readInput();
      this.sim.update(dt, this.input);
      this.postUpdate(dt);
    }
    if (this.endReason && !this.finishing) { this.finishing = true; this.finish(this.endReason); return; }
    this.render(dt);
    this.hudT -= dt;
    if (this.hudT <= 0) { this.updateHud(); this.hudT = 0.12; }
    this.updateActButton();
  }

  pause(fromHide = false) {
    if (this.ended || this.endReason || this.mini || modalOpen()) return;
    this.paused = true;
    const S = this.S;
    const body = el('div', {},
      el('p', { class: 'muted small', style: { textAlign: 'center' } }, `${this.tr.name} · ${this.run.date}`),
      el('div', { class: 'row', style: { justifyContent: 'center', margin: '6px 0' } },
        toggleBtn('Sound', () => S.settings.sound, v => { S.settings.sound = v; this.cb.onSettings(); }),
        toggleBtn('Music', () => S.settings.music, v => { S.settings.music = v; this.cb.onSettings(); }),
      ),
    );
    modal({
      title: 'Paused', body, dismiss: 'resume',
      buttons: [
        { label: 'Resume', value: 'resume', kind: 'primary' },
        { label: 'How to play', value: 'help' },
        { label: 'Abandon train', value: 'quit', kind: 'danger', sub: 'Lose what you carry' },
      ],
    }).then(v => {
      this.paused = false;
      if (v === 'help') { this.paused = true; showHelp().then(() => { this.paused = false; }); }
      else if (v === 'quit') {
        modal({ title: 'Abandon the train?', body: '<p>You’ll jump at the next signal stop. Anything in your pockets or valise stays behind, and half your cash spills on the ballast.</p>', buttons: [{ label: 'Stay aboard', value: false }, { label: 'Jump', value: true, kind: 'danger' }], dismiss: false })
          .then(ok => { if (ok) this.queueEnd('abandoned'); });
      }
    });
  }

  // ================= input =================
  bind() {
    this._kd = e => this.onKey(e, true);
    this._ku = e => this.onKey(e, false);
    this._resize = () => this.resize();
    this._blur = () => { this.keys.clear(); this.obsHeld = false; this.joy = null; this.updateJoyEl(); };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('resize', this._resize);
    window.addEventListener('blur', this._blur);
    this._pd = e => this.onPointerDown(e);
    this._pm = e => this.onPointerMove(e);
    this._pu = e => this.onPointerUp(e);
    this.cv.addEventListener('pointerdown', this._pd);
    window.addEventListener('pointermove', this._pm);
    window.addEventListener('pointerup', this._pu);
    window.addEventListener('pointercancel', this._pu);
    this._abort = () => { if (this.mini && !this.mini.done) this.mini.abort(); };
    document.getElementById('miniAbort').addEventListener('click', this._abort);
  }
  unbind() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('resize', this._resize);
    window.removeEventListener('blur', this._blur);
    this.cv.removeEventListener('pointerdown', this._pd);
    window.removeEventListener('pointermove', this._pm);
    window.removeEventListener('pointerup', this._pu);
    window.removeEventListener('pointercancel', this._pu);
    document.getElementById('miniAbort').removeEventListener('click', this._abort);
  }
  onKey(e, down) {
    if (this.ended) return;
    const k = e.code;
    if (down && modalOpen()) return; // modal handles its own keys
    if (this.mini) { if (down && k === 'Escape') this._abort(); return; }
    if (down) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      if (e.repeat) { this.keys.add(k); return; }
      if (k === 'KeyE' || k === 'Space' || k === 'Enter') { this.doInteract(); return; }
      if (k === 'Escape' || k === 'KeyP') { this.pause(); return; }
      if (k === 'KeyF') { this.useCoin(); return; }
      if (k === 'KeyG') { this.useIncident(); return; }
      if (k === 'KeyC') { this.useFlourish(); return; }
      if (k === 'KeyI' || k === 'Tab') { e.preventDefault(); this.openPockets(); return; }
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
    // drag the base along if the finger goes far
    const dx = this.joy.x - this.joy.x0, dy = this.joy.y - this.joy.y0, d = Math.hypot(dx, dy), max = 80;
    if (d > max) { this.joy.x0 = this.joy.x - dx / d * max; this.joy.y0 = this.joy.y - dy / d * max; }
    this.updateJoyEl();
  }
  onPointerUp(e) {
    if (this.joy && e.pointerId === this.joy.id) { this.joy = null; this.updateJoyEl(); }
  }
  updateJoyEl() {
    if (!this.joyEl) { this.joyEl = el('div', { class: 'joy' }, el('div', { class: 'nub' })); document.getElementById('app').append(this.joyEl); }
    const j = this.joy;
    this.joyEl.hidden = !j;
    if (!j) return;
    this.joyEl.style.left = j.x0 + 'px'; this.joyEl.style.top = j.y0 + 'px';
    const dx = clamp(j.x - j.x0, -60, 60), dy = clamp(j.y - j.y0, -60, 60);
    this.joyEl.firstChild.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // ================= view =================
  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr; this.W = W; this.H = H;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    const topH = 82, botH = H > W ? 150 : 40;
    const availH = Math.max(160, H - topH - botH);
    this.scale = clamp(Math.min(availH / WORLD_H, W / 300), 0.7, 3.2);
    this.viewW = W / this.scale;
    const portrait = H > W * 1.15;
    this.offY = portrait ? topH + 6 : topH + Math.max(0, (availH - WORLD_H * this.scale) / 2);
    const below = this.offY + WORLD_H * this.scale + 8;
    document.documentElement.style.setProperty('--toast-top', portrait && H - below > 200 ? below + 'px' : '');
    const ls = Math.min(2.5, this.scale * dpr);
    if (ls !== this.layerScale) { this.layerScale = ls; this.layers.clear(); }
    if (this.mini) this.mini.layout();
  }
  targetCamX() {
    const P = this.run.player, worldW = this.run.worldW;
    const look = P.dir === 'r' ? 40 : P.dir === 'l' ? -40 : 0;
    let x = P.x + look - this.viewW / 2;
    if (worldW <= this.viewW) return (worldW - this.viewW) / 2;
    return clamp(x, -20, worldW - this.viewW + 20);
  }
  layerFor(car) {
    let L = this.layers.get(car.idx);
    if (!L) { L = buildCarriageLayer(car, this.layerScale, this.tr); this.layers.set(car.idx, L); }
    return L;
  }
  worldToScreen(x, y) { return [(x - this.cam.x) * this.scale, this.offY + (y - TOP) * this.scale]; }

  render(dt) {
    const c = this.c, run = this.run, S = this.S, sim = this.sim, P = run.player;
    const tgt = this.targetCamX();
    this.cam.x += (tgt - this.cam.x) * Math.min(1, dt * 5);
    const shake = sim.shake || 0;
    const sx = shake > 0 ? (Math.random() - 0.5) * 6 * shake : 0, sy = shake > 0 ? (Math.random() - 0.5) * 4 * shake : 0;
    const sway = run.speed > 0.1 ? Math.sin(this.time * 7.3) * 0.6 * run.speed : 0;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#120c09'; c.fillRect(0, 0, this.W, this.H);
    const k = this.scale * this.dpr;
    c.setTransform(k, 0, 0, k, -this.cam.x * k + sx * this.dpr, (this.offY - TOP * this.scale) * this.dpr + (sy + sway) * this.dpr);
    const vx0 = this.cam.x - 60, vx1 = this.cam.x + this.viewW + 60;
    const t = this.time;

    // scenery (behind window holes)
    c.save(); c.beginPath(); c.rect(Math.max(0, vx0), TOP, Math.min(run.worldW, vx1) - Math.max(0, vx0), WORLD_H); c.clip();
    drawScenery(c, run, vx0, vx1, t);
    c.restore();

    const cars = run.carriages.filter(car => car.x0 + car.w > vx0 && car.x0 < vx1);
    for (const car of cars) c.drawImage(this.layerFor(car), car.x0, TOP, car.w, WORLD_H);
    for (const d of run.doors) if (d.x1 > vx0 && d.x0 < vx1) drawGangway(c, d, run, t);

    // depth-sorted drawables
    const list = [];
    const myCarIdx = run.carriages.find(cc => cc.seats.some(s => s.id === run.playerSeat))?.idx;
    for (const car of cars) for (const pr of car.props) {
      if (pr.x + pr.w < vx0 - 40 || pr.x > vx1 + 40) continue;
      const opts = {};
      if (pr.kind === 'lav') opts.hideHere = this.hideLav === pr;
      if (pr.kind === 'rack') opts.mine = car.idx === myCarIdx;
      if (pr.kind === 'cache') opts.reveal = true;
      list.push({ y: propSortY(pr), f: () => drawProp(c, pr, car, run, t, opts) });
    }
    for (const p of run.pax) {
      if (p.left || p.state === 'hidden' || p.x < vx0 - 40 || p.x > vx1 + 40) continue;
      list.push({ y: p.y + (p.state === 'seated' ? 0.5 : 1), f: () => this.drawPax(c, p) });
    }
    if (!P.hidden) list.push({ y: P.y + 1, f: () => this.drawPlayer(c) });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.f();

    for (const car of cars) { drawFrontLip(c, car); drawWheels(c, car, (run.dist || 0) * 0.045); }

    // overlays: cones, eyes, sparkles, bubbles, markers
    this.drawOverlays(c, vx0, vx1);

    // coin
    if (run.coinFx) {
      const f = run.coinFx; f.t += dt * 2.6;
      const u = Math.min(1, f.t), x = f.x + (f.tx - f.x) * u, y = f.y + (f.ty - f.y) * u - Math.sin(u * Math.PI) * 40;
      c.fillStyle = '#e8cf86'; c.beginPath(); c.ellipse(x, y - 10, 2.6, 2.6 * Math.abs(Math.cos(f.t * 12)) + 0.4, 0, 0, Math.PI * 2); c.fill();
      if (f.t > 1.6) run.coinFx = null;
    }

    // night tint & tunnel darkness
    if (this.tr.time === 'night') { c.fillStyle = 'rgba(10,14,40,0.16)'; c.fillRect(vx0, TOP, vx1 - vx0, WORLD_H); }
    if (run.tunnelT > 0) {
      const a = Math.min(1, run.tunnelT, (9 - run.tunnelT) * 2) * 0.72;
      c.save();
      c.fillStyle = `rgba(4,2,1,${a})`;
      c.beginPath(); c.rect(vx0, TOP, vx1 - vx0, WORLD_H);
      c.arc(P.x, P.y - 20, 70, 0, Math.PI * 2, true); c.fill('evenodd');
      const g = c.createRadialGradient(P.x, P.y - 20, 30, P.x, P.y - 20, 72);
      g.addColorStop(0, 'rgba(4,2,1,0)'); g.addColorStop(1, `rgba(4,2,1,${a})`);
      c.fillStyle = g; c.beginPath(); c.arc(P.x, P.y - 20, 72, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  lookFor(p) { return p.look; }
  drawPax(c, p) {
    const moved = p._px != null && (Math.abs(p.x - p._px) + Math.abs(p.y - p._py)) > 0.05;
    p._px = p.x; p._py = p.y;
    const seated = p.state === 'seated';
    const pose = {
      dir: p.dir, walk: moved && (MOVING_STATES.has(p.state) || !seated) ? p.walkPhase : null,
      sit: seated && !p.lie, lie: seated && p.lie, act: p.act, t: p.t || this.time,
      alert: p.act === 'alarmed' || p.state === 'chase', susp: (p.susp || 0) / 100,
      standAct: p.state === 'stand' || p.state === 'perform', happy: p.charmed,
    };
    c.save(); c.translate(p.x, p.y);
    drawCharacter(c, p.look, pose);
    c.restore();
  }
  drawPlayer(c) {
    const P = this.run.player;
    const key = P.outfit + ':' + (P.variant || 0);
    let L = this.lookCache.get(key);
    if (!L) {
      L = playerLook(P.outfit);
      if (P.variant) { L = { ...L, coat: shade(L.coat, 0.28), trim: shade(L.trim, 0.3), scarf: null, hat: L.hat === 'top' ? 'homburg' : 'flatcap' }; }
      this.lookCache.set(key, L);
    }
    c.save(); c.translate(P.x, P.y);
    drawCharacter(c, L, { dir: P.dir, walk: P.moving ? P.walkPhase : null, t: this.time, reach: this.reachT > 0, happy: true });
    c.restore();
    if (this.reachT > 0) this.reachT -= 0.016;
  }
  drawOverlays(c, vx0, vx1) {
    const run = this.run, sim = this.sim, P = run.player, S = this.S, t = this.time;
    const pCar = sim.carAt(P.x);
    for (const p of run.pax) {
      if (p.left || p.state === 'hidden' || p.x < vx0 || p.x > vx1 || p.child) continue;
      const d = dist(p.x, p.y, P.x, P.y);
      const sameCar = sim.carAt(p.x) === pCar;
      const head = p.state === 'seated' ? (p.lie ? 22 : 50) : 62;
      // vision cones: staff always (same carriage), civilians close by
      if (sameCar && !P.hidden && p.act !== 'sleep' && !p.rival) {
        const staff = p.staff === 'conductor' || p.staff === 'detective' || p.staff === 'guard';
        if (staff || (d < 170 && (p.attn > 0.45 || p.glancing > 0))) {
          const danger = p.susp > 50 || p.state === 'chase' || p.state === 'approach';
          c.globalAlpha = staff ? 1 : clamp(p.attn, 0.25, 1);
          drawCone(c, p, sim.faceAngle(p), sim.coneHalf(p), sim.coneRange(p), danger);
          c.globalAlpha = 1;
        }
      }
      // valuables glint
      if (!p.staff && p.items.length && (p.observed || S.upgrades.intel_eye) && sameCar) {
        const best = p.items.reduce((m, it) => Math.max(m, RARITY_ORDER.indexOf(it.rarity)), 0);
        drawSparkle(c, p.x + 12, p.y - head + 18, RARITY[RARITY_ORDER[best]].color === '#8b7e6a' ? '#e8cf86' : RARITY[RARITY_ORDER[best]].color, t + p.x * 0.01, Math.min(3, p.items.length));
      }
      // suspicion eye
      if (sameCar && (p.susp > 4 || p.stirWarn > 0 || (p.glancing > 0 && d < 140) || (p.observed && S.upgrades.intel_profile && d < 160))) {
        drawEye(c, p.x, p.y - head - 8, clamp(p.susp / 100, 0, 1), p.glancing > 0 || p.stirWarn > 0);
        if (p.observed && S.upgrades.intel_profile && p.glancing <= 0 && p.glanceT > 0) {
          const f = clamp(p.glanceT / 10, 0, 1);
          c.strokeStyle = 'rgba(168,232,176,0.8)'; c.lineWidth = 1.2;
          c.beginPath(); c.arc(p.x, p.y - head - 8, 10.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); c.stroke();
        }
      }
      if (p.bubbleT > 0 && p.bubble) drawBubble(c, p.x, p.y - head - (sameCar ? 16 : 6), p.bubble, Math.min(1, p.bubbleT * 2), p.act === 'alarmed' || p.state === 'chase' ? 'alarm' : 'say');
    }
    // interaction marker
    const it = sim.interact;
    if (it && !P.hidden) {
      if (it.kind === 'lift' && it.p) {
        const q = sim.liftQuality(it.p).q;
        const head = it.p.state === 'seated' ? 50 : 62;
        drawHandMarker(c, it.p.x - 14, it.p.y - head + 6, q, t);
      } else {
        let mx, my;
        if (it.p) { mx = it.p.x; my = it.p.y - 66; }
        else if (it.pr) { mx = it.pr.x + it.pr.w / 2; my = it.pr.y - 24; }
        else if (it.door) { mx = it.door.x1 - 6; my = 2 * T - 10; }
        else if (it.key) { const s = run.compState[it.key]; mx = s.rect[0] + s.rect[2] / 2; my = s.rect[1] - 44; }
        if (mx != null) {
          const b = Math.sin(t * 5) * 2;
          c.save(); c.translate(mx, my + b); c.rotate(Math.PI / 4);
          c.fillStyle = 'rgba(25,15,10,0.85)'; c.fillRect(-6, -6, 12, 12);
          c.strokeStyle = '#e8cf86'; c.lineWidth = 1.5; c.strokeRect(-6, -6, 12, 12);
          c.fillStyle = '#e8cf86'; c.fillRect(-2, -2, 4, 4);
          c.restore();
        }
      }
    }
    // observe progress ring around the target
    if (sim.observeTarget && sim.observeT > 0) {
      const p = sim.observeTarget;
      const head = p.state === 'seated' ? 50 : 62;
      c.strokeStyle = '#a8e8b0'; c.lineWidth = 2.2;
      c.beginPath(); c.arc(p.x, p.y - head / 2, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sim.observeT); c.stroke();
    }
  }

  // ================= per-frame game logic around the sim =================
  postUpdate(dt) {
    const run = this.run, S = this.S, P = run.player;
    // tutorial tips
    if (this.tips) {
      this.tipT -= dt;
      if (this.tipT <= 0) {
        const touch = matchMedia('(hover: none)').matches;
        const tips = [
          touch ? 'Drag anywhere to walk. Drag further to hurry (hurrying draws eyes).' : 'Move with WASD or the arrow keys. Hold Shift to hurry—hurrying draws eyes.',
          `Stand near a passenger and hold ${touch ? 'OBSERVE' : 'Q / OBSERVE'} to learn what they carry.`,
          'The hand above a mark shows your opening: green is clean, amber risky, red means they’re watching.',
          'Glowing cones are where people are looking. Stay out of them when you work.',
          'Bank your haul by reaching the end of the line—or step off at any station gangway.',
        ];
        if (this.tipStep < tips.length) { this.toast(tips[this.tipStep], 'tip'); this.tipStep++; this.tipT = 11; }
        else this.tips = false;
      }
    }
    // family warning milestone
    if (S.milestones.family_warn && !this.warned.fam) {
      const cop = run.pax.find(p => (p.state === 'approach' || p.state === 'chase') && !p.left);
      if (cop) { this.warned.fam = 12; this.toast('A child tugs your sleeve: “Conductor’s coming, mister!”', 'tip'); }
    }
    if (this.warned.fam > 0) { this.warned.fam -= dt; if (this.warned.fam <= 0) this.warned.fam = 0; }
    // music mood
    const chasing = run.pax.some(p => p.state === 'chase' && !p.left);
    const tense = chasing || run.heat >= 50;
    if (tense !== this.tense) { this.tense = tense; setMood(tense ? 'tense' : 'calm'); }
    if (chasing) { this.hbT = (this.hbT || 0) - dt; if (this.hbT <= 0) { sfx.heartbeat(); this.hbT = 0.7; } }
  }

  onEnterCarriage(car) {
    if (this.seenCars.has(car.idx)) return;
    this.seenCars.add(car.idx);
    const sim = this.sim;
    let msg = car.name;
    if (sim.inForbidden()) msg += ' — you look out of place here. Staff will notice.';
    this.toast(msg, sim.inForbidden() ? 'warn' : 'info');
  }

  // ================= interactions =================
  doInteract() {
    if (this.blocked()) return;
    const it = this.sim.interact;
    if (!it) { this.toast('Nothing within reach.', 'info', 1500); return; }
    sfx.ui();
    const run = this.run, sim = this.sim;
    switch (it.kind) {
      case 'lift': return this.startLift(it.p);
      case 'lock': return this.startPropLock(it.pr);
      case 'door': return this.startDoorLock(it.door);
      case 'compdoor': return this.startCompLock(it.key);
      case 'lav': return this.useLav(it.pr);
      case 'unhide': sim.hide(false); this.hideLav = null; this.toast('You step out, straightening your tie.', 'info', 2000); return;
      case 'stash': return this.openPockets(true);
      case 'bar': {
        const r = sim.orderDrink();
        if (r.ok) { sfx.cash(); this.toast('A gin fizz. The steward will swear you’ve been at the bar all evening. (Alibi)', 'good'); }
        else this.toast(r.msg, 'warn');
        return;
      }
      case 'cache': return this.lootCache(it.pr);
      case 'exit': return this.stepOff(it.door);
      case 'help': return this.helpFamily(it.p);
      case 'informant': return this.talkInformant(it.p);
    }
  }

  capacity() { return this.sim.capacity(); }
  hasRoom() { const P = this.run.player, cap = this.capacity(); return P.inv.length < cap.slots || P.hiddenInv.length < cap.hidden; }
  pocketItem(item) {
    const P = this.run.player, cap = this.capacity();
    if (P.inv.length < cap.slots) { P.inv.push(item); return 'pocket'; }
    if (P.hiddenInv.length < cap.hidden) { P.hiddenInv.push(item); return 'hidden'; }
    return null;
  }

  // ---------- lifting ----------
  startLift(p) {
    const S = this.S, sim = this.sim;
    const known = p.observed || S.upgrades.intel_eye;
    const q = sim.liftQuality(p);
    const A = ARCHETYPES[p.arch] || {};
    const body = el('div');
    const actLabel = (ACTIVITY_INFO[p.act] || ACTIVITY_INFO.idle).label;
    body.append(el('div', { class: 'mark-card' },
      el('div', { style: { flex: 1 } },
        el('div', { style: { fontWeight: 600, fontSize: '18px' } }, p.name),
        el('div', { class: 'muted small' }, `${A.title || ''} · ${actLabel}`),
      ),
      el('span', { class: 'quality ' + q.q }, q.q === 'good' ? 'Clean opening' : q.q === 'risky' ? 'Risky' : 'They’re watching'),
    ));
    if (q.watchers) body.append(el('p', { class: 'small muted' }, `${q.watchers} other ${q.watchers === 1 ? 'pair of eyes' : 'pairs of eyes'} nearby.`));
    const list = el('div', { class: 'pick-list' });
    const choose = v => closeModal(v);
    const roomy = this.hasRoom();
    const canTech = it => !(CATEGORIES[it.cat] && CATEGORIES[it.cat].tech === 'twist' && !S.upgrades.hand_ring);
    if (known) {
      for (const it of p.items) {
        const tech = CATEGORIES[it.cat].tech;
        const ok = canTech(it) && roomy;
        const b = el('button', { class: 'pick', disabled: !ok || null },
          el('img', { src: iconURL(it, 88), alt: '' }),
          el('div', { class: 't' }, it.name,
            el('small', {}, `${RARITY[it.rarity].name} · ${TECH_INFO[tech].name}${!canTech(it) ? ' — needs The Ring Lift' : !roomy ? ' — pockets full' : ''}`)),
          el('span', { class: 'rar', style: { color: RARITY[it.rarity].color } }, '£' + it.value));
        b.addEventListener('click', () => choose({ item: it }));
        list.append(b);
      }
    } else if (p.items.length) {
      const b = el('button', { class: 'pick', disabled: !roomy || null },
        el('div', { class: 't' }, 'Feel for valuables', el('small', {}, roomy ? 'You don’t know what they carry. Observe first to choose.' : 'Your pockets are full—stash something first.')));
      b.addEventListener('click', () => choose({ blind: true }));
      list.append(b);
    }
    if (p.cash > 0) {
      const b = el('button', { class: 'pick' },
        el('img', { src: iconURL({ id: 'wallet', cat: 'wallet', rarity: 'common', name: 'Wallet' }, 88), alt: '' }),
        el('div', { class: 't' }, known ? `Wallet — £${p.cash}` : 'Wallet', el('small', {}, 'The Dip · cash goes straight to your purse')));
      b.addEventListener('click', () => choose({ wallet: true }));
      list.append(b);
    }
    if (!list.children.length) list.append(el('p', { class: 'muted' }, 'Nothing worth taking.'));
    body.append(list);
    const btns = [{ label: 'Walk away', value: null }];
    if (this.flourishes > 0 && !p.charmed) btns.unshift({ label: 'Card flourish', value: 'flourish', sub: `Charm them first (${this.flourishes} left)` });
    modal({ title: 'Choose your lift', body, buttons: btns, dismiss: null }).then(v => {
      if (!v) return;
      if (v === 'flourish') { this.charm(p); setTimeout(() => this.startLift(p), 120); return; }
      let item, wallet = false;
      if (v.wallet) { wallet = true; item = { id: 'wallet', cat: 'wallet', name: 'Wallet', rarity: 'common', value: p.cash }; }
      else if (v.blind) {
        const opts = p.items.filter(canTech);
        if (!opts.length) { this.toast('Your fingers find only a ring—and you haven’t learnt The Ring Lift.', 'warn'); return; }
        item = rand.pick(opts);
      } else item = v.item;
      this.runLift(p, item, wallet, q);
    });
  }
  charm(p) {
    if (this.flourishes <= 0) return;
    this.flourishes--; p.charmed = true; sfx.card(); setTimeout(() => sfx.card(), 90);
    p.bubble = 'Oh, how clever!'; p.bubbleT = 2.5; p.susp = Math.max(0, p.susp - 20);
    this.toast(`A fan of cards dazzles ${p.name}. Their guard is down for your next lift.`, 'good');
  }
  runLift(p, item, wallet, q) {
    const S = this.S;
    const tech = wallet ? 'dip' : CATEGORIES[item.cat].tech;
    const rarityIdx = Math.max(0, RARITY_ORDER.indexOf(item.rarity));
    this.reachT = 0.6;
    this.openMini(cv => makeLiftGame(cv, {
      S, item, tech, look: p.look, female: p.female, act: p.act, aware: p.aware, rarityIdx,
      start: q.start * (p.charmed ? 0.5 : 1), glanceMul: p.charmed ? 0.5 : 1, patience: 24,
      title: `${TECH_INFO[tech].name.toUpperCase()} — ${item.name}`, subtitle: p.name,
      techName: TECH_INFO[tech].name, hiddenDoc: !!item.consortium || p.arch === 'spy',
    }), res => this.liftResult(p, item, wallet, res));
  }
  liftResult(p, item, wallet, res) {
    const run = this.run, S = this.S, sim = this.sim, P = run.player;
    p.charmed = false;
    if (res.aborted) {
      if ((res.aw || 0) > 55) { p.susp = Math.min(99, p.susp + 30); p.glancing = 1; this.toast(`You pull back—but ${p.name} felt something.`, 'warn'); }
      else this.toast('You ease your hand away. No harm done.', 'info', 2200);
      return;
    }
    if (!res.success) {
      if (S.upgrades.hand_phantom && !run.phantomUsed) {
        run.phantomUsed = true; p.susp = 70; p.bubble = 'Hm? I could have sworn…'; p.bubbleT = 3;
        this.toast('Phantom Fingers! Your hand is simply… gone. They doubt themselves.', 'good');
        return;
      }
      return this.caughtRedHanded(p);
    }
    // success
    const quality = res.quality;
    run.stats.lifts++;
    if (quality === 'clean') run.stats.clean++;
    if (quality === 'critical') { run.stats.clean++; run.stats.critical++; }
    sfx.success(quality === 'critical'); haptic(30);
    const rarityIdx = Math.max(0, RARITY_ORDER.indexOf(item.rarity));
    if (wallet) {
      const cash = p.cash; run.cash += cash; p.cash = 0; sfx.cash();
      this.toast(`${quality === 'critical' ? 'Flawless! ' : ''}Wallet lifted: ${money(cash)}.`, 'good');
    } else {
      p.items = p.items.filter(x => x !== item);
      const where = this.pocketItem(item);
      sfx.discover(rarityIdx);
      this.toast(`${quality === 'critical' ? 'Flawless! ' : quality === 'sloppy' ? 'Sloppy… ' : ''}${item.name} (${RARITY[item.rarity].name})${where === 'hidden' ? ' — tucked in your hidden sleeve' : ''}.`, quality === 'sloppy' ? 'warn' : 'good');
    }
    p.robbed.push({ cat: item.cat, rarityIdx, quality });
    const A = ARCHETYPES[p.arch] || {};
    if (A.poor || p.cls === 'working') run.stats.poor++;
    // when will they notice?
    let dT = quality === 'critical' ? null : quality === 'clean' ? 45 + Math.random() * 70 : 5 + Math.random() * 8;
    if (dT != null) p.discoverT = p.discoverT != null ? Math.min(p.discoverT, dT) : dT;
    if (quality === 'sloppy') { p.susp = Math.min(99, p.susp + 35); }
    // double dip
    if (S.upgrades.hand_double && quality !== 'sloppy' && !p._doubled && (p.items.length || p.cash > 0) && this.hasRoom()) {
      p._doubled = true;
      setTimeout(() => {
        if (this.blocked()) return;
        modal({ title: 'Double Dip?', body: `<p>Your hand is still warm from ${p.name}’s pocket. Go straight back in?</p>`, buttons: [{ label: 'Leave it', value: false }, { label: 'Go back in', value: true, kind: 'primary' }], dismiss: false })
          .then(v => { if (v) this.startLift(p); });
      }, 350);
    }
  }
  caughtRedHanded(p) {
    const run = this.run, sim = this.sim, P = run.player;
    run.stats.fails++;
    p.bubble = rand.pick(['Thief! Stop that man!', 'His hand was in my pocket!', 'Conductor! THIEF!']); p.bubbleT = 4;
    p.act = 'alarmed'; p.actT = 8; p.susp = 100; p.reported = true;
    sfx.caught(); haptic(80);
    sim.shake = 0.6;
    sim.raiseHeat(25, p.car, p.x);
    run.desc = { outfit: P.outfit, variant: P.variant || 0, t: run.t };
    for (const q of run.pax) if (!q.staff && q.car === p.car && !q.left) q.aware = Math.min(1, q.aware + 0.2);
    const sec = run.pax.filter(q => (q.staff === 'conductor' || q.staff === 'detective') && !q.left && q.state !== 'chase')
      .sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x))[0];
    if (sec && Math.abs(sec.x - P.x) < 700) {
      sec.state = 'chase'; sec.chaseT = 14; sec.lostT = 0; sec.path = null; sec.bubble = 'Stop right there!'; sec.bubbleT = 2.5;
      this.toast(`Caught red-handed! ${sec.name} gives chase—run, hide in a W.C., or lose them in another carriage!`, 'danger');
    } else {
      sim.dispatch(p.x, p.y, p.car, true);
      this.toast('Caught red-handed! They shout for the conductor. Get clear of this carriage.', 'danger');
    }
  }

  // ---------- locks ----------
  startPropLock(pr) {
    if (pr.opened) return this.lootProp(pr);
    if (!this.hasRoom() && !(pr.contents && pr.contents.cash)) { this.toast('Your pockets are full—stash something at your valise first.', 'warn'); return; }
    const name = pr.kind === 'vaultdoor' ? 'The Crown Vault' : pr.kind === 'strongbox' ? 'Strongbox' : pr.kind === 'trunk' ? 'Steamer Trunk' : 'Luggage';
    this.reachT = 0.6;
    this.openMini(cv => new LockGame(cv, { S: this.S, pins: pr.pins || 3, strong: !!pr.strong, title: `THE PICK — ${name}`, subtitle: `${pr.pins || 3} pins` }),
      res => this.lockResult(res, () => { pr.opened = true; this.lootProp(pr); }));
  }
  startDoorLock(door) {
    const next = this.run.carriages[door.between[1]];
    this.openMini(cv => new LockGame(cv, { S: this.S, pins: door.pins || 3, strong: next.type === 'vault', title: `THE PICK — ${next.name} door`, subtitle: 'Staff only' }),
      res => this.lockResult(res, () => { door.forced = true; door.locked = false; this.toast(`The door to the ${next.name} slides open.`, 'good'); }));
  }
  startCompLock(key) {
    this.openMini(cv => new LockGame(cv, { S: this.S, pins: 3, title: 'THE PICK — Compartment door', subtitle: 'Private compartment' }),
      res => this.lockResult(res, () => { const s = this.run.compState[key]; s.forced = true; s.locked = false; this.toast('The compartment door clicks open.', 'good'); }));
  }
  lockResult(res, onOpen) {
    const run = this.run, sim = this.sim, P = run.player;
    if (res.aborted) { this.toast('You withdraw your picks.', 'info', 1800); return; }
    if (res.success) { run.stats.locks++; sfx.unlock(); onOpen(); return; }
    if (res.timeout) {
      sim.raiseHeat(4, P.car, P.x);
      this.toast('Footsteps! You abandon the lock before anyone sees.', 'warn');
      return;
    }
    // heard
    sim.raiseHeat(12, P.car, P.x);
    for (const q of run.pax) if (!q.left && !q.child && sim.carAt(q.x) === sim.carAt(P.x) && dist(q.x, q.y, P.x, P.y) < 170) { q.susp = Math.min(99, q.susp + 40); q.glancing = 1.2; }
    sim.dispatch(P.x, P.y, P.car, false);
    this.toast('The pins clatter—someone heard. A conductor is on the way.', 'danger');
  }
  lootProp(pr) {
    const run = this.run;
    const cont = pr.contents || { items: [], cash: 0 };
    const got = [];
    if (cont.cash) { run.cash += cont.cash; got.push(money(cont.cash)); cont.cash = 0; sfx.cash(); }
    const left = [];
    for (const it of cont.items) { if (this.pocketItem(it)) { got.push(it.name); sfx.discover(RARITY_ORDER.indexOf(it.rarity)); } else left.push(it); }
    cont.items = left;
    pr.contents = cont;
    if (!left.length) pr.looted = true;
    if (got.length) this.toast(`Inside: ${got.join(', ')}.`, 'good');
    else if (!left.length) this.toast('Nothing inside but socks and a timetable.', 'info');
    if (left.length) this.toast(`Your pockets are full. ${left.length} more ${left.length === 1 ? 'piece remains' : 'pieces remain'} inside.`, 'warn');
  }
  lootCache(pr) {
    sfx.softclick();
    this.toast('A loose panel gives way…', 'event', 2000);
    this.lootProp(pr);
  }

  // ---------- misc interactions ----------
  useLav(pr) {
    const S = this.S, sim = this.sim;
    const hide = () => { sim.hide(true); this.hideLav = pr; sfx.door(); this.toast('You slip into the W.C. and slide the bolt. Nobody can see you in here.', 'info'); };
    if (!S.upgrades.disguise_spare) return hide();
    modal({
      title: 'The W.C.', body: '<p>A cramped little room with a mirror and a lock.</p>', dismiss: null,
      buttons: [{ label: 'Hide', value: 'hide', kind: 'primary' }, { label: 'Turn your coat', value: 'coat', sub: 'Your description stops matching' }, { label: 'Leave', value: null }],
    }).then(v => {
      if (v === 'hide') hide();
      if (v === 'coat') { sim.turnCoat(); this.lookCache.clear(); sfx.rustle(1); this.toast('Coat reversed, hat swapped. Any description of you is now wrong.', 'good'); }
    });
  }
  stepOff(door) {
    const st = this.tr.stations[this.run.leg];
    modal({ title: `Step off at ${st}?`, body: `<p>You’ll leave the train here and keep everything you carry: ${this.run.player.inv.length + this.run.player.hiddenInv.length} item(s), ${this.run.stash.length} in your valise and ${money(this.run.cash)}.</p>`, dismiss: false,
      buttons: [{ label: 'Stay aboard', value: false }, { label: 'Step off', value: true, kind: 'primary' }] })
      .then(v => { if (v) { sfx.door(); this.queueEnd('stepped'); } });
  }
  helpFamily(p) {
    const run = this.run, S = this.S, ev = run.familyEvent;
    if (!ev || ev.resolved) return;
    const cost = ev.cost;
    modal({ title: 'Lost tickets', body: `<p>“Please, sir—the conductor will put us off, and we’ve nowhere else to go.”</p><p class="muted">Pay their fare: ${money(cost)}.</p>`, dismiss: false,
      buttons: [{ label: 'Not my concern', value: false }, { label: `Pay ${money(cost)}`, value: true, kind: 'green', disabled: run.cash < cost && S.wealth < cost }] })
      .then(v => {
        if (!v) return;
        if (run.cash >= cost) run.cash -= cost; else S.wealth -= cost;
        ev.resolved = true; run.familyHelped = true; p.needsHelp = false;
        p.bubble = 'Bless you, sir!'; p.bubbleT = 3; sfx.cash();
        this.goodwillGain += 8;
        for (const q of run.pax) if (q.car === p.car && !q.staff) q.susp = Math.max(0, q.susp - 30);
        this.toast('You press the fare into the conductor’s hand. The carriage looks on you kindly. (+8 goodwill)', 'good');
      });
  }
  talkInformant(p) {
    const run = this.run, P = run.player;
    if (run.informantUses >= 3) { p.bubble = 'Best we’re not seen talking, guv.'; p.bubbleT = 2.5; return; }
    modal({
      title: p.name, body: '<p class="quote">“Friend of Ada Wren’s, are you? What’ll it be?”</p>', dismiss: null,
      buttons: [
        { label: 'A tip', value: 'tip', sub: 'Who’s worth your while' },
        { label: 'Hold something', value: 'hold', sub: 'Safe from any search', disabled: !P.inv.length || this.held.length >= 2 },
        { label: 'A diversion', value: 'div', sub: 'Distract this carriage' },
        { label: 'Never mind', value: null },
      ],
    }).then(v => {
      if (!v) return;
      run.informantUses++;
      if (v === 'tip') {
        let best = null, bv = 0;
        for (const q of run.pax) if (!q.left && !q.staff) for (const it of q.items) if (it.value > bv) { bv = it.value; best = { q, it }; }
        for (const q of run.pax) if (!q.left && !q.staff && q.car === p.car) q.observed = true;
        if (best) this.toast(`“${best.q.name} in the ${run.carriages[best.q.car].name} is carrying a ${CATEGORIES[best.it.cat].single.toLowerCase()} worth a king’s ransom.” Everyone here is sized up for you.`, 'tip');
      } else if (v === 'hold') {
        const it = P.inv.shift(); this.held.push(it);
        this.toast(`${p.name} pockets the ${it.name}. “I’ll see it gets to you, guv.”`, 'good');
      } else if (v === 'div') {
        for (const q of run.pax) if (!q.left && q.car === p.car && !q.staff && q !== p) { q.distractT = 9; q.distractX = p.x; q.distractY = p.y; }
        p.bubble = 'Oi! Who’s left this case in the aisle?!'; p.bubbleT = 3; sfx.brush();
        this.toast(`${p.name} kicks up a fuss. Every head in the carriage turns.`, 'event');
      }
    });
  }
  useCoin() {
    if (this.blocked()) return;
    if (this.run.coins <= 0) { this.toast(this.S.upgrades.distract_coin ? 'No coins left to throw.' : 'Learn the Rolling Sixpence in the workshop to throw coins.', 'info', 2000); return; }
    if (this.sim.throwCoin()) this.toast('A sixpence skitters down the aisle. Heads turn toward it.', 'event', 2200);
  }
  useIncident() {
    if (this.blocked()) return;
    if (!this.S.upgrades.distract_incident) { this.toast('Requires the Staged Incident upgrade.', 'info', 1800); return; }
    if (!this.sim.stageIncident()) this.toast('You’ve already staged your incident this trip.', 'info', 1800);
  }
  useFlourish() {
    if (this.blocked()) return;
    if (!this.S.upgrades.distract_cards) { this.toast('Requires the Card Flourish upgrade.', 'info', 1800); return; }
    const p = this.sim.obsCandidate;
    if (!p || p.staff || dist(p.x, p.y, this.run.player.x, this.run.player.y) > 60) { this.toast('Get closer to someone first.', 'info', 1800); return; }
    if (p.charmed) { this.toast(`${p.name} is already charmed.`, 'info', 1800); return; }
    if (this.flourishes <= 0) { this.toast('Your deck is spent for this trip.', 'info', 1800); return; }
    this.charm(p);
  }

  // ---------- pockets & valise ----------
  openPockets(atValise = false) {
    if (this.blocked() && !atValise) return;
    const run = this.run, P = run.player, S = this.S, cap = this.capacity();
    const valiseCap = S.upgrades.store_valise ? Infinity : 2;
    const render = () => {
      const box = el('div', { class: 'pockets' });
      const row = (it, btns) => el('div', { class: 'pocket-row' }, el('img', { src: iconURL(it, 80), alt: '' }),
        el('div', { class: 'nm' }, it.name, el('div', { class: 'rar', style: { color: RARITY[it.rarity].color } }, `${RARITY[it.rarity].name} · £${it.value}`)), ...btns);
      const mv = (label, fn, dis) => { const b = el('button', { class: 'btn tiny', disabled: dis || null }, label); b.addEventListener('click', () => { fn(); sfx.pocket(); refresh(); }); return b; };
      const sec1 = el('div', {}, el('h4', {}, `Pockets ${P.inv.length}/${cap.slots}`));
      if (!P.inv.length) sec1.append(el('p', { class: 'muted small' }, 'Empty.'));
      for (const it of P.inv) sec1.append(row(it, [
        cap.hidden ? mv('Sleeve', () => { P.inv.splice(P.inv.indexOf(it), 1); P.hiddenInv.push(it); }, P.hiddenInv.length >= cap.hidden) : null,
        atValise ? mv('Valise', () => { P.inv.splice(P.inv.indexOf(it), 1); run.stash.push(it); }, run.stash.length >= valiseCap) : null,
      ]));
      box.append(sec1);
      if (cap.hidden) {
        const sec2 = el('div', {}, el('h4', {}, `Hidden sleeve ${P.hiddenInv.length}/${cap.hidden}`), el('p', { class: 'muted small' }, 'Never found in a search.'));
        for (const it of P.hiddenInv) sec2.append(row(it, [
          mv('Pocket', () => { P.hiddenInv.splice(P.hiddenInv.indexOf(it), 1); P.inv.push(it); }, P.inv.length >= cap.slots),
          atValise ? mv('Valise', () => { P.hiddenInv.splice(P.hiddenInv.indexOf(it), 1); run.stash.push(it); }, run.stash.length >= valiseCap) : null,
        ]));
        box.append(sec2);
      }
      if (atValise || run.stash.length) {
        const sec3 = el('div', {}, el('h4', {}, `Your valise ${run.stash.length}${valiseCap === Infinity ? '' : '/' + valiseCap}`),
          el('p', { class: 'muted small' }, S.upgrades.store_valise ? 'False bottom: safe from searches, and it comes with you if you’re thrown off.' : 'Safe from searches—but left behind if you’re thrown off.'));
        for (const it of run.stash) sec3.append(row(it, [atValise ? mv('Take', () => { run.stash.splice(run.stash.indexOf(it), 1); this.pocketItem(it); }, !this.hasRoom()) : null]));
        box.append(sec3);
      }
      if (this.held.length) {
        const sec4 = el('div', {}, el('h4', {}, 'Held by your informant'));
        for (const it of this.held) sec4.append(row(it, []));
        box.append(sec4);
      }
      box.append(el('p', { class: 'sans small', style: { textAlign: 'center', margin: '4px 0 0' } }, `Purse: ${money(run.cash)}`));
      return box;
    };
    const refresh = () => { const b = document.querySelector('#modal .modal-body'); if (b) { b.innerHTML = ''; b.append(render()); } };
    modal({ title: atValise ? 'Your valise' : 'Your pockets', body: render(), buttons: [{ label: 'Done', value: true }], dismiss: true, cls: 'wide' });
  }

  // ---------- minigames ----------
  openMini(make, onResult) {
    this.joy = null; this.updateJoyEl(); this.keys.clear(); this.obsHeld = false;
    this.miniCv.hidden = false; this.miniUi.hidden = false;
    document.body.classList.add('mini-open');
    let fired = false;
    const onDone = res => {
      if (fired) return; fired = true;
      setTimeout(() => {
        if (this.ended) return;
        this.closeMini();
        onResult(res);
      }, res.aborted ? 50 : 650);
    };
    const game = make(this.miniCv);
    game.o.onDone = onDone;
    this.mini = game;
  }
  closeMini() {
    if (this.mini) this.mini.destroy();
    this.mini = null;
    this.miniCv.hidden = true; this.miniUi.hidden = true;
    document.body.classList.remove('mini-open');
  }

  // ================= sim hooks =================
  toast(text, kind = 'info', ms) { toast(text, kind, ms); }

  onObserved(p, intel) {
    const S = this.S;
    const A = ARCHETYPES[p.arch] || {};
    const what = p.items.length ? p.items.map(i => i.name).join(', ') : 'nothing of value';
    let msg = p.staff ? `${p.name}: ${A.title || 'staff'}. ${p.staff === 'detective' ? 'She misses nothing.' : 'Mind the patrol route.'}` : `${p.name} — ${A.title || ''}. Carrying: ${what}${p.cash ? ` and about ${money(p.cash)}` : ''}.`;
    this.toast(msg, 'info', 5000);
    if (p.secret && !p.staff) this.toast(`Secret: ${p.secret}`, 'tip', 6000);
    if (intel) this.toast(`+${intel} intel`, 'good', 1800);
    if (!p.staff && p.cls === 'upper') S.dossiers[p.name] = { title: A.title, bio: p.bio, secret: p.secret, train: this.tr.name, date: this.run.date };
  }

  onSearch(p, reason) {
    const run = this.run, S = this.S, sim = this.sim, P = run.player;
    this.keys.clear(); this.joy = null; this.updateJoyEl();
    const det = p.staff === 'detective';
    const line = reason === 'trespass' ? '“Ticket, please, sir. This carriage isn’t for your sort of fare.”'
      : reason === 'checkpoint' ? '“Turn out your pockets, sir. Everybody’s being searched.”'
        : det ? '“Inspector Hollis, Railway Police. You match a description I’ve been given.”' : '“A word, sir. You match a description that’s going round.”';
    const rep = this.S.stats.runs >= 2 ? null : null;
    let bluff = 0.5 + (P.outfit === 'evening' || P.outfit === 'conductor' ? 0.12 : 0) - run.heat / 220 - (det ? 0.25 : 0) - (sim.matchesDesc() ? 0.12 : 0) + (run.alibiT > 0 ? 0.25 : 0);
    if (reason === 'trespass' && (P.outfit === 'conductor')) bluff += 0.2;
    bluff = clamp(bluff, 0.08, 0.9);
    const exposed = P.inv.length;
    const body = el('div', {}, el('p', { class: 'quote' }, line),
      el('p', { class: 'muted small', style: { textAlign: 'center' } }, exposed ? `You have ${exposed} stolen item${exposed > 1 ? 's' : ''} in your pockets${P.hiddenInv.length ? ' (your sleeve is safe)' : ''}.` : 'Your pockets are clean.'));
    sfx.warn();
    modal({
      title: p.name, body, dismiss: null,
      buttons: [
        { label: 'Turn out your pockets', value: 'comply', kind: exposed ? '' : 'green' },
        { label: 'Bluff', value: 'bluff', sub: `${Math.round(bluff * 100)}% chance` },
        { label: 'Make a run for it', value: 'flee', kind: 'danger' },
      ],
    }).then(v => {
      if (v === 'flee') {
        p.state = 'chase'; p.chaseT = 14; p.lostT = 0; p.path = null; p.bubble = 'Stop! Thief!'; p.bubbleT = 2.5;
        sim.raiseHeat(10, P.car, P.x);
        run.desc = { outfit: P.outfit, variant: P.variant || 0, t: run.t };
        this.toast('You bolt! Break line of sight, slip into a W.C., or put a carriage between you.', 'danger');
        return;
      }
      if (v === 'bluff' && Math.random() < bluff) {
        p.bubble = det ? '“Hm. For now, then.”' : '“Of course, sir. My apologies.”'; p.bubbleT = 2.5;
        this.releaseCop(p, 0.2);
        this.toast('Your story holds. They wave you on.', 'good');
        return;
      }
      if (v === 'bluff') this.toast('They don’t buy it.', 'warn', 2000);
      this.resolveSearch(p, reason, v === 'bluff');
    });
  }
  resolveSearch(p, reason, failedBluff) {
    const run = this.run, sim = this.sim, P = run.player;
    if (P.inv.length) {
      const n = P.inv.length;
      const lost = P.inv.splice(0);
      this.confiscated = (this.confiscated || []).concat(lost);
      run.caughtCount++;
      sim.raiseHeat(15 + (failedBluff ? 5 : 0), P.car, P.x);
      run.desc = { outfit: P.outfit, variant: P.variant || 0, t: run.t };
      sfx.caught();
      if (run.caughtCount >= 2 || p.staff === 'detective') {
        this.toast(`${n} stolen item${n > 1 ? 's' : ''} found. “That’s it—you’re off at the next stop.”`, 'danger');
        this.queueEnd('caught');
        return;
      }
      p.bubble = '“Final warning. Next time, you’re off.”'; p.bubbleT = 3;
      this.toast(`${n} item${n > 1 ? 's' : ''} confiscated and returned to their owners. One more and you’re thrown off.`, 'danger');
      this.releaseCop(p, 1);
      return;
    }
    if (reason === 'trespass' || sim.inForbidden()) {
      P.x = this.homePos.x; P.y = this.homePos.y; P.comp = null;
      sim.raiseHeat(5, P.car, P.x);
      this.toast('You’re escorted back to your own seat. Nothing found—this time.', 'warn');
    } else {
      run.desc = null;
      run.heat = Math.max(0, run.heat - 8);
      p.bubble = '“Nothing. Beg your pardon, sir.”'; p.bubbleT = 2.5;
      this.toast('Clean pockets. The description no longer points at you.', 'good');
    }
    this.releaseCop(p, 0.3);
  }
  releaseCop(p, suspK) {
    p.susp = (p.susp || 0) * suspK * 0.3;
    p.path = null;
    if (p.posted) { p.state = 'post'; p.searchedRecently = 30; }
    else { p.state = 'cooldown'; p.actT = 8; }
  }
  onChaseCaught(p) {
    sfx.caught(); haptic(120);
    this.toast(`${p.name} has you by the collar.`, 'danger');
    this.queueEnd('caught');
  }
  onRival(r) {
    const run = this.run, P = run.player;
    if (!P.inv.length && run.cash <= 0) { r.state = 'flee'; this.rivalFlee(r); return; }
    this.keys.clear(); this.joy = null; this.updateJoyEl();
    sfx.stir(); haptic(40);
    const bar = el('div', { class: 'reflex-bar' }, el('div'));
    this.reflex = { t: 1.4, max: 1.4, bar: bar.firstChild, r };
    modal({ title: 'A hand in your coat!', body: el('div', {}, el('p', { class: 'quote' }, 'A light-fingered stranger brushes past—too close.'), bar), dismiss: null,
      buttons: [{ label: 'Grab the wrist!', value: 'grab', kind: 'primary' }] })
      .then(v => this.resolveRival(v === 'grab'));
  }
  updateReflex(dt) {
    const R = this.reflex;
    R.t -= dt;
    if (R.bar) R.bar.style.width = Math.max(0, R.t / R.max * 100) + '%';
    if (R.t <= 0) closeModal('late');
  }
  resolveRival(grabbed) {
    const R = this.reflex; this.reflex = null;
    if (!R) return;
    const r = R.r, run = this.run, P = run.player;
    if (grabbed) {
      run.cash += r.cash; sfx.cash();
      this.toast(`You catch a rival dip by the wrist. He drops ${money(r.cash)} and flees, white-faced.`, 'good');
      r.cash = 0;
    } else if (P.inv.length) {
      const it = P.inv.splice(Math.floor(Math.random() * P.inv.length), 1)[0];
      this.stolenByRival = it;
      this.toast(`Too slow! A rival pickpocket made off with your ${it.name}.`, 'danger');
    } else {
      const take = Math.ceil(run.cash / 2); run.cash -= take;
      this.toast(`Too slow! A rival pickpocket lifted ${money(take)} from your purse.`, 'danger');
    }
    r.state = 'flee';
    this.rivalFlee(r);
  }
  rivalFlee(r) {
    const sim = this.sim;
    const gx = sim.nearestGangway(r.x + (r.x < this.run.player.x ? -250 : 250));
    r.path = sim.findPath(r.x, r.y, gx, 3 * T, r) || [];
    if (!r.path.length) r.left = true;
  }

  // ================= HUD =================
  buildHud() {
    const hud = document.getElementById('hud');
    this.hud = hud; hud.innerHTML = ''; hud.hidden = false;
    const touch = matchMedia('(hover: none)').matches;
    const pauseB = el('button', { class: 'btn ghost hud-pause', 'aria-label': 'Pause' }, '❚❚');
    pauseB.addEventListener('click', () => this.pause());
    this.h = {};
    this.h.tn = el('div', { class: 'tn' }, this.tr.name);
    this.h.st = el('div', { class: 'st' }, '');
    this.h.leg = meter(0);
    this.h.heatLbl = el('div', { class: 'lbl' }, 'Calm');
    this.h.heatM = meter(0);
    this.h.heat = el('div', { class: 'hud-heat heat-0' }, this.h.heatLbl, this.h.heatM);
    this.h.cash = el('div', { class: 'cash' }, '£0');
    this.h.pk = el('div', { class: 'pk' }, '');
    const top = el('div', { class: 'hud-top' }, pauseB, el('div', { class: 'hud-journey' }, this.h.tn, this.h.st, this.h.leg), this.h.heat, el('div', { class: 'hud-purse' }, this.h.cash, this.h.pk));
    this.h.map = el('div', { class: 'hud-map' });
    const W = this.run.worldW;
    for (const car of this.run.carriages) {
      const seg = el('div', { class: 'seg' + (car.restricted ? ' restricted' : '') });
      seg.style.position = 'absolute'; seg.style.left = (car.x0 / W * 100) + '%'; seg.style.width = (car.w / W * 100) + '%';
      car._seg = seg; this.h.map.append(seg);
    }
    this.h.me = el('div', { class: 'dot me' }); this.h.map.append(this.h.me);
    this.h.cops = [];
    this.h.badges = el('div', { class: 'hud-badges' });
    this.h.target = el('div', { class: 'hud-target' });
    // actions
    this.h.act = el('button', { class: 'btn btn-act none' }, '—');
    this.h.act.addEventListener('pointerdown', e => { e.preventDefault(); this.doInteract(); });
    this.h.obs = el('button', { class: 'btn btn-observe' }, 'Observe');
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('viewBox', '0 0 100 100');
    ring.innerHTML = '<circle cx="50" cy="50" r="46" fill="none" stroke="#a8e8b0" stroke-width="5" stroke-dasharray="289" stroke-dashoffset="289" stroke-linecap="round"/>';
    this.h.obs.append(ring); this.h.obsRing = ring.firstChild;
    if (!touch) this.h.obs.append(el('span', { class: 'kbd' }, 'hold Q'));
    const obsOn = e => { e.preventDefault(); this.obsHeld = true; this.h.obs.classList.add('on'); try { this.h.obs.setPointerCapture(e.pointerId); } catch (_) {} };
    const obsOff = () => { this.obsHeld = false; this.h.obs.classList.remove('on'); };
    this.h.obs.addEventListener('pointerdown', obsOn);
    this.h.obs.addEventListener('pointerup', obsOff);
    this.h.obs.addEventListener('pointercancel', obsOff);
    this.h.obs.addEventListener('lostpointercapture', obsOff);
    const small = (label, key, fn) => { const b = el('button', { class: 'btn ghost' }, label, touch ? null : el('span', { class: 'kbd' }, key)); b.addEventListener('click', fn); return b; };
    this.h.coinB = small('Coin', 'F', () => this.useCoin());
    this.h.incB = small('Incident', 'G', () => this.useIncident());
    this.h.flB = small('Cards', 'C', () => this.useFlourish());
    this.h.pkB = small('Pockets', 'I', () => this.openPockets());
    const smallRow = el('div', { class: 'small-row' }, this.h.coinB, this.h.incB, this.h.flB, this.h.pkB);
    const acts = el('div', { class: 'hud-acts' }, smallRow, el('div', { class: 'act-row' }, this.h.obs, this.h.act));
    const hint = el('div', { class: 'hud-hint' }, touch ? '' : 'WASD move · Shift hurry · E act · Q observe · Esc pause');
    hud.append(top, this.h.map, this.h.badges, this.h.target, acts, hint);
  }
  updateActButton() {
    const it = this.sim.interact, b = this.h.act;
    let label = '—', cls = 'btn btn-act none';
    if (it && !this.blocked()) {
      label = it.kind === 'lock' && it.pr && it.pr.opened ? 'Rummage' : it.label;
      cls = 'btn btn-act';
      if (it.kind === 'lift') cls += ' q-' + this.sim.liftQuality(it.p).q;
    }
    if (b._l !== label) { b._l = label; b.textContent = label; }
    if (b.className !== cls) b.className = cls;
    const o = this.sim.observeT || 0;
    this.h.obsRing.setAttribute('stroke-dashoffset', String(289 * (1 - o)));
  }
  updateHud() {
    const run = this.run, sim = this.sim, S = this.S, P = run.player, tr = this.tr;
    // journey
    const next = tr.stations[Math.min(run.leg + 1, tr.stations.length - 1)];
    let st, prog;
    if (run.phase === 'station') { st = `${tr.stations[run.leg]} · doors close in ${Math.ceil(run.stationT)}s`; prog = 1; }
    else if (run.phase === 'arriving') { st = `Arriving: ${next}`; prog = 1; }
    else if (run.phase === 'departing') { st = `Departing ${tr.stations[run.leg]}`; prog = 0; }
    else { st = `Next: ${next} · stop ${run.leg + 1} of ${tr.legs}`; prog = run.legT / tr.legTime; }
    if (this.h.st.textContent !== st) this.h.st.textContent = st;
    this.h.leg.firstChild.style.width = Math.round(clamp(prog, 0, 1) * 100) + '%';
    // heat
    const lvl = Math.min(3, Math.floor(run.heat / 25));
    this.h.heat.className = 'hud-heat heat-' + lvl;
    this.h.heatLbl.textContent = HEAT_NAMES[lvl];
    this.h.heatM.firstChild.style.width = Math.round(run.heat) + '%';
    // purse
    const cap = this.capacity();
    this.h.cash.textContent = money(run.cash);
    this.h.pk.textContent = `Pockets ${P.inv.length}/${cap.slots}${cap.hidden ? ` · sleeve ${P.hiddenInv.length}/${cap.hidden}` : ''}${run.stash.length ? ` · valise ${run.stash.length}` : ''}`;
    // map
    const W = run.worldW;
    const curCar = sim.carAt(P.x);
    for (const car of run.carriages) car._seg.classList.toggle('cur', car === curCar);
    this.h.me.style.left = (P.x / W * 100) + '%';
    const showAll = !!S.upgrades.net_lookout;
    const cops = run.pax.filter(p => !p.left && (p.staff === 'conductor' || p.staff === 'detective') && (showAll || sim.carAt(p.x) === curCar));
    while (this.h.cops.length < cops.length) { const d = el('div', { class: 'dot cop' }); this.h.map.append(d); this.h.cops.push(d); }
    this.h.cops.forEach((d, i) => {
      const p = cops[i];
      d.hidden = !p;
      if (p) { d.style.left = (p.x / W * 100) + '%'; d.className = 'dot ' + (p.staff === 'detective' ? 'det' : 'cop'); }
    });
    // badges
    const badges = [];
    if (run.desc) badges.push(sim.matchesDesc() ? ['red', 'Your description is circulating'] : ['', 'Description doesn’t match you']);
    if (sim.inForbidden()) badges.push(['red', 'Restricted area']);
    if (run.alibiT > 0) badges.push(['green', `Alibi ${Math.ceil(run.alibiT)}s`]);
    if (P.hidden) badges.push(['green', 'Hidden']);
    if (run.tunnelT > 0) badges.push(['green', 'Tunnel — darkness covers you']);
    if (run.joltT > 0) badges.push(['green', 'Jolt — eyes elsewhere']);
    if (run.pax.some(p => p.state === 'chase' && !p.left)) badges.push(['red', 'You’re being chased!']);
    const key = badges.map(b => b.join(':')).join('|');
    if (key !== this._badgeKey) {
      this._badgeKey = key;
      this.h.badges.innerHTML = '';
      for (const [c, t] of badges) this.h.badges.append(el('span', { class: 'tag ' + c }, t));
    }
    // coin/incident/cards labels
    this.h.coinB.firstChild.textContent = `Coin ×${run.coins}`;
    this.h.coinB.hidden = !S.upgrades.distract_coin;
    this.h.incB.hidden = !S.upgrades.distract_incident;
    this.h.incB.disabled = !!run.incidentUsed;
    this.h.flB.hidden = !S.upgrades.distract_cards;
    this.h.flB.firstChild.textContent = `Cards ×${this.flourishes}`;
    // target card
    const it = sim.interact;
    const p = (it && it.p) || sim.obsCandidate;
    const tg = this.h.target;
    if (!p || P.hidden) { tg.style.opacity = 0; this._tgKey = null; return; }
    tg.style.opacity = 1;
    const A = ARCHETYPES[p.arch] || {};
    const known = p.observed || S.upgrades.intel_eye;
    const tkey = p.id + ':' + known + ':' + p.items.length + ':' + p.cash + ':' + p.act;
    if (tkey !== this._tgKey) {
      this._tgKey = tkey;
      tg.innerHTML = '';
      tg.append(el('div', { class: 'ti' }, p.rival ? 'Stranger' : (A.title || '')), el('div', { class: 'nm' }, p.name),
        el('div', { class: 'act' }, (ACTIVITY_INFO[p.act] || ACTIVITY_INFO.idle).label));
      this.h.tSusp = meter(0, 'bad'); tg.append(this.h.tSusp);
      const its = el('div', { class: 'its' });
      if (p.staff && !p.items.length) its.append(el('span', { class: 'muted small' }, p.staff === 'detective' ? 'Railway Police' : 'Railway staff'));
      else if (known) {
        for (const x of p.items) its.append(el('img', { src: iconURL(x, 52), alt: x.name, title: x.name }));
        if (p.cash > 0) its.append(el('span', { class: 'cashtag' }, money(p.cash)));
        if (!p.items.length && !p.cash) its.append(el('span', { class: 'muted small' }, 'Nothing of value'));
      } else its.append(el('span', { class: 'muted small' }, 'Hold Observe to size them up'));
      tg.append(its);
    }
    if (this.h.tSusp) this.h.tSusp.firstChild.style.width = Math.round(clamp(p.susp, 0, 100)) + '%';
  }

  // ================= ending =================
  finish(reason) {
    const run = this.run, S = this.S, P = run.player, tr = this.tr;
    this.closeMini(); closeModal(null, true);
    const items = [], lost = [];
    let cash = run.cash;
    if (reason === 'arrived' || reason === 'stepped') {
      items.push(...P.inv, ...P.hiddenInv, ...run.stash, ...this.held);
    } else {
      items.push(...P.hiddenInv, ...this.held);
      if (S.upgrades.store_valise) items.push(...run.stash); else lost.push(...run.stash);
      if (S.upgrades.net_safehouse) { const keep = Math.ceil(P.inv.length / 2); items.push(...P.inv.slice(0, keep)); lost.push(...P.inv.slice(keep)); }
      else lost.push(...P.inv);
      cash = Math.floor(cash / 2);
    }
    const station = reason === 'arrived' ? tr.stations[tr.stations.length - 1]
      : reason === 'stepped' ? tr.stations[run.leg]
        : tr.stations[Math.min(run.leg + 1, tr.stations.length - 1)];
    const result = {
      reason, trainId: tr.id, trainName: tr.name, station, date: run.date, items, lost, cash,
      stats: { ...run.stats }, heatPeak: Math.round(run.heatPeak), intelGain: run.intelGain || 0, goodwillGain: this.goodwillGain,
      caughtCount: run.caughtCount, confiscated: (this.confiscated || []).length, familyHelped: run.familyHelped,
      log: run.log.slice(-5),
    };
    const go = () => { this.cb.onEnd(result); };
    if (reason === 'caught' || reason === 'abandoned') {
      stopTrainAmbience();
      const title = reason === 'caught' ? 'Thrown off the train' : 'You jump the train';
      const txt = reason === 'caught'
        ? `<p>The conductor marches you to the door and sets you down on the platform at <b>${station}</b>.</p>`
        : '<p>You swing down onto the ballast as the train slows for a signal, and walk the long way home.</p>';
      const keepTxt = `<p class="muted small">${items.length ? `You keep ${items.length} item${items.length > 1 ? 's' : ''}${S.upgrades.net_safehouse && reason === 'caught' ? ' (your safe-house friends hid some)' : ''}` : 'Everything you carried is gone'}${lost.length ? `; ${lost.length} lost` : ''}. Half your cash is gone: ${money(cash)} remains.</p>`;
      modal({ title, body: txt + keepTxt, buttons: [{ label: 'Back to the hideout', value: true, kind: 'primary' }], dismiss: true }).then(go);
    } else go();
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
    title: 'How to play', cls: 'wide', dismiss: true,
    body: `
<p><b>You are a gentleman thief riding the rails.</b> Each journey, lift valuables from the wealthy, then decide back at the hideout what to keep, sell, give away or return.</p>
<p><b>Move</b> — ${touch ? 'drag anywhere on the train (drag further to hurry).' : 'WASD / arrow keys; hold Shift to hurry.'} Hurrying makes people look.</p>
<p><b>Observe</b> — stand near a passenger and hold ${touch ? 'OBSERVE' : 'Q'} to learn what they carry and gather intel.</p>
<p><b>Lift</b> — the hand above a mark is green when they’re distracted. Tap ${touch ? 'the big button' : 'E'} and complete the sleight of hand: move slowly, freeze when they stir, and use train jolts to mask your movements.</p>
<p><b>Heat</b> — thefts get discovered. Heat brings conductors, searches and lockdowns. Lie low, hide in a W.C., order a drink for an alibi, or wait for a station to cool things off.</p>
<p><b>Searches</b> — if a conductor stops you, anything in your pockets can be found. Stash loot in your valise at your seat.</p>
<p><b>Bank it</b> — reach the end of the line or step off at a station gangway to keep your haul. Get caught twice and you’re thrown off.</p>`,
    buttons: [{ label: 'Got it', value: true, kind: 'primary' }],
  });
}
