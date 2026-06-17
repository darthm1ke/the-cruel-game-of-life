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
  work: 'sit',
  walk: 'walk',
  exercise: 'exercise',
  cook: 'eat',
  snack: 'eat',
  skip: 'idle',
  search: 'sit',
  rest: 'slump',
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

// ----- Isometric room layout -----
const ROOM = { x: 0, y: 22, w: 432, h: 200 };
// Iso projection: a vertex (vx, vy) on the floor grid -> screen point.
const ISO = { tw: 54, th: 24, ox: 189, oy: 64 } as const;
const GRID = { cols: 7, rows: 5 } as const;
const WALL_H = 44;
const MAN_SCALE = 0.85;

type V = { x: number; y: number };
const iso = (vx: number, vy: number): V => ({
  x: ISO.ox + (vx - vy) * (ISO.tw / 2),
  y: ISO.oy + (vx + vy) * (ISO.th / 2),
});

/**
 * Where the character STANDS to perform each action (floor-grid vertex coords).
 * One activity per corner; the middle of the floor is open space for walking.
 */
const ZONE: Record<'kitchen' | 'desk' | 'bed' | 'gym' | 'center', V> = {
  kitchen: { x: 1.3, y: 1.5 }, // back-left
  desk: { x: 5.5, y: 1.5 }, // back-right
  bed: { x: 1.3, y: 3.8 }, // front-left
  gym: { x: 5.5, y: 3.8 }, // front-right
  center: { x: 3.5, y: 2.6 }, // open middle
};

