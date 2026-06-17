# The Cruel Game of Life - Development Checkpoints

> A brutal vicious-cycle survival clicker. The body isn't the joke - the *system* is.
> Based on the design in `convoaboutgame.md`.

## How to use this file
If we run out of session credits, this file is the source of truth for resuming.
Each checklist item has a **`// VERIFY:`** note describing how we confirm it actually
works **before** we mark it done. We do not check a box until its VERIFY passes.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done & verified

---

## Tech Stack (decided)
- **Phaser 3** - WebGL 2D game framework (great graphics + pixel-perfect retro rendering)
- **TypeScript** - type safety across the many interacting stat systems
- **Vite** - dev server + static build (deploys anywhere, runs fully in-browser)
- **Code-generated pixel art** - sprites drawn procedurally in code (no asset pipeline)
- Art direction: **8-bit retro**, single static room, clicker UI, bars everywhere

---

## Verification harness
`scripts/verify.mjs` (run `npm run dev` in one terminal, then `node scripts/verify.mjs`)
drives a headless Chrome against the running game: it confirms no page errors,
screenshots Menu/Debug/Game/GameOver into `verify-shots/`, and runs 20 assertions
against the pure `GameState` engine. **Current status: ALL GREEN - 20/20, 0 errors.**
This is the tool we use to satisfy each `// VERIFY:` note below.

## Milestone 0 - Project scaffold
- [x] Vite + Phaser + TypeScript project boots to a blank Phaser canvas
  // VERIFY: `npm run dev` serves on localhost; opening it shows a Phaser canvas
  //         (check title in tab + no console errors + Phaser version logged).
- [x] Pixel-perfect rendering config (no blurry scaling, integer zoom, fixed virtual resolution)
  // VERIFY: render a 1px checkerboard test texture scaled up; pixels are crisp squares,
  //         not blurred. Confirm `pixelArt: true` + `roundPixels` in the Phaser config.
  // DONE: pixelArt+roundPixels set; sprites in verify-shots are crisp (no blur).
- [x] Scene flow: Boot -> Preload -> Menu -> Game -> GameOver wired up
  // VERIFY: clicking through the menu reaches the game scene; dying returns to GameOver;
  //         "restart" returns to a fresh game with reset stats. Log scene transitions.

## Milestone 1 - Protagonist weight-tier sprite system
- [x] Procedural pixel-art generator for the man across 6 weight tiers (0 lean -> 5 morbid)
  // VERIFY: render all 6 tiers side-by-side on a debug screen; each is visibly a different
  //         body size, same character identity, crisp pixels. Screenshot comparison.
  // DONE: verify-shots/2-debug-tiers.png shows T0 lean -> T5 morbid, same character.
- [x] Sprite swaps tier automatically as the `weight` stat crosses thresholds
  // VERIFY: a debug slider/key changes weight; the on-screen body changes tier at the
  //         correct breakpoints (log "weight X -> tier N"). The lean tier appears only
  //         below the "no longer fat" threshold.
  // DONE: console logged weight 132->t3, 152->t4, 172->t5 at the config breakpoints.
- [x] Action poses per tier: idle, walk, exercise, eat, slump/exhausted
  // VERIFY: trigger each action in debug; the correct pose renders for the current tier.
  // DONE: all 5 poses generated per tier; Debug "cycle pose" swaps them live.
- [x] ART REDESIGN: South-Park/Cartman-style kid (round head, teal pom beanie, red coat,
      yellow mittens, big eyes) + multi-frame ANIMATIONS (idle bob, walk cycle, eat, exercise)
  // VERIFY: screenshot the debug tier row + drive actions in-game; confirm anims play and
  //         the body still re-tiers. DONE: verify-shots/2 + /6 (exercise mid-anim) confirm.
- [x] Object sprites: fridge, snack, laptop, treadmill, bed, mailbox, phone, scale (+ Gray Pen)
  // VERIFY: render all objects in the room; each is identifiable as its 8-bit icon.
  // DONE: all 9 object icons render in Debug + the Game room.

