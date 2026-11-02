// LIFT — title, hideout and settlement screens
import { el, money, cap } from './util.js';
import {
  TRAINS, TRAIN_ORDER, UPGRADES, BRANCHES, OUTFITS, CAUSES, SETS, RARITY, RARITY_ORDER, CATEGORIES, REPUTATIONS,
} from './data/content.js';
import { fencePrice, donateGoodwill, returnGoodwill, leakGoodwill, setProgress, reputation, causeMilestonesReached, carryCapacity } from './economy.js';
import { iconURL } from './world/icons.js';
import { modal, toast, meter, costText } from './ui.js';
import { sfx, initAudio } from './audio.js';
import { showHelp } from './run.js';

// ======================= TITLE =======================
export function renderTitle(root, G, cb) {
  root.innerHTML = '';
  const S = G.S;
  const card = el('div', { class: 'title-card' },
    el('h1', { class: 'logo' }, 'LIFT'),
    el('p', { class: 'tagline' }, 'Steal. Collect. Redistribute. Repeat.'),
    el('div', { class: 'subtag' }, 'A gentleman thief on the rails · 1931'),
    el('div', { class: 'deco-rule' }),
  );
  const btns = el('div', { class: 'title-buttons' });
  const B = (label, kind, fn, sub) => { const b = el('button', { class: 'btn ' + kind }, label, sub ? el('small', {}, sub) : null); b.addEventListener('click', () => { initAudio(); sfx.ui(); fn(); }); btns.append(b); return b; };
  if (G.hasSave) {
    const rep = reputation(S);
    const sub = S.pending ? `Settle your haul from ${S.pending.trainName}`
      : S.run && S.run.trainId && TRAINS[S.run.trainId] ? `Resume your journey aboard ${TRAINS[S.run.trainId].name}`
        : `${money(S.wealth)} · ${S.stats.runs} journey${S.stats.runs === 1 ? '' : 's'} · ${rep.name}`;
    B('Continue', 'primary', cb.onContinue, sub);
    B('New game', '', () => {
      modal({ title: 'Start over?', body: '<p>Your hideout, collection and reputation will be erased.</p>', dismiss: false, buttons: [{ label: 'Keep my save', value: false }, { label: 'Start fresh', value: true, kind: 'danger' }] })
        .then(v => { if (v) cb.onNew(); });
    });
  } else {
    B('Begin', 'primary', cb.onNew, 'Your first train leaves Millbrook shortly');
  }
  B('How to play', '', () => showHelp());
  const set = el('div', { class: 'row', style: { justifyContent: 'center' } });
  const tog = (label, key) => {
    const b = el('button', { class: 'btn small' + (S.settings[key] ? ' sel' : '') }, `${label}: ${S.settings[key] ? 'On' : 'Off'}`);
    b.addEventListener('click', () => { S.settings[key] = !S.settings[key]; b.textContent = `${label}: ${S.settings[key] ? 'On' : 'Off'}`; b.classList.toggle('sel', S.settings[key]); initAudio(); cb.onSettings(); sfx.ui(); });
    set.append(b);
  };
  tog('Sound', 'sound'); tog('Music', 'music');
  btns.append(set);
  card.append(btns, el('div', { class: 'title-foot' }, 'Works with keyboard, mouse or touch · progress saves automatically'));
  const strip = el('div', { class: 'train-strip' }, el('div', { class: 'rail' }),
    el('div', { class: 'tr' }, el('div', { class: 'car' }), el('div', { class: 'car' }), el('div', { class: 'car' }), el('div', { class: 'car' }), el('div', { class: 'car loco' })));
  root.append(el('div', { class: 'scr title-scr' }, card, strip));
}

