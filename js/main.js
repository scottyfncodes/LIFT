// LIFT — boot, screen routing and the main loop
import { load, save, freshState, wipe } from './save.js';
import { initAudio, setEnabled, updateAudio, startMusic, setMood, stopMusic, suspend, resume } from './audio.js';
import { renderTitle, renderDepot, renderReport } from './screens.js';
import { missionById } from './missions.js';
import { RunController } from './run.js';
import { closeModal, clearToasts } from './ui.js';

export const G = { S: load(), run: null, hasSave: false };
G.hasSave = !!G.S;
if (!G.S) G.S = freshState();
// A saved mid-trip run (S.run) or an unsettled haul (S.pending) is picked up by Continue.
setEnabled(G.S.settings.sound, G.S.settings.music);

export function persist() { save(G.S); G.hasSave = true; }

const screenEl = () => document.getElementById('screen');
function setScreenMode(on) { document.body.classList.toggle('screen-mode', on); }

export function goTitle() {
  endRunController();
  setScreenMode(true);
  renderTitle(screenEl(), G, {
    onContinue: () => { audioOn(); continueGame(); },
    onNew: () => { audioOn(); const st = G.S.settings; wipe(); G.S = freshState(st); persist(); goHideout(true); },
    onSettings: applySettings,
  });
}
export function goHideout(fresh = false) {
  endRunController();
  clearToasts();
  setScreenMode(true);
  startMusic('hideout'); setMood('hideout');
  renderDepot(screenEl(), G, { onBoard: (route, mid) => boardTrain(route, null, mid), onTitle: goTitle, persist, onSettings: applySettings, fresh });
}
function goSettlement(result) {
  endRunController();
  clearToasts();
  setScreenMode(true);
  setMood('hideout');
  renderReport(screenEl(), G, result, { persist, onDone: () => goHideout() });
}
function continueGame() {
  const S = G.S;
  if (S.pending) return goSettlement(S.pending);
  if (S.run && S.run.run && S.run.trainId) return boardTrain(S.run.trainId, S.run);
  goHideout();
}
function boardTrain(trainId, saved = null, missionId = null) {
  audioOn();
  screenEl().innerHTML = '';
  setScreenMode(false);
  clearToasts();
  setMood('calm');
  try {
    G.run = makeRun(trainId, saved, missionId);
  } catch (e) {
    console.error('Could not resume the journey', e);
    G.run = null; G.S.run = null; persist();
    goHideout();
  }
}
function makeRun(trainId, saved, missionId) {
  return new RunController(G.S, trainId, {
    onEnd: result => { G.run = null; goSettlement(result); },
    onQuit: () => { G.run = null; goHideout(); },
    persist,
    onSettings: applySettings,
  }, saved, saved ? null : missionById(missionId));
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
  if (document.hidden) { suspend(); if (G.run) { G.run.saveNow(); G.run.pause(true); } }
  else resume();
});
window.addEventListener('pagehide', () => { if (G.run) G.run.saveNow(); });
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
