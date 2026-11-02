// LIFT — procedural audio (WebAudio, no assets)
let ctx = null, master, sfxBus, musicBus, ambBus, noiseBuf;
let enabled = { sound: true, music: true };
const amb = { running: false, speed: 1, targetSpeed: 1, nextClack: 0, rumble: null, rumbleGain: null, interior: 1 };
const music = { running: false, nextBeat: 0, step: 0, mood: 'calm', chordIdx: 0 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = enabled.music ? 0.22 : 0; musicBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = enabled.sound ? 1 : 0; ambBus.connect(master);
  sfxBus.gain.value = enabled.sound ? 1 : 0;
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = i % 2 ? w : last * 3.5; }
  // unlock on iOS
  const o = ctx.createOscillator(); const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + 0.05);
}
export function setEnabled(sound, mus) {
  enabled.sound = sound; enabled.music = mus;
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(sound ? 1 : 0, ctx.currentTime, 0.05);
  ambBus.gain.setTargetAtTime(sound ? 1 : 0, ctx.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(mus ? 0.22 : 0, ctx.currentTime, 0.1);
}
export function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
const now = () => (ctx ? ctx.currentTime : 0);

function noise(dur, { freq = 1000, q = 1, type = 'bandpass', gain = 0.3, attack = 0.002, t = now(), bus = sfxBus, decay } = {}) {
  if (!ctx) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (decay || dur));
  src.connect(f); f.connect(g); g.connect(bus);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
function tone(freq, dur, { type = 'sine', gain = 0.2, attack = 0.005, t = now(), bus = sfxBus, slide, detune = 0, release } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (release || dur));
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + (release || dur) + 0.05);
}

// ---------- ambience: wheels, rumble ----------
export function startTrainAmbience(isNight) {
  if (!ctx || amb.running) return;
  amb.running = true;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
  const g = ctx.createGain(); g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.32, now() + 2);
  src.connect(f); f.connect(g); g.connect(ambBus); src.start();
  amb.rumble = src; amb.rumbleGain = g; amb.rumbleF = f;
  amb.nextClack = now() + 0.3;
  amb.night = isNight;
}
export function stopTrainAmbience() {
  if (!ctx || !amb.running) return;
  amb.running = false;
  const g = amb.rumbleGain, s = amb.rumble;
  g.gain.cancelScheduledValues(now()); g.gain.setTargetAtTime(0, now(), 0.4);
  setTimeout(() => { try { s.stop(); } catch (e) {} }, 2000);
}
export function setTrainSpeed(v) { amb.targetSpeed = v; }
export function updateAudio(dt) {
  if (!ctx || ctx.state !== 'running') return;
  if (amb.running) {
    amb.speed += (amb.targetSpeed - amb.speed) * Math.min(1, dt * 0.6);
    amb.rumbleGain.gain.setTargetAtTime(0.06 + 0.28 * amb.speed, now(), 0.3);
    amb.rumbleF.frequency.setTargetAtTime(90 + 110 * amb.speed, now(), 0.3);
    if (amb.speed > 0.05) {
      while (amb.nextClack < now() + 0.2) {
        const t = amb.nextClack;
        const gap = 0.11;
        // clickety-clack: two pairs of joint knocks
        const vol = 0.09 * Math.min(1, amb.speed * 1.4);
        noise(0.08, { freq: 320, q: 2.5, gain: vol, t, bus: ambBus });
        noise(0.08, { freq: 260, q: 2.5, gain: vol * 0.85, t: t + gap / amb.speed * 0.9, bus: ambBus });
        noise(0.06, { freq: 2400, q: 6, gain: vol * 0.15, t, bus: ambBus });
        amb.nextClack = t + 1.35 / Math.max(0.25, amb.speed);
      }
    } else amb.nextClack = now() + 0.5;
  }
  if (music.running) scheduleMusic();
}

export function whistle(far = false) {
  if (!ctx) return;
  const t = now();
  const g = far ? 0.05 : 0.09;
  [440, 554, 659].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = 4; lfo.connect(lg); lg.connect(o.frequency);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(g, t + 0.12); gg.gain.setValueAtTime(g, t + 1.1); gg.gain.linearRampToValueAtTime(0, t + 1.6);
    o.connect(bp); bp.connect(gg); gg.connect(sfxBus);
    o.start(t); lfo.start(t); o.stop(t + 1.7); lfo.stop(t + 1.7);
  });
  noise(1.6, { freq: 3000, q: 0.6, gain: 0.03, attack: 0.1, t });
}

