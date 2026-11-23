import * as Phaser from 'phaser';
import { ANIMATIONS, firstFrame } from '../assets';
import { SIZE_SCALE } from '../config';

/** Bolt size and speed from the p5 game: 50 px, rising at 7 px per frame. */
const BOLT_SIZE = 50 * SIZE_SCALE;
const BOLT_SPEED = 420 * SIZE_SCALE;

/** Shadow Bolts in flight. Hits are handled by the scene's overlap with the falling objects. */
export class ShadowBolts {
    readonly group: Phaser.Physics.Arcade.Group;

    constructor(private readonly scene: Phaser.Scene, private readonly depth: number) {
        this.group = scene.physics.add.group();
    }

    /** Fires a bolt straight up from (x, y). */
    fire(x: number, y: number): void {
        const bolt = this.scene.physics.add.sprite(x, y, firstFrame('shadowBolt'));
        // The frames point right; turned to fly upwards. The hitbox is a square, as in the p5 game.
        bolt.setScale(BOLT_SIZE / bolt.width).setAngle(-90).setDepth(this.depth);
        bolt.body.setSize(bolt.width, bolt.width, true);
        bolt.play(ANIMATIONS.shadowBolt);
        this.group.add(bolt);
        bolt.setVelocityY(-BOLT_SPEED);
    }

    /** Removes bolts that have left the top of the screen. */
    update(): void {
        for (const bolt of this.group.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
            if (bolt.active && bolt.y < -BOLT_SIZE) {
                bolt.destroy();
            }
        }
    }
}
