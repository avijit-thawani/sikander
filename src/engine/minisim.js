// Simulated mini-game results: the computer's answers and the "mini-games off" rolls.
import { MELEE_MAX, TAUNT_MAX, CELL_PX } from './data.js';

export const centreX = (col) => col * CELL_PX + CELL_PX / 2;

export function exactPower(dx, angleDeg) {
  return Math.sqrt(Math.abs((dx * 0.3) / Math.sin((2 * angleDeg * Math.PI) / 180)));
}

export function archeryTarget(battle, archer) {
  let best = null;
  for (const u of battle.alive(1 - archer.side)) {
    if (u.row === archer.row && (!best || u.health > best.health)) best = u;
  }
  return best;
}

// mode: 'ai' (uses accuracy) or 'off' (exact 60% of the time).
export function simArchery(battle, archer, mode, accuracy) {
  const rng = battle.rng;
  const t = archeryTarget(battle, archer);
  if (!t) return { power: 0, angle: archer.side === 0 ? 35 : 140, fired: false };
  const dx = centreX(t.col) - centreX(archer.col);
  const angle = dx < 0 ? 140 : 35;
  const exact = exactPower(dx, angle);
  let power;
  if (mode === 'ai') power = rng() < accuracy ? exact : exact * (0.5 + 0.5 * rng());
  else power = rng() < 0.6 ? exact : exact * rng();
  power = Math.min(power, archer.arrowRange);
  return { power, angle, fired: Math.abs(dx) > 200 };
}

export function simMelee(rng, mode, accuracy) {
  if (mode === 'ai') return rng() < accuracy ? MELEE_MAX : MELEE_MAX * accuracy * rng();
  return MELEE_MAX * rng();
}

export function simTaunt(rng, mode, accuracy) {
  if (mode === 'ai') {
    const s = rng() < accuracy ? TAUNT_MAX : TAUNT_MAX * accuracy * rng();
    return { s, completed: true };
  }
  return { s: TAUNT_MAX * rng(), completed: rng() < 0.8 };
}

export function simCharge(rng, unit, mode, accuracy) {
  if (mode === 'ai') return unit.chargeMax * accuracy;
  return unit.chargeMax * rng();
}

// A resolver answers mini-game questions for the engine. This one answers for every
// side with simulated results ('ai' or 'off' per side). The UI wraps it for humans.
export function simResolver(modes = ['off', 'ai']) {
  return {
    async melee(battle, unit) {
      const p = battle.players[unit.side];
      return simMelee(battle.rng, modes[unit.side], p.accuracy);
    },
    async charge(battle, unit) {
      const p = battle.players[unit.side];
      return simCharge(battle.rng, unit, modes[unit.side], p.accuracy);
    },
    async taunt(battle, unit) {
      const p = battle.players[unit.side];
      return simTaunt(battle.rng, modes[unit.side], p.accuracy);
    },
    async archery(battle, unit) {
      const p = battle.players[unit.side];
      return simArchery(battle, unit, modes[unit.side], p.accuracy);
    },
  };
}
