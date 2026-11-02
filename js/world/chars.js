// LIFT — stylised character rendering (procedural, three-quarter view)
import { shade, rgba } from '../util.js';

const INK = '#2a1c14';

function ell(ctx, x, y, rx, ry, fill, stroke) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// pose: {dir, walk (phase|null), sit, lie, act, t, alert, glance, highlight}
export function drawCharacter(ctx, L, pose) {
  const dir = pose.dir || 'd';
  const side = dir === 'l' || dir === 'r';
  const t = pose.t || 0;
  ctx.save();
  if (dir === 'l') ctx.scale(-1, 1);
  const bw = L.build || 1, th = L.tall || 1;
  const walking = pose.walk != null;
  const ph = pose.walk || 0;
  const bob = walking ? Math.abs(Math.sin(ph)) * 1.6 : Math.sin(t * 1.6 + (L.skin.length)) * 0.35;
  const sit = !!pose.sit, lie = !!pose.lie;

  // shadow
  if (!sit && !lie) ell(ctx, 0, 0, 11 * bw, 4, 'rgba(20,10,5,0.28)');

  if (lie) { drawLying(ctx, L, pose); ctx.restore(); return; }

  const legH = (L.child ? 9 : 14) * th;
  const torsoH = (L.child ? 12 : 17) * th;
  const headR = L.child ? 7.5 : 8.6;
  const tw = (L.child ? 9 : 11.5) * bw; // torso half width-ish
  let baseY = sit ? -7 : 0; // feet line
  const hipY = baseY - (sit ? 6 : legH) - bob * 0.5;
  const shY = hipY - torsoH;
  const headY = shY - headR + 1.5 - bob * 0.3;
  const coat = L.coat, coatDk = shade(coat, -0.32), coatLt = shade(coat, 0.14);

  // --- legs ---
  if (!L.dress || sit) {
    const legCol = L.legs, shoe = '#1a120c';
    if (sit) {
      // thighs forward
      if (side) {
        ctx.fillStyle = legCol; rr(ctx, -3, hipY - 3, 13, 6.5, 3); ctx.fill();
        ctx.fillStyle = shade(legCol, -0.2); rr(ctx, 8, hipY - 1, 5, 8 + (L.child ? -2 : 0), 2); ctx.fill();
        ell(ctx, 12, hipY + 8, 4, 2, shoe);
      } else if (dir === 'd') {
        ctx.fillStyle = legCol; rr(ctx, -tw * 0.7, hipY - 2, tw * 1.4, 7, 3); ctx.fill();
        ctx.fillStyle = shade(legCol, -0.2);
        rr(ctx, -tw * 0.62, hipY + 3, 4.5, 6, 2); ctx.fill(); rr(ctx, tw * 0.62 - 4.5, hipY + 3, 4.5, 6, 2); ctx.fill();
        ell(ctx, -tw * 0.42, hipY + 9.5, 3.4, 1.8, shoe); ell(ctx, tw * 0.42, hipY + 9.5, 3.4, 1.8, shoe);
      }
    } else if (side) {
      const s1 = walking ? Math.sin(ph) * 6 : 0;
      for (const [s, c] of [[-s1, shade(legCol, -0.25)], [s1, legCol]]) {
        ctx.save(); ctx.translate(0, hipY); ctx.rotate(s * 0.06);
        ctx.fillStyle = c; rr(ctx, -2.8, -1, 5.6, legH + 1, 2.4); ctx.fill();
        ell(ctx, 1.6, legH, 4.2, 2.1, shoe);
        ctx.restore();
      }
    } else {
      const s1 = walking ? Math.sin(ph) * 2.2 : 0;
      ctx.fillStyle = legCol;
      rr(ctx, -tw * 0.55, hipY - 1, 5, legH + 1 - s1, 2.2); ctx.fill();
      rr(ctx, tw * 0.55 - 5, hipY - 1, 5, legH + 1 + s1, 2.2); ctx.fill();
      ell(ctx, -tw * 0.55 + 2.5, baseY - s1 - 0.5, 3.6, 2, shoe);
      ell(ctx, tw * 0.55 - 2.5, baseY + s1 - 0.5, 3.6, 2, shoe);
    }
  }
  // dress skirt (standing)
  if (L.dress && !sit) {
    const sw = walking ? Math.sin(ph) * 1.5 : 0;
    ctx.fillStyle = shade(L.legs || coat, -0.08);
    ctx.beginPath();
    ctx.moveTo(-tw * 0.8, hipY - 2); ctx.lineTo(tw * 0.8, hipY - 2);
    ctx.quadraticCurveTo(tw * 1.25 + sw, baseY - 6, tw * 1.05 + sw, baseY - 2.5);
    ctx.lineTo(-tw * 1.05 + sw, baseY - 2.5);
    ctx.quadraticCurveTo(-tw * 1.25 + sw, baseY - 6, -tw * 0.8, hipY - 2);
    ctx.fill();
    ctx.fillStyle = shade(L.legs || coat, -0.3);
    ctx.fillRect(-tw * 1.05 + sw, baseY - 4, tw * 2.1, 1.5);
    ell(ctx, -3, baseY - 1.2, 2.6, 1.4, '#1a120c'); ell(ctx, 3, baseY - 1.2, 2.6, 1.4, '#1a120c');
  }
  if (L.dress && sit) {
    ctx.fillStyle = shade(L.legs || coat, -0.08);
    if (side) { rr(ctx, -4, hipY - 4, 17, 9, 4); ctx.fill(); rr(ctx, 8, hipY, 6, 9, 3); ctx.fill(); }
    else { rr(ctx, -tw, hipY - 3, tw * 2, 12, 4); ctx.fill(); }
  }

  // cape (magician) behind torso
  if (L.cape) {
    ctx.fillStyle = shade(L.cape, -0.2);
    ctx.beginPath(); ctx.moveTo(-tw - 1, shY + 1); ctx.lineTo(tw + 1, shY + 1); ctx.lineTo(tw + 5, hipY + 6); ctx.lineTo(-tw - 5, hipY + 6); ctx.fill();
  }

  // --- torso / coat ---
  const tW = side ? tw * 1.5 : tw * 2;
  ctx.fillStyle = coat;
  ctx.beginPath();
  if (side) {
    ctx.moveTo(-tw * 0.75, shY + 2);
    ctx.quadraticCurveTo(-tw * 0.85, shY - 1, -tw * 0.2, shY - 1.5);
    ctx.lineTo(tw * 0.5, shY - 1);
    ctx.quadraticCurveTo(tw * 0.85 + (bw - 1) * 6, (shY + hipY) / 2, tw * 0.7, hipY + (L.trench ? 6 : 2));
    ctx.lineTo(-tw * 0.75, hipY + (L.trench ? 6 : 2));
  } else {
    ctx.moveTo(-tW / 2 + 2, shY - 1);
    ctx.quadraticCurveTo(-tW / 2 - 1, shY, -tW / 2, shY + 4);
    ctx.lineTo(-tW / 2 - (bw - 1) * 4, hipY + (L.trench ? 7 : 2));
    ctx.lineTo(tW / 2 + (bw - 1) * 4, hipY + (L.trench ? 7 : 2));
    ctx.lineTo(tW / 2, shY + 4);
    ctx.quadraticCurveTo(tW / 2 + 1, shY, tW / 2 - 2, shY - 1);
  }
  ctx.closePath(); ctx.fill();
  // shading
  ctx.fillStyle = rgba('#000000', 0.16);
  if (side) { ctx.fillRect(-tw * 0.75, hipY - 3, tw * 1.45, 5); }
  else { ctx.beginPath(); ctx.moveTo(tW / 2 - 3, shY + 2); ctx.lineTo(tW / 2 + (bw - 1) * 4, hipY + 2); ctx.lineTo(tW / 2 - 4, hipY + 2); ctx.fill(); }
  // front details
  if (dir === 'd') {
    if (L.dress) {
      // bodice & neckline
      ctx.fillStyle = L.trim; ctx.beginPath(); ctx.moveTo(-4, shY - 0.5); ctx.lineTo(0, shY + 5); ctx.lineTo(4, shY - 0.5); ctx.fill();
      ctx.fillStyle = shade(coat, -0.25); ctx.fillRect(-tW / 2 + 1, hipY - 2.5, tW - 2, 2.5);
      ctx.fillStyle = L.accent; ctx.fillRect(-1.5, hipY - 2.5, 3, 2.5);
    } else {
      // shirt + lapels + tie
      ctx.fillStyle = L.player && L.coat === '#16161c' ? '#f8f2e4' : '#efe6d4';
      ctx.beginPath(); ctx.moveTo(-3.5, shY - 1); ctx.lineTo(0, shY + 9); ctx.lineTo(3.5, shY - 1); ctx.fill();
      ctx.fillStyle = L.trim;
      ctx.beginPath(); ctx.moveTo(-1.2, shY + 1); ctx.lineTo(0, shY + 8); ctx.lineTo(1.2, shY + 1); ctx.fill();
      ctx.fillStyle = coatDk;
      ctx.beginPath(); ctx.moveTo(-4.5, shY - 1); ctx.lineTo(-1, shY + 10); ctx.lineTo(-6, shY + 3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(4.5, shY - 1); ctx.lineTo(1, shY + 10); ctx.lineTo(6, shY + 3); ctx.fill();
      // buttons (staff brass)
      ctx.fillStyle = L.trim === '#e0bf6e' || L.trim === '#c9a24a' ? '#f0d78a' : coatDk;
      for (let i = 0; i < 3; i++) ell(ctx, 0, shY + 11 + i * 3, 0.9, 0.9, ctx.fillStyle);
      if (L.player) { // pocket square & watch chain
        ctx.fillStyle = L.scarf || '#6e1f2b'; ctx.fillRect(tW / 2 - 6, shY + 4, 3, 2);
        ctx.strokeStyle = '#e8cf86'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-tw * 0.5, hipY - 4); ctx.quadraticCurveTo(0, hipY - 1, tw * 0.4, hipY - 5); ctx.stroke();
      }
    }
    if (L.patch) { ctx.fillStyle = shade(coat, 0.2); ctx.fillRect(-tW / 2 + 2, hipY - 7, 3.5, 3.5); }
    if (L.sash) { ctx.strokeStyle = L.sash; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-tW / 2 + 1, shY + 1); ctx.lineTo(tW / 2 - 1, hipY); ctx.stroke(); }
  } else if (side) {
    ctx.fillStyle = coatDk; ctx.fillRect(tw * 0.15, shY + 1, 1.2, hipY - shY - 2);
    if (!L.dress) { ctx.fillStyle = '#efe6d4'; ctx.beginPath(); ctx.moveTo(tw * 0.3, shY - 1); ctx.lineTo(tw * 0.62, shY - 0.6); ctx.lineTo(tw * 0.4, shY + 5); ctx.fill(); }
    if (L.sash) { ctx.strokeStyle = L.sash; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-tw * 0.6, shY + 2); ctx.lineTo(tw * 0.6, hipY - 2); ctx.stroke(); }
  } else {
    ctx.fillStyle = coatDk; ctx.fillRect(-0.6, shY + 4, 1.2, hipY - shY - 2);
  }
  // fur stole / scarf
  if (L.scarf) {
    ctx.fillStyle = L.scarf;
    if (side) { rr(ctx, -tw * 0.7, shY - 2.5, tw * 1.3, 4.5, 2.2); ctx.fill(); }
    else { rr(ctx, -tW / 2 + 1, shY - 2.5, tW - 2, 4.5, 2.2); ctx.fill(); if (dir === 'd' && !L.dress) { ctx.fillRect(tW / 2 - 7, shY, 3.2, 9); } }
  }
  if (L.jewel === 'pearls' && dir === 'd') {
    ctx.fillStyle = '#f8f4ea';
    for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + i * 0.7 / 6); ell(ctx, Math.cos(a) * 4.5, shY + Math.sin(a) * 4.5, 0.9, 0.9, '#f8f4ea'); }
  }

  // --- arms ---
  const skin = L.skin;
  const act = pose.act;
  const armCol = shade(coat, -0.06);
  const handsFront = sit && ['read', 'eat', 'drink', 'cards', 'watch', 'inspect', 'watchshow'].includes(act);
  if (side) {
    // back arm hidden, front arm swings
    let a = walking ? Math.sin(ph + Math.PI) * 0.5 : 0.08;
    if (handsFront || act === 'talk') a = act === 'talk' ? -0.9 + Math.sin(t * 5) * 0.25 : -1.15;
    if (pose.reach) a = -1.45;
    ctx.save(); ctx.translate(tw * 0.05, shY + 2); ctx.rotate(-a);
    ctx.fillStyle = armCol; rr(ctx, -2.6, -1, 5.2, torsoH * 0.82, 2.5); ctx.fill();
    ell(ctx, 0, torsoH * 0.82, 2.4, 2.4, skin);
    ctx.restore();
  } else {
    const swing = walking ? Math.sin(ph) * 2 : 0;
    const armLen = torsoH * 0.82;
    if (handsFront && dir === 'd') {
      ctx.fillStyle = armCol;
      rr(ctx, -tW / 2 - 2.5, shY + 1, 5, armLen * 0.6, 2.4); ctx.fill();
      rr(ctx, tW / 2 - 2.5, shY + 1, 5, armLen * 0.6, 2.4); ctx.fill();
      ctx.fillRect(-tW / 2, shY + armLen * 0.5, tW, 4.5);
      ell(ctx, -3, shY + armLen * 0.6, 2.4, 2.2, skin); ell(ctx, 3, shY + armLen * 0.6, 2.4, 2.2, skin);
    } else {
      ctx.fillStyle = armCol;
      rr(ctx, -tW / 2 - 3.2, shY + 1 + swing, 5, armLen, 2.4); ctx.fill();
      rr(ctx, tW / 2 - 1.8, shY + 1 - swing, 5, armLen, 2.4); ctx.fill();
      if (dir === 'd') { ell(ctx, -tW / 2 - 0.7, shY + armLen + 1 + swing, 2.4, 2.4, skin); ell(ctx, tW / 2 + 0.7, shY + armLen + 1 - swing, 2.4, 2.4, skin); }
    }
  }

  // --- head ---
  const hx = side ? tw * 0.15 : 0;
  let tilt = 0;
  if (act === 'sleep') tilt = 0.28;
  if (act === 'window' && side) tilt = -0.12;
  ctx.save(); ctx.translate(hx, headY); ctx.rotate(tilt);
  // neck
  ctx.fillStyle = shade(skin, -0.12); ctx.fillRect(-2.5, headR - 3, 5, 4);
  // ears
  if (!side) { ell(ctx, -headR + 0.5, 1, 1.8, 2.4, shade(skin, -0.06)); ell(ctx, headR - 0.5, 1, 1.8, 2.4, shade(skin, -0.06)); }
  // head shape
  ell(ctx, 0, 0, headR * (side ? 0.95 : 1), headR, skin);
  ctx.fillStyle = rgba('#000000', 0.07); ctx.beginPath(); ctx.ellipse(side ? -2 : 0, headR * 0.35, headR * 0.85, headR * 0.6, 0, 0, Math.PI); ctx.fill();
  if (side) { ell(ctx, headR * 0.92, 0.8, 1.6, 1.9, shade(skin, -0.05)); ell(ctx, -1.5, 0.5, 1.6, 2.3, shade(skin, -0.08)); }
  drawHair(ctx, L, dir, headR, side);
  // face
  if (dir !== 'u') {
    const eyeY = 0.5;
    const closed = act === 'sleep' || pose.blink;
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 1;
    const eyes = side ? [headR * 0.45] : [-3, 3];
    for (const ex of eyes) {
      if (closed) { ctx.beginPath(); ctx.moveTo(ex - 1.4, eyeY + 0.3); ctx.quadraticCurveTo(ex, eyeY + 1.2, ex + 1.4, eyeY + 0.3); ctx.stroke(); }
      else if (pose.alert) { ell(ctx, ex, eyeY, 1.5, 1.8, '#fff'); ell(ctx, ex + (side ? 0.4 : 0), eyeY, 0.9, 1.1, INK); }
      else ell(ctx, ex, eyeY, 1, 1.25, INK);
    }
    // brows
    ctx.lineWidth = 0.9; ctx.strokeStyle = shade(L.hair, -0.2);
    const browUp = pose.alert ? -1.5 : pose.susp > 0.6 ? 0.6 : 0;
    for (const ex of eyes) { ctx.beginPath(); ctx.moveTo(ex - 1.8, eyeY - 2.4 + browUp + (pose.susp > 0.6 ? (ex < 0 ? -0.6 : 0.6) : 0)); ctx.lineTo(ex + 1.8, eyeY - 2.6 + browUp); ctx.stroke(); }
    // cheeks
    if (!side) { ell(ctx, -4.6, 3.2, 1.6, 1, rgba('#d0605a', 0.25)); ell(ctx, 4.6, 3.2, 1.6, 1, rgba('#d0605a', 0.25)); }
    else ell(ctx, headR * 0.3, 3.2, 1.6, 1, rgba('#d0605a', 0.25));
    // nose & mouth
    ctx.strokeStyle = shade(skin, -0.35); ctx.lineWidth = 0.9;
    if (!side) { ctx.beginPath(); ctx.moveTo(0, 1.5); ctx.lineTo(-0.6, 3.2); ctx.lineTo(0.4, 3.4); ctx.stroke(); }
    const mx = side ? headR * 0.55 : 0, my = 5.2;
    ctx.strokeStyle = '#7a3a30';
    if (act === 'talk' || act === 'argue' || pose.alert) {
      const o = act === 'argue' || pose.alert ? 1.6 : Math.abs(Math.sin(t * 9)) * 1.3;
      ell(ctx, mx, my, 1.4, 0.4 + o * 0.6, '#5a2420');
    } else if (act === 'eat') { ell(ctx, mx, my, 1.1, 0.4 + Math.abs(Math.sin(t * 6)) * 0.7, '#5a2420'); }
    else { ctx.beginPath(); ctx.moveTo(mx - 1.5, my); ctx.quadraticCurveTo(mx, my + (pose.happy ? 1.4 : 0.6), mx + 1.5, my - (L.player ? 0.6 : 0)); ctx.stroke(); }
    drawBeard(ctx, L, side, headR);
    if (L.glasses === 'monocle') { ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(side ? headR * 0.45 : 3, 0.5, 2.3, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(side ? headR * 0.45 : 3, 2.8); ctx.lineTo(side ? headR * 0.2 : 4, 9); ctx.stroke(); }
    if (L.glasses === 'spectacles') { ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.7; for (const ex of eyes) { ctx.beginPath(); ctx.arc(ex, 0.5, 2.1, 0, Math.PI * 2); ctx.stroke(); } if (!side) { ctx.beginPath(); ctx.moveTo(-0.9, 0.3); ctx.lineTo(0.9, 0.3); ctx.stroke(); } }
  }
  drawHat(ctx, L, dir, headR, side);
  ctx.restore();

  // --- held props ---
  if (sit || pose.standAct) drawActProp(ctx, L, pose, side, shY, hipY, tw, t);
  if (L.carnation && dir === 'd') { ell(ctx, -tW / 2 + 3.5, shY + 4, 1.6, 1.6, L.coat === '#16161c' ? '#f8f2e4' : '#b0283a'); }
  ctx.restore();

  // sleep z's
  if (act === 'sleep') {
    ctx.fillStyle = 'rgba(244,233,211,0.85)'; ctx.font = 'italic 7px Georgia';
    const k = (t * 0.6) % 1;
    ctx.globalAlpha = 1 - k; ctx.fillText('z', 6 + k * 6, headY - 10 - k * 10); ctx.globalAlpha = 1;
  }
}

