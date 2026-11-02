// LIFT — world rendering
import { T, ROWS, FLOOR_H, WALL_H, GW } from './gen.js';
import { drawCharacter, drawBubble } from './chars.js';
import { shade, rgba, makeCanvas, clamp, mix } from '../util.js';
import { TRAINS, PAL, RARITY } from '../data/content.js';

export const TOP = -WALL_H - 18;      // ceiling top
export const BOTTOM = FLOOR_H + 46;   // undercarriage bottom
const WIN_Y0 = -WALL_H + 20, WIN_Y1 = -22;

function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
function E(c, x, y, rx, ry, f) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); c.fillStyle = f; c.fill(); }

// ---------- window positions per carriage --------------------------------
export function windowsFor(car) {
  const out = [];
  const step = car.type === 'compartment' || car.type === 'sleeper' ? 64 : 64;
  const start = car.type === 'compartment' || car.type === 'sleeper' ? 32 : 48;
  for (let x = start; x < car.w - 30; x += step) out.push(car.x0 + x);
  return out;
}
export function lampsFor(car) {
  const ws = windowsFor(car);
  const out = [];
  for (let i = 0; i < ws.length - 1; i++) out.push((ws[i] + ws[i + 1]) / 2);
  return out;
}

// ---------- static carriage layer ----------------------------------------
export function buildCarriageLayer(car, scale, train) {
  const W = car.w, H = BOTTOM - TOP;
  const cv = makeCanvas(W * scale, H * scale);
  const c = cv.getContext('2d');
  c.scale(scale, scale);
  c.translate(-car.x0, -TOP);
  const P = car.palette;
  const x0 = car.x0, x1 = car.x0 + W;
  const night = train.time === 'night';

  // ceiling / clerestory
  const cg = c.createLinearGradient(0, TOP, 0, -WALL_H);
  cg.addColorStop(0, shade(P.wallDk, -0.4)); cg.addColorStop(1, shade(P.wallDk, -0.1));
  c.fillStyle = cg; c.fillRect(x0, TOP, W, 18);
  c.fillStyle = P.trim; c.fillRect(x0, -WALL_H - 3, W, 3);
  // ceiling lamps
  for (let x = x0 + 64; x < x1; x += 128) { E(c, x, TOP + 8, 9, 4, '#f6d48a'); E(c, x, TOP + 7, 5, 2, '#fff2c8'); }

  // back wall
  const wg = c.createLinearGradient(0, -WALL_H, 0, 0);
  wg.addColorStop(0, shade(P.wall, 0.06)); wg.addColorStop(1, shade(P.wall, -0.15));
  c.fillStyle = wg; c.fillRect(x0, -WALL_H, W, WALL_H);
  // deco pinstripes
  c.fillStyle = rgba('#000000', 0.06);
  for (let x = x0 + 8; x < x1; x += 16) c.fillRect(x, -WALL_H, 1, WALL_H - 22);
  // cornice chevrons
  c.fillStyle = shade(P.trim, -0.25);
  for (let x = x0; x < x1; x += 12) { c.beginPath(); c.moveTo(x, -WALL_H); c.lineTo(x + 6, -WALL_H + 5); c.lineTo(x + 12, -WALL_H); c.fill(); }
  // windows
  const wins = windowsFor(car);
  for (const wx of wins) {
    const ww = 40;
    c.fillStyle = shade(P.trim, -0.35); rr(c, wx - ww / 2 - 4, WIN_Y0 - 4, ww + 8, WIN_Y1 - WIN_Y0 + 8, [14, 14, 3, 3]); c.fill();
    c.fillStyle = P.trim; rr(c, wx - ww / 2 - 2, WIN_Y0 - 2, ww + 4, WIN_Y1 - WIN_Y0 + 4, [12, 12, 2, 2]); c.fill();
    // cut hole later; draw sunburst above
    c.strokeStyle = rgba(P.trim, 0.6); c.lineWidth = 0.8;
    for (let a = 0; a < 7; a++) { const ang = Math.PI + (a + 0.5) * Math.PI / 7; c.beginPath(); c.moveTo(wx, WIN_Y0 - 3); c.lineTo(wx + Math.cos(ang) * 14, WIN_Y0 - 3 + Math.sin(ang) * 8); c.stroke(); }
  }
  // dado panelling
  c.fillStyle = shade(P.wallDk, -0.05); c.fillRect(x0, -20, W, 20);
  c.fillStyle = P.trim; c.fillRect(x0, -21, W, 2);
  c.strokeStyle = rgba('#000000', 0.25); c.lineWidth = 1;
  for (let x = x0 + 4; x < x1 - 20; x += 32) c.strokeRect(x + 2, -16, 26, 12);
  c.strokeStyle = rgba(P.trim, 0.25);
  for (let x = x0 + 4; x < x1 - 20; x += 32) c.strokeRect(x + 3, -15, 24, 10);
  // luggage rack rail
  if (car.type !== 'dining' && car.type !== 'baggage' && car.type !== 'vault') {
    c.fillStyle = shade(P.trim, -0.1); c.fillRect(x0 + 4, -WALL_H + 9, W - 8, 2);
    for (let x = x0 + 16; x < x1; x += 48) c.fillRect(x, -WALL_H + 9, 1.5, 6);
  }
  // sconces
  for (const lx of lampsFor(car)) {
    c.fillStyle = P.trim; c.fillRect(lx - 1, -52, 2, 10);
    c.fillStyle = '#f2b45a'; c.beginPath(); c.moveTo(lx - 6, -58); c.lineTo(lx + 6, -58); c.lineTo(lx + 3, -50); c.lineTo(lx - 3, -50); c.fill();
    c.fillStyle = shade(P.trim, -0.2); c.fillRect(lx - 6, -59, 12, 1.5);
  }
  // dining bar shelves on wall
  if (car.type === 'dining') {
    c.fillStyle = shade(P.wallDk, -0.2); c.fillRect(x0 + 6, -70, 110, 50);
    for (let s = 0; s < 3; s++) {
      c.fillStyle = P.trim; c.fillRect(x0 + 6, -70 + 16 + s * 16, 110, 1.5);
      for (let b = 0; b < 9; b++) { const bx = x0 + 12 + b * 12; const col = ['#5a8a5a', '#8a3a2a', '#c9a24a', '#3a5a7a', '#e8dcc0'][(b + s) % 5]; c.fillStyle = col; c.fillRect(bx, -70 + 6 + s * 16, 5, 10); c.fillRect(bx + 1.5, -70 + 3 + s * 16, 2, 4); }
    }
  }
  if (car.type === 'baggage' || car.type === 'vault') {
    // plank walls
    c.fillStyle = rgba('#000000', 0.12);
    for (let y = -WALL_H + 8; y < -20; y += 9) c.fillRect(x0, y, W, 1);
    c.fillStyle = PAL.cream; c.font = 'bold 9px "Josefin Sans", sans-serif'; c.textAlign = 'center';
    c.fillStyle = rgba('#000', 0.35); c.fillText(car.type === 'vault' ? 'PROPERTY OF THE CROWN' : 'RAILWAY EXPRESS — STAFF ONLY', x0 + W / 2, -62);
  }

  // floor
  const fg = c.createLinearGradient(0, 0, 0, FLOOR_H);
  fg.addColorStop(0, shade(P.floor, -0.2)); fg.addColorStop(1, P.floor);
  c.fillStyle = fg; c.fillRect(x0, 0, W, FLOOR_H);
  if (car.type === 'baggage' || car.type === 'vault') {
    c.fillStyle = rgba('#000000', 0.15);
    for (let y = 0; y < FLOOR_H; y += 12) c.fillRect(x0, y, W, 1);
    for (let x = x0; x < x1; x += 48) for (let y = 0; y < FLOOR_H; y += 24) c.fillRect(x + ((y / 12) % 2) * 24, y, 1, 12);
  } else {
    // carpet pattern: deco diamonds
    c.fillStyle = rgba(P.floor2, 0.9);
    for (let y = 8; y < FLOOR_H; y += 16) for (let x = x0 + ((y / 16) % 2) * 8; x < x1; x += 16) { c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 4, y); c.lineTo(x, y + 4); c.lineTo(x - 4, y); c.fill(); }
    // runner
    let ry0 = 2 * T, ry1 = 4 * T;
    if (car.type === 'compartment' || car.type === 'sleeper') { ry0 = 4.1 * T; ry1 = 5.9 * T; }
    if (car.type === 'lounge' || car.type === 'salon') { ry0 = 1.7 * T; ry1 = 4.4 * T; }
    const runner = car.type === 'salon' ? '#6e1f2b' : car.type === 'lounge' ? '#1f3a30' : shade(P.seat, -0.15);
    c.fillStyle = runner; c.fillRect(x0, ry0 + 4, W, ry1 - ry0 - 8);
    c.fillStyle = P.trim; c.fillRect(x0, ry0 + 5, W, 1.5); c.fillRect(x0, ry1 - 6.5, W, 1.5);
    c.strokeStyle = rgba(P.trim, 0.35); c.lineWidth = 1;
    for (let x = x0 + 16; x < x1; x += 32) { const cy = (ry0 + ry1) / 2; c.beginPath(); c.moveTo(x - 10, cy); c.lineTo(x, cy - 10); c.lineTo(x + 10, cy); c.lineTo(x, cy + 10); c.closePath(); c.stroke(); c.beginPath(); c.arc(x, cy, 3, 0, Math.PI * 2); c.stroke(); }
  }
  // floor light pools
  c.globalCompositeOperation = 'lighter';
  for (const lx of lampsFor(car)) {
    const g = c.createRadialGradient(lx, 30, 2, lx, 30, 110);
    g.addColorStop(0, rgba('#ffb85a', night ? 0.16 : 0.12)); g.addColorStop(1, 'rgba(255,184,90,0)');
    c.fillStyle = g; c.fillRect(lx - 120, -WALL_H, 240, FLOOR_H + WALL_H);
    const g2 = c.createRadialGradient(lx, -54, 1, lx, -54, 34);
    g2.addColorStop(0, rgba('#ffd793', 0.55)); g2.addColorStop(1, 'rgba(255,215,147,0)');
    c.fillStyle = g2; c.fillRect(lx - 40, -90, 80, 80);
  }
  c.globalCompositeOperation = 'source-over';
  // back wall shadow onto floor
  const sg = c.createLinearGradient(0, 0, 0, 14); sg.addColorStop(0, 'rgba(0,0,0,0.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg; c.fillRect(x0, 0, W, 14);

  // end walls (with door gaps) — drawn as thick frames
  for (const ex of [x0, x1]) {
    c.fillStyle = shade(P.wallDk, -0.2);
    c.fillRect(ex - 4, 0, 8, 2 * T); c.fillRect(ex - 4, 4 * T, 8, 2 * T);
    c.fillStyle = P.trim; c.fillRect(ex - 4, 2 * T - 2, 8, 2); c.fillRect(ex - 4, 4 * T, 8, 2);
    c.fillStyle = shade(P.wallDk, -0.35); c.fillRect(ex - 3, -WALL_H, 6, WALL_H);
  }

  // undercarriage below the front lip
  c.fillStyle = '#16120f'; c.fillRect(x0, FLOOR_H + 14, W, BOTTOM - FLOOR_H - 14);
  c.fillStyle = train.livery; c.fillRect(x0, FLOOR_H + 14, W, 12);
  c.fillStyle = P.trim; c.fillRect(x0, FLOOR_H + 14, W, 1.5); c.fillRect(x0, FLOOR_H + 24, W, 1);
  c.font = 'bold 7px "Josefin Sans", sans-serif'; c.textAlign = 'center'; c.fillStyle = rgba(PAL.brassLt, 0.85);
  c.fillText((train.name.replace(/^The /, '')).toUpperCase() + '  ·  ' + car.name.toUpperCase(), x0 + W / 2, FLOOR_H + 22.5);
  // cut window holes
  c.globalCompositeOperation = 'destination-out';
  for (const wx of wins) { rr(c, wx - 20, WIN_Y0, 40, WIN_Y1 - WIN_Y0, [11, 11, 1, 1]); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  // window glass sheen + curtains (drawn over hole edges)
  for (const wx of wins) {
    c.fillStyle = 'rgba(255,240,210,0.07)'; c.beginPath(); c.moveTo(wx - 16, WIN_Y1); c.lineTo(wx - 4, WIN_Y0 + 4); c.lineTo(wx + 2, WIN_Y0 + 4); c.lineTo(wx - 10, WIN_Y1); c.fill();
    const cur = car.type === 'baggage' || car.type === 'vault' ? null : car.type === 'sleeper' ? '#3a1830' : PAL.burgundy;
    if (cur) {
      c.fillStyle = cur;
      c.beginPath(); c.moveTo(wx - 24, WIN_Y0 - 6); c.quadraticCurveTo(wx - 12, WIN_Y0 + 2, wx - 16, WIN_Y1 + 2); c.lineTo(wx - 25, WIN_Y1 + 2); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(wx + 24, WIN_Y0 - 6); c.quadraticCurveTo(wx + 12, WIN_Y0 + 2, wx + 16, WIN_Y1 + 2); c.lineTo(wx + 25, WIN_Y1 + 2); c.closePath(); c.fill();
      c.fillStyle = shade(cur, 0.15); c.fillRect(wx - 25, WIN_Y0 - 7, 50, 4);
      c.fillStyle = P.trim; c.fillRect(wx - 25, WIN_Y0 - 8, 50, 1.2);
      E(c, wx - 18, WIN_Y0 + 18, 1.6, 2.5, P.trim); E(c, wx + 18, WIN_Y0 + 18, 1.6, 2.5, P.trim);
    }
  }
  return cv;
}

// ---------- gangway (live, cheap) -----------------------------------------
export function drawGangway(c, door, run, time) {
  const x0 = door.x0, x1 = door.x1, W = x1 - x0;
  c.fillStyle = '#17110d'; c.fillRect(x0, TOP, W, BOTTOM - TOP);
  // bellows
  c.fillStyle = '#2a211b';
  for (let x = x0; x < x1; x += 6) { c.fillRect(x, -WALL_H + 6, 3, WALL_H - 6 + 2 * T); c.fillRect(x, 4 * T, 3, 2 * T + 14); }
  // floor plate
  c.fillStyle = '#5a5048'; c.fillRect(x0, 2 * T, W, 2 * T);
  c.fillStyle = '#6e6258'; for (let x = x0 + 3; x < x1; x += 8) for (let y = 2 * T + 3; y < 4 * T; y += 8) c.fillRect(x, y, 3, 1);
  c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(x0 + W / 2 - 1, 2 * T, 2, 2 * T);
  // exterior door hint at bottom (platform side)
  if (run.phase === 'station') {
    const g = c.createLinearGradient(0, 4 * T, 0, 6 * T);
    g.addColorStop(0, 'rgba(255,220,160,0.5)'); g.addColorStop(1, 'rgba(255,220,160,0)');
    c.fillStyle = g; c.fillRect(x0 + 6, 4 * T, W - 12, 2 * T);
  }
  // sliding door to the next carriage (on the right end)
  const doorX = x1 - 6;
  const open = door.open;
  c.fillStyle = door.locked ? '#4a2a1a' : '#6b4a2e';
  const dh = 2 * T;
  c.fillRect(doorX - 2, 2 * T - open * dh, 6, dh * (1 - open) + 1);
  if (door.locked) {
    c.fillStyle = '#c9a24a'; rr(c, doorX - 5, 2 * T + 22, 12, 12, 2); c.fill();
    c.fillStyle = '#2a1c14'; c.fillRect(doorX, 2 * T + 26, 2, 5);
    c.strokeStyle = '#c9a24a'; c.lineWidth = 2; c.beginPath(); c.arc(doorX + 1, 2 * T + 22, 3.5, Math.PI, 0); c.stroke();
  }
  // sign above
  c.fillStyle = door.locked ? '#6e1f2b' : '#1f5e4a'; rr(c, x0 + 4, -WALL_H + 22, W - 8, 16, 2); c.fill();
  c.fillStyle = '#f4e9d3'; c.font = 'bold 6px "Josefin Sans", sans-serif'; c.textAlign = 'center';
  const next = run.carriages[door.between[1]];
  c.fillText(door.locked ? 'PRIVATE' : '→', x0 + W / 2, -WALL_H + 32);
  c.font = '5px "Josefin Sans", sans-serif'; c.fillStyle = 'rgba(244,233,211,0.7)';
  c.fillText(next.name.split(' ')[0].toUpperCase(), x0 + W / 2, -WALL_H + 50);
}

export function drawFrontLip(c, car) {
  const P = car.palette, x0 = car.x0, W = car.w;
  c.fillStyle = shade(P.wallDk, -0.15); c.fillRect(x0, FLOOR_H, W, 14);
  c.fillStyle = P.trim; c.fillRect(x0, FLOOR_H, W, 2.2);
  c.fillStyle = rgba('#ffffff', 0.06); c.fillRect(x0, FLOOR_H + 2.2, W, 2);
}

export function drawWheels(c, car, rot) {
  const y = BOTTOM - 10;
  for (const bx of [car.x0 + 70, car.x0 + car.w - 70]) {
    c.fillStyle = '#2a2420'; c.fillRect(bx - 30, y - 12, 60, 8);
    for (const dx of [-18, 18]) {
      E(c, bx + dx, y, 10, 10, '#0e0b09'); E(c, bx + dx, y, 8, 8, '#3a332d'); E(c, bx + dx, y, 2.4, 2.4, '#8a7a6a');
      c.strokeStyle = '#5a524a'; c.lineWidth = 1.2;
      for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 2; c.beginPath(); c.moveTo(bx + dx, y); c.lineTo(bx + dx + Math.cos(a) * 7, y + Math.sin(a) * 7); c.stroke(); }
    }
    c.strokeStyle = '#8a7a6a'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx - 18 + Math.cos(rot) * 5, y + Math.sin(rot) * 5); c.lineTo(bx + 18 + Math.cos(rot) * 5, y + Math.sin(rot) * 5); c.stroke();
  }
}