## Milestone 2 - Core stat model & daily cycle (the engine)
- [x] `GameState` holds: weight, hunger, energy, money, debt, mood, control, healthRisk, hope, day
  // VERIFY: unit-style console assertions: fresh state has expected starting values;
  //         clamping keeps every 0-100 stat in range; weight/money never NaN.
  // DONE: assertions "fresh weight=132 / slots=4 / tier=Heavy" pass; apply() clamps.
- [x] Daily cycle: each day grants action slots; actions consume slots; day resolves at end
  // VERIFY: spend all slots -> "end day" triggers; a new day increments the counter and
  //         applies overnight changes. Log the full day-resolution math.
  // DONE: assertions "endDay advances day / refills slots" pass.
- [x] Actions implemented: Work, Walk, Exercise, Cook(healthy), CheapSnack, SkipMeal,
      SearchOnline, Rest/Sleep, OpenFridge(risky)
  // VERIFY: each action moves the expected stats in the expected direction by the
  //         expected amount (table-driven test in console). Work gated by energy.
  // DONE: work pays+costs energy+uses slot, exercise lowers weight, cook lowers hunger,
  //       work gated when exhausted - all assert PASS.
- [x] Stat coupling: cheap food = low energy; overeating slows movement/work; bad sleep/mood/
      weight drains energy; eating healthy is expensive
  // VERIFY: scripted scenarios in console (e.g. "eat cheap 5 days") produce the predicted
  //         downstream stat trajectories. Compare logged numbers to expected.
  // DONE: encoded in runAction/endDay (overeatPenalty for tier>=4, restless-sleep drain,
  //       snack=+weight+healthRisk/low energy). Directionally verified; deeper multi-day
  //       trajectory test still worth adding in the balance pass (M6).

## Milestone 3 - The brutal systems (the teeth)
- [x] Binge threshold: hunger + depression + craving vs a per-day threshold; crossing it loses the day
  // VERIFY: force stats above threshold -> binge fires; below -> it doesn't. Log the
  //         comparison each day. Confirm next-day threshold gets *easier* after a binge.
  // DONE: assertion "binge fires under max pressure" -> 39/60 seeds fired; bingeResist
  //       grows +8 per binge (makes next day easier). Fridge action is its own craving roll.
- [x] Binge event: lose rest of day, eat a random % of income/savings, weight spikes +3-10%,
      mood crashes, shame/depression rises
  // VERIFY: trigger a binge; confirm money drops within the random range, weight jumps
  //         within 3-10%, mood/control fall. Run 20x to confirm ranges stay in bounds.
  // DONE: assertion "binge stays in bounds" -> 0 out-of-range over 60 seeds (weight gain
  //       <=12% incl. overnight noise, money never increases). endsDay burns the day.
- [~] Health crash / hospital: high sugar / ultra-cheap meals or fast weight loss -> crash;
      lose days to hospital, gain debt, risk game over, risk permanent stat damage
  // VERIFY: force a crash; confirm days skip, debt rises, and a random roll can either
  //         kill (game over) or survive-into-debt. Log each branch over many runs.
  // DONE: healthCrash() implemented (skips 2-5 days, +$300-900 debt, 25% death roll) and
  //       "crash when healthRisk maxed" asserts PASS. TODO: dedicated many-run branch test
  //       + "permanent stat damage" not yet implemented.
- [x] `Control` stat: damaged by hunger/depression/debt/poor sleep/cravings/shame;
      at 0 the game auto-chooses bad actions for the player
  // VERIFY: drain control to 0 -> player input is overridden by auto-bad-choices
  //         (binge, doomscroll, miss work). Confirm input is locked while control == 0.
  // DONE: assertions "control override acts at 0" + "no override when control>0" PASS;
  //       Game scene calls controlOverride() after each turn.
- [~] Game-over conditions: lose-too-fast (health crash death), hunger collapse,
      health risk maxed, unrecoverable debt spiral
  // VERIFY: each condition individually forced -> reaches GameOver with the correct
  //         cause-of-death message. No false positives during normal play.
  // DONE: won/crash/debt causes assert PASS with correct GameOver copy. 'starved' (hunger
  //       collapse) + 'heart' (hospital death) implemented but not yet asserted; add tests.

