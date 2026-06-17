import Phaser from 'phaser';
import { ACTION, GAME, PAL, START, TIME, timeOfDay } from '../config';
import { GameState } from '../state/GameState';
import type { ActionId, Stats } from '../state/types';
import { animKey, type Pose } from '../art/man';
import { objKey, type ObjName } from '../art/objects';
import { StatBar } from '../ui/bars';
import { button, pixelText, type ButtonHandle } from '../ui/text';

/** Each action plays a fitting animation while it runs in real time. */
const POSE_FOR_ACTION: Record<ActionId, Pose> = {
  work: 'sit', // sit at the computer
  walk: 'walk',
  exercise: 'exercise',
  cook: 'eat',
  snack: 'eat',
  skip: 'idle',
  search: 'sit', // hunched over the laptop
  rest: 'slump', // slumped, dozing
  fridge: 'eat',
  med: 'idle',
};

interface ActionDef {
  id: ActionId;
  label: string;
}

const ACTIONS: ActionDef[] = [
  { id: 'work', label: 'Work  (W)' },
  { id: 'walk', label: 'Walk  (A/D)' },
  { id: 'exercise', label: 'Exercise (Spc)' },
  { id: 'cook', label: 'Cook  $22' },
  { id: 'snack', label: 'Snack  $6' },
  { id: 'skip', label: 'Skip meal' },
  { id: 'search', label: 'Search web' },
  { id: 'rest', label: 'Rest' },
  { id: 'fridge', label: 'Fridge (E)' },
  { id: 'med', label: 'Gray Pen $90' },
];

const ROOM = { x: 0, y: 22, w: 432, h: 200 };
const FLOOR_Y = ROOM.y + ROOM.h - 30; // top of the floor strip / where feet rest

/** Floor x-positions of the action zones the sprite walks between. */
const ZONE = { kitchen: 70, bed: 150, center: 230, desk: 320, gym: 392 } as const;

const SUN = 0xf2c84a; // daytime sun (warm yellow)
const MOON = 0xd8d8e8; // night moon (pale)
const WINDOW_DAY = 0x79a8d8; // bright sky-blue seen while the sun is up
const WINDOW_NIGHT = 0x10101e; // dark blue once the moon is out

/** Blend two 0xRRGGBB colors (t in 0..1). */
function lerpColor(a: number, b: number, t: number): number {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.IntegerToColor(a),
    Phaser.Display.Color.IntegerToColor(b),
    100,
    Math.floor(Phaser.Math.Clamp(t, 0, 1) * 100)
  );
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

export class GameScene extends Phaser.Scene {
  private gs!: GameState;
  private man!: Phaser.GameObjects.Sprite;
  private sky!: Phaser.GameObjects.Graphics;
  private bars: Record<string, StatBar> = {};
  private hud!: Phaser.GameObjects.Text;
  private clock!: Phaser.GameObjects.Text;
  private timePips!: Phaser.GameObjects.Graphics;
  private msg!: Phaser.GameObjects.Text;
  private actionButtons: ButtonHandle[] = [];
  private medButton?: ButtonHandle;
  private hurryBtn!: ButtonHandle;
  private endDayBtn!: ButtonHandle;
  private popupLayer!: Phaser.GameObjects.Container;

  private busy = false; // popup open
  private running = false; // an action (or the night) is animating
  private activeTween?: Phaser.Tweens.Tween;
  private hurryHeld = false; // true while hurry is held, so new actions start fast too
  private zzz?: Phaser.GameObjects.Text; // floating sleep "z"s during the night

  constructor() {
    super('Game');
  }

  create() {
    console.log('[scene] Game start');
    this.gs = new GameState();
    this.busy = false;
    this.running = false;
    this.bars = {};
    this.actionButtons = [];

    this.sky = this.add.graphics();
    this.drawRoom();
    this.buildHud();
    this.buildStatBars();
    this.buildActions();
    this.buildKeys();

    this.popupLayer = this.add.container(0, 0).setDepth(100);
    this.refresh();
  }

