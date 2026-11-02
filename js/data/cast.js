// LIFT — the inspector's world: cast, thieves, techniques, missions, progression
// The player is Mr. Ambrose Tull, thirty years a ticket inspector on the Meridian lines.

export const HERO = {
  name: 'Mr. Ambrose Tull',
  title: 'Ticket Inspector',
  line: 'Thirty years on the Meridian lines. He has watched every trick in the book—and learnt them all.',
};

// ---------------------------------------------------------------- uniforms (THE COVER)
// trust: how much passengers notice odd behaviour (lower = more trusted)
// wary: how quickly thieves grow alert near you (lower = they don't clock you)
// belongs: carriage classes where you have a legitimate reason to be
// duties: legitimate actions available
export const UNIFORMS = {
  inspector: {
    name: 'Ticket Inspector', desc: 'Claret coat, brass buttons, a punch on a chain. Everyone hands you their ticket; thieves keep half an eye on you.',
    coat: '#5a1823', trim: '#e0bf6e', legs: '#1a1a1f', hat: 'peaked',
    trust: 1, wary: 1, belongs: ['third', 'second', 'common', 'first', 'baggage'], duties: ['tickets'],
  },
  steward: {
    name: 'Dining Steward', desc: 'A white mess jacket. You can wander any table offering refreshments, and nobody wonders why you lean close.',
    coat: '#efe6d4', trim: '#1a1512', legs: '#1a1a1f', hat: null,
    trust: 0.8, wary: 0.8, belongs: ['third', 'second', 'common', 'first'], duties: ['refresh'], req: 'uni_steward',
  },
  attendant: {
    name: 'Sleeping-Car Attendant', desc: 'Navy and brass. You turn down berths in the sleepers and hold the keys to every compartment.',
    coat: '#1e2a44', trim: '#c9a24a', legs: '#14182a', hat: 'pillbox',
    trust: 0.9, wary: 0.9, belongs: ['second', 'common', 'first', 'sleeper', 'baggage'], duties: ['tickets'], keys: true, req: 'uni_attendant',
  },
  chief: {
    name: 'Chief Inspector', desc: 'Gold braid on the cuffs. First class defers to you and the State Salon admits you.',
    coat: '#3a0f17', trim: '#f2d27a', legs: '#111116', hat: 'peaked',
    trust: 0.7, wary: 1.15, belongs: ['third', 'second', 'common', 'first', 'sleeper', 'baggage', 'vault'], duties: ['tickets'], keys: true, req: 'uni_chief',
  },
  plain: {
    name: 'Off-Duty Tweeds', desc: 'Just another passenger. Thieves never look twice at you—but you have no duties to hide behind.',
    coat: '#6b5a44', trim: '#3a2e22', legs: '#3a3026', hat: 'bowler',
    trust: 1.25, wary: 0.4, belongs: ['third', 'second', 'common'], duties: [], req: 'uni_plain',
  },
};

