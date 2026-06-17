import Phaser from 'phaser';
import { GAME, PAL } from '../config';
import { animKey } from '../art/man';
import { button, pixelText } from '../ui/text';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    console.log('[scene] Menu');
    const { WIDTH } = GAME;
    this.cameras.main.setBackgroundColor(PAL.bg0);

    // Title
    const title = pixelText(this, 0, 50, GAME.TITLE, 24, PAL.white);
    title.setPosition(Math.round((WIDTH - title.width) / 2), 50);
    const sub = pixelText(this, 0, 84, GAME.SUBTITLE, 11, PAL.gray);
    sub.setPosition(Math.round((WIDTH - sub.width) / 2), 84);

    // The kid, idling and unbothered, as decoration.
    this.add.sprite(WIDTH / 2, 200, '').setScale(2).play(animKey(4, 'idle'));

    // Buttons
    button(this, WIDTH / 2 - 80, 280, 160, 30, 'BEGIN THE SPIRAL', () => this.scene.start('Game'), {
      fill: PAL.redDark,
      size: 12,
    });
    button(this, WIDTH / 2 - 80, 318, 160, 24, 'sprite debug view', () => this.scene.start('Debug'), {
      size: 10,
    });
  }
}
