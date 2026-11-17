// Shared mini-game shell: overlay, 3-second countdown, circular timer.
import { settings } from './settings.js';

export const sleep = (ms) => new Promise((r) => setTimeout(r, settings.fast ? Math.min(ms, 1) : ms));

export function openFrame(title, tip, colour = '#e8892b') {
  const hud = document.querySelector('.hud');
  const host = hud || document.getElementById('modal');
  const el = document.createElement('div');
  el.className = hud ? 'mg inline' : 'mg';
  const tipEl = document.getElementById('status2');
  if (tipEl) tipEl.textContent = tip;
  el.innerHTML = `<div class="mg-card" style="--accent:${colour}">
    <div class="mg-head"><h3>${title}</h3>
      <svg class="mg-timer" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" class="bg"/><circle cx="20" cy="20" r="16" class="fg"/><text x="20" y="25" text-anchor="middle"></text></svg></div>
    <p class="mg-tip">${tip}</p><div class="mg-body"></div><div class="mg-count"></div></div>`;
  host.appendChild(el);
  const body = el.querySelector('.mg-body');
  const count = el.querySelector('.mg-count');
  const fg = el.querySelector('.fg');
  const txt = el.querySelector('.mg-timer text');
  const C = 2 * Math.PI * 16;
  fg.style.strokeDasharray = C;
  return {
    el, body,
    async countdown(label) {
      for (let i = 3; i >= 1; i--) { count.textContent = `${label} IN ${i}`; await sleep(1000); }
      count.textContent = '';
    },
    // Runs the timer; resolves when time is up or stop() is called. Returns elapsed seconds.
    timer(limit) {
      const t0 = performance.now();
      let done = false, resolveFn;
      const p = new Promise((r) => { resolveFn = r; });
      const tick = () => {
        if (done) return;
        const el2 = (performance.now() - t0) / 1000;
        const left = Math.max(0, limit - el2);
        fg.style.strokeDashoffset = C * (1 - left / limit);
        txt.textContent = Math.ceil(left);
        if (left <= 0) { done = true; resolveFn(limit); } else requestAnimationFrame(tick);
      };
      tick();
      return { promise: p, stop: () => { if (!done) { done = true; resolveFn((performance.now() - t0) / 1000); } } };
    },
    flash(text) { count.textContent = text; },
    close() { el.remove(); },
  };
}
