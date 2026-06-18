# Art assets (drop-in pixel art)

All in-game art is generated procedurally in code by default. You can replace any
piece with hand-made pixel art **without touching the game logic** - the renderer
addresses every sprite by a texture *key*, and a loaded asset simply overrides the
procedural one.

## How to add real art
1. Make a PNG with a transparent background (see specs below).
2. Drop it under `public/assets/` (e.g. `public/assets/obj/fridge.png`).
3. Add an entry in `src/art/assets.ts`:
   ```ts
   export const ASSET_OVERRIDES = [
     { key: 'obj_fridge', path: 'assets/obj/fridge.png' },
   ];
   ```
4. Done - that key now uses your art; everything else stays procedural. Mix freely.

## Style target
16-bit, hand-shaded pixel art in the spirit of *Ocean's Heart*: a clear dark
outline, 3 - 4 shade tones per material (highlight / base / shadow), light coming
from the upper-left. The world is a shallow ~20-degree 3/4 (near-isometric) view,
but **sprites are flat, front-facing billboards** (like Octopath / Ocean's Heart) -
you do NOT draw them in perspective.

## Character - keys `man_t{TIER}_{POSE}_{FRAME}`
- Canvas: **72 x 86 px**, transparent, character centered, **feet on the bottom edge**
  (origin is bottom-center). Keep a 1px margin for the outline.
- `TIER` 0-5 = body size: 0 Lean, 1 Average, 2 Overweight, 3 Heavy, 4 Very Heavy,
  5 Morbid. Same character identity, only girth/chins change.
- `POSE` and `FRAME` counts (frames are 0-indexed):
  | pose | frames | use |
  |------|--------|-----|
  | `idle` | 2 | standing, gentle bob |
  | `walk` | 4 | walk cycle |
  | `eat` | 2 | hand to mouth |
  | `exercise` | 2 | arms up / out |
  | `slump` | 1 | exhausted / sleeping (also used lying down) |
  | `sit` | 2 | hunched at a desk, typing |
- Full set = 6 tiers x (2+4+2+2+1+2) = **78 frames**. You can override a subset;
  any missing frame stays procedural.

## Objects - keys `obj_{NAME}`
Single image each, transparent, drawn front-on, **base at the bottom edge** (origin
bottom-center). Native sizes (you may supply higher-res; keep the aspect):
| key | name | approx px (w x h) |
|-----|------|-------------------|
| `obj_fridge` | fridge | 22 x 30 |
| `obj_snack` | snack bag | 18 x 16 |
| `obj_laptop` | laptop / monitor | 22 x 16 |
| `obj_treadmill` | treadmill | 26 x 22 |
| `obj_bed` | bed | 28 x 16 |
| `obj_mailbox` | mailbox | 16 x 24 |
| `obj_phone` | phone | 12 x 20 |
| `obj_scale` | bathroom scale | 18 x 12 |
| `obj_pen` | "Gray Pen" (the sketchy med) | 16 x 12 |

Furniture is scaled up in-game to read at human proportions (a fridge is about the
character's height), so design at a consistent small px scale and it will be sized
to fit.

## Questions / collaboration
This is exactly the art the project is looking for a collaborator on - see the
"Artists wanted" note in the top-level `README.md`.
