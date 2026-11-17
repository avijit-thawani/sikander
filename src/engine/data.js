// Static rules data for Sikander. Numbers follow the clean-room design spec.

export const ROWS = 5;
export const COLS = 30;
export const ZONE_WIDTH = 7;
export const CELL_PX = 50;        // world pixels per column (field = 1500 px)
export const UNIT_PX = 50;        // width of a unit's bounding box in world pixels
export const TIERS = ['hero', 'elite', 'warrior', 'archer'];
export const TIER_CAP = 10;

export const BEHAVIOUR_BIAS = { aggressive: -0.6, neutral: 0, defensive: 0.4, cowardly: 0.8 };

const melee = (name, tier, hp, attack, defence, morale, movement, chargeMax, chargeDist, extra = {}) =>
  ({ name, tier, hp, attack, defence, morale, movement, speed: 2, chargeMax, chargeDist, ...extra });
const archer = (name, hp, attack, defence, morale, movement, arrowDamage, arrowRange, extra = {}) =>
  ({ name, tier: 'archer', hp, attack, defence, morale, movement, speed: 2, arrowDamage, arrowRange, ...extra });

export const ARMIES = {
  pauravas: {
    key: 'pauravas', role: 'A', name: 'Pauravas', colour: '#e8892b',
    blurb: 'Defenders of the river lands. Stubborn shield walls and the steadiest generals.',
    archerCost: 2, tauntFolder: 'pauravas',
    units: {
      hero: melee('Raja Porus', 'hero', 500, 170, 0.5, 2.0, 6, 130, 4, { behaviour: 'cowardly' }),
      abhisara: melee('Raja Abhisara', 'hero', 500, 160, 0.4, 2.0, 6, 130, 3, { behaviour: 'cowardly' }),
      spitaka: melee('Spitaka', 'hero', 500, 160, 0.4, 2.0, 6, 130, 3, { behaviour: 'neutral' }),
      elite: melee('Kshatriyas', 'elite', 500, 130, 0.4, 1.3, 6, 130, 4, { behaviour: 'aggressive' }),
      warrior: melee('Padati Levy', 'warrior', 500, 110, 0.25, 1.3, 6, 120, 4, { behaviour: 'neutral' }),
      archer: archer('Dhurandhar', 500, 30, 0.2, 1.3, 3, 200, 17, { behaviour: 'defensive' }),
    },
    taunts: ['MOORKH YAVANA', 'GADHA SENAPATI', 'ULLU KA PATTHA', 'DARPOK CHOOHA', 'BHAAG JA KAAYAR', 'KHATTA DAHI'],
  },
  greeks: {
    key: 'greeks', role: 'B', name: 'Greeks', colour: '#4a7fe0',
    blurb: 'Ferocious foot soldiers from the west. The hardest hitters, masters of the wedge.',
    archerCost: 2, tauntFolder: 'greeks',
    units: {
      hero: melee('Alexander', 'hero', 500, 200, 0.4, 2.0, 7, 130, 4, { behaviour: 'aggressive' }),
      elite: melee('Hypaspists', 'elite', 500, 210, 0.3, 1.4, 5, 110, 3, { behaviour: 'aggressive' }),
      warrior: melee('Phalangites', 'warrior', 500, 160, 0.2, 1.3, 6, 120, 4, { behaviour: 'aggressive' }),
      archer: archer('Archers', 500, 50, 0.1, 1.2, 3, 220, 18, { behaviour: 'defensive' }),
    },
    taunts: ['MUD-FOOTED RAJA', 'GOAT-BRAINED RAJA', 'PEACOCK-BRAINED FOOL', 'ELEPHANT DUNG', 'SOFT-SANDAL FOOL', 'MONSOON-SOAKED RAT'],
  },
  mauryas: {
    key: 'mauryas', role: 'C', name: 'Mauryas', colour: '#2e9e57',
    blurb: 'A rising empire of combined arms: war elephants and deadly archers, but brittle morale.',
    archerCost: 3, tauntFolder: 'mauryas',
    units: {
      hero: melee('Chandragupta', 'hero', 500, 170, 0.4, 2.0, 7, 120, 4, { behaviour: 'defensive' }),
      elite: melee('War elephants', 'elite', 400, 110, 0.3, 1.4, 10, 340, 4, { behaviour: 'aggressive', noFormation: true, mounted: true }),
      warrior: melee('Khadgadharas', 'warrior', 500, 160, 0.2, 1.2, 5, 120, 3, { behaviour: 'neutral' }),
      archer: archer('Archers', 500, 30, 0.2, 1.3, 3, 280, 18, { behaviour: 'defensive' }),
    },
    taunts: ['NAKLI RAJA', 'BUDDHU YAVANA', 'PAGAL HAATHI', 'KAAYAR SIPAHI', 'NAALAYAK', 'BHEEGI BILLI'],
  },
};
export const ARMY_KEYS = ['pauravas', 'greeks', 'mauryas'];