// ======================= HIDEOUT =======================
let hideTab = 'depart';
export function renderHideout(root, G, cb) {
  const S = G.S;
  if (cb.fresh) hideTab = 'depart';
  checkUnlocks(S, false);
  const scr = el('div', { class: 'scr' });
  const wrap = el('div', { class: 'wrap' });
  scr.append(wrap);
  root.innerHTML = '';
  root.append(scr);
  const rerender = () => { const y = scr.scrollTop; renderHideout(root, G, { ...cb, fresh: false }); root.firstChild.scrollTop = y; };
  const rep = reputation(S);

  const menuB = el('button', { class: 'btn small ghost' }, 'Menu');
  menuB.addEventListener('click', () => { sfx.ui(); cb.onTitle(); });
  wrap.append(el('div', { class: 'hdr' },
    el('div', {}, el('h1', {}, 'The Hideout'), el('div', { class: 'rep' }, rep.name)),
    el('div', { class: 'spacer' }),
    el('div', { class: 'purse' },
      el('span', { class: 'coin-pill' }, 'Wealth ', el('b', {}, money(S.wealth))),
      el('span', { class: 'coin-pill' }, 'Goodwill ', el('b', {}, String(Math.floor(S.goodwill)))),
      el('span', { class: 'coin-pill' }, 'Intel ', el('b', {}, String(Math.floor(S.intel)))),
    ),
    menuB,
  ));

  const TABS = [['depart', 'Depart'], ['workshop', 'Workshop'], ['wardrobe', 'Wardrobe'], ['causes', 'Causes'], ['collection', 'Collection'], ['ledger', 'Ledger']];
  const tabs = el('div', { class: 'tabs' });
  for (const [k, label] of TABS) {
    const b = el('button', { class: 'btn small' + (hideTab === k ? ' sel' : '') }, label);
    b.addEventListener('click', () => { sfx.ui(); hideTab = k; rerender(); });
    tabs.append(b);
  }
  wrap.append(tabs);
  const body = el('div');
  wrap.append(body);
  const ctx = { S, G, cb, rerender };
  ({ depart: tabDepart, workshop: tabWorkshop, wardrobe: tabWardrobe, causes: tabCauses, collection: tabCollection, ledger: tabLedger })[hideTab](body, ctx);

  if (cb.fresh && S.stats.runs === 0 && !S.tutorial.welcomed) {
    S.tutorial.welcomed = true; cb.persist();
    modal({
      title: 'Welcome to the hideout', cls: 'wide',
      body: `<p class="quote">“The barons of the Meridian Consortium ride the rails in velvet while the mill towns go hungry.”</p>
<p>This back room above a Millbrook pawnshop is your base. From here you’ll board trains, lift what the wealthy won’t miss, and decide what to do with it: keep it, fence it, or give it back to the people who need it most.</p>
<p>You have ${money(S.wealth)} and a ticket for <b>The Millbrook Local</b>. Board it from the <b>Depart</b> tab.</p>`,
      buttons: [{ label: 'To the platform', value: true, kind: 'primary' }], dismiss: true,
    });
  }
}

function reqLine(ok, text) { return el('div', { class: 'req' }, el('span', { class: ok ? 'ok' : 'no' }, ok ? '✓ ' : '✗ '), text); }
function trainReqs(S, tr) {
  const u = tr.unlock; if (!u) return [];
  const out = [];
  if (u.wealth) out.push([S.wealth >= u.wealth, `${money(u.wealth)} in hand`]);
  if (u.intel) out.push([S.intel >= u.intel, `${u.intel} intel`]);
  if (u.goodwill) out.push([S.goodwillTotal >= u.goodwill, `${u.goodwill} goodwill earned`]);
  if (u.sets) for (const s of u.sets) { const opts = s.split('|'); out.push([opts.some(k => S.sets[k]), 'Complete ' + opts.map(k => SETS[k].name).join(' or ')]); }
  return out;
}
export function checkUnlocks(S, announce = true) {
  const got = [];
  for (const id of TRAIN_ORDER) {
    if (S.trainsUnlocked.includes(id)) continue;
    const reqs = trainReqs(S, TRAINS[id]);
    if (reqs.length && reqs.every(r => r[0])) { S.trainsUnlocked.push(id); got.push(TRAINS[id].name); }
  }
  if (announce) for (const n of got) toast(`New line open: ${n}!`, 'good');
  return got;
}

