// LIFT — pin-tumbler lockpicking
import { MiniBase } from './common.js';
import { clamp, shade, dist, haptic } from '../util.js';
import { sfx } from '../audio.js';

export class LockGame extends MiniBase {
  constructor(cv, o) {
    super(cv, { ...o, start: 0 });
    this.n = o.pins || 3;
    const order = [...Array(this.n).keys()].sort(() => Math.random() - 0.5);
    this.pins = [...Array(this.n)].map((_, i) => ({ lift: 0, set: false, setH: 0.38 + Math.random() * 0.36, bind: order.indexOf(i), held: false, vib: 0 }));
    this.tolW = 0.065 * (o.S.upgrades.hand_steady ? 1.25 : 1) * (o.strong ? 0.8 : 1);
    this.noise = 0; this.peakNoise = 0;
    this.timeLimit = o.timeLimit || (24 + this.n * 4);
    this.held = -1; this.oversets = 0;
    this.hint = 'Hold a pin to lift it. The binding pin feels gritty—release it right at the gold shear line.';
    this.patience = 999;
    this.glance = 0; this.stir = 0; this.nextStir = 1e9;
  }
  bindingIdx() {
    let best = -1, bo = 99;
    this.pins.forEach((p, i) => { if (!p.set && p.bind < bo) { bo = p.bind; best = i; } });
    return best;
  }
  pinX(i) { return 200 + (i - (this.n - 1) / 2) * (300 / Math.max(4, this.n)); }
  down(x, y) {
    if (this.done) return;
    let bi = -1, bd = 1e9;
    this.pins.forEach((p, i) => { const d = Math.abs(x - this.pinX(i)); if (d < bd && y > 40 && y < 340) { bd = d; bi = i; } });
    if (bi >= 0 && bd < 300 / Math.max(4, this.n) / 1.6 && !this.pins[bi].set) { this.held = bi; this.pins[bi].held = true; sfx.softclick(); }
  }
  up() {
    if (this.held < 0) return;
    const p = this.pins[this.held], i = this.held; this.held = -1; p.held = false;
    const binding = this.bindingIdx() === i;
    if (binding && Math.abs(p.lift - p.setH) < this.tolW) {
      p.set = true; p.lift = p.setH; sfx.click(); haptic(15);
      const prf = Math.abs(p.lift - p.setH) < this.tolW * 0.4; if (prf) this.perfect++;
      this.say('Click.', 0.6); this.msgCol = '#ffe08a';
      if (this.pins.every(q => q.set)) { sfx.unlock(); haptic(40); this.finishLock(); }
    } else if (binding && p.lift > p.setH + this.tolW) {
      // overset: everything drops
      this.oversets++; this.near++;
      this.pins.forEach(q => { q.set = false; });
      this.addNoise(18); sfx.pinDrop(); sfx.brush(); this.hit('#e08a2a'); haptic(40);
      this.say('Overset! The pins drop.', 1.1); this.msgCol = '#ffb0a0';
    } else {
      if (p.lift > 0.25) { this.addNoise(binding ? 4 : 6); sfx.pinDrop(); }
    }
  }
  addNoise(n) { this.noise = clamp(this.noise + n, 0, 100); this.peakNoise = Math.max(this.peakNoise, this.noise); this.aw = this.noise; this.peak = this.peakNoise; if (this.noise >= 100) this.fail('heard'); }
  finishLock() {
    if (this.done) return; this.done = true;
    const quality = this.peakNoise < 25 && this.oversets === 0 ? 'critical' : this.peakNoise < 60 ? 'clean' : 'sloppy';
    this.o.onDone({ success: true, quality, peak: this.peakNoise, near: this.near, perfect: this.perfect });
  }
  update(dt) {
    if (this.done) return;
    this.t += dt;
    if (this.flash > 0) this.flash -= dt; if (this.shake > 0) this.shake -= dt; if (this.msgT > 0) this.msgT -= dt;
    this.nextJolt -= dt;
    if (this.nextJolt <= 0) { this.joltT = 0.9; this.nextJolt = 6 + Math.random() * 5; sfx.jolt(); this.shake = 0.5; }
    if (this.joltT > 0) this.joltT -= dt;
    const bi = this.bindingIdx();
    this.pins.forEach((p, i) => {
      if (p.set) { if (this.joltT > 0 && Math.random() < dt * 0.25 && !this.o.S.upgrades.hand_steady) { p.set = false; this.say('A jolt! One pin slipped.', 1); sfx.pinDrop(); } return; }
      if (p.held) {
        const binding = i === bi;
        const rate = binding ? 0.42 : 1.5;
        p.lift = clamp(p.lift + rate * dt, 0, 1);
        if (binding) { p.vib = 1; if (Math.random() < dt * 14) sfx.tick(Math.abs(p.lift - p.setH) < this.tolW); }
        else if (p.lift >= 1) { /* springy */ }
      } else p.lift = Math.max(0, p.lift - 3 * dt);
      p.vib = Math.max(0, p.vib - dt * 3);
    });
    this.aw = this.noise;
    this.noise = Math.max(0, this.noise - 1.2 * dt);
    if (this.t > this.timeLimit) { this.done = true; this.o.onDone({ success: false, timeout: true, peak: this.peakNoise }); }
  }
  draw() {
    const c = this.c;
    this.begin();
    // brass lock body
    const g = c.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, '#d9b35a'); g.addColorStop(1, '#8a6a24');
    c.fillStyle = g; c.fillRect(0, 0, 400, 400);
    c.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < 400; y += 4) c.fillRect(0, y, 400, 1);
    // cutaway housing
    c.fillStyle = '#2a1c14'; c.beginPath(); c.roundRect ? c.roundRect(30, 40, 340, 300, 12) : c.rect(30, 40, 340, 300); c.fill();
    const shearY = 190;
    // plug
    c.fillStyle = '#6a5228'; c.fillRect(40, shearY, 320, 120);
    c.fillStyle = '#4a3a1a'; c.fillRect(40, shearY, 320, 4);
    // shear line
    c.strokeStyle = 'rgba(255,224,138,0.9)'; c.lineWidth = 2; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(40, shearY); c.lineTo(360, shearY); c.stroke(); c.setLineDash([]);
    c.fillStyle = 'rgba(255,224,138,0.8)'; c.font = '600 10px "Josefin Sans", sans-serif'; c.textAlign = 'left'; c.fillText('SHEAR LINE', 46, shearY - 6);
    const range = 110;
    const bi = this.bindingIdx();
    this.pins.forEach((p, i) => {
      const x = this.pinX(i) + (p.vib > 0 ? (Math.random() - 0.5) * 2 * p.vib : 0);
      const lift = p.lift * range;
      const keyTop = shearY + 40 + p.setH * range - lift;
      const keyLen = (shearY + 100) - keyTop;
      // spring
      c.strokeStyle = '#9a9a9a'; c.lineWidth = 2; c.beginPath();
      const springTop = 50, springBot = keyTop - 60;
      for (let k = 0; k <= 10; k++) { const yy = springTop + (springBot - springTop) * k / 10; c.lineTo(x + (k % 2 ? -8 : 8), yy); } c.stroke();
      // driver pin
      const near = Math.abs(p.lift - p.setH) < this.tolW && i === bi && p.held;
      c.fillStyle = p.set ? '#ffe08a' : near ? '#d8c890' : '#b8b8c0';
      c.beginPath(); c.roundRect ? c.roundRect(x - 10, keyTop - 60, 20, 58, 4) : c.rect(x - 10, keyTop - 60, 20, 58); c.fill();
      // key pin
      c.fillStyle = p.set ? '#e2b94e' : '#c9a24a';
      c.beginPath(); c.roundRect ? c.roundRect(x - 10, keyTop, 20, Math.max(10, keyLen), [3, 3, 10, 10]) : c.rect(x - 10, keyTop, 20, keyLen); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1; c.strokeRect(x - 10, keyTop - 60, 20, 58);
      if (p.held) { c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.strokeRect(x - 14, 46, 28, 290); }
      c.fillStyle = 'rgba(244,233,211,0.7)'; c.textAlign = 'center'; c.font = '600 10px "Josefin Sans", sans-serif'; c.fillText(p.set ? 'SET' : String(i + 1), x, 332);
    });
    // pick
    if (this.held >= 0) {
      const x = this.pinX(this.held), p = this.pins[this.held];
      const tipY = shearY + 100 + 6;
      c.strokeStyle = '#d8d8e0'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 380); c.lineTo(x - 30, tipY + 8); c.lineTo(x, tipY - 2); c.stroke();
    } else { c.strokeStyle = '#d8d8e0'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 380); c.lineTo(60, 330); c.stroke(); }
    // tension wrench
    c.strokeStyle = '#a0a0a8'; c.lineWidth = 6; c.beginPath(); c.moveTo(400, 370); c.lineTo(340, 300); c.lineTo(340, 280); c.stroke();
    // timer bar
    const tl = clamp(1 - this.t / this.timeLimit, 0, 1);
    c.fillStyle = 'rgba(20,12,8,0.7)'; c.fillRect(30, 352, 340, 10);
    c.fillStyle = tl < 0.25 ? '#e04040' : '#7fc88a'; c.fillRect(30, 352, 340 * tl, 10);
    c.fillStyle = '#2a1c14'; c.font = '600 10px "Josefin Sans", sans-serif'; c.textAlign = 'center'; c.fillText('TIME BEFORE SOMEONE COMES', 200, 378);
    this.end();
  }
  drawHud() {
    super.drawHud();
  }
}
