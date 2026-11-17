// Headless smoke test: node tests/e2e.mjs [baseUrl]
// Clicks title -> skirmish -> setup -> armies -> randomise -> auto-place -> battle,
// gives a few orders, executes rounds, saves screenshots to shots/, reports console errors.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// puppeteer-core and the headless-shell helper are borrowed from a sibling checkout.
const LAB = process.env.AI_VIDEO_LAB
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'ai-video');
const require = createRequire(path.join(LAB, 'package.json'));
const puppeteer = require('puppeteer-core');
const { headlessShellPath } = await import(path.join(LAB, 'tools/headless.mjs'));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const BASE = process.argv[2] || 'http://127.0.0.1:8067/';
const RUN = new Date().toISOString().replace(/[:.]/g, '-');
const shots = [];
const errors = [];

const browser = await puppeteer.launch({ executablePath: headlessShellPath(), headless: 'shell', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => { if (!r.url().endsWith('.mp3')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });

const shot = async (name) => {
  const f = path.join(SHOTS, `${RUN}_${String(shots.length + 1).padStart(2, '0')}_${name}.png`);
  await page.screenshot({ path: f });
  shots.push(f);
};
const click = async (sel) => { await page.waitForSelector(sel, { visible: true, timeout: 15000 }); await page.click(sel); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Select a unit, choose Move in its command ring, click the most forward reachable cell.
async function orderForward(id) {
  const sel = `#grid .unit[data-unit="${id}"]`;
  if (!(await page.$(sel))) return false;
  await page.click(sel);
  if (!(await page.$('#cmd-move'))) return false;
  await page.click('#cmd-move');
  const target = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#grid .cell.hl')];
    cells.sort((a, b) => b.dataset.c - a.dataset.c);
    return cells[0] ? `#grid .cell[data-c="${cells[0].dataset.c}"][data-r="${cells[0].dataset.r}"]` : null;
  });
  if (!target) return false;
  await page.click(target);
  return true;
}

async function waitCommandPhase(round) {
  await page.waitForFunction((r) => {
    const b = window.__battle;
    return b && (b.over || (b.phase === 'command' && b.round >= r && !document.querySelector('#btn-execute').disabled));
  }, { timeout: 120000 }, round);
  await sleep(50);
}

try {
  await page.goto(`${BASE}?seed=11&fast=1&mg=0`, { waitUntil: 'networkidle0' });
  await shot('title');
  await click('#btn-skirmish');
  await page.click('input[name=map][value="2"]');
  await shot('setup');
  await click('#btn-continue');
  await click('#next1'); // Greeks -> Mauryas for the computer
  await shot('armies');
  await click('#btn-continue');
  await click('#btn-randomise');
  await shot('troops');
  await click('#btn-continue');
  await click('#btn-autoplace');
  await shot('placement');
  await click('#btn-continue');
  await page.waitForSelector('#grid .unit');
  await shot('battle-start');

  // Round 1: order up to three individual units forward, using the command ring.
  const ids = await page.evaluate(() => window.__battle.alive(0).filter((u) => !u.group).slice(0, 3).map((u) => u.id));
  for (const id of ids) await orderForward(id);
  await shot('orders-given');
  const ordered = await page.evaluate(() => document.querySelectorAll('#grid .unit.ordered').length);
  for (let r = 1; r <= 6; r++) {
    const over = await page.evaluate(() => window.__battle.over);
    if (over) break;
    if (r > 1) {
      // later rounds: move every free unit as far right as possible
      const free = await page.evaluate(() => window.__battle.alive(0).filter((u) => !u.engaged.size).slice(0, 4).map((u) => u.id));
      for (const id of free) await orderForward(id);
    }
    await click('#btn-execute');
    await waitCommandPhase(r + 1);
    if (r === 2 || r === 5) await shot(`round-${r}`);
  }
  const summary = await page.evaluate(() => {
    const b = window.__battle;
    return { round: b.round, over: b.over, result: b.result, events: b.events.length, log: document.querySelectorAll('#log .ev').length };
  });
  console.log('battle state:', JSON.stringify(summary), 'ordered-units-shown:', ordered);
  if (!summary.events || summary.log < 3) errors.push('battle log did not fill');
  if (!summary.over) { await page.click('#btn-surrender'); }
  await page.waitForSelector('#result-banner');
  await shot('results');

  // The other mini-games, opened directly on a quick battle (fast=1 skips the countdowns).
  await page.goto(`${BASE}?quick=1&seed=9&fast=1&mg=1`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#grid .unit');
  const mg = async (name, starter, act) => {
    await page.evaluate(starter);
    await page.waitForSelector('.mg', { timeout: 5000 });
    await act();
    await shot(`mg-${name}`);
    await page.waitForFunction(() => window.__mgDone !== undefined, { timeout: 30000 });
    console.log(`${name} result:`, JSON.stringify(await page.evaluate(() => window.__mgDone)));
    await page.evaluate(() => { delete window.__mgDone; });
  };
  await mg('charge', () => { import('/src/ui/mg-charge.js').then((m) => m.playCharge({ chargeMax: 340, N: 35, colour: '#2e9e57', name: 'War elephants' }).then((r) => { window.__mgDone = r; })); },
    async () => { for (let i = 0; i < 20; i++) { await page.keyboard.press('Space'); } });
  await mg('melee', () => { import('/src/ui/mg-melee.js').then((m) => m.playMelee({ title: 'Kshatriyas vs Greeks Hypaspists', colour: '#e8892b' }).then((r) => { window.__mgDone = r; })); },
    async () => { await sleep(2500); for (const k of ['ArrowUp', 'ArrowLeft', 'ArrowDown']) await page.keyboard.press(k); });
  await mg('archery', () => {
    const b = window.__battle; const a = b.units.find((u) => u.isArcher && u.side === 0) || b.units[0];
    import('/src/ui/mg-archery.js').then((m) => m.playArchery({ battle: b, archer: a, limit: 8, colourOf: (s) => (s ? '#4a7fe0' : '#e8892b') }).then((r) => { window.__mgDone = r; }));
  }, async () => {
    const box = await (await page.$('canvas.arch-overlay')).boundingBox();
    const ax = box.x + box.width * 0.15, ay = box.y + box.height * 0.5;
    await page.mouse.move(ax + 60, ay - 60);
    await page.mouse.down();
    await page.mouse.move(ax - 60, ay + 60, { steps: 8 });
    await sleep(100);
    await shot('mg-archery-draw');
    await page.mouse.up();
  });

  // Quick mode + mini-games on: exercise the taunt typing mini-game.
  await page.goto(`${BASE}?quick=1&seed=5&mg=1`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#grid .unit');
  await shot('quick');
  const hero = await page.evaluate(() => window.__battle.alive(0).find((u) => u.tier === 'hero' && !u.group)?.id);
  if (hero != null) {
    await page.click(`#grid .unit[data-unit="${hero}"]`);
    await click('#cmd-taunt');
    await page.click('#btn-execute');
    await page.waitForSelector('.taunt-phrase', { timeout: 15000 });
    await sleep(3200);
    const phrase = await page.evaluate(() => document.querySelector('.taunt-phrase').textContent.replace(/\u00a0/g, ' '));
    await page.keyboard.type(phrase, { delay: 20 });
    await shot('taunt-minigame');
    await page.waitForFunction(() => window.__battle.events.some((e) => e.type === 'taunt'), { timeout: 30000 });
    const t = await page.evaluate(() => window.__battle.events.find((e) => e.type === 'taunt'));
    console.log('taunt result:', t.text);
  }

  // Campaign entry: cutscene with skip.
  await page.goto(`${BASE}?seed=3&fast=1&mg=0`, { waitUntil: 'networkidle0' });
  await click('#btn-campaign');
  await click('#btn-continue');
  await page.waitForSelector('#cutscene');
  await sleep(1500);
  await shot('cutscene');
  await click('#btn-skip');
  await page.waitForSelector('.story');
  await shot('campaign-card');
  await click('#btn-continue');
  await page.waitForSelector('.troops');
} catch (e) {
  errors.push(`script: ${e.stack || e.message}`);
  await shot('failure').catch(() => {});
}
await browser.close();
console.log('screenshots:\n' + shots.join('\n'));
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('e2e OK, no console errors');