  // ---- Static room art ----
  private drawRoom() {
    const g = this.add.graphics();
    g.fillStyle(PAL.floor, 1).fillRect(ROOM.x, ROOM.y + ROOM.h - 30, ROOM.w, 30);
    g.lineStyle(1, PAL.bg2, 1).strokeRect(ROOM.x + 0.5, ROOM.y + 0.5, ROOM.w - 1, ROOM.h - 1);

    const floorY = FLOOR_Y;
    const place = (n: ObjName, x: number, y: number, scale = 1.5) =>
      this.add.image(x, y, objKey(n)).setOrigin(0.5, 1).setScale(scale).setDepth(2);

    // Objects sit at their action ZONES (see zoneX). Faint floor markers under each.
    const marks = this.add.graphics().setDepth(1);
    const mark = (x: number, label: string) => {
      marks.fillStyle(PAL.bg1, 0.5).fillRect(x - 30, floorY - 2, 60, 4);
      pixelText(this, x, floorY + 2, label, 7, PAL.grayDark).setOrigin(0.5, 0).setDepth(1);
    };
    mark(ZONE.kitchen, 'KITCHEN');
    mark(ZONE.bed, 'BED');
    mark(ZONE.center, '');
    mark(ZONE.desk, 'DESK');
    mark(ZONE.gym, 'GYM');

    place('fridge', ZONE.kitchen - 18, floorY + 30);
    place('snack', ZONE.kitchen + 16, floorY + 18, 1.2); // counter snack
    place('bed', ZONE.bed, floorY + 32);
    place('scale', ZONE.center, floorY + 28);
    place('phone', ZONE.center + 26, floorY + 26, 1.2);
    place('laptop', ZONE.desk, floorY + 14);
    place('treadmill', ZONE.gym, floorY + 30);
    place('mailbox', 416, floorY + 8);

    this.man = this.add
      .sprite(ZONE.center, floorY + 24, '')
      .setOrigin(0.5, 1)
      .setScale(1.25)
      .setDepth(5)
      .play(animKey(this.gs.tier.tier, 'idle'));
  }

  /** x of the action zone the sprite walks to before performing `id`. */
  private zoneX(id: ActionId): number {
    switch (id) {
      case 'work':
      case 'search':
      case 'med':
        return ZONE.desk;
      case 'cook':
      case 'snack':
      case 'fridge':
        return ZONE.kitchen;
      case 'exercise':
        return ZONE.gym;
      case 'rest':
        return ZONE.bed;
      case 'skip':
        return ZONE.center;
      case 'walk':
        return Phaser.Math.Between(ZONE.kitchen + 20, ZONE.gym - 20); // wander
    }
  }