// ---------------------------------------------------------------- theft techniques
export const TECHNIQUES = {
  bump: {
    name: 'The Bump-and-Lift', short: 'Bump', desc: 'A brush in the aisle, an apology, and a lighter coat.',
    tell: 'Walks the aisle more than anyone needs to, and always passes close.',
    eye: [2, 4], strike: 0.9, pockets: ['hip', 'breast'], thiefSay: ['Beg pardon!', 'Mind yourself, guv!', 'So sorry—the lurch!'],
  },
  distraction: {
    name: 'The Distraction', short: 'Distraction', desc: 'A question, a dropped glove, a map unfolded—while the other hand works.',
    tell: 'Strikes up conversations with strangers who are carrying something good.',
    eye: [2, 3.5], strike: 2.4, pockets: ['breast', 'waist'], thiefSay: ['Pardon me—is this the train for Westmarch?', 'Could you possibly read this timetable for me?', 'I believe you dropped a glove, madam.'],
  },
  seated: {
    name: 'The Seated Lift', short: 'Seated', desc: 'A seat beside the mark, a newspaper across both laps.',
    tell: 'Changes seats for no reason and always reads with the paper held low.',
    eye: [4, 7], strike: 2, pockets: ['breast', 'hip'], thiefSay: ['Is this seat taken?'],
  },
  overhead: {
    name: 'The Overhead Luggage', short: 'Overhead', desc: 'Wrestling a case onto the rack, arms high—and one hand low.',
    tell: 'Fusses with luggage on racks that aren’t theirs.',
    eye: [2, 4], strike: 1.8, pockets: ['handbag', 'hip'], thiefSay: ['Would you mind awfully—this case is so heavy.', 'Oof! Nearly had your hat, sir.'],
  },
  confidence: {
    name: 'The Confidence Trick', short: 'Confidence', desc: 'Charm, a long story, a handshake that lasts a moment too long.',
    tell: 'Befriends wealthy passengers with remarkable speed.',
    eye: [5, 8], strike: 3, pockets: ['breast', 'waist'], thiefSay: ['Did I ever tell you about Rangoon?', 'Splendid to meet a fellow traveller!', 'Allow me—Captain Mallory, late of the Hussars.'],
  },
  crowd: {
    name: 'The Crowded-Carriage Lift', short: 'Crowd', desc: 'Where people stand shoulder to shoulder, nobody notices one more shoulder.',
    tell: 'Drifts toward wherever people are standing close.',
    eye: [2, 3], strike: 1.1, pockets: ['hip', 'waist'], thiefSay: ['Squeeze past, sorry!', 'Crowded tonight, eh?'],
  },
};

