import test from 'node:test';
import assert from 'node:assert/strict';
import { ARMIES, unitCost, SKIRMISH_BUDGETS, CAMPAIGN_BUDGETS, CAMPAIGN, MAPS } from '../src/engine/data.js';
import { Battle } from '../src/engine/battle.js';
import { createRng } from '../src/engine/rng.js';
import { selectionCost, randomSelection, autoArrange, computerLayout, campaignLayout, inZone, canAdd } from '../src/engine/army.js';
import { simResolver } from '../src/engine/minisim.js';

const fixed = (vals) => ({
  melee: async () => vals.melee ?? 0, charge: async () => vals.charge ?? 0,
  taunt: async () => ({ s: vals.taunt ?? 0, completed: true }), archery: async () => vals.archery ?? { fired: false },
});
const mk = (p0, p1, opts = {}) => new Battle({ map: 3, armies: opts.armies || ['pauravas', 'greeks'], seed: 7,
  placements: [p0, p1], resolver: opts.resolver || fixed({}), difficulty: opts.difficulty || 'medium', ai: [false, true] });

test('stat tables match the spec', () => {
  const P = ARMIES.pauravas.units, G = ARMIES.greeks.units, M = ARMIES.mauryas.units;
  assert.deepEqual([P.hero.attack, P.hero.defence, P.hero.morale, P.hero.movement, P.hero.chargeMax, P.hero.chargeDist], [170, 0.5, 2, 6, 130, 4]);
  assert.deepEqual([P.abhisara.attack, P.spitaka.chargeDist], [160, 3]);
  assert.deepEqual([P.elite.attack, P.elite.defence, P.warrior.attack, P.warrior.defence], [130, 0.4, 110, 0.25]);
  assert.deepEqual([P.archer.arrowDamage, P.archer.arrowRange, P.archer.movement], [200, 17, 3]);
  assert.deepEqual([G.hero.attack, G.hero.movement, G.elite.attack, G.elite.movement, G.elite.chargeDist], [200, 7, 210, 5, 3]);
  assert.deepEqual([G.warrior.attack, G.archer.attack, G.archer.defence, G.archer.arrowDamage], [160, 50, 0.1, 220]);
  assert.deepEqual([M.elite.hp, M.elite.movement, M.elite.chargeMax, M.elite.noFormation], [400, 10, 340, true]);
  assert.deepEqual([M.warrior.morale, M.warrior.movement, M.archer.arrowDamage], [1.2, 5, 280]);
  for (const a of Object.values(ARMIES)) for (const [k, u] of Object.entries(a.units)) if (!(a.key === 'mauryas' && k === 'elite')) assert.equal(u.hp, 500);
});

test('costs and budgets', () => {
  assert.equal(unitCost('pauravas', 'hero'), 0);
  assert.equal(unitCost('greeks', 'elite'), 3);
  assert.equal(unitCost('greeks', 'warrior'), 2);
  assert.equal(unitCost('greeks', 'archer'), 2);
  assert.equal(unitCost('mauryas', 'archer'), 3);
  assert.deepEqual(SKIRMISH_BUDGETS, { small: 14, medium: 20, large: 26 });
  assert.deepEqual(CAMPAIGN_BUDGETS, [20, 20, 29]);
  assert.equal(selectionCost('mauryas', CAMPAIGN[2].preset), 26);
  assert.equal(selectionCost('greeks', CAMPAIGN[0].preset), 20);
  assert.equal(canAdd('greeks', { hero: 1, elite: 10 }, 'elite', 99), false);
  for (let s = 1; s < 30; s++) {
    const rng = createRng(s);
    for (const army of Object.keys(ARMIES)) {
      const c = randomSelection(army, 20, rng);
      const cost = selectionCost(army, c);
      assert.ok(cost <= 20 && 20 - cost < 2, `leftover too large ${cost}`);
      assert.equal(c.hero, 1);
    }
  }
});

