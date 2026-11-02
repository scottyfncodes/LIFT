// LIFT — content database
export const PAL = {
  burgundy: '#6e1f2b', burgundyDk: '#4a121b', burgundyLt: '#8e3140',
  amber: '#f2b45a', amberLt: '#ffd793', brass: '#c9a24a', brassDk: '#8a6a24', brassLt: '#e8cf86',
  wood: '#5a3520', woodDk: '#3a2114', woodLt: '#7d4d2e',
  emerald: '#1f5e4a', emeraldDk: '#123d30', emeraldLt: '#2f7f64',
  cream: '#f4e9d3', parchment: '#e8d8b4', ink: '#2a1c14', navy: '#1e2a44', soot: '#1a1512',
};

export const RARITY = {
  common: { name: 'Common', color: '#8b7e6a', mult: 1, w: 60 },
  uncommon: { name: 'Uncommon', color: '#3f7a5c', mult: 2.6, w: 26 },
  rare: { name: 'Rare', color: '#2f5c8f', mult: 7, w: 10 },
  exceptional: { name: 'Exceptional', color: '#7b3f8f', mult: 20, w: 3.2 },
  legendary: { name: 'Legendary', color: '#b8861b', mult: 70, w: 0.6 },
};
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'exceptional', 'legendary'];

// technique: dip | timing | trace | twist | search | lock
export const CATEGORIES = {
  watch: { name: 'Pocket Watches', single: 'Pocket Watch', tech: 'timing', base: 14 },
  wristwatch: { name: 'Wristwatches', single: 'Wristwatch', tech: 'timing', base: 16, hard: 1 },
  ring: { name: 'Rings', single: 'Ring', tech: 'twist', base: 18 },
  necklace: { name: 'Necklaces', single: 'Necklace', tech: 'trace', base: 20 },
  bracelet: { name: 'Bracelets', single: 'Bracelet', tech: 'trace', base: 14 },
  coin: { name: 'Coins', single: 'Coin', tech: 'dip', base: 8 },
  cigcase: { name: 'Cigarette Cases', single: 'Cigarette Case', tech: 'dip', base: 12 },
  lighter: { name: 'Lighters', single: 'Lighter', tech: 'dip', base: 8 },
  compass: { name: 'Compasses', single: 'Compass', tech: 'dip', base: 12 },
  book: { name: 'Rare Books', single: 'Rare Book', tech: 'lock', base: 22 },
  letter: { name: 'Letters', single: 'Letter', tech: 'search', base: 6, intel: 2 },
  document: { name: 'Documents', single: 'Document', tech: 'search', base: 10, intel: 4 },
  art: { name: 'Artwork', single: 'Artwork', tech: 'lock', base: 40 },
  antique: { name: 'Antiques', single: 'Antique', tech: 'lock', base: 26 },
  heirloom: { name: 'Family Heirlooms', single: 'Heirloom', tech: 'dip', base: 6 },
  accessory: { name: 'Luxury Accessories', single: 'Accessory', tech: 'dip', base: 10 },
};

export const TECH_INFO = {
  dip: { name: 'The Dip', hint: 'Slide in slowly. Don’t brush the lining. Freeze when they stir.' },
  timing: { name: 'The Unhook', hint: 'Tap as the watch swings through the gold arc.' },
  trace: { name: 'The Draw', hint: 'Hold the clasp and follow the chain. Slow and steady.' },
  twist: { name: 'The Twist', hint: 'Circle the ring only while the hand is relaxed.' },
  search: { name: 'The Pat-Down', hint: 'Pat the coat lightly to feel for paper, then dip.' },
  lock: { name: 'The Pick', hint: 'Find the binding pin. Release at the shear line.' },
};

const MAKERS = ['Harrowgate & Sons', 'Vellacourt', 'Ostrander', 'Maison Bellerose', 'Kessler Bros.', 'Pemberton', 'Albrecht', 'Duvalier', 'Whitcombe', 'Corvino'];
const MATERIALS = {
  common: ['brass', 'pewter', 'nickel', 'gunmetal', 'enamelled tin'],
  uncommon: ['sterling silver', 'silver-gilt', 'tortoiseshell & silver', 'engraved silver'],
  rare: ['18-carat gold', 'rose gold', 'gold & onyx', 'gold & enamel'],
  exceptional: ['platinum', 'gold & sapphire', 'platinum & emerald', 'gold & ruby'],
  legendary: ['platinum & diamond'],
};
const NOUNS = {
  watch: ['Hunter Pocket Watch', 'Half-Hunter', 'Railway Regulator', 'Repeater Watch', 'Open-Face Watch'],
  wristwatch: ['Trench Wristwatch', 'Tank Wristwatch', 'Aviator’s Wristwatch', 'Cocktail Watch'],
  ring: ['Signet Ring', 'Cocktail Ring', 'Mourning Ring', 'Wedding Band', 'Seal Ring'],
  necklace: ['Pearl Strand', 'Pendant Necklace', 'Lavalier', 'Sautoir', 'Locket Chain'],
  bracelet: ['Bangle', 'Tennis Bracelet', 'Charm Bracelet', 'Cuff'],
  coin: ['Republic Penny', 'Founders’ Crown', 'Assembly Shilling', 'Liberty Sovereign', 'Revolution Thaler'],
  cigcase: ['Cigarette Case', 'Cheroot Case', 'Vesta Case'],
  lighter: ['Trench Lighter', 'Table Lighter', 'Petrol Lighter', 'Pocket Lighter'],
  compass: ['Surveyor’s Compass', 'Pocket Compass', 'Marching Compass', 'Sundial Compass'],
  book: ['First Edition', 'Illuminated Psalter', 'Atlas Folio', 'Signed Novel'],
  letter: ['Love Letter', 'Letter of Credit', 'Private Correspondence', 'Telegram'],
  document: ['Shipping Manifest', 'Share Certificate', 'Board Minutes', 'Bank Draft', 'Survey Report'],
  art: ['Miniature Portrait', 'Ink Study', 'Deco Bronze', 'Pastoral Oil Sketch'],
  antique: ['Snuff Box', 'Carriage Clock', 'Jade Netsuke', 'Ormolu Inkwell'],
  heirloom: ['Locket', 'Christening Spoon', 'Grandfather’s Medal', 'Wedding Brooch'],
  accessory: ['Cufflinks', 'Fountain Pen', 'Opera Glasses', 'Powder Compact', 'Tie Pin', 'Money Clip'],
};
export const GEN = { MAKERS, MATERIALS, NOUNS };

