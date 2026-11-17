import { ARMIES } from '../engine/data.js';

let muted = false;
export const setMuted = (m) => { muted = m; };
export const isMuted = () => muted;

export function playTauntClip(armyKey, idx) {
  if (muted) return;
  const a = new Audio(`assets/audio/taunts/${ARMIES[armyKey].tauntFolder}/${idx}.mp3`);
  a.volume = 0.9;
  a.play().catch(() => {});
}
