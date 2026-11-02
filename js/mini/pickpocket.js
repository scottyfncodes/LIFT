// LIFT — tactile pickpocketing techniques
import { MiniBase } from './common.js';
import { clamp, shade, rgba, dist } from '../util.js';
import { sfx } from '../audio.js';
import { drawItemIcon } from '../world/icons.js';
import { haptic } from '../util.js';

const ITEM_R = { wallet: 24, coin: 11, cigcase: 20, lighter: 14, compass: 15, heirloom: 13, accessory: 15, letter: 20, document: 22 };

// ===================== THE DIP =====================
export class DipGame extends MiniBase {
  constructor(cv, o) {
    super(cv, o);
    const S = o.S;
    this.steady = S.upgrades.hand_steady ? 1.35 : 1;
    const rIdx = o.rarityIdx || 0;
    const kind = o.pocket || (o.female && o.item.cat !== 'letter' ? 'handbag' : ['hip', 'breast', 'hip', 'waist'][Math.floor(Math.random() * 4)]);
    const P = {
      hip: { cx: 205, cy: 150, w: 170, d: 175, a: -0.06, name: 'hip pocket' },
      breast: { cx: 210, cy: 120, w: 112, d: 215, a: 0.12, name: 'inside breast pocket' },
      waist: { cx: 200, cy: 170, w: 92, d: 120, a: -0.1, name: 'waistcoat pocket' },
      handbag: { cx: 200, cy: 140, w: 160, d: 170, a: 0, name: 'handbag', bag: true },
    }[kind];
    if (o.pocketOverride) Object.assign(P, o.pocketOverride);
    this.P = P;
    this.tol = (14 + (kind === 'hip' ? 4 : 0)) * this.steady / (1 + rIdx * 0.08);
    this.speedLim = 125 * (S.upgrades.hand_steady ? 1.15 : 1) / (1 + rIdx * 0.05);
    this.itemR = ITEM_R[o.item.cat] || 15;
    this.hx = 70; this.hy = 380; this.off = null;
    this.inside = false; this.gripT = 0; this.gripped = false; this.extracted = false; this.concealT = 0;
    this.itemLocal = { u: (Math.random() - 0.5) * P.w * 0.3, v: P.d * (0.62 + Math.random() * 0.18) };
    this.brushCD = 0; this.contact = false; this.pen = 0; this.lastWall = null;
    this.hint = `${o.techName || 'The Dip'}: drag your hand into the ${P.name}. Slowly.`;
  }
  toLocal(x, y) {
    const P = this.P, ca = Math.cos(-P.a), sa = Math.sin(-P.a);
    const dx = x - P.cx, dy = y - P.cy;
    return { u: dx * ca - dy * sa, v: dx * sa + dy * ca };
  }
  toWorld(u, v) { const P = this.P, ca = Math.cos(P.a), sa = Math.sin(P.a); return { x: P.cx + u * ca - v * sa, y: P.cy + u * sa + v * ca }; }
  halfW(v) { return this.P.w / 2 * (1 - 0.14 * clamp(v / this.P.d, 0, 1)); }
  down(x, y) {
    this.off = { x: this.hx - x, y: this.hy - y };
    if (this.extracted && dist(x, y, this.hx, this.hy) > 140) this.off = { x: 0, y: 0 };
  }
  up() { this.off = null; this.gripT = 0; }
  update(dt) {
    if (this.done) return;
    this.baseUpdate(dt);
    const P = this.P;
    let tx = this.hx, ty = this.hy;
    if (this.finger && this.off) { tx = this.fx + this.off.x; ty = this.fy + this.off.y; }
    // hand follows with slight inertia
    const k = Math.min(1, dt * 16);
    let nx = this.hx + (tx - this.hx) * k, ny = this.hy + (ty - this.hy) * k;
    if (this.joltT > 0 && this.inside) { nx += Math.sin(this.t * 40) * 1.2; ny += Math.cos(this.t * 33) * 1.2; }
    const vel = Math.hypot(nx - this.hx, ny - this.hy) / Math.max(dt, 1e-3);
    const prev = this.toLocal(this.hx, this.hy);
    let L = this.toLocal(nx, ny);
    const extra = this.gripped ? this.itemR * 0.55 : 0;
    // entering / walls
    if (!this.inside && !this.extracted) {
      if (prev.v <= 0 && L.v > 0) {
        if (Math.abs(L.u) < this.halfW(0) - 4) { this.inside = true; sfx.rustle(0.4); }
        else { L.v = 0; const w = this.toWorld(L.u, -1); nx = w.x; ny = w.y; this.addAw(4, 'fumble'); this.hit('#e08a2a'); sfx.brush(); }
      } else if (L.v > 0 && Math.abs(L.u) < this.halfW(L.v)) { /* hand hovering over closed pocket fabric */ }
    }
    this.pen = 0; this.lastWall = null;
    if (this.inside) {
      if (L.v < 0) {
        if (this.gripped) { this.inside = false; this.extracted = true; sfx.pocket(); haptic(20); this.say('Out!', 0.8); this.msgCol = '#a8e8b0'; this.hint = 'Conceal it: drag to your coat (bottom right).'; }
        else if (Math.abs(L.u) < this.halfW(0)) { this.inside = false; }
        else { L.v = 1; }
      }
      if (this.inside) {
        const hw = this.halfW(L.v);
        const sideClear = hw - Math.abs(L.u) - extra, botClear = P.d - L.v - extra * 0.6;
        const clear = Math.min(sideClear, botClear);
        this.lastWall = sideClear < botClear ? (L.u < 0 ? 'L' : 'R') : 'B';
        if (clear < this.tol) {
          this.pen = clamp((this.tol - clear) / this.tol, 0, 1.4);
          if (clear < 0) { // clamp inside
            if (sideClear < 0) L.u = Math.sign(L.u) * (hw - extra);
            if (botClear < 0) L.v = P.d - extra * 0.6;
            const w = this.toWorld(L.u, L.v); nx = w.x; ny = w.y;
          }
        }
        if (this.pen > 0) {
          const moving = vel > 15 ? 1 : 0.25;
          this.addAw(this.pen * 62 * dt * this.masked * moving / (this.steady > 1 ? 1.4 : 1), 'brush');
          if (this.pen > 0.55 && !this.contact) { this.contact = true; this.near++; this.hit('#e08a2a'); sfx.brush(); haptic(25); this.say('Careful—the lining!', 0.9); }
          this.brushCD -= dt; if (this.brushCD <= 0) { sfx.rustle(this.pen); this.brushCD = 0.25; }
        } else if (this.pen < 0.2) this.contact = false;
        // speed
        if (vel > this.speedLim) this.addAw((vel - this.speedLim) * 0.4 * dt * this.masked, 'speed');
        // grip
        if (!this.gripped) {
          const d = Math.hypot(L.u - this.itemLocal.u, L.v - this.itemLocal.v);
          if (d < this.itemR + 8 && vel < 60) { this.gripT += dt; if (this.gripT > 0.42) { this.gripped = true; sfx.grip(); haptic(15); this.hint = 'Got it. Now ease it out the way you came.'; } }
          else this.gripT = Math.max(0, this.gripT - dt * 2);
        }
      }
    }
    this.glancePenalty(dt, (this.inside && vel > 25) || (!this.inside && !this.extracted && vel > 140));
    this.hx = nx; this.hy = ny; this.hv = vel;
    if (this.extracted) {
      this.concealT += dt;
      if (this.concealT > 3) this.addAw(14 * dt, 'fumble');
      if (dist(this.hx, this.hy, 345, 355) < 38) { sfx.pocket(); this.finish(); }
    }
  }
  draw() {
    const c = this.c, o = this.o, P = this.P;
    this.begin();
    const coat = o.look ? o.look.coat : '#4a3a2a';
    if (P.bag) {
      this.drawFabric(o.look ? shade(o.look.coat, 0.15) : '#7a5a4a', 'silk');
      // handbag body
      const g = c.createLinearGradient(0, 120, 0, 380); g.addColorStop(0, '#5a2a2a'); g.addColorStop(1, '#2a1212');
      c.fillStyle = g; c.beginPath(); c.moveTo(90, 135); c.lineTo(310, 135); c.quadraticCurveTo(350, 300, 320, 370); c.lineTo(80, 370); c.quadraticCurveTo(50, 300, 90, 135); c.fill();
      c.strokeStyle = '#c9a24a'; c.lineWidth = 6; c.beginPath(); c.moveTo(105, 136); c.quadraticCurveTo(200, 120, 295, 136); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.arc(200, 128, 50, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else {
      this.drawFabric(coat, 'tweed');
      // lapel edge & buttons for context
      c.fillStyle = shade(coat, -0.25); c.beginPath(); c.moveTo(0, 0); c.lineTo(60, 0); c.lineTo(28, 400); c.lineTo(0, 400); c.fill();
      c.fillStyle = shade(coat, -0.4); for (const y of [80, 220, 360]) { c.beginPath(); c.arc(44, y, 9, 0, Math.PI * 2); c.fill(); c.fillStyle = shade(coat, -0.15); c.beginPath(); c.arc(44, y, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = shade(coat, -0.4); }
    }
    // pocket bag x-ray
    c.save();
    c.translate(P.cx, P.cy); c.rotate(P.a);
    const hw0 = this.halfW(0), hwd = this.halfW(P.d);
    c.beginPath(); c.moveTo(-hw0, 0); c.lineTo(hw0, 0); c.lineTo(hwd, P.d - 14); c.quadraticCurveTo(hwd, P.d, hwd - 14, P.d); c.lineTo(-hwd + 14, P.d); c.quadraticCurveTo(-hwd, P.d, -hwd, P.d - 14); c.closePath();
    c.fillStyle = rgba('#140c08', 0.45); c.fill();
    c.save(); c.clip();
    c.fillStyle = rgba('#6e1f2b', 0.25); for (let y = 0; y < P.d; y += 8) c.fillRect(-hw0, y, hw0 * 2, 3);
    // tolerance glow near walls
    const tolA = 0.18;
    c.strokeStyle = `rgba(232,160,64,${tolA})`; c.lineWidth = this.tol * 2;
    c.beginPath(); c.moveTo(-hw0, 0); c.lineTo(-hwd, P.d); c.lineTo(hwd, P.d); c.lineTo(hw0, 0); c.stroke();
    c.restore();
    c.setLineDash([5, 4]); c.strokeStyle = 'rgba(244,233,211,0.55)'; c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
    // wall flash
    if (this.pen > 0.05) {
      c.strokeStyle = `rgba(230,60,50,${Math.min(1, this.pen)})`; c.lineWidth = 4; c.beginPath();
      if (this.lastWall === 'L') { c.moveTo(-hw0, 0); c.lineTo(-hwd, P.d); }
      else if (this.lastWall === 'R') { c.moveTo(hw0, 0); c.lineTo(hwd, P.d); }
      else { c.moveTo(-hwd, P.d); c.lineTo(hwd, P.d); }
      c.stroke();
    }
    // item inside
    if (!this.gripped) {
      c.save(); c.translate(this.itemLocal.u, this.itemLocal.v); c.rotate(-P.a + 0.2);
      const s = this.itemR * 2.6; c.translate(-s / 2, -s / 2); drawItemIcon(c, this.o.item, s);
      c.restore();
      if (this.gripT > 0) { c.strokeStyle = '#a8e8b0'; c.lineWidth = 3; c.beginPath(); c.arc(this.itemLocal.u, this.itemLocal.v, this.itemR + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (this.gripT / 0.42)); c.stroke(); }
    }
    c.restore();
    // welt / mouth (drawn over x-ray)
    c.save(); c.translate(P.cx, P.cy); c.rotate(P.a);
    if (!P.bag) {
      c.fillStyle = shade(coat, -0.35); c.fillRect(-hw0 - 6, -8, hw0 * 2 + 12, 10);
      c.fillStyle = shade(coat, 0.1); c.fillRect(-hw0 - 6, -10, hw0 * 2 + 12, 3);
      c.strokeStyle = rgba('#f4e9d3', 0.35); c.setLineDash([3, 3]); c.lineWidth = 1; c.strokeRect(-hw0 - 3, -7, hw0 * 2 + 6, 7); c.setLineDash([]);
    }
    c.restore();
    // conceal target
    if (this.extracted) {
      c.strokeStyle = 'rgba(168,232,176,0.8)'; c.lineWidth = 2.5; c.setLineDash([6, 4]);
      c.beginPath(); c.arc(345, 355, 34 + Math.sin(this.t * 6) * 3, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(244,233,211,0.8)'; c.font = '600 11px "Josefin Sans", sans-serif'; c.textAlign = 'center'; c.fillText('YOUR COAT', 345, 359);
    }
    // gripped item follows hand
    if (this.gripped) { const s = this.itemR * 2.6; c.save(); c.translate(this.hx - s / 2 + 2, this.hy - s / 2 + 4); drawItemIcon(c, this.o.item, s); c.restore(); }
    const danger = (this.hv || 0) > this.speedLim * 0.9 && this.inside;
    this.drawHand(this.hx, this.hy, { danger, ring: this.inside ? (danger ? '#e04040' : this.pen > 0.3 ? '#e8a040' : 'rgba(168,232,176,0.7)') : null });
    // speed meter
    if (this.inside || this.extracted) {
      const v = clamp((this.hv || 0) / (this.speedLim * 1.6), 0, 1);
      c.fillStyle = 'rgba(20,12,8,0.6)'; c.fillRect(372, 60, 12, 200);
      c.fillStyle = v > 0.62 ? '#e04040' : v > 0.45 ? '#e8a040' : '#7fc88a'; c.fillRect(372, 260 - 200 * v, 12, 200 * v);
      c.fillStyle = '#f4e9d3'; c.fillRect(368, 260 - 200 * 0.62, 20, 2);
      c.save(); c.translate(366, 160); c.rotate(-Math.PI / 2); c.font = '600 9px "Josefin Sans", sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(244,233,211,0.7)'; c.fillText('HAND SPEED', 0, 0); c.restore();
    }
    this.end();
  }
}

// ===================== THE UNHOOK (timing) =====================
export class TimingGame extends MiniBase {
  constructor(cv, o) {
    super(cv, o);
    const S = o.S, rIdx = o.rarityIdx || 0;
    const wrist = o.item.cat === 'wristwatch';
    this.stages = wrist ? ['Loosen the strap', 'Slip the buckle', 'Ease it over the wrist', 'Palm it'] : ['Unhook the T-bar', 'Slip the watch free', 'Palm it'];
    this.si = 0;
    this.zoneMul = (S.upgrades.hand_timing ? 1.32 : 1) * (S.sets.horology ? 1.12 : 1);
    this.showPerfect = !!S.upgrades.hand_timing;
    this.rIdx = rIdx; this.wrist = wrist;
    this.speed = (wrist ? 1.2 : 1) * (1 + rIdx * 0.09);
    this.phase = Math.random() * 6; this.A = 1.0;
    this.newZone();
    this.hint = 'Tap anywhere as the watch swings through the gold arc.';
    this.pop = 0;
  }
  newZone() {
    const w = 0.24 * this.zoneMul / (1 + this.rIdx * 0.1) * (1 - this.si * 0.06);
    let c; do { c = (Math.random() * 2 - 1) * 0.82; } while (this.zone && Math.abs(c - this.zone.c) < 0.3);
    this.zone = { c, w };
  }
  theta() { return this.A * Math.sin(this.phase); }
  down() {
    if (this.done) return;
    const th = this.theta(), z = this.zone;
    const off = Math.abs(th - z.c);
    if (this.glance > 0) { this.addAw(30 * this.o.glanceMul, 'glance'); this.hit(); this.say('They saw your hand move!'); sfx.brush(); this.miss++; return; }
    if (off < z.w / 2) {
      const perfect = off < z.w * 0.18;
      if (perfect) { this.perfect++; this.say('Perfect!', 0.8); this.msgCol = '#ffe08a'; sfx.click(); haptic(10); }
      else { sfx.softclick(); sfx.tick(true); haptic(8); this.say('Smooth.', 0.6); this.msgCol = '#a8e8b0'; }
      this.si++; this.pop = 0.4;
      if (this.si >= this.stages.length) { sfx.pocket(); this.finish(); return; }
      this.speed *= 1.1; this.newZone();
    } else {
      this.miss++; this.near += off < z.w ? 1 : 0;
      this.addAw((off < z.w ? 14 : 24) * this.masked, 'miss'); this.hit(off < z.w ? '#e08a2a' : '#c0283a'); sfx.brush(); haptic(30);
      this.say(off < z.w ? 'Close—the chain jingles.' : 'Fumbled!', 0.9); this.msgCol = '#ffb0a0';
      this.speed *= 1.05;
    }
  }
  update(dt) {
    if (this.done) return;
    this.baseUpdate(dt);
    const sway = 1 + Math.sin(this.t * 0.7) * 0.12 + (this.joltT > 0 ? 0.5 : 0);
    const prevS = Math.sin(this.phase);
    this.phase += dt * 2.3 * this.speed * sway;
    if (Math.sign(Math.sin(this.phase)) !== Math.sign(prevS)) sfx.tick(false);
    this.A = 1.0 + (this.joltT > 0 ? Math.sin(this.t * 13) * 0.08 : 0);
    if (this.pop > 0) this.pop -= dt;
  }
  draw() {
    const c = this.c, o = this.o;
    this.begin();
    const wc = o.look ? (o.look.trim && o.look.trim !== '#e8dccb' ? o.look.trim : shade(o.look.coat, 0.2)) : '#5a3520';
    this.drawFabric(this.wrist ? (o.look ? o.look.coat : '#333') : wc, this.wrist ? 'tweed' : 'silk');
    if (!this.wrist) {
      // waistcoat buttons & pocket
      for (let y = 40; y < 400; y += 70) { c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(40, y, 8, 0, Math.PI * 2); c.fill(); c.fillStyle = '#8a6a24'; c.beginPath(); c.arc(40, y, 4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = shade(wc, -0.35); c.fillRect(270, 300, 100, 10);
    } else {
      // wrist & cuff
      c.fillStyle = o.look ? o.look.skin : '#e8c09a'; c.fillRect(140, 250, 120, 150);
      c.fillStyle = '#f4e9d3'; c.fillRect(130, 330, 140, 70);
    }
    const px = 200, py = 46, Lp = 240;
    // arc track
    c.strokeStyle = 'rgba(20,12,8,0.5)'; c.lineWidth = 26; c.beginPath(); c.arc(px, py, Lp, Math.PI / 2 - this.A, Math.PI / 2 + this.A); c.stroke();
    c.strokeStyle = 'rgba(244,233,211,0.25)'; c.lineWidth = 1;
    for (let a = -1; a <= 1.001; a += 0.1) { const an = Math.PI / 2 + a; c.beginPath(); c.moveTo(px + Math.cos(an) * (Lp - 13), py + Math.sin(an) * (Lp - 13)); c.lineTo(px + Math.cos(an) * (Lp - 6), py + Math.sin(an) * (Lp - 6)); c.stroke(); }
    // gold zone
    const z = this.zone;
    const a0 = Math.PI / 2 - (z.c + z.w / 2), a1 = Math.PI / 2 - (z.c - z.w / 2);
    c.strokeStyle = 'rgba(232,192,90,0.85)'; c.lineWidth = 22; c.beginPath(); c.arc(px, py, Lp, a0, a1); c.stroke();
    c.strokeStyle = '#fff2c0'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, Lp + 11, a0, a1); c.stroke(); c.beginPath(); c.arc(px, py, Lp - 11, a0, a1); c.stroke();
    if (this.showPerfect) { const pw = z.w * 0.18; c.strokeStyle = '#fffbe8'; c.lineWidth = 22; c.beginPath(); c.arc(px, py, Lp, Math.PI / 2 - (z.c + pw), Math.PI / 2 - (z.c - pw)); c.stroke(); }
    // chain & watch
    const th = this.theta();
    const an = Math.PI / 2 - th;
    const wx = px + Math.cos(an) * Lp, wy = py + Math.sin(an) * Lp;
    c.strokeStyle = '#e8cf86'; c.lineWidth = 2;
    c.beginPath(); for (let i = 0; i <= 24; i++) { const t = i / 24; const x = px + (wx - px) * t, y = py + (wy - py) * t + Math.sin(t * Math.PI) * 10; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    c.fillStyle = '#c9a24a'; c.fillRect(px - 14, py - 4, 28, 8);
    c.save(); c.translate(wx, wy); c.rotate(-th * 0.6);
    const s = 64 + (this.pop > 0 ? this.pop * 20 : 0);
    c.translate(-s / 2, -s / 2); drawItemIcon(c, o.item, s);
    c.restore();
    // stage pips
    for (let i = 0; i < this.stages.length; i++) {
      c.fillStyle = i < this.si ? '#e8c25a' : 'rgba(244,233,211,0.25)';
      c.beginPath(); c.arc(200 + (i - (this.stages.length - 1) / 2) * 22, 382, 6, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#f4e9d3'; c.font = '600 13px "Josefin Sans", sans-serif'; c.textAlign = 'center';
    c.fillText((this.stages[this.si] || '').toUpperCase(), 200, 362);
    this.end();
  }
}

// ===================== THE DRAW (trace) =====================
export class TraceGame extends MiniBase {
  constructor(cv, o) {
    super(cv, o);
    const S = o.S, rIdx = o.rarityIdx || 0;
    this.brace = o.item.cat === 'bracelet';
    this.tol = (this.brace ? 15 : 19) * (S.upgrades.hand_steady ? 1.35 : 1) / (1 + rIdx * 0.08);
    this.speedLim = (this.brace ? 95 : 115) / (1 + rIdx * 0.05);
    const r = () => (Math.random() - 0.5);
    const pts = this.brace
      ? [[120 + r() * 20, 230], [150, 110 + r() * 30], [270, 110 + r() * 30], [300 + r() * 20, 240]]
      : [[110 + r() * 30, 140 + r() * 30], [170 + r() * 30, 60 + r() * 30], [300 + r() * 30, 100 + r() * 40], [310 + r() * 30, 300 + r() * 30]];
    this.path = [];
    let L = 0, last = null;
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, mt = 1 - t;
      const x = mt ** 3 * pts[0][0] + 3 * mt * mt * t * pts[1][0] + 3 * mt * t * t * pts[2][0] + t ** 3 * pts[3][0];
      const y = mt ** 3 * pts[0][1] + 3 * mt * mt * t * pts[1][1] + 3 * mt * t * t * pts[2][1] + t ** 3 * pts[3][1];
      if (last) L += Math.hypot(x - last[0], y - last[1]);
      this.path.push({ x, y, L }); last = [x, y];
    }
    this.total = L; this.s = 0; this.holding = false; this.dev = 0; this.snags = 0;
    this.hint = 'Hold the clasp, then trace the chain. Slow and steady.';
  }
  pt(i) {
    const p = this.path[clamp(Math.round(i), 0, this.path.length - 1)];
    const jx = this.joltT > 0 ? Math.sin(this.t * 9) * 9 * this.joltT : 0, jy = this.joltT > 0 ? Math.cos(this.t * 7) * 6 * this.joltT : 0;
    const breath = Math.sin(this.t * 1.3) * 1.5;
    return { x: p.x + jx, y: p.y + jy + breath, L: p.L };
  }
  down(x, y) { const p = this.pt(this.s); if (dist(x, y, p.x, p.y) < 34) { this.holding = true; sfx.grip(); } }
  up() { if (this.holding && this.s < this.path.length - 1) this.say('Released—touch the clasp to continue', 1); this.holding = false; }
  update(dt) {
    if (this.done) return;
    this.baseUpdate(dt);
    if (!this.holding || !this.finger) { this.glancePenalty(dt, false); return; }
    // nearest path index in window
    let best = this.s, bd = 1e9;
    for (let i = Math.max(0, Math.floor(this.s) - 4); i <= Math.min(this.path.length - 1, Math.floor(this.s) + 14); i++) {
      const p = this.pt(i); const d = dist(this.fx, this.fy, p.x, p.y); if (d < bd) { bd = d; best = i; }
    }
    this.dev = bd;
    const prevL = this.pt(this.s).L;
    if (bd < this.tol * 1.6 && best > this.s) this.s = best;
    const v = (this.pt(this.s).L - prevL) / Math.max(dt, 1e-3);
    this.pv = this.pv == null ? v : this.pv * 0.8 + v * 0.2;
    if (bd > this.tol) {
      this.addAw((bd - this.tol) * 1.5 * dt * this.masked, 'tug');
      if (Math.floor(this.t * 4) !== Math.floor((this.t - dt) * 4)) sfx.rustle(0.6);
    }
    if (bd > this.tol * 2.5) { this.snags++; this.near++; this.addAw(16 * this.masked, 'snag'); this.s = Math.max(0, this.s - 10); this.holding = false; this.hit(); sfx.brush(); haptic(35); this.say('Snagged! The chain tugs.', 1); this.msgCol = '#ffb0a0'; }
    if (this.pv > this.speedLim) this.addAw((this.pv - this.speedLim) * 0.35 * dt * this.masked, 'speed');
    this.glancePenalty(dt, this.fv > 20);
    if (this.s >= this.path.length - 1) { sfx.pocket(); haptic(20); this.finish(); }
  }
  draw() {
    const c = this.c, o = this.o, Lk = o.look || {};
    this.begin();
    if (this.brace) {
      c.fillStyle = '#2a1c14'; c.fillRect(0, 0, 400, 400);
      const g = c.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, 'rgba(110,31,43,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); c.fillStyle = g; c.fillRect(0, 0, 400, 400);
      c.fillStyle = Lk.skin || '#e8c09a';
      c.beginPath(); c.moveTo(0, 150); c.quadraticCurveTo(200, 120, 400, 160); c.lineTo(400, 290); c.quadraticCurveTo(200, 270, 0, 300); c.fill();
      c.fillStyle = shade(Lk.coat || '#6e1f2b', 0); c.fillRect(0, 130, 70, 190);
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.moveTo(0, 270); c.quadraticCurveTo(200, 250, 400, 270); c.lineTo(400, 290); c.quadraticCurveTo(200, 270, 0, 300); c.fill();
    } else {
      // nape of neck, shoulders, hair
      c.fillStyle = shade(Lk.coat || '#2a2440', -0.1); c.fillRect(0, 0, 400, 400);
      c.fillStyle = Lk.coat || '#2a2440'; c.beginPath(); c.moveTo(0, 400); c.lineTo(0, 300); c.quadraticCurveTo(200, 220, 400, 300); c.lineTo(400, 400); c.fill();
      c.fillStyle = Lk.skin || '#e8c09a'; c.beginPath(); c.moveTo(110, 400); c.lineTo(120, 120); c.quadraticCurveTo(210, 60, 300, 120); c.lineTo(320, 400); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(200, 120, 3, 200);
      c.fillStyle = Lk.hair || '#4a3020';
      c.beginPath(); c.moveTo(80, 0); c.lineTo(330, 0); c.quadraticCurveTo(340, 90, 300, 130); c.quadraticCurveTo(210, 80, 120, 130); c.quadraticCurveTo(70, 90, 80, 0); c.fill();
      if (Lk.hairStyle === 'bun') { c.beginPath(); c.arc(205, 40, 48, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = Lk.coat || '#2a2440'; c.beginPath(); c.moveTo(60, 400); c.quadraticCurveTo(80, 300, 130, 290); c.lineTo(110, 400); c.fill(); c.beginPath(); c.moveTo(340, 400); c.quadraticCurveTo(320, 300, 300, 290); c.lineTo(320, 400); c.fill();
    }
    // tolerance band along remaining path
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(232,192,90,0.16)'; c.lineWidth = this.tol * 2;
    c.beginPath(); for (let i = Math.floor(this.s); i < this.path.length; i++) { const p = this.pt(i); i === Math.floor(this.s) ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y); } c.stroke();
    // chain beads on remaining path
    const isPearl = /Pearl/.test(o.item.name);
    for (let i = Math.floor(this.s); i < this.path.length; i += 3) { const p = this.pt(i); c.fillStyle = isPearl ? '#f8f4ea' : '#e2b94e'; c.beginPath(); c.arc(p.x, p.y, isPearl ? 4.5 : 2.6, 0, Math.PI * 2); c.fill(); }
    // lifted part dangles from finger
    const cp = this.pt(this.s);
    if (this.s > 0) { c.strokeStyle = isPearl ? '#f8f4ea' : '#e2b94e'; c.lineWidth = isPearl ? 5 : 2.4; c.setLineDash(isPearl ? [1, 7] : []); c.beginPath(); c.moveTo(cp.x, cp.y); c.quadraticCurveTo(cp.x - 10, cp.y + 30 + this.s * 0.3, cp.x - 30, cp.y + 10 + this.s * 0.5); c.stroke(); c.setLineDash([]); }
    // clasp
    c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(cp.x, cp.y, 7, 0, Math.PI * 2); c.fill();
    c.strokeStyle = this.holding ? (this.dev > this.tol ? '#e04040' : '#a8e8b0') : `rgba(255,240,200,${0.5 + 0.5 * Math.sin(this.t * 6)})`; c.lineWidth = 3;
    c.beginPath(); c.arc(cp.x, cp.y, 18, 0, Math.PI * 2); c.stroke();
    if (!this.holding) { c.fillStyle = 'rgba(244,233,211,0.9)'; c.font = '600 11px "Josefin Sans", sans-serif'; c.textAlign = 'center'; c.fillText(this.s ? 'TOUCH TO RESUME' : 'HOLD THE CLASP', cp.x, cp.y - 26); }
    // end marker
    const ep = this.pt(this.path.length - 1); c.strokeStyle = 'rgba(168,232,176,0.6)'; c.setLineDash([4, 4]); c.lineWidth = 2; c.beginPath(); c.arc(ep.x, ep.y, 14, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    // progress
    c.fillStyle = 'rgba(20,12,8,0.6)'; c.fillRect(60, 380, 280, 8); c.fillStyle = '#e8c25a'; c.fillRect(60, 380, 280 * (this.s / (this.path.length - 1)), 8);
    if (this.holding && this.finger) this.drawHand(this.fx + 3, this.fy + 3, { rot: -0.4, danger: this.dev > this.tol });
    this.end();
  }
}

// ===================== THE TWIST (ring) =====================
export class TwistGame extends MiniBase {
  constructor(cv, o) {
    super(cv, o);
    const rIdx = o.rarityIdx || 0;
    this.turns = 3 + Math.floor(rIdx / 2);
    this.prog = 0; this.cx = 210; this.cy = 205;
    this.tense = false; this.tenseT = 3 + Math.random() * 2; this.warnT = 0;
    this.minW = 2.6; this.maxW = 8.5 / (1 + rIdx * 0.06);
    this.lastA = null; this.w = 0;
    this.hint = 'Circle around the ring while the hand is relaxed. Stop when the fingers tense.';
  }
  down(x, y) { this.lastA = Math.atan2(y - this.cy, x - this.cx); }
  up() { this.lastA = null; }
  update(dt) {
    if (this.done) return;
    this.baseUpdate(dt);
    this.tenseT -= dt;
    if (!this.tense && this.tenseT < 0.6 && this.warnT <= 0) { this.warnT = 0.6; sfx.stir(); }
    if (this.warnT > 0) this.warnT -= dt;
    if (this.tenseT <= 0) { this.tense = !this.tense; this.tenseT = this.tense ? 1.2 + Math.random() * 1 : 2.4 + Math.random() * 2.2; }
    let moving = false;
    if (this.finger) {
      const r = dist(this.fx, this.fy, this.cx, this.cy);
      const a = Math.atan2(this.fy - this.cy, this.fx - this.cx);
      if (this.lastA != null && r > 22 && r < 150) {
        let d = a - this.lastA; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
        const w = Math.abs(d) / Math.max(dt, 1e-3);
        this.w = this.w * 0.8 + w * 0.2;
        moving = this.w > 0.8;
        if (this.tense && moving) { this.addAw(58 * dt * this.masked, 'tense'); if (!this._tw) { this._tw = true; this.hit(); sfx.brush(); this.near++; this.say('The hand tenses—stop!', 0.9); this.msgCol = '#ffb0a0'; } }
        else this._tw = false;
        if (!this.tense) {
          if (this.w > this.maxW) { this.addAw((this.w - this.maxW) * 7 * dt * this.masked, 'speed'); }
          if (this.w >= this.minW) { this.prog += Math.abs(d) / (Math.PI * 2 * this.turns) * (this.w > this.maxW ? 0.4 : 1); if (Math.floor(this.prog * 24) !== Math.floor((this.prog - Math.abs(d) / (Math.PI * 2 * this.turns)) * 24)) sfx.softclick(); }
        }
      }
      this.lastA = a;
    } else this.w *= 0.8;
    this.glancePenalty(dt, moving);
    if (this.prog >= 1) { sfx.pocket(); haptic(25); this.finish(); }
  }
  draw() {
    const c = this.c, o = this.o, Lk = o.look || {};
    this.begin();
    c.fillStyle = '#3a2114'; c.fillRect(0, 0, 400, 400);
    c.fillStyle = '#5a3520'; c.fillRect(0, 250, 400, 150);
    c.fillStyle = 'rgba(255,220,160,0.08)'; for (let x = 0; x < 400; x += 30) c.fillRect(x, 250, 2, 150);
    // hand
    const sk = Lk.skin || '#e8c09a';
    const curl = this.tense ? 1 : this.warnT > 0 ? 0.4 + Math.sin(this.t * 40) * 0.2 : 0;
    c.fillStyle = shade(Lk.coat || '#2a2440', 0); c.fillRect(0, 210, 90, 110); c.fillStyle = '#f4e9d3'; c.fillRect(80, 205, 22, 120);
    c.fillStyle = sk; c.beginPath(); c.ellipse(150, 260, 60, 48, 0, 0, Math.PI * 2); c.fill();
    const fingers = [[200, 222, 0], [210, 248, 1], [205, 274, 2], [190, 298, 3]];
    fingers.forEach(([fx, fy, i]) => {
      const len = 120 - i * 12 - curl * 50;
      c.save(); c.translate(fx - 40, fy); c.rotate(0.05 * i - 0.08 + curl * 0.3);
      c.fillStyle = this.tense ? shade(sk, -0.08) : sk;
      c.beginPath(); c.roundRect ? c.roundRect(0, -11, len, 22, 11) : c.rect(0, -11, len, 22); c.fill();
      c.strokeStyle = shade(sk, -0.25); c.lineWidth = 1; c.beginPath(); c.moveTo(len * 0.5, -8); c.lineTo(len * 0.5, 8); c.moveTo(len * 0.78, -8); c.lineTo(len * 0.78, 8); c.stroke();
      c.fillStyle = shade(sk, 0.15); c.beginPath(); c.ellipse(len - 8, 0, 7, 8, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    });
    c.fillStyle = sk; c.beginPath(); c.ellipse(140, 205, 34, 14, -0.6, 0, Math.PI * 2); c.fill();
    // ring on finger index 1, slides outward with progress
    const f = fingers[1]; const len = 108 - curl * 50;
    const along = 30 + this.prog * (len - 30);
    const rx = f[0] - 40 + along, ry = f[1] + (0.05 - 0.08 + curl * 0.3) * along;
    this.cx = rx; this.cy = ry;
    c.save(); c.translate(rx, ry);
    c.strokeStyle = '#8a6a24'; c.lineWidth = 9; c.beginPath(); c.ellipse(0, 0, 7, 14, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#e2b94e'; c.lineWidth = 6; c.beginPath(); c.ellipse(0, 0, 7, 14, 0, 0, Math.PI * 2); c.stroke();
    c.translate(-22, -36); drawItemIcon(c, o.item, 44);
    c.restore();
    // guide circle
    c.strokeStyle = this.tense ? 'rgba(224,64,64,0.7)' : 'rgba(168,232,176,0.55)'; c.lineWidth = 3; c.setLineDash([8, 8]);
    c.lineDashOffset = -this.t * 30; c.beginPath(); c.arc(this.cx, this.cy, 70, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#e8c25a'; c.lineWidth = 6; c.beginPath(); c.arc(this.cx, this.cy, 82, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.prog); c.stroke();
    // tension badge
    c.fillStyle = this.tense ? '#a0283a' : this.warnT > 0 ? '#c07a2a' : '#1f5e4a';
    c.beginPath(); c.roundRect ? c.roundRect(14, 14, 120, 26, 13) : c.rect(14, 14, 120, 26); c.fill();
    c.fillStyle = '#f4e9d3'; c.font = '600 12px "Josefin Sans", sans-serif'; c.textAlign = 'center'; c.fillText(this.tense ? 'TENSE — STOP' : this.warnT > 0 ? 'TWITCHING…' : 'RELAXED', 74, 31);
    // speed
    const v = clamp(this.w / (this.maxW * 1.4), 0, 1);
    c.fillStyle = 'rgba(20,12,8,0.6)'; c.fillRect(372, 60, 12, 200);
    c.fillStyle = this.w > this.maxW ? '#e04040' : this.w >= this.minW ? '#7fc88a' : '#8a7a62'; c.fillRect(372, 260 - 200 * v, 12, 200 * v);
    c.fillStyle = 'rgba(127,200,138,0.35)'; c.fillRect(366, 260 - 200 * (this.maxW / (this.maxW * 1.4)), 24, 200 * ((this.maxW - this.minW) / (this.maxW * 1.4)));
    if (this.finger) this.drawHand(this.fx, this.fy, { rot: -0.3 });
    this.end();
  }
}

// ===================== THE PAT-DOWN (search) =====================
export class SearchGame extends DipGame {
  constructor(cv, o) {
    super(cv, { ...o, pocket: 'breast' });
    this.spots = [
      { id: 'breastL', x: 120, y: 110, label: 'Breast' }, { id: 'lining', x: 205, y: 205, label: 'Lining' }, { id: 'breastR', x: 290, y: 110, label: 'Breast' },
      { id: 'hipL', x: 120, y: 300, label: 'Hip' }, { id: 'hipR', x: 290, y: 300, label: 'Hip' },
    ];
    const hiddenBias = o.hiddenDoc ? ['lining', 'lining', 'breastL'] : ['breastL', 'breastR', 'lining', 'hipL', 'hipR'];
    this.answer = hiddenBias[Math.floor(Math.random() * hiddenBias.length)];
    this.adj = { breastL: ['lining', 'hipL'], breastR: ['lining', 'hipR'], lining: ['breastL', 'breastR', 'hipL', 'hipR'], hipL: ['breastL', 'lining'], hipR: ['breastR', 'lining'] };
    this.searching = true; this.patted = {};
    this.sense = !!o.S.upgrades.intel_lining;
    this.hint = 'Pat a pocket lightly to feel for paper. Each pat risks notice.';
  }
  down(x, y) {
    if (!this.searching) return super.down(x, y);
    if (this.glance > 0) { this.addAw(25, 'glance'); this.hit(); this.say('They felt that!'); return; }
    for (const s of this.spots) {
      if (dist(x, y, s.x, s.y) < 44) {
        const cost = (this.patted[s.id] ? 4 : 10) * this.masked * (this.sense ? 0.7 : 1);
        this.addAw(cost, 'pat'); this.patted[s.id] = (this.patted[s.id] || 0) + 1;
        sfx.rustle(1); haptic(12);
        if (s.id === this.answer) {
          this.say('Paper! Right there.', 1.1); this.msgCol = '#ffe08a'; sfx.discover(0);
          const pos = { breastL: [130, 95, 0.1], breastR: [270, 95, -0.1], lining: [205, 150, 0], hipL: [140, 250, 0.08], hipR: [270, 250, -0.08] }[s.id];
          this.P.cx = pos[0]; this.P.cy = pos[1]; this.P.a = pos[2];
          this.P.w = s.id.startsWith('hip') ? 140 : 105; this.P.d = s.id.startsWith('hip') ? 130 : 150;
          this.searching = false; this.hint = 'Found it. Now dip—slowly.';
          this.itemLocal = { u: 0, v: this.P.d * 0.62 };
        } else if (this.adj[s.id].includes(this.answer)) { this.say('A faint crinkle… nearby.', 1.1); this.msgCol = '#f8e8c8'; }
        else { this.say('Nothing there.', 0.9); this.msgCol = '#c8b8a0'; }
        return;
      }
    }
  }
  update(dt) {
    if (this.searching) { if (this.done) return; this.baseUpdate(dt); return; }
    super.update(dt);
  }
  draw() {
    if (!this.searching) return super.draw();
    const c = this.c, o = this.o;
    this.begin();
    const coat = o.look ? o.look.coat : '#3a3a40';
    this.drawFabric(coat, 'tweed');
    c.fillStyle = shade(coat, -0.25); c.beginPath(); c.moveTo(170, 0); c.lineTo(205, 230); c.lineTo(240, 0); c.fill();
    c.fillStyle = '#efe6d4'; c.beginPath(); c.moveTo(185, 0); c.lineTo(205, 120); c.lineTo(225, 0); c.fill();
    for (const s of this.spots) {
      const glow = this.sense && s.id === this.answer ? 0.25 + 0.2 * Math.sin(this.t * 3) : 0;
      c.fillStyle = `rgba(255,224,138,${0.08 + glow})`; c.beginPath(); c.arc(s.x, s.y, 40, 0, Math.PI * 2); c.fill();
      c.strokeStyle = this.patted[s.id] ? 'rgba(244,233,211,0.35)' : 'rgba(244,233,211,0.7)'; c.lineWidth = 2; c.setLineDash([5, 5]); c.beginPath(); c.arc(s.x, s.y, 40, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(244,233,211,0.85)'; c.font = '600 11px "Josefin Sans", sans-serif'; c.textAlign = 'center'; c.fillText(s.label.toUpperCase(), s.x, s.y + 4);
      if (this.patted[s.id]) { c.fillStyle = 'rgba(20,12,8,0.5)'; c.beginPath(); c.arc(s.x, s.y + 20, 5, 0, Math.PI * 2); c.fill(); }
    }
    this.end();
  }
}

export function makeLiftGame(cv, opts) {
  const tech = opts.tech;
  if (tech === 'timing') return new TimingGame(cv, opts);
  if (tech === 'trace') return new TraceGame(cv, opts);
  if (tech === 'twist') return new TwistGame(cv, opts);
  if (tech === 'search') return new SearchGame(cv, opts);
  return new DipGame(cv, opts);
}
