// Renders the 5 x 30 tactical grid. Row 4 is drawn at the top, row 0 at the bottom.
import { ROWS, COLS } from '../engine/data.js';
import { inZone } from '../engine/army.js';
import { iconFor } from './icons.js';

export function renderGrid(el, b, o = {}) {
  const hl = o.highlights || new Set();
  const targets = o.targets || new Map();
  const ordered = o.ordered || new Set();
  let html = '';
  for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      const k = `${c},${r}`;
      const cls = ['cell'];
      if (b.isBlock(c, r)) cls.push('block');
      if (o.zone != null && inZone(o.zone, c, r)) cls.push('zone');
      if (hl.has(k)) cls.push('hl');
      if (c === 14 || c === 15) cls.push(c === 14 ? 'mid-l' : 'mid-r');
      let inner = '';
      if (targets.has(k)) inner += `<span class="tgt">${targets.get(k)}</span>`;
      const u = b.unitAt(c, r);
      if (u) {
        const g = u.group ? b.groups.get(u.group) : null;
        const ucls = ['unit', `s${u.side}`];
        if (o.selected === u.id) ucls.push('sel');
        if (b.isFortified(u)) ucls.push('fort');
        if (u.engaged.size) ucls.push('eng');
        if (g) ucls.push(`grp-${g.type}`);
        if (ordered.has(u.id)) ucls.push('ordered');
        if (o.flash?.has(u.id)) ucls.push('flash');
        const hp = Math.max(0, u.health / u.hp);
        inner += `<div class="${ucls.join(' ')}" data-unit="${u.id}" style="--c:${o.colourOf(u.side)}" title="${u.name}">
          ${iconFor(u)}<div class="hp"><i style="width:${hp * 100}%"></i></div></div>`;
      }
      html += `<div class="${cls.join(' ')}" data-c="${c}" data-r="${r}">${inner}</div>`;
    }
  }
  el.innerHTML = html;
}

// One-time event wiring with delegation; handlers are read from el._h so they can change.
export function bindGrid(el, handlers) {
  el._h = handlers;
  if (el._bound) return;
  el._bound = true;
  const cellOf = (t) => t.closest?.('.cell');
  el.addEventListener('click', (e) => {
    const cell = cellOf(e.target);
    if (!cell || !el._h.onCell) return;
    el._h.onCell(+cell.dataset.c, +cell.dataset.r, e);
  });
  el.addEventListener('mouseover', (e) => {
    const u = e.target.closest?.('.unit');
    if (el._h.onHover) el._h.onHover(u ? +u.dataset.unit : null);
  });
  el.addEventListener('pointerdown', (e) => {
    const u = e.target.closest?.('.unit');
    if (u && el._h.onDragStart) el._h.onDragStart(+u.dataset.unit, e);
  });
}