function tabDepart(body, { S, cb, rerender }) {
  const outfit = OUTFITS[S.outfit];
  const cap = carryCapacity(S);
  body.append(el('div', { class: 'card', style: { marginBottom: '12px' } },
    el('div', { class: 'row' },
      el('div', { style: { flex: 1, minWidth: '200px' } },
        el('div', { class: 'tag' }, 'Travelling as'),
        el('h3', { style: { marginTop: '6px' } }, outfit.name),
        el('p', { class: 'small muted' }, `${outfit.desc} Pockets: ${cap.slots}${cap.hidden ? ` + ${cap.hidden} hidden` : ''}.`)),
      btn('Change outfit', 'small', () => { hideTab = 'wardrobe'; rerender(); }),
    )));
  const grid = el('div', { class: 'grid' });
  for (const id of TRAIN_ORDER) {
    const tr = TRAINS[id];
    const open = S.trainsUnlocked.includes(id);
    const card = el('div', { class: 'card train-card' + (open ? '' : ' locked') });
    card.append(el('div', { class: 'livery', style: { background: tr.livery } }));
    card.append(el('div', { class: 'stars' }, '◆'.repeat(tr.tier) + '◇'.repeat(5 - tr.tier)));
    card.append(el('h3', {}, tr.name), el('p', { class: 'small' }, tr.tagline));
    card.append(el('p', { class: 'small muted' }, `${tr.stations[0]} → ${tr.stations[tr.stations.length - 1]} · ${tr.legs} stops · ${tr.time === 'night' ? 'night' : tr.time === 'golden' ? 'evening' : 'daytime'} · ${tr.carriages.length} carriages`));
    if (open) {
      const fare = tr.ticket;
      const ok = S.wealth >= fare;
      card.append(el('div', { class: 'foot' },
        el('span', { class: 'cost' }, fare ? `Fare ${money(fare)}` : (id === 'royal' ? 'Forged invitation' : 'Third-class fare: free')),
        el('div', { class: 'spacer' }),
        btn('Board', 'primary', () => {
          if (!ok) return;
          S.wealth -= fare; cb.persist(); cb.onBoard(id);
        }, !ok)));
      if (!ok) card.append(el('p', { class: 'small', style: { color: '#ffb0a8' } }, 'You can’t afford the fare. Fence something or ride the Local.'));
    } else {
      card.append(el('div', { class: 'tag red', style: { margin: '6px 0' } }, 'Locked'));
      for (const [ok, t] of trainReqs(S, tr)) card.append(reqLine(ok, t));
    }
    grid.append(card);
  }
  body.append(grid);
}

function upgradeCost(S, u) {
  const c = { ...u.cost };
  if (u.id === 'disguise_evening' && S.sets.season && c.wealth) c.wealth = Math.round(c.wealth / 2);
  return c;
}
function affordable(S, c) { return (c.wealth || 0) <= S.wealth && (c.intel || 0) <= S.intel && (c.goodwill || 0) <= S.goodwill; }
function tabWorkshop(body, { S, cb, rerender }) {
  body.append(el('p', { class: 'muted small' }, 'Spend wealth, intel and goodwill to sharpen your craft. Goodwill is earned by giving loot back to the people.'));
  for (const br in BRANCHES) {
    body.append(el('div', { class: 'branch-title', style: { color: BRANCHES[br].color === '#1e2a44' ? '#9fb2dc' : undefined } }, BRANCHES[br].name));
    const grid = el('div', { class: 'grid' });
    for (const u of UPGRADES.filter(x => x.br === br)) {
      const owned = !!S.upgrades[u.id];
      const reqOK = (u.req || []).every(r => S.upgrades[r]);
      const c = upgradeCost(S, u);
      const can = !owned && reqOK && affordable(S, c);
      const card = el('div', { class: 'card' + (owned ? ' owned' : !reqOK ? ' locked' : '') },
        el('h3', {}, u.name), el('p', { class: 'small' }, u.desc), el('div', { class: 'eff' }, u.effect));
      if (u.req && !owned) for (const r of u.req) card.append(reqLine(!!S.upgrades[r], 'Requires ' + UPGRADES.find(x => x.id === r).name));
      card.append(el('div', { class: 'foot' },
        owned ? el('span', { class: 'tag green' }, 'Learned') : el('span', { class: 'cost' }, costText(c)),
        el('div', { class: 'spacer' }),
        owned ? null : btn('Acquire', 'small primary', () => buyUpgrade(S, u, c, cb, rerender), !can)));
      grid.append(card);
    }
    body.append(grid);
  }
}
function buyUpgrade(S, u, c, cb, rerender) {
  if (!affordable(S, c)) return;
  S.wealth -= c.wealth || 0; S.intel -= c.intel || 0; S.goodwill -= c.goodwill || 0;
  S.upgrades[u.id] = true;
  const outfit = { disguise_porter: 'porter', disguise_evening: 'evening', disguise_conductor: 'conductor' }[u.id];
  if (outfit && !S.outfits.includes(outfit)) S.outfits.push(outfit);
  sfx.cash();
  toast(`${u.name} acquired.${outfit ? ' New outfit in your wardrobe.' : ''}`, 'good');
  cb.persist(); rerender();
}