export const HISTORY = {
  watch: ['Railway time made men slaves to the minute; this one kept its owner punctual to the second.', 'Engraved inside the case: “For twenty-five years of loyal service.” Whose service, it does not say.', 'The movement was finished by hand in a workshop that closed when the Consortium bought the street.'],
  wristwatch: ['A soldier’s fashion turned a gentleman’s affectation.', 'The strap still smells of cologne and engine oil.'],
  ring: ['Rings like this sealed contracts that emptied whole valleys.', 'Worn smooth on the inside by a lifetime of nervous turning.', 'The crest belongs to a family that bought its title in the boom years.'],
  necklace: ['Each pearl was dived for by someone who never saw the ballroom it ended up in.', 'Commissioned for a debut season and worn exactly once.'],
  bracelet: ['A gift meant to apologise for something unforgivable.', 'It clicks softly, like a held breath.'],
  coin: ['Struck in the brief years of the Old Republic, before the banks rewrote the currency.', 'Collectors pay absurd sums for a coin that once bought bread.'],
  cigcase: ['Inside the lid: a scratched tally of card debts.', 'Monogrammed, then hastily re-monogrammed.'],
  lighter: ['Carried through the war and never once lit in anger.', 'The flint is new. The dents are old.'],
  compass: ['The needle is true, even when its owner wasn’t.', 'Surveyed the line that displaced half a county.'],
  book: ['Printed before the censors, bound in calfskin, and never read.', 'The margins are full of someone else’s furious notes.'],
  letter: ['Sealed with wax and secrets.', 'Written in a hurry, by someone afraid of being overheard.'],
  document: ['Paperwork is how the powerful commit crimes politely.', 'Numbers that, read correctly, describe a scandal.'],
  art: ['Painted in a garret, sold in a gallery, now stolen in a sleeper car.', 'The artist died poor; the painting did not.'],
  antique: ['Older than the railway, older than the bank that owns it.', 'It has outlived four owners. It will outlive this one.'],
  heirloom: ['Worth little to a fence. Worth everything to a family.', 'Handed down, mended twice, and loved past all reason.'],
  accessory: ['A small extravagance, as natural to its owner as breathing.', 'Bought on a whim with money from a mill that never stopped running.'],
};

// Named collection sets
export const SETS = {
  horology: { name: 'The Harrowgate Horology', desc: 'Three timepieces by Harrowgate & Sons.', need: 3, match: it => (it.cat === 'watch' || it.cat === 'wristwatch') && it.maker === 'Harrowgate & Sons', reward: 'Timing windows permanently widened by a hair.', bonus: 'horology' },
  republic: { name: 'Coins of the Old Republic', desc: 'One of each of the five Republic coins.', need: 5, match: it => it.cat === 'coin', distinctKey: it => it.noun, reward: 'Fences respect a numismatist: +10% sale prices.', bonus: 'republic' },
  signets: { name: 'The Barons’ Signets', desc: 'Signet rings of the Crane, Mortlake, Vane and Ashgrove families.', need: 4, match: it => it.crest, distinctKey: it => it.crest, reward: 'Pressed into wax, these seals forge any invitation. The Sovereign line opens.', bonus: 'signets' },
  consortium: { name: 'The Consortium Papers', desc: 'Four documents that prove the Meridian Compact exists.', need: 4, match: it => it.consortium, distinctKey: it => it.consortium, reward: 'The full shape of the conspiracy. The Sovereign line opens and the press owes you.', bonus: 'consortium' },
  season: { name: 'A Socialite’s Season', desc: 'Necklace, bracelet, compact and cigarette case lifted from society ladies.', need: 4, match: it => it.socialite && ['necklace', 'bracelet', 'accessory', 'cigcase'].includes(it.cat), distinctKey: it => it.cat, reward: 'Tailors fall over themselves: Evening Wear is half price, and society trusts you a little more.', bonus: 'season' },
  expedition: { name: 'The Saint-Clair Expedition', desc: 'Compass, lighter and journal of the lost polar explorer.', need: 3, match: it => it.expedition, distinctKey: it => it.cat, reward: 'Saint-Clair’s notes on rolling stock: hidden compartments are revealed on every train.', bonus: 'expedition' },
};

export const CRESTS = { crane: 'Crane', mortlake: 'Mortlake', vane: 'Vane', ashgrove: 'Ashgrove' };
export const CONSORTIUM_DOCS = [
  { key: 'memo', name: 'The Meridian Memorandum', desc: 'A typed memo proposing that “the management of the populace be entrusted to its natural administrators.” Signed with four initials.' },
  { key: 'prospectus', name: 'Water Works Prospectus', desc: 'A plan to buy the municipal reservoirs and triple the rates. The margin note reads: “They’ll pay. They’re thirsty.”' },
  { key: 'ledger', name: 'The Strikebreakers’ Ledger', desc: 'Payments to hired men, itemised by mill. Beside one entry: “Ensure the Hartley matter is closed.”' },
  { key: 'promissory', name: 'Minister’s Promissory Note', desc: 'A government minister pledges his vote in exchange for railway shares. In his own handwriting.' },
];

