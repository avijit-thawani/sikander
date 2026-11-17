// Answers the engine's mini-game questions: interactive for the human (if mini-games are on),
// pre-rolled random results when they are off, and simulated results for the computer.
import { DIFFICULTY, ARMIES } from '../engine/data.js';
import { simMelee, simCharge, simTaunt, simArchery } from '../engine/minisim.js';
import { sleep } from './mgframe.js';
import { playTaunt } from './mg-taunt.js';
import { playCharge } from './mg-charge.js';
import { playMelee } from './mg-melee.js';
import { playArchery } from './mg-archery.js';
import { camera } from './camera.js';

export function uiResolver({ humanSide = 0, minigames, colourOf, caption }) {
  const isHuman = (u) => u.side === humanSide;
  const diffOf = (b) => DIFFICULTY[b.difficulty];
  return {
    async melee(b, u, foe) {
      camera.focus((u.col + foe.col) / 2, 2);
      const acc = b.players[u.side].accuracy;
      if (!isHuman(u)) { const r = simMelee(b.rng, 'ai', acc); await sleep(4000); return r; }
      if (!minigames()) { const r = simMelee(b.rng, 'off', acc); await sleep(2000); return r; }
      return playMelee({ title: `${u.name} vs ${ARMIES[foe.army].name} ${foe.name}`, colour: colourOf(u.side), rng: b.rng });
    },
    async charge(b, u) {
      camera.focus(u.col, 1.9);
      const acc = b.players[u.side].accuracy;
      if (!isHuman(u)) { caption(`${u.name} prepare to charge…`); const r = simCharge(b.rng, u, 'ai', acc); await sleep(3000); return r; }
      if (!minigames()) { const r = simCharge(b.rng, u, 'off', acc); await sleep(2000); return r; }
      return playCharge({ chargeMax: u.chargeMax, N: diffOf(b).chargeN, colour: colourOf(u.side), name: u.name });
    },
    async taunt(b, u, phrase) {
      camera.focus(u.col, 2.1);
      const acc = b.players[u.side].accuracy;
      if (!isHuman(u)) { caption(`${u.name} are taunting…`); const r = simTaunt(b.rng, 'ai', acc); await sleep(3000); return r; }
      if (!minigames()) { const r = simTaunt(b.rng, 'off', acc); await sleep(2000); return r; }
      return playTaunt({ phrase, limit: diffOf(b).tauntTime, colour: colourOf(u.side) });
    },
    async archery(b, u) {
      camera.wide();
      const acc = b.players[u.side].accuracy;
      if (!isHuman(u)) { caption(`${u.name} take aim…`); const r = simArchery(b, u, 'ai', acc); await sleep(3000); return r; }
      if (!minigames()) { const r = simArchery(b, u, 'off', acc); await sleep(2000); return r; }
      return playArchery({ battle: b, archer: u, limit: diffOf(b).archeryTime, colourOf });
    },
  };
}