export function unitCost(armyKey, tier) {
  if (tier === 'hero') return 0;
  if (tier === 'elite') return 3;
  if (tier === 'warrior') return 2;
  return ARMIES[armyKey].archerCost;
}

export const SKIRMISH_BUDGETS = { small: 14, medium: 20, large: 26 };
export const CAMPAIGN_BUDGETS = [20, 20, 29];

export const DIFFICULTY = {
  easy:   { humanMod: 1.7, aiMod: 1.3, accuracy: 0.6,  aggression: 0,    wait: 1.5, tauntTime: 20, archeryTime: 16, chargeN: 25 },
  medium: { humanMod: 1.2, aiMod: 1.2, accuracy: 0.75, aggression: -0.2, wait: 1.2, tauntTime: 15, archeryTime: 12, chargeN: 35 },
  hard:   { humanMod: 0.8, aiMod: 1.0, accuracy: 0.9,  aggression: -0.4, wait: 0.8, tauntTime: 10, archeryTime: 8,  chargeN: 30 },
};

export const MAPS = {
  1: { id: 1, name: 'The Jhelum ford', tint: '#e6d8a3', blocks: [[16, 3], [17, 3], [18, 3]],
       blurb: 'A muddy channel cuts the fourth lane just right of centre.' },
  2: { id: 2, name: 'The Hyphasis crossing', tint: '#d3ccba',
       blocks: [0, 3, 4].flatMap((r) => [14, 15, 16, 17].map((c) => [c, r])),
       blurb: 'The river leaves only a two-lane causeway across the middle.' },
  3: { id: 3, name: 'The plain of Taxila', tint: '#e5b89a', blocks: [], blurb: 'Open rolling ground.' },
};

export const MELEE_MAX = 80;
export const TAUNT_MAX = 0.11;
export const MELEE_TIME = 10;
export const CHARGE_TIME = 5;

// Campaign: player army, computer army, map, preset troops, fixed computer layout.
// Layout rows are written top (grid row 4) to bottom (grid row 0); columns 24..29.
export const CAMPAIGN = [
  {
    title: 'Battle of the Jhelum', map: 1, player: 'greeks', computer: 'pauravas', budget: 20,
    preset: { hero: 1, elite: 4, warrior: 3, archer: 1 },
    card: 'Monsoon clouds gather over the Jhelum. Alexander must force the ford before the raja\'s generals close the bank.',
    layout: [
      [null, null, 'warrior', 'abhisara', null, null],
      [null, null, null, null, null, null],
      ['elite', null, 'warrior', 'archer', null, null],
      ['elite', null, null, null, null, null],
      ['elite', null, 'warrior', 'spitaka', null, null],
    ],
  },
  {
    title: 'Stand at the Hyphasis', map: 2, player: 'pauravas', computer: 'greeks', budget: 20,
    preset: { hero: 1, elite: 4, warrior: 3, archer: 1 },
    card: 'The invaders have reached the Hyphasis. Raja Porus holds the narrow causeway: not one step further east.',
    layout: [
      [null, null, null, null, null, null],
      [null, 'elite', 'warrior', null, 'hero', null],
      ['elite', null, 'warrior', 'archer', 'elite', null],
      ['elite', null, 'warrior', null, null, null],
      [null, null, null, null, null, null],
    ],
  },
  {
    title: 'The road to Taxila', map: 3, player: 'mauryas', computer: 'pauravas', budget: 29,
    preset: { hero: 1, elite: 3, warrior: 4, archer: 3 },
    card: 'The invaders are gone. A young Chandragupta marches on Taxila with his war elephants to forge an empire.',
    layout: [
      [null, null, null, null, null, null],
      [null, 'elite', null, 'warrior', null, null],
      ['archer', 'elite', null, 'warrior', null, 'hero'],
      [null, 'elite', null, 'warrior', null, 'warrior'],
      [null, 'elite', null, 'warrior', null, null],
    ],
  },
];
export const CAMPAIGN_END = 'Chandragupta rides into Taxila. The age of the Mauryas begins. Thank you for playing Sikander.';

export function rank(r) {
  if (r < 0.2) return 'Peasant';
  if (r < 0.5) return 'Foot Soldier';
  if (r < 0.9) return 'Warrior';
  if (r < 1.2) return 'Captain';
  if (r < 1.5) return 'Master General';
  return 'Raja';
}