function tabWardrobe(body, { S, cb, rerender }) {
  body.append(el('p', { class: 'muted small' }, 'Each outfit opens different carriages and changes who trusts you. Staff notice anyone dressed above their ticket.'));
  const grid = el('div', { class: 'grid' });
  for (const id in OUTFITS) {
    const o = OUTFITS[id];
    const owned = S.outfits.includes(id);
    const sel = S.outfit === id;
    const trust = Object.entries(o.trust).map(([k, v]) => `${cap(k)} ${v < 0.85 ? 'trust you' : v > 1.05 ? 'distrust you' : 'shrug'}`).join(' · ');
    const card = el('div', { class: 'card' + (sel ? ' owned' : owned ? '' : ' locked') },
      el('div', { class: 'row' }, el('div', { style: { width: '28px', height: '28px', borderRadius: '50%', background: o.coat, border: `3px solid ${o.trim}` } }), el('h3', { style: { margin: 0 } }, o.name)),
      el('p', { class: 'small' }, o.desc),
      el('div', { class: 'eff' }, 'Access: ' + o.access.map(cap).join(', ')),
      el('p', { class: 'small muted' }, trust),
      el('div', { class: 'foot' }, sel ? el('span', { class: 'tag green' }, 'Wearing') : owned ? btn('Wear', 'small primary', () => { S.outfit = id; cb.persist(); sfx.ui(); rerender(); })
        : el('span', { class: 'req' }, 'Unlock in the Workshop: ' + (UPGRADES.find(u => u.id === o.req) || {}).name)));
    grid.append(card);
  }
  body.append(grid);
}

function tabCauses(body, { S, cb, rerender }) {
  body.append(el('p', { class: 'muted small' }, 'Gifts of loot raise goodwill for the cause you choose at settlement. You may also give cash directly: every £5 is one point of goodwill.'));
  const grid = el('div', { class: 'grid' });
  for (const c of CAUSES) {
    const v = S.causes[c.id] || 0;
    const next = c.milestones.find(m => v < m.at);
    const top = c.finite || c.milestones[c.milestones.length - 1].at;
    const done = c.finite && v >= c.finite;
    const card = el('div', { class: 'card' + (done ? ' owned' : '') },
      el('h3', {}, c.name), el('p', { class: 'small' }, c.desc), el('p', { class: 'small muted' }, c.who),
      meter(v / top, 'good'),
      el('div', { class: 'sans small', style: { marginTop: '4px' } }, done ? 'Debt cleared.' : next ? `${Math.floor(v)} / ${next.at} to “${next.name}”` : `${Math.floor(v)} given — every milestone reached`));
    const ul = el('ul', { class: 'milestones' });
    for (const m of c.milestones) ul.append(el('li', { class: S.milestones[m.key] ? 'done' : '' }, el('b', {}, m.name), ' — ', m.effect));
    card.append(ul);
    if (!done) {
      const row = el('div', { class: 'foot' });
      for (const amt of [20, 50, 100]) row.append(btn(`Give £${amt}`, 'tiny', () => giveCash(S, c, amt, cb, rerender), S.wealth < amt));
      card.append(row);
    }
    grid.append(card);
  }
  body.append(grid);
}
function giveCash(S, c, amt, cb, rerender) {
  if (S.wealth < amt) return;
  S.wealth -= amt;
  const pts = amt / 5;
  addToCause(S, c.id, pts);
  S.stats.donated += amt;
  sfx.chime();
  toast(`${money(amt)} to ${c.name}. (+${pts} goodwill)`, 'good');
  cb.persist(); rerender();
}
export function addToCause(S, causeId, pts) {
  const c = CAUSES.find(x => x.id === causeId);
  const before = S.causes[causeId] || 0;
  let after = before + pts;
  if (c.finite) after = Math.min(c.finite, after);
  S.causes[causeId] = after;
  S.goodwill += pts; S.goodwillTotal += pts;
  const out = [];
  for (const m of causeMilestonesReached(c, before, after)) {
    if (!S.milestones[m.key]) { S.milestones[m.key] = true; out.push(m); toast(`${c.name}: “${m.name}” — ${m.effect}`, 'good', 7000); }
  }
  return out;
}