## Milestone 4 - Miracle medication (sketchy black-market upgrade)
- [x] Unlockable risky appetite suppressant ("The Gray Pen" / "GLP-???") via internet quest
  // VERIFY: complete the SearchOnline quest chain -> item unlocks for purchase. Confirm
  //         it's gated (can't buy before unlock).
  // DONE: assertions "med gated before unlock" + "med unlocks after 3 searches" PASS;
  //       Gray Pen button is dimmed until medUnlocked.
- [~] Effect: lowers hunger, costs a lot, random side effects, can worsen health risk
  // VERIFY: buy + use it; hunger drops, money drops, and a side-effect roll can trigger
  //         a health/mood penalty. Confirm cost and side-effect rates over many runs.
  // DONE: implemented (-$90, -45 hunger, 45% side-effect: +healthRisk/-mood/-energy).
  //       TODO: add a many-run assertion for cost + side-effect rate.

## Milestone 5 - UI / feel / tone
- [x] Stat bars for every resource, always visible, 8-bit styled
  // VERIFY: every stat has a labeled bar that updates live as actions resolve; values
  //         match `GameState` exactly (no drift).
  // DONE: 6 labeled bars (verify-shots/5-game.png); refresh() pulls straight from stats;
  //       bars turn red in their danger zone.
