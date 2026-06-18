import Phaser from 'phaser';
import { PAL } from '../config';

/**
 * Legible pixel text. Uses VT323 (a clean pixel font) which reads much better
 * than raw monospace at small sizes. VT323's glyphs sit small in their em box,
 * so we scale the requested size up ~1.5x to match the old visual weight while
 * gaining clarity. High resolution keeps it sharp under the pixel-art upscaler.
 */
export function pixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 8,
  color: number = PAL.white
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: "'VT323', monospace",
      fontSize: `${Math.round(size * 1.5)}px`,
      color: '#' + color.toString(16).padStart(6, '0'),
      resolution: 4,
    })
    .setOrigin(0, 0);
}

export interface ButtonHandle {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  /** dim + toggle clickability (used to lock buttons while an action runs) */
  setEnabled(on: boolean): void;
  /** raw press/release hooks (used by the "hold to hurry" button) */
  onPress(fn: () => void): void;
  onRelease(fn: () => void): void;
}

/**
 * A clickable text button. Uses a real Rectangle game object for input so the
 * hit area is exactly the visible box (origin 0,0) — no Container-local-space
 * offset, which was causing clicks to land on the neighbouring button.
 */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts: { fill?: number; text?: number; size?: number } = {}
): ButtonHandle {
  const fill = opts.fill ?? PAL.bg2;
  const rect = scene.add.rectangle(x, y, w, h, fill).setOrigin(0, 0);
  rect.setStrokeStyle(1, PAL.gray);
  const t = pixelText(scene, 0, 0, label, opts.size ?? 8, opts.text ?? PAL.white);
  t.setPosition(Math.round(x + (w - t.width) / 2), Math.round(y + (h - t.height) / 2));

  let enabled = true;
  rect.setInteractive({ useHandCursor: true });
  rect.on('pointerover', () => {
    if (enabled) {
      rect.setFillStyle(PAL.bg1);
      rect.setStrokeStyle(1, PAL.white);
    }
  });
  rect.on('pointerout', () => {
    rect.setFillStyle(fill);
    rect.setStrokeStyle(1, PAL.gray);
  });
  rect.on('pointerup', () => {
    if (enabled) onClick();
  });

  return {
    rect,
    label: t,
    setEnabled(on: boolean) {
      enabled = on;
      rect.setAlpha(on ? 1 : 0.35);
      t.setAlpha(on ? 1 : 0.35);
      if (on) rect.setInteractive({ useHandCursor: true });
      else rect.disableInteractive();
    },
    onPress(fn: () => void) {
      rect.on('pointerdown', () => {
        if (enabled) fn();
      });
    },
    onRelease(fn: () => void) {
      rect.on('pointerup', () => fn());
      rect.on('pointerout', () => fn());
    },
  };
}