const SUN = 0xf2c84a;
const MOON = 0xd8d8e8;
const WINDOW_DAY = 0x79a8d8;
const WINDOW_NIGHT = 0x10101e;

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
  private manVtx: V = { ...ZONE.center };

  private windowG!: Phaser.GameObjects.Graphics; // animated window (sun/moon)
  private overlay!: Phaser.GameObjects.Graphics; // time-of-day mood tint
  private winPts: V[] = []; // window parallelogram corners
  private winMidL: V = { x: 0, y: 0 };
  private winMidR: V = { x: 0, y: 0 };

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

  private busy = false;
  private running = false;
  private activeTween?: Phaser.Tweens.Tween;
  private hurryHeld = false;
  private zzz?: Phaser.GameObjects.Text;

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
    this.manVtx = { ...ZONE.center };

    this.drawRoom();
    this.buildHud();
    this.buildStatBars();
    this.buildActions();
    this.buildKeys();

    this.popupLayer = this.add.container(0, 0).setDepth(1000);
    this.refresh();
  }

  // ---- Isometric room ----
  private drawRoom() {
    const g = this.add.graphics().setDepth(-20);

    // ambient backdrop behind the walls
    g.fillStyle(PAL.bg1, 1).fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);

    // floor corners
    const A = iso(0, 0);
    const B = iso(GRID.cols, 0);
    const C = iso(GRID.cols, GRID.rows);
    const D = iso(0, GRID.rows);
    const up = (p: V): V => ({ x: p.x, y: p.y - WALL_H });

    // back-left wall (along A-D) and back-right wall (along A-B)
    g.fillStyle(0x241d30, 1).fillPoints([A, D, up(D), up(A)], true); // left, darker
    g.fillStyle(0x2f2640, 1).fillPoints([A, B, up(B), up(A)], true); // right, lighter
    // baseboards
    g.fillStyle(PAL.bg0, 1);
    g.fillPoints([A, D, { x: D.x, y: D.y - 3 }, { x: A.x, y: A.y - 3 }], true);
    g.fillPoints([A, B, { x: B.x, y: B.y - 3 }, { x: A.x, y: A.y - 3 }], true);

    // floor diamond + tile checker
    g.fillStyle(PAL.floor, 1).fillPoints([A, B, C, D], true);
    for (let c = 0; c < GRID.cols; c++) {
      for (let r = 0; r < GRID.rows; r++) {
        if ((c + r) % 2 === 0) continue;
        const t0 = iso(c, r);
        const t1 = iso(c + 1, r);
        const t2 = iso(c + 1, r + 1);
        const t3 = iso(c, r + 1);
        g.fillStyle(0x312930, 1).fillPoints([t0, t1, t2, t3], true);
      }
    }
    // floor grid lines
    g.lineStyle(1, PAL.bg2, 0.5);
    for (let c = 0; c <= GRID.cols; c++) g.lineBetween(iso(c, 0).x, iso(c, 0).y, iso(c, GRID.rows).x, iso(c, GRID.rows).y);
    for (let r = 0; r <= GRID.rows; r++) g.lineBetween(iso(0, r).x, iso(0, r).y, iso(GRID.cols, r).x, iso(GRID.cols, r).y);

    // window parallelogram on the back-right wall
    const dir = { x: ISO.tw / 2, y: ISO.th / 2 }; // one column step along the wall
    const TL = { x: up(A).x + dir.x * 1.3, y: up(A).y + dir.y * 1.3 + 5 };
    const TR = { x: TL.x + dir.x * 1.7, y: TL.y + dir.y * 1.7 };
    const BR = { x: TR.x, y: TR.y + 22 };
    const BL = { x: TL.x, y: TL.y + 22 };
    this.winPts = [TL, TR, BR, BL];
    this.winMidL = { x: (TL.x + BL.x) / 2, y: (TL.y + BL.y) / 2 };
    this.winMidR = { x: (TR.x + BR.x) / 2, y: (TR.y + BR.y) / 2 };

    // animated window + mood overlay
    this.windowG = this.add.graphics().setDepth(-10);
    this.overlay = this.add.graphics().setDepth(900);

    // objects grouped into their corner areas (placed behind the stand spot)
    // kitchen (back-left)
    this.placeObj('fridge', 0.7, 0.7, 1.3);
    this.placeObj('snack', 1.9, 0.7, 1.0);
    // desk / work (back-right)
    this.placeObj('laptop', 5.9, 0.9, 1.2);
    this.placeObj('mailbox', 6.4, 0.3, 1.0);
    // gym (front-right)
    this.placeObj('treadmill', 6.0, 3.7, 1.4);
    // bed (front-left)
    this.placeObj('bed', 0.8, 3.5, 1.5);
    // open middle
    this.placeObj('scale', 3.5, 1.3, 1.2);
    this.placeObj('phone', 2.6, 2.1, 1.0);

    // zone labels on the floor
    const label = (v: V, text: string) =>
      pixelText(this, iso(v.x, v.y).x, iso(v.x, v.y).y, text, 7, PAL.grayDark).setOrigin(0.5, 0.5).setDepth(0.5);
    label({ x: 1.3, y: 0.9 }, 'KITCHEN');
    label({ x: 5.5, y: 0.9 }, 'DESK');
    label({ x: 1.3, y: 4.3 }, 'BED');
    label({ x: 5.5, y: 4.3 }, 'GYM');

    this.man = this.add.sprite(0, 0, '').setOrigin(0.5, 1).setScale(MAN_SCALE).play(animKey(this.gs.tier.tier, 'idle'));
    this.setManPos(this.manVtx.x, this.manVtx.y);
  }

  private placeObj(n: ObjName, vx: number, vy: number, scale = 1.2) {
    const p = iso(vx, vy);
    this.add.image(p.x, p.y, objKey(n)).setOrigin(0.5, 1).setScale(scale).setDepth(p.y);
  }

  /** Move the character to floor-grid vertex (vx, vy): project + depth-sort. */
  private setManPos(vx: number, vy: number) {
    this.manVtx = { x: vx, y: vy };
    const p = iso(vx, vy);
    this.man.setPosition(Math.round(p.x), Math.round(p.y)).setDepth(p.y);
  }

  private zoneVtx(id: ActionId): V {
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
        return { x: Phaser.Math.FloatBetween(1, 4.5), y: Phaser.Math.FloatBetween(1, 3.5) };
    }
  }

  /** Redraw the window (sun/moon) and the day/night mood tint over the room. */
  private paintSky(skyColor: number, slotFloat: number) {
    const dusk = Phaser.Math.Clamp((slotFloat - 2.8) / 0.8, 0, 1);
    const winBg = lerpColor(WINDOW_DAY, WINDOW_NIGHT, dusk);
    const night = slotFloat >= 3.2;
    const t = Phaser.Math.Clamp(slotFloat, 0, 4) / 4;
    this.drawWindow(winBg, night ? MOON : SUN, t);
    this.drawOverlay(skyColor);
  }

  private drawWindow(bg: number, orb: number, t: number) {
    const g = this.windowG;
    g.clear();
    g.fillStyle(PAL.ink, 1).fillPoints(this.framePts(2), true);
    g.fillStyle(bg, 1).fillPoints(this.winPts, true);
    const ox = this.winMidL.x + (this.winMidR.x - this.winMidL.x) * t;
    const oy = this.winMidL.y + (this.winMidR.y - this.winMidL.y) * t - Math.round(Math.sin(t * Math.PI) * 8);
    g.fillStyle(orb, 1).fillCircle(ox, oy, 4);
  }

  /** Expand the window polygon by `m` px for the dark frame behind it. */
  private framePts(m: number): V[] {
    const cx = (this.winPts[0].x + this.winPts[2].x) / 2;
    const cy = (this.winPts[0].y + this.winPts[2].y) / 2;
    return this.winPts.map((p) => ({ x: p.x + Math.sign(p.x - cx) * m, y: p.y + Math.sign(p.y - cy) * m }));
  }

  private drawOverlay(skyColor: number) {
    this.overlay.clear();
    this.overlay.fillStyle(skyColor, 0.16).fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
  }

  private buildHud() {
    const g = this.add.graphics().setDepth(800);
    g.fillStyle(PAL.bg2, 1).fillRect(0, 0, GAME.WIDTH, 20);
    this.hud = pixelText(this, 6, 5, '', 11, PAL.white).setDepth(801);
    this.clock = pixelText(this, GAME.WIDTH - 190, 5, '', 11, PAL.yellow).setDepth(801);
    this.timePips = this.add.graphics().setDepth(801);
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

  /** Walk diagonally across the floor to the action's zone, then play the pose. */
  private runAction(id: ActionId, before: Stats, after: Stats, slotBefore: number) {
    this.running = true;
    this.setActionsEnabled(false);
    this.hurryBtn.setEnabled(true);
    this.endDayBtn.setEnabled(false);

    const tier = this.gs.tier.tier;
    const start = { ...this.manVtx };
    const target = this.zoneVtx(id);
    const dist = Math.hypot(target.x - start.x, target.y - start.y);
    const travelP = id === 'walk' ? 1 : Phaser.Math.Clamp(dist / 7, 0.14, 0.5);
    const pose = POSE_FOR_ACTION[id] ?? 'idle';
    // face the screen-x direction of travel
    const screenDX = target.x - target.y - (start.x - start.y);
    this.man.setFlipX(screenDX < 0);
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
          const k = p / travelP;
          this.setManPos(start.x + (target.x - start.x) * k, start.y + (target.y - start.y) * k);
        } else if (!arrived) {
          arrived = true;
          this.setManPos(target.x, target.y);
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

  // ---- Night / sleep ----
  private endDay() {
    if (this.running || this.busy || this.gs.over) return;
    this.gs.endDay();
    this.running = true;
    this.setActionsEnabled(false);
    this.endDayBtn.setEnabled(false);
    this.hurryBtn.setEnabled(true);

    const tier = this.gs.tier.tier;
    const start = { ...this.manVtx };
    const target = ZONE.bed;
    const travelP = 0.28;
    let inBed = false;
    this.man.setFlipX(target.x - target.y - (start.x - start.y) < 0);
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
          const k = p / travelP;
          this.setManPos(start.x + (target.x - start.x) * k, start.y + (target.y - start.y) * k);
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

  private lieDownToSleep() {
    const p = iso(ZONE.bed.x, ZONE.bed.y);
    this.man.play(animKey(this.gs.tier.tier, 'slump'));
    this.man.setOrigin(0.5, 0.5).setFlipX(false).setAngle(-90).setPosition(p.x, p.y - 8).setDepth(p.y + 50);
    this.zzz?.destroy();
    this.zzz = pixelText(this, p.x + 16, p.y - 24, 'z', 10, PAL.white).setDepth(950);
    this.tweens.add({ targets: this.zzz, y: p.y - 42, alpha: { from: 1, to: 0 }, duration: 1100, repeat: -1 });
  }

  private wakeUp() {
    this.running = false;
    this.activeTween = undefined;
    this.zzz?.destroy();
    this.zzz = undefined;
    this.man.setOrigin(0.5, 1).setAngle(0);
    this.setManPos(ZONE.bed.x, ZONE.bed.y);
    this.setActionsEnabled(true);
    this.hurryBtn.setEnabled(false);
    this.endDayBtn.setEnabled(true);
    if (!this.gs.over) this.man.play(animKey(this.gs.tier.tier, 'idle'));
    this.flashMessage(`— A new day. Day ${this.gs.day}. —`);
    this.refresh();
    this.drainPopups();
    if (this.gs.over) this.toGameOver();
  }

  private renderNightSky(p: number) {
    const sky = p < 0.5 ? lerpColor(PAL.skyEvening, PAL.skyNight, p / 0.5) : lerpColor(PAL.skyNight, PAL.skyMorning, (p - 0.5) / 0.5);
    const dawn = p > 0.82;
    const t = dawn ? 0.05 : p / 0.82;
    this.drawWindow(dawn ? WINDOW_DAY : WINDOW_NIGHT, dawn ? SUN : MOON, t);
    this.drawOverlay(sky);
    const hour = (23 + p * 8) % 24;
    this.clock.setText(`${String(Math.floor(hour)).padStart(2, '0')}:00  Night`);
  }

  // ---- UI refresh ----
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
      `DAY ${this.gs.day}    ${weight.toFixed(1)}kg [${this.gs.tier.name}]    $${Math.round(money)}    debt $${Math.round(debt)}`
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

    const next = timeOfDay(Math.min(f + 1, 4));
    const frac = clamped - f;
    this.paintSky(lerpColor(tod.sky, next.sky, frac), clamped);
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
    this.msg = pixelText(this, 6, GAME.HEIGHT - 16, text, 11, PAL.white).setDepth(950);
  }

  // ---- Popups ----
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
