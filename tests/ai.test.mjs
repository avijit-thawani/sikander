import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/engine/battle.js';
import { createRng } from '../src/engine/rng.js';
import { randomSelection, autoArrange, computerLayout, campaignLayout } from '../src/engine/army.js';
import { simResolver } from '../src/engine/minisim.js';
import { planAI } from '../src/ai/computer.js';
import { AIPacer } from '../src/ai/pacer.js';
import { ARMY_KEYS, CAMPAIGN } from '../src/engine/data.js';

function randomBattle(seed, maxRounds = 60) {
  const rng = createRng(seed * 7919);
  const a0 = rng.pick(ARMY_KEYS), a1 = rng.pick(ARMY_KEYS);
  const budget = [14, 20, 26][rng.int(3)];
  const map = 1 + rng.int(3);
  return new Battle({ map, armies: [a0, a1], seed, ai: [true, true], maxRounds,
    difficulty: ['easy', 'medium', 'hard'][seed % 3], resolver: simResolver(['ai', 'ai']),
    placements: [autoArrange(randomSelection(a0, budget, rng), 0), computerLayout(randomSelection(a1, budget, rng), 1)] });
}

test('AI produces only legal orders', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const b = randomBattle(seed);
    for (const side of [0, 1]) {
      const cmds = planAI(b, side);
      assert.ok(cmds.length > 0, 'AI gives at least one order at the start');
      const seen = [];
      for (const c of cmds) { assert.equal(b.validate(side, c, seen), null, JSON.stringify(c)); seen.push(c); }
    }
  }
});

test('full AI-vs-AI battles terminate with a result', async () => {
  const outcomes = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const b = randomBattle(seed);
    let guard = 0;
    while (!b.over && guard++ < 100) {
      const c0 = planAI(b, 0), c1 = planAI(b, 1);
      for (const [s, cs] of [[0, c0], [1, c1]]) { const seen = []; for (const c of cs) { assert.equal(b.validate(s, c, seen), null); seen.push(c); } }
      await b.runRound(c0, c1);
    }
    assert.ok(b.over, `seed ${seed} did not finish`);
    assert.ok(b.result.rounds <= 61);
    outcomes.push(b.result.winner);
  }
  assert.ok(outcomes.some((w) => w !== null), `expected at least one decisive battle: ${outcomes}`);
});

test('battles are deterministic for a seed', async () => {
  const run = async () => {
    const b = randomBattle(42, 30);
    while (!b.over) await b.runRound(planAI(b, 0), planAI(b, 1));
    return JSON.stringify([b.result, b.units.map((u) => u.health)]);
  };
  assert.equal(await run(), await run());
});

test('campaign layouts build valid battles', () => {
  for (const lvl of CAMPAIGN) {
    const b = new Battle({ map: lvl.map, armies: [lvl.player, lvl.computer], seed: 3, placements: [autoArrange(lvl.preset, 0), campaignLayout(lvl)] });
    assert.ok(b.players[1].heroId !== null);
    assert.ok(planAI(b, 1).length > 0);
  }
});

test('pacer releases orders and drops leftovers', () => {
  const p = new AIPacer({ wait: 1.2, rng: createRng(1), now: 0 });
  p.start([1, 2, 3, 4, 5, 6, 7, 8], 0);
  assert.equal(p.tick(5000).length, 0);
  assert.equal(p.tick(6000).length, 1);
  const out = p.onHumanReady();
  assert.ok(out.length >= 1 && out.length <= 4);
  assert.equal(p.queue.length, 0);
});
