# Art bible - procedurally generated assets

Every sprite below is drawn in code (`src/art/`) as 8-bit-base pixel art, then
lifted toward a 16-bit feel with a dark outline and 3-tone shading (highlight /
base / shadow), light coming from the **upper-left**. These descriptions are the
design intent: they document what the generator draws *and* serve as the brief for
a future artist replacing any piece with hand-made art (see
`public/assets/README.md` for the technical drop-in spec).

Shared rules:
- **Outline:** a near-black plum (`#171320`) traces every sprite's silhouette.
- **Light:** top-left key light. Highlights go upper-left, shadows lower-right.
- **View:** the world is a shallow ~20-degree 3/4 (near-iso) room, but every sprite
  is a **flat, front-facing billboard** - never drawn in perspective.

---

## The protagonist - "the kid"

A round-headed kid in the South Park mould (big head, small body, stubby limbs),
but his own character, not a copy. He is the emotional center: you watch his body
swell and shrink as the weeks grind on.

- **Head:** an oversized, soft oval of warm skin (`#eec79a`) with a brighter
  forehead/cheek highlight catching the light. Two big, simple white eyes sit close
  together under a single dark brow line; tiny dark pupils. A small, flat mouth -
  a neutral line most of the time, a little open "o" when eating.
- **Beanie:** a snug indigo knit cap (`#3a4a8e`) with a soft sheen across the dome
  and a **cream pom-pom** bobbing on top. It hugs the skull with a folded brim band.
- **Hoodie:** a forest-green pullover (`#3f9e6e`) - the body's whole silhouette. A
  lit crescent on the upper-left, a shadowed underbelly, a darker **kangaroo pocket**
  slung across the gut, and two pale **drawstrings** dangling from the collar.
- **Love handles:** the detail that sells the theme. From "Average" up, two soft
  rolls of hoodie bulge out over the waistline, each with a shadow tucked under the
  fold and a thin sheen on top. They start as gentle pinchable lumps and balloon into
  full saddlebags at "Morbid" - a constant, quiet reminder of what the numbers mean.
- **Mittens & legs:** grey mittened hands on short sleeves; stubby denim legs with
  dark little shoes.
- **Chins:** at the heavier tiers a soft double-chin shadow pools under the jaw and
  the cheeks puff rounder.

### Weight tiers (the body that changes)
Same kid throughout - only girth, chins, and love handles grow:
- **T0 Lean** - trim and upright, no rolls; the "you made it out" body.
- **T1 Average** - a softening waist, the first hint of handles.
- **T2 Overweight** - a real belly curve, cheeks filling in.
- **T3 Heavy** - round through the middle, handles clear, jaw softening (the start).
- **T4 Very Heavy** - broad and low, pronounced rolls, double chin.
- **T5 Morbid** - nearly as wide as he is tall, the hoodie stretched drum-tight.

### Poses (each an animation loop)
- **idle** - a slow breathing bob.
- **walk** - a 4-frame waddle across the floor.
- **eat** - one mitten lifts a morsel to the mouth, which opens; the guilty staple.
- **exercise** - arms thrown up then out, a game little jumping-jack.
- **sit** - hunched forward at the desk, hands typing (used for Work and Search).
- **slump** - sunk, eyes shut; doubles as the sleeping pose, laid flat on the bed.

---

## Furniture & objects

Each lives in its zone and is scaled up in-game to human proportions (a fridge ~ the
kid's height) so nothing reads as a toy.

- **Fridge** (`obj_fridge`, kitchen) - a tall cool-metal box, bright steel face lit
  down the left edge and shaded down the right, split into a smaller freezer over a
  larger fridge door, two recessed dark handles. The quiet threat: behind that door
  is the binge.
- **Snack** (`obj_snack`, kitchen counter) - a stubby foil bag, orange body with a
  yellow torn-open top and a few dark crumbs. Cheap calories, cheap comfort.
- **Laptop / monitor** (`obj_laptop`, desk) - a dark-framed screen glowing cold blue
  with a top glint and a single bright pixel of reflected light, sitting on a grey
  keyboard slab. Where you work for scraps and chase miracle cures online.
- **Treadmill** (`obj_treadmill`, gym) - a dark running belt with faint slat lines and
  a lit leading edge, a steel upright with a highlighted edge, and a little console
  with a green readout. Effort, metered and unglamorous.
- **Bed** (`obj_bed`, bed corner) - a low wooden frame with a blue blanket (lit fold on
  top, shadowed crease below) and a fat cream pillow. Rest, recovery, and the place
  the day ends.
- **Mailbox** (`obj_mailbox`) - a small red box on a post with the flag up. The flag is
  almost always up. It means bills.
- **Phone** (`obj_phone`) - a dark slab with a blue screen and a home dot. Doomscroll
  fuel; a control-killer.
- **Scale** (`obj_scale`) - a flat white platform with a small grey display showing an
  angry red readout. "The scale has chosen violence."
- **The Gray Pen** (`obj_pen`) - an unassuming grey injector pen with a dark tip and a
  little purple dose dial. The sketchy black-market appetite suppressant: looks
  medical, isn't. GLP-???.

---

## The room (environment)

A cramped studio apartment seen at a shallow 3/4 angle, lit warm against the cool
gloom outside.

- **Floor** - warm wood planks in two close brown tones (`#4a3a2e` / `#3e3026`) laid as
  an isometric checker, each tile catching a faint lit edge on its upper-left, with
  dark grout lines between. Lived-in, a little grimy.
- **Area rug** - a worn deep-red rug (`#6e3338`) in the open middle with a gold border,
  a thin inner band, and a small gold diamond motif at its heart. It grounds the room
  and gives the kid a "home base" to stand on.
- **Walls** - two walls meeting at the back corner: the right wall lit (`#33294a`), the
  left in shadow (`#241d30`). Faint vertical panel seams run up both, a lighter crown
  molding caps the top, and a near-black baseboard skirts the floor.
- **Window** - a parallelogram cut into the lit back wall, framed dark. Its glass is
  the room's clock and mood: bright sky-blue with a warm **sun** arcing across by day,
  fading to deep blue with a pale **moon** by night. The whole room is washed by a
  time-of-day tint that shifts from morning blue through dusk purple to night.

---

*Tone note:* nothing here is cartoonishly cruel. The art is cozy and a little sad -
a small warm room, a soft round kid, and a fridge that is always, quietly, right there.
