import Phaser from 'phaser';
import { GAME, PAL } from './config';
import { BootScene } from './scenes/Boot';
import { PreloadScene } from './scenes/Preload';
import { MenuScene } from './scenes/Menu';
import { GameScene } from './scenes/Game';
import { GameOverScene } from './scenes/GameOver';
import { DebugScene } from './scenes/Debug';
import { GameState } from './state/GameState';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  backgroundColor: PAL.bg0,
  // Crisp 8-bit scaling: nearest-neighbor, no sub-pixel positions.
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, GameOverScene, DebugScene],
};

// Wait for the pixel font so the first (static) text renders with it, not a fallback.
try {
  await Promise.race([document.fonts.load('32px "VT323"').then(() => document.fonts.ready), new Promise((r) => setTimeout(r, 2500))]);
} catch {
  /* font CDN unreachable -> falls back to monospace */
}

const game = new Phaser.Game(config);

// Expose hooks for the headless verification harness (scripts/verify.mjs).
// Harmless in production; lets tests drive scenes + exercise the pure engine.
(window as unknown as Record<string, unknown>).__tcgol = { game, GameState };

// Hide the HTML loading message once Phaser has the canvas.
const bootMsg = document.getElementById('boot-msg');
if (bootMsg) bootMsg.style.display = 'none';

// eslint-disable-next-line no-console
console.log(`[The Cruel Game of Life] Phaser ${Phaser.VERSION} booted.`);
