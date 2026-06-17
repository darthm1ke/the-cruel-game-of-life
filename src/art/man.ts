import Phaser from 'phaser';
import { PAL, WEIGHT_TIERS, type WeightTier } from '../config';
import { PixelTexture } from './pixel';

export type Pose = 'idle' | 'walk' | 'exercise' | 'eat' | 'slump' | 'sit';

/** Frames per pose (for the animation loops). */
export const POSE_FRAMES: Record<Pose, number> = {
  idle: 2,
  walk: 4,
  eat: 2,
  exercise: 2,
  slump: 1,
  sit: 2, // hunched at the computer, typing
};

const FRAME_RATE: Record<Pose, number> = { idle: 2, walk: 8, eat: 3, exercise: 5, slump: 1, sit: 4 };

/** Big head, small round body — South Park kid proportions. */
export const MAN_W = 72;
export const MAN_H = 86;
const CX = MAN_W / 2;

export const manKey = (tier: number, pose: Pose, frame = 0) => `man_t${tier}_${pose}_${frame}`;
export const animKey = (tier: number, pose: Pose) => `anim_t${tier}_${pose}`;

/**
 * Draw the protagonist (one frame) for a weight tier + pose. A round-headed kid
 * in a teal pom beanie + red coat + yellow mittens; the coat blob widens with
 * the weight tier, so the same character reads as lean -> morbid.
 */