// ---------- sfx ----------
export const sfx = {
  step() { noise(0.05, { freq: 600 + Math.random() * 300, q: 1.2, gain: 0.05 }); },
  door() { noise(0.35, { freq: 900, q: 0.8, gain: 0.08, attack: 0.05 }); tone(110, 0.2, { gain: 0.05, type: 'triangle' }); },
  tick(hi) { tone(hi ? 3200 : 2600, 0.03, { type: 'square', gain: 0.03 }); },
  rustle(v = 1) { noise(0.18, { freq: 2500, q: 0.7, gain: 0.07 * v, attack: 0.02 }); },
  brush() { noise(0.25, { freq: 1300, q: 0.9, gain: 0.14, attack: 0.01 }); tone(180, 0.15, { gain: 0.05, type: 'triangle' }); },
  grip() { tone(880, 0.06, { gain: 0.06, type: 'triangle' }); },
  click() { noise(0.03, { freq: 4500, q: 4, gain: 0.25 }); tone(2200, 0.03, { type: 'square', gain: 0.03 }); },
  softclick() { noise(0.02, { freq: 3500, q: 3, gain: 0.08 }); },
  pinDrop() { noise(0.06, { freq: 2000, q: 3, gain: 0.12 }); tone(600, 0.08, { gain: 0.04, slide: 300 }); },
  unlock() { [0, 0.08, 0.2].forEach((d, i) => noise(0.05, { freq: 3000 - i * 600, q: 4, gain: 0.25, t: now() + d })); tone(330, 0.4, { gain: 0.06, t: now() + 0.2, type: 'triangle' }); },
  success(crit) {
    const base = crit ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    base.forEach((f, i) => { tone(f, 0.6, { gain: 0.07, t: now() + i * 0.07, type: 'triangle', release: 0.9 }); tone(f * 2, 0.4, { gain: 0.02, t: now() + i * 0.07 }); });
    noise(0.3, { freq: 7000, q: 1, gain: 0.03, t: now() + 0.1 });
  },
  pocket() { noise(0.2, { freq: 900, q: 0.8, gain: 0.08, attack: 0.03 }); tone(196, 0.2, { gain: 0.05, type: 'triangle', t: now() + 0.08 }); },
  discover(rarityIdx = 0) {
    const scale = [659.25, 783.99, 987.77, 1174.66, 1318.5, 1567.98];
    const n = 2 + rarityIdx;
    for (let i = 0; i < n; i++) tone(scale[i % 6] * (i >= 6 ? 2 : 1), 0.8, { gain: 0.05, t: now() + i * 0.09, release: 1.2 });
  },
  warn() { tone(196, 0.5, { type: 'sawtooth', gain: 0.03, detune: -8 }); tone(207.6, 0.5, { type: 'sawtooth', gain: 0.03 }); },
  alarm() { [0, 0.18].forEach(d => { tone(392, 0.15, { type: 'square', gain: 0.04, t: now() + d }); tone(370, 0.15, { type: 'square', gain: 0.04, t: now() + d + 0.09 }); }); },
  caught() { tone(220, 0.9, { type: 'sawtooth', gain: 0.06, slide: 110 }); noise(0.4, { freq: 300, q: 1, gain: 0.12 }); },
  stir() { tone(150, 0.25, { type: 'triangle', gain: 0.06 }); noise(0.2, { freq: 500, q: 1, gain: 0.05 }); },
  coin() { [0, 0.12, 0.2, 0.26].forEach((d, i) => tone(2600 + i * 120, 0.12, { type: 'triangle', gain: 0.05 / (i + 1), t: now() + d })); },
  ui() { tone(660, 0.05, { type: 'triangle', gain: 0.04 }); },
  uiBack() { tone(440, 0.05, { type: 'triangle', gain: 0.04 }); },
  cash() { [0, 0.06].forEach(d => noise(0.06, { freq: 5000, q: 3, gain: 0.08, t: now() + d })); tone(1318, 0.3, { type: 'triangle', gain: 0.04, t: now() + 0.1 }); },
  jolt() { noise(0.4, { freq: 140, q: 0.7, gain: 0.3, attack: 0.01 }); noise(0.2, { freq: 1800, q: 4, gain: 0.04, t: now() + 0.05 }); },
  tunnel() { noise(2.5, { freq: 220, q: 0.5, gain: 0.18, attack: 0.6, type: 'lowpass', decay: 2.5 }); },
  heartbeat() { tone(55, 0.15, { gain: 0.12 }); tone(50, 0.15, { gain: 0.09, t: now() + 0.22 }); },
  chime() { [783.99, 659.25, 523.25].forEach((f, i) => tone(f, 0.6, { gain: 0.05, t: now() + i * 0.25, type: 'triangle', release: 1 })); },
  card() { noise(0.04, { freq: 3000, q: 2, gain: 0.08 }); },
  gasp() { noise(0.35, { freq: 1200, q: 1.5, gain: 0.1, attack: 0.05 }); },
  punch() { noise(0.025, { freq: 5200, q: 5, gain: 0.22 }); tone(1900, 0.03, { type: 'square', gain: 0.025 }); noise(0.04, { freq: 2400, q: 3, gain: 0.08, t: now() + 0.07 }); },
  ret() { [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => tone(f, 0.7, { gain: 0.05, t: now() + i * 0.08, type: 'triangle', release: 1.1 })); noise(0.25, { freq: 8000, q: 1, gain: 0.02, t: now() + 0.2 }); },
  witness() { tone(392, 0.25, { type: 'triangle', gain: 0.05 }); tone(587.3, 0.4, { type: 'triangle', gain: 0.05, t: now() + 0.12 }); },
  murmur(v = 1) { noise(0.9, { freq: 520 + Math.random() * 300, q: 2.2, gain: 0.025 * v, attack: 0.25, decay: 0.9 }); },
};

