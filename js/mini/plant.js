// LIFT — the plant: slipping recovered property back where it belongs, unnoticed.
// Reuses the Dip's pocket physics and drawing; the hand starts holding the item.
import { DipGame } from './pickpocket.js';
import { clamp, haptic } from '../util.js';
import { sfx } from '../audio.js';

export class PlantGame extends DipGame {
  constructor(cv, o) {
    super(cv, o);
    this.gripped = true;          // the item rides in your hand
    this.released = false;
    if (o.S.upgrades.craft_feather) { this.tol *= 1.25; this.speedLim *= 1.15; }
    this.dropV = this.P.d * 0.55; // how deep it must go before you let go
    this.hint = `${o.techName || 'The Plant'}: carry it into the ${this.P.name}, let go deep inside, then withdraw.`;
  }
  down(x, y) { this.off = { x: this.hx - x, y: this.hy - y }; }
  up() {
    this.off = null;
    if (this.inside && this.gripped) {
      const L = this.toLocal(this.hx, this.hy);
      if (L.v > this.dropV) {
        this.gripped = false; this.released = true;
        this.itemLocal = { u: L.u, v: Math.min(L.v + 6, this.P.d - this.itemR) };
        sfx.pocket(); haptic(15); this.say('Left it.', 0.8); this.msgCol = '#a8e8b0';
        this.hint = 'Now draw your hand out—gently.';
      } else { this.say('Deeper—they’d feel it at the mouth.', 1); this.msgCol = '#ffd793'; }
    }
  }
  update(dt) {
    if (this.done) return;
    this.baseUpdate(dt);
    const P = this.P;
    let tx = this.hx, ty = this.hy;
    if (this.finger && this.off) { tx = this.fx + this.off.x; ty = this.fy + this.off.y; }
    const k = Math.min(1, dt * 16);
    let nx = this.hx + (tx - this.hx) * k, ny = this.hy + (ty - this.hy) * k;
    if (this.joltT > 0 && this.inside) { nx += Math.sin(this.t * 40) * 1.2; ny += Math.cos(this.t * 33) * 1.2; }
    const vel = Math.hypot(nx - this.hx, ny - this.hy) / Math.max(dt, 1e-3);
    const prev = this.toLocal(this.hx, this.hy);
    let L = this.toLocal(nx, ny);
    const extra = this.gripped ? this.itemR * 0.55 : 0;
    if (!this.inside) {
      if (prev.v <= 0 && L.v > 0) {
        if (Math.abs(L.u) < this.halfW(0) - 4 - extra) { this.inside = true; sfx.rustle(0.4); }
        else { L.v = 0; const w = this.toWorld(L.u, -1); nx = w.x; ny = w.y; this.addAw(4, 'fumble'); this.hit('#e08a2a'); sfx.brush(); }
      }
    }
    this.pen = 0; this.lastWall = null;
    if (this.inside) {
      if (L.v < 0) {
        if (this.released) { this.inside = false; sfx.pocket(); haptic(20); this.finish(); return; }
        this.inside = false;
      }
      if (this.inside) {
        const hw = this.halfW(L.v);
        const sideClear = hw - Math.abs(L.u) - extra, botClear = P.d - L.v - extra * 0.6;
        const clear = Math.min(sideClear, botClear);
        this.lastWall = sideClear < botClear ? (L.u < 0 ? 'L' : 'R') : 'B';
        if (clear < this.tol) {
          this.pen = clamp((this.tol - clear) / this.tol, 0, 1.4);
          if (clear < 0) {
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
        if (vel > this.speedLim) this.addAw((vel - this.speedLim) * 0.4 * dt * this.masked, 'speed');
      }
    }
    this.glancePenalty(dt, (this.inside && vel > 25) || (!this.inside && vel > 140));
    this.hx = nx; this.hy = ny; this.hv = vel;
  }
  draw() {
    super.draw();
    // depth guide while carrying the item in
    if (this.gripped && this.inside) {
      const c = this.c, P = this.P;
      c.save(); c.translate(this.ox, this.oy); c.scale(this.k, this.k);
      c.translate(P.cx, P.cy); c.rotate(P.a);
      c.strokeStyle = 'rgba(168,232,176,0.55)'; c.setLineDash([6, 6]); c.lineWidth = 2;
      const hw = this.halfW(this.dropV);
      c.beginPath(); c.moveTo(-hw + 6, this.dropV); c.lineTo(hw - 6, this.dropV); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(168,232,176,0.8)'; c.font = '600 10px "Josefin Sans", sans-serif'; c.textAlign = 'center';
      c.fillText('RELEASE BELOW HERE', 0, this.dropV + 14);
      c.restore();
    }
  }
}
