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
      p.rect(3, 1, 16, 28, PAL.gray);
      p.rect(4, 2, 14, 26, PAL.white);
      p.hline(4, 13, 14, PAL.gray); // door split
      p.rect(15, 4, 2, 6, PAL.grayDark); // top handle
      p.rect(15, 16, 2, 8, PAL.grayDark); // bottom handle
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
      p.rect(3, 2, 16, 10, PAL.grayDark); // screen frame
      p.rect(4, 3, 14, 8, PAL.blue); // screen
      p.rect(2, 12, 18, 2, PAL.gray); // base
    },
  },
  treadmill: {
    w: 26,
    h: 22,
    draw: (p) => {
      p.rect(2, 16, 22, 4, PAL.grayDark); // belt
      p.rect(2, 15, 22, 1, PAL.gray);
      p.rect(20, 4, 2, 12, PAL.gray); // upright
      p.rect(15, 3, 8, 2, PAL.gray); // console
    },
  },
  bed: {
    w: 28,
    h: 16,
    draw: (p) => {
      p.rect(2, 8, 24, 6, PAL.grayDark); // frame
      p.rect(3, 6, 22, 3, PAL.blue); // mattress
      p.rect(3, 5, 7, 3, PAL.white); // pillow
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
  return p.commit();
}

export function generateAllObjects(scene: Phaser.Scene) {
  (Object.keys(BUILDERS) as ObjName[]).forEach((n) => generateObject(scene, n));
}