function drawLying(ctx, L, pose) {
  // lying in a berth, viewed from front: blanket + head on pillow
  const t = pose.t || 0;
  const breathe = Math.sin(t * 1.2) * 0.8;
  ctx.fillStyle = '#f4e9d3'; rr(ctx, -20, -14, 12, 9, 4); ctx.fill(); // pillow
  ell(ctx, -14, -10, 7.5, 7.5, L.skin);
  drawHair(ctx, L, 'd', 7.5, false, -14, -10);
  ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
  for (const ex of [-16.5, -11.5]) { ctx.beginPath(); ctx.moveTo(ex - 1.3, -9.5); ctx.quadraticCurveTo(ex, -8.6, ex + 1.3, -9.5); ctx.stroke(); }
  ctx.fillStyle = L.coat; rr(ctx, -9, -10 - breathe, 32, 12 + breathe, 5); ctx.fill();
  ctx.fillStyle = rgba('#000000', 0.15); ctx.fillRect(-9, -1, 32, 3);
  ctx.fillStyle = '#f4e9d3'; ctx.fillRect(-9, -10 - breathe, 4, 12 + breathe);
  ctx.fillStyle = 'rgba(244,233,211,0.85)'; ctx.font = 'italic 7px Georgia';
  const k = (t * 0.5) % 1; ctx.globalAlpha = 1 - k; ctx.fillText('z', -10 + k * 6, -20 - k * 10); ctx.globalAlpha = 1;
}

