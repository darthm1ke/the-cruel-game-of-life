import Phaser from 'phaser';

/**
 * Asset-override pipeline (the "real art drops in later" half of the hybrid plan).
 *
 * Every sprite in the game is addressed by a texture KEY (e.g. `man_t3_idle_0`,
 * `obj_fridge`). By default those keys are produced procedurally in code. To
 * replace any of them with hand-made pixel art, drop a PNG under `public/assets/`
 * and add an entry here. Loaded textures win because the procedural generators
 * all early-out with `if (scene.textures.exists(key)) return key;` — so a real
 * asset simply pre-populates the key and the generator skips it.
 *
 * See `public/assets/README.md` for the exact key list, sizes, and frame specs.
 */
export interface AssetOverride {
  /** texture key to override (must match a generated key exactly) */
  key: string;
  /** path under public/, e.g. 'assets/man/t3_idle_0.png' */
  path: string;
}

// Empty for now -> 100% procedural. Add entries as real art arrives.
export const ASSET_OVERRIDES: AssetOverride[] = [];

/** Queue override images in a scene's preload(). Missing files fall back silently. */
export function queueAssetOverrides(scene: Phaser.Scene) {
  if (ASSET_OVERRIDES.length === 0) return;
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
    console.warn(`[assets] override "${file.key}" failed to load -> using procedural art`);
  });
  for (const a of ASSET_OVERRIDES) {
    if (!scene.textures.exists(a.key)) scene.load.image(a.key, a.path);
  }
}
