// Charge mini-game: tap Space. Each release adds chargeMax / N, capped at chargeMax.
import { openFrame } from './mgframe.js';
import { CHARGE_TIME } from '../engine/data.js';

export async function playCharge({ chargeMax, N, colour, name }) {
  const f = openFrame(`${name} charge!`, 'Tap Spacebar to build charge speed', colour);
  f.body.innerHTML = `<div class="seg-bar">${'<i></i>'.repeat(25)}</div><button class="btn small tap">TAP (or Space)</button>`;
  const segs = [...f.body.querySelectorAll('i')];
  await f.countdown('CHARGE');
  let bonus = 0;
  const t = f.timer(CHARGE_TIME);
  const add = () => {
    bonus = Math.min(chargeMax, bonus + chargeMax / N);
    const lit = Math.round((bonus / chargeMax) * 25);
    segs.forEach((s, i) => s.classList.toggle('on', i < lit));
  };
  const onUp = (e) => { if (e.code === 'Space') { e.preventDefault(); add(); } };
  const onDown = (e) => { if (e.code === 'Space') e.preventDefault(); };
  window.addEventListener('keyup', onUp);
  window.addEventListener('keydown', onDown);
  f.body.querySelector('.tap').addEventListener('click', add);
  await t.promise;
  window.removeEventListener('keyup', onUp);
  window.removeEventListener('keydown', onDown);
  f.close();
  return bonus;
}