  /** Sky tint + window sun/moon for a (possibly fractional) slot position. */
  private paintSky(skyColor: number, slotFloat: number) {
    this.sky.clear();
    this.sky.fillStyle(skyColor, 1).fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h - 30);
    const wx = ROOM.x + 28;
    const wy = ROOM.y + 12;
    this.sky.fillStyle(PAL.ink, 1).fillRect(wx - 2, wy - 2, 56, 40);
    // Window interior follows the sun: day-blue by day, fading to dark blue at dusk.
    const dusk = Phaser.Math.Clamp((slotFloat - 2.8) / 0.8, 0, 1);
    this.sky.fillStyle(lerpColor(WINDOW_DAY, WINDOW_NIGHT, dusk), 1).fillRect(wx, wy, 52, 36);
    const night = slotFloat >= 3.2;
    const t = Math.min(slotFloat, 4) / 4;
    const orbX = wx + 6 + t * 40;
    const orbY = wy + 28 - Math.round(Math.sin(t * Math.PI) * 20);
    this.sky.fillStyle(night ? MOON : SUN, 1).fillCircle(orbX, orbY, 4);
  }

  private buildHud() {
    const g = this.add.graphics();
    g.fillStyle(PAL.bg2, 1).fillRect(0, 0, GAME.WIDTH, 20);
    this.hud = pixelText(this, 6, 5, '', 11, PAL.white);
    this.clock = pixelText(this, GAME.WIDTH - 190, 5, '', 11, PAL.yellow);
    this.timePips = this.add.graphics();
  }

  private buildStatBars() {
    const x = 446;
    const w = 184;
    let y = 54;
    const step = 27;
    const mk = (name: string, color: number, dangerHigh = false) => {
      this.bars[name] = new StatBar(this, x, y, w, name, color, dangerHigh);
      y += step;
    };
    pixelText(this, x, 26, 'BODY & MIND', 10, PAL.gray);
    mk('Hunger', PAL.orange, true);
    mk('Energy', PAL.green);
    mk('Mood', PAL.pink);
    mk('Control', PAL.blue);
    mk('Health Risk', PAL.red, true);
    mk('Hope', PAL.yellow);
  }

  private buildActions() {
    const cols = 5;
    const bw = 122;
    const bh = 28;
    const gap = 4;
    const startX = 6;
    const startY = 232;
    ACTIONS.forEach((a, i) => {
      const cx = startX + (i % cols) * (bw + gap);
      const cy = startY + Math.floor(i / cols) * (bh + gap);
      const btn = button(this, cx, cy, bw, bh, a.label, () => this.doAction(a.id), {
        size: 10,
        fill: a.id === 'fridge' ? PAL.redDark : PAL.bg2,
      });
      this.actionButtons.push(btn);
      if (a.id === 'med') this.medButton = btn;
    });

    // Bottom row: HURRY (left) + SLEEP/END DAY (right).
    const rowY = startY + 2 * (bh + gap);
    this.hurryBtn = button(this, startX, rowY, 200, 30, '⏩ HOLD TO HURRY  (F)', () => {}, {
      fill: PAL.greenDark,
      size: 11,
    });
    this.hurryBtn.onPress(() => this.setHurry(true));
    this.hurryBtn.onRelease(() => this.setHurry(false));
    this.hurryBtn.setEnabled(false);

    this.endDayBtn = button(this, startX + 206, rowY, GAME.WIDTH - startX * 2 - 206, 30, 'SLEEP — END THE DAY', () => this.endDay(), {
      fill: PAL.purple,
      size: 12,
    });
  }

  private buildKeys() {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown-W', () => this.doAction('work'));
    kb.on('keydown-A', () => this.doAction('walk'));
    kb.on('keydown-D', () => this.doAction('walk'));
    kb.on('keydown-SPACE', () => this.doAction('exercise'));
    kb.on('keydown-E', () => this.doAction('fridge'));
    kb.on('keydown-SHIFT', () => this.resistCraving());
    // Hold F to hurry the current action.
    kb.on('keydown-F', () => this.setHurry(true));
    kb.on('keyup-F', () => this.setHurry(false));
  }

  private resistCraving() {
    if (this.running || this.busy || this.gs.over || this.gs.slotsLeft <= 0) return;
    this.gs.stats.energy = Math.max(0, this.gs.stats.energy - 6);
    this.gs.bingeResist = Math.max(0, this.gs.bingeResist - 6);
    this.gs.stats.control = Math.min(100, this.gs.stats.control + 3);
    this.flashMessage('You white-knuckle the craving. It costs you.');
    this.refresh();
  }

  // ---- Real-time action playback ----
  private doAction(id: ActionId) {
    if (this.running || this.busy || this.gs.over) return;
    if (this.gs.slotsLeft <= 0) {
      this.flashMessage('No hours left in the day. Sleep to end it.');
      return;
    }
    const before = { ...this.gs.stats };
    const slotBefore = START.slotsPerDay - this.gs.slotsLeft;
    const r = this.gs.act(id);
    if (!r.ok) {
      this.flashMessage(r.message);
      return;
    }
    const after = { ...this.gs.stats };
    this.flashMessage(r.message);
    this.runAction(id, before, after, slotBefore);
  }

  /**
   * Animate the action over real time. First the sprite WALKS to the action's
   * zone, then it plays the themed pose while stats ramp and the clock sweeps.
   */
  private runAction(id: ActionId, before: Stats, after: Stats, slotBefore: number) {
    this.running = true;
    this.setActionsEnabled(false);
    this.hurryBtn.setEnabled(true);
    this.endDayBtn.setEnabled(false);

    const tier = this.gs.tier.tier;
    const startX = this.man.x;
    const targetX = this.zoneX(id);
    const dist = Math.abs(targetX - startX);
    // Walk takes a slice of the action proportional to distance (whole thing for Walk).
    const travelP = id === 'walk' ? 1 : Phaser.Math.Clamp(dist / 360, 0.12, 0.5);
    const pose = POSE_FOR_ACTION[id] ?? 'idle';

    this.man.setFlipX(targetX < startX);
    this.man.play(animKey(tier, 'walk'));
    let arrived = false;

    const prog = { p: 0 };
    this.activeTween = this.tweens.add({
      targets: prog,
      p: 1,
      duration: ACTION.baseSeconds * 1000,
      ease: 'Linear',
      onUpdate: () => {
        const p = prog.p;
        if (p < travelP) {
          this.man.x = Math.round(startX + (targetX - startX) * (p / travelP));
        } else if (!arrived) {
          arrived = true;
          this.man.x = targetX;
          this.man.setFlipX(false);
          this.man.play(animKey(this.gs.tier.tier, pose));
        }
        this.renderActionFrame(before, after, slotBefore, p);
      },
      onComplete: () => this.finishAction(),
    });
    this.applyHurry();
  }

  private renderActionFrame(before: Stats, after: Stats, slotBefore: number, p: number) {
    const lerp = (a: number, b: number) => a + (b - a) * p;
    this.bars['Hunger'].set(lerp(before.hunger, after.hunger));
    this.bars['Energy'].set(lerp(before.energy, after.energy));
    this.bars['Mood'].set(lerp(before.mood, after.mood));
    this.bars['Control'].set(lerp(before.control, after.control));
    this.bars['Health Risk'].set(lerp(before.healthRisk, after.healthRisk));
    this.bars['Hope'].set(lerp(before.hope, after.hope));
    this.renderHud(lerp(before.weight, after.weight), lerp(before.money, after.money), lerp(before.debt, after.debt));
    this.renderTime(slotBefore + p);
  }

  private finishAction() {
    this.running = false;
    this.activeTween = undefined;
    this.setActionsEnabled(true);
    this.hurryBtn.setEnabled(false);
    this.endDayBtn.setEnabled(true);
    if (!this.gs.over) this.man.play(animKey(this.gs.tier.tier, 'idle'));
    this.refresh();
    this.drainPopups();
    this.afterTurn();
  }

  private setHurry(fast: boolean) {
    this.hurryHeld = fast;
    if (this.activeTween) this.activeTween.timeScale = fast ? ACTION.fastFactor : 1;
  }

  /** Apply held-hurry to a freshly created tween (so holding F across actions works). */
  private applyHurry() {
    if (this.activeTween && this.hurryHeld) this.activeTween.timeScale = ACTION.fastFactor;
  }

  private setActionsEnabled(on: boolean) {
    this.actionButtons.forEach((b) => {
      if (b === this.medButton && !this.gs.medUnlocked) b.setEnabled(false);
      else b.setEnabled(on);
    });
  }

  private afterTurn() {
    if (this.gs.over) return this.toGameOver();
    // Control override: the game takes a (bad) turn for you, also animated.
    if (this.gs.stats.control <= 0 && this.gs.slotsLeft > 0) {
      this.time.delayedCall(500, () => {
        if (this.running || this.gs.over) return;
        const before = { ...this.gs.stats };
        const slotBefore = START.slotsPerDay - this.gs.slotsLeft;
        const r = this.gs.controlOverride();
        if (r && r.ok) {
          const after = { ...this.gs.stats };
          this.flashMessage('(forced) ' + r.message);
          this.runAction(r.id, before, after, slotBefore);
        } else {
          this.refresh();
          if (this.gs.over) this.toGameOver();
        }
      });
    }
  }

  /** Sleep: walk to bed, lie down horizontally, run the night, wake into a new day. */
  private endDay() {
    if (this.running || this.busy || this.gs.over) return;
    // Resolve the night's logic now (popups queued); reveal it on waking.
    this.gs.endDay();

    this.running = true;
    this.setActionsEnabled(false);
    this.endDayBtn.setEnabled(false);
    this.hurryBtn.setEnabled(true); // you can hurry the night too

    const tier = this.gs.tier.tier;
    const startX = this.man.x;
    const travelP = 0.28;
    let inBed = false;
    this.man.setFlipX(ZONE.bed < startX);
    this.man.play(animKey(tier, 'walk'));

    const prog = { p: 0 };
    this.activeTween = this.tweens.add({
      targets: prog,
      p: 1,
      duration: 6500,
      ease: 'Linear',
      onUpdate: () => {
        const p = prog.p;
        if (p < travelP) {
          this.man.x = Math.round(startX + (ZONE.bed - startX) * (p / travelP));
        } else if (!inBed) {
          inBed = true;
          this.lieDownToSleep();
        }
        this.renderNightSky(Phaser.Math.Clamp((p - travelP) / (1 - travelP), 0, 1));
      },
      onComplete: () => this.wakeUp(),
    });
    this.applyHurry();
  }

  /** Rotate the sprite flat onto the bed, eyes shut, with floating "z"s. */
  private lieDownToSleep() {
    this.man.play(animKey(this.gs.tier.tier, 'slump'));
    this.man.setOrigin(0.5, 0.5).setFlipX(false).setAngle(-90).setPosition(ZONE.bed, FLOOR_Y - 4);
    this.zzz?.destroy();
    this.zzz = pixelText(this, ZONE.bed + 18, FLOOR_Y - 22, 'z', 10, PAL.white).setDepth(6);
    this.tweens.add({
      targets: this.zzz,
      y: FLOOR_Y - 40,
      alpha: { from: 1, to: 0 },
      duration: 1100,
      repeat: -1,
    });
  }

  private wakeUp() {
    this.running = false;
    this.activeTween = undefined;
    this.zzz?.destroy();
    this.zzz = undefined;
    // Stand the sprite back up beside the bed.
    this.man.setOrigin(0.5, 1).setAngle(0).setPosition(ZONE.bed, FLOOR_Y + 24);
    this.setActionsEnabled(true);
    this.hurryBtn.setEnabled(false);
    this.endDayBtn.setEnabled(true);
    if (!this.gs.over) this.man.play(animKey(this.gs.tier.tier, 'idle'));
    this.flashMessage(`— A new day. Day ${this.gs.day}. —`);
    this.refresh();
    this.drainPopups();
    if (this.gs.over) this.toGameOver();
  }

  /** Window/sky during the night: evening -> deep night (moon) -> dawn (sun rising). */
  private renderNightSky(p: number) {
    const col = p < 0.5 ? lerpColor(PAL.skyEvening, PAL.skyNight, p / 0.5) : lerpColor(PAL.skyNight, PAL.skyMorning, (p - 0.5) / 0.5);
    this.sky.clear();
    this.sky.fillStyle(col, 1).fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h - 30);
    const wx = ROOM.x + 28;
    const wy = ROOM.y + 12;
    this.sky.fillStyle(PAL.ink, 1).fillRect(wx - 2, wy - 2, 56, 40);
    const dawn = p > 0.82;
    this.sky.fillStyle(dawn ? WINDOW_DAY : WINDOW_NIGHT, 1).fillRect(wx, wy, 52, 36);
    if (dawn) {
      // sun cresting the horizon
      this.sky.fillStyle(SUN, 1).fillCircle(wx + 8, wy + 30, 4);
    } else {
      const mt = p / 0.82;
      const mx = wx + 6 + mt * 40;
      const my = wy + 28 - Math.round(Math.sin(mt * Math.PI) * 20);
      this.sky.fillStyle(MOON, 1).fillCircle(mx, my, 4);
    }
    // clock rolls 23:00 -> 07:00 through the night
    const hour = (23 + p * 8) % 24;
    this.clock.setText(`${String(Math.floor(hour)).padStart(2, '0')}:00  Night`);
  }

  // ---- UI refresh (idle / between actions) ----
  private refresh() {
    const s = this.gs.stats;
    const idleK = animKey(this.gs.tier.tier, 'idle');
    const cur = this.man.anims.currentAnim?.key ?? '';
    if (!this.running && cur.endsWith('idle') && cur !== idleK) this.man.play(idleK);

    this.renderHud(s.weight, s.money, s.debt);
    this.renderTime(START.slotsPerDay - this.gs.slotsLeft);

    this.bars['Hunger'].set(s.hunger);
    this.bars['Energy'].set(s.energy);
    this.bars['Mood'].set(s.mood);
    this.bars['Control'].set(s.control);
    this.bars['Health Risk'].set(s.healthRisk);
    this.bars['Hope'].set(s.hope);

    if (this.medButton) this.medButton.setEnabled(this.gs.medUnlocked && !this.running);
  }

  private renderHud(weight: number, money: number, debt: number) {
    this.hud.setText(
      `DAY ${this.gs.day}    ${weight.toFixed(1)}kg [${this.gs.tier.name}]    $${Math.round(money)}    debt $${Math.round(
        debt
      )}`
    );
  }

  private renderTime(slotFloat: number) {
    const clamped = Math.max(0, Math.min(slotFloat, START.slotsPerDay));
    const f = Math.min(Math.floor(clamped), 4);
    const tod = timeOfDay(f);
    const hourF = TIME.startHour + clamped * TIME.hoursPerSlot;
    const hh = Math.floor(hourF) % 24;
    const mm = Math.floor((hourF - Math.floor(hourF)) * 60);
    this.clock.setText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ${tod.label}`);

    // interpolate sky between this block and the next
    const next = timeOfDay(Math.min(f + 1, 4));
    const frac = clamped - f;
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(tod.sky),
      Phaser.Display.Color.IntegerToColor(next.sky),
      100,
      Math.floor(frac * 100)
    );
    this.paintSky(Phaser.Display.Color.GetColor(c.r, c.g, c.b), clamped);
    this.drawTimePips(clamped);
  }

  private drawTimePips(slotFloat: number) {
    const g = this.timePips;
    g.clear();
    const n = START.slotsPerDay;
    const x0 = GAME.WIDTH - 56;
    for (let i = 0; i < n; i++) {
      const spent = slotFloat >= i + 1;
      const partial = !spent && slotFloat > i;
      g.fillStyle(spent ? PAL.grayDark : PAL.yellow, 1);
      g.fillRect(x0 + i * 12, 7, 9, 7);
      if (partial) {
        g.fillStyle(PAL.grayDark, 1);
        g.fillRect(x0 + i * 12, 7, Math.round(9 * (slotFloat - i)), 7);
      }
      g.lineStyle(1, PAL.bg0, 1).strokeRect(x0 + i * 12 + 0.5, 7.5, 8, 6);
    }
  }

  private flashMessage(text: string) {
    if (this.msg) this.msg.destroy();
    this.msg = pixelText(this, 6, GAME.HEIGHT - 16, text, 11, PAL.white).setDepth(50);
  }

  // ---- Event popups ----
  private drainPopups() {
    let e = this.gs.takePopup();
    const lines: string[] = [];
    while (e) {
      lines.push(e.text);
      e = this.gs.takePopup();
    }
    if (lines.length) this.showPopup(lines);
  }

  private showPopup(lines: string[]) {
    this.popupLayer.removeAll(true);
    const w = 400;
    const h = 36 + lines.length * 16;
    const x = (GAME.WIDTH - w) / 2;
    const y = (GAME.HEIGHT - h) / 2;
    const g = this.add.graphics();
    g.fillStyle(PAL.ink, 0.94).fillRect(x, y, w, h);
    g.lineStyle(2, PAL.white, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
    this.popupLayer.add(g);
    lines.forEach((l, i) => this.popupLayer.add(pixelText(this, x + 12, y + 12 + i * 16, l, 11, PAL.white)));
    const dismiss = pixelText(this, x + w - 110, y + h - 16, '[click to go on]', 9, PAL.gray);
    this.popupLayer.add(dismiss);
    this.busy = true;
    this.input.once('pointerup', () => {
      this.popupLayer.removeAll(true);
      this.busy = false;
    });
  }

  private toGameOver() {
    this.time.delayedCall(250, () => {
      this.scene.start('GameOver', {
        cause: this.gs.cause,
        day: this.gs.day,
        weight: this.gs.stats.weight,
        tier: this.gs.tier.name,
      });
    });
  }
}
