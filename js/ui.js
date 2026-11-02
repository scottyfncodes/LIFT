// LIFT — shared DOM UI helpers (toasts, modals, small widgets)
import { el } from './util.js';
import { sfx } from './audio.js';

// ---------- toasts ----------
const TOAST_MAX = 3;
export function toast(text, kind = 'info', ms) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = el('div', { class: `toast toast-${kind}` }, text);
  box.prepend(t);
  while (box.children.length > TOAST_MAX) box.lastChild.remove();
  const life = ms || (kind === 'danger' ? 5200 : kind === 'tip' ? 6500 : 4200);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 400); }, life);
}
export function clearToasts() { const box = document.getElementById('toasts'); if (box) box.innerHTML = ''; }

// ---------- modal ----------
// Only one modal at a time. Returns a promise resolving to the clicked button's value.
let current = null;
export function modal({ title, body, buttons = [{ label: 'OK', value: true }], cls = '', dismiss = null, onOpen }) {
  closeModal(null, true);
  const root = document.getElementById('modal');
  return new Promise(resolve => {
    const card = el('div', { class: 'modal-card ' + cls, role: 'dialog', 'aria-modal': 'true' });
    if (title) card.append(el('h2', { class: 'modal-title' }, title));
    if (body) {
      const b = el('div', { class: 'modal-body' });
      if (typeof body === 'string') b.innerHTML = body; else b.append(body);
      card.append(b);
    }
    const row = el('div', { class: 'modal-buttons' });
    for (const btn of buttons) {
      if (!btn) continue;
      const B = el('button', { class: 'btn ' + (btn.kind || ''), disabled: btn.disabled || null, title: btn.title || null }, btn.label);
      if (btn.sub) B.append(el('small', {}, btn.sub));
      B.addEventListener('click', () => { if (btn.disabled) return; sfx.ui(); closeModal(btn.value); });
      row.append(B);
    }
    if (row.children.length) card.append(row);
    root.innerHTML = '';
    root.append(card);
    root.hidden = false;
    root.onclick = e => { if (e.target === root && dismiss !== null) { sfx.uiBack(); closeModal(dismiss); } };
    current = { resolve, dismiss };
    if (onOpen) onOpen(card);
    const first = row.querySelector('button:not([disabled])');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
  });
}
export function closeModal(value, silent) {
  const root = document.getElementById('modal');
  if (!current) { if (root) root.hidden = true; return; }
  const c = current; current = null;
  root.hidden = true; root.innerHTML = '';
  if (!silent) c.resolve(value);
  else c.resolve(c.dismiss);
}
export function modalOpen() { return !!current; }
document.addEventListener('keydown', e => {
  if (!current) return;
  if (e.key === 'Escape' && current.dismiss !== null) { e.preventDefault(); closeModal(current.dismiss); }
});

// ---------- small widgets ----------
export function meter(frac, cls = '') {
  const m = el('div', { class: 'meter ' + cls });
  const f = el('div', { class: 'meter-fill' });
  f.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
  m.append(f);
  return m;
}
export function costText(cost = {}) {
  const parts = [];
  if (cost.wealth) parts.push('£' + cost.wealth);
  if (cost.intel) parts.push(cost.intel + ' intel');
  if (cost.goodwill) parts.push(cost.goodwill + ' goodwill');
  return parts.join(' · ') || 'Free';
}
