// Archery mini-game, drawn over the battle panorama: move the mouse to aim (21°–158°),
// press and drag backwards to draw, release to fire. The power bar sits in the HUD.
import { openFrame } from './mgframe.js';
import { COLS, CELL_PX } from '../engine/data.js';
import { centreX } from '../engine/minisim.js';
import { X0, X1, groundY } from './camera.js';

export async function playArchery({ battle, archer, limit, colourOf }) {
  const f = openFrame('Take aim', 'Move the mouse over the battlefield to aim, then press, drag back and release to fire', colourOf(archer.side));
  f.body.innerHTML = `<div class="power"><span>POWER</span><div class="seg-bar">${'<i></i>'.repeat(20)}</div></div>`;
  const segs = [...f.body.querySelectorAll('i')];
  const view = document.getElementById('view');
  const cv = document.createElement('canvas');
  cv.className = 'arch-overlay';
  view.appendChild(cv);
  const W = (cv.width = view.clientWidth), H = (cv.height = view.clientHeight);
  const S = (W * (X1 - X0)) / 100 / (COLS * CELL_PX);
  const toX = (wx) => (W * X0) / 100 + wx * S;
  const GY = H * (1 - groundY(archer.row) / 100);
  const ax = toX(centreX(archer.col)), ay = GY - 25 * S;
  let angle = archer.side === 0 ? 21 : 158, power = 0, drawing = null, fired = false;
  const g = cv.getContext('2d');

  const path = () => {
    const pts = [];
    const a = (angle * Math.PI) / 180;
    let x = centreX(archer.col), h = 25, vx = power * Math.cos(a), vy = power * Math.sin(a);
    for (let i = 0; i < 2000 && h > 0 && x > -200 && x < COLS * CELL_PX + 200; i++) { x += vx * 2; h += vy * 2; vy -= 0.6; pts.push([toX(x), GY - h * S]); }
    return pts;
  };
  const draw = (arrowAt) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#f2c14e';
    g.beginPath(); g.moveTo(ax - 8, ay - 52); g.lineTo(ax + 8, ay - 52); g.lineTo(ax, ay - 40); g.fill();
    const a = (angle * Math.PI) / 180;
    const len = 50 + power * 3;
    g.strokeStyle = 'rgba(255,248,230,.9)'; g.lineWidth = 3; g.setLineDash([8, 6]);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + Math.cos(a) * len, ay - Math.sin(a) * len); g.stroke();
    g.setLineDash([]);
    if (drawing && power > 1) {
      g.strokeStyle = 'rgba(255,248,230,.35)'; g.lineWidth = 2;
      g.beginPath(); path().forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    }
    if (arrowAt) {
      const [[x0, y0], [x1, y1]] = arrowAt;
      g.save(); g.translate(x1, y1); g.rotate(Math.atan2(y1 - y0, x1 - x0));
      g.fillStyle = '#120c08'; g.fillRect(-22, -1.5, 22, 3);
      g.beginPath(); g.moveTo(0, -5); g.lineTo(9, 0); g.lineTo(0, 5); g.fill(); g.restore();
    }
    const lit = Math.round((power / archer.arrowRange) * 20);
    segs.forEach((s, i) => s.classList.toggle('on', i < lit));
  };
  draw();
  await f.countdown('TAKE AIM');
  const t = f.timer(limit);
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
  const move = (e) => {
    const [x, y] = pt(e);
    if (drawing) {
      const a = (angle * Math.PI) / 180;
      const back = -((x - drawing[0]) * Math.cos(a) - (y - drawing[1]) * Math.sin(a));
      power = Math.min(archer.arrowRange, Math.max(0, back) * 0.105);
    } else {
      let deg = (Math.atan2(ay - y, x - ax) * 180) / Math.PI;
      if (deg < 0) deg = deg < -90 ? 158 : 21;
      angle = Math.max(21, Math.min(158, deg));
    }
    draw();
  };
  const down = (e) => { drawing = pt(e); };
  const up = () => { if (drawing) { fired = power > 1; t.stop(); } };
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  await t.promise;
  cv.removeEventListener('pointermove', move);
  window.removeEventListener('pointerup', up);
  if (!fired) fired = power > 1;
  drawing = null;
  if (fired) {
    const pts = path();
    const step = Math.max(1, Math.floor(pts.length / 50));
    for (let i = step; i < pts.length; i += step) {
      draw([pts[i - step], pts[i]]);
      await new Promise((r) => requestAnimationFrame(r));
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  cv.remove();
  f.close();
  return { power, angle, fired };
}
