// Screen flow: title, setup, army select, troops, placement, battle, results, campaign.
import { ARMIES, ARMY_KEYS, MAPS, SKIRMISH_BUDGETS, CAMPAIGN, CAMPAIGN_END, TIERS, unitCost } from '../engine/data.js';
import { createRng } from '../engine/rng.js';
import { selectionCost, canAdd, selectionValid, randomSelection, autoArrange, computerLayout, campaignLayout, inZone } from '../engine/army.js';
import { Battle } from '../engine/battle.js';
import { renderGrid, bindGrid } from './gridView.js';
import { battleScreen } from './battleScreen.js';
import { uiResolver } from './resolver.js';
import { settings } from './settings.js';
import { iconFor } from './icons.js';
import { showHelp } from './help.js';
import { setMuted, isMuted } from './audio.js';

const app = document.getElementById('app');
const rng = createRng(settings.seed);
let battleCount = 0;

const state = {
  mode: 'skirmish', map: 1, size: 'small', difficulty: 'medium', minigames: settings.minigames,
  armies: ['pauravas', 'greeks'], counts: null, placement: null, compPlacement: null, level: 0,
};

const GREY = '#999999';
const colourOf = (side) => (side === 1 && state.armies[0] === state.armies[1] ? GREY : ARMIES[state.armies[side]].colour);
const budget = () => (state.mode === 'campaign' ? CAMPAIGN[state.level].budget : SKIRMISH_BUDGETS[state.size]);

function screen(html, cls = '') {
  document.getElementById('modal').innerHTML = '';
  app.innerHTML = `<div class="screen ${cls}">${html}</div>`;
  const root = app.firstElementChild;
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ROUTES[b.dataset.go]()));
  return root;
}
const radios = (name, opts, cur) => opts.map(([v, label, sub]) =>
  `<label class="radio ${String(cur) === String(v) ? 'on' : ''}"><input type="radio" name="${name}" value="${v}" ${String(cur) === String(v) ? 'checked' : ''}><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</label>`).join('');
function wireRadios(root, name, set) {
  root.querySelectorAll(`input[name=${name}]`).forEach((i) => i.addEventListener('change', () => {
    set(i.value);
    root.querySelectorAll(`input[name=${name}]`).forEach((j) => j.parentElement.classList.toggle('on', j.checked));
  }));
}

// ---------- title ----------
function title() {
  const root = screen(`<div class="title-wrap">
    <div class="title-art"><img src="assets/img/title.png" alt="Sikander" class="title-img"></div>
    <p class="tagline">326 BC · The river wars of the Punjab</p>
    <div class="menu">
      <button class="btn big" id="btn-campaign">Campaign</button>
      <button class="btn big" id="btn-skirmish">Skirmish</button>
      <button class="btn ghost" id="btn-howto">How to play</button>
      <button class="btn ghost small" id="btn-mute">${isMuted() ? 'Sound: off' : 'Sound: on'}</button>
    </div>
    <img src="assets/img/concept_leaders.jpg" class="title-concept" alt="">
  </div>`, 'title');
  root.querySelector('#btn-campaign').onclick = () => { state.mode = 'campaign'; campaignSetup(); };
  root.querySelector('#btn-skirmish').onclick = () => { state.mode = 'skirmish'; setup(); };
  root.querySelector('#btn-howto').onclick = () => showHelp();
  root.querySelector('#btn-mute').onclick = (e) => { setMuted(!isMuted()); e.target.textContent = isMuted() ? 'Sound: off' : 'Sound: on'; };
}

const difficultyRadios = () => radios('diff', [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], state.difficulty);
const mgToggle = () => `<label class="toggle"><input type="checkbox" id="mg-toggle" ${state.minigames ? 'checked' : ''}> <b>Mini-games</b>
  <small>Off: actions use quick random results instead of the archery, melee, taunt and charge challenges.</small></label>`;

