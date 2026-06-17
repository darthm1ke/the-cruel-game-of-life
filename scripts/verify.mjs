/**
 * Headless verification harness. Loads the running dev server, then:
 *  1. Confirms the game boots with no page errors (Milestone 0).
 *  2. Screenshots Menu / Debug / Game scenes (Milestones 0/1/5).
 *  3. Runs assertion scenarios against the pure GameState engine in-page,
 *     verifying the daily cycle, action deltas, binge, crash, control override,
 *     and game-over causes (Milestones 2/3) BEFORE we mark them done.
 *
 * Dev server must be running on :5173.  Usage: node scripts/verify.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const PORT = process.argv[2] || '5173';
const URL = `http://localhost:${PORT}/`;
const OUT = 'verify-shots';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });

const errors = [];
let hitAreaPass = false;
page.on('pageerror', (e) => errors.push(String(e)));
page.on('requestfailed', (r) => {
  const u = r.url();
  if (!u.endsWith('favicon.ico')) errors.push(`REQ FAIL ${u} ${r.failure()?.errorText}`);
});

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction('!!window.__tcgol', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${OUT}/1-menu.png` });

// Drive scenes directly via the exposed game (robust, no pixel-clicking).
async function startScene(key, data) {
  await page.evaluate(
    (k, d) => {
      const g = window.__tcgol.game;
      g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
      g.scene.start(k, d);
    },
    key,
    data ?? null
  );
  await new Promise((r) => setTimeout(r, 900));
}

await startScene('Debug');
await page.screenshot({ path: `${OUT}/2-debug-tiers.png` });

await startScene('Game');
await page.screenshot({ path: `${OUT}/5-game.png` });

// Map a virtual (640x360) coordinate to a screen click on the FIT-scaled canvas.
async function clickVirtual(vx, vy) {
  const rect = await page.evaluate(() => {
    const c = document.querySelector('#game canvas');
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.click(rect.x + (vx / 640) * rect.w, rect.y + (vy / 360) * rect.h);
}

// BUTTON HIT-AREA TEST: clicking the "Work" button (top-left, center ~67,246) must
// trigger Work (money goes UP), not the neighbouring "Walk" (which would not pay).
const sceneMoney = () =>
  page.evaluate(() => window.__tcgol.game.scene.getScene('Game').gs.stats.money);
const moneyBefore = await sceneMoney();
await clickVirtual(67, 246); // Work button center
await new Promise((r) => setTimeout(r, 300));
const moneyAfter = await sceneMoney();
hitAreaPass = moneyAfter > moneyBefore;
console.log(`[${hitAreaPass ? 'PASS' : 'FAIL'}] Work button triggers Work  (money ${moneyBefore} -> ${moneyAfter})`);

// Early: the sprite should be WALKING toward the desk zone (not yet seated).
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${OUT}/6-walking-to-desk.png` });

// Let it arrive + sit (hurry to speed it), screenshot the sit-at-desk.
await page.evaluate(() => document.querySelector('#game canvas')?.focus());
await page.keyboard.down('f');
await new Promise((r) => setTimeout(r, 2600));
await page.screenshot({ path: `${OUT}/6b-at-desk.png` });

// Take two more (hurried) so the sprite travels to other zones + time advances.
await clickVirtual(311, 246); // Exercise -> walks to the gym (treadmill)
await new Promise((r) => setTimeout(r, 3500));
await clickVirtual(189, 246); // Walk -> wanders the room
await new Promise((r) => setTimeout(r, 3500));
await page.keyboard.up('f');
await page.screenshot({ path: `${OUT}/8-time-advanced.png` });

// END OF DAY: sprite walks to bed, lies down horizontally, night sky runs.
await clickVirtual(423, 311); // SLEEP — END THE DAY (bottom-right button)
await page.evaluate(() => document.querySelector('#game canvas')?.focus());
await page.keyboard.down('f'); // hurry the night
await new Promise((r) => setTimeout(r, 650));
await page.screenshot({ path: `${OUT}/9-sleeping.png` }); // lying in bed, moon out
await new Promise((r) => setTimeout(r, 1400));
await page.keyboard.up('f');
await page.screenshot({ path: `${OUT}/10-new-morning.png` }); // woke into the new day

await startScene('GameOver', { cause: 'won', day: 42, weight: 78.4, tier: 'Lean' });
await page.screenshot({ path: `${OUT}/7-gameover-win.png` });

// ---- Engine assertion scenarios (run in-page against the real bundle) ----
const results = await page.evaluate(() => {
  const { GameState } = window.__tcgol;
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail });

  // M2: fresh state sane.
  {
    const g = new GameState(1);
    ok('fresh weight=132', g.stats.weight === 132, `weight=${g.stats.weight}`);
    ok('fresh slots=4', g.slotsLeft === 4, `slots=${g.slotsLeft}`);
    ok('fresh tier=Heavy(3)', g.tier.tier === 3, `tier=${g.tier.tier}`);
  }

  // M2: each action consumes a slot and moves stats in the expected direction.
  {
    const g = new GameState(2);
    const before = { ...g.stats };
    const r = g.act('work');
    ok('work pays money', r.ok && g.stats.money > before.money, `money ${before.money}->${g.stats.money}`);
    ok('work costs energy', g.stats.energy < before.energy, `energy ${before.energy}->${g.stats.energy}`);
    ok('work uses a slot', g.slotsLeft === 3, `slots=${g.slotsLeft}`);
  }
  {
    const g = new GameState(3);
    const w0 = g.stats.weight;
    g.act('exercise');
    ok('exercise lowers weight', g.stats.weight < w0, `weight ${w0}->${g.stats.weight}`);
  }
  {
    const g = new GameState(4);
    g.stats.hunger = 80; // start hungry so the -40 isn't lost to the 0 floor
    g.act('cook');
    ok('cook lowers hunger a lot', g.stats.hunger <= 41, `hunger 80->${g.stats.hunger}`);
  }

  // M2: work is gated by low energy.
  {
    const g = new GameState(5);
    g.stats.energy = 10;
    const r = g.act('work');
    ok('work gated when exhausted', !r.ok, `ok=${r.ok} msg=${r.message}`);
  }

  // M2: daily cycle advances the day and refills slots.
  {
    const g = new GameState(6);
    const d0 = g.day;
    g.slotsLeft = 0;
    g.endDay();
    ok('endDay advances day', g.day === d0 + 1, `day ${d0}->${g.day}`);
    ok('endDay refills slots', g.slotsLeft === 4, `slots=${g.slotsLeft}`);
  }

  // M3: binge fires under extreme pressure and is bounded (run many seeds).
  {
    let fired = 0;
    let badRange = 0;
    for (let s = 0; s < 60; s++) {
      const g = new GameState(100 + s);
      g.stats.hunger = 100;
      g.stats.mood = 0;
      g.bingeResist = 40;
      const money0 = g.stats.money;
      const w0 = g.stats.weight;
      g.endDay();
      if (g.stats.weight > w0 + 0.5) {
        fired++;
        const gain = g.stats.weight - w0;
        // weight gain should be within ~3%..10% of body weight (plus overnight noise)
        if (gain > w0 * 0.12 || g.stats.money > money0) badRange++;
      }
    }
    ok('binge fires under max pressure', fired > 30, `fired ${fired}/60`);
    ok('binge stays in bounds', badRange === 0, `out-of-range=${badRange}`);
  }

  // M3: control override engages at control=0 (game acts for you).
  {
    const g = new GameState(7);
    g.stats.control = 0;
    const r = g.controlOverride();
    ok('control override acts at 0', r && r.ok, `r=${r && r.id}`);
    const g2 = new GameState(8);
    const r2 = g2.controlOverride();
    ok('no override when control>0', r2 === null, `r2=${r2}`);
  }

  // M3: each game-over cause is reachable.
  {
    const g = new GameState(9);
    g.stats.weight = 70; // below WIN_WEIGHT
    g.act('walk');
    ok('win when weight low enough', g.cause === 'won', `cause=${g.cause}`);

    const g2 = new GameState(10);
    g2.stats.healthRisk = 100;
    g2.stats.weight = 120;
    g2.act('search'); // healthRisk-neutral action -> stays maxed -> crash check fires
    ok('crash when healthRisk maxed', g2.cause === 'crash', `cause=${g2.cause}`);

    const g3 = new GameState(11);
    g3.stats.debt = 1600;
    g3.act('walk');
    ok('debt loss when debt huge', g3.cause === 'debt', `cause=${g3.cause}`);

    // Sustained starvation (not an instant kill) -> 'starved' after several days.
    // Keep mood/control high to isolate from the binge release valve.
    const g4 = new GameState(13);
    for (let i = 0; i < 8 && !g4.over; i++) {
      g4.stats.mood = 100; // suppress the binge release valve
      g4.stats.control = 100;
      g4.stats.hunger = 96; // stay severely under-fed
      g4.weightYesterday = g4.stats.weight; // avoid spurious fast-loss penalty
      g4.endDay();
    }
    ok('sustained starvation -> starved', g4.cause === 'starved', `cause=${g4.cause} starveDays=${g4.starveDays}`);
  }

  // M4: med is gated until the search quest unlocks it.
  {
    const g = new GameState(12);
    const r = g.act('med');
    ok('med gated before unlock', !r.ok, `msg=${r.message}`);
    g.act('search');
    g.act('search');
    g.act('search');
    ok('med unlocks after 3 searches', g.medUnlocked, `unlocked=${g.medUnlocked}`);
  }

  return out;
});

console.log('\n===== ENGINE ASSERTIONS =====');
let failed = 0;
for (const r of results) {
  const tag = r.pass ? 'PASS' : 'FAIL';
  if (!r.pass) failed++;
  console.log(`[${tag}] ${r.name}  (${r.detail})`);
}

console.log('\n===== PAGE ERRORS =====');
console.log(errors.length ? errors.join('\n') : '(none)');

await browser.close();
const bad = failed + errors.length + (hitAreaPass ? 0 : 1);
console.log(
  `\n${bad === 0 ? 'ALL GREEN' : bad + ' PROBLEM(S)'} — ${results.length} assertions, button hit-area ${
    hitAreaPass ? 'OK' : 'FAIL'
  }, ${errors.length} errors`
);
process.exit(bad ? 1 : 0);