function drawHair(ctx, L, dir, R, side, ox = 0, oy = 0) {
  if (L.hairStyle === 'bald' && !L.hat) {
    ctx.fillStyle = L.hair; if (side) { ctx.beginPath(); ctx.ellipse(ox - R * 0.5, oy + 1, R * 0.45, R * 0.5, 0, 0, Math.PI * 2); ctx.fill(); } else { ell(ctx, ox - R + 1.5, oy, 1.8, 3, L.hair); ell(ctx, ox + R - 1.5, oy, 1.8, 3, L.hair); }
    return;
  }
  ctx.fillStyle = L.hair;
  const st = L.hairStyle;
  ctx.beginPath();
  if (dir === 'u') {
    ctx.ellipse(ox, oy - 0.5, R + 0.6, R + 0.4, 0, 0, Math.PI * 2); ctx.fill();
    if (st === 'bun') ell(ctx, ox, oy - R * 0.2, 3.6, 3.4, shade(L.hair, -0.15));
    if (st === 'bob' || st === 'waves') { ctx.fillRect(ox - R - 0.5, oy, 2 * R + 1, R * 0.7); }
    return;
  }
  if (side) {
    ctx.moveTo(ox - R - 0.6, oy + (st === 'bob' || st === 'waves' ? R * 0.75 : 1.5));
    ctx.quadraticCurveTo(ox - R - 1, oy - R - 1, ox + 1, oy - R - 0.8);
    ctx.quadraticCurveTo(ox + R + 0.8, oy - R + 0.5, ox + R * 0.9, oy - R * 0.25);
    ctx.lineTo(ox + R * 0.1, oy - R * 0.5);
    ctx.quadraticCurveTo(ox - R * 0.2, oy + 0.5, ox - R * 0.2, oy + (st === 'bob' ? R * 0.75 : 2));
    ctx.closePath(); ctx.fill();
    if (st === 'bun') ell(ctx, ox - R * 0.85, oy - R * 0.5, 3.4, 3.4, shade(L.hair, -0.1));
  } else {
    ctx.moveTo(ox - R - 0.6, oy + (st === 'bob' || st === 'waves' ? R * 0.8 : 0.5));
    ctx.quadraticCurveTo(ox - R - 1.2, oy - R - 1.5, ox, oy - R - 1);
    ctx.quadraticCurveTo(ox + R + 1.2, oy - R - 1.5, ox + R + 0.6, oy + (st === 'bob' || st === 'waves' ? R * 0.8 : 0.5));
    if (st === 'parted') { ctx.lineTo(ox + R - 1, oy - R * 0.35); ctx.quadraticCurveTo(ox + 1, oy - R * 0.75, ox - 2, oy - R * 0.3); ctx.quadraticCurveTo(ox - R * 0.6, oy - R * 0.55, ox - R + 1, oy - R * 0.1); }
    else if (st === 'bob' || st === 'waves') { ctx.lineTo(ox + R - 1.5, oy - R * 0.2); ctx.quadraticCurveTo(ox, oy - R * 0.95, ox - R + 1.5, oy - R * 0.2); }
    else { ctx.lineTo(ox + R - 1, oy - R * 0.4); ctx.quadraticCurveTo(ox, oy - R * 0.8, ox - R + 1, oy - R * 0.4); }
    ctx.closePath(); ctx.fill();
    if (st === 'bun') ell(ctx, ox, oy - R - 1.5, 3.2, 2.6, shade(L.hair, -0.1));
    if (st === 'waves') { ctx.strokeStyle = shade(L.hair, 0.2); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(ox - 3, oy - R * 0.55, 2.4, 0.2, 2.8); ctx.stroke(); }
  }
}