// ---------- skirmish setup ----------
function setup() {
  const root = screen(`<h2>Create a battle</h2>
    <div class="setup">
      <section><h4>Battlefield</h4>${radios('map', Object.values(MAPS).map((m) => [m.id, m.name, m.blurb]), state.map)}</section>
      <section><h4>Army size</h4>${radios('size', [['small', 'Small', '14 points'], ['medium', 'Medium', '20 points'], ['large', 'Large', '26 points']], state.size)}</section>
      <section><h4>Difficulty</h4>${difficultyRadios()}</section>
      <section><h4>Options</h4>${mgToggle()}</section>
    </div>
    <div class="buttons"><button class="btn ghost" data-go="title">Back</button><button class="btn" id="btn-continue">Continue</button></div>`);
  wireRadios(root, 'map', (v) => { state.map = +v; });
  wireRadios(root, 'size', (v) => { state.size = v; });
  wireRadios(root, 'diff', (v) => { state.difficulty = v; });
  root.querySelector('#mg-toggle').onchange = (e) => { state.minigames = e.target.checked; };
  root.querySelector('#btn-continue').onclick = armies;
}

// ---------- army select ----------
function armies() {
  const panel = (side) => {
    const a = ARMIES[state.armies[side]];
    const col = colourOf(side);
    return `<div class="army-card" style="--c:${col}">
      <div class="who">${side === 0 ? 'You' : 'Computer'}</div>
      <div class="cycle"><button class="btn small" id="prev${side}">◀</button><h3 style="color:${col}">${a.name}</h3><button class="btn small" id="next${side}">▶</button></div>
      <div class="army-icons">${TIERS.map((t) => `<span style="color:${col}">${iconFor({ tier: t, army: a.key, mounted: a.units[t].mounted })}</span>`).join('')}</div>
      <p>${a.blurb}</p>
      <ul>${TIERS.map((t) => `<li><b>${a.units[t].name}</b> · ${unitCost(a.key, t)} pts</li>`).join('')}</ul></div>`;
  };
  const root = screen(`<h2>Choose armies</h2><div class="army-cards">${panel(0)}<div class="vs">vs</div>${panel(1)}</div>
    <div class="buttons"><button class="btn ghost" data-go="setup">Back</button><button class="btn" id="btn-continue">Continue</button></div>`);
  for (const side of [0, 1]) {
    const cyc = (d) => { const i = ARMY_KEYS.indexOf(state.armies[side]); state.armies[side] = ARMY_KEYS[(i + d + 3) % 3]; armies(); };
    root.querySelector(`#prev${side}`).onclick = () => cyc(-1);
    root.querySelector(`#next${side}`).onclick = () => cyc(1);
  }
  root.querySelector('#btn-continue').onclick = () => { state.counts = { hero: 1, elite: 0, warrior: 0, archer: 0 }; troops(); };
}

// ---------- troop selection ----------
function troops() {
  const ak = state.armies[0], a = ARMIES[ak], B = budget();
  const c = state.counts;
  const cost = selectionCost(ak, c);
  const rows = TIERS.map((t) => `<tr><td style="color:${colourOf(0)}">${iconFor({ tier: t, army: ak, mounted: a.units[t].mounted })}</td>
    <td><b>${a.units[t].name}</b><br><small>atk ${a.units[t].attack} · def ${a.units[t].defence} · move ${a.units[t].movement}</small></td>
    <td>${unitCost(ak, t)}</td>
    <td class="qty"><button class="btn small" data-t="${t}" data-d="-1" ${t === 'hero' || !c[t] ? 'disabled' : ''}>−</button><span id="qty-${t}">${c[t] || 0}</span>
      <button class="btn small" data-t="${t}" data-d="1" ${canAdd(ak, c, t, B) ? '' : 'disabled'}>+</button></td>
    <td>${(c[t] || 0) * unitCost(ak, t)}</td></tr>`).join('');
  const root = screen(`<h2>${state.mode === 'campaign' ? CAMPAIGN[state.level].title + ' · ' : ''}Muster the ${a.name}</h2>
    <table class="troops"><tr><th></th><th>Unit</th><th>Cost</th><th>Quantity</th><th>Value</th></tr>${rows}</table>
    <p class="bank">Budget <b>${B}</b> · Total cost <b id="total-cost">${cost}</b> · Bank <b id="bank">${B - cost}</b></p>
    <div class="buttons"><button class="btn ghost" id="btn-back">Back</button><button class="btn" id="btn-randomise">Randomise your troops</button>
      <button class="btn" id="btn-continue" ${selectionValid(ak, c, B) ? '' : 'disabled'}>Continue</button></div>`);
  root.querySelectorAll('[data-t]').forEach((btn) => btn.addEventListener('click', () => {
    const t = btn.dataset.t, d = +btn.dataset.d;
    if (d > 0 && canAdd(ak, c, t, B)) c[t]++;
    if (d < 0 && c[t] > 0 && t !== 'hero') c[t]--;
    troops();
  }));
  root.querySelector('#btn-back').onclick = () => (state.mode === 'campaign' ? title() : armies());
  root.querySelector('#btn-randomise').onclick = () => { state.counts = randomSelection(ak, B, rng); troops(); };
  root.querySelector('#btn-continue').onclick = () => { state.placement = autoArrange(c, 0); placement(true); };
}

