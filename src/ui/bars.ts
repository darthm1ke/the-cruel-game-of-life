import Phaser from 'phaser';
import { PAL } from '../config';
import { pixelText } from './text';

/** A labeled 0..100 stat bar. Color can flip when the stat is in danger. */
export class StatBar {
  private g: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private val: Phaser.GameObjects.Text;
  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private w: number,
    private name: string,
    private color: number,
    /** when true, HIGH values are bad (hunger, health risk) -> bar turns red high */
    private dangerHigh = false
  ) {
    this.label = pixelText(scene, x, y - 12, name, 9, PAL.gray);
    this.val = pixelText(scene, x + w - 24, y - 12, '0', 9, PAL.white);
    this.g = scene.add.graphics();
  }

  set(value: number) {
    const v = Math.max(0, Math.min(100, value));
    const h = 9;
    const danger = this.dangerHigh ? v > 70 : v < 25;
    const fill = danger ? PAL.red : this.color;
    this.g.clear();
    this.g.fillStyle(PAL.ink, 1);
    this.g.fillRect(this.x, this.y, this.w, h);
    this.g.fillStyle(fill, 1);
    this.g.fillRect(this.x + 1, this.y + 1, Math.round((this.w - 2) * (v / 100)), h - 2);
    this.g.lineStyle(1, PAL.grayDark, 1);
    this.g.strokeRect(this.x + 0.5, this.y + 0.5, this.w - 1, h - 1);
    this.val.setText(String(Math.round(v)));
    this.label.setColor(danger ? '#c8413b' : '#6b6b7b');
    void this.name;
  }
}
