// Side-on battle panorama: parallax backdrop, a world layer of animated troop sprites, and a camera that
// zooms in on whoever is acting. Effects: arrow volleys, taunt bubbles, charge shouts, dust.
import { COLS, CELL_PX } from '../engine/data.js';
import { silhouette } from './icons.js';
import { spriteFor, loadSprite, FRAMES } from './sprites.js';
import { camera, X0, X1, groundY, depth } from './camera.js';

export const xPct = (col) => X0 + ((col + 0.5) / COLS) * (X1 - X0);

export function createView(el, b, colourOf) {
  el.insertAdjacentHTML('afterbegin', `<div class="pano-bg" style="background-image:url(assets/img/backdrop_${b.map.id}.jpg)"></div>
    <div class="world"><div class="pano-ground"></div><div class="pano-fx"></div></div>`);
  const bg = el.querySelector('.pano-bg');
  const world = el.querySelector('.world');
  const fx = el.querySelector('.pano-fx');
  for (const [c, r] of b.map.blocks) {
    const w = document.createElement('div');
    w.className = 'water';
    w.style.left = `${xPct(c) - (X1 - X0) / COLS / 2 - 0.6}%`;
    w.style.width = `${(X1 - X0) / COLS + 1.2}%`;
    w.style.bottom = `${groundY(r) - 1}%`;
    world.appendChild(w);
  }
  const nodes = new Map();
  const moving = new Map();

  function aim(cx, z) {
    const clamp = (t, zz) => Math.max(100 - 100 * zz, Math.min(0, t));
    world.style.transform = `translateX(${clamp(50 - cx * z, z)}%) scale(${z})`;
    const zb = 1 + (z - 1) * 0.35;
    bg.style.transform = `translateX(${clamp(50 - cx * zb, zb)}%) scale(${zb})`;
  }
  camera.focus = (col, z = 2) => aim(xPct(col), z);
  camera.wide = () => aim(50, 1);
  camera.wide();

  function makeNode(u) {
    const n = document.createElement('div');
    n.className = `fig s${u.side}`;
    n.innerHTML = '<div class="sprite"></div>';
    world.appendChild(n);
    loadSprite(spriteFor(u), colourOf(u.side)).then((s) => {
      const sp = n.querySelector('.sprite');
      if (!s) { sp.outerHTML = silhouette(u, colourOf(u.side)); return; }
      n.style.setProperty('--fw', String(s.fw / s.fh));
      sp.style.backgroundImage = `url(${s.url})`;
      sp.style.setProperty('--frames', String(FRAMES));
    });
    return n;
  }

  const pos = (u) => ({ x: xPct(u.col), y: groundY(u.row) });

  function burst(cls, xp, yp, html = '', ms = 1600) {
    const d = document.createElement('div');
    d.className = cls;
    d.style.left = `${xp}%`;
    d.style.bottom = `${yp}%`;
    d.innerHTML = html;
    fx.appendChild(d);
    setTimeout(() => d.remove(), ms);
    return d;
  }

  function volley(u, landCol) {
    const a = pos(u);
    const tx = xPct(landCol);
    const W = el.clientWidth, H = el.clientHeight;
    const dx = ((tx - a.x) / 100) * W;
    const peak = -H * 0.45;
    for (let i = 0; i < 14; i++) {
      const ar = document.createElement('div');
      ar.className = 'arrow';
      ar.style.left = `${a.x + (i % 4 - 1.5) * 0.7}%`;
      ar.style.bottom = `${a.y + 8 + (i % 3) * 1.5}%`;
      fx.appendChild(ar);
      const jitter = (i - 7) * 4;
      const kf = [];
      for (let s = 0; s <= 12; s++) {
        const t = s / 12;
        const x = dx * t + jitter * t;
        const y = peak * 4 * t * (1 - t);
        const ang = Math.atan2(peak * 4 * (1 - 2 * t), dx || 1) * 180 / Math.PI;
        kf.push({ transform: `translate(${x}px, ${y}px) rotate(${ang}deg)`, opacity: t > 0.96 ? 0 : 1 });
      }
      ar.animate(kf, { duration: 1300, delay: i * 40, easing: 'linear', fill: 'forwards' });
      setTimeout(() => ar.remove(), 2000);
    }
    setTimeout(() => { for (let k = 0; k < 3; k++) burst('dust', tx + (k - 1) * 1.5, groundY(2), '', 900); }, 1300);
  }

  return {
    markMoving(id, ms = 900) { moving.set(id, performance.now() + ms); },
    effect(e) {
      const actor = b.units[e.unit ?? e.x ?? e.a];
      if (e.type === 'phase') { camera.wide(); return; }
      if (e.type === 'fire' && e.fired) {
        camera.focus((actor.col + e.landX / CELL_PX) / 2, 1.5);
        volley(actor, e.landX / CELL_PX);
      } else if (actor && ['move', 'charge', 'taunt', 'fortify', 'engage', 'strike', 'melee', 'flee', 'death'].includes(e.type)) {
        camera.focus(actor.col, e.type === 'move' ? 1.5 : 1.9);
      }
      if (e.type === 'taunt') {
        const p = pos(actor);
        burst(`bubble s${actor.side}`, p.x, p.y + 26 * depth(actor.row), `<b>${e.phrase}!</b>`, 2400);
      }
      if (e.type === 'strike' || e.type === 'engage') {
        const x = b.units[e.x ?? e.unit], y = b.units[e.y ?? e.target];
        if (x && y) burst('dust', (pos(x).x + pos(y).x) / 2, (pos(x).y + pos(y).y) / 2, '', 900);
      }
      if (e.type === 'charge') { const p = pos(actor); burst('shout', p.x, p.y + 24, 'CHARGE!', 1400); }
    },
    update() {
      const now = performance.now();
      const H = el.clientHeight;
      for (const u of b.units) {
        let n = nodes.get(u.id);
        if (!b.isActive(u)) {
          if (n && !n.classList.contains('gone')) { n.classList.add('gone'); setTimeout(() => n.remove(), 900); }
          continue;
        }
        if (!n) { n = makeNode(u); nodes.set(u.id, n); }
        const p = pos(u);
        const big = u.mounted || u.tier === 'hero' ? 1.15 : 1;
        n.style.left = `${p.x}%`;
        n.style.bottom = `${p.y}%`;
        n.style.zIndex = String(10 - u.row);
        n.style.setProperty('--h', `${Math.round(H * 0.2 * depth(u.row) * big)}px`);
        n.style.opacity = String(0.55 + 0.45 * (u.health / u.hp));
        n.classList.toggle('moving', (moving.get(u.id) || 0) > now);
        n.classList.toggle('fighting', u.engaged.size > 0);
      }
    },
  };
}
