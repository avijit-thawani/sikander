// Global UI settings, filled from URL params and the setup screen.
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const settings = {
  fast: params.get('fast') === '1',
  quick: params.get('quick') === '1',
  seed: params.has('seed') ? Number(params.get('seed')) : Math.floor(Math.random() * 1e6),
  minigames: params.get('mg') !== '0',
};