// ---------------------------------------------------------------- the rogues' gallery (recurring thieves)
// look: overrides on top of a generated look so a face is recognisable run after run
export const ROGUES = {
  weasel: {
    name: 'Silas Crook', alias: 'The Weasel', arch: 'worker', female: false, tech: 'bump', strikes: 3,
    look: { hat: 'flatcap', scarf: '#8a3a1a', coat: '#5b4a3a', beard: 'stubble', hair: '#7a5230' },
    bio: 'Quick as a draught through a gangway. Works the bump-and-lift in crowded third-class aisles.', rank: 0,
  },
  dolly: {
    name: 'Dolly Pike', alias: 'Overhead Dolly', arch: 'worker', female: true, tech: 'overhead', strikes: 2,
    look: { hat: 'headscarf', coat: '#7a5a4a', hair: '#8a3a1a' },
    bio: 'Forever wrestling her hatbox onto the rack. Your pockets are directly underneath it.', rank: 0,
  },
  vicar: {
    name: 'The Rev. Percival Lamb', alias: 'The Vicar', arch: 'merchant', female: false, tech: 'distraction', strikes: 2,
    look: { coat: '#1a1a1f', trim: '#f4e9d3', hat: 'homburg', glasses: 'spectacles', hair: '#dcdcdc', beard: null },
    bio: 'Asks the way to the chapel car. There is no chapel car. There is no Reverend Lamb.', rank: 1,
  },
  ned: {
    name: 'Ned Gale', alias: 'Gale the Elder', arch: 'worker', female: false, tech: 'bump', crew: 'gales', role: 'dipper', strikes: 3,
    look: { hat: 'flatcap', coat: '#3f4a52', beard: 'mustache', hair: '#2a1c14' },
    bio: 'The hands of the Gale brothers. Never keeps a thing for longer than it takes to pass it on.', rank: 1,
  },
  alfie: {
    name: 'Alfie Gale', alias: 'Gale the Younger', arch: 'worker', female: false, tech: 'bump', crew: 'gales', role: 'runner', strikes: 0,
    look: { hat: 'flatcap', coat: '#3f4a52', beard: null, hair: '#2a1c14', build: 0.92 },
    bio: 'Takes the goods from his brother and walks them three carriages away, whistling.', rank: 1,
  },
  odile: {
    name: 'Mme. Odile Fauré', alias: 'Madame Silk', arch: 'socialite', female: true, tech: 'seated', strikes: 2,
    look: { scarf: '#f4e9d3', hat: 'cloche', coat: '#3a5a6e', jewel: 'pearls' },
    bio: 'Sits beside her marks with a fur stole across both laps. What happens under the fur stays under the fur.', rank: 2,
  },
  mallory: {
    name: 'Captain Rupert Mallory', alias: 'The Captain', arch: 'aristocrat', female: false, tech: 'confidence', strikes: 2,
    look: { hat: 'homburg', beard: 'mutton', coat: '#26324a', trim: '#c9a24a', glasses: 'monocle' },
    bio: 'War hero, raconteur and the finest confidence man on the line. His stories are long; his fingers are longer.', rank: 2,
  },
  ma: {
    name: 'Ma Bellamy', alias: 'The Matriarch', arch: 'family', female: true, tech: 'distraction', crew: 'bellamy', role: 'blocker', strikes: 0,
    look: { hat: 'cloche', coat: '#5a6e5a', hair: '#b0b0b0' },
    bio: 'Head of the Bellamy family business. Drops a hatbox, faints, weeps—whatever the job needs.', rank: 3,
  },
  kit: {
    name: 'Kit Bellamy', alias: 'The Quiet One', arch: 'worker', female: true, tech: 'crowd', crew: 'bellamy', role: 'dipper', strikes: 3,
    look: { hat: null, coat: '#4f5f6f', hair: '#4a3020' },
    bio: 'Never speaks, never hurries, never misses.', rank: 3,
  },
  joe: {
    name: 'Joe Bellamy', alias: 'The Porter Who Isn’t', arch: 'worker', female: false, tech: 'bump', crew: 'bellamy', role: 'runner', strikes: 0,
    look: { hat: 'pillbox', coat: '#3a3f5c', trim: '#c9a24a' },
    bio: 'Wears a porter’s cap he never earned. Carries the Bellamys’ takings off the train.', rank: 3,
  },
  hawthorne: {
    name: 'Lord Julian Hawthorne', alias: 'The Gentleman', arch: 'aristocrat', female: false, tech: 'seated', strikes: 3,
    look: { hat: 'top', coat: '#16161c', trim: '#f4e9d3', beard: 'mustache', glasses: null },
    bio: 'A peer of the realm with a box at the opera and a hand in half the thefts on the Continental. Untouchable—unless someone proves it.', rank: 4,
  },
};
export const ANON_FIRST = ['Bert', 'Harry', 'Len', 'Sid', 'Walt', 'Vi', 'Peg', 'Lil', 'Cyril', 'Mavis', 'Reg', 'Edna'];
export const ANON_LAST = ['Sharpe', 'Flitt', 'Nimms', 'Cutler', 'Slade', 'Prigg', 'Dodd', 'Fagg', 'Lightfoot', 'Swann'];

// ---------------------------------------------------------------- ranks (seniority)
export const RANKS = [
  { xp: 0, name: 'Ticket Inspector' },
  { xp: 120, name: 'Senior Inspector' },
  { xp: 360, name: 'Travelling Inspector' },
  { xp: 800, name: 'Chief Inspector' },
  { xp: 1600, name: 'Inspector of the Line' },
];
export function rankOf(xp) { let r = 0; RANKS.forEach((k, i) => { if (xp >= k.xp) r = i; }); return r; }

// Routes reuse the train definitions; rank gates them
export const ROUTE_RANK = { local: 0, regional: 1, night: 2, international: 3, royal: 4 };
export const ROUTE_TAGLINE = {
  local: 'Crowded benches and market-day pockets. Where you learnt the trade.',
  regional: 'Velvet seats, silver service, and silk-lined pockets worth emptying.',
  night: 'Lamps low and berths full. Thieves love a sleeping carriage.',
  international: 'Diplomats, dowagers and the cleverest crews on the Continent.',
  royal: 'The Sovereign. One gentleman thief has been robbing it blind for years.',
};

