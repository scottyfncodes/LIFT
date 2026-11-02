// LIFT — title, depot (hub) and shift report screens
import { el } from './util.js';
import { TRAINS, TRAIN_ORDER, RARITY, RARITY_ORDER, CATEGORIES } from './data/content.js';
import { HERO, UNIFORMS, SKILLS, TREES, ROGUES, TECHNIQUES, MEMOIRS, RANKS, ROUTE_RANK, ROUTE_TAGLINE } from './data/cast.js';
import { missionsFor, routeOpen, applyReport, computeRewards } from './missions.js';
import { iconURL } from './world/icons.js';
import { modal, toast, meter } from './ui.js';
import { sfx, initAudio } from './audio.js';
import { showHelp } from './run.js';

const star = n => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
function btn(label, kind, fn, disabled, sub) {
  const b = el('button', { class: 'btn ' + kind, disabled: disabled || null }, label, sub ? el('small', {}, sub) : null);
  b.addEventListener('click', () => { if (b.disabled) return; sfx.ui(); fn(); });
  return b;
}

// ======================= TITLE =======================
export function renderTitle(root, G, cb) {
  root.innerHTML = '';
  const S = G.S;
  const card = el('div', { class: 'title-card' },
    el('h1', { class: 'logo' }, 'LIFT'),
    el('p', { class: 'tagline' }, 'He’s been on this train for thirty years.'),
    el('div', { class: 'subtag' }, 'A railway mystery of quick hands · 1931'),
    el('div', { class: 'deco-rule' }));
  const btns = el('div', { class: 'title-buttons' });
  const B = (label, kind, fn, sub) => { const b = el('button', { class: 'btn ' + kind }, label, sub ? el('small', {}, sub) : null); b.addEventListener('click', () => { initAudio(); sfx.ui(); fn(); }); btns.append(b); return b; };
  if (G.hasSave && (S.stats.runs || S.run || S.pending)) {
    const sub = S.pending ? `File your report from ${S.pending.routeName}`
      : S.run && S.run.trainId && TRAINS[S.run.trainId] ? `Resume your shift aboard ${TRAINS[S.run.trainId].name}`
        : `${RANKS[S.rank || 0].name} · ${S.stats.returned} returned · ${S.stats.runs} shift${S.stats.runs === 1 ? '' : 's'}`;
    B('Continue', 'primary', cb.onContinue, sub);
    B('New game', '', () => {
      modal({ title: 'Start over?', body: '<p>Your career, case files and ledger will be erased.</p>', dismiss: false, buttons: [{ label: 'Keep my career', value: false }, { label: 'Start fresh', value: true, kind: 'danger' }] })
        .then(v => { if (v) cb.onNew(); });
    });
  } else B('Report for duty', 'primary', cb.onNew, 'Your first shift: The Millbrook Local');
  B('How to play', '', () => showHelp());
  const set = el('div', { class: 'row', style: { justifyContent: 'center' } });
  const tog = (label, key) => {
    const b = el('button', { class: 'btn small' + (S.settings[key] ? ' sel' : '') }, `${label}: ${S.settings[key] ? 'On' : 'Off'}`);
    b.addEventListener('click', () => { S.settings[key] = !S.settings[key]; b.textContent = `${label}: ${S.settings[key] ? 'On' : 'Off'}`; b.classList.toggle('sel', S.settings[key]); initAudio(); cb.onSettings(); sfx.ui(); });
    set.append(b);
  };
  tog('Sound', 'sound'); tog('Music', 'music');
  btns.append(set);
  card.append(btns, el('div', { class: 'title-foot' }, 'A thief lifts a passenger’s watch. He doesn’t notice the ticket inspector behind him.'));
  const strip = el('div', { class: 'train-strip' }, el('div', { class: 'rail' }),
    el('div', { class: 'tr' }, el('div', { class: 'car' }), el('div', { class: 'car' }), el('div', { class: 'car' }), el('div', { class: 'car' }), el('div', { class: 'car loco' })));
  root.append(el('div', { class: 'scr title-scr' }, card, strip));
}

