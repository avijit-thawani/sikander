// Taunt mini-game: type the phrase quickly. Score s = 0.11 * (1 - elapsed / limit).
import { openFrame } from './mgframe.js';
import { TAUNT_MAX } from '../engine/data.js';

export async function playTaunt({ phrase, limit, colour }) {
  const f = openFrame('Taunt!', 'Type the phrase quickly for a morale boost', colour);
  f.body.innerHTML = `<div class="taunt-phrase">${[...phrase].map((ch) => (ch === ' ' ? '<span class="sp">&nbsp;</span>' : `<span>${ch}</span>`)).join('')}</div>`;
  const spans = [...f.body.querySelectorAll('span')];
  await f.countdown('TAUNT');
  let pos = 0;
  const mark = () => spans.forEach((s, i) => s.classList.toggle('next', i === pos));
  mark();
  const t = f.timer(limit);
  const onKey = (e) => {
    if (e.key.length !== 1) return;
    e.preventDefault();
    if (e.key.toUpperCase() === phrase[pos].toUpperCase()) {
      spans[pos].classList.add('ok');
      pos++;
      mark();
      if (pos >= phrase.length) t.stop();
    } else f.el.classList.add('miss'), setTimeout(() => f.el.classList.remove('miss'), 120);
  };
  window.addEventListener('keydown', onKey);
  const elapsed = await t.promise;
  window.removeEventListener('keydown', onKey);
  const completed = pos >= phrase.length;
  const s = completed ? TAUNT_MAX * Math.max(0, 1 - elapsed / limit) : 0;
  f.close();
  return { s, completed };
}
