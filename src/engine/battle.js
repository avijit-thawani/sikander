// Pure battle rules engine. No DOM. All randomness comes from battle.rng (seeded).
import { ARMIES, DIFFICULTY, MAPS, ROWS, COLS, CELL_PX, UNIT_PX, rank } from './data.js';
import { createRng } from './rng.js';
import { simResolver, centreX } from './minisim.js';
import { inZone } from './army.js';

const BLOCK = -1;
const FORMATION = {
  wall: { name: 'Shield wall', movement: 4, mods: [['defence', 0.25], ['attack', -50]] },
  wedge: { name: 'Wedge', movement: 7, mods: [['attack', 100]] },
};

export class Battle {
  /**
   * opts: { map, armies:[a0,a1], difficulty, seed, ai:[bool,bool], placements:[[{key,col,row}],..],
   *         resolver, hooks:{onEvent}, maxRounds, multiplayer }
   */
  constructor(opts) {
    this.map = MAPS[opts.map || 1];
    this.difficulty = opts.difficulty || 'medium';
    const diff = DIFFICULTY[this.difficulty];
    this.rng = opts.rng || createRng(opts.seed ?? 1);
    this.multiplayer = !!opts.multiplayer;
    this.resolver = opts.resolver || simResolver(opts.ai?.map((a) => (a ? 'ai' : 'off')) || ['off', 'ai']);
    this.hooks = opts.hooks || {};
    this.maxRounds = opts.maxRounds || 60;
    this.round = 1;
    this.phase = 'command';
    this.over = false;
    this.result = null;
    this.events = [];
    this.units = [];
    this.groups = new Map();
    this.engagements = new Map();
    this.nextGroupId = 1;
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    for (const [c, r] of this.map.blocks) this.grid[r][c] = BLOCK;
    const ai = opts.ai || [false, true];
    this.players = [0, 1].map((side) => ({
      side,
      army: opts.armies[side],
      dir: side === 0 ? 1 : -1,
      isAI: ai[side],
      diffMod: this.multiplayer ? 1 : (ai[side] ? diff.aiMod : diff.humanMod),
      accuracy: diff.accuracy,
      moraleMod: 1,
      heroId: null,
      originalCount: 0,
      startHealth: 0,
      tauntIndex: 0,
      stats: { lost: 0, fled: 0, unitsLost: 0, unitsFled: 0, formations: 0, taunts: 0, charges: 0, roundsWon: 0, archerKills: 0 },
    }));
    for (const side of [0, 1]) for (const p of opts.placements[side]) this.addUnit(side, p.key, p.col, p.row);
    for (const side of [0, 1]) {
      const pl = this.players[side];
      pl.originalCount = this.units.filter((u) => u.side === side).length;
      pl.startHealth = this.units.filter((u) => u.side === side).reduce((s, u) => s + u.hp, 0);
    }
    this.detectFormations(0, 0, COLS - 1, true);
    this.detectFormations(1, 0, COLS - 1, true);
  }

  // ---------- setup ----------
  addUnit(side, key, col, row) {
    const army = this.players[side].army;
    const d = ARMIES[army].units[key];
    if (!d) throw new Error(`unknown unit ${army}/${key}`);
    if (this.grid[row][col] !== null) throw new Error(`cell ${col},${row} not free`);
    const u = {
      id: this.units.length, side, army, key, tier: d.tier, name: d.name,
      hp: d.hp, health: d.hp, attack: d.attack, defence: d.defence, morale: d.morale,
      movement: d.movement, speed: d.speed, chargeMax: d.chargeMax || 0, chargeDist: d.chargeDist || 0,
      arrowDamage: d.arrowDamage || 0, arrowRange: d.arrowRange || 0,
      isArcher: d.tier === 'archer', isCharge: d.tier !== 'archer', canForm: d.tier !== 'archer' && !d.noFormation,
      mounted: !!d.mounted, behaviour: d.behaviour || 'neutral',
      col, row, mods: [], engaged: new Set(), group: null, dead: false, fled: false,
    };
    this.units.push(u);
    this.grid[row][col] = u.id;
    if (u.tier === 'hero') this.players[side].heroId = u.id; // last placed hero is tracked
    return u;
  }