// Handcrafted legendary & exceptional uniques
export const UNIQUES = [
  { id: 'meridian_chrono', name: 'The Meridian Chronometer', cat: 'watch', rarity: 'legendary', value: 4200, maker: 'Harrowgate & Sons', owner: 'Baron Aldous Crane', desc: 'A grand-complication chronometer said to keep Consortium time—set eleven seconds ahead of everyone else.', trains: ['international', 'royal'] },
  { id: 'vane_sapphires', name: 'The Vane Sapphires', cat: 'necklace', rarity: 'legendary', value: 5200, owner: 'Lady Ottoline Vane', desc: 'Seven cornflower sapphires. Their mine was flooded to break a strike.', socialite: true, trains: ['international', 'royal'] },
  { id: 'blue_duchess', name: 'The Blue Duchess', cat: 'ring', rarity: 'legendary', value: 6000, owner: 'The Dowager of Kestrelmoor', desc: 'A diamond so blue it was once mistaken for ice in a glass of gin.', trains: ['royal'] },
  { id: 'iron_republic', name: 'First Edition: “The Iron Republic”', cat: 'book', rarity: 'exceptional', value: 900, owner: 'Professor Ambrose Thale', desc: 'The banned novel that predicted the Consortium. Only forty copies escaped the pulping.', trains: ['regional', 'night', 'international'] },
  { id: 'stclair_compass', name: 'Saint-Clair’s Compass', cat: 'compass', rarity: 'exceptional', value: 700, expedition: true, owner: 'A collector of polar curios', desc: 'Recovered from the ice beside a tent and a final, unfinished letter.', trains: ['regional', 'night', 'international'] },
  { id: 'stclair_lighter', name: 'Saint-Clair’s Storm Lighter', cat: 'lighter', rarity: 'rare', value: 380, expedition: true, owner: 'A collector of polar curios', desc: 'It lit the last stove of the expedition. The wick is still blackened.', trains: ['regional', 'night', 'international'] },
  { id: 'stclair_journal', name: 'Saint-Clair’s Journal', cat: 'book', rarity: 'exceptional', value: 820, expedition: true, owner: 'A collector of polar curios', desc: 'Frost-stained pages. The final entry: “The rail men lied about the survey.”', trains: ['night', 'international'] },
  { id: 'emperor_sov', name: 'The Emperor’s Sovereign', cat: 'coin', rarity: 'legendary', value: 3600, owner: 'Mr. Silas Mortlake', desc: 'The only gold coin struck for an emperor who abdicated the same afternoon.', trains: ['international', 'royal'] },
  { id: 'dragonfly', name: 'The Dragonfly of Montclair', cat: 'accessory', rarity: 'exceptional', value: 1100, owner: 'Mme. Celestine Montclair', desc: 'An enamel brooch with wings of plique-à-jour. Light passes through it like through stained glass.', socialite: true, trains: ['regional', 'night', 'international'] },
  { id: 'kestrel_lighter', name: 'The Kestrel Lighter', cat: 'lighter', rarity: 'rare', value: 420, owner: 'Major Rupert Hale', desc: 'Engraved with a falcon and the names of a squadron. Only one name is not crossed out.', trains: ['local', 'regional', 'night'] },
  { id: 'ashgrove_mini', name: 'The Ashgrove Miniature', cat: 'art', rarity: 'exceptional', value: 1400, owner: 'Lord Edwin Ashgrove', desc: 'A portrait on ivory of a girl who, the family insists, never existed.', trains: ['night', 'international', 'royal'] },
  { id: 'quill_orrery', name: 'Professor Quill’s Orrery', cat: 'antique', rarity: 'legendary', value: 3900, owner: 'The Royal Society of Engineers', desc: 'A brass model of the heavens where the sun is, curiously, a railway engine.', trains: ['royal'] },
  { id: 'meridian_charter', name: 'The Meridian Charter', cat: 'document', rarity: 'legendary', value: 2500, owner: 'The Consortium', desc: 'The founding charter of the Meridian Compact, signed by every baron who ever priced a loaf of bread.', intel: 40, trains: ['royal'], story: true },
];

export const HARTLEY_LOCKET = { id: 'hartley_locket', name: 'The Hartley Locket', cat: 'heirloom', rarity: 'rare', value: 60, owner: 'Mr. Silas Mortlake (taken from Mrs. Hartley)', desc: 'A widow’s locket, seized as “collateral” by a banker. Inside: a photograph of a millworker who died in a strike.', hartley: true };

// --- Passenger archetypes ---------------------------------------------------
const FIRST_M = ['Aldous', 'Bartholomew', 'Cecil', 'Desmond', 'Edmund', 'Felix', 'Gideon', 'Horace', 'Ignatius', 'Jasper', 'Lionel', 'Montague', 'Percival', 'Reginald', 'Sebastian', 'Thaddeus', 'Wendell', 'Augustus', 'Clement', 'Rupert', 'Silas', 'Ambrose'];
const FIRST_F = ['Adelaide', 'Beatrix', 'Cordelia', 'Delphine', 'Eugenia', 'Florence', 'Georgiana', 'Honoria', 'Imogen', 'Lavinia', 'Marguerite', 'Ottoline', 'Philippa', 'Rosalind', 'Seraphina', 'Theodora', 'Vivienne', 'Winifred', 'Celestine', 'Clementine'];
const FIRST_WM = ['Alf', 'Bert', 'Charlie', 'Danny', 'Ernie', 'Frank', 'George', 'Harry', 'Jack', 'Len', 'Ned', 'Sid', 'Tom', 'Walt', 'Billy', 'Joe'];
const FIRST_WF = ['Annie', 'Bess', 'Dot', 'Edie', 'Flo', 'Gracie', 'Ivy', 'Kitty', 'Mabel', 'Nell', 'Peg', 'Rosie', 'Sal', 'Vi', 'Maggie', 'Lil'];
const LAST_U = ['Ashcombe', 'Blackwood', 'Carrington', 'Davenport', 'Ellsworth', 'Fairfax', 'Grantham', 'Hollingsworth', 'Kingsley', 'Lockhart', 'Montague', 'Pemberton', 'Ravensworth', 'Sterling', 'Thornbury', 'Vanderholt', 'Whitmore', 'Crane', 'Mortlake', 'Vane', 'Ashgrove'];
const LAST_W = ['Abbott', 'Baker', 'Cobb', 'Dawes', 'Finch', 'Griggs', 'Hobbs', 'Jarvis', 'Kemp', 'Lamb', 'Mudge', 'Nash', 'Platt', 'Rudd', 'Sykes', 'Tull', 'Wicks', 'Hartley', 'Abernathy'];
export const NAMES = { FIRST_M, FIRST_F, FIRST_WM, FIRST_WF, LAST_U, LAST_W };

