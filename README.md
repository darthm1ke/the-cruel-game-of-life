# The Cruel Game of Life

A brutal vicious-cycle survival clicker. You are trying to lose weight while
poverty, cravings, fatigue, debt, and bad choices keep dragging you back.
**The body isn't the joke - the *system* is.** Lose too fast and you die; lose
too slow and you suffer. Every "solution" creates a new problem.

Built from the design conversation in [`convoaboutgame.md`](./convoaboutgame.md).

## Artists wanted (collaboration)

> Side note: I'm looking for interested artists who want to collaborate on turning
> this into a profitable game by creating real, hand-made art instead of the
> procedurally generated sprites currently in use. If that sounds like you, open an
> issue on this repo or reach out, I'd love to talk.

## Stack
- **Phaser 3** (WebGL, pixel-perfect 8-bit rendering)
- **TypeScript** + **Vite**
- **All art is procedurally generated in code** - no image assets. The protagonist
  has 6 weight tiers (Lean → Morbid) and swaps body sprite as `weight` changes.

## Run it
```bash
npm install
npm run dev        # play at http://localhost:5173
npm run build      # type-check + static production build -> dist/
```

From the main menu, **"sprite debug view"** shows all weight tiers, pose cycling,
a live tier-swap test, and every object icon.

## Verify it
A headless Chrome harness confirms the game boots clean, screenshots every scene,
and runs 20 assertions against the pure game engine (daily cycle, action deltas,
binge, health crash, control override, game-over causes, the Gray Pen unlock).

```bash
npm run dev                 # in terminal 1
node scripts/verify.mjs     # in terminal 2  -> screenshots land in verify-shots/
```

## Layout
| Path | What |
|------|------|
| `src/config.ts`   | All tuning: stats, weight tiers, palette, balance knobs |
| `src/state/`      | Pure game engine (no Phaser) - testable headlessly |
| `src/art/`        | Procedural pixel-art generators (man tiers + objects) |
| `src/scenes/`     | Phaser scenes: Boot, Preload, Menu, Game, GameOver, Debug |
| `src/ui/`         | Stat bars, buttons, pixel text |
| `scripts/verify.mjs` | Headless verification harness |
| `CHECKPOINTS.md`  | Roadmap + per-item verification notes + resume state |

## Status
Playable vertical slice. See [`CHECKPOINTS.md`](./CHECKPOINTS.md) for exactly what's
done, what's verified, and what's next.