  // ---------- queries ----------
  unitAt(col, row) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    const v = this.grid[row][col];
    return v === null || v === BLOCK ? null : this.units[v];
  }
  isBlock(col, row) { return this.grid[row]?.[col] === BLOCK; }
  isEmpty(col, row) { return row >= 0 && row < ROWS && col >= 0 && col < COLS && this.grid[row][col] === null; }
  alive(side) { return this.units.filter((u) => u.side === side && !u.dead && !u.fled); }
  isActive(u) { return u && !u.dead && !u.fled; }

  modSum(u, type) { return u.mods.reduce((s, m) => (m.type === type ? s + m.value : s), 0); }
  atk(u) {
    let a = u.attack + this.modSum(u, 'attack');
    if (u.engaged.size >= 2) a -= u.attack / 2;
    return Math.max(0, a);
  }
  def(u) { return Math.min(0.95, u.defence + this.modSum(u, 'defence')); }
  isFortified(u) { return u.mods.some((m) => m.src === 'fortify'); }

  heroGone(side) {
    const id = this.players[side].heroId;
    if (id === null) return false;
    const h = this.units[id];
    return h.dead || h.fled;
  }
  unitMorale(u) {
    const p = this.players[u.side];
    const mult = p.moraleMod * (this.heroGone(u.side) ? 0.2 : 1);
    const m = (u.health / u.hp) * (u.morale + this.modSum(u, 'morale')) * mult * p.diffMod;
    return Math.max(0, Math.min(1, m));
  }
  armyMorale(side) {
    const p = this.players[side];
    if (!p.originalCount) return 0;
    const sum = this.alive(side).reduce((s, u) => s + this.unitMorale(u), 0);
    return Math.min(1, sum / p.originalCount);
  }
  armyHealth(side) { return this.alive(side).reduce((s, u) => s + u.health, 0); }

  // ---------- events ----------
  async emit(evt) {
    evt.round = this.round;
    this.events.push(evt);
    if (this.hooks.onEvent) await this.hooks.onEvent(evt, this);
  }

  // ---------- modifiers ----------
  addMod(u, type, value, src, life = 0) { u.mods.push({ type, value, src, life }); }
  removeMods(u, src) { u.mods = u.mods.filter((m) => m.src !== src); }

  // ---------- formations ----------
  formationCapable(u, side) { return u && u.side === side && u.canForm && !u.group && this.isActive(u); }

  detectFormations(side, fromCol, toCol, silent = false) {
    const found = [];
    const dir = this.players[side].dir;
    for (let c = Math.max(0, fromCol); c <= Math.min(COLS - 1, toCol); c++) {
      for (let r = 0; r <= ROWS - 3; r++) {
        const a = this.unitAt(c, r), b = this.unitAt(c, r + 1), d = this.unitAt(c, r + 2);
        if ([a, b, d].every((x) => this.formationCapable(x, side))) {
          found.push(this.makeGroup(side, 'wall', [a, b, d], b));
          continue;
        }
        const tip = this.unitAt(c + dir, r + 1);
        if ([a, tip, d].every((x) => this.formationCapable(x, side))) found.push(this.makeGroup(side, 'wedge', [a, tip, d], tip));
      }
    }
    if (!silent) for (const g of found) this.events.push({ type: 'formation', round: this.round, side, group: g.id, text: `${ARMIES[this.players[side].army].name} form a ${FORMATION[g.type].name.toLowerCase()}.` });
    return found;
  }

  makeGroup(side, type, members, lead) {
    const g = { id: this.nextGroupId++, side, type, members: members.map((m) => m.id), leadId: lead.id };
    this.groups.set(g.id, g);
    for (const m of members) {
      m.group = g.id;
      this.removeMods(m, 'fortify');
      for (const [t, v] of FORMATION[type].mods) this.addMod(m, t, v, 'group');
    }
    this.players[side].stats.formations++;
    return g;
  }

  dissolveGroup(gid) {
    const g = this.groups.get(gid);
    if (!g) return;
    for (const id of g.members) { const m = this.units[id]; m.group = null; this.removeMods(m, 'group'); }
    this.groups.delete(gid);
  }

  groupMovement(g) { return FORMATION[g.type].movement; }
  groupName(g) { return FORMATION[g.type].name; }

  // ---------- engagement ----------
  engKey(a, b) { return a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`; }
  engage(a, b) {
    a.engaged.add(b.id); b.engaged.add(a.id);
    this.engagements.set(this.engKey(a, b), [a.id, b.id]);
  }
  disengage(a, b) {
    a.engaged.delete(b.id); b.engaged.delete(a.id);
    this.engagements.delete(this.engKey(a, b));
  }
  clearEngagements(u) { for (const id of [...u.engaged]) this.disengage(u, this.units[id]); }

  // ---------- movement ----------
  passable(u, col, row, ignore = null) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    const v = this.grid[row][col];
    if (v === BLOCK) return false;
    if (v === null) return true;
    if (ignore && ignore.has(v)) return true;
    const o = this.units[v];
    if (o.id === u.id) return true;
    return o.side === u.side && o.engaged.size === 0;
  }

  buildPath(u, from, to, colsFirst, ignore) {
    const cells = [{ col: from.col, row: from.row }];
    let { col, row } = from;
    const legs = colsFirst ? ['col', 'row'] : ['row', 'col'];
    let turn = null;
    for (const axis of legs) {
      const goal = axis === 'col' ? to.col : to.row;
      while ((axis === 'col' ? col : row) !== goal) {
        const nc = axis === 'col' ? col + Math.sign(goal - col) : col;
        const nr = axis === 'row' ? row + Math.sign(goal - row) : row;
        if (!this.passable(u, nc, nr, ignore)) return { cells, turn, reached: false };
        col = nc; row = nr;
        cells.push({ col, row });
      }
      if (!turn) turn = { col, row };
    }
    return { cells, turn, reached: true };
  }

  // Greedy L-shaped path, columns first then rows first; truncated to maxCells (start included).
  findPath(u, to, maxCells = u.movement, ignore = null) {
    let p = this.buildPath(u, u, to, true, ignore);
    if (!p.reached) {
      const q = this.buildPath(u, u, to, false, ignore);
      if (q.reached || q.cells.length > p.cells.length) p = q;
    }
    if (p.cells.length > maxCells) { p.cells = p.cells.slice(0, maxCells); p.reached = false; }
    return p;
  }

  inRange(u, col, row, movement = u.movement) {
    return Math.abs(col - u.col) + Math.abs(row - u.row) + 1 <= movement;
  }

  reachableCells(u) {
    const out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if ((c === u.col && r === u.row) || !this.inRange(u, c, r) || !this.isEmpty(c, r)) continue;
      const p = this.findPath(u, { col: c, row: r });
      if (p.reached) out.push({ col: c, row: r });
    }
    return out;
  }

  groupReachable(g) {
    const lead = this.units[g.leadId];
    const gm = this.groupMovement(g);
    const out = [];
    for (let c = 0; c < COLS; c++) {
      if (c === lead.col || Math.abs(c - lead.col) + 1 > gm) continue;
      if (this.groupSlide(g, c - lead.col, true) === Math.abs(c - lead.col)) out.push({ col: c, row: lead.row });
    }
    return out;
  }

  // How many steps the group can slide by dx (dry run if test=true).
  groupSlide(g, dx, test) {
    const members = g.members.map((id) => this.units[id]);
    const ids = new Set(g.members);
    const s = Math.sign(dx);
    let steps = 0;
    for (let i = 1; i <= Math.abs(dx); i++) {
      const ok = members.every((m) => {
        const c = m.col + s * i;
        if (c < 0 || c >= COLS) return false;
        const v = this.grid[m.row][c];
        return v === null || ids.has(v);
      });
      if (!ok) break;
      steps = i;
    }
    return steps;
  }

  findContacts(u) {
    const out = [];
    const dir = this.players[u.side].dir;
    for (const dc of [dir, -dir]) {
      const o = this.unitAt(u.col + dc, u.row);
      if (o && o.side !== u.side && this.isActive(o) && !u.engaged.has(o.id)) out.push(o);
    }
    return out;
  }

  placeAt(u, col, row) {
    if (this.grid[u.row][u.col] === u.id) this.grid[u.row][u.col] = null;
    u.col = col; u.row = row;
    this.grid[row][col] = u.id;
  }

  // ---------- commands ----------
  /** Returns null if legal, else a reason string. */
  validate(side, cmd, existing = []) {
    if (cmd.groupId) {
      const g = this.groups.get(cmd.groupId);
      if (!g || g.side !== side) return 'no such formation';
      if (cmd.type !== 'move') return 'formations can only move';
      if (existing.some((c) => c.groupId === g.id || g.members.includes(c.unitId))) return 'already has an order';
      const lead = this.units[g.leadId];
      if (cmd.target.row !== lead.row) return 'formations move along their row';
      if (Math.abs(cmd.target.col - lead.col) + 1 > this.groupMovement(g)) return 'out of range';
      if (cmd.target.col === lead.col) return 'no movement';
      return null;
    }
    const u = this.units[cmd.unitId];
    if (!u || u.side !== side) return 'not your unit';
    if (!this.isActive(u)) return 'unit is gone';
    if (existing.some((c) => c.unitId === u.id || (u.group && c.groupId === u.group))) return 'already has an order';
    const engaged = u.engaged.size > 0;
    switch (cmd.type) {
      case 'move': {
        const t = cmd.target;
        if (!t || t.col < 0 || t.col >= COLS || t.row < 0 || t.row >= ROWS) return 'off the field';
        if (t.col === u.col && t.row === u.row) return 'no movement';
        if (!this.inRange(u, t.col, t.row)) return 'out of range';
        if (this.isBlock(t.col, t.row)) return 'impassable';
        if (!this.isEmpty(t.col, t.row)) return 'cell occupied';
        return null;
      }
      case 'fire':
        if (!u.isArcher) return 'only archers fire';
        if (engaged) return 'engaged in melee';
        return null;
      case 'fortify':
        if (u.isArcher) return 'archers cannot fortify';
        if (engaged) return 'engaged in melee';
        if (this.isFortified(u)) return 'already fortified';
        return null;
      case 'taunt':
        if (engaged) return 'engaged in melee';
        return null;
      default:
        return 'unknown command';
    }
  }

  legalCommandTypes(u) {
    return ['move', 'fire', 'fortify', 'taunt'].filter((t) =>
      t === 'move' ? true : this.validate(u.side, { unitId: u.id, type: t }) === null);
  }

  /** Interleave two ordered command lists. Round 1 the left side starts; then it swaps. */
  interleave(cmds0, cmds1) {
    const first = this.round % 2 === 1 ? 0 : 1;
    const lists = first === 0 ? [cmds0, cmds1] : [cmds1, cmds0];
    const sides = first === 0 ? [0, 1] : [1, 0];
    const out = [];
    for (let i = 0; i < Math.max(cmds0.length, cmds1.length); i++) {
      for (let k = 0; k < 2; k++) if (lists[k][i]) out.push({ side: sides[k], cmd: lists[k][i] });
    }
    return out;
  }

  // ---------- round ----------
  async runRound(cmds0, cmds1) {
    if (this.over) return this.result;
    this.phase = 'execute';
    await this.emit({ type: 'phase', phase: 'execute', text: `Round ${this.round} – Executing Commands` });
    for (const { side, cmd } of this.interleave(cmds0, cmds1)) {
      if (this.over) break;
      await this.execute(side, cmd);
      this.checkEnd();
    }
    if (!this.over) await this.engagementPhase();
    this.checkEnd();
    if (!this.over) {
      for (const u of this.units) u.mods = u.mods.filter((m) => m.life !== 1);
      this.round++;
      if (this.round > this.maxRounds) {
        this.finish(null, 'stalemate');
      } else {
        this.phase = 'command';
        await this.emit({ type: 'phase', phase: 'command', text: `Round ${this.round} – Select Commands` });
      }
    }
    return this.result;
  }

  async execute(side, cmd) {
    if (cmd.groupId) {
      const g = this.groups.get(cmd.groupId);
      if (!g) return;
      return this.moveGroup(g, cmd.target);
    }
    const u = this.units[cmd.unitId];
    if (!this.isActive(u)) return;
    if (this.validate(side, cmd) !== null && cmd.type !== 'move') {
      await this.emit({ type: 'skip', unit: u.id, text: `${this.label(u)} cannot ${cmd.type} now.` });
      return;
    }
    this.removeMods(u, 'fortify');
    if (u.group) this.dissolveGroup(u.group);
    if (cmd.type === 'move') return this.moveUnit(u, cmd.target);
    if (cmd.type === 'fortify') {
      if (await this.startCheck(u)) return;
      this.addMod(u, 'defence', 0.2, 'fortify');
      return this.emit({ type: 'fortify', unit: u.id, text: `${this.label(u)} fortify (+0.20 defence).` });
    }
    if (cmd.type === 'taunt') return this.taunt(u);
    if (cmd.type === 'fire') return this.fire(u);
  }

  label(u) { return `${ARMIES[u.army].name} ${u.name}`; }

  async startCheck(u) {
    return this.moraleCheck(u, 'loses heart before acting');
  }

  // ---------- move & charge ----------
  chargeEligible(u, path) {
    if (!u.isCharge || u.engaged.size > 0) return null;
    if (path.length < u.chargeDist) return null;
    for (const c of path) { const o = this.unitAt(c.col, c.row); if (o && o.side === u.side && o.engaged.size) return null; }
    for (const e of this.alive(1 - u.side)) {
      if (e.row !== u.row || Math.abs(e.col - u.col) < u.chargeDist) continue;
      if (path.some((c) => c.row === e.row && Math.abs(c.col - e.col) <= 1)) return e;
    }
    return null;
  }

  async moveUnit(u, target) {
    const p = this.findPath(u, target);
    const cells = p.cells;
    const chargeTarget = this.chargeEligible(u, cells);
    if (chargeTarget) {
      const bonus = await this.resolver.charge(this, u);
      this.addMod(u, 'attack', bonus, 'charge', 1);
      if (bonus > 0.6 * u.chargeMax) this.players[u.side].stats.charges++;
      await this.emit({ type: 'charge', unit: u.id, bonus, text: `${this.label(u)} CHARGE! (+${Math.round(bonus)} attack)` });
    } else if (await this.startCheck(u)) return;
    const from = { col: u.col, row: u.row };
    let moved = false;
    let contact = null;
    for (let i = 1; i < cells.length; i++) {
      const c = cells[i];
      if (!this.passable(u, c.col, c.row)) break;
      if (!this.isEmpty(c.col, c.row)) continue; // passing through a friend
      if (u.engaged.size) this.clearEngagements(u);
      this.placeAt(u, c.col, c.row);
      moved = true;
      const contacts = this.findContacts(u);
      if (contacts.length) { contact = contacts; break; }
    }
    if (moved) {
      await this.emit({ type: 'move', unit: u.id, from, to: { col: u.col, row: u.row }, charge: !!chargeTarget,
        text: `${this.label(u)} ${chargeTarget ? 'charge' : 'move'} to column ${u.col + 1}, row ${u.row + 1}.` });
    } else {
      await this.emit({ type: 'move', unit: u.id, from, to: from, text: `${this.label(u)} cannot advance.` });
    }
    if (contact) await this.makeContact(u, contact, !!chargeTarget);
    if (this.isActive(u) && !u.group) this.detectFormations(u.side, u.col - u.movement, u.col + u.movement);
  }

  async makeContact(mover, enemies, fromCharge) {
    const before = { m: mover.engaged.size, e: enemies.map((e) => e.engaged.size) };
    for (const e of enemies) this.engage(mover, e);
    const y = enemies[0];
    await this.emit({ type: 'engage', unit: mover.id, target: y.id, text: `${this.label(mover)} clash with ${this.label(y)}!` });
    const mini = !fromCharge && !mover.group && !y.group && before.m < 2 && before.e[0] < 2;
    if (mini) await this.meleeMinigame(mover, y);
    await this.strike(mover, y);
  }

  async moveGroup(g, target) {
    const lead = this.units[g.leadId];
    const members = g.members.map((id) => this.units[id]);
    const gm = this.groupMovement(g);
    let dx = target.col - lead.col;
    if (Math.abs(dx) + 1 > gm) dx = Math.sign(dx) * (gm - 1);
    const steps = this.groupSlide(g, dx);
    const s = Math.sign(dx);
    let chargeTarget = null;
    if (g.type === 'wedge' && steps > 0) {
      const path = [];
      for (let i = 0; i <= steps; i++) path.push({ col: lead.col + s * i, row: lead.row });
      chargeTarget = this.chargeEligible(lead, path);
    }
    if (chargeTarget) {
      const bonus = await this.resolver.charge(this, lead);
      this.addMod(lead, 'attack', bonus, 'charge', 1);
      if (bonus > 0.6 * lead.chargeMax) this.players[g.side].stats.charges++;
      await this.emit({ type: 'charge', unit: lead.id, bonus, text: `The wedge led by ${this.label(lead)} CHARGES! (+${Math.round(bonus)} attack)` });
    } else {
      for (const m of members) if (await this.moraleCheck(m, 'loses heart')) return;
    }
    const contacts = [];
    const order = [...members].sort((a, b) => s * (b.col - a.col));
    for (let i = 1; i <= steps; i++) {
      for (const m of members) if (m.engaged.size) this.clearEngagements(m);
      for (const m of order) this.grid[m.row][m.col] = null;
      for (const m of order) { m.col += s; this.grid[m.row][m.col] = m.id; }
      for (const m of members) { const c = this.findContacts(m); if (c.length) contacts.push([m, c]); }
      if (contacts.length) break;
    }
    await this.emit({ type: 'move', group: g.id, unit: lead.id, charge: !!chargeTarget,
      text: `${ARMIES[this.players[g.side].army].name} ${this.groupName(g).toLowerCase()} advances ${steps} column${steps === 1 ? '' : 's'}.` });
    for (const [m, es] of contacts) {
      if (!this.isActive(m) || this.over) continue;
      const live = es.filter((e) => this.isActive(e));
      if (live.length) await this.makeContact(m, live, !!chargeTarget);
    }
  }

  // ---------- melee ----------
  async meleeMinigame(a, b) {
    this.removeMods(a, 'fortify');
    this.removeMods(b, 'fortify');
    const [ba, bb] = await Promise.all([this.resolver.melee(this, a, b), this.resolver.melee(this, b, a)]);
    this.addMod(a, 'attack', ba, 'melee', 1);
    this.addMod(b, 'attack', bb, 'melee', 1);
    if (ba > bb) this.players[a.side].stats.roundsWon++;
    else if (bb > ba) this.players[b.side].stats.roundsWon++;
    await this.emit({ type: 'melee', a: a.id, b: b.id, ba, bb,
      text: `Fight! ${ARMIES[a.army].name} +${Math.round(ba)} attack, ${ARMIES[b.army].name} +${Math.round(bb)} attack.` });
  }

  static meleeDamage(attack, diffMod, defence) { return Math.round(attack * diffMod * (1 - defence)); }

  async strike(x, y) {
    const px = this.players[x.side], py = this.players[y.side];
    const dmgY = Math.min(y.health, Battle.meleeDamage(this.atk(x), px.diffMod, this.def(y)));
    y.health -= dmgY;
    const yDies = y.health <= 0;
    let dmgX = Battle.meleeDamage(this.atk(y) * (yDies ? 0.5 : 1), py.diffMod, this.def(x));
    dmgX = Math.min(x.health, dmgX);
    x.health -= dmgX;
    await this.emit({ type: 'strike', x: x.id, y: y.id, dmgX, dmgY,
      text: `${this.label(x)} strike ${this.label(y)}: ${dmgY} dead. They answer: ${dmgX} dead.` });
    await this.afterDamage(y, dmgY);
    await this.afterDamage(x, dmgX);
  }

  async afterDamage(u, dmg) {
    if (u.dead || u.fled) return;
    if (u.health <= 0) return this.kill(u);
    if (dmg > 0) await this.moraleCheck(u, 'break and flee');
  }

  async kill(u) {
    u.dead = true;
    u.health = 0;
    this.removeFromField(u);
    const p = this.players[u.side];
    p.stats.unitsLost++;
    await this.emit({ type: 'death', unit: u.id, text: `${this.label(u)} are destroyed!` });
  }

  removeFromField(u) {
    if (this.grid[u.row][u.col] === u.id) this.grid[u.row][u.col] = null;
    this.clearEngagements(u);
    if (u.group) this.dissolveGroup(u.group);
  }

  // ---------- morale ----------
  /** Returns true if the unit fled. */
  async moraleCheck(u, why = 'flee') {
    if (!this.isActive(u)) return false;
    const m = this.unitMorale(u);
    const flees = this.multiplayer ? m < 0.15 : m < 0.2 && this.rng() > m / 0.4;
    if (!flees) return false;
    u.fled = true;
    this.removeFromField(u);
    const p = this.players[u.side];
    p.stats.fled += u.health;
    p.stats.unitsFled++;
    await this.emit({ type: 'flee', unit: u.id, text: `${this.label(u)} ${why}! (morale ${Math.round(m * 100)}%)` });
    return true;
  }

  // ---------- taunt ----------
  async taunt(u) {
    const p = this.players[u.side], o = this.players[1 - u.side];
    const idx = p.tauntIndex++ % 6;
    const phrase = ARMIES[u.army].taunts[idx];
    const r = await this.resolver.taunt(this, u, phrase, idx);
    const s = Math.max(0, r.s);
    p.moraleMod += s;
    o.moraleMod -= s;
    p.stats.taunts++;
    await this.emit({ type: 'taunt', unit: u.id, phrase, idx, s, completed: r.completed,
      text: `${this.label(u)} taunt: "${phrase}" (morale shift ${(s * 100).toFixed(1)}%)` });
  }

  // ---------- archery ----------
  static landingX(x0, power, angleDeg) {
    const a = (angleDeg * Math.PI) / 180;
    let x = x0, h = 25, vx = power * Math.cos(a), vy = power * Math.sin(a);
    const fieldW = COLS * CELL_PX;
    for (let i = 0; i < 10000; i++) {
      x += vx * 2; h += vy * 2; vy -= 0.6;
      if (h <= 0) return x;
      if (x < -200 || x > fieldW + 200) return null;
    }
    return x;
  }

  async fire(u) {
    const shot = await this.resolver.archery(this, u);
    const p = this.players[u.side];
    if (!shot.fired) {
      return this.emit({ type: 'fire', unit: u.id, fired: false, rating: 'Failed', text: `${this.label(u)} hold their arrows (Failed).` });
    }
    const angle = Math.max(21, Math.min(158, shot.angle));
    const power = Math.min(shot.power, u.arrowRange);
    const landX = Battle.landingX(centreX(u.col), power, angle);
    const hits = [];
    let enemyDmg = 0;
    if (landX !== null) {
      const W = u.health > 200 ? 150 : Math.max(50, u.health);
      const z0 = landX - W, z1 = landX + W;
      for (const t of this.units) {
        if (t === u || !this.isActive(t) || t.row !== u.row) continue;
        const b0 = centreX(t.col) - UNIT_PX / 2 - 16, b1 = centreX(t.col) + UNIT_PX / 2 + 16;
        const ov = Math.max(0, Math.min(b1, z1) - Math.max(b0, z0));
        if (ov <= 0) continue;
        const raw = (ov / (2 * W)) * u.arrowDamage * p.diffMod;
        const dealt = Math.min(t.health, Math.round(raw * (1 - this.def(t))));
        hits.push({ t, dealt });
      }
    }
    for (const { t, dealt } of hits) {
      t.health -= dealt;
      if (t.side !== u.side) { enemyDmg += dealt; p.stats.archerKills += dealt; }
    }
    const rate = enemyDmg < 10 ? 'Awful' : enemyDmg < 30 ? 'Poor' : enemyDmg < 50 ? 'Ok' : enemyDmg < 80 ? 'Good' : 'Brutal';
    const desc = hits.length ? hits.map(({ t, dealt }) => `${this.label(t)} −${dealt}`).join(', ') : 'nothing';
    await this.emit({ type: 'fire', unit: u.id, fired: true, landX, power, angle, enemyDmg, rating: rate,
      text: `${this.label(u)} loose a volley: ${desc} (${rate}).` });
    for (const { t, dealt } of hits) await this.afterDamage(t, dealt);
  }

  // ---------- engagement phase ----------
  async engagementPhase() {
    const first = this.round % 2 === 1 ? 0 : 1;
    const pairs = [...this.engagements.values()];
    if (pairs.length) await this.emit({ type: 'phase', phase: 'engage', text: 'Engaged units trade blows.' });
    for (const [ia, ib] of pairs) {
      if (this.over) return;
      let a = this.units[ia], b = this.units[ib];
      if (!this.isActive(a) || !this.isActive(b) || !a.engaged.has(b.id)) continue;
      if (a.side !== first) [a, b] = [b, a];
      await this.meleeMinigame(a, b);
      await this.strike(a, b);
      this.checkEnd();
    }
  }

  // ---------- end ----------
  sideLost(side) { return this.alive(side).length === 0 || this.armyMorale(side) <= 0; }
  hpLost(side) { return this.players[side].startHealth - this.armyHealth(side); }

  checkEnd() {
    if (this.over) return true;
    const l0 = this.sideLost(0), l1 = this.sideLost(1);
    if (!l0 && !l1) return false;
    if (l0 && l1) {
      const a = this.hpLost(0), b = this.hpLost(1);
      this.finish(a === b ? null : a < b ? 0 : 1, 'mutual');
    } else this.finish(l0 ? 1 : 0, 'rout');
    return true;
  }

  surrender(side) { this.finish(1 - side, 'surrender', side); }

  finish(winner, reason, surrendered = null) {
    this.over = true;
    this.phase = 'over';
    const ranks = [0, 1].map((s) => {
      if (surrendered === s) return 'Coward';
      const p = this.players[s];
      return rank(this.armyHealth(s) / p.startHealth + this.armyMorale(s));
    });
    this.result = { winner, reason, rounds: this.round, ranks };
    this.events.push({ type: 'end', round: this.round, text: winner === null ? 'The battle ends in a stalemate.' : `${ARMIES[this.players[winner].army].name} win the battle!` });
  }

  // Placement helper used by the setup screens.
  static validPlacement(side, list, mapId) {
    const seen = new Set();
    const blocks = new Set(MAPS[mapId].blocks.map(([c, r]) => `${c},${r}`));
    return list.every((p) => {
      const k = `${p.col},${p.row}`;
      if (seen.has(k) || blocks.has(k) || !inZone(side, p.col, p.row)) return false;
      seen.add(k);
      return true;
    });
  }
}