function tabCollection(body, { S, cb, rerender }) {
  body.append(el('div', { class: 'branch-title' }, 'Named sets'));
  const sg = el('div', { class: 'grid' });
  for (const k in SETS) {
    const s = SETS[k], pr = setProgress(S, k);
    sg.append(el('div', { class: 'card' + (S.sets[k] ? ' owned' : '') }, el('h3', {}, s.name), el('p', { class: 'small' }, s.desc), meter(pr.have / pr.need, S.sets[k] ? 'good' : ''),
      el('div', { class: 'sans small', style: { marginTop: '4px' } }, `${pr.have} / ${pr.need}`), el('div', { class: 'eff', style: { marginTop: '4px' } }, (S.sets[k] ? 'Complete: ' : 'Reward: ') + s.reward)));
  }
  body.append(sg);
  body.append(el('div', { class: 'branch-title' }, `Your collection (${S.collection.length})`));
  if (!S.collection.length) { body.append(el('p', { class: 'muted' }, 'Nothing yet. Items you choose to keep after a journey are displayed here.')); }
  const grid = el('div', { class: 'items' });
  const sorted = S.collection.slice().sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || b.value - a.value);
  for (const it of sorted) {
    const t = el('div', { class: 'item-tile', tabindex: '0' }, el('img', { src: iconURL(it, 128), alt: '' }), el('div', {}, it.name), el('div', { class: 'rar', style: { color: RARITY[it.rarity].color } }, RARITY[it.rarity].name));
    t.addEventListener('click', () => itemDetail(S, it, cb, rerender));
    grid.append(t);
  }
  body.append(grid);
  const doss = Object.entries(S.dossiers || {});
  if (doss.length) {
    body.append(el('div', { class: 'branch-title' }, `Dossiers (${doss.length})`));
    const dg = el('div', { class: 'grid' });
    for (const [name, d] of doss.slice(-24).reverse()) dg.append(el('div', { class: 'card' }, el('h3', { style: { fontSize: '17px' } }, name), el('div', { class: 'tag' }, d.title || ''), el('p', { class: 'small' }, d.bio || ''), d.secret ? el('p', { class: 'small', style: { color: '#ffd793' } }, 'Secret: ' + d.secret) : null, el('p', { class: 'small muted' }, `${d.train} · ${d.date}`)));
    body.append(dg);
  }
}
function itemDetail(S, it, cb, rerender) {
  const body = el('div', {},
    el('div', { class: 'item-detail' }, el('img', { src: iconURL(it, 192), alt: '' }),
      el('div', {}, el('div', { class: 'rar', style: { color: RARITY[it.rarity].color } }, `${RARITY[it.rarity].name} ${CATEGORIES[it.cat] ? CATEGORIES[it.cat].single : ''}`),
        el('p', {}, it.desc), el('p', { class: 'small muted' }, it.history))),
    el('p', { class: 'small' }, `Taken from ${it.owner}${it.train ? ` aboard ${it.train}` : ''}${it.date ? `, ${it.date}` : ''}.`),
    el('p', { class: 'sans small' }, `Valued at ${money(it.value)} · a fence would pay ${money(fencePrice(it, S))}`));
  modal({
    title: it.name, body, cls: 'wide', dismiss: null,
    buttons: [{ label: 'Close', value: null }, { label: `Fence ${money(fencePrice(it, S))}`, value: 'sell' }, { label: `Donate`, value: 'give', sub: `+${donateGoodwill(it, S)} goodwill`, kind: 'green' }],
  }).then(v => {
    if (!v) return;
    S.collection = S.collection.filter(x => x !== it);
    if (v === 'sell') { const p = fencePrice(it, S); S.wealth += p; S.stats.sold++; sfx.cash(); toast(`Sold for ${money(p)}.`, 'good'); }
    if (v === 'give') { const gw = donateGoodwill(it, S); addToCause(S, 'families', gw); S.stats.given++; S.stats.donated += it.value; sfx.chime(); toast(`Donated to the Millbrook Families’ Fund. (+${gw} goodwill)`, 'good'); }
    recheckSets(S);
    cb.persist(); rerender();
  });
}
export function recheckSets(S) {
  const got = [];
  for (const k in SETS) {
    if (S.sets[k]) continue;
    const pr = setProgress(S, k);
    if (pr.have >= pr.need) { S.sets[k] = true; got.push(SETS[k]); }
  }
  for (const s of got) toast(`Set complete: ${s.name}! ${s.reward}`, 'good', 8000);
  return got;
}

