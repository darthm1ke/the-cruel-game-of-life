import Phaser from 'phaser';
import { GAME, PAL, WEIGHT_TIERS, tierForWeight } from '../config';
import { animKey, type Pose } from '../art/man';
import { generateObject, objKey, type ObjName } from '../art/objects';
import { button, pixelText } from '../ui/text';

const POSES: Pose[] = ['idle', 'walk', 'exercise', 'eat', 'slump'];
const OBJS: ObjName[] = ['fridge', 'snack', 'laptop', 'treadmill', 'bed', 'mailbox', 'phone', 'scale', 'pen'];

/**
 * Verification view (CHECKPOINTS M1): all 6 weight tiers side-by-side (animated),
 * pose cycling, a weight value that proves tier swapping at the right breakpoints,
 * and every object icon.
 */
export class DebugScene extends Phaser.Scene {
  private poseIdx = 0;
  private weight = 132;
  private label!: Phaser.GameObjects.Text;
  private tierLabel!: Phaser.GameObjects.Text;
  private liveMan!: Phaser.GameObjects.Sprite;
  private tierSprites: Phaser.GameObjects.Sprite[] = [];

  constructor() {
    super('Debug');
  }

  create() {
    this.cameras.main.setBackgroundColor(PAL.bg1);
    pixelText(this, 6, 4, 'SPRITE DEBUG — all weight tiers (0 lean .. 5 morbid), animated', 11, PAL.white);

    const startX = 56;
    const gap = 96;
    this.tierSprites = [];
    WEIGHT_TIERS.forEach((t, i) => {
      const x = startX + i * gap;
      const spr = this.add.sprite(x, 130, '').setScale(1.4).play(animKey(t.tier, POSES[this.poseIdx]));
      this.tierSprites.push(spr);
      pixelText(this, x - 36, 180, `T${t.tier} ${t.name}`, 10, PAL.gray);
      pixelText(this, x - 36, 194, `<=${t.maxWeight}kg`, 9, PAL.grayDark);
    });

    this.label = pixelText(this, 6, 216, '', 11, PAL.yellow);

    pixelText(this, 6, 246, 'TIER SWAP TEST — change weight, body re-tiers at breakpoints:', 11, PAL.white);
    this.liveMan = this.add.sprite(80, 310, '').setScale(1.3);
    this.tierLabel = pixelText(this, 150, 290, '', 11, PAL.green);

    button(this, 150, 308, 34, 22, '-5', () => this.changeWeight(-5), { size: 10 });
    button(this, 188, 308, 34, 22, '+5', () => this.changeWeight(+5), { size: 10 });
    button(this, 226, 308, 40, 22, '-20', () => this.changeWeight(-20), { size: 10 });
    button(this, 270, 308, 40, 22, '+20', () => this.changeWeight(+20), { size: 10 });

    pixelText(this, 340, 270, 'OBJECTS:', 11, PAL.white);
    OBJS.forEach((n, i) => {
      generateObject(this, n);
      this.add.image(360 + (i % 5) * 44, 300 + Math.floor(i / 5) * 36, objKey(n)).setScale(1.4);
    });

    button(this, GAME.WIDTH - 96, 4, 90, 22, 'cycle pose', () => this.cyclePose(), { size: 10 });
    button(this, GAME.WIDTH - 96, 28, 90, 22, 'back to menu', () => this.scene.start('Menu'), { size: 10 });

    this.input.keyboard?.on('keydown-SPACE', () => this.cyclePose());
    this.refresh();
  }

  private cyclePose() {
    this.poseIdx = (this.poseIdx + 1) % POSES.length;
    WEIGHT_TIERS.forEach((t, i) => this.tierSprites[i]?.play(animKey(t.tier, POSES[this.poseIdx])));
    this.refresh();
  }

  private changeWeight(delta: number) {
    this.weight = Math.max(50, this.weight + delta);
    this.refresh();
  }

  private refresh() {
    const t = tierForWeight(this.weight);
    this.liveMan.play(animKey(t.tier, POSES[this.poseIdx]));
    this.tierLabel.setText(`weight ${this.weight}kg -> tier ${t.tier} (${t.name})`);
    console.log(`[debug] weight ${this.weight} -> tier ${t.tier} ${t.name}`);
    this.label.setText(`pose: ${POSES[this.poseIdx]}   (SPACE or button to cycle)`);
  }
}