export function generateMan(scene: Phaser.Scene, t: WeightTier, pose: Pose, frame: number): string {
  const key = manKey(t.tier, pose, frame);
  if (scene.textures.exists(key)) return key;
  const p = new PixelTexture(scene, key, MAN_W, MAN_H);

  // --- Tier-driven body geometry ---
  const coatRx = Math.round(8 + t.bodyWidth * 0.72); // half-width of the coat blob
  const coatRy = Math.round(15 + t.bodyWidth * 0.2); // half-height (fat = taller too)
  const headR = 16 + (t.tier >= 3 ? 2 : 0) + (t.tier >= 5 ? 1 : 0);

  // --- Per-pose / per-frame motion ---
  let bob = 0; // vertical bounce of head+body
  let armPose: 'side' | 'up' | 'out' | 'eat' | 'type' = 'side';
  let mouthOpen = false;
  let eyesClosed = false;
  let footL = 0; // foot vertical offset (walk)
  let footR = 0;
  let legSpread = 0; // extra stance width (exercise)
  let lean = 0; // head/body tilt down (slump)

  switch (pose) {
    case 'idle':
      bob = frame === 1 ? -1 : 0;
      break;
    case 'walk':
      bob = frame % 2 === 0 ? 0 : -1;
      // 0: neutral, 1: L fwd, 2: neutral, 3: R fwd
      if (frame === 1) {
        footL = -2;
        footR = 1;
      } else if (frame === 3) {
        footL = 1;
        footR = -2;
      }
      break;
    case 'eat':
      armPose = 'eat';
      mouthOpen = frame === 1;
      bob = frame === 1 ? -1 : 0;
      break;
    case 'exercise':
      armPose = frame === 0 ? 'up' : 'out';
      legSpread = frame === 0 ? 0 : 4;
      bob = frame === 0 ? -2 : 0;
      break;
    case 'slump':
      eyesClosed = true;
      lean = 3;
      bob = 4; // sunk down
      break;
    case 'sit':
      armPose = 'type'; // hands forward on a keyboard
      lean = 2; // hunched toward the screen
      bob = 7; // lowered into a chair
      break;
  }

  const headCy = 28 + bob + lean;
  const bodyCy = headCy + headR + coatRy - 8;

  // ===== LEGS (drawn first, behind the coat) =====
  const legW = Math.max(6, Math.round(coatRx * 0.32));
  const stance = Math.round(coatRx * 0.4) + legSpread;
  const legTop = bodyCy + coatRy - 6;
  const drawLeg = (cx: number, footDy: number) => {
    p.rect(cx - legW / 2, legTop, legW, MAN_H - 6 - legTop + footDy, PAL.pants);
    p.rect(cx - legW / 2, legTop, 2, MAN_H - 6 - legTop + footDy, PAL.pantsShade);
    p.rect(cx - legW / 2 - 1, MAN_H - 6 + footDy, legW + 3, 4, PAL.ink); // shoe
  };
  drawLeg(CX - stance, footL);
  drawLeg(CX + stance, footR);

  // ===== COAT (body) =====
  p.ellipse(CX, bodyCy, coatRx, coatRy, PAL.coat);
  // lower shading
  for (let x = -coatRx; x <= coatRx; x++) {
    const yy = bodyCy + Math.round(coatRy * 0.55);
    p.px(CX + x, yy, PAL.coatShade);
    p.px(CX + x, yy + 1, PAL.coatShade, 0.6);
  }
  // hoodie kangaroo pocket across the lower belly
  const pocketW = Math.round(coatRx * 0.85);
  const pocketY = bodyCy + Math.round(coatRy * 0.2);
  const pocketH = Math.max(3, Math.round(coatRy * 0.4));
  p.rect(CX - pocketW, pocketY, pocketW * 2, pocketH, PAL.coatShade);
  p.rect(CX - pocketW, pocketY, pocketW * 2, 1, PAL.coat); // top seam
  // collar (neck) between head and hoodie + two cream drawstrings
  p.rect(CX - 4, headCy + headR - 3, 8, 6, PAL.skinShade);
  const stringTop = bodyCy - coatRy + 3;
  p.rect(CX - 3, stringTop, 1, 7, PAL.pom);
  p.rect(CX + 2, stringTop, 1, 6, PAL.pom);

  // ===== ARMS / MITTENS =====
  const mit = 4; // mitten radius
  const drawArm = (sx: number, sy: number, ex: number, ey: number) => {
    // simple coat-colored arm stub from (sx,sy) toward (ex,ey), mitten at end
    const steps = Math.max(Math.abs(ex - sx), Math.abs(ey - sy));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(sx + ((ex - sx) * i) / steps);
      const y = Math.round(sy + ((ey - sy) * i) / steps);
      p.rect(x - 2, y - 2, 4, 4, PAL.coat);
    }
    p.ellipse(ex, ey, mit, mit, PAL.mitten);
  };
  const shoulderY = bodyCy - Math.round(coatRy * 0.3);
  if (armPose === 'up') {
    drawArm(CX - coatRx + 3, shoulderY, CX - coatRx - 1, headCy - headR);
    drawArm(CX + coatRx - 3, shoulderY, CX + coatRx + 1, headCy - headR);
  } else if (armPose === 'out') {
    drawArm(CX - coatRx + 3, shoulderY, CX - coatRx - 6, shoulderY - 2);
    drawArm(CX + coatRx - 3, shoulderY, CX + coatRx + 6, shoulderY - 2);
  } else if (armPose === 'eat') {
    drawArm(CX - coatRx + 3, shoulderY, CX - coatRx - 2, bodyCy + 2); // left rests
    drawArm(CX + coatRx - 4, shoulderY, CX + 5, headCy + 9); // right up to mouth
    p.rect(CX + 4, headCy + 7, 4, 3, PAL.orange); // food in mitten
  } else if (armPose === 'type') {
    // both hands forward at lap/keyboard height, alternating for a typing motion
    const dy = frame === 1 ? -2 : 0;
    drawArm(CX - coatRx + 4, shoulderY, CX - 7, bodyCy + coatRy - 4 + dy);
    drawArm(CX + coatRx - 4, shoulderY, CX + 7, bodyCy + coatRy - 4 - dy);
  } else {
    drawArm(CX - coatRx + 3, shoulderY, CX - coatRx - 2, bodyCy + 3);
    drawArm(CX + coatRx - 3, shoulderY, CX + coatRx + 2, bodyCy + 3);
  }

  // ===== HEAD =====
  const headRx = headR + (t.tier >= 4 ? 2 : 0);
  p.ellipse(CX, headCy, headRx, headR, PAL.skin);
  // chubby cheeks for heavier tiers
  if (t.tier >= 2) {
    p.ellipse(CX - headRx + 3, headCy + 5, 4, 3, PAL.skinShade);
    p.ellipse(CX + headRx - 3, headCy + 5, 4, 3, PAL.skinShade);
  }
  if (t.tier >= 4) {
    // double chin
    p.ellipse(CX, headCy + headR - 1, headRx - 3, 3, PAL.skinShade);
  }

  // eyes: big white ovals (South Park signature), nearly touching
  const eyeY = headCy - 1;
  if (eyesClosed) {
    p.rect(CX - 7, eyeY, 5, 1, PAL.skinShade);
    p.rect(CX + 2, eyeY, 5, 1, PAL.skinShade);
  } else {
    p.ellipse(CX - 4, eyeY, 4, 5, PAL.white);
    p.ellipse(CX + 4, eyeY, 4, 5, PAL.white);
    p.rect(CX - 4, eyeY - 5, 8, 1, PAL.ink); // brow line joining eyes
    // pupils (look slightly down)
    p.rect(CX - 4, eyeY + 1, 2, 2, PAL.ink);
    p.rect(CX + 3, eyeY + 1, 2, 2, PAL.ink);
  }

  // mouth
  const mouthY = headCy + headR - 6;
  if (mouthOpen) p.ellipse(CX, mouthY, 3, 2, PAL.mouth);
  else p.rect(CX - 3, mouthY, 6, 1, PAL.mouth);

  // ===== BEANIE HAT (over the head top) =====
  const bandY = headCy - headR + 5;
  p.rect(CX - headRx, bandY, headRx * 2, 5, PAL.hat); // fold/band
  p.rect(CX - headRx, bandY + 4, headRx * 2, 1, PAL.hatShade);
  p.ellipse(CX, bandY - 1, headRx - 1, 8, PAL.hat); // dome
  // dome shading
  p.ellipse(CX + 3, bandY - 2, headRx - 5, 5, PAL.hatShade);
  p.ellipse(CX, bandY - 1, headRx - 2, 7, PAL.hat);
  // pom-pom
  p.ellipse(CX, bandY - 11, 4, 4, PAL.pom);

  return p.commit();
}

/** Build every tier/pose/frame texture (called from Preload). */
export function generateAllMen(scene: Phaser.Scene) {
  const poses = Object.keys(POSE_FRAMES) as Pose[];
  for (const t of WEIGHT_TIERS)
    for (const pose of poses) for (let f = 0; f < POSE_FRAMES[pose]; f++) generateMan(scene, t, pose, f);
}

/** Register a looping animation per tier+pose so sprites can just .play(). */
export function createManAnims(scene: Phaser.Scene) {
  const poses = Object.keys(POSE_FRAMES) as Pose[];
  for (const t of WEIGHT_TIERS) {
    for (const pose of poses) {
      const k = animKey(t.tier, pose);
      if (scene.anims.exists(k)) continue;
      const frames = [];
      for (let f = 0; f < POSE_FRAMES[pose]; f++) frames.push({ key: manKey(t.tier, pose, f) });
      scene.anims.create({ key: k, frames, frameRate: FRAME_RATE[pose], repeat: -1 });
    }
  }
}