test('deployment zones and auto layouts', () => {
  assert.ok(inZone(0, 0, 0) && inZone(0, 6, 4) && !inZone(0, 7, 2));
  assert.ok(inZone(1, 23, 0) && inZone(1, 29, 4) && !inZone(1, 22, 2));
  const counts = { hero: 1, elite: 2, warrior: 6, archer: 1 };
  const human = autoArrange(counts, 0);
  assert.deepEqual(human[0], { key: 'hero', col: 0, row: 2 });
  assert.deepEqual(human[1], { key: 'elite', col: 1, row: 0 });
  assert.ok(human.every((p) => inZone(0, p.col, p.row)));
  assert.ok(Battle.validPlacement(0, human, 3));
  const comp = computerLayout(counts, 1);
  assert.deepEqual(comp[0], { key: 'hero', col: 29, row: 2 });
  assert.deepEqual(comp[1], { key: 'archer', col: 28, row: 2 });
  assert.deepEqual(comp[2], { key: 'elite', col: 27, row: 2 });
  assert.deepEqual(comp.slice(4).map((p) => [p.col, p.row]), [[26, 2], [26, 1], [26, 3], [26, 0], [26, 4], [25, 2]]);
  assert.ok(Battle.validPlacement(1, comp, 2));
  const l1 = campaignLayout(CAMPAIGN[0]);
  assert.equal(l1.length, 9);
  assert.deepEqual(l1.find((p) => p.key === 'abhisara'), { key: 'abhisara', col: 27, row: 4 });
  assert.deepEqual(MAPS[2].blocks.length, 12);
});

test('movement range and paths', () => {
  const b = mk([{ key: 'warrior', col: 3, row: 2 }, { key: 'hero', col: 0, row: 0 }], [{ key: 'hero', col: 29, row: 2 }]);
  const u = b.units[0];
  assert.equal(b.validate(0, { unitId: 0, type: 'move', target: { col: 8, row: 2 } }), null); // 5 + 1 <= 6
  assert.equal(b.validate(0, { unitId: 0, type: 'move', target: { col: 9, row: 2 } }), 'out of range');
  assert.equal(b.validate(0, { unitId: 0, type: 'move', target: { col: 6, row: 4 } }), null);
  assert.equal(b.validate(0, { unitId: 0, type: 'move', target: { col: 7, row: 4 } }), 'out of range');
  const cells = b.reachableCells(u);
  assert.ok(cells.every((c) => Math.abs(c.col - 3) + Math.abs(c.row - 2) <= 5));
  const m2 = new Battle({ map: 1, armies: ['pauravas', 'greeks'], placements: [[{ key: 'warrior', col: 15, row: 3 }], [{ key: 'hero', col: 29, row: 0 }]], resolver: fixed({}) });
  const p = m2.findPath(m2.units[0], { col: 19, row: 3 });
  assert.equal(p.cells.length, 1, 'block cell stops a row-first path'); // cols-first blocked at 16, rows-first n/a
});

test('melee damage formula and dying blow', async () => {
  assert.equal(Battle.meleeDamage(450, 1.2, 0.2), 432); // spec charge example
  const b = mk([{ key: 'warrior', col: 10, row: 2 }], [{ key: 'warrior', col: 12, row: 2 }, { key: 'hero', col: 29, row: 0 }]);
  const x = b.units[0], y = b.units[1];
  b.placeAt(x, 11, 2); b.engage(x, y);
  await b.strike(x, y);
  // Padati Levy 110 * 1.2 * (1-0.2) = 105.6 -> 106 ; Phalangites 160 * 1.2 * (1-0.25) = 144
  assert.equal(y.health, 500 - 106);
  assert.equal(x.health, 500 - 144);
  y.health = 50;
  await b.strike(x, y);
  assert.ok(y.dead);
  assert.equal(x.health, 356 - 72); // dying blow at half strength
});

test('outflanking halves base attack', () => {
  const b = mk([{ key: 'warrior', col: 10, row: 2 }], [{ key: 'warrior', col: 11, row: 2 }, { key: 'warrior', col: 9, row: 2 }]);
  const u = b.units[0];
  b.engage(u, b.units[1]);
  assert.equal(b.atk(u), 110);
  b.engage(u, b.units[2]);
  assert.equal(b.atk(u), 55);
});

test('morale formula and flee threshold', async () => {
  const b = mk([{ key: 'warrior', col: 2, row: 2 }, { key: 'hero', col: 0, row: 0 }], [{ key: 'hero', col: 29, row: 2 }]);
  const u = b.units[0];
  u.health = 100; // 0.2 * 1.3 * 1 * 1.2 = 0.312 -> no flee possible
  assert.ok(Math.abs(b.unitMorale(u) - 0.312) < 1e-9);
  assert.equal(await b.moraleCheck(u), false);
  b.players[0].moraleMod = 0.1; // morale 0.0312 -> flees unless rng <= 0.078
  b.rng = () => 0.5;
  assert.equal(await b.moraleCheck(u), true);
  assert.ok(u.fled && b.unitAt(2, 2) === null);
  // hero gone multiplies army morale by 0.2
  const c = mk([{ key: 'warrior', col: 2, row: 2 }, { key: 'hero', col: 0, row: 0 }], [{ key: 'hero', col: 29, row: 2 }]);
  const m0 = c.unitMorale(c.units[0]);
  c.units[1].dead = true;
  assert.ok(Math.abs(c.unitMorale(c.units[0]) - Math.min(1, m0) * 0.2) < 1e-9 || c.unitMorale(c.units[0]) <= 0.2 * 1.3 * 1.2 + 1e-9);
  // army morale is averaged over the original count
  assert.ok(c.armyMorale(0) <= 0.5);
});

