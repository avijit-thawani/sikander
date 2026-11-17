// Melee mini-game: arrow icons scroll toward a hit zone; press the matching key.
// Bonus = 80 * hits / icons that passed the zone.
import { openFrame } from './mgframe.js';
import { MELEE_MAX, MELEE_TIME } from '../engine/data.js';

const KEYS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
const SLOTS = 14, ZONE = 2, STEP_MS = 160;

export async function playMelee({ title, colour, rng = Math.random }) {
  const f = openFrame(title, 'Hit the matching arrow key as each icon crosses the zone', colour);
  f.body.innerHTML = `<div class="lane">${'<b></b>'.repeat(SLOTS)}</div><div class="lane-keys">${Object.entries(KEYS).map(([k, v]) => `<button class="btn small" data-k="${k}">${v}</button>`).join('')}</div>`;
  const cells = [...f.body.querySelectorAll('.lane b')];
  cells[ZONE].classList.add('zone');
  await f.countdown('FIGHT');
  // icons: {pos, key, hit}
  let icons = [], gap = 0, passed = 0, hits = 0;
  const render = () => {
    cells.forEach((c, i) => { c.textContent = ''; c.className = i === ZONE ? 'zone' : ''; });
    for (const ic of icons) if (ic.pos >= 0 && ic.pos < SLOTS) { cells[ic.pos].textContent = KEYS[ic.key]; if (ic.hit) cells[ic.pos].classList.add('hit'); }
  };
  const step = () => {
    for (const ic of icons) { ic.pos--; if (ic.pos === ZONE - 1) passed++; }
    icons = icons.filter((ic) => ic.pos >= 0);
    if (gap-- <= 0) { icons.push({ pos: SLOTS - 1, key: Object.keys(KEYS)[Math.floor(rng() * 4)], hit: false }); gap = 1 + Math.floor(rng() * 5); }
    render();
  };
  const press = (key) => {
    const ic = icons.find((i) => !i.hit && Math.abs(i.pos - ZONE) <= 0);
    if (ic && ic.key === key) { ic.hit = true; hits++; render(); } else f.el.classList.add('miss'), setTimeout(() => f.el.classList.remove('miss'), 120);
  };
  const onKey = (e) => { if (KEYS[e.key]) { e.preventDefault(); press(e.key); } };
  const onDown = (e) => { if (KEYS[e.key]) e.preventDefault(); };
  window.addEventListener('keyup', onKey);
  window.addEventListener('keydown', onDown);
  f.body.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
  const iv = setInterval(step, STEP_MS);
  await f.timer(MELEE_TIME).promise;
  clearInterval(iv);
  window.removeEventListener('keyup', onKey);
  window.removeEventListener('keydown', onDown);
  f.close();
  return passed ? (MELEE_MAX * Math.min(hits, passed)) / passed : 0;
}
