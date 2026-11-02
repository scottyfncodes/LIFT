// LIFT — shared minigame scaffolding
import { clamp, shade, rgba } from '../util.js';
import { sfx } from '../audio.js';

export class MiniBase {
  constructor(canvas, opts) {
    this.cv = canvas; this.c = canvas.getContext('2d'); this.o = opts;
    this.aw = clamp(opts.start || 0, 0, 90); this.peak = this.aw; this.t = 0; this.done = false;
    this.near = 0; this.perfect = 0; this.miss = 0;
    this.finger = null; this.fv = 0; this.fx = 0; this.fy = 0;
    this.joltT = 0; this.nextJolt = 4 + Math.random() * 4;
    this.stir = 0; this.glance = 0; this.nextStir = this.rollStir();
    this.flash = 0; this.flashCol = '#c0283a'; this.msg = null; this.msgT = 0; this.shake = 0;
    this.patience = opts.patience || 24;
    this.layout();
    this._down = e => this.onDown(e); this._move = e => this.onMove(e); this._up = e => this.onUp(e);
    canvas.addEventListener('pointerdown', this._down); window.addEventListener('pointermove', this._move); window.addEventListener('pointerup', this._up); window.addEventListener('pointercancel', this._up);
  }
  destroy() { this.cv.removeEventListener('pointerdown', this._down); window.removeEventListener('pointermove', this._move); window.removeEventListener('pointerup', this._up); window.removeEventListener('pointercancel', this._up); }
  rollStir() {
    const sleepy = this.o.act === 'sleep' ? 2.4 : this.o.act === 'argue' || this.o.act === 'watchshow' ? 2 : 1;
    const rare = 1 - (this.o.rarityIdx || 0) * 0.08;
    return (2.6 + Math.random() * 3.4) * sleepy * rare * (this.o.aware ? 1.3 - this.o.aware * 0.5 : 1);
  }
  layout() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    this.cv.width = W * dpr; this.cv.height = H * dpr; this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
    this.dpr = dpr; this.W = W; this.H = H;
    const top = Math.min(130, H * 0.2), bot = Math.min(120, H * 0.18);
    const size = Math.min(W - 20, H - top - bot, 560);
    this.k = size / 400; this.ox = (W - size) / 2; this.oy = top + (H - top - bot - size) / 2;
  }
  toDesign(e) { return [(e.clientX - this.ox) / this.k, (e.clientY - this.oy) / this.k]; }
  onDown(e) { e.preventDefault(); const [x, y] = this.toDesign(e); this.finger = { x, y, id: e.pointerId, t0: this.t }; this.fx = x; this.fy = y; this.fv = 0; this.down && this.down(x, y); }
  onMove(e) { if (!this.finger || e.pointerId !== this.finger.id) return; const [x, y] = this.toDesign(e); this.finger.nx = x; this.finger.ny = y; }
  onUp(e) { if (!this.finger || e.pointerId !== this.finger.id) return; this.finger = null; this.up && this.up(); }
  addAw(n, why) {
    if (this.done) return;
    this.aw = clamp(this.aw + n, 0, 100); this.peak = Math.max(this.peak, this.aw);
    if (this.aw >= 100) this.fail(why);
  }
  say(m, t = 1.4) { this.msg = m; this.msgT = t; }
  hit(col = '#c0283a') { this.flash = 0.35; this.flashCol = col; this.shake = 0.25; }
  baseUpdate(dt) {
    this.t += dt;
    // finger velocity smoothing
    if (this.finger && this.finger.nx != null) {
      const dx = this.finger.nx - this.fx, dy = this.finger.ny - this.fy;
      const inst = Math.hypot(dx, dy) / Math.max(dt, 1e-3);
      this.fv = this.fv * 0.75 + inst * 0.25;
      this.fx = this.finger.nx; this.fy = this.finger.ny;
    } else this.fv *= 0.8;
    // jolts
    this.nextJolt -= dt;
    if (this.nextJolt <= 0) { this.joltT = 1.1; this.nextJolt = 5 + Math.random() * 4; sfx.jolt(); this.shake = 0.5; }
    if (this.joltT > 0) this.joltT -= dt;
    // glance cycle
    if (this.glance > 0) { this.glance -= dt; if (this.glance <= 0) this.nextStir = this.rollStir(); }
    else if (this.stir > 0) { this.stir -= dt; if (this.stir <= 0) { this.glance = 0.85 + Math.random() * 0.5; } }
    else { this.nextStir -= dt; if (this.nextStir <= 0) { this.stir = 0.65; sfx.stir(); } }
    // patience
    if (this.t > this.patience) { this.addAw(5 * dt, 'impatience'); if (Math.floor(this.t) !== Math.floor(this.t - dt) && Math.floor(this.t) % 4 === 0) this.say('They’re getting restless…'); }
    else this.aw = Math.max(0, this.aw - (this.glance > 0 ? 0 : 2.2) * dt);
    if (this.flash > 0) this.flash -= dt;
    if (this.shake > 0) this.shake -= dt;
    if (this.msgT > 0) this.msgT -= dt;
  }
  get masked() { return this.joltT > 0 ? 0.25 : 1; }
  // movement while they're glancing is dangerous
  glancePenalty(dt, moving) {
    if (this.glance > 0 && moving) { this.addAw(110 * dt * this.o.glanceMul, 'glance'); if (!this._gWarn) { this._gWarn = true; this.hit('#e08a2a'); this.say('FREEZE!'); } }
    else this._gWarn = false;
  }
  finish(extra = {}) {
    if (this.done) return;
    this.done = true;
    const crit = this.peak < 32 && this.near === 0 && this.miss === 0;
    const quality = crit || (this.perfect >= 2 && this.peak < 45 && this.miss === 0) ? 'critical' : this.peak < 66 ? 'clean' : 'sloppy';
    this.o.onDone({ success: true, quality, peak: this.peak, near: this.near, perfect: this.perfect, ...extra });
  }
  fail(why) { if (this.done) return; this.done = true; this.o.onDone({ success: false, why, peak: 100 }); }
  abort() { if (this.done) return; this.done = true; this.o.onDone({ success: false, aborted: true, peak: this.peak, aw: this.aw }); }

  // ---------- drawing helpers ----------
  begin() {
    const c = this.c; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    const g = c.createRadialGradient(this.W / 2, this.H / 2, 50, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.7);
    g.addColorStop(0, 'rgba(40,24,16,0.88)'); g.addColorStop(1, 'rgba(10,6,4,0.97)');
    c.fillStyle = g; c.fillRect(0, 0, this.W, this.H);
    const sx = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0, sy = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;
    c.save(); c.translate(this.ox + sx, this.oy + sy); c.scale(this.k, this.k);
    // stage frame (art deco)
    c.save(); c.beginPath(); c.roundRect ? c.roundRect(0, 0, 400, 400, 18) : c.rect(0, 0, 400, 400); c.clip();
  }
  end() {
    const c = this.c;
    // glance vignette
    if (this.stir > 0 || this.glance > 0) {
      const a = this.glance > 0 ? 0.35 : 0.15 + 0.1 * Math.sin(this.t * 30);
      const g = c.createRadialGradient(200, 200, 120, 200, 200, 290);
      g.addColorStop(0, 'rgba(200,40,40,0)'); g.addColorStop(1, `rgba(200,40,40,${a})`);
      c.fillStyle = g; c.fillRect(0, 0, 400, 400);
    }
    if (this.joltT > 0) { c.fillStyle = `rgba(255,220,150,${0.08 * this.joltT})`; c.fillRect(0, 0, 400, 400); }
    if (this.flash > 0) { c.fillStyle = rgba(this.flashCol, this.flash * 0.6); c.fillRect(0, 0, 400, 400); }
    c.restore();
    c.strokeStyle = '#c9a24a'; c.lineWidth = 3; c.beginPath(); c.roundRect ? c.roundRect(0, 0, 400, 400, 18) : c.rect(0, 0, 400, 400); c.stroke();
    c.strokeStyle = 'rgba(201,162,74,0.4)'; c.lineWidth = 1; c.beginPath(); c.roundRect ? c.roundRect(6, 6, 388, 388, 14) : c.rect(6, 6, 388, 388); c.stroke();
    for (const [x, y] of [[0, 0], [400, 0], [0, 400], [400, 400]]) { c.fillStyle = '#c9a24a'; c.beginPath(); c.moveTo(x, y + (y ? -22 : 22)); c.lineTo(x + (x ? -22 : 22), y); c.lineTo(x, y); c.fill(); }
    c.restore();
    this.drawHud();
  }
  drawHud() {
    const c = this.c, W = this.W;
    const top = this.oy;
    // awareness eye
    const ex = W / 2, ey = Math.max(34, top - 52), aw = this.aw / 100;
    c.save();
    const open = this.glance > 0 ? 1 : this.stir > 0 ? 0.6 : Math.max(0.12, aw * 0.9);
    const col = aw > 0.7 ? '#e04040' : aw > 0.4 ? '#e8a040' : '#e8cf86';
    c.translate(ex, ey);
    c.fillStyle = 'rgba(20,12,8,0.85)'; c.beginPath(); c.ellipse(0, 0, 40, 22, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-32, 0); c.quadraticCurveTo(0, -26 * open, 32, 0); c.quadraticCurveTo(0, 26 * open, -32, 0); c.closePath(); c.stroke();
    c.save(); c.clip(); c.fillStyle = col; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill(); c.fillStyle = '#140c08'; c.beginPath(); c.arc(0, 0, 4.5, 0, Math.PI * 2); c.fill(); c.restore();
    // ring meter
    c.strokeStyle = 'rgba(244,233,211,0.15)'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 30, Math.PI * 0.85, Math.PI * 2.15); c.stroke();
    c.strokeStyle = col; c.beginPath(); c.arc(0, 0, 30, Math.PI * 0.85, Math.PI * 0.85 + Math.PI * 1.3 * aw); c.stroke();
    c.restore();
    c.fillStyle = '#f4e9d3'; c.textAlign = 'center'; c.font = '600 13px "Josefin Sans", sans-serif';
    c.fillText(this.o.title || '', W / 2, Math.max(14, ey - 30));
    c.font = 'italic 14px "Cormorant Garamond", Georgia, serif'; c.fillStyle = 'rgba(244,233,211,0.75)';
    const status = this.glance > 0 ? 'They’re looking around — freeze!' : this.stir > 0 ? 'They stir…' : this.joltT > 0 ? 'The train lurches — your movements are masked' : (this.o.subtitle || '');
    c.fillStyle = this.glance > 0 ? '#ff9a8a' : this.joltT > 0 ? '#ffd793' : 'rgba(244,233,211,0.75)';
    c.fillText(status, W / 2, ey + 40);
    // hint & message below stage
    const by = this.oy + 400 * this.k + 26;
    c.font = '15px "Cormorant Garamond", Georgia, serif'; c.fillStyle = 'rgba(244,233,211,0.85)';
    c.fillText(this.hint || '', W / 2, by);
    if (this.msgT > 0) {
      c.globalAlpha = Math.min(1, this.msgT * 2);
      c.font = '700 22px "Limelight", "Josefin Sans", serif'; c.fillStyle = this.msgCol || '#f8e8c8';
      c.fillText(this.msg, W / 2, this.oy + 400 * this.k / 2 + 8);
      c.globalAlpha = 1;
    }
  }
  drawFabric(col, pattern = 'tweed') {
    const c = this.c;
    c.fillStyle = col; c.fillRect(0, 0, 400, 400);
    c.save(); c.globalAlpha = 0.18;
    if (pattern === 'tweed') {
      c.strokeStyle = shade(col, -0.5); c.lineWidth = 1;
      for (let y = 0; y < 400; y += 6) for (let x = (y / 6) % 2 * 6; x < 400; x += 12) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6, y + 6); c.stroke(); }
      c.strokeStyle = shade(col, 0.35);
      for (let y = 3; y < 400; y += 6) for (let x = (y / 6) % 2 * 6 + 6; x < 400; x += 12) { c.beginPath(); c.moveTo(x + 6, y); c.lineTo(x, y + 6); c.stroke(); }
    } else {
      c.strokeStyle = shade(col, 0.3); c.lineWidth = 0.6;
      for (let x = 0; x < 400; x += 9) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 400); c.stroke(); }
    }
    c.restore();
    const g = c.createRadialGradient(150, 120, 30, 200, 200, 330);
    g.addColorStop(0, 'rgba(255,220,160,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = g; c.fillRect(0, 0, 400, 400);
  }
  drawHand(x, y, opts = {}) {
    // player's gloved hand, fingertip at (x,y), coming from lower-left
    const c = this.c;
    c.save(); c.translate(x, y); c.rotate(opts.rot ?? -0.65);
    const glove = opts.danger ? '#3a2020' : '#2a2224';
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(6, 50, 18, 40, 0, 0, Math.PI * 2); c.fill();
    // sleeve
    c.fillStyle = '#6b5a44'; c.fillRect(-16, 58, 36, 120);
    c.fillStyle = '#f4e9d3'; c.fillRect(-15, 52, 34, 10);
    c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(2, 57, 2.5, 0, Math.PI * 2); c.fill();
    // palm
    c.fillStyle = glove; c.beginPath(); c.ellipse(2, 36, 15, 20, 0, 0, Math.PI * 2); c.fill();
    // fingers (two extended — index & middle)
    c.fillStyle = glove;
    c.beginPath(); c.roundRect ? c.roundRect(-6, -2, 7, 34, 3.5) : c.rect(-6, -2, 7, 34); c.fill();
    c.beginPath(); c.roundRect ? c.roundRect(2, 2, 7, 32, 3.5) : c.rect(2, 2, 7, 32); c.fill();
    c.beginPath(); c.roundRect ? c.roundRect(10, 16, 6, 22, 3) : c.rect(10, 16, 6, 22); c.fill();
    c.beginPath(); c.ellipse(-12, 34, 5, 11, -0.6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-4, 2); c.lineTo(-4, 28); c.stroke();
    c.restore();
    if (opts.ring) { c.strokeStyle = opts.ring; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.stroke(); }
  }
}