// ---------- placement ----------
function computerSide() {
  if (state.mode === 'campaign') return campaignLayout(CAMPAIGN[state.level]);
  return computerLayout(randomSelection(state.armies[1], budget(), rng), 1);
}
function previewBattle() {
  return new Battle({ map: state.map, armies: state.armies, difficulty: state.difficulty, seed: 1, placements: [state.placement, state.compPlacement] });
}
function placement(fresh) {
  if (fresh) state.compPlacement = computerSide();
  const root = screen(`<h2>Position your troops</h2><p class="muted">Drag your units into their starting formation (or click a unit, then a square).</p>
    <div class="grid-wrap"><div id="grid" class="grid place"></div></div>
    <div id="formations" class="muted"></div>
    <div class="buttons"><button class="btn ghost" id="btn-back">Back</button><button class="btn" id="btn-autoplace">Auto-place</button><button class="btn" id="btn-continue">Continue</button></div>`);
  const grid = root.querySelector('#grid');
  let sel = null, drag = null;
  const draw = () => {
    const b = previewBattle();
    renderGrid(grid, b, { colourOf, zone: 0, selected: sel != null ? sel : undefined });
    const fs = [...b.groups.values()].filter((g) => g.side === 0).map((g) => b.groupName(g));
    root.querySelector('#formations').textContent = fs.length ? `Formations ready: ${fs.join(', ')}` : 'Tip: three units in one column make a shield wall; a chevron pointing right makes a wedge.';
  };
  const idxAt = (c, r) => state.placement.findIndex((p) => p.col === c && p.row === r);
  const tryMove = (i, c, r) => {
    if (i < 0 || !inZone(0, c, r) || idxAt(c, r) >= 0) return false;
    state.placement[i] = { ...state.placement[i], col: c, row: r };
    return true;
  };
  bindGrid(grid, {
    onCell(c, r) {
      const i = idxAt(c, r);
      if (i >= 0) { sel = sel === i ? null : i; }
      else if (sel != null) { tryMove(sel, c, r); sel = null; }
      draw();
    },
    onDragStart(uid) {
      const b = previewBattle();
      const u = b.units[uid];
      if (u.side !== 0) return;
      drag = idxAt(u.col, u.row);
    },
  });
  grid.onpointerup = (e) => {
    if (drag == null) return;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cell');
    const from = state.placement[drag];
    if (cell && (+cell.dataset.c !== from.col || +cell.dataset.r !== from.row)) {
      const c = Math.max(0, Math.min(6, +cell.dataset.c));
      if (tryMove(drag, c, +cell.dataset.r)) { sel = null; setTimeout(draw); }
    }
    drag = null;
  };
  root.querySelector('#btn-back').onclick = troops;
  root.querySelector('#btn-autoplace').onclick = () => { state.placement = autoArrange(state.counts, 0); sel = null; draw(); };
  root.querySelector('#btn-continue').onclick = startBattle;
  draw();
}