function tabLedger(body, { S }) {
  const rep = reputation(S);
  body.append(el('div', { class: 'card', style: { marginBottom: '12px' } }, el('div', { class: 'tag' }, 'Reputation'), el('h3', { style: { marginTop: '6px' } }, rep.name), el('p', {}, rep.desc),
    el('p', { class: 'small muted' }, `Notoriety ${S.notoriety.toFixed(1)} — the higher it is, the more detectives and faces remember you.`)));
  const st = S.stats;
  const rows = [['Journeys', st.runs], ['Successful lifts', st.lifts], ['Clean lifts', st.clean], ['Flawless lifts', st.critical], ['Locks picked', st.locks], ['Passengers observed', st.observed], ['Times caught', st.caught], ['Thrown off', st.ejected],
    ['Items kept', st.kept], ['Items fenced', st.sold], ['Items given away', st.given], ['Returned to owners', st.returned], ['Documents leaked', st.leaked], ['Cash stolen', money(st.cashTotal)], ['Value donated', money(st.donated)], ['Best haul', money(st.bestHaul)]];
  const tbl = el('table', { class: 'stat-table' });
  for (const [k, v] of rows) tbl.append(el('tr', {}, el('td', {}, k), el('td', {}, String(v))));
  body.append(el('div', { class: 'grid' }, el('div', { class: 'card' }, el('h3', {}, 'Record'), tbl),
    el('div', { class: 'card' }, el('h3', {}, 'Journal'), S.log.length ? el('ul', { class: 'log' }, S.log.slice(0, 14).map(l => el('li', {}, el('div', { class: 'small muted sans' }, l.date), l.text))) : el('p', { class: 'muted' }, 'No journeys yet.'))));
}

function btn(label, kind, fn, disabled) {
  const b = el('button', { class: 'btn ' + kind, disabled: disabled || null }, label);
  b.addEventListener('click', () => { if (b.disabled) return; sfx.ui(); fn(); });
  return b;
}