// ======================= DEPOT =======================
let tab = 'duty';
export function renderDepot(root, G, cb) {
  const S = G.S;
  if (cb.fresh) tab = 'duty';
  const scr = el('div', { class: 'scr' });
  const wrap = el('div', { class: 'wrap' });
  scr.append(wrap); root.innerHTML = ''; root.append(scr);
  const rerender = () => { const y = scr.scrollTop; renderDepot(root, G, { ...cb, fresh: false }); root.firstChild.scrollTop = y; };
  const rk = S.rank || 0, next = RANKS[rk + 1];
  const menuB = btn('Menu', 'small ghost', () => cb.onTitle());
  wrap.append(el('div', { class: 'hdr' },
    el('div', {}, el('h1', {}, 'The Depot'), el('div', { class: 'rep' }, `${HERO.name} · ${RANKS[rk].name}`),
      next ? el('div', { class: 'xpbar' }, meter((S.xp - RANKS[rk].xp) / (next.xp - RANKS[rk].xp)), el('span', { class: 'small muted' }, `${S.xp}/${next.xp} toward ${next.name}`)) : el('div', { class: 'small muted' }, 'The highest rank on the line.')),
    el('div', { class: 'spacer' }),
    el('div', { class: 'purse' },
      el('span', { class: 'coin-pill', title: 'Earned by returns and good work' }, 'Merits ', el('b', {}, String(S.merits))),
      el('span', { class: 'coin-pill', title: 'Earned by kindness and gratitude' }, 'Favours ', el('b', {}, String(S.favours)))),
    menuB));
  const TABS = [['duty', 'Duty Roster'], ['craft', 'The Craft'], ['cover', 'The Cover'], ['network', 'The Network'], ['cases', 'Case Files'], ['ledger', 'Ledger']];
  const tabs = el('div', { class: 'tabs' });
  for (const [k, label] of TABS) tabs.append(btn(label, 'small' + (tab === k ? ' sel' : ''), () => { tab = k; rerender(); }));
  wrap.append(tabs);
  const body = el('div'); wrap.append(body);
  const ctx = { S, G, cb, rerender };
  ({ duty: tabDuty, craft: c => tabTree(c, ctx, 'craft'), cover: c => tabTree(c, ctx, 'cover'), network: c => tabTree(c, ctx, 'network'), cases: tabCases, ledger: tabLedger })[tab](body, ctx);

  if (cb.fresh && S.stats.runs === 0 && !S.tutorial.welcomed) {
    S.tutorial.welcomed = true; cb.persist();
    modal({
      title: 'Reporting for duty', cls: 'wide', dismiss: true,
      body: `<p class="quote">“Tull. You’ve forgotten more about pickpockets than the railway police ever knew.”</p>
<p>For thirty years you’ve punched tickets on the Meridian lines—and watched every thief who ever worked them. You know the bump, the distraction, the seated lift. You can do them all, better than they can.</p>
<p>So you do. Quietly. You watch who steals, lift the goods back off the thief, and return them to their owners before anyone notices. You never accuse anyone, and you never blow your cover.</p>
<p>Your first shift is <b>The Ashcombe Hunter</b> on the Millbrook Local. Pick it from the <b>Duty Roster</b>.</p>`,
      buttons: [{ label: 'To the platform', value: true, kind: 'primary' }],
    });
  }
}

