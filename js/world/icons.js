// LIFT — procedural item illustrations
import { RARITY } from '../data/content.js';
import { shade, makeCanvas } from '../util.js';

function metal(item) {
  const m = (item.material || '').toLowerCase();
  if (item.crest || m.includes('18-carat') || m.startsWith('gold') || m.includes('gold &')) return '#e2b94e';
  if (m.includes('rose')) return '#e3a07e';
  if (m.includes('platinum')) return '#e2e6ee';
  if (m.includes('silver')) return '#c9ced6';
  if (m.includes('pewter')) return '#9aa0a6';
  if (m.includes('nickel')) return '#b8bcc0';
  if (m.includes('gunmetal')) return '#5d636b';
  if (m.includes('tin')) return '#7a9a8a';
  if (m.includes('tortoise')) return '#8a5a2a';
  if (item.rarity === 'legendary' || item.rarity === 'exceptional') return '#e2b94e';
  return '#c9a24a';
}
function gem(item) {
  const m = (item.material || '') + item.name;
  if (/sapphire|Blue|Vane/.test(m)) return '#3b6fc4';
  if (/emerald/.test(m)) return '#2f9a6a';
  if (/ruby|garnet/.test(m)) return '#b02840';
  if (/diamond|Duchess/.test(m)) return '#dff4ff';
  if (/onyx|jet/.test(m)) return '#1a1a20';
  return ({ common: '#a05a3a', uncommon: '#5a8a6a', rare: '#3b6fc4', exceptional: '#8a3fb0', legendary: '#dff4ff' })[item.rarity];
}
const E = (c, x, y, rx, ry, f) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = f; c.fill(); };

