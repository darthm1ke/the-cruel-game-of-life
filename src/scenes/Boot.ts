import Phaser from 'phaser';

/** Boot is a no-op handoff; kept as its own scene so the flow is explicit. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  create() {
    console.log('[scene] Boot -> Preload');
    this.scene.start('Preload');
  }
}