function tabDuty(body, { S, cb, rerender }) {
  const U = UNIFORMS[S.uniform] || UNIFORMS.inspector;
  body.append(el('div', { class: 'card', style: { marginBottom: '12px' } },
    el('div', { class: 'row' },
      el('div', { style: { width: '30px', height: '30px', borderRadius: '50%', background: U.coat, border: `3px solid ${U.trim}`, flex: '0 0 auto' } }),
      el('div', { style: { flex: 1, minWidth: '200px' } }, el('div', { class: 'tag' }, 'Uniform'), el('h3', { style: { marginTop: '6px' } }, U.name), el('p', { class: 'small muted' }, U.desc)),
      btn('Change', 'small', () => { tab = 'cover'; rerender(); }))));
  for (const id of TRAIN_ORDER) {
    const tr = TRAINS[id];
    const open = routeOpen(id, S);
    const card = el('div', { class: 'card train-card route' + (open ? '' : ' locked') });
    card.append(el('div', { class: 'livery', style: { background: tr.livery } }));
    card.append(el('div', { class: 'row' }, el('h3', { style: { margin: 0 } }, tr.name), el('span', { class: 'stars' }, '◆'.repeat(tr.tier) + '◇'.repeat(5 - tr.tier))));
    card.append(el('p', { class: 'small' }, ROUTE_TAGLINE[id]), el('p', { class: 'small muted' }, `${tr.stations[0]} → ${tr.stations[tr.legs]} · ${tr.legs} stops · ${tr.time === 'night' ? 'night' : tr.time === 'golden' ? 'evening' : 'daytime'}`));
    if (!open) { card.append(el('span', { class: 'tag red' }, `Assigned at ${RANKS[ROUTE_RANK[id]].name}`)); body.append(card); continue; }
    const list = el('div', { class: 'missions' });
    for (const m of missionsFor(id, S)) {
      const done = S.missionsDone[m.id] || 0;
      const row = el('div', { class: 'mission' + (m.patrol ? ' patrol' : '') + (done ? ' done' : '') },
        el('div', { class: 'mt' }, el('b', {}, m.title), m.patrol ? el('span', { class: 'tag' }, 'Repeatable') : el('span', { class: 'stars small' }, done ? star(done) : 'New')),
        el('div', { class: 'small' }, m.brief));
      row.append(btn(m.patrol ? 'Take the shift' : done ? 'Replay' : 'Take the case', 'small ' + (m.patrol || done ? '' : 'primary'), () => briefing(S, id, m, cb)));
      list.append(row);
    }
    card.append(list);
    body.append(card);
  }
}
function briefing(S, routeId, m, cb) {
  const tr = TRAINS[routeId];
  const list = el('ul', { class: 'milestones' });
  for (const g of m.goals) list.append(el('li', {}, g.text));
  for (const g of m.optional || []) list.append(el('li', { class: 'opt' }, g.text + ' (optional)'));
  const body = el('div', {}, el('p', { class: 'quote' }, m.brief), el('p', { class: 'small muted', style: { textAlign: 'center' } }, `${tr.name} · ${tr.stations[0]} → ${tr.stations[tr.legs]}`), el('div', { class: 'branch-title' }, 'Orders'), list);
  modal({ title: m.title, body, cls: 'wide', dismiss: false, buttons: [{ label: 'Not today', value: false }, { label: 'Board the train', value: true, kind: 'primary' }] })
    .then(v => { if (v) cb.onBoard(routeId, m.id); });
}

function canBuy(S, k) {
  const c = k.cost || {};
  return (c.merits || 0) <= S.merits && (c.favours || 0) <= S.favours && (k.rank || 0) <= (S.rank || 0) && (k.req || []).every(r => S.upgrades[r]);
}
function tabTree(body, { S, cb, rerender }, tree) {
  body.append(el('p', { class: 'muted small' }, TREES[tree].desc + (tree === 'network' ? ' Paid for with favours—earned by kindness, gratitude and good results.' : ' Paid for with merits—earned by returning what was stolen.')));
  if (tree === 'cover') {
    body.append(el('div', { class: 'branch-title' }, 'Uniform for the next shift'));
    const g = el('div', { class: 'grid' });
    for (const id in UNIFORMS) {
      const U = UNIFORMS[id];
      const owned = !U.req || S.upgrades[U.req];
      const sel = S.uniform === id;
      g.append(el('div', { class: 'card' + (sel ? ' owned' : owned ? '' : ' locked') },
        el('div', { class: 'row' }, el('div', { style: { width: '26px', height: '26px', borderRadius: '50%', background: U.coat, border: `3px solid ${U.trim}` } }), el('h3', { style: { margin: 0 } }, U.name)),
        el('p', { class: 'small' }, U.desc),
        el('div', { class: 'eff' }, `Duties: ${U.duties.length ? U.duties.map(d => d === 'tickets' ? 'check tickets' : 'serve refreshments').join(', ') : 'none'}${U.keys ? ' · carries keys' : ''}`),
        el('div', { class: 'foot' }, sel ? el('span', { class: 'tag green' }, 'Wearing') : owned ? btn('Wear', 'small primary', () => { S.uniform = id; cb.persist(); rerender(); }) : el('span', { class: 'req' }, 'Unlock below'))));
    }
    body.append(g);
    body.append(el('div', { class: 'branch-title' }, 'Standing & credentials'));
  }
  const grid = el('div', { class: 'grid' });
  for (const k of SKILLS.filter(s => s.tree === tree)) {
    const owned = !!S.upgrades[k.id];
    const reqOK = (k.req || []).every(r => S.upgrades[r]) && (k.rank || 0) <= (S.rank || 0);
    const cost = Object.entries(k.cost).map(([c, v]) => `${v} ${c}`).join(' · ');
    const card = el('div', { class: 'card' + (owned ? ' owned' : !reqOK ? ' locked' : '') }, el('h3', {}, k.name), el('p', { class: 'small' }, k.desc), el('div', { class: 'eff' }, k.effect));
    if (!owned) {
      for (const r of k.req || []) card.append(el('div', { class: 'req' }, el('span', { class: S.upgrades[r] ? 'ok' : 'no' }, S.upgrades[r] ? '✓ ' : '✗ '), 'Requires ' + SKILLS.find(x => x.id === r).name));
      if (k.rank) card.append(el('div', { class: 'req' }, el('span', { class: (S.rank || 0) >= k.rank ? 'ok' : 'no' }, (S.rank || 0) >= k.rank ? '✓ ' : '✗ '), 'Rank: ' + RANKS[k.rank].name));
    }
    card.append(el('div', { class: 'foot' }, owned ? el('span', { class: 'tag green' }, 'Yours') : el('span', { class: 'cost' }, cost), el('div', { class: 'spacer' }),
      owned ? null : btn('Acquire', 'small primary', () => {
        if (!canBuy(S, k)) return;
        S.merits -= k.cost.merits || 0; S.favours -= k.cost.favours || 0; S.upgrades[k.id] = true;
        sfx.cash(); toast(`${k.name} acquired.`, 'good'); cb.persist(); rerender();
      }, !canBuy(S, k))));
    grid.append(card);
  }
  body.append(grid);
}