// ======================= SETTLEMENT =======================
export function renderSettlement(root, G, R, cb) {
  const S = G.S;
  const scr = el('div', { class: 'scr' });
  const wrap = el('div', { class: 'wrap', style: { maxWidth: '760px' } });
  scr.append(wrap); root.innerHTML = ''; root.append(scr);
  const ok = R.reason === 'arrived' || R.reason === 'stepped';
  const head = { arrived: ['End of the line', `${R.trainName} pulls into ${R.station}. You step down onto the platform with your hat tipped low.`], stepped: [`Off at ${R.station}`, `You step lightly onto the platform at ${R.station} and let ${R.trainName} steam on without you.`], caught: ['Thrown off', `Set down on the platform at ${R.station} under a conductor’s glare.`], abandoned: ['A long walk home', 'You jumped the train and walked back along the line.'] }[R.reason];
  wrap.append(el('div', { class: 'settle-head' }, el('h1', {}, head[0]), el('p', {}, head[1])));
  const value = R.items.reduce((s, i) => s + i.value, 0);
  const sum = el('div', { class: 'summary' });
  const S1 = (v, k) => sum.append(el('div', { class: 's' }, el('b', {}, String(v)), el('span', {}, k)));
  S1(money(R.cash), 'Cash');
  S1(R.items.length, 'Items');
  S1(R.stats.lifts, 'Lifts');
  S1(R.stats.critical ? `${R.stats.clean} (${R.stats.critical}★)` : R.stats.clean, 'Clean');
  S1(R.heatPeak + '%', 'Peak heat');
  S1('+' + (R.intelGain + R.items.reduce((s, i) => s + (i.intel || 0), 0)), 'Intel');
  wrap.append(sum);
  if (R.lost.length) wrap.append(el('p', { class: 'small', style: { color: '#ffb0a8', textAlign: 'center' } }, `Lost: ${R.lost.map(i => i.name).join(', ')}.`));
  if (R.confiscated) wrap.append(el('p', { class: 'small muted', style: { textAlign: 'center' } }, `${R.confiscated} item${R.confiscated > 1 ? 's were' : ' was'} confiscated in a search.`));

  const decisions = new Map();
  let cause = S._lastCause || 'families';
  if (R.items.length) {
    wrap.append(el('div', { class: 'branch-title' }, 'Decide the fate of your haul'));
    const sel = el('select', { 'aria-label': 'Cause for gifts' }, CAUSES.map(c => el('option', { value: c.id, selected: c.id === cause || null }, c.name)));
    sel.addEventListener('change', () => { cause = sel.value; refreshAll(); });
    wrap.append(el('div', { class: 'cause-pick' }, el('span', { class: 'small' }, 'Gifts go to:'), sel));
  } else {
    wrap.append(el('p', { class: 'muted', style: { textAlign: 'center' } }, ok ? 'You came home with nothing but stories.' : 'You came home empty-handed.'));
  }
  const rows = [];
  const refreshAll = () => rows.forEach(f => f());
  for (const it of R.items) {
    const isDoc = it.cat === 'document' || it.cat === 'letter';
    const opts = [
      ['keep', 'Keep', () => 'Display it'],
      ['sell', 'Fence', () => money(fencePrice(it, S))],
      ['give', 'Give', () => `+${donateGoodwill(it, S)} goodwill`],
      ['return', it.hartley ? 'Return to Mrs. Hartley' : 'Return', () => `+${it.hartley ? 60 : returnGoodwill(it, S)} goodwill`],
    ];
    if (isDoc) opts.push(['leak', 'Leak', () => `+${leakGoodwill(it, S)} to the Clarion`]);
    decisions.set(it, it.hartley ? 'return' : it.ownerCls === 'working' || it.heirloomOf ? 'return' : 'keep');
    const optBox = el('div', { class: 'opts' });
    const buttons = opts.map(([k, label, sub]) => {
      const b = el('button', { class: 'btn tiny' }, label, el('small', {}, sub()));
      b.addEventListener('click', () => { decisions.set(it, k); sfx.ui(); refresh(); });
      optBox.append(b);
      return [k, b, sub];
    });
    const refresh = () => { for (const [k, b, sub] of buttons) { b.classList.toggle('sel', decisions.get(it) === k); b.lastChild.textContent = sub(); } };
    rows.push(refresh);
    refresh();
    const owner = it.ownerCls === 'working' || it.ownerCls === 'staff' ? `${it.owner} — a working family can’t spare this` : `Taken from ${it.owner}`;
    wrap.append(el('div', { class: 'decide' }, el('img', { src: iconURL(it, 120), alt: '' }),
      el('div', { class: 'info' }, el('div', { class: 'nm' }, it.name),
        el('div', { class: 'rar', style: { color: RARITY[it.rarity].color } }, `${RARITY[it.rarity].name} · value ${money(it.value)}`),
        el('div', { class: 'ow' }, owner), optBox)));
  }
  const done = el('button', { class: 'btn primary', style: { width: '100%', marginTop: '12px' } }, 'Return to the hideout');
  done.addEventListener('click', () => {
    sfx.cash();
    S._lastCause = cause;
    const notes = applySettlement(S, R, decisions, cause);
    S.pending = null;
    cb.persist();
    if (notes.length) modal({ title: 'News from the hideout', body: el('div', {}, notes.map(n => el('p', {}, n))), buttons: [{ label: 'Onward', value: true, kind: 'primary' }], dismiss: true }).then(() => cb.onDone());
    else cb.onDone();
  });
  wrap.append(done);
}