export function drawItemIcon(c, item, S) {
  c.save();
  c.translate(S / 2, S / 2);
  const k = S / 64; c.scale(k, k);
  const M = metal(item), Md = shade(M, -0.35), Ml = shade(M, 0.45), G = gem(item);
  c.lineJoin = 'round'; c.lineCap = 'round';
  // soft drop shadow
  E(c, 2, 22, 20, 5, 'rgba(30,15,5,0.18)');
  switch (item.cat) {
    case 'watch': case 'wristwatch': {
      if (item.cat === 'wristwatch') { c.fillStyle = '#5a3520'; c.fillRect(-7, -28, 14, 56); c.fillStyle = '#3a2114'; c.fillRect(-7, -28, 14, 3); c.fillRect(-7, 25, 14, 3); }
      else { c.strokeStyle = M; c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, -24); for (let i = 0; i < 6; i++) c.arc(8 + i * 3.4, -26 - Math.sin(i) * 2, 1.8, 0, Math.PI * 2); c.stroke(); E(c, 0, -22, 4, 3.5, M); }
      E(c, 0, 2, 19, 19, Md); E(c, 0, 1, 17.5, 17.5, M); E(c, 0, 1, 14.5, 14.5, '#f6f0e0');
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 1;
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 12, 1 + Math.sin(a) * 12); c.lineTo(Math.cos(a) * (i % 3 ? 13 : 10.5), 1 + Math.sin(a) * (i % 3 ? 13 : 10.5)); c.stroke(); }
      c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 1); c.lineTo(5, -5); c.stroke(); c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 1); c.lineTo(-2, 10); c.stroke();
      E(c, 0, 1, 1.6, 1.6, M);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-5, -5, 7, 4, -0.6, 0, Math.PI * 2); c.fill();
      if (item.rarity === 'legendary') { c.strokeStyle = G; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 1, 16, 0, Math.PI * 2); c.stroke(); }
      break;
    }
    case 'ring': {
      c.lineWidth = 6; c.strokeStyle = Md; c.beginPath(); c.ellipse(0, 8, 15, 12, 0, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 4; c.strokeStyle = M; c.beginPath(); c.ellipse(0, 7, 15, 12, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = Ml; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 6, 14, 11, 0, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
      if (item.crest || /Signet|Seal/.test(item.name)) { E(c, 0, -6, 10, 7, Md); E(c, 0, -7, 9, 6, M); c.strokeStyle = Md; c.lineWidth = 1; c.beginPath(); c.moveTo(-4, -9); c.lineTo(0, -4); c.lineTo(4, -9); c.moveTo(0, -11); c.lineTo(0, -4); c.stroke(); }
      else { c.fillStyle = M; c.beginPath(); c.moveTo(-7, -2); c.lineTo(-5, -10); c.lineTo(5, -10); c.lineTo(7, -2); c.fill(); c.fillStyle = G; c.beginPath(); c.moveTo(-6, -11); c.lineTo(0, -19); c.lineTo(6, -11); c.lineTo(0, -5); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.moveTo(-3, -12); c.lineTo(0, -16); c.lineTo(1, -12); c.fill(); }
      break;
    }
    case 'necklace': case 'bracelet': {
      const pearls = /Pearl/.test(item.name);
      const n = item.cat === 'necklace' ? 15 : 11; const rx = item.cat === 'necklace' ? 22 : 16, ry = item.cat === 'necklace' ? 20 : 12;
      for (let i = 0; i < n; i++) { const a = Math.PI * 0.05 + (i / (n - 1)) * Math.PI * (item.cat === 'necklace' ? 0.9 : 2); const x = Math.cos(a) * rx, y = Math.sin(a) * ry - (item.cat === 'necklace' ? 8 : 0); E(c, x, y + 1, 3.2, 3.2, pearls ? '#cfc8b8' : Md); E(c, x, y, 2.8, 2.8, pearls ? '#f8f4ea' : M); if (!pearls && i % 3 === 1 && item.rarity !== 'common') E(c, x, y, 1.6, 1.6, G); }
      if (item.cat === 'necklace') { c.fillStyle = M; c.beginPath(); c.moveTo(-6, 11); c.lineTo(6, 11); c.lineTo(0, 24); c.closePath(); c.fill(); E(c, 0, 15, 4, 4, G); E(c, -1, 14, 1.2, 1.2, 'rgba(255,255,255,0.7)'); }
      break;
    }
    case 'coin': {
      E(c, 0, 3, 20, 20, Md); E(c, 0, 1, 19, 19, M); E(c, 0, 1, 15, 15, shade(M, -0.12));
      c.fillStyle = Md; c.beginPath(); c.ellipse(1, 1, 7, 9, 0, 0, Math.PI * 2); c.fill(); E(c, -2, -3, 4, 4.5, Md);
      c.fillStyle = M; c.beginPath(); c.ellipse(1, 2, 5.5, 7.5, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = Md; c.lineWidth = 0.8; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 17, 1 + Math.sin(a) * 17); c.lineTo(Math.cos(a) * 18.5, 1 + Math.sin(a) * 18.5); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(-7, -7, 6, 3, -0.7, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'cigcase': case 'lighter': {
      if (item.cat === 'cigcase') {
        c.fillStyle = Md; c.fillRect(-18, -22, 36, 46); c.fillStyle = M; c.fillRect(-17, -23, 34, 44);
        c.strokeStyle = Md; c.lineWidth = 0.7; for (let i = -20; i < 20; i += 3) { c.beginPath(); c.moveTo(-15, i); c.lineTo(15, i + 3); c.stroke(); }
        c.fillStyle = shade(M, 0.2); c.fillRect(-8, -6, 16, 10); c.fillStyle = Md; c.font = 'italic bold 8px Georgia'; c.textAlign = 'center'; c.fillText((item.owner || 'X')[0], 0, 2);
      } else {
        c.fillStyle = Md; c.fillRect(-11, -10, 22, 32); c.fillStyle = M; c.fillRect(-11, -11, 22, 31);
        c.fillStyle = Md; c.fillRect(-11, -4, 22, 2);
        c.fillStyle = shade(M, 0.15); c.fillRect(-9, -22, 14, 10); c.fillStyle = '#3a2a1a'; for (let i = 0; i < 4; i++) E(c, -6 + i * 3.4, -17, 1, 1, '#3a2a1a');
        c.fillStyle = '#f2b45a'; c.beginPath(); c.moveTo(-2, -24); c.quadraticCurveTo(-5, -32, 0, -38); c.quadraticCurveTo(4, -31, 2, -24); c.fill();
      }
      break;
    }
    case 'compass': {
      E(c, 0, 3, 20, 20, Md); E(c, 0, 1, 19, 19, M); E(c, 0, 1, 15, 15, '#efe6cf'); E(c, 0, -19, 4, 3, M);
      c.fillStyle = '#b02840'; c.beginPath(); c.moveTo(0, -12); c.lineTo(3.5, 1); c.lineTo(-3.5, 1); c.fill();
      c.fillStyle = '#2a2a30'; c.beginPath(); c.moveTo(0, 14); c.lineTo(3.5, 1); c.lineTo(-3.5, 1); c.fill();
      E(c, 0, 1, 1.6, 1.6, M);
      c.fillStyle = '#3a2a1a'; c.font = 'bold 6px Georgia'; c.textAlign = 'center'; c.fillText('N', 0, -5 - 8); 
      break;
    }
    case 'book': {
      const col = item.unique ? '#2f4a3a' : ['#6e1f2b', '#1f3a5e', '#2f5e4a', '#5a3520'][item.name.length % 4];
      c.fillStyle = shade(col, -0.3); c.fillRect(-16, -22, 34, 46); c.fillStyle = '#efe4c8'; c.fillRect(-13, -20, 30, 42); c.fillStyle = col; c.fillRect(-18, -24, 32, 46);
      c.fillStyle = '#c9a24a'; c.fillRect(-18, -24, 4, 46); c.strokeStyle = '#c9a24a'; c.lineWidth = 1; c.strokeRect(-10, -18, 20, 34); c.fillRect(-6, -8, 12, 2); c.fillRect(-4, -3, 8, 1.4);
      break;
    }
    case 'letter': case 'document': {
      c.save(); c.rotate(-0.08);
      c.fillStyle = '#d8ccae'; c.fillRect(-17, -21, 36, 46); c.fillStyle = item.cat === 'letter' ? '#f2e8d0' : '#f6f2e6'; c.fillRect(-18, -23, 36, 46);
      c.fillStyle = '#8a7a62'; for (let i = 0; i < 8; i++) c.fillRect(-13, -15 + i * 4.4, i === 7 ? 14 : 26 - (i % 3) * 3, 1.1);
      if (item.cat === 'letter') { E(c, 8, 16, 6, 6, '#a02030'); E(c, 8, 16, 3.5, 3.5, '#c03040'); }
      else { c.strokeStyle = '#a02030'; c.lineWidth = 1.5; c.strokeRect(-14, -20, 24, 7); c.fillStyle = '#a02030'; c.font = 'bold 5px sans-serif'; c.fillText(item.consortium ? 'MERIDIAN' : 'PRIVATE', -12, -15); }
      c.restore();
      break;
    }
    case 'art': {
      c.fillStyle = shade('#c9a24a', -0.3); c.fillRect(-21, -19, 44, 42); c.fillStyle = '#c9a24a'; c.fillRect(-22, -21, 44, 42);
      const g = c.createLinearGradient(0, -16, 0, 16); g.addColorStop(0, '#9ab4c4'); g.addColorStop(1, '#e8d0a0'); c.fillStyle = g; c.fillRect(-17, -16, 34, 32);
      E(c, 2, -2, 6, 7, '#e8c09a'); c.fillStyle = '#4a3020'; c.beginPath(); c.ellipse(2, -6, 7, 5, 0, Math.PI, 0); c.fill(); c.fillStyle = '#6e1f2b'; c.fillRect(-6, 5, 16, 11);
      break;
    }
    case 'antique': {
      if (/Clock/.test(item.name)) { c.fillStyle = M; c.fillRect(-14, -22, 28, 44); c.fillStyle = Md; c.fillRect(-16, 18, 32, 5); E(c, 0, -6, 10, 10, '#f6f0e0'); c.strokeStyle = '#3a2a1a'; c.beginPath(); c.moveTo(0, -6); c.lineTo(4, -10); c.moveTo(0, -6); c.lineTo(0, 0); c.stroke(); }
      else if (/Netsuke/.test(item.name)) { E(c, 0, 4, 16, 18, '#4a9a6a'); E(c, -4, -2, 6, 7, '#5ab07a'); E(c, 6, 10, 4, 4, '#3a7a5a'); }
      else if (/Orrery/.test(item.name)) { c.strokeStyle = M; c.lineWidth = 1.4; c.beginPath(); c.ellipse(0, -2, 22, 8, 0, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.ellipse(0, -2, 13, 5, 0, 0, Math.PI * 2); c.stroke(); E(c, 0, -2, 5, 5, '#f2b45a'); E(c, 21, -4, 3, 3, '#5a8ac4'); E(c, -12, 1, 2.4, 2.4, '#c45a3a'); c.fillStyle = M; c.fillRect(-2, 4, 4, 16); c.fillRect(-10, 18, 20, 4); }
      else { c.fillStyle = Md; c.fillRect(-18, -6, 36, 22); c.fillStyle = M; c.fillRect(-18, -10, 36, 22); c.fillStyle = shade(M, 0.2); c.fillRect(-18, -12, 36, 5); E(c, 0, 2, 6, 4, G); }
      break;
    }
    case 'heirloom': {
      if (/Locket/.test(item.name)) { c.strokeStyle = '#c9a24a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-12, -26); c.quadraticCurveTo(0, -10, 12, -26); c.stroke(); E(c, 0, 4, 14, 17, '#8a6a24'); E(c, 0, 3, 13, 16, '#c9a24a'); c.strokeStyle = '#8a6a24'; c.beginPath(); c.ellipse(0, 3, 9, 12, 0, 0, Math.PI * 2); c.stroke(); }
      else if (/Spoon/.test(item.name)) { c.fillStyle = '#c9ced6'; c.save(); c.rotate(0.5); c.fillRect(-2.5, -6, 5, 30); E(c, 0, -14, 7, 10, '#c9ced6'); E(c, 0, -14, 5, 8, '#e2e6ee'); c.restore(); }
      else if (/Medal/.test(item.name)) { c.fillStyle = '#6e1f2b'; c.fillRect(-7, -26, 14, 18); c.fillStyle = '#2f5c8f'; c.fillRect(-2, -26, 4, 18); E(c, 0, 4, 13, 13, '#8a6a24'); E(c, 0, 3, 12, 12, '#c9a24a'); c.fillStyle = '#8a6a24'; c.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 0.8; c.lineTo(Math.cos(a) * 7, 3 + Math.sin(a) * 7); } c.fill(); }
      else { E(c, 0, 2, 16, 12, '#8a6a24'); E(c, 0, 1, 15, 11, '#c9a24a'); E(c, 0, 1, 6, 6, '#a05a3a'); }
      break;
    }
    case 'wallet': {
      c.fillStyle = '#3a2114'; c.beginPath(); c.roundRect ? c.roundRect(-22, -14, 46, 32, 5) : c.rect(-22, -14, 46, 32); c.fill();
      c.fillStyle = '#e8dcc0'; c.fillRect(-16, -20, 30, 10); c.fillStyle = '#a8c0a0'; c.fillRect(-12, -22, 30, 10);
      c.fillStyle = '#5a3520'; c.beginPath(); c.roundRect ? c.roundRect(-23, -12, 46, 30, 5) : c.rect(-23, -12, 46, 30); c.fill();
      c.fillStyle = '#7d4d2e'; c.fillRect(-23, -12, 46, 7);
      c.strokeStyle = '#c9a24a'; c.setLineDash([2, 2]); c.lineWidth = 1; c.strokeRect(-20, -9, 40, 24); c.setLineDash([]);
      break;
    }
    case 'accessory': default: {
      if (/Pen/.test(item.name)) { c.save(); c.rotate(-0.7); c.fillStyle = '#1a1a20'; c.fillRect(-4, -24, 8, 40); c.fillStyle = M; c.fillRect(-4, -8, 8, 2); c.fillRect(3, -22, 1.5, 14); c.fillStyle = M; c.beginPath(); c.moveTo(-3, 16); c.lineTo(3, 16); c.lineTo(0, 26); c.fill(); c.restore(); }
      else if (/Opera/.test(item.name)) { E(c, -9, 4, 9, 9, Md); E(c, 9, 4, 9, 9, Md); E(c, -9, 4, 6, 6, '#3a4a5a'); E(c, 9, 4, 6, 6, '#3a4a5a'); c.fillStyle = M; c.fillRect(-4, -4, 8, 6); c.fillRect(-1, -20, 2, 16); }
      else if (/Compact/.test(item.name)) { E(c, 0, 3, 18, 18, Md); E(c, 0, 1, 18, 18, M); E(c, 0, 1, 12, 12, shade(M, 0.2)); E(c, 0, 1, 5, 5, G); }
      else if (/Cufflinks/.test(item.name)) { E(c, -9, 0, 8, 8, Md); E(c, 9, 4, 8, 8, Md); E(c, -9, -1, 7, 7, M); E(c, 9, 3, 7, 7, M); E(c, -9, -1, 3, 3, G); E(c, 9, 3, 3, 3, G); }
      else if (/Dragonfly/.test(item.name)) { c.fillStyle = 'rgba(120,200,190,0.75)'; c.beginPath(); c.ellipse(-11, -6, 13, 5, -0.3, 0, Math.PI * 2); c.ellipse(11, -6, 13, 5, 0.3, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(150,120,210,0.7)'; c.beginPath(); c.ellipse(-9, 4, 10, 4, 0.3, 0, Math.PI * 2); c.ellipse(9, 4, 10, 4, -0.3, 0, Math.PI * 2); c.fill(); c.fillStyle = '#c9a24a'; c.fillRect(-2, -14, 4, 34); E(c, 0, -15, 3.5, 3.5, '#2f9a6a'); }
      else { c.fillStyle = Md; c.fillRect(-4, -24, 8, 40); c.fillStyle = M; c.fillRect(-3, -24, 6, 38); E(c, 0, -22, 6, 6, G); }
    }
  }
  c.restore();
}

const cache = new Map();
export function iconURL(item, size = 96) {
  const key = item.id + ':' + size;
  if (cache.has(key)) return cache.get(key);
  const cv = makeCanvas(size, size);
  const c = cv.getContext('2d');
  drawItemIcon(c, item, size);
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}
export function rarityColor(r) { return RARITY[r].color; }
