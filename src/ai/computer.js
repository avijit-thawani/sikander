// Computer opponent: per-round decision tree from the design spec (02 §5).
import { DIFFICULTY, BEHAVIOUR_BIAS, COLS, ROWS, CELL_PX } from '../engine/data.js';
import { exactPower } from '../engine/minisim.js';

export function strength(b, u, e) {
  const eps = 1e-6;
  return b.def(u) / Math.max(eps, b.def(e)) + u.health / Math.max(eps, e.health) +
    b.atk(u) / Math.max(eps, b.atk(e)) + b.unitMorale(u) / Math.max(0.01, b.unitMorale(e)) - 4;
}

export function archerInRange(u, e) {
  const dx = (e.col - u.col) * CELL_PX;
  if (dx === 0) return false;
  const angle = dx < 0 ? 140 : -325;
  return exactPower(dx, angle) <= u.arrowRange + 1.5 && Math.abs(dx) > 200;
}

function rowWeights(b, side) {
  const w = Array.from({ length: ROWS }, () => ({ mine: 0, theirs: 0, enemies: 0 }));
  const val = (u) => b.def(u) + b.unitMorale(u) + u.health + b.atk(u);
  for (const u of b.units) {
    if (!b.isActive(u)) continue;
    if (u.side === side) w[u.row].mine += val(u);
    else { w[u.row].theirs += val(u); w[u.row].enemies++; }
  }
  return { w, val };
}

// Rows where the AI is outnumbered attract its spare units.
export function chooseLayer(b, u, weights, forced = false) {
  const { w, val } = weights;
  const ratio = (r) => (w[r].theirs ? w[r].mine / w[r].theirs : Infinity);
  const cur = w[u.row];
  const strongHere = cur.theirs > 0 && ratio(u.row) > 1 && (cur.mine - val(u)) / cur.theirs > 1;
  const emptyHere = cur.enemies === 0;
  if (!forced && !strongHere && !emptyHere) return u.row;
  let best = u.row, bestR = Infinity;
  for (let r = 0; r < ROWS; r++) {
    if (!w[r].enemies || (forced && r === u.row)) continue;
    const rr = ratio(r);
    if (rr < bestR || (rr === bestR && Math.abs(r - u.row) < Math.abs(best - u.row))) { best = r; bestR = rr; }
  }
  if (best !== u.row) { w[u.row].mine -= val(u); w[best].mine += val(u); }
  return best;
}

// Spec 02 §5.3 checkMovement: clamp, re-pick row on blocks, sidestep occupied targets, truncate.
export function checkMovement(b, u, target, weights) {
  let col = Math.max(0, Math.min(COLS - 1, target.col));
  let row = target.row;
  let p = b.findPath(u, { col, row }, 99);
  if (!p.reached && b.isBlock(col, row)) row = chooseLayer(b, u, weights, true);
  if (!b.isEmpty(col, row)) {
    if (b.isEmpty(col - 1, row)) col -= 1;
    else if (b.isEmpty(col + 1, row)) col += 1;
  }
  p = b.findPath(u, { col, row }, u.movement);
  let cells = p.cells;
  while (cells.length > 1 && !b.isEmpty(cells[cells.length - 1].col, cells[cells.length - 1].row)) cells = cells.slice(0, -1);
  const end = cells[cells.length - 1];
  if (end.col === u.col && end.row === u.row) return null;
  return { unitId: u.id, type: 'move', target: { col: end.col, row: end.row } };
}

