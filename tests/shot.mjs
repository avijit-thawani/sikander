// Quick visual check: node tests/shot.mjs [width] [height] [query]
// Opens a quick battle, screenshots it, opens the command ring on the left-most unit, executes one round.
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
const [W = 1280, H = 900, Q = 'quick=1&seed=7&mg=0'] = process.argv.slice(2);
const RUN = new Date().toISOString().replace(/[:.]/g, '-');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: headlessShellPath(), headless: 'shell' });
const page = await browser.newPage();
await page.setViewport({ width: +W, height: +H });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:8067/?${Q}`);
await page.waitForSelector('#grid .unit');
await sleep(1500);
const shot = async (n) => { const f = path.join(SHOTS, `${RUN}_${n}.png`); await page.screenshot({ path: f }); console.log(f); };
await shot('1_battle');
const left = await page.evaluate(() => {
  const us = [...document.querySelectorAll('#grid .unit.s0')];
  us.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  return us[0]?.dataset.unit;
});
await page.click(`#grid .unit[data-unit="${left}"]`);
await sleep(300);
const ring = await page.evaluate(() => [...document.querySelectorAll('.ring-btn')].map((b) => { const r = b.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); }));
console.log('ring buttons', JSON.stringify(ring), 'viewport', W, H);
await shot('2_ring');
await page.click('#cmd-move');
await sleep(200);
const cell = await page.evaluate(() => { const c = [...document.querySelectorAll('#grid .cell.hl')].sort((a, b) => b.dataset.c - a.dataset.c)[0]; return c && `#grid .cell[data-c="${c.dataset.c}"][data-r="${c.dataset.r}"]`; });
if (cell) await page.click(cell);
await page.click('#btn-execute');
await sleep(2500);
await shot('3_exec');
await sleep(4000);
await shot('4_exec');
console.log('errors', JSON.stringify(errors));
await browser.close();