function drawBeard(ctx, L, side, R) {
  if (!L.beard) return;
  ctx.fillStyle = L.hair === '#dcdcdc' || L.hair === '#8a8a8a' ? L.hair : shade(L.hair, -0.05);
  const mx = side ? R * 0.55 : 0;
  if (L.beard === 'mustache') {
    ctx.beginPath(); ctx.moveTo(mx - 3.5, 4.6); ctx.quadraticCurveTo(mx, 2.6, mx + 3.5, 4.6); ctx.quadraticCurveTo(mx, 4, mx - 3.5, 4.6); ctx.fill();
    ctx.beginPath(); ctx.ellipse(mx - 2, 4, 2, 1, -0.2, 0, Math.PI * 2); ctx.ellipse(mx + 2, 4, 2, 1, 0.2, 0, Math.PI * 2); ctx.fill();
  } else if (L.beard === 'pencil') {
    ctx.fillRect(mx - 2.4, 3.9, 4.8, 0.9);
  } else if (L.beard === 'full') {
    ctx.beginPath(); ctx.moveTo(mx - R + 1.5, 1.5); ctx.quadraticCurveTo(mx - R + 1, 8, mx, 9.5); ctx.quadraticCurveTo(mx + R - 1, 8, mx + R - 1.5, 1.5); ctx.lineTo(mx + 3, 5.5); ctx.lineTo(mx - 3, 5.5); ctx.fill();
    ell(ctx, mx, 5.3, 1.3, 0.5, '#5a2420');
  } else if (L.beard === 'mutton') {
    if (!side) { ell(ctx, -R + 1.8, 3, 2.2, 4, ctx.fillStyle); ell(ctx, R - 1.8, 3, 2.2, 4, ctx.fillStyle); }
    else ell(ctx, -1, 3, 2.6, 4, ctx.fillStyle);
    ctx.beginPath(); ctx.ellipse(mx - 2, 4.1, 2.2, 1, -0.2, 0, Math.PI * 2); ctx.ellipse(mx + 2, 4.1, 2.2, 1, 0.2, 0, Math.PI * 2); ctx.fill();
  } else if (L.beard === 'goatee') {
    ctx.beginPath(); ctx.moveTo(mx - 1.6, 6); ctx.lineTo(mx + 1.6, 6); ctx.lineTo(mx, 10); ctx.fill();
    ctx.fillRect(mx - 2.6, 3.9, 5.2, 0.9);
  } else if (L.beard === 'stubble') {
    ctx.fillStyle = rgba('#2a1c14', 0.25); ctx.beginPath(); ctx.ellipse(mx, 5.4, R * 0.6, 3, 0, 0, Math.PI); ctx.fill();
  }
}

