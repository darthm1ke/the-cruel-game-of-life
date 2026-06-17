/**
 * Balance-pass simulator (CHECKPOINTS M6).
 *
 * Spins up headless Chrome against the running dev server and drives the REAL
 * bundled `GameState` engine through hundreds of full runs per AI strategy.
 * For each strategy it reports win rate, median/mean days survived, and the
 * distribution of death causes.
 *
 * What we're checking:
 *  - No single strategy dominates (one strat winning >> others = imbalanced).
 *  - Death is systemic: causes are spread, not 95% one cause (= feels like a bug).
 *  - The game is winnable at all (some strat wins sometimes) but rarely (brutal).
 *
 * Dev server must be running.  Usage: node scripts/balance.mjs [port] [runsPerStrat]
 */
import puppeteer from 'puppeteer-core';

const PORT = process.argv[2] || '8421';
const RUNS = parseInt(process.argv[3] || '400', 10);
const URL = `http://localhost:${PORT}/`;

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=swiftshader'],
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction('!!window.__tcgol', { timeout: 15000 });

const report = await page.evaluate(
  (RUNS) => {
    const { GameState } = window.__tcgol;
    const MAX_DAYS = 365; // a "survivor" who never resolves is capped here

    // --- AI strategies: each picks one action given the current state. ---
    // They return an ActionId or 'END' to sleep. Kept deliberately simple so
    // results reflect the SYSTEMS, not clever play.
    const strategies = {
      starve: (g) => {
        // Save money, refuse food, work when able. The "lose fast" trap.
        if (g.stats.energy >= 25 && g.stats.money < 200) return 'work';
        if (g.stats.energy >= 15) return 'exercise';
        return 'skip';
      },
      eatCheap: (g) => {
        if (g.stats.hunger > 55) return 'snack';
        if (g.stats.energy >= 25) return 'work';
        return 'walk';
      },
      eatHealthy: (g) => {
        if (g.stats.hunger > 50 && g.stats.money >= 22) return 'cook';
        if (g.stats.energy >= 25) return 'work';
        if (g.stats.money < 30) return 'work';
        return 'walk';
      },
      exerciseMax: (g) => {
        if (g.stats.energy >= 15) return 'exercise';
        if (g.stats.hunger > 60 && g.stats.money >= 22) return 'cook';
        if (g.stats.money < 30) return 'work';
        return 'rest';
      },
      grayPen: (g) => {
        // Chase the miracle: search to unlock, then lean on the pen.
        if (!g.medUnlocked) return g.stats.energy >= 8 ? 'search' : 'rest';
        if (g.stats.money >= 90 && g.stats.hunger > 50) return 'med';
        if (g.stats.energy >= 25) return 'work';
        return 'walk';
      },
      balanced: (g) => {
        const s = g.stats;
        if (s.energy < 20) return 'rest';
        if (s.hunger > 65) return s.money >= 22 ? 'cook' : 'snack';
        if (s.money < 60 && s.energy >= 25) return 'work';
        if (s.control < 40) return 'rest';
        return 'exercise';
      },
      random: (g, rng) => {
        const opts = ['work', 'walk', 'exercise', 'cook', 'snack', 'skip', 'search', 'rest', 'fridge'];
        return opts[Math.floor(rng() * opts.length)];
      },
    };

    function runOne(name, seed) {
      const g = new GameState(seed);
      // local deterministic rng for the 'random' strat (seeded off run seed)
      let rs = (seed * 2654435761) >>> 0;
      const rng = () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296);
      const pick = strategies[name];

      let guard = MAX_DAYS * 8;
      while (!g.over && g.day < MAX_DAYS && guard-- > 0) {
        if (g.slotsLeft <= 0) {
          g.endDay();
          continue;
        }
        // Honor the control override if the game has taken over.
        const forced = g.controlOverride();
        if (forced) continue;
        let a = pick(g, rng);
        const r = g.act(a);
        if (!r.ok) {
          // action gated/failed -> fall back to something always-legal
          if (g.stats.energy < 25) g.act('rest');
          else g.act('walk');
        }
      }
      return { cause: g.over ? g.cause : 'survivor', days: g.day, weight: g.stats.weight };
    }

    const median = (arr) => {
      if (!arr.length) return 0;
      const a = [...arr].sort((x, y) => x - y);
      const m = Math.floor(a.length / 2);
      return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
    };

    const out = {};
    for (const name of Object.keys(strategies)) {
      const days = [];
      const causes = {};
      let wins = 0;
      for (let i = 0; i < RUNS; i++) {
        const res = runOne(name, 1000 + i);
        days.push(res.days);
        causes[res.cause] = (causes[res.cause] || 0) + 1;
        if (res.cause === 'won') wins++;
      }
      out[name] = {
        winPct: +((wins / RUNS) * 100).toFixed(1),
        medianDays: median(days),
        meanDays: +(days.reduce((a, b) => a + b, 0) / RUNS).toFixed(1),
        maxDays: Math.max(...days),
        causes,
      };
    }
    return { RUNS, out };
  },
  RUNS
);

await browser.close();

// --- Pretty print ---
console.log(`\n=== BALANCE REPORT — ${report.RUNS} runs/strategy ===\n`);
const rows = Object.entries(report.out);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('strategy', 13), pad('win%', 7), pad('medDays', 9), pad('meanDays', 9), pad('max', 6), 'death causes');
for (const [name, r] of rows) {
  const causeStr = Object.entries(r.causes)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c}:${n}`)
    .join(' ');
  console.log(pad(name, 13), pad(r.winPct, 7), pad(r.medianDays, 9), pad(r.meanDays, 9), pad(r.maxDays, 6), causeStr);
}

// --- Quick automated read of balance health ---
console.log('\n=== READ ===');
const winPcts = rows.map(([, r]) => r.winPct);
const maxWin = Math.max(...winPcts);
const anyWins = winPcts.some((w) => w > 0);
const allCauses = {};
for (const [, r] of rows) for (const [c, n] of Object.entries(r.causes)) allCauses[c] = (allCauses[c] || 0) + n;
const totalDeaths = Object.entries(allCauses).filter(([c]) => c !== 'won' && c !== 'survivor').reduce((a, [, n]) => a + n, 0);
const causeShare = Object.entries(allCauses)
  .filter(([c]) => c !== 'won' && c !== 'survivor')
  .map(([c, n]) => `${c} ${((n / totalDeaths) * 100).toFixed(0)}%`)
  .join(', ');
console.log(`winnable at all:        ${anyWins ? 'yes' : 'NO — nobody ever wins'}`);
console.log(`hardest dominance gap:  best win% = ${maxWin} (want: low, no runaway strat)`);
console.log(`death cause spread:     ${causeShare}`);
console.log(`survivors (capped 365): ${rows.map(([n, r]) => `${n}:${r.causes.survivor || 0}`).join(' ')}`);
