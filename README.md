# Sikander

A turn-based battle game set in 326 BC, played in the browser. Plain HTML, CSS and
vanilla JavaScript ES modules: no build step and no dependencies.

## Run

```sh
cd sikander
python3 -m http.server 8067 --bind 127.0.0.1
# open http://127.0.0.1:8067/
```

Debug URL parameters:

| Param | Effect |
|---|---|
| `?quick=1` | Skip the menus: random armies, random map, medium budget, both sides auto-placed, straight into battle |
| `?seed=N` | Seed for every random roll (army randomise, AI, off-mode mini-game results, morale rolls) |
| `?fast=1` | No animation pauses or mini-game countdowns, and the computer gets all its orders each round (for testing) |
| `?mg=1` | Start with mini-games switched on (the setup screen's default is off) |

## Test

```sh
node --test tests/                 # engine + AI unit tests (tests/index.js loads tests/*.test.mjs)
node tests/e2e.mjs                 # headless smoke test against a running server on :8067
```

`tests/e2e.mjs` uses the lab's own chrome-headless-shell via puppeteer-core from
`../ai-video` (never the system browser). It clicks through title, skirmish setup,
army select, randomise troops, auto-place and battle; issues orders through the
command ring and runs several rounds; shows the results overlay; plays each
mini-game; and opens the campaign cutscene and story card. Screenshots go to
`shots/<timestamp>_NN_name.png`. It exits non-zero on any console error, page
error or failed request.

## Folder structure

```
index.html
src/engine/   pure rules, no DOM
  data.js       stat tables, costs, budgets, maps, difficulty, campaign levels, taunt phrases
  rng.js        seeded PRNG (mulberry32)
  army.js       budgets, random selection, auto-arrangement, computer/campaign layouts, zones
  minisim.js    computer and "mini-games off" results, archery aiming helper
  battle.js     Battle: grid, formations, orders, movement, charge, melee, archery, morale, rounds, win/lose
src/ai/
  computer.js   per-round decision tree, row choice, move post-processing
  pacer.js      releases the computer's orders over time, mirroring the player's pace
src/ui/         DOM screens and components
  app.js        screen flow (title, setup, armies, troops, placement, battle, campaign, video)
  battleScreen.js, gridView.js, battleView.js (side-on strip), icons.js (SVG), resolver.js,
  mgframe.js + mg-taunt.js, mg-charge.js, mg-melee.js, mg-archery.js, audio.js, help.js, style.css
assets/         our own images, sprite strip, cutscene and taunt audio (see ASSETS.md)
tests/          node --test unit tests, e2e.mjs smoke test
shots/          e2e screenshots
```

## Clean-room statement

This game was written only from the prose design spec in `../1066/design/`
(`README.md`, `01-combat.md`, `02-world-ai-flow.md`). No source code, art, sound,
fonts or text from the original game, its decompiled export or any `.swf` file was
opened, copied or ported. All names, setting and player-facing text are new. Every
asset is our own (see `ASSETS.md`).

## Done

- Rules engine: full stat tables, costs and budgets, the 5 × 30 grid, deployment zones,
  the three maps' obstacles, L-shaped paths and Manhattan range, contact and engagement,
  outflanking, fortify, taunt, shield wall and wedge formations (group moves, Break,
  wedge charge), blind orders with alternating execution and first-mover swap,
  engagement phase, melee with the dying blow, charge, archery projectile and impact
  zone (friendly fire included), unit and army morale, fleeing and the leader rule,
  win/lose/draw, battle rank, difficulty multipliers. Deterministic per seed.
- Computer AI: decision tree, behaviour biases, strength comparison, row choice,
  archer range test, formation orders, move post-processing, paced order release.
- All four mini-games (archery, melee, taunt, charge), plus the "mini-games off"
  setting (default), which uses the spec's random results. Taunt clips play on every taunt.
- UI: title, skirmish setup, army select (with grey mirror army), troop selection with
  budget and randomise, placement (drag or click, auto-place, formation preview), battle
  screen (grid, command ring, Execute, log, morale bars, info panel, side-on view with
  sprite elephants), results with Play again, how-to-play.
- Campaign: 3 battles with fixed enemy layouts and preset troops, intro video with Skip,
  story cards between battles, retry on defeat.

## To do

- Unit animation sprites for the other unit types, battlefield backdrops, music and sound effects.
- Level codes, cheat phrases, camera pan and zoom, pause button, multiplayer.
- Cutscenes before battles 2 and 3 and after the final battle (text cards for now).

## Deviations from the spec

- Formation-capable units: heroes count, as in 01 §1.2 (02 §2.4 leaves them out). War elephants never form.
- Stale charge flag (01 open question 2): the contact mini-game is skipped only when *this* contact came from a charge.
- Outflanking is computed from the live engagement count (−½ base attack at 2 or more enemies), so it never stacks or leaks (01 open question 3).
- Engagement-phase exchanges: the unit of the side that moved first this round strikes first.
- The computer taunts with its own army's phrases, not always Army A's (02 open question 4).
- Column width is fixed at 50 world px (field 1500 px) and a unit's box is 50 px wide, which sets the archery scale (01 open question 5).
- Charge divisor kept as specified (25 / 35 / 30).
- Battles end in a stalemate after 60 rounds (the spec has no round cap).
- Troop-selection Continue needs the leader plus at least one other unit, within budget.
- The top rank is called "Raja".
