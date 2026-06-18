import Phaser from 'phaser';
import { generateAllMen, createManAnims } from '../art/man';
import { generateAllObjects } from '../art/objects';
import { queueAssetOverrides } from '../art/assets';
import { PixelTexture } from '../art/pixel';
import { PAL } from '../config';

/**
 * Load any real-art overrides first, then generate the rest procedurally.
 * The generators skip keys that already exist (i.e. were loaded as assets),
 * so hand-made art transparently replaces the procedural version.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    queueAssetOverrides(this);
  }

  create() {
    // A 2px checkerboard used to verify pixel-perfect rendering (CHECKPOINTS M0).
    const cb = new PixelTexture(this, 'checker', 4, 4);
    cb.rect(0, 0, 2, 2, PAL.white).rect(2, 2, 2, 2, PAL.white);
    cb.commit();

    generateAllMen(this); // fills any man_* keys not provided by assets
    createManAnims(this);
    generateAllObjects(this); // fills any obj_* keys not provided by assets

    console.log('[scene] Preload: textures ready -> Menu');
    this.scene.start('Menu');
  }
}
