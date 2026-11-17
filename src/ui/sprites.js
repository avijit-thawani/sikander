// Troop walk-cycle strips (48 frames, 150 px tall). Saturated pixels are recoloured to the army colour.
export const FRAMES = 48;
export const FRAME_H = 110;

const cache = new Map();

export function spriteFor(u) {
  const greek = u.army === 'greeks';
  if (u.mounted) return 'elephant_walk_strip';
  if (u.tier === 'hero') return greek ? 'greek_hero' : 'indian_hero';
  if (u.tier === 'archer') return greek ? 'greek_archer' : 'indian_archer';
  if (greek) return u.tier === 'elite' ? 'greek_sword' : 'greek_phalanx';
  return u.army === 'pauravas' && u.tier === 'warrior' ? 'indian_spear' : 'indian_sword';
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Resolves to { url, fw, fh } or null if the strip is missing.
export function loadSprite(name, colour) {
  const key = `${name}|${colour}`;
  if (!cache.has(key)) {
    cache.set(key, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height);
        const p = d.data;
        const [cr, cg, cb] = hexRgb(colour);
        for (let i = 0; i < p.length; i += 4) {
          const r = p[i], gg = p[i + 1], b = p[i + 2];
          const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
          if (mx > 60 && mx - mn > 50) {
            const k = mx / 255;
            p[i] = cr * k; p[i + 1] = cg * k; p[i + 2] = cb * k;
          } else {
            p[i] = p[i + 1] = p[i + 2] = Math.min(mn, 30);
          }
        }
        g.putImageData(d, 0, 0);
        c.toBlob((blob) => resolve({ url: URL.createObjectURL(blob), fw: img.width / FRAMES, fh: img.height }));
      };
      img.onerror = () => resolve(null);
      img.src = `assets/sprites/${name}.png`;
    }));
  }
  return cache.get(key);
}