// item weights: [cat, weight]
export const ARCHETYPES = {
  aristocrat: { title: 'Aristocrat', cls: 'upper', cash: [40, 160], aware: 0.42, items: [['ring', 4], ['watch', 4], ['cigcase', 3], ['necklace', 3], ['accessory', 3], ['coin', 2], ['heirloom', 0]], rarityBias: 1.6, acts: { read: 3, drink: 3, window: 2, sleep: 2, talk: 2, watch: 1 }, titlePrefix: ['Lord', 'Lady', 'Sir', 'The Hon.'], ethics: 0.25, bio: ['Inherited three estates and the opinion that he earned them.', 'Has never carried a coin she couldn’t afford to lose—which is all of them.', 'Hunts on weekends; the beaters are paid in promises.', 'Sits on the board of a charity she has never visited.'], crestChance: 0.35 },
  magnate: { title: 'Industrial Magnate', cls: 'upper', cash: [60, 220], aware: 0.5, items: [['watch', 5], ['cigcase', 4], ['document', 3], ['ring', 2], ['accessory', 3], ['lighter', 2]], rarityBias: 1.7, acts: { read: 4, watch: 3, talk: 2, drink: 2, window: 1 }, titlePrefix: ['Mr.', 'Sir'], ethics: 0.12, bio: ['Owns four mills and the town they stand in.', 'Cut wages twice last winter. Bought a racehorse in spring.', 'Believes fervently in hard work, chiefly other people’s.'], crestChance: 0.3, docChance: 0.35 },
  railexec: { title: 'Railway Executive', cls: 'upper', cash: [50, 180], aware: 0.55, items: [['watch', 6], ['document', 4], ['compass', 2], ['accessory', 3], ['cigcase', 2]], rarityBias: 1.4, acts: { watch: 4, read: 3, talk: 2, window: 2 }, titlePrefix: ['Mr.', 'Director'], ethics: 0.2, bio: ['Rerouted the line through a village to avoid his golf course.', 'Knows every timetable by heart and every passenger by none.', 'Signed the order evicting forty families for a freight yard.'], docChance: 0.4 },
  bankheir: { title: 'Banking Heir', cls: 'upper', cash: [80, 260], aware: 0.32, items: [['ring', 3], ['cigcase', 4], ['lighter', 3], ['coin', 3], ['wristwatch', 3], ['accessory', 3]], rarityBias: 1.5, acts: { drink: 5, cards: 3, talk: 3, sleep: 2, window: 1 }, titlePrefix: ['Mr.', 'Master'], ethics: 0.3, bio: ['Lost a fortune at cards last month. His father’s bank foreclosed on two hundred farms to cover it.', 'Thinks a bus is a kind of cocktail.', 'Generous with drinks, stingy with everything that matters.'], crestChance: 0.25 },
  socialite: { title: 'Socialite', cls: 'upper', cash: [30, 140], aware: 0.38, items: [['necklace', 5], ['bracelet', 4], ['ring', 3], ['accessory', 4], ['cigcase', 2], ['letter', 2]], rarityBias: 1.5, acts: { talk: 5, drink: 3, read: 2, window: 2, sleep: 1 }, titlePrefix: ['Miss', 'Mrs.', 'Lady'], female: 1, ethics: 0.35, bio: ['Her parties are legendary; her staff are unpaid since Easter.', 'Collects artists, then forgets them in the attic.', 'Funds the opera and evicts the tenants beneath it.'], socialite: true },
  politician: { title: 'Politician', cls: 'upper', cash: [40, 150], aware: 0.6, items: [['document', 4], ['letter', 4], ['watch', 3], ['accessory', 2], ['ring', 2]], rarityBias: 1.3, acts: { read: 4, talk: 4, watch: 2, drink: 1 }, titlePrefix: ['The Rt. Hon.', 'Minister', 'Alderman'], ethics: 0.15, bio: ['Campaigned on bread prices; votes with the millers.', 'Has a speech for every occasion and a price for every vote.', 'Shakes hands like he’s checking for loose coins.'], docChance: 0.5 },
  collector: { title: 'Wealthy Collector', cls: 'upper', cash: [40, 160], aware: 0.62, items: [['coin', 4], ['compass', 3], ['antique', 3], ['book', 3], ['watch', 2], ['accessory', 2]], rarityBias: 2, acts: { read: 4, inspect: 4, window: 2, watch: 1 }, titlePrefix: ['Dr.', 'Mr.', 'Mme.'], ethics: 0.4, bio: ['Owns things that belong in museums, and some that belong to other countries.', 'Keeps a ledger of every object’s price and none of its story.', 'A genuine scholar—who acquires by any means necessary.'] },
  merchant: { title: 'Travelling Merchant', cls: 'middle', cash: [15, 70], aware: 0.55, items: [['coin', 4], ['compass', 3], ['lighter', 3], ['watch', 2], ['accessory', 2]], rarityBias: 1, acts: { read: 3, eat: 3, talk: 2, inspect: 3, watch: 2, sleep: 1 }, titlePrefix: ['Mr.', 'Mrs.'], ethics: 0.55, bio: ['Sells patent tonics that cure nothing but thirst.', 'Honest scales, dishonest smile—or the other way round.', 'Supports a family of six on commission alone.'] },
  journalist: { title: 'Travelling Journalist', cls: 'middle', cash: [8, 40], aware: 0.7, items: [['letter', 4], ['document', 2], ['lighter', 2], ['accessory', 2]], rarityBias: 1, acts: { read: 3, talk: 3, window: 2, inspect: 2, watch: 1 }, titlePrefix: ['Miss', 'Mr.'], ethics: 0.8, bio: ['Writes for the Clarion—the only paper the barons haven’t bought.', 'Chasing a rumour about something called the Meridian Compact.', 'Notices everything. Writes most of it down.'], ally: true },
  magician: { title: 'Travelling Magician', cls: 'middle', cash: [10, 50], aware: 0.85, items: [['coin', 4], ['accessory', 2], ['cigcase', 1]], rarityBias: 1.2, acts: { cards: 5, talk: 3, drink: 2 }, titlePrefix: ['The Great', 'Signor', 'Madame'], ethics: 0.6, bio: ['Professional misdirection. Recognises an amateur at forty paces.', 'Plays the music halls of every mill town on the line.'], performer: true },
  worker: { title: 'Working-Class Traveller', cls: 'working', cash: [2, 14], aware: 0.45, items: [['heirloom', 3], ['coin', 2], ['lighter', 2], ['watch', 1]], rarityBias: 0.6, acts: { sleep: 3, eat: 3, talk: 3, window: 3, read: 1 }, titlePrefix: [''], ethics: 0.75, bio: ['Riding to the city to look for work after the mill closed.', 'Saving every shilling for a daughter’s schooling.', 'Union man. Keeps his card hidden in his boot.', 'Going home for a funeral, with a borrowed coat.'], poor: true },
  family: { title: 'Working Family', cls: 'working', cash: [3, 18], aware: 0.5, items: [['heirloom', 4], ['coin', 2]], rarityBias: 0.5, acts: { talk: 4, eat: 3, sleep: 2, window: 3 }, titlePrefix: ['Mrs.', 'Mr.'], ethics: 0.8, bio: ['Moving everything they own in two carpet bags.', 'The children have never seen the sea. They’re about to.', 'Behind on rent to a landlord who rides first class.'], poor: true, family: true },
  diplomat: { title: 'Diplomat', cls: 'upper', cash: [60, 200], aware: 0.65, items: [['document', 5], ['watch', 3], ['ring', 2], ['cigcase', 2], ['letter', 3]], rarityBias: 1.8, acts: { read: 4, talk: 3, watch: 2, drink: 2 }, titlePrefix: ['His Excellency', 'Count', 'Ambassador'], ethics: 0.3, bio: ['Carries a diplomatic pouch and the immunity to match.', 'Negotiating a treaty that sells a harbour twice.'], docChance: 0.5 },
  spy: { title: 'Gentleman of Leisure', cls: 'upper', cash: [40, 140], aware: 0.9, items: [['document', 5], ['lighter', 2], ['wristwatch', 2], ['cigcase', 2]], rarityBias: 1.6, acts: { read: 5, window: 2, drink: 2 }, titlePrefix: ['Mr.', 'Mrs.'], ethics: 0.4, bio: ['Reads the same page of the same newspaper for hours.', 'Claims to sell typewriters. Has never seen one.'], docChance: 0.7, hidden: true },
  royal: { title: 'Royal Guest', cls: 'upper', cash: [100, 400], aware: 0.5, items: [['ring', 4], ['necklace', 4], ['watch', 3], ['antique', 2], ['accessory', 3]], rarityBias: 3, acts: { drink: 3, talk: 4, read: 2, window: 2 }, titlePrefix: ['Prince', 'Duchess', 'Countess', 'Grand Duke'], ethics: 0.2, bio: ['Has never opened a door, a letter, or a mind.', 'Owns a palace in every capital the line touches.'], crestChance: 0.5 },
  // staff
  porter: { title: 'Porter', cls: 'staff', cash: [1, 8], aware: 0.5, items: [['coin', 1]], rarityBias: 0.4, acts: {}, staff: 'porter', ethics: 0.85, bio: ['Carries other people’s luggage and other people’s secrets.', 'Twenty years on the line. Knows every loose panel.'], poor: true },
  conductor: { title: 'Conductor', cls: 'staff', cash: [4, 20], aware: 0.75, items: [['watch', 1]], rarityBias: 0.6, acts: {}, staff: 'conductor', ethics: 0.5, bio: ['Proud of the uniform, prouder of the timetable.', 'Paid by the railway, loyal to whoever pays more.'] },
  detective: { title: 'Railway Detective', cls: 'staff', cash: [10, 30], aware: 0.95, items: [['watch', 1]], rarityBias: 1, acts: {}, staff: 'detective', ethics: 0.5, bio: [''] },
  guard: { title: 'Private Guard', cls: 'staff', cash: [5, 20], aware: 0.85, items: [], rarityBias: 0, acts: {}, staff: 'guard', ethics: 0.4, bio: ['Hired muscle in a hired uniform.'] },
};

