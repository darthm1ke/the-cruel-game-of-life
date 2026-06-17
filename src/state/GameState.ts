import { START, WIN_WEIGHT, SAFE_LOSS_PER_DAY, tierForWeight } from '../config';
import { Rng } from './rng';
import type { ActionId, ActionResult, Cause, PopupEvent, Stats } from './types';

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/**
 * The engine. No Phaser in here on purpose — pure logic so it can be exercised
 * headlessly by the debug/verification scenarios (see CHECKPOINTS Milestone 2/3).
 */
export class GameState {
  stats: Stats;
  day = 1;
  slotsLeft: number;
  cause: Cause = 'alive';

  /** progress 0..3 of the sketchy internet quest that unlocks the med */
  searchProgress = 0;
  medUnlocked = false;
  /** binge threshold gets *easier* (lower) after each binge; recovers slowly */
  bingeResist = 0; // added pressure toward binging; grows after binges
  /** consecutive days spent severely under-fed; drives the starvation spiral */
  starveDays = 0;
  weightYesterday: number;

  pending: PopupEvent[] = [];
  rng: Rng;

  constructor(seed?: number) {
    this.rng = new Rng(seed);
    this.stats = {
      weight: START.weight,
      hunger: START.hunger,
      energy: START.energy,
      mood: START.mood,
      control: START.control,
      healthRisk: START.healthRisk,
      hope: START.hope,
      money: START.money,
      debt: START.debt,
    };
    this.slotsLeft = START.slotsPerDay;
    this.weightYesterday = this.stats.weight;
  }

  get tier() {
    return tierForWeight(this.stats.weight);
  }
  get over() {
    return this.cause !== 'alive';
  }

  private push(text: string, tone: PopupEvent['tone'] = 'neutral') {
    this.pending.push({ text, tone });
  }

  /** Apply a partial delta to stats, clamping the 0..100 ones. */
  private apply(d: Partial<Stats>) {
    const s = this.stats;
    if (d.weight != null) s.weight = Math.max(0, s.weight + d.weight);
    if (d.hunger != null) s.hunger = clamp(s.hunger + d.hunger);
    if (d.energy != null) s.energy = clamp(s.energy + d.energy);
    if (d.mood != null) s.mood = clamp(s.mood + d.mood);
    if (d.control != null) s.control = clamp(s.control + d.control);
    if (d.healthRisk != null) s.healthRisk = clamp(s.healthRisk + d.healthRisk);
    if (d.hope != null) s.hope = clamp(s.hope + d.hope);
    if (d.money != null) s.money = Math.max(0, s.money + d.money);
    if (d.debt != null) s.debt = Math.max(0, s.debt + d.debt);
  }

  // ----- Actions ---------------------------------------------------------

  /** Energy required to even attempt a given action. */
  private canDo(id: ActionId): string | null {
    const s = this.stats;
    if (id === 'work' && s.energy < 25) return 'Too exhausted to work.';
    if (id === 'exercise' && s.energy < 15) return 'No energy to exercise.';
    if (id === 'med' && !this.medUnlocked) return 'You have no way to get that... yet.';
    if (id === 'med' && s.money < 90) return 'You cannot afford the Gray Pen.';
    return null;
  }

  /**
   * Run a player action. Costs one slot unless it ends the day.
   * Returns the result (deltas already applied) for the UI + logs.
   */
  act(id: ActionId): ActionResult {
    if (this.over) return { id, ok: false, message: 'The run is over.', deltas: {} };
    if (this.slotsLeft <= 0) return { id, ok: false, message: 'No hours left today.', deltas: {} };

    const gate = this.canDo(id);
    if (gate) return { id, ok: false, message: gate, deltas: {} };

    const r = this.runAction(id);
    if (r.ok) this.slotsLeft -= 1;
    if (r.endsDay) this.slotsLeft = 0;
    this.checkGameOver();
    return r;
  }