export function planAI(b, side, rng = b.rng) {
  const diff = DIFFICULTY[b.difficulty];
  const acc = b.players[side].accuracy;
  const cmds = [];
  const weights = rowWeights(b, side);
  const enemiesOf = () => b.alive(1 - side);
  const dirTo = (u, e) => Math.sign(e.col - u.col) || b.players[side].dir;
  const push = (c) => { if (c && b.validate(side, c, cmds) === null) { cmds.push(c); return true; } return false; };

  // Formations: first wedge and first shield wall only.
  const done = new Set();
  for (const g of b.groups.values()) {
    if (g.side !== side || done.has(g.type)) continue;
    done.add(g.type);
    const lead = b.units[g.leadId];
    for (const id of g.members) {
      const m = b.units[id];
      const foes = enemiesOf().filter((e) => e.row === m.row);
      if (!foes.length) continue;
      foes.sort((x, y) => Math.abs(x.col - m.col) - Math.abs(y.col - m.col));
      const s = Math.sign(foes[0].col - m.col) || b.players[side].dir;
      const steps = b.groupSlide(g, s * (b.groupMovement(g) - 1), true);
      if (steps > 0) push({ groupId: g.id, type: 'move', target: { col: lead.col + s * steps, row: lead.row } });
      break;
    }
  }

  const moraleAction = (u) => {
    const tauntIt = b.unitMorale(u) < 0.5 || b.armyMorale(1 - side) > b.armyMorale(side) + 0.1 || u.isArcher;
    if (tauntIt || !push({ unitId: u.id, type: 'fortify' })) push({ unitId: u.id, type: 'taunt' });
  };
  const moveTo = (u, col, row) => push(checkMovement(b, u, { col, row }, weights));
  const retreat = (u, e, dist) => {
    const away = -dirTo(u, e);
    if (!moveTo(u, u.col + away * dist, u.row)) push({ unitId: u.id, type: 'fortify' }) || push({ unitId: u.id, type: 'taunt' });
  };

  for (const u of b.alive(side)) {
    if (u.group) continue;
    const bias = BEHAVIOUR_BIAS[u.behaviour] ?? 0;
    const T = diff.aggression + bias;
    if (u.engaged.size === 0) {
      if (b.unitMorale(u) < 0.4 && rng() < acc) { moraleAction(u); continue; }
      const row = chooseLayer(b, u, weights);
      const near = enemiesOf().filter((e) => e.row === row && Math.abs(e.col - u.col) <= u.movement + 1)
        .sort((x, y) => Math.abs(x.col - u.col) - Math.abs(y.col - u.col));
      if (near.length) {
        const e = near[0];
        const W = strength(b, u, e);
        const dist = Math.abs(e.col - u.col) + Math.abs(e.row - u.row);
        if (W >= T) {
          if (u.isArcher) { if (e.row === u.row && archerInRange(u, e)) push({ unitId: u.id, type: 'fire' }); else moveTo(u, e.col - dirTo(u, e), e.row); }
          else moveTo(u, e.col - dirTo(u, e), e.row);
        } else if (dist + 1 <= e.movement) {
          if (!u.isArcher && (b.atk(e) * (1 - b.def(u))) / u.health < 1 - bias) push({ unitId: u.id, type: 'fortify' }) || moraleAction(u);
          else retreat(u, e, Math.max(1, e.movement - dist));
        } else moraleAction(u);
      } else if (u.behaviour === 'cowardly') {
        const archersInRow = enemiesOf().some((e) => e.row === u.row && e.isArcher);
        if (archersInRow) {
          const r2 = u.row < ROWS - 1 ? u.row + 1 : u.row - 1;
          if (!moveTo(u, u.col, r2)) push({ unitId: u.id, type: 'taunt' });
        } else push({ unitId: u.id, type: 'taunt' });
      } else {
        const inRow = enemiesOf().filter((e) => e.row === u.row).sort((x, y) => Math.abs(x.col - u.col) - Math.abs(y.col - u.col));
        if (inRow.length) {
          const e = inRow[0];
          if (u.isArcher && archerInRange(u, e)) push({ unitId: u.id, type: 'fire' });
          else if (!moveTo(u, e.col - dirTo(u, e), u.row)) moraleAction(u);
        } else {
          const dir = b.players[side].dir;
          const best = chooseLayer(b, u, weights, true);
          const dr = Math.max(-(u.movement - 1), Math.min(u.movement - 1, best - u.row));
          const dc = dir * (u.movement - 1 - Math.abs(dr));
          if (!moveTo(u, u.col + dc, u.row + dr)) moraleAction(u);
        }
      }
    } else if (u.engaged.size === 1) {
      const e = b.units[[...u.engaged][0]];
      if (strength(b, u, e) < T) retreat(u, e, u.movement - 1);
    }
  }
  return cmds;
}