export const RECURRING = {
  hollis: { name: 'Inspector Mabel Hollis', title: 'Railway Detective', bio: 'The sharpest detective on the line. She has noticed that pockets empty wherever a certain well-dressed gentleman travels.', look: 'hollis' },
};

// --- Carriage & train definitions -----------------------------------------
export const CARRIAGE_TYPES = {
  coach3: { name: 'Third-Class Coach', len: 20, palette: { wall: '#4d6b4f', wallDk: '#2f4532', trim: '#c9a24a', floor: '#6b4a32', floor2: '#5b3d28', seat: '#2f5e4a', seatDk: '#1d3d30' } },
  coach2: { name: 'Second-Class Coach', len: 20, palette: { wall: '#6b3a2e', wallDk: '#452219', trim: '#d4b062', floor: '#5a2f2f', floor2: '#4b2626', seat: '#7a2433', seatDk: '#4d1520' } },
  dining: { name: 'Dining Car', len: 22, palette: { wall: '#7a4a2c', wallDk: '#4b2b18', trim: '#e0bf6e', floor: '#3d5a4a', floor2: '#30493b', seat: '#7a2433', seatDk: '#4d1520' } },
  lounge: { name: 'Lounge Car', len: 22, palette: { wall: '#3b2a3d', wallDk: '#241826', trim: '#e0bf6e', floor: '#6e1f2b', floor2: '#5a1823', seat: '#1f5e4a', seatDk: '#123d30' } },
  compartment: { name: 'First-Class Compartments', len: 24, palette: { wall: '#7d4d2e', wallDk: '#4f2e19', trim: '#e8cf86', floor: '#6e1f2b', floor2: '#581824', seat: '#6e1f2b', seatDk: '#45111a' } },
  sleeper: { name: 'Sleeping Car', len: 24, palette: { wall: '#2e3550', wallDk: '#1c2135', trim: '#c9a24a', floor: '#3b2236', floor2: '#2f1a2b', seat: '#5a2a4a', seatDk: '#3a1830' } },
  baggage: { name: 'Baggage Car', len: 18, palette: { wall: '#5b4a3a', wallDk: '#3a2e24', trim: '#8a6a24', floor: '#4a3a2c', floor2: '#3f3125', seat: '#5b4a3a', seatDk: '#3a2e24' }, restricted: true },
  salon: { name: 'State Salon', len: 24, palette: { wall: '#ece0c4', wallDk: '#b9a67e', trim: '#c9a24a', floor: '#1f5e4a', floor2: '#184d3c', seat: '#6e1f2b', seatDk: '#45111a' } },
  vault: { name: 'Vault Car', len: 16, palette: { wall: '#3a3a40', wallDk: '#24242a', trim: '#c9a24a', floor: '#2a2a30', floor2: '#232328', seat: '#3a3a40', seatDk: '#24242a' }, restricted: true },
};

