import Phaser from 'phaser';
import { PAL } from '../config';
import { PixelTexture } from './pixel';

/** The interactable room objects, each an 8-bit icon. Keys: `obj_<name>`. */
export type ObjName =
  | 'fridge'
  | 'snack'
  | 'laptop'
  | 'treadmill'
  | 'bed'
  | 'mailbox'
  | 'phone'
  | 'scale'
  | 'pen';

export function objKey(name: ObjName) {
  return `obj_${name}`;
}

type Builder = (p: PixelTexture) => void;

const BUILDERS: Record<ObjName, { w: number; h: number; draw: Builder }> = {
  fridge: {
    w: 22,
    h: 30,
    draw: (p) => {
      p.rect(3, 1, 16, 28, 0x9aa0ad); // metal body
      p.rect(4, 2, 13, 26, 0xe8eaf0); // bright front face
      p.rect(4, 2, 2, 26, 0xf6f8fc); // left highlight column (lit)
      p.rect(15, 2, 2, 26, 0xb7bcc8); // right shade column
      p.hline(4, 12, 13, 0x9aa0ad); // freezer / fridge split
      p.rect(13, 4, 2, 6, 0x6b7180); // top handle
      p.rect(13, 15, 2, 8, 0x6b7180); // bottom handle
      p.px(7, 7, 0xc8ccd6); // panel detail
    },
  },
  snack: {
    w: 18,
    h: 16,
    draw: (p) => {
      p.rect(2, 4, 14, 10, PAL.orange);
      p.rect(2, 4, 14, 3, PAL.yellow);
      p.px(5, 9, PAL.redDark);
      p.px(9, 11, PAL.redDark);
      p.px(12, 8, PAL.redDark);
    },
  },
  laptop: {
    w: 22,
    h: 16,
    draw: (p) => {
      p.rect(3, 1, 16, 10, 0x2a2a34); // monitor frame
      p.rect(4, 2, 14, 8, 0x5a86b0); // screen
      p.rect(4, 2, 14, 3, 0x79a8d8); // screen glow (top)
      p.px(6, 4, 0xbfe0ff); // glint
      p.rect(2, 11, 18, 3, 0x6b6b7b); // keyboard base
      p.rect(2, 11, 18, 1, 0x9a9aae); // base highlight
    },
  },
  treadmill: {
    w: 26,
    h: 22,
    draw: (p) => {
      p.rect(2, 17, 22, 4, 0x33333f); // belt base
      p.rect(2, 16, 22, 1, 0x55556a); // belt top highlight
      for (let x = 4; x < 24; x += 3) p.px(x, 18, 0x44444f); // belt slats
      p.rect(19, 4, 3, 13, 0x6b6b7b); // upright
      p.rect(19, 4, 1, 13, 0x9a9aae); // upright highlight
      p.rect(14, 2, 9, 3, 0x4a4a58); // console
      p.rect(15, 3, 3, 1, 0x5a9e54); // console readout
    },
  },
  bed: {
    w: 28,
    h: 16,
    draw: (p) => {
      p.rect(2, 9, 24, 5, 0x4a3a30); // wooden frame
      p.rect(2, 9, 24, 1, 0x5e4a3c); // frame highlight
      p.rect(3, 6, 22, 4, 0x4a6a9e); // blanket
      p.rect(3, 6, 22, 1, 0x6a8abf); // blanket highlight
      p.rect(3, 9, 22, 1, 0x33507a); // blanket fold shadow
      p.rect(3, 4, 9, 4, 0xe8e6df); // pillow
      p.rect(3, 4, 9, 1, 0xfafafa); // pillow highlight
    },
  },
  mailbox: {
    w: 16,
    h: 24,
    draw: (p) => {
      p.rect(7, 8, 2, 14, PAL.grayDark); // post
      p.rect(3, 3, 10, 7, PAL.red); // box
      p.rect(12, 2, 2, 4, PAL.yellow); // flag up = bills
    },
  },
  phone: {
    w: 12,
    h: 20,
    draw: (p) => {
      p.rect(2, 1, 8, 18, PAL.grayDark);
      p.rect(3, 3, 6, 13, PAL.blue);
      p.px(6, 17, PAL.white);
    },
  },
  scale: {
    w: 18,
    h: 12,
    draw: (p) => {
      p.rect(2, 6, 14, 5, PAL.white);
      p.rect(2, 10, 14, 1, PAL.grayDark);
      p.rect(6, 2, 6, 4, PAL.gray); // display
      p.hline(7, 4, 4, PAL.red);
    },
  },
  pen: {
    w: 16,
    h: 12,
    draw: (p) => {
      p.rect(2, 5, 12, 3, PAL.gray); // body (the Gray Pen)
      p.rect(13, 5, 2, 3, PAL.grayDark); // tip
      p.px(3, 6, PAL.purple); // dose dial
    },
  },
};

export function generateObject(scene: Phaser.Scene, name: ObjName): string {
  const key = objKey(name);
  if (scene.textures.exists(key)) return key;
  const cfg = BUILDERS[name];
  const p = new PixelTexture(scene, key, cfg.w, cfg.h);
  cfg.draw(p);
  p.outline(PAL.outline);
  return p.commit();
}

export function generateAllObjects(scene: Phaser.Scene) {
  (Object.keys(BUILDERS) as ObjName[]).forEach((n) => generateObject(scene, n));
}