function applySettlement(S, R, decisions, cause) {
  const notes = [];
  const msBefore = new Set(Object.keys(S.milestones));
  const st = S.stats;
  const ok = R.reason === 'arrived' || R.reason === 'stepped';
  st.runs++;
  st.lifts += R.stats.lifts; st.clean += R.stats.clean; st.critical += R.stats.critical; st.fails += R.stats.fails;
  st.locks += R.stats.locks; st.observed += R.stats.observed; st.poorVictims += R.stats.poor;
  st.cashTotal += R.cash;
  if (R.reason === 'caught') { st.caught++; st.ejected++; }
  else if (R.caughtCount) st.caught += R.caughtCount;
  S.wealth += R.cash;
  // intel: observations plus anything you read on the way home
  let intel = R.intelGain;
  for (const it of R.items) intel += it.intel || 0;
  S.intel += intel;
  if (R.goodwillGain) addToCause(S, cause, R.goodwillGain);
  let haul = R.cash;
  let wealthFromSales = 0, gwGiven = 0;
  for (const it of R.items) {
    haul += it.value;
    const d = decisions.get(it) || 'keep';
    if (it.hartley) S.story.locketFound = true;
    if (d === 'keep') { S.collection.push(it); st.kept++; }
    else if (d === 'sell') { const p = fencePrice(it, S); S.wealth += p; wealthFromSales += p; st.sold++; st.kept++; }
    else if (d === 'give') { const gw = donateGoodwill(it, S); addToCause(S, cause, gw); gwGiven += gw; st.given++; st.donated += it.value; }
    else if (d === 'return') {
      const gw = it.hartley ? 60 : returnGoodwill(it, S);
      addToCause(S, it.hartley ? 'hartley' : cause, gw); gwGiven += gw; st.given++; st.returned++;
      if (it.ownerEthics < 0.5) S.notoriety = Math.max(0, S.notoriety - 0.5);
      if (it.hartley) { S.story.locketReturned = true; notes.push('Mrs. Hartley opens the locket with shaking hands. Inside, her husband smiles out of a photograph. “I never thought I’d see him again.” Word of it travels up and down the line.'); }
    } else if (d === 'leak') {
      const gw = leakGoodwill(it, S); addToCause(S, 'clarion', gw); gwGiven += gw; st.leaked++; st.given++;
      if (it.uid === 'meridian_charter') { S.story.charterLeaked = true; notes.push('THE CLARION — SPECIAL EDITION. “THE MERIDIAN COMPACT EXPOSED.” By noon the barons’ names are on every street corner. Somewhere, a widow laughs out loud. You did it, gentleman.'); }
      else if (it.consortium) notes.push(`The Clarion prints “${it.name}”. The Consortium’s lawyers are seen running.`);
    }
  }
  st.bestHaul = Math.max(st.bestHaul, haul);
  // notoriety
  if (R.reason === 'caught') S.notoriety += 1;
  if (R.heatPeak >= 75) S.notoriety += 1;
  else if (ok && R.heatPeak < 25 && !R.caughtCount) S.notoriety = Math.max(0, S.notoriety - 1);
  S.notoriety = Math.min(10, S.notoriety);
  for (const c of CAUSES) for (const m of c.milestones) if (S.milestones[m.key] && !msBefore.has(m.key)) notes.push(`${c.name} reaches a milestone — “${m.name}”: ${m.effect}`);
  // sets & unlocks
  for (const s of recheckSets(S)) notes.push(`Set complete — ${s.name}. ${s.reward}`);
  for (const n of checkUnlocks(S, false)) notes.push(`A new line is open to you: ${n}.`);
  if (S.milestones.hartley_done && !S.story.hartleyNote) { S.story.hartleyNote = true; notes.push('Mrs. Hartley’s debt is paid. She whispers that Silas Mortlake keeps her locket on him—and that he rides the Amberline Regional and the Night Express.'); }
  // journal
  const verb = { arrived: 'rode to the end of the line', stepped: `stepped off at ${R.station}`, caught: `was thrown off at ${R.station}`, abandoned: 'jumped the train' }[R.reason];
  S.log.unshift({ date: `${R.date} · ${R.trainName}`, text: `You ${verb} with ${money(R.cash)} and ${R.items.length} item${R.items.length === 1 ? '' : 's'}${R.stats.lifts ? ` after ${R.stats.lifts} lift${R.stats.lifts > 1 ? 's' : ''}` : ''}.${gwGiven ? ` Gave away ${gwGiven} goodwill’s worth.` : ''}${wealthFromSales ? ` Fenced for ${money(wealthFromSales)}.` : ''}` });
  S.log = S.log.slice(0, 40);
  S.tutorial.done = true;
  return notes;
}