export const TRAINS = {
  local: {
    id: 'local', name: 'The Millbrook Local', tagline: 'Crowded benches, soot and sandwiches. A fine place to learn.', tier: 1,
    carriages: ['coach3', 'coach3', 'dining', 'coach3', 'baggage'],
    pax: [14, 17], conductors: 1, detective: 0, ticket: 0, legs: 3, legTime: 95,
    stations: ['Millbrook', 'Ashby Junction', 'Coldharbour', 'Kingsgate Terminus'],
    mix: { worker: 5, family: 3, merchant: 3, journalist: 1.2, magician: 0.8, bankheir: 1, magnate: 0.8, socialite: 1, aristocrat: 0.6, politician: 0.6 },
    rarityShift: 0, time: 'day', livery: '#1f5e4a', sky: ['#f6d9a4', '#e9a96b'], hills: '#7a8f5a',
    unlock: null, playerClass: 'third',
  },
  regional: {
    id: 'regional', name: 'The Amberline Regional', tagline: 'Velvet seats, silver service and silk-lined pockets.', tier: 2,
    carriages: ['coach2', 'dining', 'lounge', 'compartment', 'compartment', 'baggage'],
    pax: [17, 21], conductors: 2, detective: 0.45, ticket: 40, legs: 3, legTime: 105,
    stations: ['Kingsgate', 'Harrow Vale', 'Amberley Spa', 'Westmarch Cathedral'],
    mix: { aristocrat: 3, magnate: 2.5, railexec: 2, bankheir: 2.5, socialite: 3, politician: 2, collector: 1.5, merchant: 2, journalist: 1, magician: 1, worker: 1 },
    rarityShift: 1, time: 'golden', livery: '#6e1f2b', sky: ['#ffd9a0', '#f08a5d'], hills: '#8a7a4a',
    unlock: { wealth: 250, intel: 4 }, playerClass: 'second',
  },
  night: {
    id: 'night', name: 'The Nocturne Night Express', tagline: 'Lamps low, berths full, and everyone dreaming of money.', tier: 3,
    carriages: ['sleeper', 'lounge', 'dining', 'sleeper', 'sleeper', 'baggage'],
    pax: [17, 21], conductors: 2, detective: 0.6, ticket: 90, legs: 3, legTime: 110,
    stations: ['Westmarch', 'Ravensmoor', 'Saltmere Docks', 'Port Aurelia'],
    mix: { aristocrat: 3, magnate: 2, bankheir: 2, socialite: 2.5, politician: 2, collector: 2, railexec: 1.5, spy: 0.8, journalist: 1, merchant: 1.5 },
    rarityShift: 1.6, time: 'night', livery: '#2e3550', sky: ['#1b2140', '#0d1024'], hills: '#1d2338',
    unlock: { wealth: 600, intel: 14 }, playerClass: 'sleeper',
  },
  international: {
    id: 'international', name: 'The Continental Meridian', tagline: 'Diplomats, spies and fortunes crossing borders under seal.', tier: 4,
    carriages: ['compartment', 'dining', 'lounge', 'sleeper', 'compartment', 'baggage'],
    pax: [18, 22], conductors: 3, detective: 1, ticket: 200, legs: 4, legTime: 100,
    stations: ['Port Aurelia', 'Valdermark', 'Lys-sur-Mer', 'Kronstadt', 'Meridian Central'],
    mix: { diplomat: 3, spy: 2, collector: 3, aristocrat: 3, magnate: 2, socialite: 2.5, bankheir: 2, politician: 2, journalist: 0.8 },
    rarityShift: 2.3, time: 'golden', livery: '#123d30', sky: ['#fbe3b8', '#d97b4f'], hills: '#5a6a7a',
    unlock: { wealth: 1500, intel: 28, goodwill: 120 }, playerClass: 'first',
  },
  royal: {
    id: 'royal', name: 'The Sovereign', tagline: 'A private train for a private world. Every key is guarded.', tier: 5,
    carriages: ['salon', 'dining', 'lounge', 'compartment', 'vault'],
    pax: [14, 17], conductors: 2, guards: 3, detective: 1, ticket: 0, legs: 3, legTime: 120,
    stations: ['Meridian Central', 'Crownwater', 'Highcastle', 'The Summer Palace'],
    mix: { royal: 4, aristocrat: 3, magnate: 2, politician: 2, socialite: 2, diplomat: 1.5, collector: 1 },
    rarityShift: 3.2, time: 'day', livery: '#4a121b', sky: ['#f5e6c8', '#c9a24a'], hills: '#6a7a4a',
    unlock: { wealth: 2500, sets: ['signets|consortium'] }, playerClass: 'first',
  },
};
export const TRAIN_ORDER = ['local', 'regional', 'night', 'international', 'royal'];

// --- Outfits ----------------------------------------------------------------
export const OUTFITS = {
  tweed: { name: 'Traveller’s Tweed', desc: 'Respectable, forgettable. Trusted in third class.', cost: 0, coat: '#6b5a44', trim: '#3a2e22', hat: 'bowler', access: ['third', 'second'], trust: { working: 0.75, middle: 0.9, upper: 1.15 } },
  porter: { name: 'Porter’s Uniform', desc: 'Invisible to the rich. Opens the baggage car.', cost: 140, coat: '#3a3f5c', trim: '#c9a24a', hat: 'pillbox', access: ['third', 'second', 'baggage'], trust: { working: 0.8, middle: 0.8, upper: 0.65 }, req: 'disguise_porter' },
  evening: { name: 'Evening Wear', desc: 'White tie and confidence. Walk into first class like you own it.', cost: 320, coat: '#16161c', trim: '#f4e9d3', hat: 'top', access: ['third', 'second', 'first', 'sleeper'], trust: { working: 1.1, middle: 0.85, upper: 0.65 }, req: 'disguise_evening' },
  conductor: { name: 'Conductor’s Uniform', desc: 'Authority, borrowed. Opens most doors. Detectives look twice.', cost: 700, coat: '#4a121b', trim: '#e0bf6e', hat: 'peaked', access: ['third', 'second', 'first', 'sleeper', 'baggage'], trust: { working: 0.7, middle: 0.7, upper: 0.75 }, detective: 1.4, req: 'disguise_conductor' },
};