function tabCases(body, { S }) {
  body.append(el('p', { class: 'muted small' }, 'The rogues of the Meridian lines. Identify a thief once and you’ll know their face forever.'));
  const grid = el('div', { class: 'grid' });
  for (const id in ROGUES) {
    const R = ROGUES[id], c = S.cases[id];
    if (!c) { grid.append(el('div', { class: 'card locked case' }, el('h3', {}, '? ? ?'), el('p', { class: 'small muted' }, R.rank > (S.rank || 0) ? 'Works the senior routes.' : 'Not yet encountered.'))); continue; }
    const status = c.arrested ? el('span', { class: 'tag green' }, 'Arrested') : c.profiled ? el('span', { class: 'tag red' }, 'Profiled') : el('span', { class: 'tag' }, 'Glimpsed');
    const card = el('div', { class: 'card case' + (c.arrested ? ' owned' : '') },
      el('div', { class: 'row' }, el('h3', { style: { margin: 0 } }, c.profiled ? R.name : 'An unknown face'), status),
      c.profiled ? el('div', { class: 'small', style: { color: '#ffb0a8' } }, `“${R.alias}” · ${TECHNIQUES[R.tech].name}${R.crew ? ' · crew' : ''}`) : null,
      el('p', { class: 'small' }, c.profiled ? R.bio : 'You’ve shared a train with this one, but you never pinned them down.'),
      c.profiled ? el('div', { class: 'eff' }, 'Tell: ' + TECHNIQUES[R.tech].tell) : null,
      el('div', { class: 'small muted' }, `Encounters: ${c.seen} · identified ${c.identified}×`));
    if (c.profiled && c.notes.length) for (const n of c.notes.slice(-3)) card.append(el('div', { class: 'small' }, '• ' + n));
    grid.append(card);
  }
  body.append(grid);
  body.append(el('p', { class: 'small muted', style: { marginTop: '10px' } }, `Opportunists: ${S.anon.seen} encountered · ${S.anon.identified} identified · ${S.anon.arrested} arrested.`));
  body.append(el('div', { class: 'branch-title' }, 'Techniques'));
  const tg = el('div', { class: 'grid' });
  for (const k in TECHNIQUES) { const T = TECHNIQUES[k]; tg.append(el('div', { class: 'card' }, el('h3', {}, T.name), el('p', { class: 'small' }, T.desc), el('div', { class: 'eff' }, 'Watch for: ' + T.tell))); }
  body.append(tg);
  if (S.investigations.length) {
    body.append(el('div', { class: 'branch-title' }, 'Investigations'));
    const ul = el('ul', { class: 'log' });
    for (const i of S.investigations.slice(0, 15)) ul.append(el('li', {}, el('span', { class: 'stars' }, star(i.stars) + ' '), el('b', {}, i.title), el('span', { class: 'small muted' }, ` · ${i.route} · ${i.date} · ${i.returned} returned`)));
    body.append(ul);
  }
}

