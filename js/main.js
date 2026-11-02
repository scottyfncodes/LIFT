// LIFT — boot, screen routing and the main loop
import { load, save, freshState, wipe } from './save.js';
import { initAudio, setEnabled, updateAudio, startMusic, setMood, stopMusic, suspend, resume } from './audio.js';
import { renderTitle, renderHideout, renderSettlement } from './screens.js';
import { RunController } from './run.js';
import { closeModal, clearToasts } from './ui.js';

export const G = { S: load(), run: null, hasSave: false };
G.hasSave = !!G.S;
if (!G.S) G.S = freshState();
G.S.run = null; // runs are not resumable mid-journey
setEnabled(G.S.settings.sound, G.S.settings.music);

export function persist() { save(G.S); G.hasSave = true; }

const screenEl = () => document.getElementById('screen');
function setScreenMode(on) { document.body.classList.toggle('screen-mode', on); }

export function goTitle() {
  endRunController();
  setScreenMode(true);
  renderTitle(screenEl(), G, {
    onContinue: () => { audioOn(); goHideout(); },
    onNew: () => { audioOn(); wipe(); G.S = freshState(); persist(); goHideout(true); },
    onSettings: applySettings,
  });
}
export function goHideout(fresh = false) {
  endRunController();
  clearToasts();
  setScreenMode(true);
  startMusic('hideout'); setMood('hideout');
  renderHideout(screenEl(), G, { onBoard: boardTrain, onTitle: goTitle, persist, onSettings: applySettings, fresh });
}
function goSettlement(result) {
  endRunController();
  clearToasts();
  setScreenMode(true);
  setMood('hideout');
  renderSettlement(screenEl(), G, result, { persist, onDone: () => goHideout() });
}
function boardTrain(trainId) {
  audioOn();
  screenEl().innerHTML = '';
  setScreenMode(false);
  clearToasts();
  setMood('calm');
  G.run = new RunController(G.S, trainId, {
    onEnd: result => { G.run = null; goSettlement(result); },
    onQuit: () => { G.run = null; goHideout(); },
    persist,
    onSettings: applySettings,
  });
}
function endRunController() {
  if (G.run) { G.run.destroy(); G.run = null; }
  closeModal(null, true);
}
function audioOn() { initAudio(); setEnabled(G.S.settings.sound, G.S.settings.music); }
function applySettings() { setEnabled(G.S.settings.sound, G.S.settings.music); persist(); }

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  try {
    if (G.run) G.run.frame(dt);
    updateAudio(dt);
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { suspend(); if (G.run) G.run.pause(true); }
  else resume();
});
// First interaction unlocks audio on mobile
window.addEventListener('pointerdown', () => { if (G.hasSave || G.run) audioOn(); }, { once: true });

async function boot() {
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
  goTitle();
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot();

// debugging handle
window.LIFT = G;
