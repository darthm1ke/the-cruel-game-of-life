import Phaser from 'phaser';
import { GAME, PAL } from '../config';
import type { Cause } from '../state/types';
import { animKey } from '../art/man';
import { button, pixelText } from '../ui/text';

interface OverData {
  cause: Cause;
  day: number;
  weight: number;
  tier: string;
}

const CAUSE_COPY: Record<Cause, { title: string; line: string; tone: number }> = {
  alive: { title: 'STILL HERE', line: 'Somehow.', tone: PAL.white },
  won: {
    title: 'YOU MADE IT OUT',
    line: 'No longer fat. No longer the same. The system lost this round.',
    tone: PAL.green,
  },
  starved: { title: 'YOU COLLAPSED', line: 'Empty tank, empty fridge, empty day.', tone: PAL.red },
  crash: { title: 'HEALTH CRASH', line: 'The body cashed every check you bounced.', tone: PAL.red },
  heart: { title: 'IT STOPPED', line: 'The hospital tried. The invoice will still arrive.', tone: PAL.red },
  debt: { title: 'BURIED IN DEBT', line: 'You survived your body and lost to the math.', tone: PAL.red },
  gaveup: { title: 'CONTROL GONE', line: 'The game finished playing itself.', tone: PAL.gray },
};

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: OverData) {
    console.log('[scene] GameOver', data);
    const { WIDTH } = GAME;
    this.cameras.main.setBackgroundColor(PAL.bg0);
    const c = CAUSE_COPY[data.cause] ?? CAUSE_COPY.alive;

    const title = pixelText(this, 0, 56, c.title, 26, c.tone);
    title.setPosition(Math.round((WIDTH - title.width) / 2), 56);

    const line = pixelText(this, 0, 94, c.line, 11, PAL.gray);
    line.setPosition(Math.round((WIDTH - line.width) / 2), 94);

    // Show the body you ended with — lean if you won, heavy & slumped if you didn't.
    const tierGuess = data.cause === 'won' ? 0 : 4;
    this.add
      .sprite(WIDTH / 2, 210, '')
      .setScale(2.2)
      .play(animKey(tierGuess, data.cause === 'won' ? 'idle' : 'slump'));

    const stats = pixelText(
      this,
      0,
      236,
      `survived ${data.day} days   ·   final weight ${data.weight.toFixed(1)}kg [${data.tier}]`,
      11,
      PAL.white
    );
    stats.setPosition(Math.round((WIDTH - stats.width) / 2), 236);

    // Persist best run (days survived) — early Milestone 6 hook.
    this.saveBest(data.day);
    const best = this.loadBest();
    const bestText = pixelText(this, 0, 254, `best: ${best} days`, 10, PAL.gray);
    bestText.setPosition(Math.round((WIDTH - bestText.width) / 2), 254);

    button(this, WIDTH / 2 - 80, 282, 160, 30, 'TRY AGAIN', () => this.scene.start('Game'), {
      fill: PAL.redDark,
      size: 12,
    });
    button(this, WIDTH / 2 - 80, 318, 160, 24, 'menu', () => this.scene.start('Menu'), { size: 10 });
  }

  private saveBest(day: number) {
    try {
      const best = this.loadBest();
      if (day > best) localStorage.setItem('tcgol_best', String(day));
    } catch {
      /* localStorage unavailable; ignore */
    }
  }
  private loadBest(): number {
    try {
      return parseInt(localStorage.getItem('tcgol_best') ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  }
}