function drawHat(ctx, L, dir, R, side) {
  const h = L.hat; if (!h) return;
  const dk = '#16141a';
  const front = !side;
  ctx.save();
  if (h === 'top' || h === 'homburg' || h === 'bowler' || h === 'fedora') {
    const col = h === 'fedora' ? (L.trench ? '#5a4a3a' : '#4a3f35') : h === 'homburg' ? '#3a3530' : dk;
    // brim
    ctx.fillStyle = shade(col, -0.1);
    ell(ctx, side ? 1 : 0, -R + 2.2, R + (h === 'fedora' ? 4.5 : 3.5), 2.6, ctx.fillStyle);
    ctx.fillStyle = col;
    if (h === 'top') { rr(ctx, -R * 0.72 + (side ? 1 : 0), -R - 12, R * 1.44, 14, 1.5); ctx.fill(); ctx.fillStyle = L.player ? '#6e1f2b' : '#2a2026'; ctx.fillRect(-R * 0.72 + (side ? 1 : 0), -R - 1.2, R * 1.44, 2.4); ell(ctx, side ? 1 : 0, -R - 12, R * 0.72, 1.6, shade(col, 0.15)); }
    else if (h === 'bowler') { ctx.beginPath(); ctx.ellipse(side ? 1 : 0, -R + 1, R * 0.82, R * 0.95, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#2a2026'; ctx.fillRect(-R * 0.82 + (side ? 1 : 0), -R, R * 1.64, 1.6); }
    else { ctx.beginPath(); ctx.moveTo(-R * 0.8 + (side ? 1 : 0), -R + 2); ctx.quadraticCurveTo(-R * 0.7, -R - 7, 0, -R - 6); ctx.quadraticCurveTo(R * 0.7, -R - 7, R * 0.8 + (side ? 1 : 0), -R + 2); ctx.fill(); ctx.fillStyle = h === 'fedora' ? '#2a2026' : '#6e1f2b'; ctx.fillRect(-R * 0.8 + (side ? 1 : 0), -R, R * 1.6, 1.8); if (front) { ctx.fillStyle = shade(col, -0.3); ctx.fillRect(-0.6, -R - 6, 1.2, 4); } }
  } else if (h === 'flatcap') {
    ctx.fillStyle = L.coat === '#6b5a44' ? '#4a3f35' : shade(L.coat, -0.15);
    ctx.beginPath(); ctx.ellipse(0, -R + 1, R + 0.6, R * 0.58, 0, Math.PI, 0); ctx.fill();
    ctx.beginPath(); if (front) ctx.ellipse(0, -R + 2.2, R * 0.85, 2.2, 0, 0, Math.PI); else ctx.ellipse(R * 0.8, -R + 2, 4.5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  } else if (h === 'cloche' || h === 'feather' || h === 'beret') {
    const col = h === 'beret' ? '#6e1f2b' : shade(L.coat, -0.1);
    ctx.fillStyle = col;
    if (h === 'beret') { ell(ctx, side ? -1 : 0, -R + 1, R + 1.5, R * 0.45, col); ell(ctx, side ? -1 : 0, -R - 2.6, 1, 1, col); }
    else { ctx.beginPath(); ctx.ellipse(0, -R * 0.35, R + 1.2, R * 0.92, 0, Math.PI * 1.02, -0.02); ctx.fill(); ctx.fillStyle = L.trim; ctx.fillRect(-R - 1, -R * 0.45, 2 * R + 2, 1.6); }
    if (h === 'feather') { ctx.strokeStyle = '#f4e9d3'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(R * 0.4, -R * 0.6); ctx.quadraticCurveTo(R * 1.4, -R * 1.6, R * 0.3, -R * 2.1); ctx.stroke(); }
  } else if (h === 'peaked' || h === 'pillbox') {
    const col = L.coat;
    ctx.fillStyle = col;
    if (h === 'peaked') { rr(ctx, -R * 0.95, -R - 4.5, R * 1.9, 6, 2); ctx.fill(); ctx.fillStyle = '#16141a'; if (front) ell(ctx, 0, -R + 1.8, R * 0.8, 2.2, '#16141a'); else ell(ctx, R * 0.75, -R + 1.5, 4.5, 1.6, '#16141a'); ctx.fillStyle = L.trim; ctx.fillRect(-R * 0.95, -R + 0.2, R * 1.9, 1.1); if (front) ell(ctx, 0, -R - 1.8, 1.5, 1.4, L.trim); }
    else { rr(ctx, -R * 0.6, -R - 4.5, R * 1.2, 5.5, 1.5); ctx.fill(); ctx.fillStyle = L.trim; ctx.fillRect(-R * 0.6, -R - 0.6, R * 1.2, 1.2); }
  } else if (h === 'headscarf') {
    ctx.fillStyle = L.trim === '#d9c8a0' ? '#8a3a3a' : '#5a6a8a';
    ctx.beginPath(); ctx.ellipse(0, -R * 0.25, R + 1, R * 0.95, 0, Math.PI * 1.05, -0.05); ctx.fill();
  } else if (h === 'tiara') {
    ctx.fillStyle = '#e8cf86';
    ctx.beginPath(); ctx.moveTo(-5, -R + 1); ctx.lineTo(-3, -R - 3); ctx.lineTo(0, -R - 5); ctx.lineTo(3, -R - 3); ctx.lineTo(5, -R + 1); ctx.closePath(); ctx.fill();
    ell(ctx, 0, -R - 2.5, 1.2, 1.2, '#8fb8e8');
  }
  ctx.restore();
}

function drawActProp(ctx, L, pose, side, shY, hipY, tw, t) {
  const act = pose.act;
  const hx = side ? tw * 0.9 : 0, hy = shY + 7;
  if (act === 'read') {
    ctx.save(); ctx.translate(side ? hx + 1 : 0, hy - 3);
    const flip = (Math.sin(t * 0.35) > 0.985);
    ctx.fillStyle = '#efe4c8'; ctx.strokeStyle = '#a89878'; ctx.lineWidth = 0.6;
    if (side) { ctx.fillRect(-1, -8, 3, 14); ctx.fillStyle = '#d8ccae'; ctx.fillRect(1.5, -8, 1.5, 14); }
    else { ctx.fillRect(-9, -6, 18, 12); ctx.strokeRect(-9, -6, 18, 12); ctx.fillStyle = '#8a7a62'; for (let i = 0; i < 4; i++) ctx.fillRect(-7, -4 + i * 2.6, 6, 0.8); for (let i = 0; i < 4; i++) ctx.fillRect(1, -4 + i * 2.6, 6, 0.8); ctx.fillStyle = '#2a1c14'; ctx.fillRect(-7, -5, 14, 1.2); if (flip) { ctx.fillStyle = '#fff'; ctx.fillRect(0, -6, 9, 12); } }
    ctx.restore();
  } else if (act === 'drink') {
    const lift = Math.max(0, Math.sin(t * 0.8)) * 6;
    ctx.save(); ctx.translate(side ? hx + 1 : 4, hy - lift);
    ctx.fillStyle = 'rgba(220,235,240,0.7)'; ctx.beginPath(); ctx.moveTo(-2.4, -5); ctx.lineTo(2.4, -5); ctx.lineTo(0.5, -1); ctx.lineTo(0.5, 2); ctx.lineTo(-0.5, 2); ctx.lineTo(-0.5, -1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.moveTo(-1.8, -4.4); ctx.lineTo(1.8, -4.4); ctx.lineTo(0.3, -1.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  } else if (act === 'eat') {
    const lift = Math.max(0, Math.sin(t * 2.4)) * 5;
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(side ? hx : 3, hy - 2 - lift, 0.9, 6);
  } else if (act === 'cards') {
    ctx.save(); ctx.translate(side ? hx : 0, hy - 2);
    for (let i = -2; i <= 2; i++) { ctx.save(); ctx.rotate(i * 0.22); ctx.fillStyle = '#f8f4ea'; ctx.fillRect(-1.5, -7, 3.4, 5); ctx.fillStyle = i % 2 ? '#a02030' : '#202020'; ctx.fillRect(-0.6, -6, 1, 1); ctx.restore(); }
    ctx.restore();
  } else if (act === 'watch') {
    ctx.save(); ctx.translate(side ? hx + 1 : 2, hy - 2);
    ell(ctx, 0, 0, 2.6, 2.6, '#e8cf86'); ell(ctx, 0, 0, 1.8, 1.8, '#f8f4ea');
    ctx.strokeStyle = '#e8cf86'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, 2.6); ctx.quadraticCurveTo(-3, 7, -6, 6); ctx.stroke();
    if (Math.sin(t * 6) > 0.6) { ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.fillRect(1, -3, 1, 1); }
    ctx.restore();
  } else if (act === 'inspect') {
    ctx.fillStyle = '#6b3a20'; rr(ctx, (side ? hx : 0) - 5, hy - 2, 10, 7, 1.5); ctx.fill(); ctx.fillStyle = '#c9a24a'; ctx.fillRect((side ? hx : 0) - 1, hy - 3, 2, 1.5);
  } else if (act === 'watchshow' || act === 'argue') {
    // hands raised
  }
}

// bubble above head
export function drawBubble(ctx, x, y, text, alpha = 1, kind = 'say') {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = '600 9px "Josefin Sans", sans-serif';
  const w = Math.min(130, ctx.measureText(text).width + 12);
  const bx = x - w / 2, by = y - 18;
  ctx.fillStyle = kind === 'alarm' ? '#f8e0d8' : '#f8f2e4';
  ctx.strokeStyle = kind === 'alarm' ? '#a0283a' : '#6b5a44'; ctx.lineWidth = 1;
  rr(ctx, bx, by, w, 15, 5); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 3, by + 15); ctx.lineTo(x, by + 20); ctx.lineTo(x + 3, by + 15); ctx.fillStyle = ctx.fillStyle; ctx.fill();
  ctx.fillStyle = kind === 'alarm' ? '#7a1020' : '#2a1c14';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, by + 8, w - 8);
  ctx.restore();
}