// --- Upgrade tree -----------------------------------------------------------
// cost: {wealth, intel, goodwill}; req: prerequisite ids
export const BRANCHES = {
  hand: { name: 'Sleight of Hand', icon: 'hand', color: '#6e1f2b' },
  disguise: { name: 'Disguise', icon: 'mask', color: '#1e2a44' },
  distract: { name: 'Distraction', icon: 'coin', color: '#8a6a24' },
  intel: { name: 'Intelligence', icon: 'eye', color: '#1f5e4a' },
  network: { name: 'Network', icon: 'web', color: '#5a3520' },
  storage: { name: 'Storage', icon: 'case', color: '#3b2a3d' },
};
export const UPGRADES = [
  { id: 'hand_steady', br: 'hand', name: 'Steady Hand', desc: 'The pocket mouth feels wider; brushing the lining is less noticeable.', effect: 'Dip & Draw tolerance +35%. Brush penalty −30%.', cost: { wealth: 60 } },
  { id: 'hand_timing', br: 'hand', name: 'Watchmaker’s Ear', desc: 'You hear the escapement. Gold arcs widen and a perfect zone appears.', effect: 'Timing arcs +30%, perfect zone shown.', cost: { wealth: 160 }, req: ['hand_steady'] },
  { id: 'hand_ring', br: 'hand', name: 'The Ring Lift', desc: 'Learn to ease a ring over the knuckle. Rings become possible.', effect: 'Unlocks Twist technique (rings).', cost: { wealth: 260, intel: 2 }, req: ['hand_steady'] },
  { id: 'hand_double', br: 'hand', name: 'Double Dip', desc: 'After a clean lift, you may go straight back in for a second valuable.', effect: 'Chain a second lift from the same mark.', cost: { wealth: 480 }, req: ['hand_timing'] },
  { id: 'hand_phantom', br: 'hand', name: 'Phantom Fingers', desc: 'Once per train, when a mark would catch you, your hand is simply... gone.', effect: 'Survive one failed lift per run.', cost: { wealth: 950, intel: 6 }, req: ['hand_double', 'hand_ring'] },

  { id: 'disguise_spare', br: 'disguise', name: 'Reversible Coat', desc: 'Turn your coat inside-out in any lavatory. Witness descriptions stop matching.', effect: 'Change appearance at lavatories; clears your description.', cost: { wealth: 80 } },
  { id: 'disguise_porter', br: 'disguise', name: 'Porter’s Uniform', desc: 'Borrowed from a friend in the union. The rich look straight through you.', effect: 'Unlocks Porter outfit (baggage car access).', cost: { wealth: 140 }, req: ['disguise_spare'] },
  { id: 'disguise_evening', br: 'disguise', name: 'Evening Wear', desc: 'A tailor who asks no questions. First class opens its doors.', effect: 'Unlocks Evening Wear (first-class & sleeper access).', cost: { wealth: 320 }, req: ['disguise_spare'] },
  { id: 'disguise_conductor', br: 'disguise', name: 'Conductor’s Uniform', desc: 'Brass buttons and a ticket punch. Most doors simply open.', effect: 'Unlocks Conductor outfit (nearly all access).', cost: { wealth: 700, intel: 5 }, req: ['disguise_porter', 'disguise_evening'] },
  { id: 'disguise_faces', br: 'disguise', name: 'Man of Many Faces', desc: 'Putty, spirit gum and a different walk. Detectives no longer recognise you from past trains.', effect: 'Notoriety barely affects recognition.', cost: { wealth: 1200, intel: 8 }, req: ['disguise_conductor'] },

  { id: 'distract_coin', br: 'distract', name: 'Rolling Sixpence', desc: 'Flick a coin down the aisle. Heads turn toward the clatter.', effect: 'Distraction: 2 coins per train.', cost: { wealth: 50 } },
  { id: 'distract_cards', br: 'distract', name: 'Card Flourish', desc: 'A dazzling fan of cards keeps a mark’s eyes on your other hand.', effect: 'Charm a mark: their awareness gain is halved for the next lift.', cost: { wealth: 180 }, req: ['distract_coin'] },
  { id: 'distract_purse', br: 'distract', name: 'Weighted Purse', desc: 'More coins, thrown further.', effect: 'Distraction: 4 coins per train, wider effect.', cost: { wealth: 300 }, req: ['distract_coin'] },
  { id: 'distract_incident', br: 'distract', name: 'Staged Incident', desc: 'A dropped tray, a fainting spell. The whole carriage looks away—and conductors run to help.', effect: 'Once per train: distract the entire carriage for 12s.', cost: { wealth: 650, goodwill: 30 }, req: ['distract_cards', 'distract_purse'] },

  { id: 'intel_eye', br: 'intel', name: 'Keen Eye', desc: 'You can price a coat at a glance. Valuables glint on everyone you pass.', effect: 'See valuables without observing.', cost: { wealth: 70, intel: 2 } },
  { id: 'intel_profile', br: 'intel', name: 'Profiler', desc: 'Observation reveals habits. You can predict when a mark will look away.', effect: 'Observed marks show their next opening.', cost: { wealth: 200, intel: 4 }, req: ['intel_eye'] },
  { id: 'intel_lining', br: 'intel', name: 'Lining Sense', desc: 'You know where people hide paper. The right pocket glows faintly.', effect: 'Pat-Down: hidden documents are hinted.', cost: { wealth: 240, intel: 6 }, req: ['intel_eye'] },
  { id: 'intel_compart', br: 'intel', name: 'Rolling Stock Survey', desc: 'Old blueprints show false panels and forgotten caches.', effect: 'Hidden caches appear on every train.', cost: { wealth: 500, intel: 10 }, req: ['intel_profile', 'intel_lining'] },

  { id: 'net_lookout', br: 'network', name: 'Friendly Faces', desc: 'Those you’ve helped keep an eye out. Approaching security is marked.', effect: 'Detectives & conductors shown on the train map at all times.', cost: { goodwill: 25 } },
  { id: 'net_informant', br: 'network', name: 'Informants Aboard', desc: 'A sympathetic porter or passenger rides every train, ready to help.', effect: 'Informant aboard: tips, a held item, or a diversion.', cost: { goodwill: 60, wealth: 100 }, req: ['net_lookout'] },
  { id: 'net_safehouse', br: 'network', name: 'Safe Houses', desc: 'If you’re thrown off, friends at the station hide half your haul.', effect: 'Keep 50% of carried items when ejected.', cost: { goodwill: 90, wealth: 200 }, req: ['net_lookout'] },
  { id: 'net_route', br: 'network', name: 'The Rooftop Route', desc: 'Union men showed you the ladders. Escapes almost always succeed.', effect: 'Fleeing a search succeeds far more often.', cost: { goodwill: 160, wealth: 400 }, req: ['net_informant', 'net_safehouse'] },

  { id: 'store_pockets', br: 'storage', name: 'Lined Pockets', desc: 'Extra pockets sewn into the lining.', effect: 'Carry 6 items (from 4).', cost: { wealth: 70 } },
  { id: 'store_sleeve', br: 'storage', name: 'Hidden Sleeve', desc: 'A slit in the cuff. One item escapes any search.', effect: '1 concealed slot, safe from searches.', cost: { wealth: 220 }, req: ['store_pockets'] },
  { id: 'store_valise', br: 'storage', name: 'False-Bottom Valise', desc: 'Your luggage hides more than socks. Stash anything at your seat.', effect: 'Stash at your seat: unlimited, safe from searches.', cost: { wealth: 380 }, req: ['store_pockets'] },
  { id: 'store_tailored', br: 'storage', name: 'Tailored Greatcoat', desc: 'Cut by a master, pockets everywhere, not a single bulge.', effect: 'Carry 9 items, 2 concealed slots.', cost: { wealth: 900 }, req: ['store_sleeve', 'store_valise'] },
];