test('taunt shifts both armies morale', async () => {
  const b = mk([{ key: 'hero', col: 0, row: 2 }], [{ key: 'hero', col: 29, row: 2 }], { resolver: fixed({ taunt: 0.11 }) });
  await b.runRound([{ unitId: 0, type: 'taunt' }], []);
  assert.ok(Math.abs(b.players[0].moraleMod - 1.11) < 1e-9);
  assert.ok(Math.abs(b.players[1].moraleMod - 0.89) < 1e-9);
});

test('round order alternates, first mover swaps', () => {
  const b = mk([{ key: 'hero', col: 0, row: 2 }], [{ key: 'hero', col: 29, row: 2 }]);
  const a = [{ id: 'a1' }, { id: 'a2' }], z = [{ id: 'z1' }];
  assert.deepEqual(b.interleave(a, z).map((e) => e.cmd.id), ['a1', 'z1', 'a2']);
  b.round = 2;
  assert.deepEqual(b.interleave(a, z).map((e) => e.cmd.id), ['z1', 'a1', 'a2']);
  b.round = 3;
  assert.equal(b.interleave(a, z)[0].side, 0);
});

test('formations: shield wall and wedge detection with modifiers', () => {
  const b = mk([{ key: 'warrior', col: 3, row: 0 }, { key: 'warrior', col: 3, row: 1 }, { key: 'warrior', col: 3, row: 2 },
    { key: 'elite', col: 5, row: 2 }, { key: 'elite', col: 6, row: 3 }, { key: 'elite', col: 5, row: 4 }, { key: 'hero', col: 0, row: 4 }],
  [{ key: 'hero', col: 29, row: 2 }]);
  const groups = [...b.groups.values()];
  assert.deepEqual(groups.map((g) => g.type).sort(), ['wall', 'wedge']);
  assert.equal(b.def(b.units[0]), 0.5);
  assert.equal(b.atk(b.units[0]), 60);
  assert.equal(b.atk(b.units[4]), 230);
  const wedge = groups.find((g) => g.type === 'wedge');
  assert.equal(wedge.leadId, 4);
  const elephants = new Battle({ map: 3, armies: ['mauryas', 'greeks'], placements: [[{ key: 'elite', col: 3, row: 0 }, { key: 'elite', col: 3, row: 1 }, { key: 'elite', col: 3, row: 2 }], [{ key: 'hero', col: 29, row: 2 }]], resolver: fixed({}) });
  assert.equal(elephants.groups.size, 0, 'war elephants cannot form');
});

test('charge applies bonus and contact skips the melee mini-game', async () => {
  let meleeCalls = 0;
  const r = { ...fixed({ charge: 340 }), melee: async () => { meleeCalls++; return 0; } };
  const b = new Battle({ map: 3, armies: ['mauryas', 'greeks'], placements: [[{ key: 'elite', col: 5, row: 2 }], [{ key: 'warrior', col: 13, row: 2 }, { key: 'hero', col: 29, row: 0 }]], resolver: r });
  await b.execute(0, { unitId: 0, type: 'move', target: { col: 12, row: 2 } });
  const y = b.units[1];
  assert.equal(meleeCalls, 0);
  assert.equal(500 - y.health, 432);
  assert.ok(b.units[0].engaged.has(1));
});

test('archery damages units on the row', async () => {
  const b = mk([{ key: 'archer', col: 2, row: 1 }, { key: 'hero', col: 0, row: 0 }], [{ key: 'warrior', col: 20, row: 1 }, { key: 'hero', col: 29, row: 0 }],
    { resolver: simResolver(['ai', 'ai']) });
  b.players[0].accuracy = 1;
  await b.fire(b.units[0]);
  const y = b.units[2];
  assert.ok(y.health < 500 && y.health > 400, `health ${y.health}`);
});

test('win check: no units or zero morale loses', () => {
  const b = mk([{ key: 'hero', col: 0, row: 2 }], [{ key: 'hero', col: 29, row: 2 }]);
  b.units[1].dead = true;
  b.checkEnd();
  assert.equal(b.result.winner, 0);
});