// ---------------------------------------------------------------- progression trees
// cost: { merits, favours }; rank: seniority needed
export const TREES = {
  craft: { name: 'The Craft', desc: 'Your hands and your eyes.' },
  cover: { name: 'The Cover', desc: 'Your standing on the railway.' },
  network: { name: 'The Network', desc: 'Friends who tell you things.' },
};
export const SKILLS = [
  // THE CRAFT
  { id: 'hand_steady', tree: 'craft', name: 'Steady Hands', desc: 'Pocket mouths feel wider and the lining forgives a brush.', effect: 'Easier lifts and plants.', cost: { merits: 40 } },
  { id: 'craft_eye', tree: 'craft', name: 'Keen Eye', desc: 'You read a passenger in a heartbeat.', effect: 'Observing takes half the time.', cost: { merits: 50 } },
  { id: 'craft_satchel', tree: 'craft', name: 'Deep Pockets', desc: 'A lost-property satchel with room to spare.', effect: 'Carry 4 recovered items (from 2).', cost: { merits: 45 } },
  { id: 'craft_glance', tree: 'craft', name: 'Reader of Glances', desc: 'You see where a thief is looking before he knows himself.', effect: 'Thieves sizing up a mark show a faint eye-line.', cost: { merits: 90 }, req: ['craft_eye'] },
  { id: 'intel_lining', tree: 'craft', name: 'Lining Sense', desc: 'You know where people hide things.', effect: 'Pat-downs hint at the right pocket.', cost: { merits: 70 }, req: ['hand_steady'] },
  { id: 'craft_feather', tree: 'craft', name: 'Featherlight Return', desc: 'Putting things back is the hardest trick of all.', effect: 'Discreet returns start calmer and forgive more.', cost: { merits: 80 }, req: ['hand_steady'] },
  { id: 'craft_practised', tree: 'craft', name: 'Practised Eye', desc: 'Thirty years of watching. Nothing in your carriage escapes you.', effect: 'Witness thefts from much further away; handoffs are always clear.', cost: { merits: 140 }, req: ['craft_glance'] },
  { id: 'craft_lining', tree: 'craft', name: 'Lined Coat', desc: 'A hidden pocket the Superintendent has never found.', effect: 'Recovered items survive a reprimand.', cost: { merits: 110 }, req: ['craft_satchel'] },
  // THE COVER
  { id: 'cover_punch', tree: 'cover', name: 'Brass Ticket Punch', desc: 'Click-clack. Nobody looks twice at a man doing his job briskly.', effect: 'Ticket checks are quicker and calm suspicion more.', cost: { merits: 50 } },
  { id: 'uni_steward', tree: 'cover', name: 'Steward’s Jacket', desc: 'Borrowed from the dining car. Lean over any table with a tray.', effect: 'New uniform: offer refreshments anywhere, passengers trust you.', cost: { merits: 70 }, rank: 1 },
  { id: 'uni_attendant', tree: 'cover', name: 'Attendant’s Livery', desc: 'Navy, brass, and the keys to the sleepers.', effect: 'New uniform: belongs in sleeping cars, opens compartments.', cost: { merits: 110 }, rank: 2 },
  { id: 'uni_plain', tree: 'cover', name: 'Off-Duty Tweeds', desc: 'Ride as a passenger. Thieves won’t clock you, but you’ve no duties to hide behind.', effect: 'New uniform: thieves barely notice you; no ticket checks.', cost: { merits: 120 }, rank: 2 },
  { id: 'cover_keys', tree: 'cover', name: 'Master Key', desc: 'One key for every compartment and trunk on the line.', effect: 'Open locked compartments and luggage without picking.', cost: { merits: 130 }, rank: 2 },
  { id: 'uni_chief', tree: 'cover', name: 'Chief Inspector’s Coat', desc: 'Gold braid. First class stands aside for you.', effect: 'New uniform: most trusted; admitted to the State Salon.', cost: { merits: 220 }, rank: 3 },
  // THE NETWORK
  { id: 'net_porter', tree: 'network', name: 'A Friendly Porter', desc: 'Old Sam on the barrow knows every face on the platform.', effect: 'An informant rides each train: ask for one tip.', cost: { favours: 4 } },
  { id: 'net_gossip', tree: 'network', name: 'Gossiping Regulars', desc: 'Your regulars describe thieves properly.', effect: 'Victim descriptions point only at the real thief.', cost: { favours: 6 } },
  { id: 'net_gallery', tree: 'network', name: 'The Rogues’ Gallery', desc: 'Photographs from the railway police, pinned up in the guard’s van.', effect: 'Thieves you’ve profiled before are recognised on sight.', cost: { favours: 8 }, req: ['net_porter'] },
  { id: 'net_whistle', tree: 'network', name: 'Porter’s Whistle', desc: 'One shrill blast and every head turns to the window.', effect: 'Once per trip: the whole carriage looks away for 10s.', cost: { favours: 6 } },
  { id: 'net_constable', tree: 'network', name: 'Station Constables', desc: 'A word at the platform and a thief is met by the law.', effect: 'Identified thieves you’ve emptied are arrested at the next station.', cost: { favours: 12 }, req: ['net_gossip'] },
  { id: 'net_manifest', tree: 'network', name: 'Passenger Manifests', desc: 'The booking clerk owes you a favour.', effect: 'Irregular tickets are flagged as passengers board.', cost: { favours: 10 }, req: ['net_porter'] },
];

