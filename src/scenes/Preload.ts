import Phaser from 'phaser';
import { generateAllMen, createManAnims } from '../art/man';
import { generateAllObjects } from '../art/objects';
import { PixelTexture } from '../art/pixel';
import { PAL } from '../config';

/** Generate every procedural texture, then move to the menu. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create() {
    // A 2px checkerboard used to verify pixel-perfect rendering (CHECKPOINTS M0).
    const cb = new PixelTexture(this, 'checker', 4, 4);
    cb.rect(0, 0, 2, 2, PAL.white).rect(2, 2, 2, 2, PAL.white);
    cb.commit();

    generateAllMen(this);
    createManAnims(this);
    generateAllObjects(this);

    console.log('[scene] Preload: textures generated -> Menu');
    this.scene.start('Menu');
  }
}