// ---------- scenery -----------------------------------------------------------
export function drawScenery(c, run, viewX0, viewX1, time) {
  const tr = TRAINS[run.trainId];
  const y0 = -WALL_H, y1 = 0;
  const dist = run.dist || 0;
  const tunnel = run.tunnelT > 0;
  const station = run.phase === 'station' || run.phase === 'arriving' || run.phase === 'departing';
  const g = c.createLinearGradient(0, y0, 0, y1);
  if (tunnel) { g.addColorStop(0, '#0a0806'); g.addColorStop(1, '#15100c'); }
  else { g.addColorStop(0, tr.sky[0]); g.addColorStop(1, tr.sky[1]); }
  c.fillStyle = g; c.fillRect(viewX0, y0, viewX1 - viewX0, y1 - y0);
  if (tunnel) {
    // passing tunnel lamps
    const sp = 200, off = (dist * 1.0) % sp;
    for (let x = viewX0 - off; x < viewX1 + sp; x += sp) { E(c, x, -60, 4, 4, '#ffcf80'); const gg = c.createRadialGradient(x, -60, 1, x, -60, 30); gg.addColorStop(0, 'rgba(255,200,120,0.4)'); gg.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = gg; c.fillRect(x - 30, -90, 60, 60); }
    return;
  }
  const night = tr.time === 'night';
  if (night) {
    c.fillStyle = 'rgba(255,255,240,0.8)';
    for (let i = 0; i < 40; i++) { const sx = ((i * 97.3 - dist * 0.01) % 900 + 900) % 900 + Math.floor(viewX0 / 900) * 900; for (let k = 0; k < 3; k++) { const xx = sx + k * 900; if (xx > viewX0 && xx < viewX1) c.fillRect(xx, y0 + 6 + (i * 37) % 40, 1, 1); } }
    const mx = viewX0 + (viewX1 - viewX0) * 0.7 - (dist * 0.002) % 200;
    E(c, mx, y0 + 22, 9, 9, '#f8f0d0'); E(c, mx + 3, y0 + 20, 8, 8, tr.sky[0]);
  } else {
    // sun haze
    const sx = viewX0 + (viewX1 - viewX0) * 0.8;
    const sg = c.createRadialGradient(sx, y0 + 30, 2, sx, y0 + 30, 60); sg.addColorStop(0, 'rgba(255,240,200,0.9)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = sg; c.fillRect(sx - 60, y0, 120, 90);
  }
  if (station) {
    // platform scene (static while stopped; slides when arriving/departing)
    const off = run.stationSlide || 0;
    c.fillStyle = night ? '#2a2420' : '#b8a888'; c.fillRect(viewX0, -40, viewX1 - viewX0, 40);
    c.fillStyle = night ? '#1a1612' : '#8a7a62'; c.fillRect(viewX0, -42, viewX1 - viewX0, 3);
    for (let x = Math.floor((viewX0 + off) / 120) * 120 - off; x < viewX1 + 120; x += 120) {
      c.fillStyle = night ? '#3a302a' : '#6e1f2b'; c.fillRect(x, y0 + 4, 5, 60);
      c.fillStyle = night ? '#4a3f35' : '#5a3520'; c.fillRect(x - 30, y0 + 2, 65, 6);
      if (night) { E(c, x + 2, y0 + 16, 4, 4, '#ffd793'); }
    }
    // station sign
    const st = tr.stations[Math.min(run.leg + 1, tr.stations.length - 1)];
    for (let x = Math.floor((viewX0 + off) / 360) * 360 + 180 - off; x < viewX1 + 360; x += 360) {
      c.fillStyle = '#1f5e4a'; rr(c, x - 44, -76, 88, 18, 3); c.fill();
      c.fillStyle = '#f4e9d3'; rr(c, x - 41, -73, 82, 12, 2); c.fill();
      c.fillStyle = '#1f3a30'; c.font = 'bold 7px "Josefin Sans", sans-serif'; c.textAlign = 'center'; c.fillText(st.toUpperCase(), x, -64.5);
    }
    // waiting figures (silhouettes)
    c.fillStyle = night ? 'rgba(20,15,10,0.7)' : 'rgba(60,40,30,0.55)';
    for (let i = 0; i < 12; i++) { const fx = ((i * 173 - off) % 1400 + 1400) % 1400 + Math.floor(viewX0 / 1400) * 1400; for (const xx of [fx, fx + 1400]) if (xx > viewX0 - 20 && xx < viewX1 + 20) { E(c, xx, -52, 3, 3.4, c.fillStyle); c.fillRect(xx - 3.5, -49, 7, 12); } }
    return;
  }
  // far hills
  c.fillStyle = shade(tr.hills, 0.25);
  c.beginPath(); c.moveTo(viewX0, y1);
  for (let x = viewX0; x <= viewX1 + 20; x += 20) { const wx = x + dist * 0.05; c.lineTo(x, -48 - Math.sin(wx * 0.006) * 10 - Math.sin(wx * 0.017) * 5); }
  c.lineTo(viewX1 + 20, y1); c.fill();
  // mid fields
  c.fillStyle = tr.hills;
  c.beginPath(); c.moveTo(viewX0, y1);
  for (let x = viewX0; x <= viewX1 + 20; x += 16) { const wx = x + dist * 0.18; c.lineTo(x, -34 - Math.sin(wx * 0.011) * 6 - Math.sin(wx * 0.031) * 3); }
  c.lineTo(viewX1 + 20, y1); c.fill();
  // trees / chimneys
  const sp = 90, off2 = (dist * 0.45) % sp;
  for (let x = viewX0 - off2 - sp; x < viewX1 + sp; x += sp) {
    const seed = Math.floor((x + dist * 0.45) / sp);
    const h = 10 + ((seed * 7919) % 13);
    if (seed % 5 === 0) { c.fillStyle = shade(tr.hills, -0.35); c.fillRect(x, -30 - h * 1.6, 6, h * 1.6); c.fillStyle = 'rgba(200,190,180,0.35)'; E(c, x + 3 + 6, -34 - h * 1.6, 8, 4, c.fillStyle); }
    else { c.fillStyle = shade(tr.hills, -0.25); E(c, x, -30 - h * 0.5, 7, h * 0.7, c.fillStyle); c.fillRect(x - 1, -30, 2, 6); }
  }
  // telegraph poles (fast)
  const sp3 = 260, off3 = (dist * 1.4) % sp3;
  c.strokeStyle = 'rgba(40,25,15,0.55)'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(viewX0, -62); c.lineTo(viewX1, -62); c.moveTo(viewX0, -58); c.lineTo(viewX1, -58); c.stroke();
  for (let x = viewX0 - off3; x < viewX1 + sp3; x += sp3) { c.fillStyle = 'rgba(40,25,15,0.8)'; c.fillRect(x, -70, 3, 70); c.fillRect(x - 7, -66, 17, 2); }
  // steam puffs drifting past
  const sp4 = 330, off4 = (dist * 0.9 + time * 20) % sp4;
  for (let x = viewX0 - off4; x < viewX1 + sp4; x += sp4) { c.fillStyle = night ? 'rgba(120,120,140,0.18)' : 'rgba(255,250,240,0.35)'; E(c, x, -76, 18, 7, c.fillStyle); E(c, x + 14, -80, 12, 6, c.fillStyle); }
}

// ---------- props -----------------------------------------------------------
export function propSortY(p) {
  switch (p.kind) {
    case 'bench': case 'chair': case 'armchair': case 'chairsm': case 'berth': return p.y + 2;
    case 'sofa': return p.y + p.h + 10;
    case 'wtable': return p.y + p.h * 0.5;
    case 'dtable': return p.y + p.h * 0.5;
    case 'cwall': case 'cdoor': return p.y + p.h + 2;
    case 'partition': return p.y + p.h;
    case 'cache': return p.y;
    default: return p.y + p.h;
  }
}

export function drawProp(c, p, car, run, time, opts = {}) {
  const P = car.palette;
  const { x, y, w, h } = p;
  switch (p.kind) {
    case 'bench': {
      const back = p.dir === 'r' ? x : x + w - 8;
      const seatX = p.dir === 'r' ? x + 6 : x;
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x + 2, y + h - 4, w, 6);
      // seat
      c.fillStyle = P.seatDk; c.fillRect(seatX, y + h - 12, w - 6, 12);
      c.fillStyle = P.seat; rr(c, seatX, y - 6, w - 6, h - 6, 3); c.fill();
      c.fillStyle = rgba('#ffffff', 0.08); c.fillRect(seatX + 2, y - 4, w - 10, 3);
      // tufting
      c.fillStyle = rgba('#000000', 0.18); for (let yy = y + 6; yy < y + h - 12; yy += 14) E(c, seatX + (w - 6) / 2, yy, 1.2, 1.2, c.fillStyle);
      // backrest
      c.fillStyle = shade(P.seat, -0.2); rr(c, back, y - 30, 8, h + 18, 3); c.fill();
      c.fillStyle = P.seat; rr(c, back + 1, y - 32, 6, h + 14, 3); c.fill();
      c.fillStyle = car.palette.trim; c.fillRect(back, y - 33, 8, 2.2);
      c.fillStyle = shade(P.wallDk, -0.2); c.fillRect(back, y + h - 14, 8, 14);
      break;
    }
    case 'chair': {
      const back = p.dir === 'r' ? x + 1 : x + w - 9;
      const seatX = p.dir === 'r' ? x + 7 : x + 3;
      for (const yy of [y + 4, y + 36]) {
        c.fillStyle = 'rgba(0,0,0,0.2)'; E(c, x + w / 2, yy + 22, 13, 4, c.fillStyle);
        c.fillStyle = P.seatDk; c.fillRect(seatX, yy + 14, 20, 6);
        c.fillStyle = P.seat; rr(c, seatX, yy, 20, 16, 3); c.fill();
        c.fillStyle = PAL.woodDk; rr(c, back, yy - 22, 8, 40, 4); c.fill();
        c.fillStyle = P.seat; rr(c, back + 1.5, yy - 19, 5, 22, 3); c.fill();
        c.fillStyle = car.palette.trim; E(c, back + 4, yy - 22, 4, 2, c.fillStyle);
      }
      break;
    }
    case 'armchair': case 'chairsm': {
      const cx = x + w / 2, cy = y + h / 2;
      const small = p.kind === 'chairsm';
      const s = small ? 0.7 : 1;
      c.fillStyle = 'rgba(0,0,0,0.22)'; E(c, cx, cy + 14 * s, 16 * s, 5 * s, c.fillStyle);
      const col = small ? PAL.woodLt : P.seat;
      c.fillStyle = shade(col, -0.25); rr(c, cx - 13 * s, cy - 4 * s, 26 * s, 18 * s, 6 * s); c.fill();
      c.fillStyle = col; rr(c, cx - 11 * s, cy - 8 * s, 22 * s, 16 * s, 5 * s); c.fill();
      const bx = p.dir === 'r' ? cx - 14 * s : p.dir === 'l' ? cx + 6 * s : cx - 13 * s;
      if (p.dir === 'l' || p.dir === 'r') { c.fillStyle = shade(col, -0.12); rr(c, bx, cy - 26 * s, 9 * s, 38 * s, 5 * s); c.fill(); }
      else if (p.dir === 'd') { c.fillStyle = shade(col, -0.12); rr(c, cx - 13 * s, cy - 24 * s, 26 * s, 14 * s, 5 * s); c.fill(); }
      break;
    }
    case 'sofa': {
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x, y + h + 4, w, 6);
      c.fillStyle = shade(P.seat, -0.1); rr(c, x, y + 4, w, h - 4, 4); c.fill();
      c.fillStyle = P.seatDk; rr(c, x - 3, y + 10, w + 6, h + 2, 5); c.fill();
      c.fillStyle = P.seat; rr(c, x - 2, y + 12, w + 4, h - 4, 5); c.fill();
      c.fillStyle = car.palette.trim; c.fillRect(x - 3, y + 11, w + 6, 1.5);
      break;
    }
    case 'wtable': {
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x + 4, y + h - 2, w - 8, 4);
      c.fillStyle = PAL.woodDk; c.fillRect(x + w / 2 - 2, y + 2, 4, h - 4);
      c.fillStyle = PAL.woodLt; rr(c, x + 3, y - 14, w - 6, h * 0.6, 2); c.fill();
      c.fillStyle = car.palette.trim; c.fillRect(x + 3, y - 14 + h * 0.6 - 2, w - 6, 2);
      if ((p.id.charCodeAt(0) % 3) === 0) { c.fillStyle = '#f4e9d3'; c.fillRect(x + w / 2 - 4, y - 12, 8, 5); }
      else { E(c, x + w / 2, y - 9, 3, 2, '#efe6d4'); c.fillStyle = '#8a3a2a'; c.fillRect(x + w / 2 - 1, y - 14, 2, 4); }
      break;
    }
    case 'dtable': {
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x, y + h - 2, w, 6);
      c.fillStyle = '#e8e0cc'; c.fillRect(x - 1, y + 2, w + 2, h - 6);
      c.fillStyle = '#f8f4ea'; rr(c, x - 2, y - 12, w + 4, h - 2, 2); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(x - 2, y + h - 18, w + 4, 4);
      for (const py of [y - 2, y + h - 30]) { E(c, x + w / 2, py, 7, 4.5, '#ffffff'); E(c, x + w / 2, py, 4.5, 2.8, '#e8dcc0'); }
      c.fillStyle = '#c9ced6'; c.fillRect(x + 3, y - 4, 1, 7); c.fillRect(x + w - 4, y - 4, 1, 7);
      // table lamp
      const lx = x + w / 2, ly = y + h / 2 - 16;
      c.fillStyle = car.palette.trim; c.fillRect(lx - 1, ly - 8, 2, 10);
      c.fillStyle = '#f2b45a'; c.beginPath(); c.moveTo(lx - 6, ly - 8); c.lineTo(lx + 6, ly - 8); c.lineTo(lx + 3.5, ly - 15); c.lineTo(lx - 3.5, ly - 15); c.fill();
      if (!opts.noGlow) { const g = c.createRadialGradient(lx, ly - 8, 1, lx, ly - 8, 30); g.addColorStop(0, 'rgba(255,200,110,0.35)'); g.addColorStop(1, 'rgba(255,200,110,0)'); c.fillStyle = g; c.fillRect(lx - 30, ly - 38, 60, 60); }
      break;
    }
    case 'ltable': {
      E(c, x + w / 2, y + h - 2, 9, 3, 'rgba(0,0,0,0.2)');
      c.fillStyle = PAL.woodDk; c.fillRect(x + w / 2 - 1.5, y + 2, 3, h - 4);
      E(c, x + w / 2, y - 2, 11, 5, PAL.woodLt); E(c, x + w / 2, y - 3, 10, 4, shade(PAL.woodLt, 0.1));
      c.fillStyle = 'rgba(220,235,240,0.7)'; c.fillRect(x + w / 2 - 2, y - 10, 4, 7);
      break;
    }
    case 'cardtable': {
      E(c, x + w / 2, y + h, w / 2, 6, 'rgba(0,0,0,0.25)');
      c.fillStyle = PAL.woodDk; c.fillRect(x + w / 2 - 3, y + 6, 6, h - 4);
      E(c, x + w / 2, y + h / 2 - 8, w / 2 + 2, h / 2, PAL.wood);
      E(c, x + w / 2, y + h / 2 - 9, w / 2 - 3, h / 2 - 4, '#1f5e4a');
      for (let i = 0; i < 5; i++) { c.save(); c.translate(x + w / 2 - 10 + i * 5, y + h / 2 - 10 + (i % 2) * 3); c.rotate(i * 0.4); c.fillStyle = '#f8f4ea'; c.fillRect(-2, -3, 4, 6); c.restore(); }
      E(c, x + w / 2 + 12, y + h / 2 - 6, 3, 2, '#c9a24a'); E(c, x + w / 2 + 13, y + h / 2 - 8, 3, 2, '#e8cf86');
      break;
    }
    case 'piano': {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + h - 2, w, 6);
      c.fillStyle = '#16121a'; rr(c, x, y - 34, w, h + 30, 3); c.fill();
      c.fillStyle = '#2a2430'; c.fillRect(x + 3, y - 30, w - 6, 14);
      c.fillStyle = '#f8f4ea'; c.fillRect(x + 2, y + h - 14, w - 4, 5);
      c.fillStyle = '#16121a'; for (let k = x + 5; k < x + w - 4; k += 4) c.fillRect(k, y + h - 14, 2, 3);
      c.fillStyle = car.palette.trim; E(c, x + 10, y - 36, 3, 4, c.fillStyle); E(c, x + w - 10, y - 36, 3, 4, c.fillStyle);
      break;
    }
    case 'plant': {
      E(c, x + w / 2, y + h - 2, 10, 3, 'rgba(0,0,0,0.25)');
      c.fillStyle = '#c9a24a'; c.beginPath(); c.moveTo(x + 7, y + 4); c.lineTo(x + w - 7, y + 4); c.lineTo(x + w - 10, y + h); c.lineTo(x + 10, y + h); c.fill();
      c.strokeStyle = '#2f6a4a'; c.lineWidth = 3;
      for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.38; c.beginPath(); c.moveTo(x + w / 2, y + 4); c.quadraticCurveTo(x + w / 2 + Math.cos(a) * 12, y - 18, x + w / 2 + Math.cos(a) * 22, y - 10 + Math.abs(i - 3) * 4); c.stroke(); }
      break;
    }
    case 'barcart': {
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x, y + h, w, 4);
      c.strokeStyle = car.palette.trim; c.lineWidth = 1.5; c.strokeRect(x + 2, y - 14, w - 4, h + 12);
      c.fillStyle = PAL.woodLt; c.fillRect(x + 2, y - 14, w - 4, 3); c.fillRect(x + 2, y + 2, w - 4, 3);
      for (let i = 0; i < 4; i++) { c.fillStyle = ['#5a8a5a', '#8a3a2a', '#c9a24a', '#e8dcc0'][i]; c.fillRect(x + 6 + i * 7, y - 24, 4, 10); }
      E(c, x + 6, y + h + 2, 3, 3, '#1a1512'); E(c, x + w - 6, y + h + 2, 3, 3, '#1a1512');
      break;
    }
    case 'bar': {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + h, w, 6);
      c.fillStyle = PAL.woodDk; c.fillRect(x, y + 8, w, h - 4);
      c.fillStyle = PAL.wood; for (let k = x + 4; k < x + w - 8; k += 24) { c.fillRect(k, y + 14, 20, h - 16); }
      c.strokeStyle = car.palette.trim; c.lineWidth = 1; for (let k = x + 4; k < x + w - 8; k += 24) c.strokeRect(k + 3, y + 17, 14, h - 22);
      c.fillStyle = '#e8e0d0'; c.fillRect(x - 2, y - 2, w + 4, 11);
      c.fillStyle = car.palette.trim; c.fillRect(x - 2, y + 8, w + 4, 2); c.fillRect(x, y + h + 1, w, 2);
      E(c, x + 20, y + 1, 3, 2, '#c9a24a'); c.fillStyle = 'rgba(220,235,240,0.7)'; c.fillRect(x + 50, y - 6, 4, 7); c.fillRect(x + 80, y - 7, 3, 8);
      break;
    }
    case 'lav': {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + h, w, 6);
      c.fillStyle = PAL.woodDk; c.fillRect(x, y - 52, w, h + 52);
      c.fillStyle = PAL.wood; rr(c, x + 6, y - 40, w - 18, h + 34, 2); c.fill();
      c.strokeStyle = car.palette.trim; c.lineWidth = 1; c.strokeRect(x + 10, y - 34, w - 26, 26); c.strokeRect(x + 10, y - 2, w - 26, 24);
      E(c, x + w - 16, y + 6, 2, 2, car.palette.trim);
      c.fillStyle = run && run.player && run.player.hidden && opts.hideHere ? '#a0283a' : '#1f5e4a'; rr(c, x + 14, y - 48, w - 34, 8, 1); c.fill();
      c.fillStyle = '#f4e9d3'; c.font = 'bold 5px "Josefin Sans", sans-serif'; c.textAlign = 'center'; c.fillText(run && run.player && run.player.hidden && opts.hideHere ? 'ENGAGED' : 'W.C.', x + 14 + (w - 34) / 2, y - 42);
      c.fillStyle = car.palette.trim; c.fillRect(x, y - 53, w, 2);
      break;
    }
    case 'rack': {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + h - 2, w, 6);
      const cols = ['#6b3a20', '#3a4a3a', '#5a2a2a', '#7a5a3a'];
      for (let i = 0; i < 3; i++) { c.fillStyle = cols[i]; rr(c, x + 4 + i * 6, y + 18 - i * 12, w - 12 - i * 6, 22, 3); c.fill(); c.fillStyle = '#c9a24a'; c.fillRect(x + 8 + i * 6, y + 26 - i * 12, 4, 3); c.fillRect(x + w - 16 - i * 3, y + 26 - i * 12, 4, 3); }
      if (opts.mine) { c.fillStyle = '#6e1f2b'; rr(c, x + 10, y + h - 20, 26, 16, 3); c.fill(); c.fillStyle = '#e8cf86'; c.fillRect(x + 20, y + h - 22, 6, 3); c.font = 'bold 6px Georgia'; c.fillStyle = '#f4e9d3'; c.textAlign = 'center'; c.fillText('L', x + 23, y + h - 9); }
      break;
    }
    case 'partition': {
      c.fillStyle = shade(P.wallDk, -0.1); c.fillRect(x + 4, y - 50, 8, h + 50);
      c.fillStyle = P.trim; c.fillRect(x + 4, y - 52, 8, 3);
      c.fillStyle = shade(P.wall, 0.05); c.fillRect(x + 5, y - 48, 6, h + 44);
      break;
    }
    case 'cwall': case 'cdoor': {
      const isDoor = p.kind === 'cdoor';
      const dr = isDoor ? p.doorRect : [x, y + 4, w, h - 4];
      const top = y + 4 - 44;
      if (isDoor) {
        const comp = run.compState && run.compState[p.car + ':' + p.comp];
        const open = comp ? comp.open : 0;
        const locked = comp && comp.locked;
        // sliding panel
        const px = dr[0] + open * (dr[2] - 4);
        c.fillStyle = 'rgba(220,230,235,0.18)'; c.fillRect(px, top + 4, dr[2], 30);
        c.fillStyle = shade(P.wallDk, 0.05); c.fillRect(px, top + 34, dr[2], 14);
        c.strokeStyle = P.trim; c.lineWidth = 1.5; c.strokeRect(px, top + 3, dr[2], 45);
        if (locked) { c.fillStyle = '#c9a24a'; rr(c, px + dr[2] / 2 - 3, top + 30, 6, 6, 1); c.fill(); }
        c.fillStyle = P.trim; c.fillRect(px + 3, top + 24, 2, 8);
      } else {
        c.fillStyle = 'rgba(220,230,235,0.14)'; c.fillRect(x, top + 4, w, 30);
        c.strokeStyle = rgba('#ffffff', 0.15); c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 4, top + 30); c.lineTo(x + 12, top + 8); c.stroke();
        c.fillStyle = shade(P.wallDk, -0.05); c.fillRect(x, top + 34, w, 14);
        c.fillStyle = P.trim; c.fillRect(x, top + 2, w, 2.5); c.fillRect(x, top + 33, w, 1.5);
      }
      break;
    }
    case 'berth': {
      c.fillStyle = PAL.woodDk; rr(c, x, y - 10, w, h + 8, 3); c.fill();
      c.fillStyle = '#efe6d4'; rr(c, x + 3, y - 8, w - 6, h + 2, 3); c.fill();
      c.fillStyle = shade(P.seat, 0.1); rr(c, x + 30, y - 6, w - 34, h - 2, 3); c.fill();
      c.fillStyle = P.trim; c.fillRect(x, y + h - 4, w, 2);
      // curtain
      c.fillStyle = rgba(P.seat, 0.85); c.fillRect(x + w - 10, y - 46, 8, h + 36);
      break;
    }
    case 'luggage': case 'trunk': case 'strongbox': {
      const looted = p.looted;
      const cx = x, cy = y;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(cx + 2, cy + h - 2, w - 2, 5);
      if (p.kind === 'strongbox') {
        c.fillStyle = '#3a3a40'; rr(c, cx, cy - 14, w, h + 12, 2); c.fill();
        c.fillStyle = '#4a4a52'; c.fillRect(cx + 2, cy - 12, w - 4, 6);
        c.fillStyle = '#c9a24a'; E(c, cx + w / 2, cy + 2, 5, 5, '#c9a24a'); E(c, cx + w / 2, cy + 2, 3, 3, '#3a3a40');
        if (looted) { c.fillStyle = '#16141a'; c.fillRect(cx + 3, cy - 16, w - 6, 4); }
      } else {
        const col = p.kind === 'trunk' ? '#5a3a24' : ['#6b3a20', '#3a4a5a', '#5a2a2a', '#4a5a3a'][p.id.charCodeAt(1) % 4];
        c.fillStyle = shade(col, -0.25); rr(c, cx, cy - 10, w, h + 8, 3); c.fill();
        c.fillStyle = col; rr(c, cx, cy - 12, w, h + 4, 3); c.fill();
        c.fillStyle = '#c9a24a'; c.fillRect(cx + 4, cy - 4, 3, 4); c.fillRect(cx + w - 7, cy - 4, 3, 4);
        if (p.kind === 'trunk') { c.fillStyle = rgba('#000', 0.25); c.fillRect(cx + w / 3, cy - 12, 2, h + 4); c.fillRect(cx + 2 * w / 3, cy - 12, 2, h + 4); }
        c.fillStyle = shade(col, 0.15); c.fillRect(cx + w / 2 - 5, cy - 15, 10, 3);
        if (looted) { c.fillStyle = shade(col, -0.45); rr(c, cx + 1, cy - 18, w - 2, 7, 2); c.fill(); }
        if (p.mine) { c.fillStyle = '#f4e9d3'; c.fillRect(cx + 6, cy - 9, 7, 5); }
      }
      break;
    }
    case 'crate': {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 2, y + h - 2, w, 6);
      c.fillStyle = '#7a5a3a'; c.fillRect(x, y - 16, w, h + 14);
      c.fillStyle = '#9a7a52'; c.fillRect(x, y - 18, w, 6);
      c.strokeStyle = '#5a3a20'; c.lineWidth = 2; c.strokeRect(x + 2, y - 10, w - 4, h + 6); c.beginPath(); c.moveTo(x + 2, y - 10); c.lineTo(x + w - 2, y + h - 4); c.stroke();
      c.fillStyle = 'rgba(30,20,10,0.5)'; c.font = 'bold 5px sans-serif'; c.textAlign = 'center'; c.fillText('FRAGILE', x + w / 2, y - 13);
      break;
    }
    case 'sacks': {
      for (let i = 0; i < 4; i++) { E(c, x + 10 + i * 14, y + 14 - (i % 2) * 4, 9, 12, i % 2 ? '#a89070' : '#8a7458'); }
      break;
    }
    case 'vaultdoor': {
      c.fillStyle = '#24242a'; c.fillRect(x - 6, y - 60, w + 12, h + 58);
      E(c, x + w / 2, y - 18, 44, 44, '#5a5a62'); E(c, x + w / 2, y - 18, 38, 38, '#3a3a42');
      c.strokeStyle = '#c9a24a'; c.lineWidth = 3;
      const a = p.looted ? 1.2 : time * 0.1;
      for (let k = 0; k < 6; k++) { const an = a + k * Math.PI / 3; c.beginPath(); c.moveTo(x + w / 2, y - 18); c.lineTo(x + w / 2 + Math.cos(an) * 26, y - 18 + Math.sin(an) * 26); c.stroke(); }
      E(c, x + w / 2, y - 18, 8, 8, '#c9a24a');
      if (p.looted) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x - 6, y - 60, w + 12, h + 58); }
      break;
    }
    case 'cache': {
      if (p.hidden && !opts.reveal) break;
      c.strokeStyle = p.looted ? 'rgba(0,0,0,0.3)' : rgba('#ffd793', 0.5 + 0.3 * Math.sin(time * 3)); c.lineWidth = 1;
      c.strokeRect(x - 8, y - 4, 16, 8);
      break;
    }
  }
}