// ---------- battle ----------
function startBattle() {
  const seed = settings.seed + battleCount++;
  const title = state.mode === 'campaign' ? CAMPAIGN[state.level].title : MAPS[state.map].name;
  const b = new Battle({
    map: state.map, armies: state.armies, difficulty: state.difficulty, seed, ai: [false, true],
    placements: [state.placement, state.compPlacement],
    resolver: uiResolver({ humanSide: 0, minigames: () => state.minigames, colourOf, caption: (t) => { const el = document.getElementById('status2'); if (el) el.textContent = t; } }),
  });
  window.__battle = b;
  app.innerHTML = '';
  document.getElementById('modal').innerHTML = '';
  const holder = document.createElement('div');
  app.appendChild(holder);
  battleScreen(holder, { battle: b, colourOf, title, onFinish: resultButtons });
}

function resultButtons(r) {
  if (state.mode === 'skirmish') {
    return [['btn-again', 'Play again', () => setup()], ['btn-title', 'Title', () => title()]];
  }
  if (r.winner === 0) {
    const next = state.level + 1;
    if (next >= CAMPAIGN.length) return [['btn-continue', 'Continue', () => card(CAMPAIGN_END, 'The end', title)], ['btn-title', 'Quit', title]];
    return [['btn-continue', 'Continue', () => { state.level = next; campaignLevel(); }], ['btn-title', 'Quit', title]];
  }
  return [['btn-retry', 'Try again', () => campaignLevel()], ['btn-title', 'Quit', title]];
}

// ---------- campaign ----------
function campaignSetup() {
  const root = screen(`<h2>Campaign</h2><p class="muted">Three battles of 326 BC. Each level is fought on a fixed field against a fixed enemy host.</p>
    <div class="setup"><section><h4>Difficulty</h4>${difficultyRadios()}</section><section><h4>Options</h4>${mgToggle()}</section></div>
    <div class="buttons"><button class="btn ghost" data-go="title">Back</button><button class="btn" id="btn-continue">Begin</button></div>`);
  wireRadios(root, 'diff', (v) => { state.difficulty = v; });
  root.querySelector('#mg-toggle').onchange = (e) => { state.minigames = e.target.checked; };
  root.querySelector('#btn-continue').onclick = () => { state.level = 0; video('assets/cutscene/intro.mp4', campaignLevel); };
}

function campaignLevel() {
  const L = CAMPAIGN[state.level];
  state.map = L.map;
  state.armies = [L.player, L.computer];
  state.counts = { ...L.preset };
  card(L.card, `Battle ${state.level + 1} of 3 · ${L.title}`, troops);
}

function card(text, heading, next) {
  const root = screen(`<div class="story"><h2>${heading}</h2><p>${text}</p><div class="buttons"><button class="btn" id="btn-continue">Continue</button></div></div>`, 'story-screen');
  root.querySelector('#btn-continue').onclick = next;
}

function video(src, next) {
  const root = screen(`<div class="cutscene"><video id="cutscene" src="${src}" playsinline autoplay></video>
    <button class="btn skip" id="btn-skip">Skip</button></div>`, 'video-screen');
  const v = root.querySelector('video');
  let done = false;
  const go = () => { if (done) return; done = true; v.pause(); next(); };
  v.addEventListener('ended', go);
  v.addEventListener('error', go);
  v.play().catch(() => { v.muted = true; v.play().catch(go); });
  root.querySelector('#btn-skip').onclick = go;
}

// ---------- quick start (?quick=1) ----------
function quick() {
  state.mode = 'skirmish';
  state.map = 1 + rng.int(3);
  state.size = 'medium';
  state.armies = [rng.pick(ARMY_KEYS), rng.pick(ARMY_KEYS)];
  state.counts = randomSelection(state.armies[0], budget(), rng);
  state.placement = autoArrange(state.counts, 0);
  state.compPlacement = computerSide();
  startBattle();
}

const ROUTES = { title, setup, armies, troops };
if (settings.quick) quick(); else title();
