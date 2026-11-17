// Battle screen: grid, command ring, execute loop, log, army bars, info panel, results.
import { ARMIES, DIFFICULTY } from '../engine/data.js';
import { planAI } from '../ai/computer.js';
import { AIPacer } from '../ai/pacer.js';
import { renderGrid, bindGrid } from './gridView.js';
import { createView } from './battleView.js';
import { settings } from './settings.js';
import { sleep } from './mgframe.js';
import { playTauntClip, setMuted, isMuted } from './audio.js';
import { showHelp } from './help.js';
import { iconFor, CMD_ICONS } from './icons.js';

const HUMAN = 0, AI = 1;
const PACE = { move: 450, charge: 500, strike: 650, fire: 600, taunt: 600, flee: 600, death: 700, engage: 250, melee: 300, fortify: 300, phase: 300, skip: 200 };

export function battleScreen(root, { battle: b, colourOf, onFinish, title }) {
  root.innerHTML = `<div class="battle">
    <div id="view" class="view"><div id="status1" class="round-tab"></div><div class="map-name">${title}</div></div>
    <div class="tip"><span>TIP :</span> <i id="status2">Click on your units to give them commands</i></div>
    <div class="hud">
      <div class="armies"><div class="army-box" id="army0"></div>
        <div class="morale-mid"><small>ARMY MORALE</small><div><b id="mor0"></b><span>|</span><b id="mor1"></b></div><em id="ai-status" class="ai-status"></em></div>
        <div class="army-box right" id="army1"></div></div>
      <div class="grid-wrap"><div id="grid" class="grid"></div><div id="ring" class="ring hidden"></div></div>
    </div>
    <div class="exec-row"><button id="btn-execute" class="btn stone">EXECUTE COMMANDS</button></div>
    <div class="lower"><div id="info" class="info"></div><div id="log" class="log"></div></div>
    <div class="links"><button id="btn-surrender" class="link">✕ Surrender</button><span class="spacer"></span>
      <button id="btn-help" class="link">? How to play</button><button id="btn-sound" class="link"></button></div>
  </div>`;
  const $ = (s) => root.querySelector(s);
  const gridEl = $('#grid'), ring = $('#ring'), logEl = $('#log');
  const view = createView($('#view'), b, colourOf);
  let cmds = [], selected = null, hover = null, pending = null, busy = false, logged = 0;
  const broken = new Set();
  const flash = new Set();
  let pacer = null, pacerTimer = null;

  const armyName = (side) => ARMIES[b.players[side].army].name;
  const caption = (t) => { $('#status2').textContent = t; };

  function startCommandPhase() {
    cmds = []; broken.clear(); pending = null; selected = null;
    const plan = planAI(b, AI);
    pacer = new AIPacer({ wait: DIFFICULTY[b.difficulty].wait, rng: b.rng });
    pacer.start(plan);
    clearInterval(pacerTimer);
    if (!settings.fast) pacerTimer = setInterval(() => { pacer.tick(); renderAIStatus(); }, 250);
    renderAIStatus();
    render();
  }
  function renderAIStatus() {
    $('#ai-status').textContent = b.phase === 'command' ? `Opponent orders: ${settings.fast ? pacer.queue.length : pacer.released.length}` : '';
  }

  function cmdFor(u) { return cmds.find((c) => c.unitId === u.id || (u.group && c.groupId === u.group && !broken.has(u.group))); }

  function render() {
    const targets = new Map();
    const ordered = new Set();
    cmds.forEach((c, i) => {
      if (c.target) targets.set(`${c.target.col},${c.target.row}`, String(i + 1));
      if (c.unitId != null) ordered.add(c.unitId);
      if (c.groupId) for (const id of b.groups.get(c.groupId)?.members || []) ordered.add(id);
    });
    renderGrid(gridEl, b, { colourOf, selected, highlights: pending ? new Set(pending.cells.map((c) => `${c.col},${c.row}`)) : null, targets, ordered, flash });
    $('#status1').textContent = b.over ? 'Battle over' : `Round ${b.round} – ${b.phase === 'command' ? 'Select Commands' : 'Executing Commands'}`;
    $('#btn-execute').disabled = busy || b.over;
    for (const side of [0, 1]) {
      const p = b.players[side];
      const hero = b.units.find((u) => u.side === side && u.tier === 'hero');
      $(`#army${side}`).innerHTML = `<div class="emblem" style="--c:${colourOf(side)}">${hero ? iconFor(hero) : ''}</div>
        <div><div class="army-name" style="color:${colourOf(side)}">THE ${armyName(side).toUpperCase()}</div>
        <div class="army-line">${side === HUMAN ? 'You' : 'Opponent'} · ⚔ ${b.armyHealth(side)} / ${p.startHealth}</div></div>`;
      const m = $(`#mor${side}`);
      m.textContent = Math.round(b.armyMorale(side) * 100);
      m.style.color = colourOf(side);
    }
    renderInfo();
    renderLog();
    view.update();
  }

  function renderInfo() {
    const id = hover ?? selected;
    const u = id != null ? b.units[id] : null;
    if (!u) { $('#info').innerHTML = '<div class="muted">Hover or select a unit to see its details.</div>'; return; }
    const atk = Math.round(b.atk(u)), def = b.def(u);
    const pips = (n, on) => `<span class="pips ${on ? 'boost' : ''}">${'●'.repeat(Math.max(0, Math.min(5, n)))}${'○'.repeat(5 - Math.max(0, Math.min(5, n)))}</span>`;
    const g = u.group ? b.groups.get(u.group) : null;
    const status = [!b.isActive(u) && (u.fled ? 'Fled' : 'Destroyed'), b.isFortified(u) && 'Fortified', u.engaged.size && (u.engaged.size > 1 ? 'Outflanked' : 'Engaged'), g && b.groupName(g)].filter(Boolean).join(' · ');
    $('#info').innerHTML = `<div class="info-name" style="color:${colourOf(u.side)}">${u.name} <small>${armyName(u.side)}</small></div>
      <table><tr><td>Strength</td><td>${u.health} / ${u.hp}</td></tr>
      <tr><td>Attack</td><td>${pips(Math.round((atk / 210) * 5), atk > u.attack)} ${atk}</td></tr>
      <tr><td>Defence</td><td>${pips(Math.round((def / 0.5) * 5), def > u.defence)} ${def.toFixed(2)}</td></tr>
      <tr><td>Morale</td><td>${Math.round(b.unitMorale(u) * 100)}%</td></tr>
      <tr><td>Movement</td><td>${g ? b.groupMovement(g) : u.movement}</td></tr></table>
      <div class="muted">${status}</div>`;
  }

  function renderLog() {
    const evs = b.events;
    for (; logged < evs.length; logged++) {
      const e = evs[logged];
      const d = document.createElement('div');
      const u = e.unit != null ? b.units[e.unit] : e.x != null ? b.units[e.x] : null;
      d.className = `ev ev-${e.type}`;
      if (u) d.style.borderLeftColor = colourOf(u.side);
      d.textContent = e.text;
      logEl.appendChild(d);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  function hideRing() { ring.classList.add('hidden'); ring.innerHTML = ''; }

  function showRing(u) {
    const cellEl = gridEl.querySelector(`[data-c="${u.col}"][data-r="${u.row}"]`);
    const wrap = $('.grid-wrap').getBoundingClientRect();
    const r = cellEl.getBoundingClientRect();
    const grouped = u.group && !broken.has(u.group);
    const existing = cmdFor(u);
    const opts = [];
    if (grouped) {
      opts.push({ k: 'move', label: 'Move', tip: 'Move the formation along its row' });
      opts.push({ k: 'break', label: 'Break', tip: 'Command individual units' });
    } else {
      const legal = (t) => b.validate(HUMAN, { unitId: u.id, type: t, target: { col: -1, row: -1 } }, cmds.filter((c) => c !== existing)) === null;
      opts.push({ k: 'move', label: 'Move', tip: 'Move into a formation or attack position' });
      if (u.isArcher) opts.push({ k: 'fire', label: 'Fire', tip: 'Prepare archers', off: !legal('fire') });
      else opts.push({ k: 'fortify', label: 'Fortify', tip: 'Increase defences', off: !legal('fortify') });
      opts.push({ k: 'taunt', label: 'Taunt', tip: "Raise own morale and lower the enemy's", off: !legal('taunt') });
    }
    if (existing) opts.push({ k: 'cancel', label: 'Cancel', tip: 'Cancel this order' });
    const n = opts.length;
    const R = 50, OUTER = 82;
    ring.innerHTML = `<div class="ring-disc"></div><div class="ring-core" style="--c:${colourOf(u.side)}">${iconFor(u)}</div>
      <div class="ring-head">${grouped ? b.groupName(b.groups.get(u.group)) : u.name}</div>` + opts.map((o, i) => {
      const a = -Math.PI / 2 + (i / n) * 2 * Math.PI;
      return `<button class="ring-btn" data-k="${o.k}" id="cmd-${o.k}" ${o.off ? 'disabled' : ''} title="${o.tip}" style="left:${Math.cos(a) * R}px;top:${Math.sin(a) * R}px">${CMD_ICONS[o.k]}<span>${o.label}</span></button>`;
    }).join('');
    const cx = Math.max(wrap.left + OUTER, Math.min(r.left + r.width / 2, wrap.right - OUTER, innerWidth - OUTER));
    const cy = Math.max(OUTER + 20, Math.min(r.top + r.height / 2, innerHeight - OUTER));
    ring.style.left = `${cx - wrap.left}px`;
    ring.style.top = `${cy - wrap.top}px`;
    ring.classList.remove('hidden');
    ring.querySelectorAll('.ring-btn').forEach((btn) => btn.addEventListener('click', (e) => { e.stopPropagation(); choose(u, btn.dataset.k); }));
  }

  function addCmd(c) {
    const why = b.validate(HUMAN, c, cmds);
    if (why) { caption(`Cannot do that: ${why}.`); return; }
    cmds.push(c);
    pacer.onHumanCommand();
    caption("Hit 'Execute Commands' when you are ready for battle");
  }

  function choose(u, k) {
    hideRing();
    const existing = cmdFor(u);
    if (existing && k !== 'break') cmds = cmds.filter((c) => c !== existing);
    if (k === 'cancel') { caption('Order cancelled.'); render(); return; }
    if (k === 'break') { broken.add(u.group); cmds = cmds.filter((c) => c.groupId !== u.group); caption('Formation split: command its units individually.'); render(); showRing(u); return; }
    if (k === 'move') {
      const grouped = u.group && !broken.has(u.group);
      const g = grouped ? b.groups.get(u.group) : null;
      pending = { unitId: u.id, groupId: g?.id, cells: g ? b.groupReachable(g) : b.reachableCells(u) };
      caption('Select a square for your unit(s) to move to');
      render();
      return;
    }
    addCmd({ unitId: u.id, type: k });
    selected = null;
    render();
  }

  bindGrid(gridEl, {
    onCell(c, r) {
      if (busy || b.over) return;
      if (pending) {
        const ok = pending.cells.some((x) => x.col === c && x.row === r);
        if (ok) addCmd(pending.groupId ? { groupId: pending.groupId, type: 'move', target: { col: c, row: r } } : { unitId: pending.unitId, type: 'move', target: { col: c, row: r } });
        pending = null; selected = null; hideRing(); render();
        return;
      }
      const u = b.unitAt(c, r);
      if (u && u.side === HUMAN) { selected = u.id; render(); showRing(u); }
      else { selected = u ? u.id : null; hideRing(); render(); }
    },
    onHover(id) { if (hover !== id) { hover = id; renderInfo(); } },
  });

  b.hooks.onEvent = async (e) => {
    if (e.type === 'taunt') playTauntClip(b.units[e.unit].army, e.idx);
    if (e.type === 'move' || e.type === 'charge') {
      const ids = e.group ? b.groups.get(e.group)?.members || [e.unit] : [e.unit];
      for (const id of ids) view.markMoving(id);
      setTimeout(() => view.update(), 950);
    }
    view.effect(e);
    flash.clear();
    if (e.type === 'strike') { flash.add(e.x); flash.add(e.y); }
    if (e.text && e.type !== 'phase') caption(e.text);
    render();
    await sleep(PACE[e.type] ?? 250);
  };

  $('#btn-execute').addEventListener('click', async () => {
    if (busy || b.over) return;
    busy = true; pending = null; selected = null; hideRing();
    clearInterval(pacerTimer);
    const aiCmds = settings.fast ? [...pacer.queue] : pacer.onHumanReady();
    render();
    try {
      await b.runRound(cmds, aiCmds);
    } catch (err) {
      console.error(err);
    }
    busy = false;
    if (b.over) { render(); finish(); } else startCommandPhase();
  });
  $('#btn-surrender').addEventListener('click', () => {
    if (busy || b.over) return;
    b.surrender(HUMAN);
    render(); finish();
  });
  $('#btn-help').addEventListener('click', () => showHelp());
  const soundLabel = () => { $('#btn-sound').textContent = isMuted() ? '♪ Turn sound on' : '♪ Turn sound off'; };
  $('#btn-sound').addEventListener('click', () => { setMuted(!isMuted()); soundLabel(); });
  soundLabel();

  function finish() {
    clearInterval(pacerTimer);
    const r = b.result;
    const banner = r.reason === 'surrender' ? 'Surrendered' : r.winner === null ? (r.reason === 'stalemate' ? 'Stalemate' : 'Draw') : r.winner === HUMAN ? 'Victory' : 'Defeat';
    const s = (side) => b.players[side].stats;
    const row = (label, f) => `<tr><td>${label}</td><td>${f(0)}</td><td>${f(1)}</td></tr>`;
    const host = document.getElementById('modal');
    const el = document.createElement('div');
    el.className = 'results';
    el.innerHTML = `<div class="results-card"><h2 id="result-banner" class="${banner.toLowerCase()}">${banner}</h2>
      <p>Battle rank: <b>${r.ranks[HUMAN]}</b> · ${r.rounds} round${r.rounds === 1 ? '' : 's'}</p>
      <table class="stats"><tr><th></th><th style="color:${colourOf(0)}">${armyName(0)}</th><th style="color:${colourOf(1)}">${armyName(1)}</th></tr>
      ${row('Troops remaining', (x) => b.armyHealth(x))}${row('Units lost', (x) => s(x).unitsLost)}${row('Units fled', (x) => s(x).unitsFled)}
      ${row('Formations', (x) => s(x).formations)}${row('Taunts', (x) => s(x).taunts)}${row('Successful charges', (x) => s(x).charges)}
      ${row('Combat rounds won', (x) => s(x).roundsWon)}${row('Killed by archers', (x) => s(x).archerKills)}</table>
      <div class="buttons" id="result-buttons"></div></div>`;
    host.appendChild(el);
    const bwrap = el.querySelector('#result-buttons');
    for (const [id, label, action] of onFinish(r)) {
      const btn = document.createElement('button');
      btn.className = 'btn'; btn.id = id; btn.textContent = label;
      btn.addEventListener('click', () => { el.remove(); action(); });
      bwrap.appendChild(btn);
    }
  }

  b.events.push({ type: 'phase', round: 1, text: `Round 1 – Select Commands. ${armyName(0)} vs ${armyName(1)}.` });
  startCommandPhase();
  return { battle: b };
}