// ---------- music: warm period jazz-lounge generative ----------
const CHORDS = {
  calm: [[50, 57, 62, 65, 69], [55, 59, 62, 65, 69], [48, 55, 59, 64, 67], [45, 52, 57, 60, 64]], // Dm9 G13 Cmaj7 Am7
  tense: [[45, 52, 55, 60, 63], [44, 51, 55, 59, 62], [43, 50, 53, 58, 62], [44, 51, 55, 59, 62]],
  hideout: [[48, 55, 60, 64, 67], [45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62]],
};
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
export function startMusic(mood = 'calm') {
  music.mood = mood;
  if (!ctx || music.running) return;
  music.running = true; music.nextBeat = now() + 0.2; music.step = 0;
}
export function setMood(m) { music.mood = m; }
export function stopMusic() { music.running = false; }
function scheduleMusic() {
  const bpm = music.mood === 'tense' ? 104 : 84;
  const beat = 60 / bpm;
  while (music.nextBeat < now() + 0.25) {
    const t = music.nextBeat, s = music.step;
    const prog = CHORDS[music.mood] || CHORDS.calm;
    const chord = prog[Math.floor(s / 8) % prog.length];
    // walking bass on beats
    if (s % 2 === 0) {
      const bn = chord[0] - 12 + [0, 7, 12, 10, 0, 5, 7, 4][(s / 2) % 8];
      tone(mtof(bn), beat * 0.9, { type: 'triangle', gain: 0.32, bus: musicBus, attack: 0.01, release: beat * 1.1 });
    }
    // brushed snare swing
    if (s % 4 === 2) noise(0.12, { freq: 5000, q: 0.5, gain: 0.05, bus: musicBus, attack: 0.01 });
    if (s % 2 === 1) noise(0.05, { freq: 7000, q: 0.8, gain: 0.025, bus: musicBus });
    // chord stabs (piano-ish)
    if (s % 8 === 0 || (s % 8 === 5 && Math.random() < 0.6)) {
      chord.slice(1).forEach((m, i) => {
        tone(mtof(m), beat * 2.5, { type: 'triangle', gain: 0.06, bus: musicBus, attack: 0.004, t: t + i * 0.012, release: beat * 3 });
        tone(mtof(m + 12), beat * 1.5, { type: 'sine', gain: 0.015, bus: musicBus, t: t + i * 0.012 });
      });
    }
    // melody fragments: clarinet-like
    if (Math.random() < (music.mood === 'tense' ? 0.25 : 0.33) && s % 2 === 0) {
      const scale = chord.slice(1).map(m => m + 12);
      const m = scale[Math.floor(Math.random() * scale.length)];
      tone(mtof(m), beat * 1.2, { type: 'sine', gain: 0.09, bus: musicBus, attack: 0.06, release: beat * 1.6, detune: (Math.random() - 0.5) * 8 });
      tone(mtof(m) * 3, beat * 1, { type: 'sine', gain: 0.012, bus: musicBus, attack: 0.08 });
    }
    music.step++;
    music.nextBeat += beat / 2 * (s % 2 === 0 ? 1.18 : 0.82); // swing
  }
}