// ---------------------------------------------------------------- memoirs (backstory)
export const MEMOIRS = [
  { id: 'm0', when: 'always', title: '1901 — The Millbrook Local', text: 'My first week with a punch. A man in a good coat bumped a farmer’s wife at Ashby and was gone with her purse before the doors closed. Nobody saw it but me. I didn’t know what I’d seen until it was too late. I decided it would never be too late again.' },
  { id: 'm1', when: 'firstReturn', title: 'Old Fingers', text: 'Pickpockets learn from pickpockets. I learnt from all of them, watching from the end of the carriage. A dip’s hand is a lovely thing. Mine are lovelier, and they put things back.' },
  { id: 'm2', when: 'rank1', title: 'The Rule', text: 'Never accuse. A ticket inspector who shouts “thief” starts a panic and loses his post. Better the watch simply comes home, and the thief spends the rest of his life wondering.' },
  { id: 'm3', when: 'firstCrew', title: 'The Gales', text: 'Brothers. One dips, one walks. For years I chased the wrong one. The trick is to watch the hands, not the faces—and to watch who meets whom in the gangway.' },
  { id: 'm4', when: 'rank2', title: 'Margaret', text: 'My wife thought I spent my days punching tickets. When she died, I found she’d kept every thank-you note passengers ever sent the depot. Two hundred and eleven of them. She knew.' },
  { id: 'm5', when: 'rank3', title: 'A Proper Coat', text: 'They gave me the braid this year. Chief Inspector. The young ones salute. The old dips on the Local tip their caps, and I tip mine back. We understand each other.' },
  { id: 'm6', when: 'rank4', title: 'The Gentleman', text: 'There’s a lord on the Continental who has never been caught because nobody would dream of looking in his pockets. I would. I’ve been dreaming of it for twenty years.' },
  { id: 'm7', when: 'hawthorne', title: 'Case Closed', text: 'His Lordship’s own cufflinks were in my satchel by Kronstadt. The Clarion ran the story. I punched his ticket on the way out. Thirty years, and that was the best click of them all.' },
];