function tabLedger(body, { S }) {
  const st = S.stats;
  body.append(el('div', { class: 'branch-title' }, `Returned to their owners (${S.returns.length})`));
  if (!S.returns.length) body.append(el('p', { class: 'muted' }, 'Every belonging you return is recorded here. Rare pieces are worth a story.'));
  const grid = el('div', { class: 'items' });
  const sorted = S.returns.slice().sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
  for (const r of sorted.slice(0, 60)) {
    const t = el('div', { class: 'item-tile', tabindex: '0' }, el('img', { src: iconURL(r, 128), alt: '' }), el('div', {}, r.name), el('div', { class: 'rar', style: { color: RARITY[r.rarity].color } }, (r.unaware ? '✦ ' : '') + RARITY[r.rarity].name));
    t.addEventListener('click', () => modal({ title: r.name, cls: 'wide', dismiss: true, buttons: [{ label: 'Close', value: true }],
      body: el('div', {}, el('div', { class: 'item-detail' }, el('img', { src: iconURL(r, 192), alt: '' }), el('div', {}, el('div', { class: 'rar', style: { color: RARITY[r.rarity].color } }, `${RARITY[r.rarity].name} ${CATEGORIES[r.cat] ? CATEGORIES[r.cat].single : ''}`), el('p', {}, r.desc || ''))),
        el('p', { class: 'small' }, `Returned to ${r.owner} aboard ${r.route}, ${r.date}.${r.unaware ? ' They never knew it was gone.' : ''}`)) }));
    grid.append(t);
  }
  body.append(grid);
  const rows = [['Shifts worked', st.runs], ['Belongings returned', st.returned], ['…before the owner noticed', st.unaware], ['Recovered from thieves', st.recovered], ['Escaped with a thief', st.escaped],
    ['Thieves identified', st.identified], ['Arrests', st.arrests], ['Thefts witnessed', st.witnessed], ['Tickets checked', st.tickets], ['Passengers helped', st.helped], ['Wrong pockets', st.falseLifts], ['Reprimands', st.reprimands], ['Stars earned', st.stars]];
  const tbl = el('table', { class: 'stat-table' });
  for (const [k, v] of rows) tbl.append(el('tr', {}, el('td', {}, k), el('td', {}, String(v))));
  const mem = el('div', { class: 'card' }, el('h3', {}, 'Memoirs'));
  for (const m of MEMOIRS) {
    if (!S.memoirs[m.id]) { mem.append(el('div', { class: 'small muted', style: { margin: '6px 0' } }, '• A page not yet written.')); continue; }
    const d = el('details', { class: 'memoir' }, el('summary', {}, m.title), el('p', { class: 'small' }, m.text));
    mem.append(d);
  }
  body.append(el('div', { class: 'grid', style: { marginTop: '12px' } }, el('div', { class: 'card' }, el('h3', {}, 'Service record'), tbl), mem,
    el('div', { class: 'card' }, el('h3', {}, 'Journal'), S.log.length ? el('ul', { class: 'log' }, S.log.slice(0, 12).map(l => el('li', {}, el('div', { class: 'small muted sans' }, l.date), l.text))) : el('p', { class: 'muted' }, 'No shifts yet.'))));
}

