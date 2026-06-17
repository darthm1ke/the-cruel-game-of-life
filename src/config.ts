/**
 * Central tuning + identity constants.
 * The whole game is a balance problem — keep the numbers here so a balance pass
 * (Milestone 6) is one file, not a treasure hunt.
 */

export const GAME = {
  TITLE: 'THE CRUEL GAME OF LIFE',
  SUBTITLE: 'lose too fast and you die · lose too slow and you suffer',
  // Virtual (design) resolution. The canvas scales up to fit the window while
  // staying pixel-perfect. Bumped from 480x270 -> 640x360 so text is readable
  // and the (now bigger) character has room to animate.
  WIDTH: 640,
  HEIGHT: 360,
} as const;

/** Maps an action-slot index to a time-of-day so a "day" actually feels like one. */
export const TIME = {
  startHour: 7, // first slot is 7:00 (morning)
  hoursPerSlot: 4, // each action burns ~4 hours -> 7,11,15,19 then sleep
} as const;

/**
 * Real-time action playback. Each chosen action animates over `baseSeconds` while
 * its stats ramp in and the clock sweeps across that time block. Holding "hurry"
 * speeds the *current* action up by `fastFactor` (fewer seconds, same animation).
 * Bump baseSeconds toward ~150 for a literal ~10-minute relaxed day.
 */
export const ACTION = {
  baseSeconds: 12, // real seconds per action at 1x
  fastFactor: 5, // hold-to-hurry multiplier
} as const;

/** Cartman-ish 8-bit palette: round kid in a red coat + teal pom beanie. */
export const PAL = {
  bg0: 0x0b0b10,
  bg1: 0x16161f,
  bg2: 0x232331,
  wall: 0x2c2438,
  floor: 0x3a2f33,
  ink: 0x141018,
  white: 0xe8e6df,
  gray: 0x6b6b7b,
  grayDark: 0x3a3a48,
  // character — original palette (Cartman-style model, NOT his colors)
  skin: 0xeec79a,
  skinShade: 0xd0a06f,
  coat: 0x3f9e6e, // forest-green hoodie
  coatShade: 0x2c7150,
  hat: 0x3a4a8e, // indigo beanie
  hatShade: 0x29356a,
  pom: 0xe8e6df, // cream puffball
  mitten: 0x9a9aae, // grey mittens
  pants: 0x33415e, // denim
  pantsShade: 0x232d44,
  mouth: 0x7a2a2a,
  // ui / stats
  red: 0xc8413b,
  redDark: 0x7a2420,
  green: 0x5a9e54,
  greenDark: 0x356b32,
  yellow: 0xd9b44a,
  blue: 0x5a86b0,
  purple: 0x7a4a8a,
  orange: 0xc87a3b,
  pink: 0xc86b8a,
  // sky tints for the day/night cycle
  skyMorning: 0x3a4a6a,
  skyDay: 0x4a6a8a,
  skyEvening: 0x6a4a5a,
  skyNight: 0x1a1a2e,
} as const;

/** Time-of-day label + sky tint for a given slot index (0-based from morning). */
export function timeOfDay(slotIndex: number): { label: string; clock: string; sky: number } {
  const hour = TIME.startHour + slotIndex * TIME.hoursPerSlot;
  const clock = `${String(hour % 24).padStart(2, '0')}:00`;
  if (hour < 11) return { label: 'Morning', clock, sky: PAL.skyMorning };
  if (hour < 15) return { label: 'Midday', clock, sky: PAL.skyDay };
  if (hour < 19) return { label: 'Afternoon', clock, sky: PAL.skyEvening };
  return { label: 'Evening', clock, sky: PAL.skyNight };
}

/** Weight tiers — the protagonist's body changes as `weight` (kg) crosses these. */
export interface WeightTier {
  tier: number; // 0 = lean ... 5 = morbid
  name: string;
  maxWeight: number; // upper bound (kg) of this tier; Infinity for the heaviest
  bodyWidth: number; // pixels of belly girth used by the sprite generator
}

// Ordered lightest -> heaviest. Tier 0 ("Lean") is the "no longer fat" state.
export const WEIGHT_TIERS: WeightTier[] = [
  { tier: 0, name: 'Lean', maxWeight: 80, bodyWidth: 10 },
  { tier: 1, name: 'Average', maxWeight: 95, bodyWidth: 14 },
  { tier: 2, name: 'Overweight', maxWeight: 115, bodyWidth: 18 },
  { tier: 3, name: 'Heavy', maxWeight: 140, bodyWidth: 24 },
  { tier: 4, name: 'Very Heavy', maxWeight: 170, bodyWidth: 30 },
  { tier: 5, name: 'Morbid', maxWeight: Infinity, bodyWidth: 38 },
];

export function tierForWeight(weight: number): WeightTier {
  for (const t of WEIGHT_TIERS) {
    if (weight <= t.maxWeight) return t;
  }
  return WEIGHT_TIERS[WEIGHT_TIERS.length - 1];
}

/** Starting conditions for a fresh run. Brutal but survivable... barely. */
export const START = {
  weight: 132, // kg — lands in "Heavy" (tier 3)
  hunger: 30, // 0..100, high is dangerous
  energy: 70, // 0..100
  mood: 55, // 0..100, low feeds binge + depression
  control: 70, // 0..100, at 0 the game plays itself (badly)
  healthRisk: 10, // 0..100, at 100 you crash
  hope: 40, // 0..100, flavor + small modifiers
  money: 240, // dollars
  debt: 0, // dollars owed
  slotsPerDay: 4, // action points per day
} as const;

/** Goal: drop below this weight (into Lean tier) while still alive. */
export const WIN_WEIGHT = 79;

/** Safe rate of loss. Lose faster than this per day and healthRisk spikes. */
export const SAFE_LOSS_PER_DAY = 1.2; // kg