// --- Community causes --------------------------------------------------------
export const CAUSES = [
  { id: 'families', name: 'Millbrook Families’ Fund', desc: 'Coal, rent and boots for families of the closed mills.', who: 'Run by Father Dunstan at St. Agnes', milestones: [
    { at: 60, name: 'Friendly Faces in Third', effect: 'Working-class passengers grow less suspicious of you.', key: 'trust_working' },
    { at: 200, name: 'Watchful Children', effect: 'Families aboard whisper warnings when security comes near.', key: 'family_warn' },
    { at: 450, name: 'A Town That Remembers', effect: 'Goodwill from every gift +25%.', key: 'gw_bonus' } ] },
  { id: 'union', name: 'Railway Workers’ Relief', desc: 'Strike pay and injury funds for porters, stokers and platelayers.', who: 'Kept by Ada Wren, union secretary', milestones: [
    { at: 80, name: 'Porter’s Nod', effect: 'Porters leave the baggage car door unlocked for you.', key: 'baggage_open' },
    { at: 250, name: 'Signalman’s Schedule', effect: 'Tunnels and jolts are announced ahead of time.', key: 'tunnel_warn' },
    { at: 500, name: 'Brotherhood of the Rails', effect: 'Conductors take longer to respond to alarms.', key: 'slow_conductors' } ] },
  { id: 'hartley', name: 'Widow Hartley’s Debt', desc: 'Mrs. Hartley owes the Mortlake Bank for a loan her late husband took to bury his brother.', who: 'Mrs. Edith Hartley, Coldharbour', finite: 300, milestones: [
    { at: 300, name: 'Debt Cleared', effect: 'Mrs. Hartley’s cottage becomes a safe house. She tells you where Mortlake keeps her locket.', key: 'hartley_done' } ] },
  { id: 'orphanage', name: 'St. Agnes Orphanage Roof', desc: 'The roof leaks onto forty beds. The Consortium bought the slate quarry.', who: 'Sister Perpetua', milestones: [
    { at: 120, name: 'Street Urchins', effect: 'Urchins at stations relieve you of 10% of your heat at every stop.', key: 'urchins' },
    { at: 400, name: 'The Choir’s Blessing', effect: 'Fences pay 10% more—no one cheats a friend of St. Agnes.', key: 'fence_bonus' } ] },
  { id: 'clarion', name: 'The Clarion Press', desc: 'The last independent newspaper. Every printing is a fight.', who: 'Editor Josiah Penhallow', milestones: [
    { at: 100, name: 'Press Contacts', effect: 'Leaking documents earns double goodwill.', key: 'press_double' },
    { at: 350, name: 'Front Page', effect: 'Each run reveals a VIP target and their valuables in advance.', key: 'vip_tip' } ] },
];

export const REPUTATIONS = {
  friend: { name: 'The People’s Friend', desc: 'Whispered about kindly in every mill town. Third class shelters you.' },
  gentleman: { name: 'The Gentleman Thief', desc: 'Elegant, precise, never vulgar. Even victims tell the story fondly.' },
  ghost: { name: 'The Railway Ghost', desc: 'No one has ever seen you. Security is lax because they doubt you exist.' },
  outlaw: { name: 'The People’s Outlaw', desc: 'Wanted posters and folk songs in equal measure. Detectives hunt you; the poor hide you.' },
  greedy: { name: 'The Greedy Opportunist', desc: 'Fences love you. Nobody else does.' },
  collector: { name: 'The Master Collector', desc: 'You steal history itself. Rare pieces seem to find their way to you.' },
  unknown: { name: 'An Unknown Traveller', desc: 'Just another face on the platform. For now.' },
};

export const ACTIVITY_INFO = {
  read: { label: 'Reading', attn: 0.35, stir: 0.5 },
  sleep: { label: 'Asleep', attn: 0.05, stir: 0.15 },
  drink: { label: 'Drinking', attn: 0.45, stir: 0.7 },
  eat: { label: 'Eating', attn: 0.4, stir: 0.6 },
  talk: { label: 'Chatting', attn: 0.3, stir: 0.6 },
  cards: { label: 'Playing cards', attn: 0.28, stir: 0.6 },
  window: { label: 'Gazing out', attn: 0.3, stir: 0.4 },
  watch: { label: 'Checking watch', attn: 0.85, stir: 1 },
  inspect: { label: 'Fussing with luggage', attn: 0.7, stir: 0.9 },
  argue: { label: 'Arguing!', attn: 0.08, stir: 0.3 },
  watchshow: { label: 'Watching the show', attn: 0.1, stir: 0.3 },
  walk: { label: 'Walking', attn: 0.65, stir: 0.8 },
  idle: { label: 'Sitting', attn: 0.55, stir: 0.7 },
  patrol: { label: 'Patrolling', attn: 0.9, stir: 1 },
  investigate: { label: 'Investigating', attn: 1, stir: 1 },
  alarmed: { label: 'Alarmed!', attn: 1, stir: 1 },
};