// ======================= SHIFT REPORT =======================
export function renderReport(root, G, R, cb) {
  const S = G.S;
  const scr = el('div', { class: 'scr' });
  const wrap = el('div', { class: 'wrap', style: { maxWidth: '760px' } });
  scr.append(wrap); root.innerHTML = ''; root.append(scr);
  const head = { arrived: `${R.routeName} reaches ${R.station}.`, quit: `You hand over to the relief inspector at ${R.station}.`, relieved: `Superintendent Crabbe takes your punch at ${R.station}.` }[R.reason] || '';
  wrap.append(el('div', { class: 'settle-head' }, el('div', { class: 'tag' + (R.success ? ' green' : ' red') }, R.success ? 'Case closed' : 'Case open'), el('h1', {}, R.missionTitle), el('div', { class: 'stars big' }, star(R.stars)), el('p', {}, head)));
  const objs = el('div', { class: 'card', style: { marginBottom: '12px' } }, el('h3', {}, 'Orders'));
  for (const g of R.goals.concat(R.optional)) objs.append(el('div', { class: 'obj ' + g.status }, (g.status === 'done' ? '✓ ' : '✗ ') + g.text + (g.optional ? ' (optional)' : '')));
  wrap.append(objs);
  const rw = computeRewards(R);
  const sum = el('div', { class: 'summary' });
  const S1 = (v, k) => sum.append(el('div', { class: 's' }, el('b', {}, String(v)), el('span', {}, k)));
  S1(R.returned.length, 'Returned'); S1(R.returned.filter(r => r.unaware).length, 'Unnoticed'); S1(R.escaped.length + R.ditched.length, 'Lost to thieves');
  S1(rw.identified, 'Identified'); S1(R.tickets, 'Tickets'); S1(R.suspPeak + '%', 'Peak suspicion');
  wrap.append(sum);
  if (R.returned.length) {
    wrap.append(el('div', { class: 'branch-title' }, 'Home safe'));
    for (const r of R.returned) wrap.append(el('div', { class: 'decide' }, el('img', { src: iconURL(r.item, 120), alt: '' }),
      el('div', { class: 'info' }, el('div', { class: 'nm' }, r.item.name), el('div', { class: 'rar', style: { color: RARITY[r.item.rarity].color } }, RARITY[r.item.rarity].name),
        el('div', { class: 'ow' }, `${r.owner} — ${r.unaware ? 'never knew it was gone' : r.how === 'plant' ? 'found it in their pocket' : 'thanked you warmly'}`))));
  }
  const lost = R.escaped.map(e => `${e.ownerName}’s ${e.item.name} left with ${e.thief}`).concat(R.ditched.map(d => `${d.ownerName}’s ${d.item.name} was never found`));
  if (lost.length) { wrap.append(el('div', { class: 'branch-title' }, 'Lost')); for (const l of lost) wrap.append(el('div', { class: 'small', style: { color: '#ffb0a8' } }, '• ' + l)); }
  if (R.lostProperty.length) wrap.append(el('p', { class: 'small muted' }, `${R.lostProperty.length} item${R.lostProperty.length > 1 ? 's' : ''} handed in to Lost Property (owners will collect them).`));
  if (R.thieves.length) {
    wrap.append(el('div', { class: 'branch-title' }, 'Who was working the train'));
    for (const t of R.thieves) {
      const R2 = t.rogue ? ROGUES[t.rogue] : null;
      wrap.append(el('div', { class: 'small' }, `${t.identified ? '✓' : '?'} ${t.identified ? t.name : 'Someone'}${t.identified && R2 ? ` (“${R2.alias}”)` : ''} — ${TECHNIQUES[t.tech].name}${t.arrested ? ' · arrested' : ''}${t.struck ? ` · ${t.struck} theft${t.struck > 1 ? 's' : ''}` : ''}`));
    }
  }
  if (R.falseLifts) wrap.append(el('p', { class: 'small', style: { color: '#ffd793' } }, `${R.falseLifts} wrong pocket${R.falseLifts > 1 ? 's' : ''}. Innocent passengers don’t deserve your hands.`));
  wrap.append(el('div', { class: 'card reward' }, el('div', { class: 'row', style: { justifyContent: 'center', gap: '18px' } },
    el('div', {}, el('b', {}, '+' + rw.merits), el('div', { class: 'small muted' }, 'merits')), el('div', {}, el('b', {}, '+' + rw.favours), el('div', { class: 'small muted' }, 'favours')), el('div', {}, el('b', {}, '+' + rw.xp), el('div', { class: 'small muted' }, 'seniority')))));
  const done = btn('File the report', 'primary', () => {
    const { notes } = applyReport(S, R);
    cb.persist();
    if (notes.length) modal({ title: 'At the depot', body: el('div', {}, notes.map(n => el('p', {}, n))), buttons: [{ label: 'Onward', value: true, kind: 'primary' }], dismiss: true }).then(() => cb.onDone());
    else cb.onDone();
  });
  done.style.width = '100%'; done.style.marginTop = '14px';
  wrap.append(done);
}