  private runAction(id: ActionId): ActionResult {
    const s = this.stats;
    const overeatPenalty = this.tier.tier >= 4 ? 1.6 : 1; // heavier = movement costs more
    const d: Partial<Stats> = {};
    let msg = '';

    switch (id) {
      case 'work': {
        const pay = Math.round(this.rng.range(28, 46) * (s.energy > 50 ? 1 : 0.7));
        d.money = pay;
        d.energy = -22 * overeatPenalty;
        d.hunger = +10;
        d.mood = -3;
        d.control = -2;
        d.weight = +0.2; // a whole shift sitting at the computer adds up
        msg = `You sat the whole shift. +$${pay}. The chair keeps the score.`;
        break;
      }
      case 'walk': {
        d.weight = -0.3;
        d.energy = -10 * overeatPenalty;
        d.hunger = +8;
        d.mood = +4;
        d.hope = +2;
        d.healthRisk = -1;
        msg = 'You walked. Small, unglamorous progress.';
        break;
      }
      case 'exercise': {
        d.weight = -0.7;
        d.energy = -20 * overeatPenalty;
        d.hunger = +14;
        d.mood = +6;
        d.hope = +4;
        d.healthRisk = -2;
        d.control = +2;
        msg = 'You exercised. It hurt. It counts.';
        break;
      }
      case 'cook': {
        // Healthy food: best outcome, but expensive.
        if (s.money < 22) return { id, ok: false, message: 'No money for real food.', deltas: {} };
        d.money = -22;
        d.hunger = -40;
        d.energy = +18;
        d.mood = +5;
        d.healthRisk = -3;
        d.weight = +0.2;
        msg = 'You cooked a real meal. Expensive. Worth it. Rare.';
        break;
      }
      case 'snack': {
        // Cheap food: kills hunger, poor energy, raises weight + health risk.
        if (s.money < 6) return { id, ok: false, message: 'You scrape coins. Not enough.', deltas: {} };
        d.money = -6;
        d.hunger = -28;
        d.energy = +5;
        d.mood = +3;
        d.weight = +0.8;
        d.healthRisk = +5;
        d.control = -2;
        msg = 'A cheap snack restored hope for 11 minutes.';
        break;
      }
      case 'skip': {
        // Save money, lose weight, but hunger + control damage stack up.
        d.hunger = +26;
        d.weight = -0.5;
        d.energy = -8;
        d.mood = -6;
        d.control = -6;
        msg = 'You skipped the meal. The hunger remembers.';
        break;
      }
      case 'search': {
        d.energy = -8;
        d.mood = -2;
        this.searchProgress += 1;
        if (this.searchProgress >= 3 && !this.medUnlocked) {
          this.medUnlocked = true;
          msg = 'A forum DM: "the Gray Pen ships discreet." It can be bought now.';
          this.push('Black market unlocked: GLP-??? (The Gray Pen).', 'neutral');
        } else if (this.rng.chance(0.4)) {
          msg = 'You watched three meal-prep videos. No food was prepared.';
        } else {
          msg = `You searched the internet for a way out. (lead ${this.searchProgress}/3)`;
        }
        break;
      }
      case 'rest': {
        d.energy = +34;
        d.mood = +6;
        d.control = +8;
        d.hunger = +6;
        d.healthRisk = -2;
        msg = 'You rested. The bills did not.';
        break;
      }
      case 'fridge': {
        // Dangerous: opening the fridge is a craving check.
        const craving = (s.hunger + (100 - s.mood) + this.bingeResist) / 3;
        if (this.rng.next() * 100 < craving) {
          return this.triggerBinge('You opened the fridge. The fridge won.');
        }
        d.hunger = -10;
        d.control = -3;
        d.mood = +1;
        msg = 'You opened the fridge, stared, and closed it. Barely.';
        break;
      }
      case 'med': {
        d.money = -90;
        d.hunger = -45;
        d.weight = -0.4;
        d.control = +4;
        // Sketchy: random side effects.
        if (this.rng.chance(0.45)) {
          d.healthRisk = +14;
          d.mood = -8;
          d.energy = -10;
          msg = 'The Gray Pen works. Your body asks who approved this.';
          this.push('Side effect: nausea, cold sweat, regret.', 'bad');
        } else {
          d.mood = +2;
          msg = 'The Gray Pen quiets the hunger. For now.';
        }
        break;
      }
    }

    this.apply(d);
    return { id, ok: true, message: msg, deltas: d };
  }

  // ----- Binge ------------------------------------------------------------

  /** The loaded gun. Eats money, spikes weight, crashes mood, burns the day. */
  private triggerBinge(intro: string): ActionResult {
    const s = this.stats;
    const before = { ...s };
    const moneyPool = s.money;
    const lostMoney = Math.round(moneyPool * this.rng.range(0.2, 0.6));
    const weightGain = s.weight * this.rng.range(0.03, 0.1); // +3%..+10%
    const d: Partial<Stats> = {
      money: -lostMoney,
      weight: +weightGain,
      hunger: -60,
      mood: -22,
      control: -18,
      healthRisk: +10,
      hope: -10,
    };
    this.apply(d);
    this.bingeResist = Math.min(40, this.bingeResist + 8); // next time is easier to trigger
    this.push(intro, 'bad');
    this.push(
      `BINGE. You lost the day, $${lostMoney}, and ${weightGain.toFixed(1)}kg of progress.`,
      'bad'
    );
    return {
      id: 'fridge',
      ok: true,
      endsDay: true,
      message: 'The binge takes the day.',
      deltas: {
        money: s.money - before.money,
        weight: s.weight - before.weight,
        mood: s.mood - before.mood,
      },
    };
  }

  // ----- End of day -------------------------------------------------------