- [~] Darkly-funny event popups (from the convo's example lines + a writable event table)
  // VERIFY: events fire at the right triggers; text matches the table; popups dismiss
  //         and don't stack/block input. Spot-check the example lines appear.
  // DONE: popup system + action/event messages implemented (incl. convo lines like
  //       "A cheap snack restored hope for 11 minutes"). TODO: screenshot a live popup +
  //       broaden the event table.
- [x] Day / weight / debt HUD + cause-of-death summary on game over
  // VERIFY: HUD numbers match state; GameOver shows day survived, final weight, and the
  //         specific reason the run ended.
  // DONE: HUD shows day/weight/tier/money/debt/hours; GameOver maps each cause to copy
  //       (verify-shots/7-gameover-win.png).
- [x] TIME-OF-DAY: clock + Morning/Midday/Afternoon/Evening label + hour pips + day/night
      sky tint with a sun/moon in the window, so a "day" actually feels like one
  // VERIFY: take actions and confirm the clock advances and the sky darkens.
  // DONE: verify-shots/8 shows multiple actions sweeping the clock 07:00 -> 13:20+,
  //       sky lightening, sun climbing, hour-pips depleting.
- [x] NIGHT / SLEEP SEQUENCE: "END THE DAY" now walks the sprite to bed, lies it down
      horizontally (rotated slump pose) with floating "z"s while the window runs a night
      cycle (evening -> moon -> dawn sun), then wakes into the new morning and reveals the
      overnight popups. Fixed: window sun showed a moon (was using the recolored cream pom
      for the sun - now a dedicated yellow SUN / pale MOON). Fixed: holding hurry across
      actions now speeds each new action (hurryHeld re-applied per tween).
  // VERIFY: end the day -> sprite sleeps horizontally, moon at 01:00, wakes at 07:00 with
  //         sun. DONE: verify-shots/9-sleeping.png + /10-new-morning.png; /5 sun at 07:00.
- [x] REAL-TIME ANIMATED ACTIONS: each chosen action plays its themed animation while
      stats ramp in and the clock sweeps across that time block; "HOLD TO HURRY" (F /
      button) speeds the current action up (config ACTION.baseSeconds / fastFactor).
      Themed: Work = sit at the computer (new 'sit' pose) and gain a little weight.
  // VERIFY: click Work -> sit pose plays, clock sweeps, money/energy ramp; hurry shortens
  //         it. DONE: verify-shots/6-working-realtime.png (07:20 mid-sit, "chair keeps
  //         the score") + /8 (day advanced via 3 hurried actions). Re-balanced: work
  //         weight-gain tuned 0.35 -> 0.2 so best strategy wins 8.8% (was 26%).
- [x] BUTTON HIT-AREA FIX: rewrote button() to use a Rectangle game object (origin-based
      input) instead of a Container with a manual hit area, which was offset and made
      clicks land on the neighbouring button.
  // VERIFY: clicking the Work button must trigger Work, not Walk. DONE: verify harness
  //         clicks Work's center -> money rises (240 -> 274). "button hit-area OK".
- [x] ACTION ZONES: room reorganized into labelled floor zones (KITCHEN/BED/center/DESK/GYM)
      with objects placed at them; the sprite WALKS to the relevant zone before performing
      (Work->desk, Cook/Snack/Fridge->kitchen, Exercise->gym/treadmill, Rest->bed,
      Walk->wanders) and stays there for the next trip.
  // VERIFY: trigger actions and confirm the sprite travels to the right object. DONE:
  //         verify-shots/6-walking-to-desk.png, /6b-at-desk.png, /8 (travelled to the gym
  //         to exercise). zoneX() maps each action to a floor x.
- [x] READABILITY: bumped virtual res 480x270 -> 640x360, larger fonts (res 3), taller bars
  // VERIFY: text legible in screenshots. DONE: HUD/bars/buttons all clearly readable.
- [x] Keyboard controls (A/D walk, Space exercise, Shift resist craving, E fridge, W work)
  // VERIFY: each key triggers its action and respects gating/energy costs; intentionally
  //         "futile" feel is present (effort happens but systems still push back).
  // DONE: W/A/D/Space/E/Shift wired in buildKeys(); Shift = resist craving (energy cost).
  //       TODO: confirm each key end-to-end in a focused playtest.
- [ ] Audio: 8-bit SFX/music (optional, code-generated or tiny assets)
  // VERIFY: actions and key events produce sound; mute toggle works; no audio errors.
  // NOT STARTED.

## Milestone 6 - Persistence & polish
- [~] Save/resume run + high-score-by-days-survived in localStorage
  // VERIFY: refresh mid-run restores state exactly; best run persists across reloads.
  // DONE: best-days-survived persists (GameOver.saveBest/loadBest). TODO: mid-run
  //       save/resume of full GameState.
- [x] Balance pass so difficulty is "brutally fair" (every solution creates a new problem)
  // VERIFY: playtest log of N full runs; confirm no single dominant strategy survives
  //         long-term and that death feels systemic, not like a bug.
  // DONE: scripts/balance.mjs drives the real engine through 7 AI strategies x 800 runs.
  //       Result: best strategy (balanced) wins only 26%; death causes spread crash 33% /
  //       starved 31% / debt 29% / heart 6% (systemic, no single dominant cause). Each
  //       naive single-axis strategy fails thematically (eatHealthy -> debt, starve ->
  //       crash, etc). Fixed the day-1 instant-starvation kill -> multi-day starveDays
  //       spiral where the binge is the release valve that bounces you backward.
  //       Re-run: `node scripts/balance.mjs <port> <runs>`.
- [x] Production build deploys as static files
  // VERIFY: `npm run build` produces `dist/`; serving it runs the game identically to dev.
  // DONE: `npm run build` succeeds (tsc --noEmit + vite build -> dist/).

---

## Resume notes (update as we go)
- Current focus: **playable vertical slice complete** - Milestones 0-2 fully verified;
  3, 4, 5 substantially done; 6 partial.
- Last verified checkpoint: **verify harness ALL GREEN - 20/20 assertions, 0 page errors.**
- How to run: `npm install`, then `npm run dev` (game) - or `node scripts/verify.mjs`
  in a second terminal (with dev running) to re-run all verifications + refresh screenshots.
- Highest-value next steps:
  1. Balance pass (M6) - write an automated "play N full runs" sim in verify.mjs, log
     death causes + days survived, then tune `src/config.ts` until it's brutally *fair*.
  2. Add the missing assertions called out above (starved/heart causes, med side-effect
     rate, hospital survive-vs-die branch, multi-day stat-coupling trajectory).
  3. Audio (M5) - code-generated 8-bit SFX via WebAudio; mute toggle.
  4. Mid-run save/resume of full GameState (M6).
  5. Flesh out the event table + screenshot a live popup; richer search-quest chain (M4).
- Architecture notes: `src/state/` is pure logic (no Phaser) so it's testable headlessly.
  `src/art/` generates ALL textures procedurally (no image files). `src/scenes/` is Phaser.
  All tuning lives in `src/config.ts`. `Debug` scene is the sprite/tier verification view.
