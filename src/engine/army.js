// Army building: costs, budgets, random selection and automatic deployment.
import { ARMIES, TIERS, TIER_CAP, unitCost, ROWS, COLS, ZONE_WIDTH } from './data.js';

export function selectionCost(armyKey, counts) {
  return TIERS.reduce((s, t) => s + (counts[t] || 0) * unitCost(armyKey, t), 0);
}

export function canAdd(armyKey, counts, tier, budget) {
  if (tier === 'hero') return (counts.hero || 0) < 1;
  if ((counts[tier] || 0) >= TIER_CAP) return false;
  return selectionCost(armyKey, counts) + unitCost(armyKey, tier) <= budget;
}

export function selectionValid(armyKey, counts, budget) {
  const nonHero = (counts.elite || 0) + (counts.warrior || 0) + (counts.archer || 0);
  return counts.hero === 1 && nonHero > 0 && selectionCost(armyKey, counts) <= budget &&
    ['elite', 'warrior', 'archer'].every((t) => (counts[t] || 0) <= TIER_CAP);
}

// Spec 02 §3.4: pick uniformly among the 4 tiers until nothing affordable remains.
export function randomSelection(armyKey, budget, rng) {
  const counts = { hero: 1, elite: 0, warrior: 0, archer: 0 };
  let bank = budget;
  const cost = Object.fromEntries(TIERS.map((t) => [t, unitCost(armyKey, t)]));
  while (TIERS.some((t) => cost[t] > 0 && cost[t] <= bank)) {
    const t = TIERS[Math.floor(rng() * 4)];
    if (cost[t] > 0 && cost[t] <= bank) { counts[t]++; bank -= cost[t]; }
  }
  return counts;
}

// Ordered list of unit keys for a selection (hero first).
export function expandSelection(counts) {
  const out = [];
  for (const t of TIERS) for (let i = 0; i < (counts[t] || 0); i++) out.push(t);
  return out;
}

export function zoneCols(side) {
  return side === 0 ? [0, ZONE_WIDTH - 1] : [COLS - ZONE_WIDTH, COLS - 1];
}

export function inZone(side, col, row) {
  const [a, b] = zoneCols(side);
  return row >= 0 && row < ROWS && col >= a && col <= b;
}

const edgeCol = (side, offset) => (side === 0 ? offset : COLS - 1 - offset);

// Spec 02 §1.6: the human's pre-arrangement.
export function autoArrange(counts, side = 0) {
  const start = { hero: [0, 2], elite: [1, 0], warrior: [2, 0], archer: [3, 0] };
  const taken = new Set();
  const out = [];
  let offset = 0;
  for (const key of expandSelection(counts)) {
    const [sc, sr] = start[key];
    let r = sr;
    for (let guard = 0; guard < 200; guard++) {
      const c = Math.min(sc + offset, ZONE_WIDTH - 1);
      const id = `${c},${r}`;
      if (!taken.has(id)) { taken.add(id); out.push({ key, col: edgeCol(side, c), row: r }); break; }
      r++;
      if (r > ROWS - 1) { offset++; r = sr; }
    }
  }
  return out;
}

// Spec 02 §1.8: computer skirmish layout.
export function computerLayout(counts, side = 1) {
  const order = ['hero', 'archer', 'elite', 'warrior'];
  const rows = [2, 1, 3, 0, 4];
  const out = [];
  let col = 0;
  for (const t of order) {
    const n = counts[t] || 0;
    for (let i = 0; i < n; i++) {
      if (i > 0 && i % 5 === 0) col++;
      out.push({ key: t, col: edgeCol(side, col), row: rows[i % 5] });
    }
    col++;
  }
  return out;
}

// Campaign fixed layout (template rows top to bottom = grid rows 4..0, cols 24..29).
export function campaignLayout(level) {
  return level.layout.flatMap((cells, s) => cells.map((key, j) => key && { key, col: 24 + j, row: 4 - s }))
    .filter(Boolean);
}

export function tierOf(armyKey, key) {
  return ARMIES[armyKey].units[key].tier;
}
