// Hand-drawn SVG unit icons (fill = currentColor).
const wrap = (body) => `<svg viewBox="0 0 32 32" class="icon" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  crown: wrap('<path fill="currentColor" stroke="#1b1208" stroke-width="1.2" d="M5 23 L4 10 L10 15 L16 6 L22 15 L28 10 L27 23 Z"/><rect x="5" y="24" width="22" height="3.5" rx="1" fill="currentColor" stroke="#1b1208" stroke-width="1.2"/><circle cx="16" cy="18" r="2" fill="#1b1208"/>'),
  sword: wrap('<path fill="currentColor" stroke="#1b1208" stroke-width="1.2" d="M23.5 4 L27.5 4.5 L27 8.5 L13.5 22 L10 18.5 Z"/><path fill="#1b1208" d="M7.5 17.5 L14.5 24.5 L13 26 L6 19 Z"/><path fill="currentColor" stroke="#1b1208" stroke-width="1" d="M9.5 23 L5.5 27 L4.5 26.5 L4 25.5 L8 21.5 Z"/>'),
  spear: wrap('<path d="M5 28 L24 9" stroke="#1b1208" stroke-width="3.8" stroke-linecap="round"/><path d="M5 28 L24 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path fill="currentColor" stroke="#1b1208" stroke-width="1.2" d="M21.5 7.5 L29 3 L24.5 10.5 Z"/><circle cx="11" cy="21" r="6.5" fill="currentColor" stroke="#1b1208" stroke-width="1.4"/><circle cx="11" cy="21" r="2" fill="#1b1208"/>'),
  bow: wrap('<path fill="none" stroke="currentColor" stroke-width="3.2" d="M9 4 Q27 16 9 28"/><path fill="none" stroke="#1b1208" stroke-width="1" d="M9 4 L9 28"/><path fill="#1b1208" d="M4 15 L22 15 L22 17 L4 17 Z"/><path fill="currentColor" stroke="#1b1208" stroke-width="1" d="M22 13 L28 16 L22 19 Z"/>'),
  elephant: wrap('<path fill="currentColor" stroke="#1b1208" stroke-width="1.2" d="M5 13 Q6 7 13 7 L20 7 Q26 7 27 13 Q28 17 27 22 L27.5 27 L24.5 27 L24 22 Q23 23 21 23 L21 27 L18 27 L18 23 L12 23 L12 27 L9 27 L9 22 Q7 21 6 18 Q4 21 4.5 25 L3 25 Q2.5 19 5 13 Z"/><circle cx="9" cy="12" r="1.2" fill="#1b1208"/><path d="M8 17 Q11 18 12 16" stroke="#f3ead2" stroke-width="1.6" fill="none"/>'),
};

const cmd = (body) => `<svg viewBox="0 0 24 24" class="cicon" aria-hidden="true">${body}</svg>`;
export const CMD_ICONS = {
  move: cmd('<path fill="currentColor" d="M12 1 L16 6 H13.5 V10.5 H18 V8 L23 12 L18 16 V13.5 H13.5 V18 H16 L12 23 L8 18 H10.5 V13.5 H6 V16 L1 12 L6 8 V10.5 H10.5 V6 H8 Z"/>'),
  fortify: cmd('<path fill="currentColor" d="M3 4 H7 V7 H10 V4 H14 V7 H17 V4 H21 V21 H3 Z"/><rect x="10" y="14" width="4" height="7" fill="#f2c14e"/>'),
  fire: cmd('<path fill="none" stroke="currentColor" stroke-width="2.4" d="M7 2 Q20 12 7 22"/><path stroke="currentColor" stroke-width="1.6" d="M3 12 H19"/><path fill="currentColor" d="M18 9 L23 12 L18 15 Z"/>'),
  taunt: cmd('<path fill="currentColor" d="M3 3 H21 V16 H11 L6 21 V16 H3 Z"/><text x="12" y="13.5" font-size="11" font-weight="bold" text-anchor="middle" fill="#f2c14e">!</text>'),
  cancel: cmd('<path stroke="currentColor" stroke-width="3.4" stroke-linecap="round" d="M5 5 L19 19 M19 5 L5 19"/>'),
  break: cmd('<path fill="currentColor" d="M2 5 H10 V9 H2 Z M14 5 H22 V9 H14 Z M2 15 H10 V19 H2 Z M14 15 H22 V19 H14 Z"/>'),
};

export function iconFor(unit) {
  if (unit.tier === 'hero') return ICONS.crown;
  if (unit.tier === 'archer') return ICONS.bow;
  if (unit.mounted) return ICONS.elephant;
  if (unit.tier === 'elite') return ICONS.sword;
  return unit.army === 'mauryas' ? ICONS.sword : ICONS.spear;
}

// Side-on silhouette of a small block of soldiers for the battle-view strip.
export function silhouette(unit, colour) {
  const weapon = unit.tier === 'archer'
    ? '<path d="M14 6 Q20 12 14 18" stroke="#111" stroke-width="1.5" fill="none"/>'
    : '<path d="M13 2 L13 20" stroke="#111" stroke-width="1.5"/>';
  const man = (x) => `<g transform="translate(${x},0)"><circle cx="8" cy="6" r="3" fill="#111"/><path d="M5 10 L11 10 L12 22 L10 32 L8 32 L8 24 L7 32 L5 32 L4 22 Z" fill="#111"/>${weapon}</g>`;
  const crown = unit.tier === 'hero' ? '<path d="M16 0 L18 -4 L20 0 L22 -4 L24 0 Z" fill="#f2c14e"/>' : '';
  return `<svg viewBox="0 -6 44 40" class="sil"><rect x="2" y="12" width="40" height="5" fill="${colour}" opacity=".9"/>${man(0)}${man(13)}${man(26)}<g transform="translate(-3,0)">${crown}</g></svg>`;
}