  /** Resolve the night: overnight changes, threshold checks, then a new day. */
  endDay() {
    if (this.over) return;
    const s = this.stats;

    // --- Daily binge-threshold check (the central threat) ---
    // Pressure = hunger + depression(100-mood) + craving floor + accumulated resist.
    const pressure = s.hunger + (100 - s.mood) + this.bingeResist;
    const threshold = 150 + s.control; // more control -> harder to tip over
    if (pressure > threshold && this.rng.chance(0.6)) {
      this.triggerBinge('Night cravings overwhelmed you.');
    }

    // --- Overnight stat drift ---
    // Bad sleep if hunger/health/debt high; otherwise modest recovery.
    const restless = s.hunger > 60 || s.healthRisk > 60 || s.debt > 200;
    this.apply({
      energy: restless ? -4 : +14,
      hunger: +14,
      mood: s.debt > 0 ? -3 : 0,
      control: restless ? -4 : +2,
    });

    // --- Starvation spiral (the under-eating trap) ---
    // Going severely under-fed doesn't kill instantly — it compounds. Each
    // consecutive starved day pumps health risk + binge pressure and bleeds
    // energy/mood/control, until the body gives out. Usually the binge hits
    // first: it resets hunger but costs money + weight, so you spiral back in.
    if (s.hunger >= 88) {
      this.starveDays += 1;
      this.apply({
        healthRisk: +4 + this.starveDays * 3,
        energy: -6,
        mood: -5,
        control: -4,
      });
      this.bingeResist = Math.min(45, this.bingeResist + 4);
      if (this.starveDays === 2) this.push('Running on empty. The body is keeping score.', 'bad');
    } else {
      this.starveDays = Math.max(0, this.starveDays - 1);
    }
    // Being heavy passively raises health risk.
    if (this.tier.tier >= 4) this.apply({ healthRisk: +3 });

    // --- Fast-loss penalty: lose too fast and the body revolts ---
    const lostToday = this.weightYesterday - s.weight;
    if (lostToday > SAFE_LOSS_PER_DAY) {
      const over = lostToday - SAFE_LOSS_PER_DAY;
      this.apply({ healthRisk: +Math.round(over * 12), energy: -8, mood: -4 });
      this.push('You lost weight too fast. The scale has chosen violence.', 'bad');
    }

    // --- Health crash check ---
    if (s.healthRisk >= 100) {
      this.healthCrash();
      if (this.over) return;
    }

    // --- Debt interest ---
    if (s.debt > 0) this.apply({ debt: Math.round(s.debt * 0.05) });

    // --- Random daily event ---
    this.maybeRandomEvent();

    // --- New day ---
    this.checkGameOver();
    if (this.over) return;
    this.weightYesterday = s.weight;
    this.day += 1;
    this.slotsLeft = START.slotsPerDay;
    // Binge resistance recovers slowly when you're doing okay.
    if (s.mood > 50 && s.hunger < 50) this.bingeResist = Math.max(0, this.bingeResist - 2);
  }

  private healthCrash() {
    // Hospital: lose days, gain debt, roll for death or survive-into-debt.
    const days = this.rng.int(2, 5);
    const bill = this.rng.int(300, 900);
    this.push(`Health crash. ${days} days in the hospital.`, 'bad');
    if (this.rng.chance(0.25)) {
      this.cause = 'heart';
      return;
    }
    this.day += days;
    this.apply({
      debt: bill,
      healthRisk: -55,
      energy: -20,
      mood: -15,
      control: -15,
      weight: -days * 0.4,
    });
    this.push('You survived the hospital. The invoice did not.', 'bad');
  }

  private maybeRandomEvent() {
    if (!this.rng.chance(0.35)) return;
    const events: PopupEvent[] = [
      { text: 'A motivational video promised everything. Delivered nothing.', tone: 'neutral' },
      { text: 'Rent is due. Again. Already.', tone: 'bad' },
      { text: 'You found $12 in an old coat. Hope flickers.', tone: 'good' },
      { text: 'Your body has filed a complaint against management.', tone: 'neutral' },
    ];
    const e = this.rng.pick(events);
    this.pending.push(e);
    if (e.text.startsWith('Rent')) this.apply({ debt: +60, mood: -5 });
    if (e.text.startsWith('You found')) this.apply({ money: +12, hope: +5 });
  }

  // ----- Control override + game over ------------------------------------

  /** When control hits 0 the game makes a (bad) choice for the player. */
  controlOverride(): ActionResult | null {
    if (this.over || this.slotsLeft <= 0) return null;
    if (this.stats.control > 0) return null;
    this.push('Control is gone. The game decides for you.', 'bad');
    const choice = this.rng.pick(['fridge', 'snack', 'rest', 'skip'] as const);
    return this.act(choice);
  }

  private checkGameOver() {
    const s = this.stats;
    if (this.over) return;
    if (s.weight <= WIN_WEIGHT) {
      this.cause = 'won';
    } else if (s.healthRisk >= 100) {
      this.cause = 'crash';
    } else if (this.starveDays >= 5) {
      this.cause = 'starved';
    } else if (s.debt >= 1500) {
      this.cause = 'debt';
    }
  }

  /** Drain a popup queued during resolution (UI calls this until empty). */
  takePopup(): PopupEvent | null {
    return this.pending.shift() ?? null;
  }
}
