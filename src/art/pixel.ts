import Phaser from 'phaser';

/**
 * Procedural pixel-art helper. Draws into an offscreen canvas one pixel at a
 * time, then registers it as a Phaser texture. This is how *all* art in the
 * game is made — no image files, fully version-controlled (CHECKPOINTS M1).
 */
export class PixelTexture {
  private ctx: CanvasRenderingContext2D;
  private canvasTex: Phaser.Textures.CanvasTexture;

  constructor(
    scene: Phaser.Scene,
    private key: string,
    public readonly w: number,
    public readonly h: number
  ) {
    // Reuse if a previous scene already built this key.
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.canvasTex = scene.textures.createCanvas(key, w, h)!;
    this.ctx = this.canvasTex.getContext();
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Set a single pixel (no-op if out of bounds). color is 0xRRGGBB. */
  px(x: number, y: number, color: number, alpha = 1): this {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    this.ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    this.ctx.fillRect(x, y, 1, 1);
    return this;
  }

  /** Filled rectangle of pixels. */
  rect(x: number, y: number, w: number, h: number, color: number, alpha = 1): this {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.px(x + xx, y + yy, color, alpha);
    return this;
  }

  /** Horizontal line. */
  hline(x: number, y: number, len: number, color: number): this {
    return this.rect(x, y, len, 1, color);
  }

  /** Filled ellipse (used for bellies). cx/cy center, rx/ry radii. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: number): this {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.px(cx + x, cy + y, color);
      }
    }
    return this;
  }

  /** Mirror the left half across the vertical center line (symmetric bodies). */
  mirrorX(): this {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const data = img.data;
    const half = Math.floor(this.w / 2);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < half; x++) {
        const src = (y * this.w + x) * 4;
        const dst = (y * this.w + (this.w - 1 - x)) * 4;
        data[dst] = data[src];
        data[dst + 1] = data[src + 1];
        data[dst + 2] = data[src + 2];
        data[dst + 3] = data[src + 3];
      }
    }
    this.ctx.putImageData(img, 0, 0);
    return this;
  }

  /**
   * Add a 1px outline around every opaque region (the classic 16-bit sprite
   * look). Transparent pixels orthogonally adjacent to an opaque pixel become
   * the outline color. Call after all drawing, before commit().
   */
  outline(color = 0x171320, alpha = 1): this {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const d = img.data;
    const opaque = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < this.w && y < this.h && d[(y * this.w + x) * 4 + 3] > 24;
    const edge: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (d[(y * this.w + x) * 4 + 3] > 24) continue; // already opaque
        if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) edge.push(x, y);
      }
    }
    for (let i = 0; i < edge.length; i += 2) this.px(edge[i], edge[i + 1], color, alpha);
    return this;
  }

  /** Push pixels to the GPU. Call once after drawing. */
  commit(): string {
    this.canvasTex.refresh();
    return this.key;
  }
}