// ---------- vision cones & markers -----------------------------------------
export function drawCone(c, p, angle, half, range, danger) {
  c.save();
  const g = c.createRadialGradient(p.x, p.y - 4, 4, p.x, p.y - 4, range);
  const col = danger ? '220,60,50' : '255,220,150';
  g.addColorStop(0, `rgba(${col},${danger ? 0.22 : 0.12})`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(p.x, p.y - 4); c.arc(p.x, p.y - 4, range, angle - half, angle + half); c.closePath(); c.fill();
  c.restore();
}

export function drawEye(c, x, y, level, glancing) {
  // level 0..1 suspicion
  const col = level > 0.7 ? '#c0283a' : level > 0.4 ? '#e08a2a' : '#e8cf86';
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(30,20,15,0.75)'; c.beginPath(); c.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-6, 0); c.quadraticCurveTo(0, -5 * Math.max(0.25, level), 6, 0); c.quadraticCurveTo(0, 5 * Math.max(0.25, level), -6, 0); c.stroke();
  c.fillStyle = col; c.beginPath(); c.arc(0, 0, 1.8 * Math.max(0.5, level), 0, Math.PI * 2); c.fill();
  if (glancing) { c.strokeStyle = 'rgba(255,240,200,0.8)'; c.lineWidth = 0.8; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.stroke(); }
  c.restore();
}

export function drawHandMarker(c, x, y, q, time) {
  // q: 'good' | 'risky' | 'bad'
  const col = q === 'good' ? '#5fbf7a' : q === 'risky' ? '#e8b04a' : '#d04040';
  const pulse = 1 + Math.sin(time * 6) * 0.08;
  c.save(); c.translate(x, y); c.scale(pulse, pulse);
  c.fillStyle = 'rgba(25,15,10,0.8)'; c.beginPath(); c.arc(0, 0, 8, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = col;
  // tiny hand glyph
  c.fillRect(-3.5, -1, 7, 5); for (let i = 0; i < 4; i++) c.fillRect(-3.5 + i * 1.9, -5 + (i === 0 || i === 3 ? 1.5 : 0), 1.3, 5);
  c.fillRect(3.4, 0, 2.2, 1.3);
  c.restore();
}

export function drawSparkle(c, x, y, color, time, n = 1) {
  for (let i = 0; i < n; i++) {
    const tt = time * 2 + i * 1.7;
    const a = 0.5 + 0.5 * Math.sin(tt * 2);
    const ox = x + (i - (n - 1) / 2) * 7;
    c.save(); c.translate(ox, y - Math.sin(tt) * 1.5); c.globalAlpha = 0.35 + a * 0.65;
    c.fillStyle = color; c.beginPath();
    for (let k = 0; k < 8; k++) { const r = k % 2 ? 1.3 : 4; const an = k * Math.PI / 4; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
    c.fill(); c.restore();
  }
}

export { drawCharacter, drawBubble };