// ---------------------------------------------------------------- missions
// Every mission sets up a cast; objectives are evaluated by the run.
// vip: a named passenger carrying a named item that WILL be targeted.
export const MISSIONS = [
  {
    id: 'hunter', title: 'The Ashcombe Hunter', rank: 0, routes: ['local', 'regional'],
    brief: 'Lady Ashcombe is travelling with her late husband’s gold hunter watch. Word on the platform is that the Weasel has heard about it too.',
    vip: { arch: 'aristocrat', female: true, name: 'Lady Cordelia Ashcombe', item: { cat: 'watch', rarity: 'rare', name: 'The Ashcombe Hunter', value: 180, desc: 'An 18-carat hunter, the lid engraved “To C., for every hour.”' } },
    thieves: [{ rogue: 'weasel', firstTarget: 'vip' }],
    goals: [{ type: 'returnVip', text: 'Return the Ashcombe Hunter to Lady Ashcombe' }],
    optional: [{ type: 'vipUnaware', text: 'Before she notices it’s gone' }, { type: 'noFalse', text: 'No false lifts' }],
  },
  {
    id: 'draught', title: 'A Draught in the Aisles', rank: 0, routes: ['local', 'regional'],
    brief: 'Passengers keep reaching Kingsgate lighter than they left. Someone is working the aisles. Find them, and put everything back.',
    thieves: [{ rogue: 'dolly' }, { anon: true, tech: 'bump', strikes: 1 }],
    goals: [{ type: 'returnN', n: 2, text: 'Return 2 stolen belongings' }],
    optional: [{ type: 'identifyAll', text: 'Identify every thief aboard' }, { type: 'tickets', n: 8, text: 'Check 8 tickets' }],
  },
  {
    id: 'vicar', title: 'The Chapel Car', rank: 1, routes: ['local', 'regional', 'night'],
    brief: 'A clergyman keeps asking passengers the way to a chapel car. There is no chapel car. Keep an eye on the faithful.',
    thieves: [{ rogue: 'vicar' }, { anon: true, tech: 'overhead', strikes: 1 }],
    goals: [{ type: 'returnBefore', n: 1, leg: 2, text: 'Return a stolen item before the second station' }, { type: 'identifyRogue', rogue: 'vicar', text: 'Identify the Vicar' }],
    optional: [{ type: 'unawareAll', text: 'Every return made before the owner notices' }, { type: 'coverHigh', text: 'Never fall under scrutiny' }],
  },
  {
    id: 'gales', title: 'Brothers in Arms', rank: 1, routes: ['local', 'regional', 'night'],
    brief: 'The Gale brothers are aboard. Ned dips; Alfie carries. Catch the handoff, recover the takings, and identify both.',
    thieves: [{ rogue: 'ned' }, { rogue: 'alfie' }],
    goals: [{ type: 'returnN', n: 2, text: 'Return 2 stolen belongings' }, { type: 'identifyCrew', crew: 'gales', text: 'Identify both Gale brothers' }],
    optional: [{ type: 'noEscape', text: 'Nothing leaves the train in a thief’s pocket' }, { type: 'noFalse', text: 'No false lifts' }],
  },
  {
    id: 'silk', title: 'Under the Fur', rank: 2, routes: ['regional', 'night', 'international'],
    brief: 'The Hon. Mrs. Pemberton boards with her mother’s sapphire bracelet. Madame Silk has bought the seat across the aisle.',
    vip: { arch: 'socialite', female: true, name: 'The Hon. Mrs. Imogen Pemberton', item: { cat: 'bracelet', rarity: 'exceptional', name: 'The Pemberton Sapphires', value: 520, desc: 'Five cornflower sapphires on a platinum line, a wedding gift three generations old.' } },
    thieves: [{ rogue: 'odile', firstTarget: 'vip' }, { anon: true, tech: 'crowd', strikes: 1 }],
    goals: [{ type: 'returnVip', text: 'Return the Pemberton Sapphires' }, { type: 'identifyRogue', rogue: 'odile', text: 'Identify Madame Silk' }],
    optional: [{ type: 'vipUnaware', text: 'Before Mrs. Pemberton notices' }, { type: 'coverHigh', text: 'Never fall under scrutiny' }],
  },
  {
    id: 'captain', title: 'The Captain’s Stories', rank: 2, routes: ['regional', 'night', 'international'],
    brief: 'A war hero is buying drinks and telling stories in the lounge. His audience keeps losing their valuables.',
    thieves: [{ rogue: 'mallory' }, { anon: true, tech: 'seated', strikes: 1 }],
    goals: [{ type: 'returnN', n: 3, text: 'Return 3 stolen belongings' }, { type: 'identifyRogue', rogue: 'mallory', text: 'Identify the Captain' }],
    optional: [{ type: 'noEscape', text: 'Nothing leaves the train in a thief’s pocket' }, { type: 'tickets', n: 10, text: 'Check 10 tickets' }],
  },
  {
    id: 'bellamy', title: 'The Family Business', rank: 3, routes: ['night', 'international', 'regional'],
    brief: 'The Bellamys work as a family: Ma makes a scene, Kit dips, Joe carries. Stop the whole operation.',
    thieves: [{ rogue: 'ma' }, { rogue: 'kit' }, { rogue: 'joe' }],
    goals: [{ type: 'returnN', n: 3, text: 'Return 3 stolen belongings' }, { type: 'identifyCrew', crew: 'bellamy', text: 'Identify all three Bellamys' }],
    optional: [{ type: 'noEscape', text: 'Nothing leaves the train in a thief’s pocket' }, { type: 'unawareAll', text: 'Every return made before the owner notices' }],
  },
  {
    id: 'gentleman', title: 'The Gentleman', rank: 4, routes: ['international', 'royal'],
    brief: 'Lord Hawthorne rides tonight, and so does the Archduchess’s emerald brooch. Prove what everyone suspects—without a whisper of scandal.',
    vip: { arch: 'royal', female: true, name: 'The Archduchess Theodora', item: { cat: 'accessory', rarity: 'legendary', name: 'The Kronstadt Emerald', value: 2400, desc: 'An emerald the size of a quail’s egg, set as a brooch for a coronation that never happened.' } },
    thieves: [{ rogue: 'hawthorne', firstTarget: 'vip' }, { anon: true, tech: 'bump', strikes: 2 }],
    goals: [{ type: 'returnVip', text: 'Return the Kronstadt Emerald' }, { type: 'identifyRogue', rogue: 'hawthorne', text: 'Identify Lord Hawthorne' }],
    optional: [{ type: 'vipUnaware', text: 'Before the Archduchess notices' }, { type: 'coverHigh', text: 'Never fall under scrutiny' }],
  },
];
// Repeatable patrols, available on any route at any rank
export const PATROL = {
  id: 'patrol', title: 'Routine Patrol', rank: 0, routes: ['local', 'regional', 'night', 'international', 'royal'], patrol: true,
  brief: 'An ordinary shift. There’s always someone working a train. Return what you can.',
  goals: [{ type: 'returnN', n: 2, text: 'Return 2 stolen belongings' }],
  optional: [{ type: 'unawareAll', text: 'Every return made before the owner notices' }, { type: 'noFalse', text: 'No false lifts' }],
};

export const SUSPICION_LEVELS = ['Unremarkable', 'Noticed', 'Talked about', 'Under scrutiny'];

// Notes the inspector writes when he studies someone innocent who is behaving oddly (red herrings)
export const ODDITIES = [
  'Keeps patting his breast pocket, nervously.',
  'Glances up and down the carriage every few seconds.',
  'Changed seats twice since the last station.',
  'Holds a newspaper upside down, apparently lost in thought.',
  'Carries far more cash than the ticket suggests.',
  'Watches the other passengers’ luggage with great interest.',
];
export const PLAIN_NOTES = ['Nothing out of the ordinary.', 'An honest face, as far as faces go.', 'Absorbed in their own affairs.', 'Simply travelling.'];
